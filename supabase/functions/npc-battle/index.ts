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
  calcMaxHp,
  ParticipantState,
  SkillDef,
  CharacterSnapshot,
} from '../_shared/combat.ts';
import { applyXp } from '../_shared/leveling.ts';

const TURN_LIMIT_MS = 10_000;
const BOT_RESPONSE_DELAY_MS = 900;

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

    if (body.action === 'start') {
      return await startBattle(admin, user.id, body.npcId, body.characterId);
    }
    if (body.action === 'act') {
      return await processAction(admin, user.id, body.battleId, body.playerAction, body.skillSlug, body.itemSubtype, body.weaponSlot);
    }
    return j({ error: 'invalid action' }, 400);
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

async function startBattle(admin: any, userId: string, npcId: string, characterId: string) {
  const { data: npc } = await admin.from('npcs').select('*').eq('id', npcId).maybeSingle();
  if (!npc || npc.type !== 'enemy') return j({ error: 'npc not fightable' }, 400);
  const { data: enemy } = await admin.from('npc_enemies').select('*').eq('npc_id', npcId).maybeSingle();
  if (!enemy) return j({ error: 'npc has no combat stats' }, 400);

  const playerSnap = await buildPlayerSnapshot(admin, characterId, userId);
  if (!playerSnap) return j({ error: 'character not found' }, 404);

  const { data: charForBonus } = await admin.from('characters')
    .select('bonus_max_hp, bonus_max_mp')
    .eq('id', characterId)
    .maybeSingle();
  const bonusHp = charForBonus?.bonus_max_hp ?? 0;
  const bonusMp = charForBonus?.bonus_max_mp ?? 0;

  // Re-fetch equipped items just to extract HP/MP modifiers (cheap, idempotent).
  const { data: equippedRows } = await admin.from('inventory')
    .select('items(stat_modifiers)').eq('character_id', characterId).eq('equipped', true);
  const gearVitals = gearVitalBonuses((equippedRows ?? []).map((r: any) => r.items));

  const playerHp = calcMaxHp(playerSnap.strength, playerSnap.level) + bonusHp + gearVitals.hp;
  const playerMp = 100 + bonusMp + gearVitals.mp;
  const isBoss = !!(enemy as any).is_boss;
  // Non-boss NPCs are tuned to be beatable by an even-level player.
  const enemyHpMult = isBoss ? Number((enemy as any).hp_multiplier ?? 1.8) : 1.05;
  const enemyHp = Math.floor(calcMaxHp(enemy.strength, enemy.level) * enemyHpMult);

  // For non-boss enemies, soften their stat block (≈70% of authored values, defense floored).
  const trashScale = (v: number) => Math.max(1, Math.floor(v * 0.7));
  const enemyStr = isBoss ? enemy.strength    : trashScale(enemy.strength);
  const enemyDex = isBoss ? enemy.dexterity   : trashScale(enemy.dexterity);
  const enemyTec = isBoss ? enemy.technology  : trashScale(enemy.technology);
  const enemySup = isBoss ? enemy.support     : trashScale(enemy.support);
  const enemyWMin = isBoss ? enemy.weapon_min : Math.floor(enemy.weapon_min * 0.65);
  const enemyWMax = isBoss ? enemy.weapon_max : Math.floor(enemy.weapon_max * 0.65);
  const enemyDef  = isBoss ? (enemy.defense ?? 0)    : Math.floor((enemy.defense ?? 0) * 0.6);
  const enemyRes  = isBoss ? (enemy.resistance ?? 0) : Math.floor((enemy.resistance ?? 0) * 0.6);

  const enemySnap: CharacterSnapshot = {
    user_id: null,
    character_id: null,
    name: npc.name,
    class: enemy.class,
    level: enemy.level,
    strength: enemyStr,
    dexterity: enemyDex,
    technology: enemyTec,
    support: enemySup,
    weapon_min: enemyWMin,
    weapon_max: enemyWMax,
    weapon_subtype: 'heavy',
    weapon_damage_type: 'physical',
    weapon_scale_stat: 'strength',
    defense: enemyDef,
    resistance: enemyRes,
    skill_levels: Object.fromEntries((enemy.skill_slugs ?? []).map((s: string) => [s, isBoss ? 5 : 3])),
    is_boss: isBoss,
  } as any;

  const { data: battle, error: bErr } = await admin.from('battles').insert({
    mode: 'pve_npc',
    status: 'active',
    turn_number: 1,
    npc_id: npcId,
    current_turn: userId,
    turn_deadline: deadlineFromNow(TURN_LIMIT_MS),
  }).select().single();
  if (bErr || !battle) return j({ error: bErr?.message ?? 'battle insert failed' }, 500);

  await admin.from('battle_participants').insert([
    {
      battle_id: battle.id,
      user_id: userId,
      character_id: characterId,
      slot: 0,
      hp: playerHp,
      max_hp: playerHp,
      energy: playerMp,
      max_energy: playerMp,
      snapshot: { ...playerSnap, max_hp: playerHp },
      is_bot: false,
      ultimate_charge: 0,
    },
    {
      battle_id: battle.id,
      user_id: null,
      character_id: null,
      slot: 1,
      is_bot: true,
      hp: enemyHp,
      max_hp: enemyHp,
      energy: 100,
      max_energy: 100,
      snapshot: { ...enemySnap, max_hp: enemyHp },
      ultimate_charge: 0,
    },
  ]);

  return j({ ok: true, battleId: battle.id });
}

