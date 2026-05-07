import { supabase } from '@/integrations/supabase/client';

export interface InventoryItem {
  id: string; // inventory row id
  item_id: string;
  equipped: boolean;
  quantity: number;
  acquired_at: string;
  item: {
    id: string;
    name: string;
    description: string | null;
    slot: 'weapon' | 'gun' | 'launcher' | 'armor' | 'helmet' | 'gloves' | 'boots' | 'accessory' | 'consumable' | 'wings' | 'pet';
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    level_req: number;
    min_damage: number | null;
    max_damage: number | null;
    defense: number;
    sprite_layer: string | null;
    sprite_variant: string | null;
    stat_modifiers: Record<string, number>;
    consumable: boolean;
    subtype: string | null;
    weapon_subtype?: string | null;
    damage_type?: string | null;
  };
}

/** All inventory rows for a character including their item details. */
export async function fetchInventory(characterId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      id, item_id, equipped, quantity, acquired_at,
      item:items(*)
    `)
    .eq('character_id', characterId)
    .order('acquired_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

const SLOT_COLUMN: Record<string, string> = {
  weapon: 'equipped_weapon_id',
  gun: 'equipped_gun_id',
  launcher: 'equipped_launcher_id',
  staff: 'equipped_staff_id',
  armor: 'equipped_armor_id',
  wings: 'equipped_wings_id',
  pet: 'equipped_pet_id',
};

/** Equip an item: unequip any other item in the same slot, then equip this one. */
export async function equipItem(characterId: string, inventoryId: string, itemId: string, slot: string) {
  const { data: rows } = await supabase
    .from('inventory')
    .select('id, item:items(slot)')
    .eq('character_id', characterId)
    .eq('equipped', true);
  const sameSlotIds = (rows ?? [])
    .filter((r: any) => r.item?.slot === slot)
    .map((r: any) => r.id);
  if (sameSlotIds.length) {
    await supabase.from('inventory').update({ equipped: false }).in('id', sameSlotIds);
  }
  await supabase.from('inventory').update({ equipped: true }).eq('id', inventoryId);

  const col = SLOT_COLUMN[slot];
  if (col) await supabase.from('characters').update({ [col]: itemId } as any).eq('id', characterId);
}

export async function unequipItem(characterId: string, inventoryId: string, slot: string) {
  await supabase.from('inventory').update({ equipped: false }).eq('id', inventoryId);
  const col = SLOT_COLUMN[slot];
  if (col) await supabase.from('characters').update({ [col]: null } as any).eq('id', characterId);
}
