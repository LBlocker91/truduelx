import { Character, CharacterClass } from '@/types/game';
import { calcMaxHealth, xpForLevel } from '@/lib/leveling';
import { BASE_STATS, CLASS_ABILITIES, CLASS_IMAGES, ALL_CLASSES } from './class-definitions';

// No abilities are auto-unlocked; players spend skill points to unlock them

// --- Character factory ---

export const createCharacter = (
  classType: CharacterClass,
  name: string,
  id?: string
): Character => {
  const base = BASE_STATS[classType];
  const level = 1;
  const hp = calcMaxHealth(base.strength, level);

  return {
    id: id || `${classType}-${Date.now()}`,
    name,
    class: classType,
    level,
    xp: 0,
    xpToNext: xpForLevel(1),
    statPoints: 0,
    skillPoints: 0,
    unlockedAbilityIds: [],
    stats: {
      health: hp,
      maxHealth: hp,
      energy: base.energy,
      maxEnergy: base.maxEnergy,
      strength: base.strength,
      dexterity: base.dexterity,
      technology: base.technology,
      support: base.support,
    },
    abilities: CLASS_ABILITIES[classType].map(a => ({ ...a })),
    image: CLASS_IMAGES[classType],
    rage: 0,
    maxRage: 100,
    isDefending: false,
    statusEffects: [],
  };
};

// --- Character templates (for CharacterSelect preview) ---

export const characterTemplates: Record<CharacterClass, Omit<Character, 'id' | 'name'>> = (() => {
  const result = {} as Record<CharacterClass, Omit<Character, 'id' | 'name'>>;
  for (const cls of ALL_CLASSES) {
    const base = BASE_STATS[cls];
    const hp = calcMaxHealth(base.strength, 1);
    result[cls] = {
      class: cls,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(1),
      statPoints: 0,
      skillPoints: 0,
      unlockedAbilityIds: [],
      stats: {
        health: hp, maxHealth: hp,
        energy: base.energy, maxEnergy: base.maxEnergy,
        strength: base.strength, dexterity: base.dexterity,
        technology: base.technology, support: base.support,
      },
      abilities: CLASS_ABILITIES[cls],
      image: CLASS_IMAGES[cls],
      rage: 0, maxRage: 100,
      isDefending: false, statusEffects: [],
    };
  }
  return result;
})();

export const createEnemy = (playerLevel: number = 1): Character => {
  const classes = ALL_CLASSES;
  const randomClass = classes[Math.floor(Math.random() * classes.length)];
  const enemyNames = ['Shadow Reaper', 'Void Walker', 'Dark Sentinel', 'Chaos Agent', 'Nebula Hunter',
    'Iron Phantom', 'Crimson Echo', 'Nova Breaker', 'Null Vector', 'Pulse Wraith'];
  const randomName = enemyNames[Math.floor(Math.random() * enemyNames.length)];

  const enemy = createCharacter(randomClass, randomName, 'enemy');

  // Scale enemy to player level
  const enemyLevel = Math.max(1, playerLevel + Math.floor(Math.random() * 3) - 1);
  const levelBonus = Math.max(0, enemyLevel - 1);
  enemy.level = enemyLevel;
  enemy.stats.strength += levelBonus;
  enemy.stats.dexterity += levelBonus;
  enemy.stats.technology += levelBonus;
  enemy.stats.support += levelBonus;

  const hp = calcMaxHealth(enemy.stats.strength, enemyLevel);
  enemy.stats.health = hp;
  enemy.stats.maxHealth = hp;

  enemy.stats.maxEnergy += levelBonus * 2;
  enemy.stats.energy = enemy.stats.maxEnergy;

  enemy.xpToNext = xpForLevel(enemyLevel);

  // Enemies auto-unlock all abilities available at their level
  enemy.unlockedAbilityIds = enemy.abilities
    .filter(a => (a.unlockLevel || 1) <= enemyLevel)
    .map(a => a.id);

  return enemy;
};
