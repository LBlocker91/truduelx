// NPC battle orchestrator: creates a PvE battle vs an NPC and processes
// both player AND bot turns server-side. Reuses _shared/combat.ts so the
// existing PvP engine stays untouched.
//
// POST { action: 'start', npcId, characterId }
// POST { action: 'act',   battleId, playerAction: 'attack'|'defend'|'forfeit'|'skill', skillSlug? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  resolveHit, applyEffect, tickStatusEffects, tickCooldowns, isStunned,
  makeRng, calcMaxHp, ParticipantState, SkillDef, CharacterSnapshot,
} from '../_shared/combat.ts';
import { applyXp } from '../_shared/leveling.ts';

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
      return await processAction(admin, user.id, body.battleId, body.playerAction, body.skillSlug);
    }
    return j({ error: 'invalid action' }, 400);
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

// ----- START -----
async function startBattle(admin: any, userId: string, npcId: string, characterId: string) {
  const { data: npc } = await admin.from('npcs').select('*').eq('id', npcId).maybeSingle();
  if (!npc || npc.type !== 'enemy') return j({ error: 'npc not fightable' }, 400);
  const { data: enemy } = await admin.from('npc_enemies').select('*').eq('npc_id', npcId).maybeSingle();
  if (!enemy) return j({ error: 'npc has no combat stats' }, 400);

  const playerSnap = await buildPlayerSnapshot(admin, characterId, userId);
  if (!playerSnap) return j({ error: 'character not found' }, 404);

  // Pull bonus_max_hp / bonus_max_mp directly from character row
  const { data: charForBonus } = await admin.from('characters')
    .select('bonus_max_hp, bonus_max_mp').eq('id', characterId).maybeSingle();
  const bonusHp = charForBonus?.bonus_max_hp ?? 0;
  const bonusMp = charForBonus?.bonus_max_mp ?? 0;

  const playerHp = calcMaxHp(playerSnap.strength, playerSnap.level) + bonusHp;
  const playerMp = 100 + bonusMp;
  const enemyHp = calcMaxHp(enemy.strength, enemy.level);

  const enemySnap: CharacterSnapshot = {
    user_id: null,
    character_id: null,
    name: npc.name,
    class: enemy.class,
    level: enemy.level,
    strength: enemy.strength,
    dexterity: enemy.dexterity,
    technology: enemy.technology,
    support: enemy.support,
    weapon_min: enemy.weapon_min,
    weapon_max: enemy.weapon_max,
    defense: enemy.defense ?? 0,
    resistance: enemy.resistance ?? 0,
    skill_levels: Object.fromEntries((enemy.skill_slugs ?? []).map((s: string) => [s, 5])),
  };

  const { data: battle, error: bErr } = await admin.from('battles').insert({
    mode: 'pve_npc',
    status: 'active',
    turn_number: 1,
    npc_id: npcId,
    current_turn: userId,
    turn_deadline: new Date(Date.now() + 60_000).toISOString(),
  }).select().single();
  if (bErr || !battle) return j({ error: bErr?.message ?? 'battle insert failed' }, 500);

  await admin.from('battle_participants').insert([
    { battle_id: battle.id, user_id: userId, character_id: characterId, slot: 0,
      hp: playerHp, max_hp: playerHp, energy: 100, max_energy: 100,
      snapshot: { ...playerSnap, max_hp: playerHp }, is_bot: false },
    { battle_id: battle.id, user_id: null, character_id: null, slot: 1, is_bot: true,
      hp: enemyHp, max_hp: enemyHp, energy: 100, max_energy: 100,
      snapshot: { ...enemySnap, max_hp: enemyHp } },
  ]);

  return j({ ok: true, battleId: battle.id });
}

