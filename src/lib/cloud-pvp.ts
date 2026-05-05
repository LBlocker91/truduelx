import { supabase } from '@/integrations/supabase/client';
import type { Character } from '@/types/game';

/** Push a local character into Supabase. Returns the synced DB character row. */
export async function syncCharacterToCloud(character: Character) {
  const { data, error } = await supabase.functions.invoke('sync-character', {
    body: {
      name: character.name,
      class: character.class,
      level: character.level,
      xp: character.xp,
      statPoints: character.statPoints,
      skillPoints: character.skillPoints,
      strength: character.stats.strength,
      dexterity: character.stats.dexterity,
      technology: character.stats.technology,
      support: character.stats.support,
      skillLevels: character.abilityLevels,
    },
  });
  if (error) throw error;
  return data?.character;
}

export async function joinMatchmaking(characterId: string) {
  const { data, error } = await supabase.functions.invoke('matchmaking', {
    body: { action: 'join', characterId },
  });
  if (error) throw error;
  return data as { ok: boolean; paired: boolean; battleId?: string };
}

export async function leaveMatchmaking() {
  await supabase.functions.invoke('matchmaking', { body: { action: 'leave' } });
}

export async function pollMatchmaking() {
  const { data, error } = await supabase.functions.invoke('matchmaking', {
    body: { action: 'tick' },
  });
  if (error) throw error;
  return data as { ok: boolean; paired: boolean; battleId?: string };
}

export type BattleActionPayload =
  | { battleId: string; action: 'attack' | 'defend' | 'forfeit' }
  | { battleId: string; action: 'skill'; skillSlug: string };

export async function submitBattleAction(payload: BattleActionPayload) {
  const { data, error } = await supabase.functions.invoke('battle-action', { body: payload });
  if (error) throw error;
  return data;
}
