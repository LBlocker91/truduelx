import { Character } from '@/types/game';

// --- Max level ---
export const MAX_LEVEL = 100;

// --- XP required per level: 100 × Level² + 500 × Level ---
export function xpForLevel(level: number): number {
  return 100 * level * level + 500 * level;
}

// --- Stat points per level ---
export function statPointsForLevel(level: number): number {
  if (level <= 50) return 5;
  if (level <= 80) return 4;
  return 3;
}

// --- Health formula: Base 100 + STR×12 + Level×6 ---
export function calcMaxHealth(strength: number, level: number): number {
  return 100 + strength * 12 + level * 6;
}

// --- PvP XP: Base 250 + OpponentLevel×20, scaled by level diff ---
export function calcBattleXp(
  playerLevel: number,
  enemyLevel: number,
  won: boolean
): number {
  const base = 250 + enemyLevel * 20;
  const levelDiff = enemyLevel - playerLevel;
  const diffMultiplier = Math.max(0.5, Math.min(3.5, 1 + levelDiff * 0.08));

  // Soft XP penalty after level 85
  let softPenalty = 1;
  if (playerLevel > 85) {
    softPenalty = Math.max(0.5, 1 - (playerLevel - 85) * 0.015);
  }

  const xp = Math.floor(base * diffMultiplier * softPenalty);
  return won ? xp : Math.floor(xp * 0.25);
}

// --- Apply XP and level up ---
export function applyXp(character: Character, xpGained: number): Character {
  if (character.level >= MAX_LEVEL) return character;

  let { xp, xpToNext, level, statPoints } = character;
  let stats = { ...character.stats };
  xp += xpGained;

  while (xp >= xpToNext && level < MAX_LEVEL) {
    xp -= xpToNext;
    level += 1;
    statPoints += statPointsForLevel(level);
    xpToNext = xpForLevel(level);
  }

  if (level >= MAX_LEVEL) {
    xp = 0;
  }

  // Recalc max health based on current STR and new level
  stats.maxHealth = calcMaxHealth(stats.strength, level);
  stats.health = Math.min(stats.health, stats.maxHealth);

  return { ...character, xp, xpToNext, level, statPoints, stats };
}

// --- Stat allocation ---
export type StatKey = 'strength' | 'dexterity' | 'technology' | 'support';

export const STAT_LABELS: Record<StatKey, { label: string; description: string; icon: string }> = {
  strength: { label: 'Strength', description: '+12 HP per point', icon: '❤️' },
  dexterity: { label: 'Dexterity', description: '+1.2% skill dmg, +0.3 def, +0.15% block', icon: '🗡️' },
  technology: { label: 'Technology', description: '+1.5% tech dmg, +0.25% tech def', icon: '🔧' },
  support: { label: 'Support', description: '+1% crit dmg, +2% gun/pet dmg', icon: '🎯' },
};

export function allocateStat(character: Character, stat: StatKey): Character {
  if (character.statPoints <= 0) return character;

  const newStats = { ...character.stats, [stat]: character.stats[stat] + 1 };

  // Recalc HP when STR changes
  if (stat === 'strength') {
    newStats.maxHealth = calcMaxHealth(newStats.strength, character.level);
    newStats.health += 12; // immediate HP gain
    newStats.health = Math.min(newStats.health, newStats.maxHealth);
  }

  // Tech gives a small energy bonus
  if (stat === 'technology') {
    newStats.maxEnergy += 2;
    newStats.energy += 2;
  }

  return {
    ...character,
    stats: newStats,
    statPoints: character.statPoints - 1,
  };
}
