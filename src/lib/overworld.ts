import { supabase } from '@/integrations/supabase/client';

export interface Zone {
  id: string;
  name: string;
  description: string | null;
  background_url: string | null;
  width: number;
  height: number;
  spawn_x: number;
  spawn_y: number;
}

export interface Npc {
  id: string;
  zone_id: string;
  name: string;
  type: 'vendor' | 'quest' | 'enemy';
  position_x: number;
  position_y: number;
  dialogue: string | null;
}

export interface NearbyPlayer {
  user_id: string;
  display_name: string;
  character_class: string | null;
  character_level: number;
  x_position: number;
  y_position: number;
  facing: string;
  is_in_battle: boolean;
}

export interface VendorItem {
  id: string;
  npc_id: string;
  item_id: string;
  price: number;
  items: any;
}

export interface Quest {
  id: string;
  name: string;
  description: string | null;
  giver_npc_id: string | null;
  objectives: any;
  rewards: any;
}

export interface PlayerQuest {
  id: string;
  quest_id: string;
  progress: any;
  completed: boolean;
  claimed: boolean;
}

// ---- Presence ----
export async function enterZone(zoneId: string) {
  const { data, error } = await supabase.functions.invoke('overworld-presence', {
    body: { action: 'enter', zoneId },
  });
  if (error) throw error;
  return data;
}

export async function heartbeat(zoneId: string, x: number, y: number, facing = 'down') {
  await supabase.functions.invoke('overworld-presence', {
    body: { action: 'heartbeat', zoneId, x, y, facing },
  });
}

export async function setInBattle(inBattle: boolean) {
  await supabase.functions.invoke('overworld-presence', {
    body: { action: 'set_battle', inBattle },
  });
}

export async function fetchNearbyPlayers(zoneId: string): Promise<NearbyPlayer[]> {
  const { data, error } = await supabase.functions.invoke('overworld-presence', {
    body: { action: 'nearby', zoneId },
  });
  if (error) throw error;
  return data?.players ?? [];
}

// ---- Zones / NPCs ----
export async function fetchZones(): Promise<Zone[]> {
  const { data } = await supabase.from('zones').select('*');
  return (data as any) ?? [];
}

export async function fetchNpcs(zoneId: string): Promise<Npc[]> {
  const { data } = await supabase.from('npcs').select('*').eq('zone_id', zoneId);
  return (data as any) ?? [];
}

export async function fetchVendorItems(npcId: string): Promise<VendorItem[]> {
  const { data } = await supabase.from('vendor_items').select('*, items(*)').eq('npc_id', npcId);
  return (data as any) ?? [];
}

export async function fetchQuestForNpc(npcId: string): Promise<Quest | null> {
  const { data } = await supabase.from('quests').select('*').eq('giver_npc_id', npcId).maybeSingle();
  return (data as any) ?? null;
}

export async function fetchPlayerQuests(userId: string): Promise<PlayerQuest[]> {
  const { data } = await supabase.from('player_quests').select('*').eq('user_id', userId);
  return (data as any) ?? [];
}

export async function acceptQuest(userId: string, questId: string) {
  await supabase.from('player_quests').upsert({
    user_id: userId, quest_id: questId, progress: {}, completed: false, claimed: false,
  }, { onConflict: 'user_id,quest_id' });
}

export async function claimQuestReward(playerQuestId: string, characterId: string, xpReward: number) {
  await supabase.from('player_quests').update({ claimed: true }).eq('id', playerQuestId);
  if (xpReward > 0 && characterId) {
    const { data: ch } = await supabase.from('characters').select('xp').eq('id', characterId).maybeSingle();
    if (ch) {
      await supabase.from('characters').update({ xp: (ch.xp ?? 0) + xpReward }).eq('id', characterId);
    }
  }
}

// ---- NPC Battle ----
export async function startNpcBattle(npcId: string, characterId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('npc-battle', {
    body: { action: 'start', npcId, characterId },
  });
  if (error) throw error;
  if (!data?.battleId) throw new Error(data?.error ?? 'failed to start');
  return data.battleId as string;
}

export async function submitNpcAction(
  battleId: string,
  playerAction: 'attack' | 'defend' | 'forfeit' | 'skill',
  skillSlug?: string,
) {
  const { data, error } = await supabase.functions.invoke('npc-battle', {
    body: { action: 'act', battleId, playerAction, skillSlug },
  });
  if (error) throw error;
  return data;
}
