// Upgrade an inventory item by +1, charging credits (and diamonds for high-tier mythical).
// POST { characterId, inventoryId }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RARITY_MAX: Record<string, number> = {
  common: 3, uncommon: 5, rare: 7, epic: 10, legendary: 14, mythical: 20,
};
const RARITY_BASE_COST: Record<string, number> = {
  common: 50, uncommon: 100, rare: 250, epic: 600, legendary: 1500, mythical: 4000,
};

function upgradeCost(rarity: string, nextLevel: number) {
  const base = RARITY_BASE_COST[rarity] ?? 50;
  const credits = Math.floor(base * Math.pow(nextLevel + 1, 1.6));
  const diamonds = rarity === 'mythical' && nextLevel >= 10 ? Math.ceil((nextLevel - 9) * 5) : 0;
  return { credits, diamonds };
}

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
    const inventoryId = String(body.inventoryId ?? '');
    if (!characterId || !inventoryId) return j({ error: 'invalid input' }, 400);

    const admin = createClient(url, service);
    const { data: ch } = await admin.from('characters')
      .select('id, user_id, credits, vibranium').eq('id', characterId).maybeSingle();
    if (!ch || ch.user_id !== ud.user.id) return j({ error: 'not your character' }, 403);

    const { data: row } = await admin.from('inventory')
      .select('id, character_id, upgrade_level, items(id, rarity, consumable, slot)')
      .eq('id', inventoryId).maybeSingle();
    if (!row || row.character_id !== characterId) return j({ error: 'item not found' }, 404);
    const it = (row as any).items;
    if (!it) return j({ error: 'item missing' }, 404);
    if (it.consumable) return j({ error: 'consumables cannot be upgraded' }, 400);

    const cur = Number(row.upgrade_level ?? 0);
    const max = RARITY_MAX[it.rarity] ?? 3;
    if (cur >= max) return j({ error: 'already max upgrade for this rarity' }, 400);

    const cost = upgradeCost(it.rarity, cur);
    if ((ch.credits ?? 0) < cost.credits) return j({ error: 'not enough credits' }, 400);
    if (cost.diamonds > 0 && (ch.vibranium ?? 0) < cost.diamonds) return j({ error: 'not enough diamonds' }, 400);

    await admin.from('inventory').update({ upgrade_level: cur + 1 }).eq('id', inventoryId);
    const { data: updated, error } = await admin.from('characters').update({
      credits: (ch.credits ?? 0) - cost.credits,
      vibranium: (ch.vibranium ?? 0) - cost.diamonds,
    }).eq('id', characterId).select('*').single();
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true, newLevel: cur + 1, cost, character: updated });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
