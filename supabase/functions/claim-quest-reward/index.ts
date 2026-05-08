// Claim a completed quest's rewards (xp / credits / skill_points).
// POST { characterId, questId }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { applyXp } from '../_shared/leveling.ts';

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
    const userId = ud.user.id;

    const body = await req.json().catch(() => ({}));
    const characterId = String(body.characterId ?? '');
    const questId = String(body.questId ?? '');
    if (!characterId || !questId) return j({ error: 'invalid input' }, 400);

    const admin = createClient(url, service);

    const { data: ch } = await admin.from('characters').select('*').eq('id', characterId).maybeSingle();
    if (!ch || ch.user_id !== userId) return j({ error: 'not your character' }, 403);

    const { data: pq } = await admin.from('player_quests')
      .select('*').eq('user_id', userId).eq('quest_id', questId).maybeSingle();
    if (!pq) return j({ error: 'quest not started' }, 404);
    if (!pq.completed) return j({ error: 'quest not complete' }, 400);
    if (pq.claimed) return j({ error: 'already claimed' }, 400);

    const { data: quest } = await admin.from('quests').select('rewards').eq('id', questId).maybeSingle();
    const rewards = quest?.rewards ?? {};
    const xpGain = Number(rewards.xp ?? 0);
    const creditsGain = Number(rewards.credits ?? 0);
    const bonusSkillPts = Number(rewards.skill_points ?? 0);

    const lvl = applyXp({
      xp: ch.xp ?? 0, level: ch.level ?? 1,
      statPoints: ch.stat_points ?? 0, skillPoints: ch.skill_points ?? 0,
      strength: ch.strength ?? 10,
    }, xpGain);

    const { data: updated, error } = await admin.from('characters').update({
      xp: lvl.xp,
      level: lvl.level,
      stat_points: lvl.statPoints,
      skill_points: lvl.skillPoints + bonusSkillPts,
      credits: (ch.credits ?? 0) + creditsGain,
    }).eq('id', characterId).select('*').single();
    if (error) return j({ error: error.message }, 500);

    await admin.from('player_quests').update({ claimed: true, updated_at: new Date().toISOString() }).eq('id', pq.id);

    // Auto-accept the next quest in a chain if the reward block specifies it.
    const nextQuestId = rewards.next_quest_id ? String(rewards.next_quest_id) : null;
    if (nextQuestId) {
      await admin.from('player_quests').upsert({
        user_id: userId, quest_id: nextQuestId, progress: {}, completed: false, claimed: false,
      }, { onConflict: 'user_id,quest_id' });
    }

    return j({
      ok: true,
      character: updated,
      rewards: { xp: xpGain, credits: creditsGain, skill_points: bonusSkillPts },
      next_quest_id: nextQuestId,
      level: {
        oldLevel: lvl.oldLevel,
        newLevel: lvl.newLevel,
        levelsGained: lvl.levelsGained,
        statPointsGained: lvl.statPointsGained,
        skillPointsGained: lvl.skillPointsGained,
        maxHpGained: lvl.maxHpGained,
      },
    });
  } catch (e) {
    console.error(e);
    return j({ error: String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
