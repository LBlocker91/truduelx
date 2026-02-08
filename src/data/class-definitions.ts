import { CharacterClass, ClassMeta, Ability } from '@/types/game';

import warriorImage from '@/assets/warrior-character.png';
import mageImage from '@/assets/mage-character.png';
import hunterImage from '@/assets/hunter-character.png';
import blademasterImage from '@/assets/blademaster-character.png';
import techSentinelImage from '@/assets/tech-sentinel-character.png';
import tacticianImage from '@/assets/tactician-character.png';
import shadowOperativeImage from '@/assets/shadow-operative-character.png';
import demolisherImage from '@/assets/demolisher-character.png';
import cyberWardenImage from '@/assets/cyber-warden-character.png';

// ====================== CLASS METADATA ======================

export const CLASS_META: Record<CharacterClass, ClassMeta> = {
  // --- FREE ---
  mercenary: {
    name: 'MERCENARY',
    description: 'Hybrid adaptable fighter. Balanced stats make them viable in any situation.',
    playstyle: 'Balanced Fighter',
    primaryStats: 'STR / DEX',
    unlockType: 'free',
    color: 'text-secondary',
  },
  'tech-mage': {
    name: 'TECH MAGE',
    description: 'Tech burst & control specialist. Punishes low-tech builds with devastating energy attacks.',
    playstyle: 'Tech Burst & Control',
    primaryStats: 'TECH',
    unlockType: 'free',
    color: 'text-neon-purple',
  },
  gunner: {
    name: 'GUNNER',
    description: 'Ranged pressure dealer. Consistent damage output and great for long fights.',
    playstyle: 'Ranged Pressure',
    primaryStats: 'SUP / DEX',
    unlockType: 'free',
    color: 'text-primary',
  },
  // --- LEVEL 30 UNLOCK ---
  blademaster: {
    name: 'BLADEMASTER',
    description: 'High-skill burst fighter. Multi-hit combos and precision strikes bypass defenses.',
    playstyle: 'Skill-Based Burst',
    primaryStats: 'DEX',
    unlockType: 'level',
    unlockLevel: 30,
    color: 'text-primary',
  },
  'tech-sentinel': {
    name: 'TECH SENTINEL',
    description: 'Tanky tech controller. Absorbs massive punishment while locking down enemies.',
    playstyle: 'Tanky Tech Control',
    primaryStats: 'STR / TECH',
    unlockType: 'level',
    unlockLevel: 30,
    color: 'text-neon-green',
  },
  tactician: {
    name: 'TACTICIAN',
    description: 'Buff/debuff specialist. Dominates longer matches and scales brutally late-game.',
    playstyle: 'Buff/Debuff Specialist',
    primaryStats: 'SUP',
    unlockType: 'level',
    unlockLevel: 30,
    color: 'text-shield',
  },
  // --- PREMIUM ---
  'shadow-operative': {
    name: 'SHADOW OPERATIVE',
    description: 'High-risk assassin. Explosive critical damage that punishes enemy mistakes.',
    playstyle: 'High-Risk Assassin',
    primaryStats: 'DEX / SUP',
    unlockType: 'premium',
    color: 'text-neon-purple',
  },
  demolisher: {
    name: 'DEMOLISHER',
    description: 'Rocket & AoE damage. Anti-tank specialist with battle-ending pressure.',
    playstyle: 'Rocket & AoE Damage',
    primaryStats: 'SUP / STR',
    unlockType: 'premium',
    color: 'text-secondary',
  },
  'cyber-warden': {
    name: 'CYBER WARDEN',
    description: 'Endgame hybrid controller. Top-tier control with tech burst and stat manipulation.',
    playstyle: 'Endgame Hybrid Controller',
    primaryStats: 'TECH / SUP',
    unlockType: 'premium',
    color: 'text-primary',
  },
};

// ====================== CLASS IMAGES ======================

