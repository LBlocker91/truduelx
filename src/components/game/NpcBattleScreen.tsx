import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Swords, Shield, Loader2, Flag, Sparkles } from 'lucide-react';
import { submitNpcAction } from '@/lib/overworld';
import { setInBattle } from '@/lib/overworld';

interface LevelUpInfo {
  oldLevel: number;
  newLevel: number;
  statPointsGained: number;
  skillPointsGained: number;
  maxHpGained: number;
}

interface NpcBattleScreenProps {
  battleId: string;
  myUserId: string;
  onExit: (won: boolean, level?: LevelUpInfo | null) => void;
}

interface ParticipantRow {
  user_id: string | null;
  slot: number;
  hp: number;
  max_hp: number;
  energy: number;
  max_energy: number;
  rage: number;
  status_effects: any[];
  cooldowns: Record<string, number>;
  snapshot: any;
  is_bot: boolean;
}

interface BattleRow {
  id: string;
  status: string;
  current_turn: string | null;
  turn_number: number;
  winner_user_id: string | null;
}

interface ActionRow {
  id: string;
  turn_number: number;
  actor_slot: number;
  action_type: string;
  skill_slug: string | null;
  result: any;
  created_at: string;
}

interface SkillCatalog {
  slug: string; name: string; description: string;
  energy_cost: number; cooldown: number; base_damage: number;
  scale_stat: string; type: string; effect: string; unlock_level: number;
}

