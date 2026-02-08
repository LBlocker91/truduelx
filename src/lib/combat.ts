import { Character, Ability, HitResult, StatusEffect } from '@/types/game';

// ============================================================
// EpicDuel-style stat multipliers
// ============================================================

// Unified skill power scaling: Base × (1 + Stat × 0.015) × (1 + Level × 0.01)
export function skillPowerMultiplier(statValue: number, level: number): number {
  return (1 + statValue * 0.015) * (1 + level * 0.01);
}

// TECH defense: damage reduction %, capped at 50%
export function techDefenseReduction(tech: number): number {
  return Math.min(0.50, tech * 0.0025);
}

// DEX flat defense
export function dexFlatDefense(dex: number): number {
  return dex * 0.3;
}

// DEX block chance (basic attacks only), capped at 40%
export function calcBlockChance(defender: Character): number {
  return Math.min(0.40, defender.stats.dexterity * 0.0015);
}

// SUP critical damage multiplier: 1.5 + SUP × 0.01
export function critDamageMultiplier(sup: number): number {
  return 1.5 + sup * 0.01;
}

// SUP gun damage multiplier
export function gunDamageMultiplier(sup: number): number {
  return 1 + sup * 0.02;
}

// SUP rocket damage multiplier
export function rocketDamageMultiplier(sup: number): number {
  return 1 + sup * 0.025;
}

// SUP buff strength multiplier
export function buffStrengthMultiplier(sup: number): number {
  return 1 + sup * 0.015;
}

// Base crit chance: flat 8% + minor SUP scaling
export function calcCritChance(attacker: Character): number {
  let chance = Math.min(0.30, 0.08 + attacker.stats.support * 0.002);
  // Crit buff increases chance
  const critBuff = attacker.statusEffects.filter(e => e.type === 'crit_buff').reduce((s, e) => s + e.value, 0);
  chance += critBuff * 0.01;
  return Math.min(0.50, chance);
}

// First strike
export function calcFirstStrike(a: Character, b: Character): 'player' | 'enemy' {
  const supportDiff = a.stats.support - b.stats.support;
  const levelDiff = a.level - b.level;
  const chance = 0.5 + 0.03 * supportDiff - 0.05 * levelDiff;
  return Math.random() < chance ? 'player' : 'enemy';
}

// ============================================================
// Damage resolution (EpicDuel final formula + skill scaling)
// ============================================================

export function resolveAttack(
  attacker: Character,
  defender: Character,
  ability: Ability
): HitResult {
  const statValue = attacker.stats[ability.scaleStat];

  // Step 1: Skill Power = baseDamage × (1 + RelevantStat × 0.015) × (1 + Level × 0.01)
  const multiplier = skillPowerMultiplier(statValue, attacker.level);

  // Apply gun/rocket scaling for support-based physical abilities
  let extraMultiplier = 1;
  if (ability.scaleStat === 'support' && ability.type === 'physical') {
    extraMultiplier = gunDamageMultiplier(attacker.stats.support);
  }

  let rawDamage = Math.floor(ability.baseDamage * multiplier * extraMultiplier) + Math.floor(Math.random() * 4);

  // Bonus low HP damage (Execution Protocol)
  if (ability.effect === 'bonus_low_hp' && defender.stats.health / defender.stats.maxHealth < 0.3) {
    rawDamage = Math.floor(rawDamage * 1.5);
  }

  // Attack buff from status effects
  const atkBuff = attacker.statusEffects
    .filter(e => e.type === 'buff_attack')
    .reduce((sum, e) => sum + e.value, 0);
  rawDamage += atkBuff;

  // Stat buff all bonus
  const statBuff = attacker.statusEffects
    .filter(e => e.type === 'stat_buff_all')
    .reduce((sum, e) => sum + e.value, 0);
  if (statBuff > 0) rawDamage = Math.floor(rawDamage * (1 + statBuff * 0.01));

  // Step 2: subtract flat defense (DEX)
  rawDamage -= Math.floor(dexFlatDefense(defender.stats.dexterity));

  // Defense buff on defender reduces damage
  const defBuff = defender.statusEffects
    .filter(e => e.type === 'defense_buff')
    .reduce((sum, e) => sum + e.value, 0);
  if (defBuff > 0) rawDamage = Math.floor(rawDamage * Math.max(0.3, 1 - defBuff * 0.01));

  // Damage taken increase debuff on defender
  const dmgIncrease = defender.statusEffects
    .filter(e => e.type === 'damage_taken_increase')
    .reduce((sum, e) => sum + e.value, 0);
  if (dmgIncrease > 0) rawDamage = Math.floor(rawDamage * (1 + dmgIncrease * 0.01));

  // Step 3: tech defense reduction for tech/magical abilities
  if (ability.type === 'magical' || ability.scaleStat === 'technology') {
    rawDamage = Math.floor(rawDamage * (1 - techDefenseReduction(defender.stats.technology)));
  }

  // Damage absorb shield
  const absorb = defender.statusEffects
    .filter(e => e.type === 'damage_absorb')
    .reduce((sum, e) => sum + e.value, 0);
  if (absorb > 0) rawDamage = Math.max(0, rawDamage - absorb);

  let damage = rawDamage;
  let blocked = false;
  let deflected = false;
  let critical = false;

  // Dodge check
  const dodgeBuff = defender.statusEffects.filter(e => e.type === 'dodge').reduce((s, e) => s + e.value, 0);
  if (dodgeBuff > 0 && Math.random() < dodgeBuff * 0.01) {
    return { damage: 0, blocked: false, deflected: true, critical: false, rawDamage: 0 };
  }

  // Step 4: crit check (rage skills cannot crit)
  const isRageSkill = ability.id === 'rage-attack' || ability.id === 'enemy-rage';
  if (!isRageSkill && Math.random() < calcCritChance(attacker)) {
    critical = true;
    damage = Math.floor(damage * critDamageMultiplier(attacker.stats.support));
  }

  // Step 5: block (physical/basic only)
  if (ability.type === 'physical' && Math.random() < calcBlockChance(defender)) {
    blocked = true;
    damage = Math.floor(damage * 0.5);
  }

  // Deflect for magical/special
  if ((ability.type === 'magical' || ability.type === 'special') && Math.random() < techDefenseReduction(defender.stats.technology) * 0.5) {
    deflected = true;
    damage = Math.floor(damage * 0.5);
  }

  // Defending reduces damage by 50%
  if (defender.isDefending) {
    damage = Math.floor(damage * 0.5);
  }

  // Defense debuff on defender
  const defDebuff = defender.statusEffects
    .filter(e => e.type === 'debuff_defense')
    .reduce((sum, e) => sum + e.value, 0);
  damage += defDebuff;

  // Reflect damage back
  const reflectBuff = defender.statusEffects.filter(e => e.type === 'reflect').reduce((s, e) => s + e.value, 0);
  // Reflect is handled in BattleArena (apply damage back to attacker)

  // Floor at 1 (unless dodged)
  damage = Math.max(1, damage);

  return { damage, blocked, deflected, critical, rawDamage: Math.max(1, rawDamage) };
}

