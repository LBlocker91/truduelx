// Overworld presence: heartbeat the current player's position and fetch
// nearby players in the same zone.
//
// POST { action: 'heartbeat', zoneId, x, y, facing, characterId? }
// POST { action: 'nearby', zoneId }
// POST { action: 'enter', zoneId }      // teleport to zone spawn
// POST { action: 'set_battle', inBattle: boolean }

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
    const body = await req.json().catch(() => ({}));

    if (body.action === 'enter') {
      const { data: zone } = await admin.from('zones').select('*').eq('id', body.zoneId).maybeSingle();
      if (!zone) return j({ error: 'zone not found' }, 404);
      const { data: profile } = await admin.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle();
      const { data: char } = await admin.from('characters').select('class, level').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      await admin.from('player_state').upsert({
        user_id: user.id,
        zone_id: body.zoneId,
        x_position: zone.spawn_x,
        y_position: zone.spawn_y,
        facing: 'down',
        is_in_battle: false,
        display_name: profile?.display_name ?? 'Pilot',
        character_class: char?.class ?? null,
        character_level: char?.level ?? 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      return j({ ok: true, zone });
    }

    if (body.action === 'heartbeat') {
      await admin.from('player_state').upsert({
        user_id: user.id,
        zone_id: body.zoneId,
        x_position: Math.floor(body.x),
        y_position: Math.floor(body.y),
        facing: body.facing ?? 'down',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      return j({ ok: true });
    }

    if (body.action === 'set_battle') {
      await admin.from('player_state').update({
        is_in_battle: !!body.inBattle,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      return j({ ok: true });
    }

    if (body.action === 'nearby') {
      const { data, error } = await admin.rpc('get_zone_players', { _zone_id: body.zoneId });
      if (error) return j({ error: error.message }, 500);
      const others = (data ?? []).filter((p: any) => p.user_id !== user.id);
      return j({ ok: true, players: others });
    }

    return j({ error: 'invalid action' }, 400);
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
