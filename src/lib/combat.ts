import { Character, Ability, HitResult, StatusEffect } from '@/types/game';

// ============================================================
// EpicDuel-style stat multipliers
// ============================================================

// TECH damage multiplier: 1 + TECH × 0.015
export function techDamageMultiplier(tech: number): number {
  return 1 + tech * 0.015;
}

// TECH defense: damage reduction %, capped at 50%
export function techDefenseReduction(tech: number): number {
  return Math.min(0.50, tech * 0.0025);
}

// DEX skill damage multiplier: 1 + DEX × 0.012
export function dexSkillMultiplier(dex: number): number {
  return 1 + dex * 0.012;
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

// SUP buff strength multiplier
export function buffStrengthMultiplier(sup: number): number {
  return 1 + sup * 0.015;
}

// Base crit chance: flat 8% + minor SUP scaling
export function calcCritChance(attacker: Character): number {
  return Math.min(0.30, 0.08 + attacker.stats.support * 0.002);
}

// First strike
export function calcFirstStrike(a: Character, b: Character): 'player' | 'enemy' {
  const supportDiff = a.stats.support - b.stats.support;
  const levelDiff = a.level - b.level;
  const chance = 0.5 + 0.03 * supportDiff - 0.05 * levelDiff;
  return Math.random() < chance ? 'player' : 'enemy';
}

// ============================================================
// Damage resolution (EpicDuel final formula)
// ============================================================

export function resolveAttack(
  attacker: Character,
  defender: Character,
  ability: Ability
): HitResult {
  const statValue = attacker.stats[ability.scaleStat];

  // Step 1: raw damage = baseDamage × statMultiplier
  let statMultiplier: number;
  if (ability.type === 'magical' || ability.scaleStat === 'technology') {
    statMultiplier = techDamageMultiplier(statValue);
  } else {
    statMultiplier = dexSkillMultiplier(statValue);
  }

  let rawDamage = Math.floor(ability.baseDamage * statMultiplier) + Math.floor(Math.random() * 4);

  // Attack buff from status effects
  const atkBuff = attacker.statusEffects
    .filter(e => e.type === 'buff_attack')
    .reduce((sum, e) => sum + e.value, 0);
  rawDamage += atkBuff;

  // Step 2: subtract flat defense (DEX)
  rawDamage -= Math.floor(dexFlatDefense(defender.stats.dexterity));

  // Step 3: tech defense reduction for tech/magical abilities
  if (ability.type === 'magical' || ability.scaleStat === 'technology') {
    rawDamage = Math.floor(rawDamage * (1 - techDefenseReduction(defender.stats.technology)));
  }

  let damage = rawDamage;
  let blocked = false;
  let deflected = false;
  let critical = false;

  // Step 4: crit check
  if (Math.random() < calcCritChance(attacker)) {
    critical = true;
    damage = Math.floor(damage * critDamageMultiplier(attacker.stats.support));
  }

  // Step 5: block (physical/basic only)
  if (ability.type === 'physical' && Math.random() < calcBlockChance(defender)) {
    blocked = true;
    damage = Math.floor(damage * 0.5);
  }

  // Deflect for magical/special (tech defense already applied, small extra chance)
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

  // Floor at 1
  damage = Math.max(1, damage);

  return { damage, blocked, deflected, critical, rawDamage: Math.max(1, rawDamage) };
}

// --- Rage ---

export function calcRageGain(damage: number): number {
  return Math.floor(damage * 0.3);
}

export const RAGE_THRESHOLD = 100;

// --- Status effects ---

export function applyAbilityEffect(ability: Ability, target: Character): StatusEffect | null {
  if (!ability.effect) return null;
  switch (ability.effect) {
    case 'stun':
      return { type: 'stun', turnsRemaining: 1, value: 0 };
    case 'dot':
      return { type: 'dot', turnsRemaining: 3, value: Math.floor(ability.baseDamage * 0.3) };
    case 'energy_drain':
      return null; // handled inline
    case 'buff_attack':
      return { type: 'buff_attack', turnsRemaining: 2, value: Math.floor(ability.baseDamage * 0.5) };
    case 'debuff_defense':
      return { type: 'debuff_defense', turnsRemaining: 2, value: Math.floor(ability.baseDamage * 0.4) };
  }
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

// --- Energy drain ---

export function applyEnergyDrain(ability: Ability, target: Character): number {
  if (ability.effect !== 'energy_drain') return 0;
  return Math.floor(ability.baseDamage * 0.5);
}
