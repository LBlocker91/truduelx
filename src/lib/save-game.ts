import { Character, CharacterClass } from '@/types/game';

const SAVE_KEY = 'cosmic-duel-save';

export interface SaveData {
  player: Character;
  unlockedPremiumClasses: CharacterClass[];
  savedAt: number;
}

export function saveGame(player: Character, unlockedPremiumClasses: CharacterClass[]): void {
  const data: SaveData = {
    player,
    unlockedPremiumClasses,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save game:', e);
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    // Basic validation
    if (!data.player || !data.player.id || !data.player.class) return null;
    return data;
  } catch (e) {
    console.warn('Failed to load game:', e);
    return null;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