// ----- ACT -----
async function processAction(admin: any, userId: string, battleId: string, playerAction: string, skillSlug?: string) {
  const { data: battle } = await admin.from('battles').select('*').eq('id', battleId).maybeSingle();
  if (!battle) return j({ error: 'battle not found' }, 404);
  if (battle.mode !== 'pve_npc') return j({ error: 'not a pve battle' }, 400);
  if (battle.status !== 'active') return j({ error: 'battle not active' }, 400);
  if (battle.current_turn !== userId) return j({ error: 'not your turn' }, 400);

  const { data: parts } = await admin.from('battle_participants').select('*').eq('battle_id', battleId).order('slot');
  if (!parts || parts.length < 2) return j({ error: 'invalid battle' }, 400);
  const player = parts[0] as ParticipantState;
  const bot = parts[1] as ParticipantState;

  // ---- PLAYER TURN ----
  const playerResult = await executeTurn({
    admin, battle, actor: player, target: bot,
    action: playerAction, skillSlug, isBot: false,
  });
  if (playerResult.error) return j({ error: playerResult.error }, 400);

  await persistParticipant(admin, battleId, player);
  await persistParticipant(admin, battleId, bot);
  await admin.from('battle_actions').insert({
    battle_id: battleId, turn_number: battle.turn_number,
    actor_user_id: userId, actor_slot: 0,
    action_type: playerAction, skill_slug: skillSlug ?? null,
    target_slot: 1, result: playerResult.result,
  });

  // win check after player turn
  if (bot.hp <= 0) {
    await finishBattle(admin, battle.id, userId, true);
    const rewards = await awardRewards(admin, battleId);
    return j({ ok: true, finished: true, won: true, ...rewards });
  }
  if (player.hp <= 0) {
    await finishBattle(admin, battle.id, null, false);
    return j({ ok: true, finished: true, won: false });
  }

  // ---- BOT TURN ----
  let nextTurn = battle.turn_number + 1;
  let botAction = botChooseAction(bot);
  const botResult = await executeTurn({
    admin, battle: { ...battle, turn_number: nextTurn },
    actor: bot, target: player,
    action: botAction.action, skillSlug: botAction.skillSlug, isBot: true,
  });
  await persistParticipant(admin, battleId, player);
  await persistParticipant(admin, battleId, bot);
  await admin.from('battle_actions').insert({
    battle_id: battleId, turn_number: nextTurn,
    actor_user_id: null, actor_slot: 1,
    action_type: botAction.action, skill_slug: botAction.skillSlug ?? null,
    target_slot: 0, result: botResult.result,
  });

  if (player.hp <= 0) {
    await finishBattle(admin, battle.id, null, false);
    return j({ ok: true, finished: true, won: false });
  }
  if (bot.hp <= 0) {
    await finishBattle(admin, battle.id, userId, true);
    const rewards = await awardRewards(admin, battleId);
    return j({ ok: true, finished: true, won: true, ...rewards });
  }

  await admin.from('battles').update({
    turn_number: nextTurn + 1,
    current_turn: userId,
    turn_deadline: new Date(Date.now() + 60_000).toISOString(),
  }).eq('id', battleId);

  return j({ ok: true, finished: false });
}

// Generic turn executor mirroring battle-action's behaviour.
async function executeTurn({
  admin, battle, actor, target, action, skillSlug, isBot,
}: {
  admin: any; battle: any; actor: ParticipantState; target: ParticipantState;
  action: string; skillSlug?: string; isBot: boolean;
}): Promise<{ result: any; error?: string }> {
  if (isStunned(actor)) {
    tickStatusEffects(actor); tickCooldowns(actor);
    return { result: { stunned: true } };
  }
  const rng = makeRng(Number(battle.seed) + battle.turn_number * (isBot ? 7 : 1));
  const result: any = { hits: [] };

  if (action === 'forfeit') {
    actor.hp = 0;
    return { result: { forfeit: true } };
  }
  if (action === 'defend') {
    actor.energy = Math.min(actor.max_energy, actor.energy + 15);
    result.defending = true;
  } else if (action === 'attack') {
    const hit = resolveHit({ attacker: actor, defender: target, skill: null, defending: false, rng });
    target.hp = Math.max(0, target.hp - hit.damage);
    actor.rage = Math.min(100, actor.rage + 10);
    result.hits.push(hit);
  } else if (action === 'skill') {
    if (!skillSlug) return { result: {}, error: 'skillSlug required' };
    const { data: skill } = await admin.from('skills').select('*').eq('slug', skillSlug).maybeSingle();
    if (!skill) return { result: {}, error: 'skill not found' };
    const def = skill as SkillDef;
    const lvl = (actor.snapshot.skill_levels as any)?.[skillSlug] ?? 0;
    if (lvl < 1 && !isBot) return { result: {}, error: 'skill not learned' };
    if (actor.snapshot.level < def.unlock_level && !isBot) return { result: {}, error: 'level too low' };
    if ((actor.cooldowns[skillSlug] ?? 0) > 0) return { result: {}, error: 'on cooldown' };
    if (actor.energy < def.energy_cost) return { result: {}, error: 'not enough energy' };
    actor.energy -= def.energy_cost;
    actor.cooldowns[skillSlug] = def.cooldown;
    for (let i = 0; i < def.hits; i++) {
      if (target.hp <= 0) break;
      const hit = resolveHit({ attacker: actor, defender: target, skill: def, defending: false, rng });
      target.hp = Math.max(0, target.hp - hit.damage);
      result.hits.push(hit);
    }
    if (def.effect && def.effect !== 'none') {
      const isSelf = ['heal','energy_recovery','buff_attack','crit_buff','defense_buff','damage_absorb','dodge','stat_buff_all'].includes(def.effect);
      applyEffect(isSelf ? actor : target, def.effect as any, Number(def.effect_value), 2);
      result.effect = def.effect;
    }
    actor.rage = Math.min(100, actor.rage + 15);
  } else {
    return { result: {}, error: 'invalid action' };
  }
  const tickRes = tickStatusEffects(target);
  if (tickRes.dotDamage > 0) result.dot = tickRes.dotDamage;
  tickCooldowns(actor);
  return { result };
}

