// Server-authoritative combat engine — shared by battle-action and pve-bot

export type ScaleStat = 'strength' | 'dexterity' | 'technology' | 'support';
export type SkillEffect =
  | 'none' | 'stun' | 'dot' | 'energy_drain' | 'buff_attack' | 'debuff_defense'
  | 'heal' | 'energy_recovery' | 'defense_buff' | 'crit_buff' | 'damage_absorb'
  | 'damage_taken_increase' | 'reflect' | 'stat_buff_all' | 'skill_disable'
  | 'cooldown_increase' | 'dodge' | 'bonus_low_hp';

export interface SkillDef {
  slug: string;
  name: string;
  type: 'physical' | 'magical' | 'special';
  scale_stat: ScaleStat;
  base_damage: number;
  energy_cost: number;
  cooldown: number;
  hits: number;
  effect: SkillEffect;
  effect_value: number;
  unlock_level: number;
  max_level: number;
}

export interface ParticipantState {
  id: string;
  slot: number;
  hp: number;
  max_hp: number;
  energy: number;
  max_energy: number;
  rage: number;
  status_effects: StatusEffect[];
  cooldowns: Record<string, number>;
  snapshot: CharacterSnapshot;
}

export interface StatusEffect {
  type: SkillEffect;
  turns: number;
  value: number;
}

export interface CharacterSnapshot {
  user_id: string | null;
  character_id: string | null;
  name: string;
  class: string;
  level: number;
  strength: number;
  dexterity: number;
  technology: number;
  support: number;
  weapon_min: number;
  weapon_max: number;
  defense: number;
  skill_levels: Record<string, number>;
}

// Mulberry32 deterministic RNG seeded from battle.seed + turn for reproducibility
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function calcMaxHp(strength: number, level: number) {
  return Math.floor(100 + strength * 8 + level * 12);
}

function effectiveStr(str: number) {
  return str <= 60 ? str : 60 + (str - 60) * 0.5;
}

interface DamageOpts {
  attacker: ParticipantState;
  defender: ParticipantState;
  skill: SkillDef | null; // null = basic attack
  defending: boolean;
  rng: () => number;
}

export interface HitResult {
  damage: number;
  crit: boolean;
  blocked: boolean;
  dodged: boolean;
  raw: number;
}

export function resolveHit({ attacker, defender, skill, defending, rng }: DamageOpts): HitResult {
  const aSnap = attacker.snapshot;
  const dSnap = defender.snapshot;

  // Dodge check
  const dodgeBuff = defender.status_effects.find(e => e.type === 'dodge');
  if (dodgeBuff && rng() < dodgeBuff.value / 100) {
    return { damage: 0, crit: false, blocked: false, dodged: true, raw: 0 };
  }

  // Compute base damage
  let weaponBase = (aSnap.weapon_min + aSnap.weapon_max) / 2;
  let scaleVal: number;
  let raw: number;

  if (!skill) {
    // Basic attack
    scaleVal = effectiveStr(aSnap.strength);
    const strMult = 1 + scaleVal * 0.02;
    const lvlMult = 1 + aSnap.level * 0.01;
    raw = weaponBase * strMult * lvlMult;
  } else {
    const stat = aSnap[skill.scale_stat] as number;
    scaleVal = skill.scale_stat === 'strength' ? effectiveStr(stat) : stat;
    const scaleMult = 1 + scaleVal * 0.018;
    const lvlMult = 1 + aSnap.level * 0.01;
    raw = skill.base_damage * scaleMult * lvlMult;
  }

  // Attack buffs / debuffs
  const atkBuff = attacker.status_effects.find(e => e.type === 'buff_attack');
  if (atkBuff) raw *= 1 + atkBuff.value / 100;
  const dmgTaken = defender.status_effects.find(e => e.type === 'damage_taken_increase');
  if (dmgTaken) raw *= 1 + dmgTaken.value / 100;

  // Crit
  const critBuff = attacker.status_effects.find(e => e.type === 'crit_buff');
  const critChance = 0.05 + (aSnap.dexterity * 0.005) + (critBuff ? critBuff.value / 100 : 0);
  const crit = rng() < critChance;
  if (crit) raw *= 1.6;

  // Defense
  let defense = dSnap.defense + dSnap.strength * 0.5;
  const defBuff = defender.status_effects.find(e => e.type === 'defense_buff');
  if (defBuff) defense *= 1 + defBuff.value / 100;
  const defDebuff = defender.status_effects.find(e => e.type === 'debuff_defense');
  if (defDebuff) defense *= 1 - defDebuff.value / 100;

  raw -= defense;

  // Block
  const blockChance = 0.05 + dSnap.dexterity * 0.003;
  const blocked = !crit && rng() < blockChance;
  if (blocked) raw *= 0.5;
  if (defending) raw *= 0.5;

  // Damage absorb shield
  const absorb = defender.status_effects.find(e => e.type === 'damage_absorb');
  if (absorb) {
    const absorbed = Math.min(raw, absorb.value);
    raw -= absorbed;
    absorb.value -= absorbed;
  }

  const cap = dSnap.max_hp ? dSnap.max_hp * 0.25 : defender.max_hp * 0.25;
  const damage = Math.max(1, Math.min(Math.floor(raw), Math.floor(cap)));

  return { damage, crit, blocked, dodged: false, raw: Math.floor(raw) };
}

export function applyEffect(target: ParticipantState, effect: SkillEffect, value: number, duration = 2) {
  if (effect === 'none') return;
  if (effect === 'heal') {
    const healAmt = Math.floor((target.max_hp * value) / 100);
    target.hp = Math.min(target.max_hp, target.hp + healAmt);
    return;
  }
  if (effect === 'energy_recovery') {
    target.energy = Math.min(target.max_energy, target.energy + value);
    return;
  }
  if (effect === 'energy_drain') {
    target.energy = Math.max(0, target.energy - value);
    return;
  }
  // Stacking: replace existing effect of same type
  target.status_effects = target.status_effects.filter(e => e.type !== effect);
  target.status_effects.push({ type: effect, turns: duration, value });
}

export function tickStatusEffects(p: ParticipantState): { dotDamage: number } {
  let dotDamage = 0;
  for (const e of p.status_effects) {
    if (e.type === 'dot') dotDamage += Math.floor((p.max_hp * e.value) / 100);
    e.turns -= 1;
  }
  if (dotDamage > 0) p.hp = Math.max(0, p.hp - dotDamage);
  p.status_effects = p.status_effects.filter(e => e.turns > 0);
  return { dotDamage };
}

export function tickCooldowns(p: ParticipantState) {
  for (const k of Object.keys(p.cooldowns)) {
    p.cooldowns[k] = Math.max(0, p.cooldowns[k] - 1);
    if (p.cooldowns[k] === 0) delete p.cooldowns[k];
  }
}

export function isStunned(p: ParticipantState) {
  return p.status_effects.some(e => e.type === 'stun');
}
