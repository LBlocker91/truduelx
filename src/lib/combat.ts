import { Character, Ability, HitResult, StatusEffect } from '@/types/game';

// --- Hit resolution ---

export function calcBlockChance(defender: Character): number {
  // Dexterity-based block: ~5% base + 2% per dex point, capped at 40%
  return Math.min(0.40, 0.05 + defender.stats.dexterity * 0.02);
}

export function calcDeflectChance(defender: Character): number {
  // Technology-based deflection for magical/special attacks
  return Math.min(0.35, 0.03 + defender.stats.technology * 0.02);
}

export function calcCritChance(attacker: Character): number {
  // Support-based crit chance: ~5% base + 1.5% per support
  return Math.min(0.30, 0.05 + attacker.stats.support * 0.015);
}

export function calcFirstStrike(a: Character, b: Character): 'player' | 'enemy' {
  const supportDiff = a.stats.support - b.stats.support;
  const levelDiff = a.level - b.level;
  const chance = 0.5 + 0.03 * supportDiff - 0.05 * levelDiff;
  return Math.random() < chance ? 'player' : 'enemy';
}

export function resolveAttack(
  attacker: Character,
  defender: Character,
  ability: Ability
): HitResult {
  // Base damage = ability base + stat scaling
  const statValue = attacker.stats[ability.scaleStat];
  const rawDamage = ability.baseDamage + Math.floor(statValue * 1.5) + Math.floor(Math.random() * 6);

  let damage = rawDamage;
  let blocked = false;
  let deflected = false;
  let critical = false;

  // Attack buff from status effects
  const atkBuff = attacker.statusEffects
    .filter(e => e.type === 'buff_attack')
    .reduce((sum, e) => sum + e.value, 0);
  damage += atkBuff;

  // Defense debuff on defender
  const defDebuff = defender.statusEffects
    .filter(e => e.type === 'debuff_defense')
    .reduce((sum, e) => sum + e.value, 0);

  // Critical check
  if (Math.random() < calcCritChance(attacker)) {
    critical = true;
    damage = Math.floor(damage * 1.5);
  }

  // Block check (physical)
  if (ability.type === 'physical' && Math.random() < calcBlockChance(defender)) {
    blocked = true;
    damage = Math.floor(damage * 0.3);
  }

  // Deflect check (magical/special)
  if ((ability.type === 'magical' || ability.type === 'special') && Math.random() < calcDeflectChance(defender)) {
    deflected = true;
    damage = Math.floor(damage * 0.4);
  }

  // Defending reduces damage by 50%
  if (defender.isDefending) {
    damage = Math.floor(damage * 0.5);
  }

  // Apply defense debuff (increases damage taken)
  damage += defDebuff;

  // Floor at 1
  damage = Math.max(1, damage);

  return { damage, blocked, deflected, critical, rawDamage };
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
  const drain = Math.floor(ability.baseDamage * 0.5);
  return drain;
}
