import { useEffect, useState, useCallback } from 'react';
import { ScrollText, CheckCircle2, Circle, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchPlayerQuests, fetchQuestCatalog, claimQuestReward, autoInitIntroQuest,
  Quest, PlayerQuest,
} from '@/lib/overworld';
import type { LevelUpInfo } from '@/pages/Index';

interface QuestTrackerProps {
  characterId: string;
  /** Bumped from outside to force a poll (battle wins, build opens, etc). */
  refreshTick?: number;
  onProgressionChange?: (level?: LevelUpInfo | null) => void;
  /** Resolve display labels for objective targets — npc-id → name, zone-id → name. */
  targetLabel?: (kind: 'talk' | 'visit_zone' | 'defeat' | 'open_build', key: string) => string;
}

interface FlatObjective {
  kind: 'talk' | 'visit_zone' | 'defeat' | 'open_build';
  key: string;
  current: number;
  target: number;
  label: string;
}

export const QuestTracker = ({ characterId, refreshTick, onProgressionChange, targetLabel }: QuestTrackerProps) => {
  const [active, setActive] = useState<{ pq: PlayerQuest; q: Quest; objectives: FlatObjective[] } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    await autoInitIntroQuest();
    const [pqs, catalog] = await Promise.all([fetchPlayerQuests(u.user.id), fetchQuestCatalog()]);
    // Pick first unclaimed quest (ready-to-claim wins over in-progress).
    const ready = pqs.find(p => p.completed && !p.claimed);
    const pq = ready ?? pqs.find(p => !p.completed) ?? null;
    if (!pq) { setActive(null); return; }
    const q = catalog[pq.quest_id];
    if (!q) { setActive(null); return; }
    const flat: FlatObjective[] = [];
    const obj = (q.objectives ?? {}) as Record<string, Record<string, number>>;
    const prog = (pq.progress ?? {}) as Record<string, Record<string, number>>;
    for (const [kind, val] of Object.entries(obj)) {
      for (const [key, need] of Object.entries(val)) {
        const current = prog?.[kind]?.[key] ?? 0;
        const k = kind as FlatObjective['kind'];
        const label = targetLabel?.(k, key) ?? humanize(k, key);
        flat.push({ kind: k, key, current, target: Number(need), label });
      }
    }
    setActive({ pq, q, objectives: flat });
  }, [targetLabel]);

  useEffect(() => { load(); }, [load, characterId, refreshTick]);
  // Poll every 2.5s so combat / talk / zone events surface quickly.
  useEffect(() => {
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  const handleClaim = async () => {
    if (!active || claiming) return;
    setClaiming(true);
    try {
      const r = await claimQuestReward(characterId, active.q.id);
      const xp = r.rewards?.xp ?? 0;
      const cr = r.rewards?.credits ?? 0;
      toast.success(`Quest Complete: ${active.q.name}`, {
        description: `+${xp} XP${cr ? ` · +${cr} credits` : ''}${r.next_quest_id ? ` · New quest accepted` : ''}`,
      });
      onProgressionChange?.(r.level && r.level.levelsGained > 0 ? r.level : null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? 'claim failed');
    } finally {
      setClaiming(false);
    }
  };

  if (!active) return null;
  const ready = active.pq.completed && !active.pq.claimed;

  return (
    <div className="absolute top-3 left-3 z-30 max-w-[280px] sm:max-w-[320px] pointer-events-auto">
      <div
        className="rounded-lg border backdrop-blur shadow-[0_8px_24px_rgba(0,0,0,0.45)] overflow-hidden"
        style={{
          background: 'hsl(var(--card) / 0.92)',
          borderColor: ready ? 'hsl(140 100% 50% / 0.6)' : 'hsl(var(--primary) / 0.4)',
        }}
      >
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-primary/10 transition"
        >
          <ScrollText className={`w-3.5 h-3.5 ${ready ? 'text-neon-green' : 'text-primary'}`} />
          <span className="font-orbitron text-[10px] tracking-wider text-muted-foreground uppercase">
            {ready ? 'Ready to claim' : 'Active Quest'}
          </span>
          <ChevronRight className={`w-3 h-3 ml-auto text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        </button>
        {!collapsed && (
          <div className="px-3 pb-2.5 pt-0.5 space-y-1.5">
            <h3 className="font-orbitron text-sm leading-tight">{active.q.name}</h3>
            {active.q.description && (
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{active.q.description}</p>
            )}
            <ul className="space-y-1 mt-1.5">
              {active.objectives.map((o, i) => {
                const ok = o.current >= o.target;
                return (
                  <li key={i} className="flex items-center gap-1.5 text-[11px]">
                    {ok
                      ? <CheckCircle2 className="w-3 h-3 text-neon-green flex-shrink-0" />
                      : <Circle className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                    <span className={ok ? 'line-through text-muted-foreground truncate' : 'text-foreground truncate'}>
                      {o.label}
                    </span>
                    {o.target > 1 && (
                      <span className="ml-auto font-orbitron text-[10px] text-muted-foreground">
                        {Math.min(o.current, o.target)}/{o.target}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {ready && (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="mt-1 w-full text-[11px] font-orbitron tracking-wider py-1.5 rounded
                  bg-gradient-to-r from-neon-green/80 to-emerald-500 text-background
                  hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {claiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Claim Reward
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function humanize(kind: FlatObjective['kind'], key: string): string {
  if (kind === 'defeat')      return `Defeat ${key.replace(/^enemy-/, '').replace(/-/g, ' ')}`;
  if (kind === 'talk')        return `Talk to ${key.replace(/^(quest|vendor)-/, '').replace(/-/g, ' ')}`;
  if (kind === 'visit_zone')  return `Travel to ${key.replace(/-/g, ' ')}`;
  if (kind === 'open_build')  return 'Open the Build screen';
  return key;
}