export const CLASS_IMAGES: Record<CharacterClass, string> = {
  mercenary: warriorImage,
  'tech-mage': mageImage,
  gunner: hunterImage,
  blademaster: blademasterImage,
  'tech-sentinel': techSentinelImage,
  tactician: tacticianImage,
  'shadow-operative': shadowOperativeImage,
  demolisher: demolisherImage,
  'cyber-warden': cyberWardenImage,
};

// ====================== BASE STATS ======================

export interface BaseStats {
  strength: number;
  dexterity: number;
  technology: number;
  support: number;
  energy: number;
  maxEnergy: number;
}

export const BASE_STATS: Record<CharacterClass, BaseStats> = {
  // FREE
  mercenary:   { strength: 7, dexterity: 7, technology: 4, support: 4, energy: 90, maxEnergy: 90 },
  'tech-mage': { strength: 3, dexterity: 4, technology: 10, support: 5, energy: 120, maxEnergy: 120 },
  gunner:      { strength: 4, dexterity: 6, technology: 3, support: 8, energy: 100, maxEnergy: 100 },
  // LEVEL 30
  blademaster:     { strength: 5, dexterity: 10, technology: 3, support: 4, energy: 95, maxEnergy: 95 },
  'tech-sentinel': { strength: 8, dexterity: 4, technology: 8, support: 3, energy: 100, maxEnergy: 100 },
  tactician:       { strength: 4, dexterity: 5, technology: 4, support: 10, energy: 110, maxEnergy: 110 },
  // PREMIUM
  'shadow-operative': { strength: 4, dexterity: 9, technology: 3, support: 7, energy: 90, maxEnergy: 90 },
  demolisher:         { strength: 7, dexterity: 4, technology: 4, support: 8, energy: 95, maxEnergy: 95 },
  'cyber-warden':     { strength: 4, dexterity: 4, technology: 9, support: 7, energy: 115, maxEnergy: 115 },
};

// ====================== ABILITIES ======================

const mercenaryAbilities: Ability[] = [
  {
    id: 'strike', name: 'Strike', description: 'Basic enhanced attack',
    energyCost: 10, baseDamage: 17, type: 'physical', scaleStat: 'dexterity',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'guard', name: 'Guard', description: 'Reduces next damage, increases block chance',
    energyCost: 12, baseDamage: 0, type: 'special', scaleStat: 'dexterity',
    cooldown: 2, currentCooldown: 0, effect: 'defense_buff',
  },
  {
    id: 'power-slash', name: 'Power Slash', description: 'STR-based heavy hit',
    energyCost: 22, baseDamage: 26, type: 'physical', scaleStat: 'strength',
    cooldown: 2, currentCooldown: 0,
  },
  {
    id: 'adrenaline', name: 'Adrenaline', description: 'Temporary damage + speed buff',
    energyCost: 18, baseDamage: 10, type: 'special', scaleStat: 'support',
    cooldown: 3, currentCooldown: 0, effect: 'buff_attack',
  },
];

const techMageAbilities: Ability[] = [
  {
    id: 'pulse-bolt', name: 'Pulse Bolt', description: 'Tech damage attack',
    energyCost: 12, baseDamage: 20, type: 'magical', scaleStat: 'technology',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'overload', name: 'Overload', description: 'High tech damage burst',
    energyCost: 28, baseDamage: 32, type: 'magical', scaleStat: 'technology',
    cooldown: 3, currentCooldown: 0,
  },
  {
    id: 'system-jam', name: 'System Jam', description: 'Reduces enemy tech defense',
    energyCost: 18, baseDamage: 12, type: 'special', scaleStat: 'technology',
    cooldown: 2, currentCooldown: 0, effect: 'debuff_defense',
  },
  {
    id: 'energy-shield', name: 'Energy Shield', description: 'Tech-based damage absorb',
    energyCost: 20, baseDamage: 0, type: 'special', scaleStat: 'technology',
    cooldown: 3, currentCooldown: 0, effect: 'damage_absorb',
  },
];

