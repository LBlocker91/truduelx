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
  resistance: number;
  /** physical | energy | hybrid — basic-attack damage type, comes from equipped weapon */
  weapon_damage_type?: 'physical' | 'energy' | 'hybrid';
  /** blade | pistol | rifle | rocket_launcher | tech_staff | heavy | drone | unarmed */
  weapon_subtype?: string;
  /** Strongest scaling stat for the equipped weapon's basic attack */
  weapon_scale_stat?: ScaleStat;
  skill_levels: Record<string, number>;
  equipped?: { weapon_variant: string | null; armor_variant: string | null };
  /** Cosmetic/passive equipped extras for VFX */
  equipped_extras?: { wings_variant?: string | null; pet_variant?: string | null };
  max_hp?: number;
  zone_id?: string;
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
  // Tougher base HP so equal-level fights last multiple turns.
  return Math.floor(180 + strength * 10 + level * 22);
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
  isUltimate?: boolean;
}

/** A skill is treated as an ultimate when its cooldown is high. */
export function isUltimateSkill(skill: SkillDef | null | undefined): boolean {
  if (!skill) return false;
  return (skill.cooldown ?? 0) >= 6;
}

export const ULTIMATE_CHARGE_REQUIRED = 3;

export interface HitResult {
  damage: number;
  crit: boolean;
  blocked: boolean;
  dodged: boolean;
  raw: number;
  /** Diagnostic / log fields */
  damage_type: 'physical' | 'energy' | 'hybrid';
  scale_stat: ScaleStat;
  weapon_roll: number;
  stat_power: number;
  rank_mult: number;
  mit_pct: number;
  weapon_subtype?: string;
}

/** Resolve which stat a skill (or basic attack) scales with for the current attacker. */
function pickScaleStat(skill: SkillDef | null, snap: CharacterSnapshot): ScaleStat {
  if (skill) return skill.scale_stat;
  return snap.weapon_scale_stat ?? 'strength';
}

/** Resolve damage type for a skill / basic attack. */
function pickDamageType(skill: SkillDef | null, snap: CharacterSnapshot): 'physical' | 'energy' | 'hybrid' {
  if (skill) {
    if (skill.type === 'magical') return 'energy';
    if (skill.type === 'special') return 'hybrid';
    return 'physical';
  }
  return snap.weapon_damage_type ?? 'physical';
}

/** Per-stat scaling multiplier (added to stat power), depending on damage type. */
function statScaleMultFor(dmgType: 'physical' | 'energy' | 'hybrid'): number {
  if (dmgType === 'physical') return 1.6;
  if (dmgType === 'energy')   return 1.4;
  return 1.2; // hybrid
}

export function resolveHit({ attacker, defender, skill, defending, rng, isUltimate }: DamageOpts): HitResult {
  const ult = !!isUltimate || isUltimateSkill(skill);
  const aSnap = attacker.snapshot;
  const dSnap = defender.snapshot;

  const dmgType = pickDamageType(skill, aSnap);
  const scaleStat = pickScaleStat(skill, aSnap);

  // Dodge check
  const dodgeBuff = defender.status_effects.find(e => e.type === 'dodge');
  if (dodgeBuff && rng() < dodgeBuff.value / 100) {
    return {
      damage: 0, crit: false, blocked: false, dodged: true, raw: 0,
      damage_type: dmgType, scale_stat: scaleStat,
      weapon_roll: 0, stat_power: 0, rank_mult: 1, mit_pct: 0,
      weapon_subtype: aSnap.weapon_subtype,
    };
  }

  // ---- Per-hit weapon roll (the source of variance) ----
  const wMin = Math.max(1, aSnap.weapon_min ?? 1);
  const wMax = Math.max(wMin, aSnap.weapon_max ?? wMin);
  const weaponRoll = Math.floor(wMin + rng() * (wMax - wMin + 1));

  // ---- Stat scaling ----
  const rawStatVal = (aSnap[scaleStat] as number) ?? 0;
  const statVal = scaleStat === 'strength' ? effectiveStr(rawStatVal) : rawStatVal;
  const statMult = statScaleMultFor(dmgType);
  const statPower = statVal * statMult;

  // ---- Skill rank multiplier ----
  let rank = 1;
  if (skill) rank = Math.max(1, (aSnap.skill_levels?.[skill.slug] ?? 1));
  const rankMult = 1 + (rank - 1) * 0.06;

  // ---- Level power ----
  const levelPower = aSnap.level * 1.5;

  // ---- Raw before mods ----
  const skillBase = skill ? skill.base_damage : 0;
  let raw = (weaponRoll + skillBase + statPower + levelPower) * rankMult;
  const rawBeforeMods = raw;

  // Attack buffs / damage-taken debuffs
  const atkBuff = attacker.status_effects.find(e => e.type === 'buff_attack');
  if (atkBuff) raw *= 1 + atkBuff.value / 100;
  const dmgTaken = defender.status_effects.find(e => e.type === 'damage_taken_increase');
  if (dmgTaken) raw *= 1 + dmgTaken.value / 100;

  // Crit
  const critBuff = attacker.status_effects.find(e => e.type === 'crit_buff');
  const critChance = 0.05 + (aSnap.dexterity * 0.0005) + (critBuff ? critBuff.value / 100 : 0);
  const crit = rng() < critChance;
  if (crit) raw *= 1.5;

  // ---- Mitigation by damage type ----
  let mitStat: number;
  if (dmgType === 'physical') {
    mitStat = (dSnap.defense ?? 0) + dSnap.strength * 0.4;
  } else if (dmgType === 'energy') {
    mitStat = (dSnap.resistance ?? 0) + dSnap.technology * 0.4;
  } else {
    mitStat = ((dSnap.defense ?? 0) + (dSnap.resistance ?? 0)) / 2 + dSnap.dexterity * 0.25;
  }

  const defBuff = defender.status_effects.find(e => e.type === 'defense_buff');
  if (defBuff) mitStat *= 1 + defBuff.value / 100;
  const defDebuff = defender.status_effects.find(e => e.type === 'debuff_defense');
  if (defDebuff) mitStat *= 1 - defDebuff.value / 100;

  const mitPct = Math.max(0, Math.min(0.85, mitStat / (mitStat + 100)));
  raw = raw * (1 - mitPct);

  // Block
  const blockChance = 0.05 + dSnap.dexterity * 0.003;
  const blocked = !crit && rng() < blockChance;
  if (blocked) raw *= 0.5;
  if (defending) raw *= 0.5;

  // Variance ±8% — keeps numbers moving even with identical inputs
  const variance = 0.92 + rng() * 0.16;
  raw *= variance;

  // Floor: at least max(3, 15% of raw-before-mitigation)
  const floor = Math.max(3, Math.floor(rawBeforeMods * 0.15));
  if (raw < floor) raw = floor;

  // Damage absorb shield
  const absorb = defender.status_effects.find(e => e.type === 'damage_absorb');
  if (absorb) {
    const absorbed = Math.min(raw, absorb.value);
    raw -= absorbed;
    absorb.value -= absorbed;
  }

  const damage = Math.max(1, Math.floor(raw));

  return {
    damage,
    crit,
    blocked,
    dodged: false,
    raw: Math.floor(raw),
    damage_type: dmgType,
    scale_stat: scaleStat,
    weapon_roll: weaponRoll,
    stat_power: Math.floor(statPower),
    rank_mult: rankMult,
    mit_pct: mitPct,
    weapon_subtype: aSnap.weapon_subtype,
  };
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