// --- Rage ---

export const RAGE_THRESHOLD = 100;
export const MAX_RAGE = 100;
export const RAGE_PER_TURN = 3;
const MIN_RAGE_PER_HIT = 2;
const MAX_RAGE_PER_HIT = 18;

/** Rage gained from DEALING damage: (dmg / defenderMaxHP) × 35, clamped [2, 18] */
export function rageFromDealing(damage: number, defenderMaxHP: number): number {
  if (damage <= 0 || defenderMaxHP <= 0) return 0;
  return Math.min(MAX_RAGE_PER_HIT, Math.max(MIN_RAGE_PER_HIT, (damage / defenderMaxHP) * 35));
}

/** Rage gained from TAKING damage: (dmg / yourMaxHP) × 45, clamped [2, 18] */
export function rageFromTaking(damage: number, yourMaxHP: number): number {
  if (damage <= 0 || yourMaxHP <= 0) return 0;
  return Math.min(MAX_RAGE_PER_HIT, Math.max(MIN_RAGE_PER_HIT, (damage / yourMaxHP) * 45));
}

/** SUP rage gain multiplier: 1 + min(SUP × 0.003, 0.3) */
export function rageSupMultiplier(sup: number): number {
  return 1 + Math.min(sup * 0.003, 0.3);
}

/** Compute both attacker and defender rage gains from a hit. Blocked hits × 0.6. Fully negated = 0. */
export function calcRageGains(
  damage: number,
  attackerMaxHP: number,
  defenderMaxHP: number,
  attackerSup: number,
  defenderSup: number,
  blocked: boolean
): { attackerRage: number; defenderRage: number } {
  if (damage <= 0) return { attackerRage: 0, defenderRage: 0 };

  let attackerRage = rageFromDealing(damage, defenderMaxHP) * rageSupMultiplier(attackerSup);
  let defenderRage = rageFromTaking(damage, defenderMaxHP) * rageSupMultiplier(defenderSup);

  if (blocked) {
    attackerRage *= 0.6;
    defenderRage *= 0.6;
  }

  return {
    attackerRage: Math.floor(attackerRage),
    defenderRage: Math.floor(defenderRage),
  };
}

/** Rage skill damage cap: cannot exceed 35% of defender max HP, cannot kill from >40% HP */
export function applyRageDamageCap(damage: number, defenderHP: number, defenderMaxHP: number): number {
  const cap = Math.floor(defenderMaxHP * 0.35);
  let capped = Math.min(damage, cap);
  // Cannot kill from above 40% HP
  if (defenderHP / defenderMaxHP > 0.4) {
    capped = Math.min(capped, defenderHP - 1);
  }
  return Math.max(1, capped);
}