const gunnerAbilities: Ability[] = [
  {
    id: 'rapid-fire', name: 'Rapid Fire', description: 'Multi-hit gun attack',
    energyCost: 10, baseDamage: 16, type: 'physical', scaleStat: 'support',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'aim-lock', name: 'Aim Lock', description: 'Increases crit damage',
    energyCost: 15, baseDamage: 8, type: 'special', scaleStat: 'support',
    cooldown: 2, currentCooldown: 0, effect: 'crit_buff',
  },
  {
    id: 'suppressive-fire', name: 'Suppressive Fire', description: 'Reduces enemy defense',
    energyCost: 20, baseDamage: 14, type: 'physical', scaleStat: 'support',
    cooldown: 2, currentCooldown: 0, effect: 'debuff_defense',
  },
  {
    id: 'reload', name: 'Reload', description: 'Energy recovery + gun buff',
    energyCost: 0, baseDamage: 0, type: 'special', scaleStat: 'support',
    cooldown: 3, currentCooldown: 0, effect: 'energy_recovery',
  },
];

const blademasterAbilities: Ability[] = [
  {
    id: 'blade-flurry', name: 'Blade Flurry', description: 'Multi-hit skill damage',
    energyCost: 14, baseDamage: 22, type: 'physical', scaleStat: 'dexterity',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'counter-stance', name: 'Counter Stance', description: 'Block → counterattack',
    energyCost: 16, baseDamage: 10, type: 'physical', scaleStat: 'dexterity',
    cooldown: 2, currentCooldown: 0, effect: 'defense_buff',
  },
  {
    id: 'precision-cut', name: 'Precision Cut', description: 'Ignores part of defense',
    energyCost: 24, baseDamage: 30, type: 'physical', scaleStat: 'dexterity',
    cooldown: 2, currentCooldown: 0,
  },
  {
    id: 'focus', name: 'Focus', description: 'Crit chance + crit damage buff',
    energyCost: 18, baseDamage: 8, type: 'special', scaleStat: 'dexterity',
    cooldown: 3, currentCooldown: 0, effect: 'crit_buff',
  },
];

const techSentinelAbilities: Ability[] = [
  {
    id: 'emp-smash', name: 'EMP Smash', description: 'Tech + STR hybrid damage',
    energyCost: 16, baseDamage: 20, type: 'magical', scaleStat: 'technology',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'fortify', name: 'Fortify', description: 'Massive defense buff',
    energyCost: 20, baseDamage: 0, type: 'special', scaleStat: 'strength',
    cooldown: 3, currentCooldown: 0, effect: 'defense_buff',
  },
  {
    id: 'system-lock', name: 'System Lock', description: 'Increases enemy cooldowns',
    energyCost: 22, baseDamage: 10, type: 'special', scaleStat: 'technology',
    cooldown: 3, currentCooldown: 0, effect: 'cooldown_increase',
  },
  {
    id: 'nano-repair', name: 'Nano Repair', description: 'Heal scaling with TECH',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'technology',
    cooldown: 3, currentCooldown: 0, effect: 'heal',
  },
];

const tacticianAbilities: Ability[] = [
  {
    id: 'rally', name: 'Rally', description: 'Buffs self damage + defense',
    energyCost: 15, baseDamage: 10, type: 'special', scaleStat: 'support',
    cooldown: 2, currentCooldown: 0, effect: 'buff_attack',
  },
  {
    id: 'expose-weakness', name: 'Expose Weakness', description: 'Enemy takes more damage',
    energyCost: 20, baseDamage: 12, type: 'special', scaleStat: 'support',
    cooldown: 2, currentCooldown: 0, effect: 'damage_taken_increase',
  },
  {
    id: 'command-drone', name: 'Command Drone', description: 'Pet damage attack',
    energyCost: 14, baseDamage: 18, type: 'special', scaleStat: 'support',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'momentum-shift', name: 'Momentum Shift', description: 'Reduces enemy buffs',
    energyCost: 22, baseDamage: 10, type: 'special', scaleStat: 'support',
    cooldown: 3, currentCooldown: 0, effect: 'debuff_defense',
  },
];

