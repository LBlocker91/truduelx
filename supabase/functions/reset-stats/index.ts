// Reset all manually allocated stat points for 100 Aetherium (DB column: vibranium).
// Refunds stat_allocations back to stat_points, removes the allocated stats,
// and zeros stat_allocations. Preserves level/XP/credits/inventory/skills.
// POST { characterId }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESET_COST = 100;
const ATTR_KEYS = ['strength', 'dexterity', 'technology', 'support', 'defense', 'resistance'] as const;
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
    if (!characterId) return j({ error: 'invalid input' }, 400);

    const admin = createClient(url, service);
    const { data: ch } = await admin.from('characters').select('*').eq('id', characterId).maybeSingle();
    if (!ch || ch.user_id !== ud.user.id) return j({ error: 'not your character' }, 403);
    if ((ch.vibranium ?? 0) < RESET_COST) return j({ error: `Need ${RESET_COST} Aetherium to reset` }, 400);

    const allocs = (ch.stat_allocations ?? {}) as Record<string, number>;
    let refund = 0;
    const updates: Record<string, any> = {
      vibranium: (ch.vibranium ?? 0) - RESET_COST,
      stat_allocations: { strength: 0, dexterity: 0, technology: 0, support: 0, defense: 0, resistance: 0, max_hp: 0, max_energy: 0 },
    };

    for (const k of ATTR_KEYS) {
      const v = Number(allocs[k] ?? 0);
      if (v > 0) {
        updates[k] = Math.max(0, (ch[k] ?? 0) - v);
        refund += v;
      }
    }
    const hpAlloc = Number(allocs.max_hp ?? 0);
    const mpAlloc = Number(allocs.max_energy ?? 0);
    if (hpAlloc > 0) {
      updates.bonus_max_hp = Math.max(0, (ch.bonus_max_hp ?? 0) - hpAlloc * HP_GAIN);
      refund += hpAlloc;
    }
    if (mpAlloc > 0) {
      updates.bonus_max_mp = Math.max(0, (ch.bonus_max_mp ?? 0) - mpAlloc * MP_GAIN);
      refund += mpAlloc;
    }
    updates.stat_points = (ch.stat_points ?? 0) + refund;

    const { data: updated, error } = await admin.from('characters')
      .update(updates).eq('id', characterId).select('*').single();
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true, character: updated, refunded: refund, cost: RESET_COST });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
