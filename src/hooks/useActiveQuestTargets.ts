import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchPlayerQuests, fetchQuestCatalog } from '@/lib/overworld';

export interface QuestTargets {
  npcIds: Set<string>;     // NPCs to talk to or defeat
  zoneIds: Set<string>;    // Zones to travel to
  needsBuild: boolean;     // Build screen open required
}

const EMPTY: QuestTargets = { npcIds: new Set(), zoneIds: new Set(), needsBuild: false };

/**
 * Polls active (non-completed, non-claimed) quests and returns the union of
 * their objective targets so the world can highlight relevant NPCs/portals.
 */
export function useActiveQuestTargets(refreshTick = 0): QuestTargets {
  const [targets, setTargets] = useState<QuestTargets>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const [pqs, catalog] = await Promise.all([fetchPlayerQuests(u.user.id), fetchQuestCatalog()]);
      // Highlight only the active (in-progress) quests' un-met objectives.
      const npcIds = new Set<string>();
      const zoneIds = new Set<string>();
      let needsBuild = false;
      for (const pq of pqs) {
        if (pq.completed) continue;
        const q = catalog[pq.quest_id];
        if (!q) continue;
        const obj = (q.objectives ?? {}) as Record<string, Record<string, number>>;
        const prog = (pq.progress ?? {}) as Record<string, Record<string, number>>;
        for (const [kind, val] of Object.entries(obj)) {
          for (const [key, need] of Object.entries(val)) {
            const cur = prog?.[kind]?.[key] ?? 0;
            if (cur >= Number(need)) continue;
            if (kind === 'talk' || kind === 'defeat') npcIds.add(key);
            else if (kind === 'visit_zone') zoneIds.add(key);
            else if (kind === 'open_build') needsBuild = true;
          }
        }
      }
      if (!cancelled) setTargets({ npcIds, zoneIds, needsBuild });
    };
    load();
    const t = setInterval(load, 2500);
    return () => { cancelled = true; clearInterval(t); };
  }, [refreshTick]);

  return targets;
}
