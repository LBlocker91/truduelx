import { useEffect, useState } from 'react';
import { Loader2, ScrollText, CheckCircle2, Circle, Gift } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchPlayerQuests, PlayerQuest } from '@/lib/overworld';

interface QuestRow {
  id: string;
  name: string;
  description: string | null;
  objectives: Record<string, any>;
  rewards: Record<string, any>;
}

interface QuestsPanelProps {
  /** Currently selected character id (used to optionally claim XP rewards later) */
  characterId: string;
}

export const QuestsPanel = ({ characterId }: QuestsPanelProps) => {
  const [playerQuests, setPlayerQuests] = useState<PlayerQuest[]>([]);
  const [questCatalog, setQuestCatalog] = useState<Record<string, QuestRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) { setLoading(false); return; }
        const [pq, all] = await Promise.all([
          fetchPlayerQuests(u.user.id),
          supabase.from('quests').select('id, name, description, objectives, rewards'),
        ]);
        setPlayerQuests(pq);
        const map: Record<string, QuestRow> = {};
        for (const q of (all.data ?? []) as any[]) map[q.id] = q;
        setQuestCatalog(map);
      } finally {
        setLoading(false);
      }
    })();
  }, [characterId]);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (playerQuests.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No active quests. Talk to quest NPCs in the overworld to accept missions.
      </div>
    );
  }

  const active = playerQuests.filter((q) => !q.completed);
  const done = playerQuests.filter((q) => q.completed);

  return (
    <div className="space-y-5">
      {active.length > 0 && (
        <Section title="ACTIVE">
          {active.map((pq) => <QuestCard key={pq.id} pq={pq} q={questCatalog[pq.quest_id]} />)}
        </Section>
      )}
      {done.length > 0 && (
        <Section title="COMPLETED">
          {done.map((pq) => <QuestCard key={pq.id} pq={pq} q={questCatalog[pq.quest_id]} />)}
        </Section>
      )}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="font-orbitron text-xs text-muted-foreground mb-2">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const QuestCard = ({ pq, q }: { pq: PlayerQuest; q?: QuestRow }) => {
  if (!q) return null;
  const objectives = q.objectives ?? {};
  const progress = pq.progress ?? {};

  // Flatten objectives like { defeat: { 'enemy-x': 2 } } → list of (label, current, target)
  const flat: { label: string; current: number; target: number }[] = [];
  for (const [type, val] of Object.entries(objectives)) {
    if (typeof val === 'object' && val) {
      for (const [target, count] of Object.entries(val as Record<string, number>)) {
        const current = progress?.[type]?.[target] ?? 0;
        flat.push({ label: `${type} ${target.replace(/^enemy-/, '')}`, current, target: count });
      }
    }
  }

  const xp = q.rewards?.xp ?? 0;

  return (
    <div className="game-card rounded-lg p-3">
      <div className="flex items-start gap-2">
        <ScrollText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h4 className="font-orbitron text-sm">{q.name}</h4>
          {q.description && <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>}
          <ul className="mt-2 space-y-1">
            {flat.map((o, i) => {
              const done = o.current >= o.target;
              return (
                <li key={i} className="flex items-center gap-2 text-xs">
                  {done ? <CheckCircle2 className="w-3 h-3 text-neon-green" /> : <Circle className="w-3 h-3 text-muted-foreground" />}
                  <span className={done ? 'line-through text-muted-foreground' : 'text-foreground'}>{o.label}</span>
                  <span className="ml-auto font-orbitron text-[11px]">{o.current}/{o.target}</span>
                </li>
              );
            })}
          </ul>
          {xp > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] text-shield border-shield/40">
                <Gift className="w-3 h-3 mr-1" /> {xp} XP
              </Badge>
              {pq.completed && !pq.claimed && <span className="text-[10px] text-neon-green">Ready to claim</span>}
              {pq.claimed && <span className="text-[10px] text-muted-foreground">Claimed</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
