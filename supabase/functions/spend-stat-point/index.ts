// Spend 1 stat point on an attribute. Validates ownership + available points.
// POST { characterId, stat: 'strength'|'dexterity'|'technology'|'support'|'defense'|'resistance'|'max_hp'|'max_energy' }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ATTR_STATS = new Set(['strength', 'dexterity', 'technology', 'support', 'defense', 'resistance']);
const HP_STAT = 'max_hp';
const MP_STAT = 'max_energy';
const HP_GAIN = 5;
const MP_GAIN = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return j({ error: 'unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) return j({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const characterId = String(body.characterId ?? '');
    const stat = String(body.stat ?? '');
    const valid = ATTR_STATS.has(stat) || stat === HP_STAT || stat === MP_STAT;
    if (!characterId || !valid) return j({ error: 'invalid input' }, 400);

    const admin = createClient(url, service);
    const { data: ch } = await admin.from('characters').select('*').eq('id', characterId).maybeSingle();
    if (!ch || ch.user_id !== ud.user.id) return j({ error: 'not your character' }, 403);
    if ((ch.stat_points ?? 0) <= 0) return j({ error: 'no stat points' }, 400);

    const updates: Record<string, number> = {
      stat_points: (ch.stat_points ?? 0) - 1,
    };

    if (ATTR_STATS.has(stat)) {
      updates[stat] = (ch[stat] ?? 0) + 1;
    } else if (stat === HP_STAT) {
      updates.bonus_max_hp = (ch.bonus_max_hp ?? 0) + HP_GAIN;
    } else if (stat === MP_STAT) {
      updates.bonus_max_mp = (ch.bonus_max_mp ?? 0) + MP_GAIN;
    }

    const { data: updated, error } = await admin.from('characters')
      .update(updates).eq('id', characterId).select('*').single();
    if (error) return j({ error: error.message }, 500);

    // If we increased max HP/MP and there are active battle participants for this
    // character, also bump their max & current resource by the same delta (capped).
    if (stat === HP_STAT || stat === MP_STAT) {
      const { data: parts } = await admin.from('battle_participants')
        .select('id, hp, max_hp, energy, max_energy, battle_id')
        .eq('character_id', characterId);
      const inActive = parts ?? [];
      for (const p of inActive) {
        const { data: b } = await admin.from('battles').select('status').eq('id', p.battle_id).maybeSingle();
        if (b?.status !== 'active') continue;
        if (stat === HP_STAT) {
          const newMax = p.max_hp + HP_GAIN;
          const newHp = Math.min(newMax, p.hp + HP_GAIN);
          await admin.from('battle_participants').update({ max_hp: newMax, hp: newHp }).eq('id', p.id);
        } else {
          const newMax = p.max_energy + MP_GAIN;
          const newEn = Math.min(newMax, p.energy + MP_GAIN);
          await admin.from('battle_participants').update({ max_energy: newMax, energy: newEn }).eq('id', p.id);
        }
      }
    }

    return j({ ok: true, character: updated });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
