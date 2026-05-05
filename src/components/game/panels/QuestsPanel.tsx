import { useEffect, useState } from 'react';
import { Loader2, ScrollText, CheckCircle2, Circle, Gift, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchPlayerQuests, claimQuestReward, PlayerQuest } from '@/lib/overworld';
import type { LevelUpInfo } from '@/pages/Index';

interface QuestRow {
  id: string;
  name: string;
  description: string | null;
  objectives: Record<string, any>;
  rewards: Record<string, any>;
}

interface QuestsPanelProps {
  characterId: string;
  refreshTick?: number;
  onProgressionChange?: (level?: LevelUpInfo | null) => void;
}

export const QuestsPanel = ({ characterId, refreshTick, onProgressionChange }: QuestsPanelProps) => {
  const [playerQuests, setPlayerQuests] = useState<PlayerQuest[]>([]);
  const [questCatalog, setQuestCatalog] = useState<Record<string, QuestRow>>({});
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
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
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [characterId, refreshTick]);

  const handleClaim = async (questId: string) => {
    if (claiming) return;
    setClaiming(questId);
    try {
      const r = await claimQuestReward(characterId, questId);
      toast.success(`Claimed ${r.rewards.xp} XP, ${r.rewards.credits} credits`);
      onProgressionChange?.(r.level && r.level.levelsGained > 0 ? r.level : null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setClaiming(null);
    }
  };

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
  const ready = playerQuests.filter((q) => q.completed && !q.claimed);
  const done = playerQuests.filter((q) => q.completed && q.claimed);

  return (
    <div className="space-y-5">
      {ready.length > 0 && (
        <Section title="READY TO CLAIM">
          {ready.map((pq) => (
            <QuestCard key={pq.id} pq={pq} q={questCatalog[pq.quest_id]}
              claiming={claiming === pq.quest_id}
              onClaim={() => handleClaim(pq.quest_id)} />
          ))}
        </Section>
      )}
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

const QuestCard = ({
  pq, q, claiming, onClaim,
}: { pq: PlayerQuest; q?: QuestRow; claiming?: boolean; onClaim?: () => void }) => {
  if (!q) return null;
  const objectives = q.objectives ?? {};
  const progress = pq.progress ?? {};

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
  const credits = q.rewards?.credits ?? 0;
  const skillPts = q.rewards?.skill_points ?? 0;

  return (
    <div className="game-card rounded-lg p-3">
      <div className="flex items-start gap-2">
        <ScrollText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h4 className="font-orbitron text-sm">{q.name}</h4>
          {q.description && <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>}
          <ul className="mt-2 space-y-1">
            {flat.map((o, i) => {
              const ok = o.current >= o.target;
              return (
                <li key={i} className="flex items-center gap-2 text-xs">
                  {ok ? <CheckCircle2 className="w-3 h-3 text-neon-green" /> : <Circle className="w-3 h-3 text-muted-foreground" />}
                  <span className={ok ? 'line-through text-muted-foreground' : 'text-foreground'}>{o.label}</span>
                  <span className="ml-auto font-orbitron text-[11px]">{o.current}/{o.target}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {xp > 0 && (
              <Badge variant="outline" className="text-[10px] text-shield border-shield/40">
                <Gift className="w-3 h-3 mr-1" /> {xp} XP
              </Badge>
            )}
            {credits > 0 && (
              <Badge variant="outline" className="text-[10px] text-shield border-shield/40">
                <Coins className="w-3 h-3 mr-1" /> {credits}
              </Badge>
            )}
            {skillPts > 0 && (
              <Badge variant="outline" className="text-[10px] text-primary border-primary/40">
                +{skillPts} skill pt
              </Badge>
            )}
            {pq.completed && !pq.claimed && onClaim && (
              <Button size="sm" className="ml-auto h-7" disabled={claiming} onClick={onClaim}>
                {claiming ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Claim'}
              </Button>
            )}
            {pq.claimed && <span className="text-[10px] text-muted-foreground ml-auto">Claimed</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
