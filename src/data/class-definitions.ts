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
    name: 'IRON VANGUARD',
    description: 'STR/DEF bruiser. High HP, physical pressure, defensive control. Holds the line.',
    playstyle: 'Bruiser / Front Line',
    primaryStats: 'STR / DEF',
    unlockType: 'free',
    color: 'text-secondary',
  },
  'tech-mage': {
    name: 'ARC ENGINEER',
    description: 'TECH/RES caster. Energy damage, shields, MP-heavy abilities. Bends the field.',
    playstyle: 'Energy Caster / Shielder',
    primaryStats: 'TECH / RES',
    unlockType: 'free',
    color: 'text-neon-purple',
  },
  gunner: {
    name: 'RIFT STALKER',
    description: 'DEX/SUP tactical fighter. Traps, precision damage, evasive control. Strikes from edges.',
    playstyle: 'Precision / Evasion',
    primaryStats: 'DEX / SUP',
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

// ====================== ABILITIES (SKILL TREES) ======================
// Each class has 4 rows × 3 skills = 12 abilities
// Row 1: Lv 1-10, Row 2: Lv 10-30, Row 3: Lv 30-50, Row 4: Lv 50-100

// --- 1. MERCENARY (STR / DEX) ---
const mercenaryAbilities: Ability[] = [
  // Row 1 (Lv 1)
  { id: 'measured-strike', name: 'Measured Strike', description: '1 hit, reliable DEX damage',
    energyCost: 10, baseDamage: 80, type: 'physical', scaleStat: 'dexterity', cooldown: 2, currentCooldown: 0, hits: 1, unlockLevel: 1 },
  { id: 'shield-brace', name: 'Shield Brace', description: '−25% damage on next hit',
    energyCost: 12, baseDamage: 0, type: 'special', scaleStat: 'dexterity', cooldown: 3, currentCooldown: 0, effect: 'defense_buff', unlockLevel: 1 },
  { id: 'combat-focus', name: 'Combat Focus', description: '+10% damage (1 turn)',
    energyCost: 10, baseDamage: 10, type: 'special', scaleStat: 'strength', cooldown: 3, currentCooldown: 0, effect: 'buff_attack', unlockLevel: 1 },
  // Row 2 (Lv 10)
  { id: 'double-cut', name: 'Double Cut', description: '2 hits, STR-based slashes',
    energyCost: 18, baseDamage: 55, type: 'physical', scaleStat: 'strength', cooldown: 3, currentCooldown: 0, hits: 2, unlockLevel: 10 },
  { id: 'guard-break', name: 'Guard Break', description: 'Ignores 15% defense',
    energyCost: 20, baseDamage: 120, type: 'physical', scaleStat: 'strength', cooldown: 4, currentCooldown: 0, hits: 1, effect: 'debuff_defense', unlockLevel: 10 },
  { id: 'field-patch', name: 'Field Patch', description: 'Heal 10% Max HP + SUP×2',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'heal', healPercent: 10, unlockLevel: 10 },
  // Row 3 (Lv 30)
  { id: 'relentless-slash', name: 'Relentless Slash', description: '3 hits, heavy combo',
    energyCost: 24, baseDamage: 50, type: 'physical', scaleStat: 'strength', cooldown: 5, currentCooldown: 0, hits: 3, unlockLevel: 30 },
  { id: 'counter-stance', name: 'Counter Stance', description: 'Block triggers counter hit',
    energyCost: 20, baseDamage: 0, type: 'special', scaleStat: 'dexterity', cooldown: 5, currentCooldown: 0, effect: 'defense_buff', unlockLevel: 30 },
  { id: 'emergency-aid', name: 'Emergency Aid', description: 'Heal 20% Max HP + SUP×3',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'heal', healPercent: 20, unlockLevel: 30 },
  // Row 4 (Lv 50)
  { id: 'blade-barrage', name: 'Blade Barrage', description: '5 rapid slashes',
    energyCost: 30, baseDamage: 30, type: 'physical', scaleStat: 'strength', cooldown: 7, currentCooldown: 0, hits: 5, unlockLevel: 50 },
  { id: 'war-momentum', name: 'War Momentum', description: '+20% damage, +10% block (2 turns)',
    energyCost: 28, baseDamage: 0, type: 'special', scaleStat: 'strength', cooldown: 8, currentCooldown: 0, effect: 'buff_attack', unlockLevel: 50 },
  { id: 'last-stand-protocol', name: 'Last Stand', description: 'Heal 35% Max HP + SUP×4',
    energyCost: 35, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 10, currentCooldown: 0, effect: 'heal', healPercent: 35, unlockLevel: 50 },
];

// --- 2. TECH MAGE (TECH) ---
const techMageAbilities: Ability[] = [
  // Row 1
  { id: 'pulse-spark', name: 'Pulse Spark', description: 'TECH burst attack',
    energyCost: 12, baseDamage: 85, type: 'magical', scaleStat: 'technology', cooldown: 2, currentCooldown: 0, hits: 1, unlockLevel: 1 },
  { id: 'static-guard', name: 'Static Guard', description: 'Absorb tech damage',
    energyCost: 14, baseDamage: 0, type: 'special', scaleStat: 'technology', cooldown: 3, currentCooldown: 0, effect: 'damage_absorb', unlockLevel: 1 },
  { id: 'energy-channel', name: 'Energy Channel', description: 'Gain 25 energy',
    energyCost: 0, baseDamage: 0, type: 'special', scaleStat: 'technology', cooldown: 3, currentCooldown: 0, effect: 'energy_recovery', unlockLevel: 1 },
  // Row 2
  { id: 'twin-volt', name: 'Twin Volt', description: '2 tech hits',
    energyCost: 20, baseDamage: 50, type: 'magical', scaleStat: 'technology', cooldown: 3, currentCooldown: 0, hits: 2, unlockLevel: 10 },
  { id: 'system-drain', name: 'System Drain', description: '−15% tech defense (2 turns)',
    energyCost: 18, baseDamage: 12, type: 'special', scaleStat: 'technology', cooldown: 4, currentCooldown: 0, effect: 'debuff_defense', unlockLevel: 10 },
  { id: 'nano-repair-tm', name: 'Nano Repair', description: 'Heal 10% Max HP + SUP×2',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'heal', healPercent: 10, unlockLevel: 10 },
  // Row 3
  { id: 'overload-beam', name: 'Overload Beam', description: '150 dmg, ignores 25% tech def',
    energyCost: 28, baseDamage: 150, type: 'magical', scaleStat: 'technology', cooldown: 5, currentCooldown: 0, hits: 1, unlockLevel: 30 },
  { id: 'emp-burst', name: 'EMP Burst', description: '3 hits + stun chance',
    energyCost: 26, baseDamage: 45, type: 'magical', scaleStat: 'technology', cooldown: 5, currentCooldown: 0, hits: 3, effect: 'stun', unlockLevel: 30 },
  { id: 'failsafe-restore', name: 'Failsafe Restore', description: 'Heal 20% Max HP + SUP×3',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'heal', healPercent: 20, unlockLevel: 30 },
  // Row 4
  { id: 'quantum-barrage', name: 'Quantum Barrage', description: '10 tech hits',
    energyCost: 40, baseDamage: 22, type: 'magical', scaleStat: 'technology', cooldown: 9, currentCooldown: 0, hits: 10, unlockLevel: 50 },
  { id: 'overclock-core-tm', name: 'Overclock Core', description: '+25% tech damage (2 turns)',
    energyCost: 30, baseDamage: 0, type: 'special', scaleStat: 'technology', cooldown: 8, currentCooldown: 0, effect: 'buff_attack', unlockLevel: 50 },
  { id: 'reconstruction-matrix', name: 'Reconstruction', description: 'Heal 35% Max HP + SUP×4',
    energyCost: 35, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 10, currentCooldown: 0, effect: 'heal', healPercent: 35, unlockLevel: 50 },
];

// --- 3. GUNNER (SUP / DEX) ---
const gunnerAbilities: Ability[] = [
  // Row 1
  { id: 'quick-shot', name: 'Quick Shot', description: 'Fast ranged hit',
    energyCost: 10, baseDamage: 75, type: 'physical', scaleStat: 'support', cooldown: 2, currentCooldown: 0, hits: 1, unlockLevel: 1 },
  { id: 'evasive-roll', name: 'Evasive Roll', description: '+15% dodge',
    energyCost: 12, baseDamage: 0, type: 'special', scaleStat: 'dexterity', cooldown: 3, currentCooldown: 0, effect: 'dodge', unlockLevel: 1 },
  { id: 'ammo-load', name: 'Ammo Load', description: 'Gain 20 energy',
    energyCost: 0, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 3, currentCooldown: 0, effect: 'energy_recovery', unlockLevel: 1 },
  // Row 2
  { id: 'dual-fire', name: 'Dual Fire', description: '2 rapid shots',
    energyCost: 18, baseDamage: 50, type: 'physical', scaleStat: 'support', cooldown: 3, currentCooldown: 0, hits: 2, unlockLevel: 10 },
  { id: 'suppress-fire', name: 'Suppress Fire', description: '3 hits, weaken enemy −10%',
    energyCost: 22, baseDamage: 28, type: 'physical', scaleStat: 'support', cooldown: 4, currentCooldown: 0, hits: 3, effect: 'debuff_defense', unlockLevel: 10 },
  { id: 'combat-medkit', name: 'Combat Medkit', description: 'Heal 10% Max HP + SUP×2',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'heal', healPercent: 10, unlockLevel: 10 },
  // Row 3
  { id: 'lead-storm', name: 'Lead Storm', description: '5 suppressive shots',
    energyCost: 28, baseDamage: 28, type: 'physical', scaleStat: 'support', cooldown: 6, currentCooldown: 0, hits: 5, unlockLevel: 30 },
  { id: 'target-lock', name: 'Target Lock', description: '+25% crit damage (2 turns)',
    energyCost: 20, baseDamage: 8, type: 'special', scaleStat: 'support', cooldown: 5, currentCooldown: 0, effect: 'crit_buff', unlockLevel: 30 },
  { id: 'tactical-heal', name: 'Tactical Heal', description: 'Heal 20% Max HP + SUP×3',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'heal', healPercent: 20, unlockLevel: 30 },
  // Row 4
  { id: 'bullet-hell', name: 'Bullet Hell', description: '10 rapid-fire shots',
    energyCost: 40, baseDamage: 22, type: 'physical', scaleStat: 'support', cooldown: 9, currentCooldown: 0, hits: 10, unlockLevel: 50 },
  { id: 'kill-zone', name: 'Kill Zone', description: '+25% gun damage (2 turns)',
    energyCost: 28, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 8, currentCooldown: 0, effect: 'buff_attack', unlockLevel: 50 },
  { id: 'adrenaline-recovery', name: 'Adrenaline Heal', description: 'Heal 35% Max HP + SUP×4',
    energyCost: 35, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 10, currentCooldown: 0, effect: 'heal', healPercent: 35, unlockLevel: 50 },
];

// --- 4. BLADEMASTER (DEX) ---
const blademasterAbilities: Ability[] = [
  // Row 1
  { id: 'precision-cut', name: 'Precision Cut', description: 'High crit chance hit',
    energyCost: 10, baseDamage: 75, type: 'physical', scaleStat: 'dexterity', cooldown: 2, currentCooldown: 0, hits: 1, effect: 'crit_buff', unlockLevel: 1 },
  { id: 'deflect-stance', name: 'Deflect Stance', description: 'Increase block + counter',
    energyCost: 12, baseDamage: 0, type: 'special', scaleStat: 'dexterity', cooldown: 3, currentCooldown: 0, effect: 'defense_buff', unlockLevel: 1 },
  { id: 'focus-mind', name: 'Focus Mind', description: '+10% crit damage',
    energyCost: 10, baseDamage: 8, type: 'special', scaleStat: 'dexterity', cooldown: 3, currentCooldown: 0, effect: 'crit_buff', unlockLevel: 1 },
  // Row 2
  { id: 'twin-edge', name: 'Twin Edge', description: '2 hits, ignores 10% defense',
    energyCost: 18, baseDamage: 55, type: 'physical', scaleStat: 'dexterity', cooldown: 3, currentCooldown: 0, hits: 2, unlockLevel: 10 },
  { id: 'bleeding-slash', name: 'Bleeding Slash', description: 'Damage + bleed over time',
    energyCost: 20, baseDamage: 60, type: 'physical', scaleStat: 'dexterity', cooldown: 4, currentCooldown: 0, hits: 1, effect: 'dot', unlockLevel: 10 },
  { id: 'quick-mend', name: 'Quick Mend', description: 'Heal 10% Max HP + SUP×2',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'heal', healPercent: 10, unlockLevel: 10 },
  // Row 3
  { id: 'flurry-dance', name: 'Flurry Dance', description: '5 rapid blade hits',
    energyCost: 28, baseDamage: 28, type: 'physical', scaleStat: 'dexterity', cooldown: 6, currentCooldown: 0, hits: 5, unlockLevel: 30 },
  { id: 'riposte', name: 'Riposte', description: 'Counter with bonus crit damage',
    energyCost: 22, baseDamage: 0, type: 'special', scaleStat: 'dexterity', cooldown: 5, currentCooldown: 0, effect: 'defense_buff', unlockLevel: 30 },
  { id: 'survival-instinct', name: 'Survival Instinct', description: 'Heal 20% Max HP + SUP×3',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'heal', healPercent: 20, unlockLevel: 30 },
  // Row 4
  { id: 'thousand-cuts', name: '1000 Cuts', description: '10 lightning-fast strikes',
    energyCost: 40, baseDamage: 22, type: 'physical', scaleStat: 'dexterity', cooldown: 9, currentCooldown: 0, hits: 10, unlockLevel: 50 },
  { id: 'blade-mastery', name: 'Blade Mastery', description: '+30% skill damage (2 turns)',
    energyCost: 28, baseDamage: 0, type: 'special', scaleStat: 'dexterity', cooldown: 8, currentCooldown: 0, effect: 'buff_attack', unlockLevel: 50 },
  { id: 'last-breath-recovery', name: 'Last Breath', description: 'Heal 35% Max HP + SUP×4',
    energyCost: 35, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 10, currentCooldown: 0, effect: 'heal', healPercent: 35, unlockLevel: 50 },
];

// --- 5. TECH SENTINEL (STR / TECH) ---
const techSentinelAbilities: Ability[] = [
  // Row 1
  { id: 'shock-bash', name: 'Shock Bash', description: '1 hit + slow',
    energyCost: 12, baseDamage: 80, type: 'physical', scaleStat: 'strength', cooldown: 2, currentCooldown: 0, hits: 1, effect: 'debuff_defense', unlockLevel: 1 },
  { id: 'reinforced-plating', name: 'Reinf. Plating', description: '+20% defense',
    energyCost: 14, baseDamage: 0, type: 'special', scaleStat: 'strength', cooldown: 3, currentCooldown: 0, effect: 'defense_buff', unlockLevel: 1 },
  { id: 'energy-sync', name: 'Energy Sync', description: 'Gain energy + shield',
    energyCost: 0, baseDamage: 0, type: 'special', scaleStat: 'technology', cooldown: 3, currentCooldown: 0, effect: 'energy_recovery', unlockLevel: 1 },
  // Row 2
  { id: 'emp-slam', name: 'EMP Slam', description: '2 hits + weaken tech',
    energyCost: 20, baseDamage: 55, type: 'magical', scaleStat: 'technology', cooldown: 4, currentCooldown: 0, hits: 2, effect: 'debuff_defense', unlockLevel: 10 },
  { id: 'system-lock', name: 'System Lock', description: 'Increase enemy cooldowns',
    energyCost: 22, baseDamage: 10, type: 'special', scaleStat: 'technology', cooldown: 5, currentCooldown: 0, effect: 'cooldown_increase', unlockLevel: 10 },
  { id: 'nano-mend', name: 'Nano Mend', description: 'Heal 10% Max HP + SUP×2',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'heal', healPercent: 10, unlockLevel: 10 },
  // Row 3
  { id: 'gravity-crush', name: 'Gravity Crush', description: '3 hits + stun chance',
    energyCost: 28, baseDamage: 50, type: 'magical', scaleStat: 'technology', cooldown: 6, currentCooldown: 0, hits: 3, effect: 'stun', unlockLevel: 30 },
  { id: 'fortress-mode', name: 'Fortress Mode', description: 'Massive defense boost',
    energyCost: 24, baseDamage: 0, type: 'special', scaleStat: 'strength', cooldown: 6, currentCooldown: 0, effect: 'defense_buff', unlockLevel: 30 },
  { id: 'auto-repair', name: 'Auto Repair', description: 'Heal 20% Max HP + SUP×3',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'heal', healPercent: 20, unlockLevel: 30 },
  // Row 4
  { id: 'anvil-protocol', name: 'Anvil Protocol', description: '5 heavy tech hits',
    energyCost: 35, baseDamage: 35, type: 'magical', scaleStat: 'technology', cooldown: 8, currentCooldown: 0, hits: 5, unlockLevel: 50 },
  { id: 'iron-core', name: 'Iron Core', description: '+30% defense (2 turns)',
    energyCost: 28, baseDamage: 0, type: 'special', scaleStat: 'strength', cooldown: 8, currentCooldown: 0, effect: 'defense_buff', unlockLevel: 50 },
  { id: 'reconstruction-core', name: 'Reconst. Core', description: 'Heal 35% Max HP + SUP×4',
    energyCost: 35, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 10, currentCooldown: 0, effect: 'heal', healPercent: 35, unlockLevel: 50 },
];

// --- 6. TACTICIAN (SUP) ---
const tacticianAbilities: Ability[] = [
  // Row 1
  { id: 'command-strike', name: 'Command Strike', description: 'Support-based attack',
    energyCost: 10, baseDamage: 70, type: 'special', scaleStat: 'support', cooldown: 2, currentCooldown: 0, hits: 1, unlockLevel: 1 },
  { id: 'motivate', name: 'Motivate', description: '+10% damage & defense',
    energyCost: 12, baseDamage: 10, type: 'special', scaleStat: 'support', cooldown: 3, currentCooldown: 0, effect: 'buff_attack', unlockLevel: 1 },
  { id: 'drone-deploy', name: 'Drone Deploy', description: 'Pet attack',
    energyCost: 14, baseDamage: 65, type: 'special', scaleStat: 'support', cooldown: 3, currentCooldown: 0, hits: 1, unlockLevel: 1 },
  // Row 2
  { id: 'expose-weakness', name: 'Expose Weakness', description: 'Enemy defense −20%',
    energyCost: 20, baseDamage: 12, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'damage_taken_increase', unlockLevel: 10 },
  { id: 'coordinated-fire', name: 'Coordinated Fire', description: '3 hits via pet',
    energyCost: 22, baseDamage: 40, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, hits: 3, unlockLevel: 10 },
  { id: 'support-heal', name: 'Support Heal', description: 'Heal 10% Max HP + SUP×2',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'heal', healPercent: 10, unlockLevel: 10 },
  // Row 3
  { id: 'battle-plan', name: 'Battle Plan', description: 'Buff all stats (1 turn)',
    energyCost: 26, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'stat_buff_all', unlockLevel: 30 },
  { id: 'disrupt-orders', name: 'Disrupt Orders', description: 'Enemy buffs weakened',
    energyCost: 22, baseDamage: 15, type: 'special', scaleStat: 'support', cooldown: 5, currentCooldown: 0, effect: 'debuff_defense', unlockLevel: 30 },
  { id: 'strategic-recovery', name: 'Strategic Heal', description: 'Heal 20% Max HP + SUP×3',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'heal', healPercent: 20, unlockLevel: 30 },
  // Row 4
  { id: 'command-barrage', name: 'Command Barrage', description: '5 hits via allies',
    energyCost: 35, baseDamage: 28, type: 'special', scaleStat: 'support', cooldown: 8, currentCooldown: 0, hits: 5, unlockLevel: 50 },
  { id: 'perfect-execution', name: 'Perfect Execution', description: 'Crit damage +30%',
    energyCost: 28, baseDamage: 8, type: 'special', scaleStat: 'support', cooldown: 8, currentCooldown: 0, effect: 'crit_buff', unlockLevel: 50 },
  { id: 'master-recovery', name: 'Master Recovery', description: 'Heal 35% Max HP + SUP×4',
    energyCost: 35, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 10, currentCooldown: 0, effect: 'heal', healPercent: 35, unlockLevel: 50 },
];

// --- 7. SHADOW OPERATIVE (DEX / SUP) ---
const shadowOperativeAbilities: Ability[] = [
  // Row 1
  { id: 'silent-strike', name: 'Silent Strike', description: 'High crit chance attack',
    energyCost: 10, baseDamage: 75, type: 'physical', scaleStat: 'dexterity', cooldown: 2, currentCooldown: 0, hits: 1, effect: 'crit_buff', unlockLevel: 1 },
  { id: 'smoke-veil', name: 'Smoke Veil', description: 'Dodge + damage reduction',
    energyCost: 14, baseDamage: 0, type: 'special', scaleStat: 'dexterity', cooldown: 3, currentCooldown: 0, effect: 'dodge', unlockLevel: 1 },
  { id: 'shadow-prep', name: 'Shadow Prep', description: '+crit damage buff',
    energyCost: 10, baseDamage: 6, type: 'special', scaleStat: 'support', cooldown: 3, currentCooldown: 0, effect: 'crit_buff', unlockLevel: 1 },
  // Row 2
  { id: 'backstab', name: 'Backstab', description: 'Bonus damage if enemy HP >50%',
    energyCost: 20, baseDamage: 90, type: 'physical', scaleStat: 'dexterity', cooldown: 4, currentCooldown: 0, hits: 1, unlockLevel: 10 },
  { id: 'crippling-cut', name: 'Crippling Cut', description: 'Reduce enemy defense',
    energyCost: 18, baseDamage: 60, type: 'physical', scaleStat: 'dexterity', cooldown: 4, currentCooldown: 0, hits: 1, effect: 'debuff_defense', unlockLevel: 10 },
  { id: 'quick-stitch', name: 'Quick Stitch', description: 'Heal 10% Max HP + SUP×2',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'heal', healPercent: 10, unlockLevel: 10 },
  // Row 3
  { id: 'execution-chain', name: 'Execution Chain', description: '3 hits, bonus below 40% HP',
    energyCost: 28, baseDamage: 45, type: 'physical', scaleStat: 'dexterity', cooldown: 6, currentCooldown: 0, hits: 3, effect: 'bonus_low_hp', unlockLevel: 30 },
  { id: 'shadow-lock', name: 'Shadow Lock', description: 'Stun enemy 1 turn',
    energyCost: 24, baseDamage: 40, type: 'special', scaleStat: 'dexterity', cooldown: 6, currentCooldown: 0, hits: 1, effect: 'stun', unlockLevel: 30 },
  { id: 'survival-recovery', name: 'Survival Heal', description: 'Heal 20% Max HP + SUP×3',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'heal', healPercent: 20, unlockLevel: 30 },
  // Row 4
  { id: 'assassination-barrage', name: 'Assassin Barrage', description: '5 fast strikes',
    energyCost: 35, baseDamage: 30, type: 'physical', scaleStat: 'dexterity', cooldown: 8, currentCooldown: 0, hits: 5, unlockLevel: 50 },
  { id: 'perfect-kill-setup', name: 'Perfect Kill', description: 'Crit damage +40%',
    energyCost: 28, baseDamage: 8, type: 'special', scaleStat: 'support', cooldown: 8, currentCooldown: 0, effect: 'crit_buff', unlockLevel: 50 },
  { id: 'final-escape-heal', name: 'Final Escape', description: 'Heal 35% Max HP + SUP×4',
    energyCost: 35, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 10, currentCooldown: 0, effect: 'heal', healPercent: 35, unlockLevel: 50 },
];

// --- 8. DEMOLISHER (SUP / STR) ---
const demolisherAbilities: Ability[] = [
  // Row 1
  { id: 'mini-rocket', name: 'Mini Rocket', description: '1 explosive hit',
    energyCost: 12, baseDamage: 80, type: 'physical', scaleStat: 'support', cooldown: 2, currentCooldown: 0, hits: 1, unlockLevel: 1 },
  { id: 'blast-shield', name: 'Blast Shield', description: 'Reduce AoE damage',
    energyCost: 14, baseDamage: 0, type: 'special', scaleStat: 'strength', cooldown: 3, currentCooldown: 0, effect: 'defense_buff', unlockLevel: 1 },
  { id: 'payload-load', name: 'Payload Load', description: 'Gain energy',
    energyCost: 0, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 3, currentCooldown: 0, effect: 'energy_recovery', unlockLevel: 1 },
  // Row 2
  { id: 'rocket-duo', name: 'Rocket Duo', description: '2 rocket hits',
    energyCost: 20, baseDamage: 55, type: 'physical', scaleStat: 'support', cooldown: 4, currentCooldown: 0, hits: 2, unlockLevel: 10 },
  { id: 'shockwave', name: 'Shockwave', description: 'Stun chance',
    energyCost: 22, baseDamage: 70, type: 'physical', scaleStat: 'strength', cooldown: 5, currentCooldown: 0, hits: 1, effect: 'stun', unlockLevel: 10 },
  { id: 'field-repair', name: 'Field Repair', description: 'Heal 10% Max HP + SUP×2',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'heal', healPercent: 10, unlockLevel: 10 },
  // Row 3
  { id: 'missile-rain', name: 'Missile Rain', description: '5 rocket hits',
    energyCost: 30, baseDamage: 28, type: 'physical', scaleStat: 'support', cooldown: 7, currentCooldown: 0, hits: 5, unlockLevel: 30 },
  { id: 'armor-shred', name: 'Armor Shred', description: 'Enemy defense −25%',
    energyCost: 24, baseDamage: 15, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'debuff_defense', unlockLevel: 30 },
  { id: 'heavy-repair', name: 'Heavy Repair', description: 'Heal 20% Max HP + SUP×3',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'heal', healPercent: 20, unlockLevel: 30 },
  // Row 4
  { id: 'total-annihilation', name: 'Total Annihil.', description: '10 rocket hits',
    energyCost: 45, baseDamage: 22, type: 'physical', scaleStat: 'support', cooldown: 10, currentCooldown: 0, hits: 10, unlockLevel: 50 },
  { id: 'payload-overdrive', name: 'Payload OD', description: '+40% rocket damage',
    energyCost: 30, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 9, currentCooldown: 0, effect: 'buff_attack', unlockLevel: 50 },
  { id: 'rebuild-systems', name: 'Rebuild Systems', description: 'Heal 35% Max HP + SUP×4',
    energyCost: 35, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 10, currentCooldown: 0, effect: 'heal', healPercent: 35, unlockLevel: 50 },
];

// --- 9. CYBER WARDEN (TECH / SUP) ---
const cyberWardenAbilities: Ability[] = [
  // Row 1
  { id: 'firewall-strike', name: 'Firewall Strike', description: '1 hit + reflect prep',
    energyCost: 12, baseDamage: 75, type: 'magical', scaleStat: 'technology', cooldown: 2, currentCooldown: 0, hits: 1, effect: 'reflect', unlockLevel: 1 },
  { id: 'protocol-shield', name: 'Protocol Shield', description: 'Reflect % tech damage',
    energyCost: 14, baseDamage: 0, type: 'special', scaleStat: 'technology', cooldown: 3, currentCooldown: 0, effect: 'reflect', unlockLevel: 1 },
  { id: 'energy-sync-cw', name: 'Energy Sync', description: 'Gain energy',
    energyCost: 0, baseDamage: 0, type: 'special', scaleStat: 'technology', cooldown: 3, currentCooldown: 0, effect: 'energy_recovery', unlockLevel: 1 },
  // Row 2
  { id: 'system-breach', name: 'System Breach', description: 'Reduce enemy resistances',
    energyCost: 20, baseDamage: 12, type: 'special', scaleStat: 'technology', cooldown: 4, currentCooldown: 0, effect: 'debuff_defense', unlockLevel: 10 },
  { id: 'data-spike', name: 'Data Spike', description: '3 tech hits',
    energyCost: 22, baseDamage: 40, type: 'magical', scaleStat: 'technology', cooldown: 4, currentCooldown: 0, hits: 3, unlockLevel: 10 },
  { id: 'restoration-patch', name: 'Restoration', description: 'Heal 10% Max HP + SUP×2',
    energyCost: 18, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 4, currentCooldown: 0, effect: 'heal', healPercent: 10, unlockLevel: 10 },
  // Row 3
  { id: 'override-lock', name: 'Override Lock', description: 'Disable enemy skill next turn',
    energyCost: 26, baseDamage: 14, type: 'magical', scaleStat: 'technology', cooldown: 6, currentCooldown: 0, effect: 'skill_disable', unlockLevel: 30 },
  { id: 'feedback-loop', name: 'Feedback Loop', description: 'Damage reflect (1 turn)',
    energyCost: 22, baseDamage: 0, type: 'special', scaleStat: 'technology', cooldown: 6, currentCooldown: 0, effect: 'reflect', unlockLevel: 30 },
  { id: 'stabilize-core', name: 'Stabilize Core', description: 'Heal 20% Max HP + SUP×3',
    energyCost: 25, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 6, currentCooldown: 0, effect: 'heal', healPercent: 20, unlockLevel: 30 },
  // Row 4
  { id: 'quantum-suppression', name: 'Quantum Suppress', description: '5 tech hits + weaken',
    energyCost: 35, baseDamage: 30, type: 'magical', scaleStat: 'technology', cooldown: 8, currentCooldown: 0, hits: 5, effect: 'debuff_defense', unlockLevel: 50 },
  { id: 'absolute-control', name: 'Absolute Control', description: 'Enemy damage −30%',
    energyCost: 30, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 8, currentCooldown: 0, effect: 'damage_taken_increase', unlockLevel: 50 },
  { id: 'system-reboot', name: 'System Reboot', description: 'Heal 35% Max HP + SUP×4',
    energyCost: 35, baseDamage: 0, type: 'special', scaleStat: 'support', cooldown: 10, currentCooldown: 0, effect: 'heal', healPercent: 35, unlockLevel: 50 },
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

// ====================== RAGE SKILLS (one per class) ======================

export const RAGE_SKILLS: Record<CharacterClass, Ability> = {
  mercenary: {
    id: 'rage-war-frenzy', name: 'War Frenzy', description: 'Heavy STR hit + 20% damage reduction (2 turns)',
    energyCost: 0, baseDamage: 50, type: 'physical', scaleStat: 'strength', cooldown: 0, currentCooldown: 0, hits: 1, effect: 'defense_buff',
  },
  'tech-mage': {
    id: 'rage-system-meltdown', name: 'System Meltdown', description: '3 tech hits + reduce enemy tech def 30% (2 turns)',
    energyCost: 0, baseDamage: 40, type: 'magical', scaleStat: 'technology', cooldown: 0, currentCooldown: 0, hits: 3, effect: 'debuff_defense',
  },
  gunner: {
    id: 'rage-full-auto', name: 'Full Auto Overdrive', description: '10 rapid gun hits + reduce enemy accuracy 20%',
    energyCost: 0, baseDamage: 18, type: 'physical', scaleStat: 'support', cooldown: 0, currentCooldown: 0, hits: 10, effect: 'debuff_defense',
  },
  blademaster: {
    id: 'rage-perfect-counter', name: 'Perfect Counter', description: 'Counter next attack and return 2x damage',
    energyCost: 0, baseDamage: 60, type: 'physical', scaleStat: 'dexterity', cooldown: 0, currentCooldown: 0, hits: 1, effect: 'defense_buff',
  },
  'tech-sentinel': {
    id: 'rage-iron-lockdown', name: 'Iron Lockdown', description: 'Stun enemy 1 turn + massive defense boost',
    energyCost: 0, baseDamage: 35, type: 'physical', scaleStat: 'strength', cooldown: 0, currentCooldown: 0, hits: 1, effect: 'stun',
  },
  tactician: {
    id: 'rage-command-authority', name: 'Command Authority', description: 'Buff all stats +25% (2 turns)',
    energyCost: 0, baseDamage: 20, type: 'special', scaleStat: 'support', cooldown: 0, currentCooldown: 0, hits: 1, effect: 'stat_buff_all',
  },
  'shadow-operative': {
    id: 'rage-death-mark', name: 'Death Mark', description: 'Mark enemy; next 3 hits deal bonus crit damage',
    energyCost: 0, baseDamage: 45, type: 'physical', scaleStat: 'dexterity', cooldown: 0, currentCooldown: 0, hits: 1, effect: 'crit_buff',
  },
  demolisher: {
    id: 'rage-apocalypse-barrage', name: 'Apocalypse Barrage', description: '5 rocket hits with defense shred',
    energyCost: 0, baseDamage: 25, type: 'physical', scaleStat: 'support', cooldown: 0, currentCooldown: 0, hits: 5, effect: 'debuff_defense',
  },
  'cyber-warden': {
    id: 'rage-total-override', name: 'Total Override', description: 'Disable enemy skills 1 turn + reflect 50% tech damage',
    energyCost: 0, baseDamage: 30, type: 'magical', scaleStat: 'technology', cooldown: 0, currentCooldown: 0, hits: 1, effect: 'skill_disable',
  },
};

export const ALL_CLASSES: CharacterClass[] = [
  'mercenary', 'tech-mage', 'gunner',
  'blademaster', 'tech-sentinel', 'tactician',
  'shadow-operative', 'demolisher', 'cyber-warden',
];

export const FREE_CLASSES: CharacterClass[] = ['mercenary', 'tech-mage', 'gunner'];
export const LEVEL_UNLOCK_CLASSES: CharacterClass[] = ['blademaster', 'tech-sentinel', 'tactician'];
export const PREMIUM_CLASSES: CharacterClass[] = ['shadow-operative', 'demolisher', 'cyber-warden'];
