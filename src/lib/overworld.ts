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
  equipped_armor_variant?: string | null;
  equipped_weapon_variant?: string | null;
}

export interface EquippedLoadout {
  armorVariant: string | null;
  weaponVariant: string | null;
}

export async function fetchMyLoadout(characterId: string): Promise<EquippedLoadout> {
  const { data: ch } = await supabase
    .from('characters')
    .select('equipped_armor_id, equipped_weapon_id')
    .eq('id', characterId)
    .maybeSingle();
  if (!ch) return { armorVariant: null, weaponVariant: null };
  const ids = [ch.equipped_armor_id, ch.equipped_weapon_id].filter(Boolean) as string[];
  if (ids.length === 0) return { armorVariant: null, weaponVariant: null };
  const { data: items } = await supabase
    .from('items')
    .select('id, sprite_layer, sprite_variant')
    .in('id', ids);
  let armorVariant: string | null = null;
  let weaponVariant: string | null = null;
  for (const it of items ?? []) {
    if (it.sprite_layer === 'armor') armorVariant = it.sprite_variant ?? null;
    if (it.sprite_layer === 'weapon') weaponVariant = it.sprite_variant ?? null;
  }
  return { armorVariant, weaponVariant };
}

export async function publishLoadout(loadout: EquippedLoadout) {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return;
  await supabase.from('player_state').update({
    equipped_armor_variant: loadout.armorVariant,
    equipped_weapon_variant: loadout.weaponVariant,
  }).eq('user_id', u.user.id);
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

export async function claimQuestReward(characterId: string, questId: string) {
  const { data, error } = await supabase.functions.invoke('claim-quest-reward', {
    body: { characterId, questId },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'claim failed');
  return data;
}

export type SpendableStat = 'strength'|'dexterity'|'technology'|'support'|'defense'|'resistance'|'max_hp'|'max_energy';

export async function spendStatPoint(characterId: string, stat: SpendableStat) {
  const { data, error } = await supabase.functions.invoke('spend-stat-point', {
    body: { characterId, stat },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'spend failed');
  return data;
}

export type StatAllocations = Partial<Record<SpendableStat, number>>;

export async function allocateStatPoints(characterId: string, allocations: StatAllocations) {
  const { data, error } = await supabase.functions.invoke('allocate-stat-points', {
    body: { characterId, allocations },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'allocation failed');
  return data;
}

export async function resetStats(characterId: string) {
  const { data, error } = await supabase.functions.invoke('reset-stats', {
    body: { characterId },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'reset failed');
  return data;
}

export async function buyVendorItem(characterId: string, vendorItemId: string, quantity = 1) {
  const { data, error } = await supabase.functions.invoke('buy-item', {
    body: { characterId, vendorItemId, quantity },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'purchase failed');
  return data;
}

export async function unlockClassSkill(characterId: string, skillSlug: string) {
  const { data, error } = await supabase.functions.invoke('unlock-skill', {
    body: { characterId, skillSlug },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'unlock failed');
  return data;
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
  playerAction: 'attack' | 'defend' | 'forfeit' | 'skill' | 'use_item' | 'tick',
  skillSlug?: string,
  itemSubtype?: 'hp_potion' | 'mp_potion',
  weaponSlot?: 'melee' | 'gun' | 'launcher' | 'pet',
) {
  const { data, error } = await supabase.functions.invoke('npc-battle', {
    body: { action: 'act', battleId, playerAction, skillSlug, itemSubtype, weaponSlot },
  });
  if (error) {
    // Edge function returned non-2xx — try to extract structured error from context
    try {
      const ctx: any = (error as any).context;
      if (ctx?.body) {
        const text = typeof ctx.body === 'string' ? ctx.body : await new Response(ctx.body).text();
        const parsed = JSON.parse(text);
        if (parsed?.error) return { error: parsed.error };
      }
    } catch {}
    return { error: (error as any).message ?? 'request failed' };
  }
  return data;
}