async function processAction(
  admin: any,
  userId: string,
  battleId: string,
  playerAction: string,
  skillSlug?: string,
  itemSubtype?: string,
  weaponSlot?: 'melee' | 'gun' | 'launcher' | 'pet',
) {
  const { data: battle } = await admin.from('battles').select('*').eq('id', battleId).maybeSingle();
  if (!battle) return j({ error: 'battle not found' }, 404);
  if (battle.mode !== 'pve_npc') return j({ error: 'not a pve battle' }, 400);
  if (battle.status !== 'active') return j({ error: 'battle not active' }, 400);

  const { data: parts } = await admin.from('battle_participants').select('*').eq('battle_id', battleId).order('slot');
  if (!parts || parts.length < 2) return j({ error: 'invalid battle' }, 400);

  const player = parts[0] as ParticipantState & { character_id: string | null };
  const bot = parts[1] as ParticipantState;

  if (playerAction === 'tick') {
    if (battle.current_turn === null) {
      if (!isDeadlineExpired(battle.turn_deadline)) {
        return j({ ok: true, skipped: false, waiting: true });
      }
      return await processBotTurn(admin, battle, userId, player, bot);
    }
    if (battle.current_turn === userId && isDeadlineExpired(battle.turn_deadline)) {
      return await resolvePlayerTimeout(admin, battle, battleId, userId, player, bot);
    }
    return j({ ok: true, skipped: false });
  }

  if (battle.current_turn !== userId) return j({ error: 'not your turn' }, 400);
  if (isDeadlineExpired(battle.turn_deadline) && playerAction !== 'forfeit') {
    return await resolvePlayerTimeout(admin, battle, battleId, userId, player, bot);
  }

  const playerResult = await executeTurn({
    admin,
    battle,
    actor: player,
    target: bot,
    action: playerAction,
    skillSlug,
    itemSubtype,
    weaponSlot,
    isBot: false,
    characterId: player.character_id ?? null,
  });
  if (playerResult.error) return j({ error: playerResult.error }, 400);

  await persistParticipant(admin, battleId, player);
  await persistParticipant(admin, battleId, bot);
  await admin.from('battle_actions').insert({
    battle_id: battleId,
    turn_number: battle.turn_number,
    actor_user_id: userId,
    actor_slot: 0,
    action_type: playerAction,
    skill_slug: skillSlug ?? null,
    target_slot: 1,
    result: enrichActionResult(playerResult.result, player, bot, bot.hp <= 0
      ? { battleFinished: true, winnerUserId: userId, nextTurnNumber: battle.turn_number, nextTurnUserId: null }
      : player.hp <= 0
        ? { battleFinished: true, winnerUserId: null, nextTurnNumber: battle.turn_number, nextTurnUserId: null }
        : { nextTurnNumber: battle.turn_number + 1, nextTurnUserId: null }),
  });

  if (bot.hp <= 0) {
    await finishBattle(admin, battle.id, userId);
    const rewards = await awardRewards(admin, battleId);
    return j({ ok: true, finished: true, won: true, ...rewards });
  }
  if (player.hp <= 0) {
    await finishBattle(admin, battle.id, null);
    return j({ ok: true, finished: true, won: false });
  }

  await admin.from('battles').update({
    turn_number: battle.turn_number + 1,
    current_turn: null,
    turn_deadline: new Date(Date.now() + BOT_RESPONSE_DELAY_MS).toISOString(),
  }).eq('id', battleId);

  return j({ ok: true, finished: false });
}