// Simple bot AI: heal if HP < 30%, stun/disable if available, else highest-damage usable skill, else basic attack.
function botChooseAction(bot: ParticipantState): { action: string; skillSlug?: string } {
  const hpPct = bot.hp / bot.max_hp;
  const slugs = Object.keys(bot.snapshot.skill_levels ?? {});
  const usable = slugs.filter(s => (bot.cooldowns[s] ?? 0) === 0 && bot.energy >= 10);
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

async function persistParticipant(admin: any, battleId: string, p: ParticipantState) {
  await admin.from('battle_participants').update({
    hp: p.hp, energy: p.energy, rage: p.rage,
    status_effects: p.status_effects, cooldowns: p.cooldowns,
  }).eq('battle_id', battleId).eq('slot', p.slot);
}

async function finishBattle(admin: any, battleId: string, winnerUserId: string | null, _won: boolean) {
  await admin.from('battles').update({
    status: 'finished',
    winner_user_id: winnerUserId,
    finished_at: new Date().toISOString(),
  }).eq('id', battleId);
}

async function awardRewards(admin: any, battleId: string): Promise<any> {
  const { data: b } = await admin.from('battles').select('npc_id, winner_user_id').eq('id', battleId).maybeSingle();
  if (!b?.npc_id || !b.winner_user_id) return null;
  const { data: en } = await admin.from('npc_enemies')
    .select('xp_reward, credit_reward, level').eq('npc_id', b.npc_id).maybeSingle();
  const baseXp = en?.xp_reward ?? 50;
  const baseCredits = en?.credit_reward ?? 10;
  const enemyLevel = en?.level ?? 1;

  const { data: parts } = await admin.from('battle_participants')
    .select('character_id').eq('battle_id', battleId).eq('user_id', b.winner_user_id).maybeSingle();

  let updatedCharacter: any = null;
  let level: any = null;
  let xpGained = baseXp;
  let creditsGained = baseCredits;
  if (parts?.character_id) {
    const { data: ch } = await admin.from('characters').select('*').eq('id', parts.character_id).maybeSingle();
    if (ch) {
      // Level-scaled rewards: scale up base by effective enemy level (max of
      // enemy.level, player.level) so low-level starter mobs stay relevant.
      // Apply soft efficiency falloff if player is significantly above enemy.
      const playerLevel = ch.level ?? 1;
      const effectiveLevel = Math.max(enemyLevel, playerLevel);
      const scaledXp = baseXp + effectiveLevel * 10;
      const scaledCredits = baseCredits + effectiveLevel * 4;
      const efficiency = Math.max(0.25, Math.min(1, 1 - (playerLevel - enemyLevel) * 0.05));
      xpGained = Math.max(1, Math.floor(scaledXp * efficiency));
      creditsGained = Math.max(1, Math.floor(scaledCredits * efficiency));

      const lvl = applyXp({
        xp: ch.xp ?? 0, level: ch.level ?? 1,
        statPoints: ch.stat_points ?? 0, skillPoints: ch.skill_points ?? 0,
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
        oldLevel: lvl.oldLevel, newLevel: lvl.newLevel, levelsGained: lvl.levelsGained,
        statPointsGained: lvl.statPointsGained, skillPointsGained: lvl.skillPointsGained,
        maxHpGained: lvl.maxHpGained,
      };
    }
  }

  // Quest progress: increment "defeat.<npc_id>" counter on any in-progress quests
  const { data: pqs } = await admin.from('player_quests')
    .select('*').eq('user_id', b.winner_user_id).eq('completed', false);
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
        progress: prog, completed, updated_at: new Date().toISOString(),
      }).eq('id', pq.id);
    }
  }
  return { xpGained, creditsGained, updatedCharacter, level };
}

async function buildPlayerSnapshot(admin: any, characterId: string, userId: string): Promise<CharacterSnapshot | null> {
  const { data: char } = await admin.from('characters').select('*').eq('id', characterId).eq('user_id', userId).maybeSingle();
  if (!char) return null;
  const { data: inv } = await admin.from('inventory').select('item_id, items(*)').eq('character_id', characterId).eq('equipped', true);
  let weaponMin = 80, weaponMax = 100, defenseGear = 0, resistanceGear = 0;
  let strBonus = 0, dexBonus = 0, techBonus = 0, supBonus = 0;
  for (const row of inv ?? []) {
    const it = (row as any).items;
    if (!it) continue;
    if (it.slot === 'weapon' && it.min_damage && it.max_damage) { weaponMin = it.min_damage; weaponMax = it.max_damage; }
    defenseGear += it.defense ?? 0;
    const m = it.stat_modifiers ?? {};
    strBonus += m.strength ?? 0; dexBonus += m.dexterity ?? 0;
    techBonus += m.technology ?? 0; supBonus += m.support ?? 0;
    resistanceGear += m.resistance ?? 0;
    defenseGear += m.defense ?? 0;
  }
  return {
    user_id: userId, character_id: characterId,
    name: char.name, class: char.class, level: char.level,
    strength: (char.strength ?? 10) + strBonus,
    dexterity: (char.dexterity ?? 10) + dexBonus,
    technology: (char.technology ?? 10) + techBonus,
    support: (char.support ?? 10) + supBonus,
    weapon_min: weaponMin, weapon_max: weaponMax,
    defense: (char.defense ?? 5) + defenseGear,
    resistance: (char.resistance ?? 5) + resistanceGear,
    skill_levels: char.skill_levels ?? {},
  };
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
