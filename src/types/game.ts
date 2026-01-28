export type CharacterClass = 'warrior' | 'mage' | 'hunter';

export interface CharacterStats {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  damage: number;
  type: 'physical' | 'magical' | 'special';
  cooldown: number;
  currentCooldown: number;
}

export interface Character {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  stats: CharacterStats;
  abilities: Ability[];
  image: string;
}

export interface BattleState {
  player: Character;
  enemy: Character;
  turn: 'player' | 'enemy';
  combatLog: string[];
  isAnimating: boolean;
  battleOver: boolean;
  winner: 'player' | 'enemy' | null;
}

export interface GameState {
  screen: 'title' | 'character-select' | 'battle' | 'victory' | 'defeat';
  player: Character | null;
  enemy: Character | null;
  battleState: BattleState | null;
}
