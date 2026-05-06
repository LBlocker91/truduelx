import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import {
  resolveHit,
  applyEffect,
  tickStatusEffects,
  tickCooldowns,
  isStunned,
  isUltimateSkill,
  ULTIMATE_CHARGE_REQUIRED,
  makeRng,
  ParticipantState,
  SkillDef,
} from '../_shared/combat.ts';

const TURN_LIMIT_MS = 10_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return j({ error: 'unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return j({ error: 'unauthorized' }, 401);

    const admin = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const { battleId, action, skillSlug, targetSlot } = body;

    if (!battleId || !action) return j({ error: 'battleId+action required' }, 400);

    const { data: battle } = await admin.from('battles').select('*').eq('id', battleId).maybeSingle();
    if (!battle) return j({ error: 'battle not found' }, 404);
    if (battle.status !== 'active') return j({ error: 'battle not active' }, 400);

    const { data: participants } = await admin.from('battle_participants').select('*').eq('battle_id', battleId).order('slot');
    if (!participants || participants.length < 2) return j({ error: 'invalid battle' }, 400);

    const me = participants.find((p: any) => p.user_id === user.id) as ParticipantState | undefined;
    if (!me) return j({ error: 'not a participant' }, 403);

    if (action === 'tick') {
      return await resolveExpiredTurn(admin, battle, participants);
    }

    const expired = isDeadlineExpired(battle.turn_deadline);
    if (expired && action !== 'forfeit') return j({ error: 'turn expired' }, 409);
    if (battle.current_turn !== user.id && action !== 'forfeit') return j({ error: 'not your turn' }, 400);

    const actor = me;
    const targetSlotResolved = typeof targetSlot === 'number'
      ? targetSlot
      : participants.find((p: any) => p.slot !== actor.slot)?.slot;
    const target = participants.find((p: any) => p.slot === targetSlotResolved) as ParticipantState | undefined;
    if (!target) return j({ error: 'invalid target' }, 400);

    if (action === 'forfeit') {
      await admin.from('battles').update({
        status: 'finished',
        winner_user_id: target.snapshot.user_id,
        finished_at: new Date().toISOString(),
      }).eq('id', battleId);
      await admin.from('battle_actions').insert({
        battle_id: battleId,
        turn_number: battle.turn_number,
        actor_user_id: user.id,
        actor_slot: actor.slot,
        action_type: 'forfeit',
        result: { winner: target.snapshot.user_id },
      });
      return j({ ok: true, finished: true });
    }

    if (isStunned(actor)) {
      const result = advancePassiveTurn(actor, target, 'stunned');
      await commitTurn(admin, battle, participants, actor, target, 'stunned', null, result);
      return j({ ok: true, stunned: true, result });
    }

    const rng = makeRng(Number(battle.seed) + battle.turn_number);
    const result: any = { hits: [] };

    if (action === 'defend') {
      result.defending = true;
      actor.energy = Math.min(actor.max_energy, actor.energy + 15);
    } else if (action === 'attack') {
      const hit = resolveHit({ attacker: actor, defender: target, skill: null, defending: false, rng });
      target.hp = Math.max(0, target.hp - hit.damage);
      actor.rage = Math.min(100, actor.rage + 10);
      result.hits.push(hit);
    } else if (action === 'skill') {
      if (!skillSlug) return j({ error: 'skillSlug required' }, 400);
      const { data: skill } = await admin.from('skills').select('*').eq('slug', skillSlug).maybeSingle();
      if (!skill) return j({ error: 'skill not found' }, 404);

      const skillDef = skill as SkillDef;
      const lvl = (actor.snapshot.skill_levels as Record<string, number> | undefined)?.[skillSlug] ?? 0;
      if (lvl < 1) return j({ error: 'skill not learned' }, 403);
      if (actor.snapshot.level < skillDef.unlock_level) return j({ error: 'level too low' }, 403);
      if ((actor.cooldowns[skillSlug] ?? 0) > 0) return j({ error: 'on cooldown' }, 400);
      if (actor.energy < skillDef.energy_cost) return j({ error: 'not enough energy' }, 400);

      actor.energy -= skillDef.energy_cost;
      actor.cooldowns[skillSlug] = skillDef.cooldown;

      for (let i = 0; i < skillDef.hits; i++) {
        if (target.hp <= 0) break;
        const hit = resolveHit({ attacker: actor, defender: target, skill: skillDef, defending: false, rng });
        target.hp = Math.max(0, target.hp - hit.damage);
        result.hits.push(hit);
      }

      if (skillDef.effect && skillDef.effect !== 'none') {
        const isSelf = ['heal', 'energy_recovery', 'buff_attack', 'crit_buff', 'defense_buff', 'damage_absorb', 'dodge', 'stat_buff_all'].includes(skillDef.effect);
        applyEffect(isSelf ? actor : target, skillDef.effect as any, Number(skillDef.effect_value), 2);
        result.effect = skillDef.effect;
      }
      actor.rage = Math.min(100, actor.rage + 15);
    } else {
      return j({ error: 'invalid action' }, 400);
    }

    const tickRes = tickStatusEffects(target);
    if (tickRes.dotDamage > 0) result.dot = tickRes.dotDamage;
    tickCooldowns(actor);

    await commitTurn(admin, battle, participants, actor, target, action, skillSlug ?? null, result);
    return j({ ok: true, result });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

async function resolveExpiredTurn(admin: any, battle: any, participants: any[]) {
  if (!isDeadlineExpired(battle.turn_deadline)) return j({ ok: true, skipped: false });

  const actor = participants.find((p: any) => p.user_id === battle.current_turn) as ParticipantState | undefined;
  const target = participants.find((p: any) => p.user_id !== battle.current_turn) as ParticipantState | undefined;
  if (!actor || !target) return j({ error: 'invalid turn owner' }, 400);

  const result = advancePassiveTurn(actor, target, 'timeout');
  await commitTurn(admin, battle, participants, actor, target, 'timeout', null, result);
  return j({ ok: true, skipped: true, result });
}

function advancePassiveTurn(actor: ParticipantState, target: ParticipantState, reason: 'stunned' | 'timeout') {
  const result: Record<string, unknown> = reason === 'stunned' ? { stunned: true } : { timed_out: true };
  const tickRes = tickStatusEffects(target);
  if (tickRes.dotDamage > 0) result.dot = tickRes.dotDamage;
  tickCooldowns(actor);
  return result;
}

async function commitTurn(
  admin: any,
  battle: any,
  participants: any[],
  actor: any,
  target: any,
  action: string,
  skillSlug: string | null,
  result: any = {},
) {
  const next = participants.find((p: any) => p.slot !== actor.slot);
  const actionTurnNumber = battle.turn_number;

  await admin.from('battle_participants').update({
    hp: actor.hp,
    energy: actor.energy,
    rage: actor.rage,
    status_effects: actor.status_effects,
    cooldowns: actor.cooldowns,
  }).eq('battle_id', battle.id).eq('slot', actor.slot);

  await admin.from('battle_participants').update({
    hp: target.hp,
    energy: target.energy,
    rage: target.rage,
    status_effects: target.status_effects,
    cooldowns: target.cooldowns,
  }).eq('battle_id', battle.id).eq('slot', target.slot);

  await admin.from('battle_actions').insert({
    battle_id: battle.id,
    turn_number: actionTurnNumber,
    actor_user_id: actor.snapshot.user_id,
    actor_slot: actor.slot,
    action_type: action,
    skill_slug: skillSlug,
    target_slot: target.slot,
    result: enrichActionResult(result, actor, target, target.hp <= 0
      ? { battleFinished: true, winnerUserId: actor.snapshot.user_id, nextTurnNumber: actionTurnNumber, nextTurnUserId: null }
      : { nextTurnNumber: actionTurnNumber + 1, nextTurnUserId: next?.user_id ?? null }),
  });

  if (target.hp <= 0) {
    await admin.from('battles').update({
      status: 'finished',
      winner_user_id: actor.snapshot.user_id,
      finished_at: new Date().toISOString(),
    }).eq('id', battle.id);

    if (actor.snapshot.user_id && target.snapshot.user_id) {
      await admin.from('profiles').update({
        wins: (await getCount(admin, actor.snapshot.user_id, 'wins')) + 1,
        elo_rating: (await getElo(admin, actor.snapshot.user_id)) + 25,
      }).eq('user_id', actor.snapshot.user_id);
      await admin.from('profiles').update({
        losses: (await getCount(admin, target.snapshot.user_id, 'losses')) + 1,
        elo_rating: Math.max(0, (await getElo(admin, target.snapshot.user_id)) - 25),
      }).eq('user_id', target.snapshot.user_id);
    }
    return;
  }

  await admin.from('battles').update({
    current_turn: next.user_id,
    turn_number: actionTurnNumber + 1,
    turn_deadline: deadlineFromNow(TURN_LIMIT_MS),
  }).eq('id', battle.id);
}

function enrichActionResult(
  result: Record<string, unknown>,
  actor: ParticipantState,
  target: ParticipantState,
  meta: {
    nextTurnNumber: number;
    nextTurnUserId: string | null;
    battleFinished?: boolean;
    winnerUserId?: string | null;
  },
) {
  return {
    ...result,
    actor_state: snapshotParticipant(actor),
    target_state: snapshotParticipant(target),
    next_turn_number: meta.nextTurnNumber,
    next_turn_user_id: meta.nextTurnUserId,
    battle_finished: meta.battleFinished ?? false,
    winner_user_id: meta.winnerUserId ?? null,
  };
}

function snapshotParticipant(p: ParticipantState) {
  return {
    slot: p.slot,
    user_id: p.user_id ?? p.snapshot?.user_id ?? null,
    hp: p.hp,
    max_hp: p.max_hp,
    energy: p.energy,
    max_energy: p.max_energy,
    rage: p.rage,
    status_effects: p.status_effects,
    cooldowns: p.cooldowns,
    snapshot: p.snapshot,
  };
}

async function getCount(admin: any, userId: string, field: 'wins' | 'losses') {
  const { data } = await admin.from('profiles').select(field).eq('user_id', userId).maybeSingle();
  return data?.[field] ?? 0;
}

async function getElo(admin: any, userId: string) {
  const { data } = await admin.from('profiles').select('elo_rating').eq('user_id', userId).maybeSingle();
  return data?.elo_rating ?? 1000;
}

function isDeadlineExpired(deadline: string | null) {
  return !!deadline && new Date(deadline).getTime() <= Date.now();
}

function deadlineFromNow(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