// Legacy compat
export function calcRageGain(damage: number): number {
  return Math.floor(damage * 0.3);
}

// --- Status effects ---

export function applyAbilityEffect(ability: Ability, target: Character, attacker: Character): StatusEffect | null {
  if (!ability.effect) return null;
  const sup = attacker.stats.support;
  const buffMult = buffStrengthMultiplier(sup);

  switch (ability.effect) {
    case 'stun':
      return { type: 'stun', turnsRemaining: 1, value: 0 };
    case 'dot':
      return { type: 'dot', turnsRemaining: 3, value: Math.floor(ability.baseDamage * 0.3) };
    case 'energy_drain':
      return null; // handled inline
    case 'buff_attack':
      return { type: 'buff_attack', turnsRemaining: 2, value: Math.floor(ability.baseDamage * 0.5 * buffMult) };
    case 'debuff_defense':
      return { type: 'debuff_defense', turnsRemaining: 2, value: Math.floor(ability.baseDamage * 0.4) };
    case 'defense_buff':
      return { type: 'defense_buff', turnsRemaining: 2, value: Math.floor(20 * buffMult) };
    case 'crit_buff':
      return { type: 'crit_buff', turnsRemaining: 3, value: Math.floor(15 * buffMult) };
    case 'damage_absorb':
      return { type: 'damage_absorb', turnsRemaining: 2, value: Math.floor(25 * buffMult) };
    case 'damage_taken_increase':
      return { type: 'damage_taken_increase', turnsRemaining: 2, value: Math.floor(20 * buffMult) };
    case 'reflect':
      return { type: 'reflect', turnsRemaining: 2, value: Math.floor(15 * buffMult) };
    case 'stat_buff_all':
      return { type: 'stat_buff_all', turnsRemaining: 2, value: Math.floor(10 * buffMult) };
    case 'skill_disable':
      return { type: 'skill_disable', turnsRemaining: 1, value: 0 };
    case 'dodge':
      return { type: 'dodge', turnsRemaining: 2, value: Math.floor(30 * buffMult) };
    case 'heal':
    case 'energy_recovery':
    case 'bonus_low_hp':
    case 'cooldown_increase':
      return null; // handled inline
  }
}

// Apply heal/energy_recovery/cooldown_increase effects inline
export function applyInlineEffect(
  ability: Ability,
  attacker: Character,
  defender: Character
): { attackerUpdate?: Partial<Character['stats']>; defenderUpdate?: Partial<Character['stats']>; log?: string } {
  const result: ReturnType<typeof applyInlineEffect> = {};
  if (!ability.effect) return result;

  const sup = attacker.stats.support;
  const buffMult = buffStrengthMultiplier(sup);

  switch (ability.effect) {
    case 'heal': {
      const healAmount = Math.floor((20 + attacker.stats.technology * 2) * buffMult);
      const newHp = Math.min(attacker.stats.maxHealth, attacker.stats.health + healAmount);
      result.attackerUpdate = { health: newHp };
      result.log = `💚 Healed for ${healAmount} HP!`;
      break;
    }
    case 'energy_recovery': {
      const amount = Math.floor(30 * buffMult);
      const newEnergy = Math.min(attacker.stats.maxEnergy, attacker.stats.energy + amount);
      result.attackerUpdate = { energy: newEnergy };
      result.log = `⚡ Recovered ${amount} energy!`;
      break;
    }
    case 'energy_drain': {
      const drain = Math.floor(ability.baseDamage * 0.5);
      result.defenderUpdate = { energy: Math.max(0, defender.stats.energy - drain) };
      result.log = `⚡ Drained ${drain} energy!`;
      break;
    }
    case 'cooldown_increase': {
      result.log = `⏱️ Enemy cooldowns increased!`;
      break;
    }
  }
  return result;
}

export function tickStatusEffects(character: Character): { char: Character; dotDamage: number } {
  let dotDamage = 0;
  const remaining: StatusEffect[] = [];

  for (const effect of character.statusEffects) {
    if (effect.type === 'dot') {
      dotDamage += effect.value;
    }
    const updated = { ...effect, turnsRemaining: effect.turnsRemaining - 1 };
    if (updated.turnsRemaining > 0) {
      remaining.push(updated);
    }
  }

  return {
    char: {
      ...character,
      stats: {
        ...character.stats,
        health: Math.max(0, character.stats.health - dotDamage),
      },
      statusEffects: remaining,
    },
    dotDamage,
  };
}

export function isStunned(character: Character): boolean {
  return character.statusEffects.some(e => e.type === 'stun');
}

export function isSkillDisabled(character: Character): boolean {
  return character.statusEffects.some(e => e.type === 'skill_disable');
}

// --- Energy drain (legacy, kept for compat) ---

export function applyEnergyDrain(ability: Ability, target: Character): number {
  if (ability.effect !== 'energy_drain') return 0;
  return Math.floor(ability.baseDamage * 0.5);
}