async function processBotTurn(admin: any, battle: any, userId: string, player: ParticipantState, bot: ParticipantState) {
  const botAction = await botChooseAction(admin, bot);
  const botResult = await executeTurn({
    admin,
    battle,
    actor: bot,
    target: player,
    action: botAction.action,
    skillSlug: botAction.skillSlug,
    isBot: true,
  });
  if (botResult.error) return j({ error: botResult.error }, 400);

  await persistParticipant(admin, battle.id, player);
  await persistParticipant(admin, battle.id, bot);
  await admin.from('battle_actions').insert({
    battle_id: battle.id,
    turn_number: battle.turn_number,
    actor_user_id: null,
    actor_slot: 1,
    action_type: botAction.action,
    skill_slug: botAction.skillSlug ?? null,
    target_slot: 0,
    result: enrichActionResult(botResult.result, bot, player, player.hp <= 0
      ? { battleFinished: true, winnerUserId: null, nextTurnNumber: battle.turn_number, nextTurnUserId: null }
      : bot.hp <= 0
        ? { battleFinished: true, winnerUserId: userId, nextTurnNumber: battle.turn_number, nextTurnUserId: null }
        : { nextTurnNumber: battle.turn_number + 1, nextTurnUserId: userId }),
  });

  if (player.hp <= 0) {
    await finishBattle(admin, battle.id, null);
    return j({ ok: true, finished: true, won: false });
  }
  if (bot.hp <= 0) {
    await finishBattle(admin, battle.id, userId);
    const rewards = await awardRewards(admin, battle.id);
    return j({ ok: true, finished: true, won: true, ...rewards });
  }

  await admin.from('battles').update({
    turn_number: battle.turn_number + 1,
    current_turn: userId,
    turn_deadline: deadlineFromNow(TURN_LIMIT_MS),
  }).eq('id', battle.id);

  return j({ ok: true, finished: false });
}

async function resolvePlayerTimeout(
  admin: any,
  battle: any,
  battleId: string,
  userId: string,
  player: ParticipantState,
  bot: ParticipantState,
) {
  const timeoutResult = advancePassiveTurn(player, bot, 'timeout');
  const nextTurnNumber = battle.turn_number + 1;

  await persistParticipant(admin, battleId, player);
  await persistParticipant(admin, battleId, bot);
  await admin.from('battle_actions').insert({
    battle_id: battleId,
    turn_number: battle.turn_number,
    actor_user_id: userId,
    actor_slot: 0,
    action_type: 'timeout',
    skill_slug: null,
    target_slot: 1,
    result: enrichActionResult(timeoutResult, player, bot, {
      nextTurnNumber,
      nextTurnUserId: null,
    }),
  });
  await admin.from('battles').update({
    turn_number: nextTurnNumber,
    current_turn: null,
    turn_deadline: new Date(Date.now() + BOT_RESPONSE_DELAY_MS).toISOString(),
  }).eq('id', battleId);

  return j({ ok: true, skipped: true, timeout: true });
}