export const NpcBattleScreen = ({ battleId, myUserId, onExit }: NpcBattleScreenProps) => {
  const [battle, setBattle] = useState<BattleRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [skills, setSkills] = useState<SkillCatalog[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const me = participants.find(p => p.user_id === myUserId);
  const enemy = participants.find(p => p.is_bot);
  const finished = battle?.status === 'finished';
  const won = finished && battle?.winner_user_id === myUserId;
  const myTurn = !finished && battle?.current_turn === myUserId;

  const refresh = useCallback(async () => {
    const [b, p, a] = await Promise.all([
      supabase.from('battles').select('*').eq('id', battleId).maybeSingle(),
      supabase.from('battle_participants').select('*').eq('battle_id', battleId).order('slot'),
      supabase.from('battle_actions').select('*').eq('battle_id', battleId).order('created_at', { ascending: false }).limit(20),
    ]);
    if (b.data) setBattle(b.data as any);
    if (p.data) setParticipants(p.data as any);
    if (a.data) setActions(a.data as any);
  }, [battleId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!me) return;
    (async () => {
      const { data } = await supabase.from('skills').select('*').eq('class', me.snapshot.class);
      if (data) setSkills(data as any);
    })();
  }, [me?.snapshot?.class]);

  useEffect(() => {
    const ch = supabase
      .channel(`npc-battle:${battleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` }, () => refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battle_actions', filter: `battle_id=eq.${battleId}` },
          (payload) => setActions(prev => [payload.new as any, ...prev].slice(0, 20)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [battleId, refresh]);

  // Reward summary captured from the last action response.
  const [rewards, setRewards] = useState<{ xpGained: number; creditsGained: number } | null>(null);
  const [pendingLevel, setPendingLevel] = useState<LevelUpInfo | null>(null);

  const doAction = async (action: 'attack'|'defend'|'forfeit'|'skill', skillSlug?: string) => {
    if (submitting || !myTurn) return;
    setSubmitting(true);
    try {
      const r = await submitNpcAction(battleId, action, skillSlug);
      if (r?.finished) {
        await setInBattle(false);
        if (r.won) {
          setRewards({ xpGained: r.xpGained ?? 0, creditsGained: r.creditsGained ?? 0 });
          if (r.level && r.level.levelsGained > 0) setPendingLevel(r.level);
        }
      }
    } catch (e: any) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleExit = async () => {
    await setInBattle(false);
    onExit(!!won, pendingLevel);
  };

  if (!battle || !me || !enemy) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="font-orbitron text-sm">
          <span className="text-muted-foreground">TURN</span> {battle.turn_number}
          <span className="ml-3 text-muted-foreground">vs NPC</span>
        </div>
        <div className={`font-orbitron text-sm ${myTurn ? 'text-primary' : 'text-muted-foreground'}`}>
          {finished ? 'BATTLE ENDED' : myTurn ? 'YOUR TURN' : 'ENEMY TURN'}
        </div>
        <Button variant="outline" size="sm" onClick={handleExit}>Exit</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Fighter p={me} label="YOU" mine />
        <Fighter p={enemy} label={enemy.snapshot.name} />
      </div>

      <div className="flex-1 bg-card border border-border rounded p-3 mb-4 overflow-y-auto max-h-40 text-xs font-rajdhani">
        {actions.length === 0 && <p className="text-muted-foreground">Battle begins…</p>}
        {actions.map(a => (
          <div key={a.id} className="mb-1">
            <span className="text-muted-foreground">T{a.turn_number}</span>{' '}
            <span className={a.actor_slot === me.slot ? 'text-primary' : 'text-destructive'}>
              {a.actor_slot === me.slot ? 'You' : enemy.snapshot.name}
            </span>{' '}
            {describeAction(a)}
          </div>
        ))}
      </div>

      {finished ? (
        <div className="text-center py-6">
          <h2 className={`font-orbitron text-4xl ${won ? 'text-primary' : 'text-destructive'}`}>
            {won ? 'VICTORY' : 'DEFEAT'}
          </h2>
          <Button className="mt-4" onClick={handleExit}>Return to Overworld</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 justify-center">
            <Button disabled={!myTurn || submitting} onClick={() => doAction('attack')}>
              <Swords className="w-4 h-4 mr-1" /> Attack
            </Button>
            <Button disabled={!myTurn || submitting} variant="secondary" onClick={() => doAction('defend')}>
              <Shield className="w-4 h-4 mr-1" /> Defend
            </Button>
            <Button disabled={submitting} variant="destructive" size="sm" onClick={() => doAction('forfeit')}>
              <Flag className="w-4 h-4 mr-1" /> Forfeit
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {skills.map(s => {
              const learned = (me.snapshot.skill_levels?.[s.slug] ?? 0) >= 1;
              const onCd = (me.cooldowns?.[s.slug] ?? 0) > 0;
              const lowEnergy = me.energy < s.energy_cost;
              const lowLvl = me.snapshot.level < s.unlock_level;
              const disabled = !myTurn || submitting || !learned || onCd || lowEnergy || lowLvl;
              return (
                <Button key={s.slug} disabled={disabled} variant="outline" size="sm"
                  onClick={() => doAction('skill', s.slug)}
                  title={`${s.description} | ⚡${s.energy_cost} | CD ${s.cooldown}${!learned ? ' | NOT LEARNED' : ''}`}
                  className="flex flex-col h-auto py-1 px-2"
                >
                  <span className="font-orbitron text-[10px]">{s.name}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {onCd ? `CD ${me.cooldowns[s.slug]}` : `⚡${s.energy_cost}`}
                    {!learned && ' 🔒'}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

function Fighter({ p, label, mine }: { p: ParticipantRow; label: string; mine?: boolean }) {
  const hpPct = (p.hp / p.max_hp) * 100;
  const enPct = (p.energy / p.max_energy) * 100;
  return (
    <div className={`p-3 border rounded ${mine ? 'border-primary' : 'border-destructive'}`}>
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-orbitron text-sm">{label}</span>
        <span className="text-xs text-muted-foreground">Lv {p.snapshot.level} {p.snapshot.class}</span>
      </div>
      <div className="space-y-1">
        <div>
          <div className="flex justify-between text-[10px] font-rajdhani"><span>HP</span><span>{p.hp}/{p.max_hp}</span></div>
          <Progress value={hpPct} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between text-[10px] font-rajdhani"><span>ENERGY</span><span>{p.energy}/{p.max_energy}</span></div>
          <Progress value={enPct} className="h-1.5" />
        </div>
        <div className="flex gap-1 mt-1 flex-wrap min-h-[16px]">
          {p.status_effects?.map((e: any, i: number) => (
            <span key={i} className="text-[9px] px-1 rounded bg-accent/20 text-accent">
              <Sparkles className="w-2 h-2 inline" /> {e.type}({e.turns})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function describeAction(a: ActionRow): string {
  if (a.action_type === 'forfeit') return 'forfeited.';
  if (a.action_type === 'defend') return 'braced for impact.';
  if (a.action_type === 'stunned') return 'is stunned!';
  const hits = a.result?.hits ?? [];
  const total = hits.reduce((s: number, h: any) => s + (h.damage ?? 0), 0);
  const crit = hits.some((h: any) => h.crit);
  const dodged = hits.some((h: any) => h.dodged);
  if (a.action_type === 'skill') return `used ${a.skill_slug} → ${total} dmg${crit ? ' CRIT!' : ''}${dodged ? ' (dodged)' : ''}`;
  return `attacked for ${total} dmg${crit ? ' CRIT!' : ''}${dodged ? ' (dodged)' : ''}`;
}
