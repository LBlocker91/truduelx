import { Character } from '@/types/game';

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}

export function calcBattleXp(enemyLevel: number, won: boolean): number {
  const base = won ? 80 : 20;
  return base + enemyLevel * 15 + Math.floor(Math.random() * 30);
}

export function applyXp(character: Character, xpGained: number): Character {
  let { xp, xpToNext, level, statPoints } = character;
  xp += xpGained;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    statPoints += 3;
    xpToNext = xpForLevel(level);
  }

  return {
    ...character,
    xp,
    xpToNext,
    level,
    statPoints,
  };
}

export type StatKey = 'strength' | 'dexterity' | 'technology' | 'support';

export const STAT_LABELS: Record<StatKey, { label: string; description: string; icon: string }> = {
  strength: { label: 'Strength', description: '+1.5 damage per point', icon: '⚔️' },
  dexterity: { label: 'Dexterity', description: '+2% block chance', icon: '🛡️' },
  technology: { label: 'Technology', description: '+2% deflection', icon: '🔧' },
  support: { label: 'Support', description: '+1.5% crit chance', icon: '✨' },
};

export function allocateStat(character: Character, stat: StatKey): Character {
  if (character.statPoints <= 0) return character;

  const newStats = { ...character.stats, [stat]: character.stats[stat] + 1 };

  // Health/energy bonuses for certain stats
  if (stat === 'strength') {
    newStats.maxHealth += 5;
    newStats.health += 5;
  }
  if (stat === 'technology') {
    newStats.maxEnergy += 3;
    newStats.energy += 3;
  }

  return {
    ...character,
    stats: newStats,
    statPoints: character.statPoints - 1,
  };
}
