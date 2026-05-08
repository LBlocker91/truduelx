import { supabase } from '@/integrations/supabase/client';
import type { Character, CharacterClass } from '@/types/game';
import { createCharacter } from '@/data/characters';
import { calcMaxHealth, xpForLevel } from '@/lib/leveling';

const LEGACY_SAVE_KEY = 'cosmic-duel-save';
const LAST_PLAYED_KEY = 'cosmic-duel-last-character-id';

export interface CharacterSummary {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  xp: number;
  credits: number;
  current_zone_id: string | null;
  updated_at: string;
}

/** List all characters owned by the current user, newest-modified first. */
export async function listMyCharacters(): Promise<CharacterSummary[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return [];
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, class, level, xp, credits, current_zone_id, updated_at')
    .eq('user_id', u.user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CharacterSummary[];
}

export async function getMaxSlots(): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return 3;
  const { data } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('user_id', u.user.id)
    .maybeSingle();
  return data?.is_premium ? 9 : 3;
}

/** Convert a DB row into the in-memory Character (loads inventory + equipped). */
export async function loadCharacter(characterId: string): Promise<Character | null> {
  const { data: row, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  // Build a base character from class then overlay DB stats
  const base = createCharacter(row.class as CharacterClass, row.name, row.id);
  const strength = row.strength ?? base.stats.strength;
  const dexterity = row.dexterity ?? base.stats.dexterity;
  const technology = row.technology ?? base.stats.technology;
  const support = row.support ?? base.stats.support;
  const level = row.level ?? 1;
  const maxHealth = calcMaxHealth(strength, level);

  const character: Character = {
    ...base,
    id: row.id,
    name: row.name,
    class: row.class as CharacterClass,
    level,
    xp: row.xp ?? 0,
    xpToNext: xpForLevel(level),
    statPoints: row.stat_points ?? 0,
    skillPoints: row.skill_points ?? 0,
    abilityLevels: (row.skill_levels as Record<string, number>) ?? {},
    stats: {
      health: maxHealth,
      maxHealth,
      energy: base.stats.maxEnergy,
      maxEnergy: base.stats.maxEnergy,
      strength,
      dexterity,
      technology,
      support,
    },
  };
  return character;
}

/** Create a new character row for the current user. Returns the new id. */
export async function createNewCharacter(
  classType: CharacterClass,
  name: string,
): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) throw new Error('Not signed in');
  const tmp = createCharacter(classType, name);
  const { data, error } = await supabase
    .from('characters')
    .insert({
      user_id: u.user.id,
      name: tmp.name,
      class: tmp.class,
      level: 1,
      xp: 0,
      strength: tmp.stats.strength,
      dexterity: tmp.stats.dexterity,
      technology: tmp.stats.technology,
      support: tmp.stats.support,
      stat_points: 0,
      skill_points: 0,
      skill_levels: {},
      credits: 0,
    })
    .select('id')
    .single();
  if (error) throw error;
  const newId = data.id as string;
  await grantStarterGear(newId);
  return newId;
}

/** Grant a starter weapon, gun, and armor to a new character and equip them. */
async function grantStarterGear(characterId: string) {
  const { data: items } = await supabase
    .from('items')
    .select('id, slot')
    .in('slot', ['weapon', 'gun', 'armor'])
    .eq('rarity', 'common')
    .lte('level_req', 1);
  if (!items || items.length === 0) return;
  const bySlot: Record<string, string> = {};
  for (const it of items as any[]) {
    if (!bySlot[it.slot]) bySlot[it.slot] = it.id;
  }
  const slotCol: Record<string, string> = {
    weapon: 'equipped_weapon_id',
    gun: 'equipped_gun_id',
    armor: 'equipped_armor_id',
  };
  const updates: Record<string, string> = {};
  for (const slot of Object.keys(bySlot)) {
    const itemId = bySlot[slot];
    await supabase.from('inventory').insert({ character_id: characterId, item_id: itemId, equipped: true });
    if (slotCol[slot]) updates[slotCol[slot]] = itemId;
  }
  if (Object.keys(updates).length) {
    await supabase.from('characters').update(updates as any).eq('id', characterId);
  }
}

export async function deleteCharacter(characterId: string): Promise<void> {
  const { error } = await supabase.from('characters').delete().eq('id', characterId);
  if (error) throw error;
}

/** Persist progress (XP/level/stats) for a character. */
export async function persistCharacter(c: Character): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .update({
      level: c.level,
      xp: c.xp,
      strength: c.stats.strength,
      dexterity: c.stats.dexterity,
      technology: c.stats.technology,
      support: c.stats.support,
      stat_points: c.statPoints,
      skill_points: c.skillPoints,
      skill_levels: c.abilityLevels,
    })
    .eq('id', c.id);
  if (error) throw error;
}

/** Migrate an old localStorage-only save into a DB row, once per account. */
export async function migrateLegacySaveIfAny(): Promise<string | null> {
  const raw = (() => {
    try { return localStorage.getItem(LEGACY_SAVE_KEY); } catch { return null; }
  })();
  if (!raw) return null;
  const existing = await listMyCharacters();
  if (existing.length > 0) return null; // already migrated or has fresh chars

  try {
    const parsed = JSON.parse(raw);
    const p = parsed?.player;
    if (!p?.class || !p?.name) return null;
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return null;

    const { data, error } = await supabase
      .from('characters')
      .insert({
        user_id: u.user.id,
        name: p.name,
        class: p.class,
        level: p.level ?? 1,
        xp: p.xp ?? 0,
        strength: p.stats?.strength ?? 10,
        dexterity: p.stats?.dexterity ?? 10,
        technology: p.stats?.technology ?? 10,
        support: p.stats?.support ?? 10,
        stat_points: p.statPoints ?? 0,
        skill_points: p.skillPoints ?? 0,
        skill_levels: p.abilityLevels ?? {},
        credits: 0,
      })
      .select('id')
      .single();
    if (error) throw error;
    // Mark legacy save as migrated by clearing it
    localStorage.removeItem(LEGACY_SAVE_KEY);
    return data.id as string;
  } catch (e) {
    console.warn('Legacy save migration failed; leaving save intact', e);
    return null;
  }
}

export function setLastPlayed(characterId: string) {
  try { localStorage.setItem(LAST_PLAYED_KEY, characterId); } catch {}
}
export function getLastPlayed(): string | null {
  try { return localStorage.getItem(LAST_PLAYED_KEY); } catch { return null; }
}
