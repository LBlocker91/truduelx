// Sync a local character into the DB. Creates a profile + character row for the
// authenticated (anonymous or signed-in) user. Used to onboard local PvE players into PvP.
// POST { name, class, level, xp, statPoints, skillPoints, strength, dexterity, technology, support, skillLevels }

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
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return j({ error: 'unauthorized' }, 401);

    const admin = createClient(url, service);
    const body = await req.json();

    // Ensure profile exists (the trigger should have created it, but double-check)
    await admin.from('profiles').upsert({
      user_id: user.id,
      display_name: body.name ?? `Pilot-${user.id.slice(0,6)}`,
      is_anonymous: !!user.is_anonymous,
    }, { onConflict: 'user_id' });

    // Find existing character or create
    const { data: existing } = await admin.from('characters').select('id').eq('user_id', user.id).maybeSingle();

    const payload = {
      user_id: user.id,
      name: body.name,
      class: body.class,
      level: body.level ?? 1,
      xp: body.xp ?? 0,
      stat_points: body.statPoints ?? 0,
      skill_points: body.skillPoints ?? 0,
      strength: body.strength ?? 10,
      dexterity: body.dexterity ?? 10,
      technology: body.technology ?? 10,
      support: body.support ?? 10,
      skill_levels: body.skillLevels ?? {},
    };

    if (existing) {
      const { data, error } = await admin.from('characters').update(payload).eq('id', existing.id).select().single();
      if (error) return j({ error: error.message }, 500);
      return j({ ok: true, character: data });
    }
    const { data, error } = await admin.from('characters').insert(payload).select().single();
    if (error) return j({ error: error.message }, 500);

    // Auto-equip a starter weapon if none equipped
    const { data: equipped } = await admin.from('inventory').select('id').eq('character_id', data.id).eq('equipped', true).limit(1);
    if (!equipped || equipped.length === 0) {
      const { data: weapon } = await admin.from('items').select('id').eq('slot','weapon').eq('rarity','common').limit(1).maybeSingle();
      if (weapon) {
        await admin.from('inventory').insert({ character_id: data.id, item_id: weapon.id, equipped: true });
      }
    }
    return j({ ok: true, character: data });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
