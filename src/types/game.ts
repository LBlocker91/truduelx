export type CharacterClass =
  | 'mercenary' | 'tech-mage' | 'gunner'           // Free (starter)
  | 'blademaster' | 'tech-sentinel' | 'tactician'   // Unlock at Level 30
  | 'shadow-operative' | 'demolisher' | 'cyber-warden'; // Premium

export type ClassUnlockType = 'free' | 'level' | 'premium';

export interface ClassMeta {
  name: string;
  description: string;
  playstyle: string;
  primaryStats: string;
  unlockType: ClassUnlockType;
  unlockLevel?: number; // for 'level' type
  color: string; // tailwind text class
}

export interface CharacterStats {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  strength: number;
  dexterity: number;
  technology: number;
  support: number;
}

export type AbilityEffect =
  | 'stun'
  | 'dot'
  | 'energy_drain'
  | 'buff_attack'
  | 'debuff_defense'
  | 'heal'
  | 'energy_recovery'
  | 'defense_buff'
  | 'crit_buff'
  | 'damage_absorb'
  | 'damage_taken_increase'
  | 'reflect'
  | 'stat_buff_all'
  | 'skill_disable'
  | 'cooldown_increase'
  | 'dodge'
  | 'bonus_low_hp';

export interface Ability {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  baseDamage: number;
  type: 'physical' | 'magical' | 'special';
  scaleStat: 'strength' | 'technology' | 'support' | 'dexterity';
  cooldown: number;
  currentCooldown: number;
  effect?: AbilityEffect;
}

export type BattleAction = 'attack' | 'skill' | 'defend' | 'item';

export interface Character {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  xp: number;
  xpToNext: number;
  statPoints: number;
  stats: CharacterStats;
  abilities: Ability[];
  image: string;
  rage: number;
  maxRage: number;
  isDefending: boolean;
  statusEffects: StatusEffect[];
}

export interface StatusEffect {
  type: 'stun' | 'dot' | 'buff_attack' | 'debuff_defense' | 'defense_buff'
    | 'crit_buff' | 'damage_absorb' | 'damage_taken_increase' | 'reflect'
    | 'stat_buff_all' | 'skill_disable' | 'dodge';
  turnsRemaining: number;
  value: number;
}

export interface HitResult {
  damage: number;
  blocked: boolean;
  deflected: boolean;
  critical: boolean;
  rawDamage: number;
}

export interface BattleState {
  player: Character;
  enemy: Character;
  turn: 'player' | 'enemy';
  combatLog: string[];
  isAnimating: boolean;
  battleOver: boolean;
  winner: 'player' | 'enemy' | null;
  turnTimer: number;
  turnNumber: number;
}

export interface GameState {
  screen: 'title' | 'character-select' | 'battle' | 'victory' | 'defeat' | 'level-up';
  player: Character | null;
  enemy: Character | null;
  battleState: BattleState | null;
  pendingXp: number;
  unlockedPremiumClasses: CharacterClass[];
}
