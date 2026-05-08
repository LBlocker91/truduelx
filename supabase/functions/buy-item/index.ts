// Purchase a vendor item OR a premium (diamond-priced) item directly from the catalog.
// POST { characterId, vendorItemId?, itemId?, quantity?, currency? ('credits' | 'diamonds') }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const vendorItemId = body.vendorItemId ? String(body.vendorItemId) : '';
    const directItemId = body.itemId ? String(body.itemId) : '';
    const currency = (body.currency === 'diamonds' ? 'diamonds' : 'credits') as 'credits' | 'diamonds';
    const quantity = Math.max(1, Math.min(99, Number(body.quantity ?? 1) | 0));
    if (!characterId || (!vendorItemId && !directItemId)) return j({ error: 'invalid input' }, 400);

    const admin = createClient(url, service);
    const { data: ch } = await admin.from('characters').select('*').eq('id', characterId).maybeSingle();
    if (!ch || ch.user_id !== ud.user.id) return j({ error: 'not your character' }, 403);

    let item: any = null;
    let unitCost = 0;
    let payCurrency: 'credits' | 'diamonds' = currency;

    if (vendorItemId) {
      const { data: vi } = await admin.from('vendor_items').select('*, items(*)').eq('id', vendorItemId).maybeSingle();
      if (!vi || !vi.items) return j({ error: 'vendor item not found' }, 404);
      item = vi.items;
      unitCost = vi.price;
      payCurrency = 'credits';
    } else {
      const { data: it } = await admin.from('items').select('*').eq('id', directItemId).maybeSingle();
      if (!it) return j({ error: 'item not found' }, 404);
      if (!it.is_premium) return j({ error: 'item is not directly purchasable' }, 400);
      item = it;
      unitCost = it.price_diamonds ?? 0;
      payCurrency = 'diamonds';
      if (unitCost <= 0) return j({ error: 'item has no price' }, 400);
    }

    const totalCost = unitCost * quantity;
    if (payCurrency === 'credits' && (ch.credits ?? 0) < totalCost) return j({ error: 'not enough credits' }, 400);
    if (payCurrency === 'diamonds' && (ch.vibranium ?? 0) < totalCost) return j({ error: 'not enough diamonds' }, 400);

    if (item.consumable) {
      const { data: existing } = await admin.from('inventory')
        .select('id, quantity').eq('character_id', characterId).eq('item_id', item.id).maybeSingle();
      if (existing) {
        await admin.from('inventory').update({ quantity: (existing.quantity ?? 1) + quantity }).eq('id', existing.id);
      } else {
        await admin.from('inventory').insert({ character_id: characterId, item_id: item.id, quantity, equipped: false });
      }
    } else {
      const rows = Array.from({ length: quantity }, () => ({ character_id: characterId, item_id: item.id, quantity: 1, equipped: false }));
      await admin.from('inventory').insert(rows);
    }

    const updates: any = {};
    if (payCurrency === 'credits') updates.credits = (ch.credits ?? 0) - totalCost;
    else updates.vibranium = (ch.vibranium ?? 0) - totalCost;
    const { data: updated, error } = await admin.from('characters')
      .update(updates).eq('id', characterId).select('*').single();
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true, character: updated, spent: totalCost, currency: payCurrency });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
