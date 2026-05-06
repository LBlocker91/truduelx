// Matchmaking: join queue, leave queue, attempt-pair
// POST { action: 'join'|'leave'|'tick', characterId? }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { calcMaxHp, CharacterSnapshot } from '../_shared/combat.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonRes({ error: 'unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return jsonRes({ error: 'unauthorized' }, 401);

    const admin = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === 'leave') {
      await admin.from('matchmaking_queue').delete().eq('user_id', user.id);
      return jsonRes({ ok: true });
    }

    if (action === 'join') {
      const characterId = body.characterId;
      if (!characterId) return jsonRes({ error: 'characterId required' }, 400);
      const { data: char } = await admin.from('characters').select('*').eq('id', characterId).eq('user_id', user.id).maybeSingle();
      if (!char) return jsonRes({ error: 'character not found' }, 404);
      const { data: profile } = await admin.from('profiles').select('elo_rating').eq('user_id', user.id).maybeSingle();
      await admin.from('matchmaking_queue').upsert({
        user_id: user.id,
        character_id: characterId,
        mmr: profile?.elo_rating ?? 1000,
      }, { onConflict: 'user_id' });
    }

    // Try to pair (called after join, or via tick polling)
    const { data: queue } = await admin.from('matchmaking_queue').select('*').order('joined_at', { ascending: true }).limit(20);
    if (!queue || queue.length < 2) {
      return jsonRes({ ok: true, paired: false });
    }

    // Pair the requesting user with the closest MMR opponent if they're in queue
    const me = queue.find(q => q.user_id === user.id);
    if (!me) return jsonRes({ ok: true, paired: false });

    let opponent = null;
    let bestDiff = Infinity;
    for (const q of queue) {
      if (q.user_id === user.id) continue;
      const diff = Math.abs(q.mmr - me.mmr);
      if (diff < bestDiff) { bestDiff = diff; opponent = q; }
    }
    if (!opponent) return jsonRes({ ok: true, paired: false });

    // Build snapshots for both
    const [meSnap, oppSnap] = await Promise.all([
      buildSnapshot(admin, me.character_id, user.id),
      buildSnapshot(admin, opponent.character_id, opponent.user_id),
    ]);
    if (!meSnap || !oppSnap) return jsonRes({ error: 'snapshot failed' }, 500);

    // Create battle
    const { data: battle, error: bErr } = await admin.from('battles').insert({
      mode: 'pvp',
      status: 'active',
      turn_number: 1,
      turn_deadline: new Date(Date.now() + 10000).toISOString(),
    }).select().single();
    if (bErr || !battle) return jsonRes({ error: bErr?.message ?? 'battle insert failed' }, 500);

    const meHp = calcMaxHp(meSnap.strength, meSnap.level);
    const oppHp = calcMaxHp(oppSnap.strength, oppSnap.level);
    const meEnergy = 100;
    const oppEnergy = 100;

    const { data: parts } = await admin.from('battle_participants').insert([
      { battle_id: battle.id, user_id: user.id, character_id: me.character_id, slot: 0,
        hp: meHp, max_hp: meHp, energy: meEnergy, max_energy: meEnergy,
        snapshot: { ...meSnap, max_hp: meHp } },
      { battle_id: battle.id, user_id: opponent.user_id, character_id: opponent.character_id, slot: 1,
        hp: oppHp, max_hp: oppHp, energy: oppEnergy, max_energy: oppEnergy,
        snapshot: { ...oppSnap, max_hp: oppHp } },
    ]).select();

    // Whoever has higher dex goes first, else slot 0
    const firstSlot = oppSnap.dexterity > meSnap.dexterity ? 1 : 0;
    const firstUser = firstSlot === 0 ? user.id : opponent.user_id;
    await admin.from('battles').update({ current_turn: firstUser }).eq('id', battle.id);

    // Remove both from queue
    await admin.from('matchmaking_queue').delete().in('user_id', [user.id, opponent.user_id]);

    return jsonRes({ ok: true, paired: true, battleId: battle.id });
  } catch (e) {
    console.error(e);
    return jsonRes({ error: String(e) }, 500);
  }
});

async function buildSnapshot(admin: any, characterId: string, userId: string): Promise<CharacterSnapshot | null> {
  const { data: char } = await admin.from('characters').select('*').eq('id', characterId).maybeSingle();
  if (!char) return null;
  // Get equipped weapon
  const { data: inv } = await admin.from('inventory').select('item_id, items(*)').eq('character_id', characterId).eq('equipped', true);
  let weaponMin = 80, weaponMax = 100, defense = 0;
  let strBonus = 0, dexBonus = 0, techBonus = 0, supBonus = 0;
  for (const row of inv ?? []) {
    const it = (row as any).items;
    if (!it) continue;
    if (it.slot === 'weapon' && it.min_damage && it.max_damage) {
      weaponMin = it.min_damage; weaponMax = it.max_damage;
    }
    defense += it.defense ?? 0;
    const m = it.stat_modifiers ?? {};
    strBonus += m.strength ?? 0;
    dexBonus += m.dexterity ?? 0;
    techBonus += m.technology ?? 0;
    supBonus += m.support ?? 0;
  }
  return {
    user_id: userId,
    character_id: characterId,
    name: char.name,
    class: char.class,
    level: char.level,
    strength: char.strength + strBonus,
    dexterity: char.dexterity + dexBonus,
    technology: char.technology + techBonus,
    support: char.support + supBonus,
    weapon_min: weaponMin,
    weapon_max: weaponMax,
    defense,
    skill_levels: char.skill_levels ?? {},
  };
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
