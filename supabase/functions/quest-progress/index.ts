// Updates quest progress for non-combat events (talk / visit_zone / open_build).
// Also auto-accepts the player's first intro quest if they have none.
//
// POST { action: 'event', event: 'talk'|'visit_zone'|'open_build', target?: string }
// POST { action: 'auto_init' }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INTRO_QUEST_ID = 'q-init-1-report';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return j({ error: 'unauthorized' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) return j({ error: 'unauthorized' }, 401);
    const userId = ud.user.id;
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));

    if (body.action === 'auto_init') {
      const { count } = await admin.from('player_quests').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      if ((count ?? 0) === 0) {
        await admin.from('player_quests').upsert({
          user_id: userId, quest_id: INTRO_QUEST_ID, progress: {}, completed: false, claimed: false,
        }, { onConflict: 'user_id,quest_id' });
        return j({ ok: true, accepted: INTRO_QUEST_ID });
      }
      return j({ ok: true, accepted: null });
    }

    if (body.action !== 'event') return j({ error: 'invalid action' }, 400);
    const event = String(body.event ?? '');
    const target = body.target ? String(body.target) : null;
    if (!['talk', 'visit_zone', 'open_build'].includes(event)) return j({ error: 'invalid event' }, 400);

    const { data: pqs } = await admin.from('player_quests')
      .select('*').eq('user_id', userId).eq('completed', false);

    const updated: string[] = [];
    for (const pq of pqs ?? []) {
      const { data: q } = await admin.from('quests').select('objectives').eq('id', pq.quest_id).maybeSingle();
      const obj = q?.objectives ?? {};
      const objKey = obj[event] as Record<string, number> | undefined;
      if (!objKey) continue;
      const key = target ?? 'any';
      if (!(key in objKey)) continue;

      const prog = pq.progress ?? {};
      const bucket = prog[event] ?? {};
      bucket[key] = Math.min(Number(objKey[key]), (bucket[key] ?? 0) + 1);
      prog[event] = bucket;

      // Determine completion: every objective category & key must be satisfied.
      const completed = Object.entries(obj).every(([cat, val]: any) =>
        Object.entries(val as Record<string, number>).every(([k, need]) =>
          ((prog[cat] ?? {})[k] ?? 0) >= Number(need)
        )
      );

      await admin.from('player_quests').update({
        progress: prog, completed, updated_at: new Date().toISOString(),
      }).eq('id', pq.id);
      updated.push(pq.quest_id);
    }
    return j({ ok: true, updated });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
