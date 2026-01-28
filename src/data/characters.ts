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
    damage: 25,
    type: 'physical',
    cooldown: 0,
    currentCooldown: 0,
  },
  {
    id: 'shield-bash',
    name: 'Shield Bash',
    description: 'Stuns and deals moderate damage',
    energyCost: 20,
    damage: 35,
    type: 'physical',
    cooldown: 2,
    currentCooldown: 0,
  },
  {
    id: 'battle-cry',
    name: 'Battle Cry',
    description: 'Boosts attack power temporarily',
    energyCost: 15,
    damage: 15,
    type: 'special',
    cooldown: 3,
    currentCooldown: 0,
  },
  {
    id: 'berserker-rage',
    name: 'Berserker Rage',
    description: 'Ultimate attack dealing massive damage',
    energyCost: 40,
    damage: 60,
    type: 'physical',
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
    damage: 28,
    type: 'magical',
    cooldown: 0,
    currentCooldown: 0,
  },
  {
    id: 'fireball',
    name: 'Fireball',
    description: 'Explosive fire damage',
    energyCost: 25,
    damage: 45,
    type: 'magical',
    cooldown: 2,
    currentCooldown: 0,
  },
  {
    id: 'ice-shield',
    name: 'Ice Shield',
    description: 'Absorbs incoming damage',
    energyCost: 18,
    damage: 10,
    type: 'special',
    cooldown: 3,
    currentCooldown: 0,
  },
  {
    id: 'meteor-strike',
    name: 'Meteor Strike',
    description: 'Devastating cosmic attack',
    energyCost: 45,
    damage: 70,
    type: 'magical',
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
    damage: 22,
    type: 'physical',
    cooldown: 0,
    currentCooldown: 0,
  },
  {
    id: 'emp-grenade',
    name: 'EMP Grenade',
    description: 'Disrupts enemy systems',
    energyCost: 22,
    damage: 38,
    type: 'special',
    cooldown: 2,
    currentCooldown: 0,
  },
  {
    id: 'stealth-strike',
    name: 'Stealth Strike',
    description: 'Critical hit from shadows',
    energyCost: 20,
    damage: 42,
    type: 'physical',
    cooldown: 3,
    currentCooldown: 0,
  },
  {
    id: 'orbital-strike',
    name: 'Orbital Strike',
    description: 'Call down satellite attack',
    energyCost: 42,
    damage: 65,
    type: 'special',
    cooldown: 4,
    currentCooldown: 0,
  },
];

export const characterTemplates: Record<CharacterClass, Omit<Character, 'id' | 'name'>> = {
  warrior: {
    class: 'warrior',
    level: 1,
    stats: {
      health: 120,
      maxHealth: 120,
      energy: 80,
      maxEnergy: 80,
      attack: 18,
      defense: 15,
      speed: 8,
    },
    abilities: warriorAbilities,
    image: warriorImage,
  },
  mage: {
    class: 'mage',
    level: 1,
    stats: {
      health: 85,
      maxHealth: 85,
      energy: 120,
      maxEnergy: 120,
      attack: 22,
      defense: 8,
      speed: 10,
    },
    abilities: mageAbilities,
    image: mageImage,
  },
  hunter: {
    class: 'hunter',
    level: 1,
    stats: {
      health: 100,
      maxHealth: 100,
      energy: 100,
      maxEnergy: 100,
      attack: 20,
      defense: 10,
      speed: 15,
    },
    abilities: hunterAbilities,
    image: hunterImage,
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
  };
};

export const createEnemy = (): Character => {
  const classes: CharacterClass[] = ['warrior', 'mage', 'hunter'];
  const randomClass = classes[Math.floor(Math.random() * classes.length)];
  const enemyNames = ['Shadow Reaper', 'Void Walker', 'Dark Sentinel', 'Chaos Agent', 'Nebula Hunter'];
  const randomName = enemyNames[Math.floor(Math.random() * enemyNames.length)];
  
  const enemy = createCharacter(randomClass, randomName, 'enemy');
  // Scale enemy stats slightly
  enemy.stats.health = Math.floor(enemy.stats.health * 0.9);
  enemy.stats.maxHealth = enemy.stats.health;
  
  return enemy;
};
