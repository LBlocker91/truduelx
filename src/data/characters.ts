import { Character, CharacterClass, Ability } from '@/types/game';
import { calcMaxHealth, xpForLevel } from '@/lib/leveling';
import warriorImage from '@/assets/warrior-character.png';
import mageImage from '@/assets/mage-character.png';
import hunterImage from '@/assets/hunter-character.png';

// --- Abilities ---

const warriorAbilities: Ability[] = [
  {
    id: 'sword-slash', name: 'Sword Slash', description: 'A powerful melee attack',
    energyCost: 10, baseDamage: 18, type: 'physical', scaleStat: 'strength',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'shield-bash', name: 'Shield Bash', description: 'Stuns and deals moderate damage',
    energyCost: 20, baseDamage: 14, type: 'physical', scaleStat: 'strength',
    cooldown: 2, currentCooldown: 0, effect: 'stun',
  },
  {
    id: 'battle-cry', name: 'Battle Cry', description: 'Boosts attack power for 2 turns',
    energyCost: 15, baseDamage: 12, type: 'special', scaleStat: 'support',
    cooldown: 3, currentCooldown: 0, effect: 'buff_attack',
  },
  {
    id: 'berserker-rage', name: 'Berserker Rage', description: 'Ultimate attack dealing massive damage',
    energyCost: 40, baseDamage: 40, type: 'physical', scaleStat: 'strength',
    cooldown: 4, currentCooldown: 0,
  },
];

const mageAbilities: Ability[] = [
  {
    id: 'arcane-bolt', name: 'Arcane Bolt', description: 'A basic magic attack',
    energyCost: 12, baseDamage: 20, type: 'magical', scaleStat: 'technology',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'fireball', name: 'Fireball', description: 'Explosive fire damage over time',
    energyCost: 25, baseDamage: 22, type: 'magical', scaleStat: 'technology',
    cooldown: 2, currentCooldown: 0, effect: 'dot',
  },
  {
    id: 'energy-drain', name: 'Energy Drain', description: 'Drains enemy energy',
    energyCost: 18, baseDamage: 12, type: 'special', scaleStat: 'technology',
    cooldown: 3, currentCooldown: 0, effect: 'energy_drain',
  },
  {
    id: 'meteor-strike', name: 'Meteor Strike', description: 'Devastating cosmic attack',
    energyCost: 45, baseDamage: 45, type: 'magical', scaleStat: 'technology',
    cooldown: 4, currentCooldown: 0,
  },
];

const hunterAbilities: Ability[] = [
  {
    id: 'plasma-shot', name: 'Plasma Shot', description: 'Quick ranged attack',
    energyCost: 8, baseDamage: 16, type: 'physical', scaleStat: 'strength',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'emp-grenade', name: 'EMP Grenade', description: 'Weakens enemy defenses',
    energyCost: 22, baseDamage: 15, type: 'special', scaleStat: 'technology',
    cooldown: 2, currentCooldown: 0, effect: 'debuff_defense',
  },
  {
    id: 'stealth-strike', name: 'Stealth Strike', description: 'Critical hit from shadows',
    energyCost: 20, baseDamage: 28, type: 'physical', scaleStat: 'strength',
    cooldown: 3, currentCooldown: 0,
  },
  {
    id: 'orbital-strike', name: 'Orbital Strike', description: 'Call down satellite attack',
    energyCost: 42, baseDamage: 42, type: 'special', scaleStat: 'technology',
    cooldown: 4, currentCooldown: 0,
  },
];

// --- Base stats (level 1 starting stats, before HP formula) ---

interface BaseStats {
  strength: number;
  dexterity: number;
  technology: number;
  support: number;
  energy: number;
  maxEnergy: number;
}

const BASE_STATS: Record<CharacterClass, BaseStats> = {
  warrior:  { strength: 8, dexterity: 6, technology: 3, support: 4, energy: 80, maxEnergy: 80 },
  mage:    { strength: 3, dexterity: 4, technology: 10, support: 5, energy: 120, maxEnergy: 120 },
  hunter:  { strength: 6, dexterity: 5, technology: 5, support: 7, energy: 100, maxEnergy: 100 },
};

const CLASS_ABILITIES: Record<CharacterClass, Ability[]> = {
  warrior: warriorAbilities,
  mage: mageAbilities,
  hunter: hunterAbilities,
};

const CLASS_IMAGES: Record<CharacterClass, string> = {
  warrior: warriorImage,
  mage: mageImage,
  hunter: hunterImage,
};

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
  for (const cls of ['warrior', 'mage', 'hunter'] as CharacterClass[]) {
    const base = BASE_STATS[cls];
    const hp = calcMaxHealth(base.strength, 1);
    result[cls] = {
      class: cls,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(1),
      statPoints: 0,
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
  const classes: CharacterClass[] = ['warrior', 'mage', 'hunter'];
  const randomClass = classes[Math.floor(Math.random() * classes.length)];
  const enemyNames = ['Shadow Reaper', 'Void Walker', 'Dark Sentinel', 'Chaos Agent', 'Nebula Hunter'];
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

  // Recalc HP with new STR and level
  const hp = calcMaxHealth(enemy.stats.strength, enemyLevel);
  enemy.stats.health = hp;
  enemy.stats.maxHealth = hp;

  // Scale energy slightly
  enemy.stats.maxEnergy += levelBonus * 2;
  enemy.stats.energy = enemy.stats.maxEnergy;

  enemy.xpToNext = xpForLevel(enemyLevel);

  return enemy;
};