async function executeTurn({
  admin,
  battle,
  actor,
  target,
  action,
  skillSlug,
  itemSubtype,
  weaponSlot,
  isBot,
  characterId,
}: {
  admin: any;
  battle: any;
  actor: ParticipantState;
  target: ParticipantState;
  action: string;
  skillSlug?: string;
  itemSubtype?: string;
  weaponSlot?: 'melee' | 'gun' | 'launcher' | 'pet';
  isBot: boolean;
  characterId?: string | null;
}): Promise<{ result: any; error?: string }> {
  if (isStunned(actor)) {
    return { result: advancePassiveTurn(actor, target, 'stunned') };
  }

  const rng = makeRng(Number(battle.seed) + battle.turn_number * (isBot ? 7 : 1));
  const result: any = { hits: [] };

  if (action === 'forfeit') {
    actor.hp = 0;
    return { result: { forfeit: true } };
  }
  if (action === 'use_item') {
    if (isBot || !characterId) return { result: {}, error: 'cannot use item' };
    if (!itemSubtype || (itemSubtype !== 'hp_potion' && itemSubtype !== 'mp_potion')) {
      return { result: {}, error: 'invalid item' };
    }
    const { data: invRow } = await admin.from('inventory')
      .select('id, quantity, items!inner(id, subtype, consumable, name)')
      .eq('character_id', characterId)
      .eq('items.subtype', itemSubtype)
      .maybeSingle();
    if (!invRow || !invRow.items?.consumable) return { result: {}, error: 'item not in inventory' };
    if ((invRow.quantity ?? 0) <= 0) return { result: {}, error: 'out of potions' };

    if (itemSubtype === 'hp_potion') {
      if (actor.hp >= actor.max_hp) return { result: {}, error: 'HP already full' };
      const restore = Math.floor(actor.max_hp * 0.5);
      const before = actor.hp;
      actor.hp = Math.min(actor.max_hp, actor.hp + restore);
      result.heal = actor.hp - before;
      result.item = 'hp_potion';
    } else {
      if (actor.energy >= actor.max_energy) return { result: {}, error: 'MP already full' };
      const restore = Math.floor(actor.max_energy * 0.5);
      const before = actor.energy;
      actor.energy = Math.min(actor.max_energy, actor.energy + restore);
      result.mpHeal = actor.energy - before;
      result.item = 'mp_potion';
    }

    const newQty = (invRow.quantity ?? 1) - 1;
    if (newQty <= 0) {
      await admin.from('inventory').delete().eq('id', invRow.id);
    } else {
      await admin.from('inventory').update({ quantity: newQty }).eq('id', invRow.id);
    }
  } else if (action === 'defend') {
    actor.energy = Math.min(actor.max_energy, actor.energy + 15);
    result.defending = true;
    actor.ultimate_charge = Math.min(ULTIMATE_CHARGE_REQUIRED, (actor.ultimate_charge ?? 0) + 1);
    result.ultimate_charge = actor.ultimate_charge;
  } else if (action === 'attack') {
    const slot = !isBot && weaponSlot ? weaponSlot : undefined;
    const wmap = (actor.snapshot as any).weapons ?? {};
    if (slot && !wmap[slot]) return { result: {}, error: `no ${slot} equipped` };
    const hit = resolveHit({ attacker: actor, defender: target, skill: null, defending: false, rng, weaponSlot: slot });
    target.hp = Math.max(0, target.hp - hit.damage);
    actor.rage = Math.min(100, actor.rage + 10);
    result.hits.push(hit);
    if (slot) result.weapon_slot = slot;
    if (!hit.dodged) {
      actor.ultimate_charge = Math.min(ULTIMATE_CHARGE_REQUIRED, (actor.ultimate_charge ?? 0) + 1);
    }
    result.ultimate_charge = actor.ultimate_charge;
  } else if (action === 'skill') {
    if (!skillSlug) return { result: {}, error: 'skillSlug required' };
    const { data: skill } = await admin.from('skills').select('*').eq('slug', skillSlug).maybeSingle();
    if (!skill) return { result: {}, error: 'skill not found' };
    const def = skill as SkillDef;
    const ult = isUltimateSkill(def);
    const lvl = (actor.snapshot.skill_levels as any)?.[skillSlug] ?? 0;
    if (lvl < 1 && !isBot) return { result: {}, error: 'skill not learned' };
    if (actor.snapshot.level < def.unlock_level && !isBot) return { result: {}, error: 'level too low' };
    if ((actor.cooldowns[skillSlug] ?? 0) > 0) return { result: {}, error: 'Ultimate is on cooldown.' };
    if (actor.energy < def.energy_cost) return { result: {}, error: 'not enough energy' };
    if (ult && (actor.ultimate_charge ?? 0) < ULTIMATE_CHARGE_REQUIRED) {
      return { result: {}, error: 'Ultimate requires 3 charge.' };
    }
    actor.energy -= def.energy_cost;
    actor.cooldowns[skillSlug] = def.cooldown;
    for (let i = 0; i < def.hits; i++) {
      if (target.hp <= 0) break;
      const hit = resolveHit({ attacker: actor, defender: target, skill: def, defending: false, rng, isUltimate: ult });
      target.hp = Math.max(0, target.hp - hit.damage);
      result.hits.push(hit);
    }
    if (def.effect && def.effect !== 'none') {
      const isSelf = ['heal', 'energy_recovery', 'buff_attack', 'crit_buff', 'defense_buff', 'damage_absorb', 'dodge', 'stat_buff_all'].includes(def.effect);
      applyEffect(isSelf ? actor : target, def.effect as any, Number(def.effect_value), 2);
      result.effect = def.effect;
    }
    actor.rage = Math.min(100, actor.rage + 15);
    if (ult) {
      actor.ultimate_charge = 0;
      result.ultimate_used = true;
    } else {
      actor.ultimate_charge = Math.min(ULTIMATE_CHARGE_REQUIRED, (actor.ultimate_charge ?? 0) + 1);
    }
    result.ultimate_charge = actor.ultimate_charge;
  } else {
    return { result: {}, error: 'invalid action' };
  }

  const tickRes = tickStatusEffects(target);
  if (tickRes.dotDamage > 0) result.dot = tickRes.dotDamage;
  tickCooldowns(actor);
  return { result };
}

