// Sell an inventory item back to the system for half its base value (×upgrade bonus).
// POST { characterId, inventoryId, quantity? }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RARITY_FALLBACK_VALUE: Record<string, number> = {
  common: 50, uncommon: 120, rare: 280, epic: 720, legendary: 1800, mythical: 5000,
};

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
    const quantity = Math.max(1, Math.min(99, Number(body.quantity ?? 1) | 0));
    if (!characterId || !inventoryId) return j({ error: 'invalid input' }, 400);

    const admin = createClient(url, service);
    const { data: ch } = await admin.from('characters').select('id, user_id, credits').eq('id', characterId).maybeSingle();
    if (!ch || ch.user_id !== ud.user.id) return j({ error: 'not your character' }, 403);

    const { data: row } = await admin.from('inventory')
      .select('id, character_id, equipped, quantity, upgrade_level, items(id, name, rarity, base_value, is_premium, consumable)')
      .eq('id', inventoryId).maybeSingle();
    if (!row || row.character_id !== characterId) return j({ error: 'item not found' }, 404);
    if (row.equipped) return j({ error: 'unequip first' }, 400);
    const it = (row as any).items;
    if (!it) return j({ error: 'item missing' }, 404);

    const sellQty = Math.min(quantity, row.quantity ?? 1);
    const baseVal = Number(it.base_value ?? RARITY_FALLBACK_VALUE[it.rarity] ?? 50);
    const upMult = Math.pow(1.08, Math.max(0, Number(row.upgrade_level ?? 0)));
    const refund = Math.max(1, Math.floor(baseVal * 0.5 * upMult)) * sellQty;

    const newQty = (row.quantity ?? 1) - sellQty;
    if (newQty <= 0) {
      await admin.from('inventory').delete().eq('id', inventoryId);
    } else {
      await admin.from('inventory').update({ quantity: newQty }).eq('id', inventoryId);
    }

    const { data: updated, error } = await admin.from('characters')
      .update({ credits: (ch.credits ?? 0) + refund }).eq('id', characterId).select('*').single();
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true, refund, character: updated });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