const shadowOperativeAbilities: Ability[] = [
  {
    id: 'backstab', name: 'Backstab', description: 'Massive crit scaling attack',
    energyCost: 14, baseDamage: 24, type: 'physical', scaleStat: 'dexterity',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'smoke-veil', name: 'Smoke Veil', description: 'Dodge + damage reduction',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'dexterity',
    cooldown: 3, currentCooldown: 0, effect: 'dodge',
  },
  {
    id: 'execution-protocol', name: 'Execution Protocol', description: 'Bonus damage below 30% HP',
    energyCost: 26, baseDamage: 28, type: 'physical', scaleStat: 'dexterity',
    cooldown: 2, currentCooldown: 0, effect: 'bonus_low_hp',
  },
  {
    id: 'silent-prep', name: 'Silent Prep', description: 'Crit damage buff',
    energyCost: 16, baseDamage: 6, type: 'special', scaleStat: 'support',
    cooldown: 3, currentCooldown: 0, effect: 'crit_buff',
  },
];

const demolisherAbilities: Ability[] = [
  {
    id: 'rocket-barrage', name: 'Rocket Barrage', description: 'Rocket launcher damage',
    energyCost: 16, baseDamage: 22, type: 'physical', scaleStat: 'support',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'shockwave', name: 'Shockwave', description: 'AoE damage + stun chance',
    energyCost: 24, baseDamage: 20, type: 'physical', scaleStat: 'strength',
    cooldown: 2, currentCooldown: 0, effect: 'stun',
  },
  {
    id: 'heavy-armor', name: 'Heavy Armor', description: 'Damage cap reduction',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'strength',
    cooldown: 3, currentCooldown: 0, effect: 'defense_buff',
  },
  {
    id: 'payload-boost', name: 'Payload Boost', description: 'Rocket damage buff',
    energyCost: 20, baseDamage: 8, type: 'special', scaleStat: 'support',
    cooldown: 3, currentCooldown: 0, effect: 'buff_attack',
  },
];

const cyberWardenAbilities: Ability[] = [
  {
    id: 'quantum-blast', name: 'Quantum Blast', description: 'High tech burst',
    energyCost: 16, baseDamage: 24, type: 'magical', scaleStat: 'technology',
    cooldown: 0, currentCooldown: 0,
  },
  {
    id: 'firewall', name: 'Firewall', description: 'Reflect % tech damage',
    energyCost: 22, baseDamage: 0, type: 'special', scaleStat: 'technology',
    cooldown: 3, currentCooldown: 0, effect: 'reflect',
  },
  {
    id: 'overclock-core', name: 'Overclock Core', description: 'Buff all stats temporarily',
    energyCost: 28, baseDamage: 0, type: 'special', scaleStat: 'support',
    cooldown: 4, currentCooldown: 0, effect: 'stat_buff_all',
  },
  {
    id: 'system-override', name: 'System Override', description: 'Disable enemy skill next turn',
    energyCost: 24, baseDamage: 14, type: 'magical', scaleStat: 'technology',
    cooldown: 3, currentCooldown: 0, effect: 'skill_disable',
  },
];

export const CLASS_ABILITIES: Record<CharacterClass, Ability[]> = {
  mercenary: mercenaryAbilities,
  'tech-mage': techMageAbilities,
  gunner: gunnerAbilities,
  blademaster: blademasterAbilities,
  'tech-sentinel': techSentinelAbilities,
  tactician: tacticianAbilities,
  'shadow-operative': shadowOperativeAbilities,
  demolisher: demolisherAbilities,
  'cyber-warden': cyberWardenAbilities,
};

export const ALL_CLASSES: CharacterClass[] = [
  'mercenary', 'tech-mage', 'gunner',
  'blademaster', 'tech-sentinel', 'tactician',
  'shadow-operative', 'demolisher', 'cyber-warden',
];

export const FREE_CLASSES: CharacterClass[] = ['mercenary', 'tech-mage', 'gunner'];
export const LEVEL_UNLOCK_CLASSES: CharacterClass[] = ['blademaster', 'tech-sentinel', 'tactician'];
export const PREMIUM_CLASSES: CharacterClass[] = ['shadow-operative', 'demolisher', 'cyber-warden'];