async function botChooseAction(admin: any, bot: ParticipantState): Promise<{ action: string; skillSlug?: string }> {
  const hpPct = bot.hp / bot.max_hp;
  const slugs = Object.keys(bot.snapshot.skill_levels ?? {});
  let usable = slugs.filter(s => (bot.cooldowns[s] ?? 0) === 0 && bot.energy >= 10);

  // Filter ultimates the bot cannot afford to use yet (charge < required)
  if (usable.length) {
    const { data: skillRows } = await admin.from('skills').select('slug, cooldown').in('slug', usable);
    const ultSlugs = new Set((skillRows ?? []).filter((r: any) => (r.cooldown ?? 0) >= 6).map((r: any) => r.slug));
    if ((bot.ultimate_charge ?? 0) < ULTIMATE_CHARGE_REQUIRED) {
      usable = usable.filter(s => !ultSlugs.has(s));
    }
  }

  if (hpPct < 0.3) {
    const heal = usable.find(s => /medic|vanish|firewall|battle-orders/.test(s));
    if (heal) return { action: 'skill', skillSlug: heal };
  }
  const stun = usable.find(s => /shock|emp|system-lock|virus/.test(s));
  if (stun && Math.random() < 0.5) return { action: 'skill', skillSlug: stun };
  const dmg = usable.find(s => /strike|cut|shot|volley|bomb|flurry|edge|spark|rend|slam|storm|fire|spike|cascade|bash/.test(s));
  if (dmg) return { action: 'skill', skillSlug: dmg };
  return { action: 'attack' };
}

function advancePassiveTurn(actor: ParticipantState, target: ParticipantState, reason: 'stunned' | 'timeout') {
  const result: Record<string, unknown> = reason === 'stunned' ? { stunned: true } : { timed_out: true };
  const tickRes = tickStatusEffects(target);
  if (tickRes.dotDamage > 0) result.dot = tickRes.dotDamage;
  tickCooldowns(actor);
  return result;
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
    ultimate_charge: p.ultimate_charge ?? 0,
    status_effects: p.status_effects,
    cooldowns: p.cooldowns,
    snapshot: p.snapshot,
  };
}

async function persistParticipant(admin: any, battleId: string, p: ParticipantState) {
  await admin.from('battle_participants').update({
    hp: p.hp,
    energy: p.energy,
    rage: p.rage,
    ultimate_charge: p.ultimate_charge ?? 0,
    status_effects: p.status_effects,
    cooldowns: p.cooldowns,
  }).eq('battle_id', battleId).eq('slot', p.slot);
}

async function finishBattle(admin: any, battleId: string, winnerUserId: string | null) {
  await admin.from('battles').update({
    status: 'finished',
    winner_user_id: winnerUserId,
    finished_at: new Date().toISOString(),
  }).eq('id', battleId);
}

