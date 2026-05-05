// Unlock a class skill for a character. Validates ownership, class, level, and points.
// POST { characterId, skillSlug }
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
    const skillSlug = String(body.skillSlug ?? '');
    if (!characterId || !skillSlug) return j({ error: 'invalid input' }, 400);

    const admin = createClient(url, service);
    const { data: ch } = await admin.from('characters').select('*').eq('id', characterId).maybeSingle();
    if (!ch || ch.user_id !== ud.user.id) return j({ error: 'not your character' }, 403);
    if ((ch.skill_points ?? 0) <= 0) return j({ error: 'no skill points' }, 400);

    const { data: skill } = await admin.from('skills').select('*').eq('slug', skillSlug).maybeSingle();
    if (!skill) return j({ error: 'skill not found' }, 404);
    if (skill.class !== ch.class) return j({ error: 'wrong class' }, 400);
    if ((ch.level ?? 1) < (skill.unlock_level ?? 1)) return j({ error: 'level too low' }, 400);

    // Already unlocked?
    const sl = (ch.skill_levels ?? {}) as Record<string, number>;
    if ((sl[skillSlug] ?? 0) >= 1) return j({ error: 'already unlocked' }, 400);
    sl[skillSlug] = 1;

    // Persist on characters.skill_levels (used by combat) AND in character_skills (audit)
    await admin.from('character_skills')
      .insert({ character_id: characterId, skill_slug: skillSlug, rank: 1 })
      .then(() => {}, () => {}); // ignore duplicate insert race

    const { data: updated, error } = await admin.from('characters').update({
      skill_points: (ch.skill_points ?? 0) - 1,
      skill_levels: sl,
    }).eq('id', characterId).select('*').single();
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true, character: updated, skill });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
