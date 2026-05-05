import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Swords, Shield, Zap, Loader2, Flag, Sparkles } from 'lucide-react';
import { submitBattleAction } from '@/lib/cloud-pvp';

interface PvpBattleScreenProps {
  battleId: string;
  myUserId: string;
  onExit: () => void;
}

interface ParticipantRow {
  battle_id: string;
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
}

interface BattleRow {
  id: string;
  status: string;
  current_turn: string | null;
  turn_number: number;
  turn_deadline: string | null;
  winner_user_id: string | null;
  mode: string;
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
  energy_cost: number; cooldown: number; base_damage: number; hits: number;
  scale_stat: string; type: string; effect: string; unlock_level: number;
}

export const PvpBattleScreen = ({ battleId, myUserId, onExit }: PvpBattleScreenProps) => {
  const [battle, setBattle] = useState<BattleRow | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [skills, setSkills] = useState<SkillCatalog[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const me = participants.find(p => p.user_id === myUserId);
  const opponent = participants.find(p => p.user_id !== myUserId);
  const myTurn = battle?.current_turn === myUserId;
  const finished = battle?.status === 'finished';
  const won = finished && battle?.winner_user_id === myUserId;

  // Load initial state
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

  // Load skills my class can use
  useEffect(() => {
    if (!me) return;
    (async () => {
      const { data } = await supabase.from('skills').select('*').eq('class', me.snapshot.class);
      if (data) setSkills(data as any);
    })();
  }, [me?.snapshot?.class]);

  // Realtime subscription for battle + participants + actions
  useEffect(() => {
    const ch = supabase
      .channel(`battle:${battleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` },
          () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` },
          () => refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battle_actions', filter: `battle_id=eq.${battleId}` },
          (payload) => setActions(prev => [payload.new as any, ...prev].slice(0, 20)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [battleId, refresh]);

  // Turn timer
  useEffect(() => {
    if (!battle?.turn_deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(battle.turn_deadline!).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [battle?.turn_deadline]);

  const doAction = async (payload: any) => {
    if (submitting || !myTurn || finished) return;
    setSubmitting(true);
    try { await submitBattleAction(payload); }
    catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  if (!battle || !me || !opponent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="font-orbitron text-sm">
          <span className="text-muted-foreground">TURN</span> {battle.turn_number}
          <span className="ml-3 text-muted-foreground">PvP</span>
        </div>
        {!finished && (
          <div className={`font-orbitron text-sm ${myTurn ? 'text-primary' : 'text-muted-foreground'}`}>
            {myTurn ? `YOUR TURN — ${secondsLeft}s` : `OPPONENT'S TURN — ${secondsLeft}s`}
          </div>
        )}
        <Button variant="outline" size="sm" onClick={onExit}>Exit</Button>
      </div>

      {/* Battle stage */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Fighter p={me} label="YOU" mine />
        <Fighter p={opponent} label={opponent.snapshot.name} />
      </div>

      {/* Combat log */}
      <div className="flex-1 bg-card border border-border rounded p-3 mb-4 overflow-y-auto max-h-40 text-xs font-rajdhani">
        {actions.length === 0 && <p className="text-muted-foreground">Battle begins…</p>}
        {actions.map(a => (
          <div key={a.id} className="mb-1">
            <span className="text-muted-foreground">T{a.turn_number}</span>{' '}
            <span className={a.actor_slot === me.slot ? 'text-primary' : 'text-secondary'}>
              {a.actor_slot === me.slot ? 'You' : 'Opponent'}
            </span>{' '}
            {describeAction(a)}
          </div>
        ))}
      </div>

      {/* Action bar */}
      {finished ? (
        <div className="text-center py-6">
          <h2 className={`font-orbitron text-4xl ${won ? 'text-primary' : 'text-destructive'}`}>
            {won ? 'VICTORY' : 'DEFEAT'}
          </h2>
          <Button className="mt-4" onClick={onExit}>Return to Lobby</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 justify-center">
            <Button disabled={!myTurn || submitting} onClick={() => doAction({ battleId, action: 'attack' })}>
              <Swords className="w-4 h-4 mr-1" /> Attack
            </Button>
            <Button disabled={!myTurn || submitting} variant="secondary" onClick={() => doAction({ battleId, action: 'defend' })}>
              <Shield className="w-4 h-4 mr-1" /> Defend
            </Button>
            <Button disabled={submitting} variant="destructive" size="sm" onClick={() => doAction({ battleId, action: 'forfeit' })}>
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
                <Button
                  key={s.slug}
                  disabled={disabled}
                  variant="outline"
                  size="sm"
                  onClick={() => doAction({ battleId, action: 'skill', skillSlug: s.slug })}
                  title={`${s.description} | ⚡${s.energy_cost} | CD ${s.cooldown}${!learned ? ' | NOT LEARNED' : ''}${lowLvl ? ` | Lv ${s.unlock_level}` : ''}`}
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
    <div className={`p-3 border rounded ${mine ? 'border-primary' : 'border-secondary'}`}>
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