async function awardRewards(admin: any, battleId: string): Promise<any> {
  const { data: b } = await admin.from('battles').select('npc_id, winner_user_id').eq('id', battleId).maybeSingle();
  if (!b?.npc_id || !b.winner_user_id) return null;
  const { data: en } = await admin.from('npc_enemies').select('xp_reward, credit_reward, level').eq('npc_id', b.npc_id).maybeSingle();
  const baseXp = en?.xp_reward ?? 50;
  const baseCredits = en?.credit_reward ?? 10;
  const enemyLevel = en?.level ?? 1;

  const { data: parts } = await admin.from('battle_participants')
    .select('character_id')
    .eq('battle_id', battleId)
    .eq('user_id', b.winner_user_id)
    .maybeSingle();

  let updatedCharacter: any = null;
  let level: any = null;
  let xpGained = baseXp;
  let creditsGained = baseCredits;
  if (parts?.character_id) {
    const { data: ch } = await admin.from('characters').select('*').eq('id', parts.character_id).maybeSingle();
    if (ch) {
      const playerLevel = ch.level ?? 1;
      const effectiveLevel = Math.max(enemyLevel, playerLevel);
      const scaledXp = baseXp + effectiveLevel * 10;
      const scaledCredits = baseCredits + effectiveLevel * 4;
      const efficiency = Math.max(0.25, Math.min(1, 1 - (playerLevel - enemyLevel) * 0.05));
      xpGained = Math.max(1, Math.floor(scaledXp * efficiency));
      creditsGained = Math.max(1, Math.floor(scaledCredits * efficiency));

      const lvl = applyXp({
        xp: ch.xp ?? 0,
        level: ch.level ?? 1,
        statPoints: ch.stat_points ?? 0,
        skillPoints: ch.skill_points ?? 0,
        strength: ch.strength ?? 10,
      }, xpGained);
      const { data: u } = await admin.from('characters').update({
        xp: lvl.xp,
        level: lvl.level,
        stat_points: lvl.statPoints,
        skill_points: lvl.skillPoints,
        credits: (ch.credits ?? 0) + creditsGained,
      }).eq('id', parts.character_id).select('*').single();
      updatedCharacter = u;
      level = {
        oldLevel: lvl.oldLevel,
        newLevel: lvl.newLevel,
        levelsGained: lvl.levelsGained,
        statPointsGained: lvl.statPointsGained,
        skillPointsGained: lvl.skillPointsGained,
        maxHpGained: lvl.maxHpGained,
      };
    }
  }

  const { data: pqs } = await admin.from('player_quests')
    .select('*')
    .eq('user_id', b.winner_user_id)
    .eq('completed', false);
  for (const pq of pqs ?? []) {
    const { data: q } = await admin.from('quests').select('*').eq('id', pq.quest_id).maybeSingle();
    const obj = q?.objectives?.defeat ?? {};
    if (obj[b.npc_id]) {
      const prog = pq.progress ?? {};
      const defeat = prog.defeat ?? {};
      defeat[b.npc_id] = (defeat[b.npc_id] ?? 0) + 1;
      prog.defeat = defeat;
      const completed = Object.entries(obj).every(([k, v]: any) => (defeat[k] ?? 0) >= v);
      await admin.from('player_quests').update({
        progress: prog,
        completed,
        updated_at: new Date().toISOString(),
      }).eq('id', pq.id);
    }
  }
  return { xpGained, creditsGained, updatedCharacter, level };
}

/** Pick the natural scaling stat for a weapon subtype. */
function weaponScaleStat(subtype: string | null | undefined): 'strength' | 'dexterity' | 'technology' | 'support' {
  switch (subtype) {
    case 'pistol':
    case 'rifle':           return 'dexterity';
    case 'tech_staff':      return 'technology';
    case 'rocket_launcher': return 'support';
    case 'drone':           return 'support';
    case 'blade':
    case 'heavy':
    default:                return 'strength';
  }
}

/** Returns the bonus max-HP and max-MP that gear adds via stat_modifiers. */
export function gearVitalBonuses(items: any[]): { hp: number; mp: number } {
  let hp = 0, mp = 0;
  for (const it of items ?? []) {
    const m = it?.stat_modifiers ?? {};
    hp += Number(m.max_hp ?? 0);
    mp += Number(m.max_energy ?? 0);
  }
  return { hp, mp };
}

