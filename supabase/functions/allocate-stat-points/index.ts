// Batch allocate stat points across multiple targets in a single atomic call.
// POST { characterId, allocations: { strength?, dexterity?, technology?, support?,
//                                    defense?, resistance?, max_hp?, max_energy? } }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ATTR_KEYS = ['strength', 'dexterity', 'technology', 'support', 'defense', 'resistance'] as const;
const ALL_KEYS = [...ATTR_KEYS, 'max_hp', 'max_energy'] as const;
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
    const allocsRaw = body.allocations ?? {};
    if (!characterId || typeof allocsRaw !== 'object') return j({ error: 'invalid input' }, 400);

    // Sanitize: only allowed keys, only non-negative ints.
    const allocs: Record<string, number> = {};
    let total = 0;
    for (const k of ALL_KEYS) {
      const v = Number(allocsRaw[k] ?? 0);
      if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return j({ error: `invalid allocation: ${k}` }, 400);
      if (v > 0) {
        allocs[k] = v;
        total += v;
      }
    }
    if (total <= 0) return j({ error: 'no points allocated' }, 400);

    const admin = createClient(url, service);
    const { data: ch } = await admin.from('characters').select('*').eq('id', characterId).maybeSingle();
    if (!ch || ch.user_id !== ud.user.id) return j({ error: 'not your character' }, 403);
    if ((ch.stat_points ?? 0) < total) return j({ error: 'not enough stat points' }, 400);

    // Build update payload.
    const updates: Record<string, any> = { stat_points: (ch.stat_points ?? 0) - total };
    const allocsRow = (ch.stat_allocations ?? {}) as Record<string, number>;
    const newAllocsRow = { ...allocsRow };

    for (const k of ATTR_KEYS) {
      const add = allocs[k] ?? 0;
      if (add > 0) {
        updates[k] = (ch[k] ?? 0) + add;
        newAllocsRow[k] = (newAllocsRow[k] ?? 0) + add;
      }
    }
    if (allocs.max_hp) {
      updates.bonus_max_hp = (ch.bonus_max_hp ?? 0) + allocs.max_hp * HP_GAIN;
      newAllocsRow.max_hp = (newAllocsRow.max_hp ?? 0) + allocs.max_hp;
    }
    if (allocs.max_energy) {
      updates.bonus_max_mp = (ch.bonus_max_mp ?? 0) + allocs.max_energy * MP_GAIN;
      newAllocsRow.max_energy = (newAllocsRow.max_energy ?? 0) + allocs.max_energy;
    }
    updates.stat_allocations = newAllocsRow;

    const { data: updated, error } = await admin.from('characters')
      .update(updates).eq('id', characterId).select('*').single();
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true, character: updated });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
