export type CharacterClass = 'warrior' | 'mage' | 'hunter';

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

export interface Ability {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  baseDamage: number;
  type: 'physical' | 'magical' | 'special';
  scaleStat: 'strength' | 'technology' | 'support';
  cooldown: number;
  currentCooldown: number;
  effect?: 'stun' | 'dot' | 'energy_drain' | 'buff_attack' | 'debuff_defense';
}

export type BattleAction = 'attack' | 'skill' | 'defend' | 'item';

export interface Character {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  stats: CharacterStats;
  abilities: Ability[];
  image: string;
  rage: number;
  maxRage: number;
  isDefending: boolean;
  statusEffects: StatusEffect[];
}

export interface StatusEffect {
  type: 'stun' | 'dot' | 'buff_attack' | 'debuff_defense';
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
  screen: 'title' | 'character-select' | 'battle' | 'victory' | 'defeat';
  player: Character | null;
  enemy: Character | null;
  battleState: BattleState | null;
}