async function buildPlayerSnapshot(admin: any, characterId: string, userId: string): Promise<CharacterSnapshot | null> {
  const { data: char } = await admin.from('characters').select('*').eq('id', characterId).eq('user_id', userId).maybeSingle();
  if (!char) return null;
  const { data: inv } = await admin.from('inventory')
    .select('item_id, upgrade_level, items(*)')
    .eq('character_id', characterId).eq('equipped', true);
  let weaponMin = 15, weaponMax = 22;
  let weaponSubtype: string | undefined;
  let weaponDamageType: 'physical' | 'energy' | 'hybrid' = 'physical';
  let weaponScale: 'strength' | 'dexterity' | 'technology' | 'support' = 'strength';
  let defenseGear = 0, resistanceGear = 0;
  let strBonus = 0, dexBonus = 0, techBonus = 0, supBonus = 0;
  let weaponVariant: string | null = null;
  let armorVariant: string | null = null;
  let wingsVariant: string | null = null;
  let petVariant: string | null = null;
  const weapons: Record<string, any> = {};
  let primaryWeaponItem: any = null;
  const slotKey = (slot: string, sub?: string): 'melee' | 'gun' | 'launcher' | 'pet' | null => {
    if (slot === 'gun') return 'gun';
    if (slot === 'launcher') return 'launcher';
    if (slot === 'pet') return 'pet';
    if (slot === 'weapon' || slot === 'staff') return 'melee';
    if (sub === 'pistol' || sub === 'rifle') return 'gun';
    if (sub === 'rocket_launcher') return 'launcher';
    if (sub === 'drone') return 'pet';
    if (sub === 'tech_staff' || sub === 'blade' || sub === 'heavy') return 'melee';
    return null;
  };
  // 8% per upgrade level, compounded.
  const upgradeMult = (lvl: number) => Math.pow(1.08, Math.max(0, Number(lvl ?? 0) | 0));

  for (const row of inv ?? []) {
    const it = (row as any).items;
    if (!it) continue;
    const upMult = upgradeMult((row as any).upgrade_level ?? 0);
    const sk = slotKey(it.slot, it.weapon_subtype);
    if (sk && it.min_damage && it.max_damage) {
      const min = Math.round(it.min_damage * upMult);
      const max = Math.round(it.max_damage * upMult);
      weapons[sk] = {
        min, max,
        subtype: it.weapon_subtype ?? sk,
        damage_type: (it.damage_type as any) ?? 'physical',
        scale_stat: weaponScaleStat(it.weapon_subtype),
      };
      if (!primaryWeaponItem || sk === 'melee') {
        primaryWeaponItem = it;
        weaponMin = min;
        weaponMax = max;
        weaponSubtype = it.weapon_subtype ?? undefined;
        weaponDamageType = (it.damage_type as any) ?? 'physical';
        weaponScale = weaponScaleStat(it.weapon_subtype);
        weaponVariant = it.sprite_variant ?? it.subtype ?? null;
      }
    }
    if (it.slot === 'armor') armorVariant = it.sprite_variant ?? it.subtype ?? null;
    if (it.slot === 'wings') wingsVariant = it.sprite_variant ?? it.weapon_subtype ?? 'wings';
    if (it.slot === 'pet')   petVariant   = it.sprite_variant ?? it.weapon_subtype ?? 'drone';
    defenseGear += Math.round((it.defense ?? 0) * upMult);
    const m = it.stat_modifiers ?? {};
    strBonus      += Number(m.strength   ?? 0);
    dexBonus      += Number(m.dexterity  ?? 0);
    techBonus     += Number(m.technology ?? 0);
    supBonus      += Number(m.support    ?? 0);
    resistanceGear += Math.round(Number(m.resistance ?? 0) * upMult);
    defenseGear   += Math.round(Number(m.defense    ?? 0) * upMult);
  }
  if (!primaryWeaponItem) {
    weaponMin = 12; weaponMax = 18; weaponSubtype = 'unarmed';
    weaponDamageType = 'physical'; weaponScale = 'strength';
  }
  return {
    user_id: userId,
    character_id: characterId,
    name: char.name,
    class: char.class,
    level: char.level,
    strength: (char.strength ?? 10) + strBonus,
    dexterity: (char.dexterity ?? 10) + dexBonus,
    technology: (char.technology ?? 10) + techBonus,
    support: (char.support ?? 10) + supBonus,
    weapon_min: weaponMin,
    weapon_max: weaponMax,
    weapon_subtype: weaponSubtype,
    weapon_damage_type: weaponDamageType,
    weapon_scale_stat: weaponScale,
    weapons,
    defense: (char.defense ?? 5) + defenseGear,
    resistance: (char.resistance ?? 5) + resistanceGear,
    skill_levels: char.skill_levels ?? {},
    equipped: { weapon_variant: weaponVariant, armor_variant: armorVariant },
    equipped_extras: { wings_variant: wingsVariant, pet_variant: petVariant },
  };
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
