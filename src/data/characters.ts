import { Character, CharacterClass, Ability } from '@/types/game';
import warriorImage from '@/assets/warrior-character.png';
import mageImage from '@/assets/mage-character.png';
import hunterImage from '@/assets/hunter-character.png';

const warriorAbilities: Ability[] = [
  {
    id: 'sword-slash',
    name: 'Sword Slash',
    description: 'A powerful melee attack',
    energyCost: 10,
    baseDamage: 18,
    type: 'physical',
    scaleStat: 'strength',
    cooldown: 0,
    currentCooldown: 0,
  },
  {
    id: 'shield-bash',
    name: 'Shield Bash',
    description: 'Stuns and deals moderate damage',
    energyCost: 20,
    baseDamage: 14,
    type: 'physical',
    scaleStat: 'strength',
    cooldown: 2,
    currentCooldown: 0,
    effect: 'stun',
  },
  {
    id: 'battle-cry',
    name: 'Battle Cry',
    description: 'Boosts your attack power for 2 turns',
    energyCost: 15,
    baseDamage: 12,
    type: 'special',
    scaleStat: 'support',
    cooldown: 3,
    currentCooldown: 0,
    effect: 'buff_attack',
  },
  {
    id: 'berserker-rage',
    name: 'Berserker Rage',
    description: 'Ultimate attack dealing massive damage',
    energyCost: 40,
    baseDamage: 40,
    type: 'physical',
    scaleStat: 'strength',
    cooldown: 4,
    currentCooldown: 0,
  },
];

const mageAbilities: Ability[] = [
  {
    id: 'arcane-bolt',
    name: 'Arcane Bolt',
    description: 'A basic magic attack',
    energyCost: 12,
    baseDamage: 20,
    type: 'magical',
    scaleStat: 'technology',
    cooldown: 0,
    currentCooldown: 0,
  },
  {
    id: 'fireball',
    name: 'Fireball',
    description: 'Explosive fire damage over time',
    energyCost: 25,
    baseDamage: 22,
    type: 'magical',
    scaleStat: 'technology',
    cooldown: 2,
    currentCooldown: 0,
    effect: 'dot',
  },
  {
    id: 'energy-drain',
    name: 'Energy Drain',
    description: 'Drains enemy energy',
    energyCost: 18,
    baseDamage: 12,
    type: 'special',
    scaleStat: 'technology',
    cooldown: 3,
    currentCooldown: 0,
    effect: 'energy_drain',
  },
  {
    id: 'meteor-strike',
    name: 'Meteor Strike',
    description: 'Devastating cosmic attack',
    energyCost: 45,
    baseDamage: 45,
    type: 'magical',
    scaleStat: 'technology',
    cooldown: 4,
    currentCooldown: 0,
  },
];

const hunterAbilities: Ability[] = [
  {
    id: 'plasma-shot',
    name: 'Plasma Shot',
    description: 'Quick ranged attack',
    energyCost: 8,
    baseDamage: 16,
    type: 'physical',
    scaleStat: 'strength',
    cooldown: 0,
    currentCooldown: 0,
  },
  {
    id: 'emp-grenade',
    name: 'EMP Grenade',
    description: 'Weakens enemy defenses',
    energyCost: 22,
    baseDamage: 15,
    type: 'special',
    scaleStat: 'technology',
    cooldown: 2,
    currentCooldown: 0,
    effect: 'debuff_defense',
  },
  {
    id: 'stealth-strike',
    name: 'Stealth Strike',
    description: 'Critical hit from shadows',
    energyCost: 20,
    baseDamage: 28,
    type: 'physical',
    scaleStat: 'strength',
    cooldown: 3,
    currentCooldown: 0,
  },
  {
    id: 'orbital-strike',
    name: 'Orbital Strike',
    description: 'Call down satellite attack',
    energyCost: 42,
    baseDamage: 42,
    type: 'special',
    scaleStat: 'technology',
    cooldown: 4,
    currentCooldown: 0,
  },
];

export const characterTemplates: Record<CharacterClass, Omit<Character, 'id' | 'name'>> = {
  warrior: {
    class: 'warrior',
    level: 1,
    xp: 0,
    xpToNext: 100,
    statPoints: 0,
    stats: {
      health: 120,
      maxHealth: 120,
      energy: 80,
      maxEnergy: 80,
      strength: 12,
      dexterity: 10,
      technology: 5,
      support: 6,
    },
    abilities: warriorAbilities,
    image: warriorImage,
    rage: 0,
    maxRage: 100,
    isDefending: false,
    statusEffects: [],
  },
  mage: {
    class: 'mage',
    level: 1,
    xp: 0,
    xpToNext: 100,
    statPoints: 0,
    stats: {
      health: 85,
      maxHealth: 85,
      energy: 120,
      maxEnergy: 120,
      strength: 5,
      dexterity: 6,
      technology: 14,
      support: 8,
    },
    abilities: mageAbilities,
    image: mageImage,
    rage: 0,
    maxRage: 100,
    isDefending: false,
    statusEffects: [],
  },
  hunter: {
    class: 'hunter',
    level: 1,
    xp: 0,
    xpToNext: 100,
    statPoints: 0,
    stats: {
      health: 100,
      maxHealth: 100,
      energy: 100,
      maxEnergy: 100,
      strength: 10,
      dexterity: 8,
      technology: 8,
      support: 10,
    },
    abilities: hunterAbilities,
    image: hunterImage,
    rage: 0,
    maxRage: 100,
    isDefending: false,
    statusEffects: [],
  },
};

export const createCharacter = (
  classType: CharacterClass,
  name: string,
  id?: string
): Character => {
  const template = characterTemplates[classType];
  return {
    ...template,
    id: id || `${classType}-${Date.now()}`,
    name,
    abilities: template.abilities.map(a => ({ ...a })),
    stats: { ...template.stats },
    statusEffects: [],
  };
};

export const createEnemy = (playerLevel: number = 1): Character => {
  const classes: CharacterClass[] = ['warrior', 'mage', 'hunter'];
  const randomClass = classes[Math.floor(Math.random() * classes.length)];
  const enemyNames = ['Shadow Reaper', 'Void Walker', 'Dark Sentinel', 'Chaos Agent', 'Nebula Hunter'];
  const randomName = enemyNames[Math.floor(Math.random() * enemyNames.length)];
  
  const enemy = createCharacter(randomClass, randomName, 'enemy');
  
  // Scale enemy to player level
  const levelBonus = Math.max(0, playerLevel - 1);
  enemy.level = Math.max(1, playerLevel + Math.floor(Math.random() * 3) - 1);
  enemy.stats.health = Math.floor(enemy.stats.health * (0.9 + levelBonus * 0.1));
  enemy.stats.maxHealth = enemy.stats.health;
  enemy.stats.strength += levelBonus;
  enemy.stats.dexterity += levelBonus;
  enemy.stats.technology += levelBonus;
  enemy.stats.support += levelBonus;
  
  return enemy;
};
