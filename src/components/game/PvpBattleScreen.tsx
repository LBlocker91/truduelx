import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Swords, Shield, Zap, Loader2, Flag, Sparkles } from 'lucide-react';
import { submitBattleAction } from '@/lib/cloud-pvp';
import { resolvePlaybackState } from '@/lib/battle-playback';
import { BattleStage } from './battle/BattleStage';

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
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [playbackAction, setPlaybackAction] = useState<ActionRow | null>(null);
  const [playbackTick, setPlaybackTick] = useState(0);
  const [playbackAnimating, setPlaybackAnimating] = useState(false);
  const [displayedMe, setDisplayedMe] = useState<ParticipantRow | null>(null);
  const [displayedOpponent, setDisplayedOpponent] = useState<ParticipantRow | null>(null);
  const [displayedTurnNumber, setDisplayedTurnNumber] = useState(1);
  const [displayedCurrentTurn, setDisplayedCurrentTurn] = useState<string | null>(null);
  const seenActionIdsRef = useRef<Set<string>>(new Set());
  const playbackQueueRef = useRef<ActionRow[]>([]);
  const playbackHydratedRef = useRef(false);
  const turnTickingRef = useRef(false);
  const processedDeadlineRef = useRef<string | null>(null);

  const liveMe = participants.find(p => p.user_id === myUserId);
  const liveOpponent = participants.find(p => p.user_id !== myUserId);
  const finished = battle?.status === 'finished';
  const won = finished && battle?.winner_user_id === myUserId;

  const orderedActions = useMemo(() => {
    return [...actions].sort((a, b) => {
      const timeDelta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (timeDelta !== 0) return timeDelta;
      return a.turn_number - b.turn_number;
    });
  }, [actions]);

  const playNextQueuedAction = useCallback(() => {
    const next = playbackQueueRef.current.shift();
    if (!next) {
      setPlaybackAnimating(false);
      return;
    }

    setPlaybackAction(next);
    setPlaybackTick((tick) => tick + 1);
    setPlaybackAnimating(true);
  }, []);

  // Load initial state
  const refresh = useCallback(async () => {
    const [b, p, a] = await Promise.all([
      supabase.from('battles').select('*').eq('id', battleId).maybeSingle(),
      supabase.from('battle_participants').select('*').eq('battle_id', battleId).order('slot'),
      supabase.from('battle_actions').select('*').eq('battle_id', battleId).order('created_at', { ascending: false }).limit(20),
    ]);
    if (b.data) setBattle(b.data as any);
    if (p.data) setParticipants(p.data as any);
    if (a.data) {
      setActions(prev => {
        const map = new Map<string, ActionRow>();
        for (const row of (a.data as any[])) map.set(row.id, row as ActionRow);
        for (const row of prev) if (!map.has(row.id)) map.set(row.id, row);
        return Array.from(map.values())
          .sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
          .slice(0, 20);
      });
    }
  }, [battleId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Load skills my class can use
  useEffect(() => {
    if (!liveMe) return;
    (async () => {
      const { data } = await supabase.from('skills').select('*').eq('class', liveMe.snapshot.class);
      if (data) setSkills(data as any);
    })();
  }, [liveMe?.snapshot?.class]);

  // Realtime subscription for battle + participants + actions
  useEffect(() => {
    const ch = supabase
      .channel(`battle:${battleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` },
          () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` },
          () => refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battle_actions', filter: `battle_id=eq.${battleId}` },
          (payload) => setActions(prev => {
            const next = payload.new as ActionRow;
            if (prev.some(action => action.id === next.id)) return prev;
            return [next, ...prev].slice(0, 20);
          }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [battleId, refresh]);

  useEffect(() => {
    if (!battle || !liveMe || !liveOpponent) return;

    if (!playbackHydratedRef.current) {
      playbackHydratedRef.current = true;
      seenActionIdsRef.current = new Set(orderedActions.map((action) => action.id));
      playbackQueueRef.current = [];
      setPlaybackAnimating(false);
      setPlaybackAction(orderedActions[orderedActions.length - 1] ?? null);
      setDisplayedMe(liveMe);
      setDisplayedOpponent(liveOpponent);
      setDisplayedTurnNumber(battle.turn_number);
      setDisplayedCurrentTurn(battle.current_turn);
      return;
    }

    const unseenActions = orderedActions.filter((action) => !seenActionIdsRef.current.has(action.id));
    if (unseenActions.length === 0) return;

    unseenActions.forEach((action) => seenActionIdsRef.current.add(action.id));
    playbackQueueRef.current.push(...unseenActions);

    if (!playbackAnimating) {
      playNextQueuedAction();
    }
  }, [battle, liveMe, liveOpponent, orderedActions, playbackAnimating, playNextQueuedAction]);

  const handlePlaybackComplete = useCallback(() => {
    if (playbackAction && displayedMe && displayedOpponent) {
      const next = resolvePlaybackState(playbackAction, displayedMe.slot, displayedMe, displayedOpponent);
      setDisplayedMe(next.me as ParticipantRow);
      setDisplayedOpponent(next.enemy as ParticipantRow);
      setDisplayedTurnNumber(next.nextTurnNumber);
      setDisplayedCurrentTurn(next.nextCurrentTurn);
    }
    playNextQueuedAction();
  }, [displayedMe, displayedOpponent, playNextQueuedAction, playbackAction]);

  const me = displayedMe ?? liveMe;
  const opponent = displayedOpponent ?? liveOpponent;
  const myTurn = !finished && !playbackAnimating && (displayedCurrentTurn ?? battle?.current_turn) === myUserId;

  useEffect(() => {
    if (playbackAnimating) return;
    if (playbackQueueRef.current.length > 0) return;
    if (liveMe) setDisplayedMe(liveMe);
    if (liveOpponent) setDisplayedOpponent(liveOpponent);
    if (battle) {
      setDisplayedTurnNumber(battle.turn_number);
      setDisplayedCurrentTurn(battle.current_turn);
    }
  }, [battle, liveMe, liveOpponent, playbackAnimating]);

  useEffect(() => {
    if (!battle?.turn_deadline || finished) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(battle.turn_deadline!).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [battle?.turn_deadline, finished]);

  useEffect(() => {
    if (!battle?.turn_deadline || finished || playbackAnimating || turnTickingRef.current) return;
    if (secondsLeft > 0) return;
    if (processedDeadlineRef.current === battle.turn_deadline) return;

    processedDeadlineRef.current = battle.turn_deadline;
    turnTickingRef.current = true;
    submitBattleAction({ battleId, action: 'tick' })
      .catch((error) => console.error(error))
      .finally(() => {
        window.setTimeout(() => {
          turnTickingRef.current = false;
        }, 300);
      });
  }, [battle?.turn_deadline, battleId, finished, playbackAnimating, secondsLeft]);

  useEffect(() => {
    if (!battle?.turn_deadline) {
      processedDeadlineRef.current = null;
      return;
    }

    if (secondsLeft > 0 && processedDeadlineRef.current !== battle.turn_deadline) {
      processedDeadlineRef.current = null;
    }
  }, [battle?.turn_deadline, secondsLeft]);

  const doAction = async (payload: any) => {
    if (submitting || playbackAnimating || !myTurn || finished) return;
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
          <span className="text-muted-foreground">TURN</span> {playbackAnimating && playbackAction ? playbackAction.turn_number : displayedTurnNumber}
          <span className="ml-3 text-muted-foreground">PvP</span>
        </div>
        {!finished && (
          <div className={`font-orbitron text-sm ${myTurn || (playbackAnimating && playbackAction?.actor_slot === me.slot) ? 'text-primary' : 'text-muted-foreground'}`}>
            {playbackAnimating && playbackAction
              ? `${playbackAction.actor_slot === me.slot ? 'YOU ACT' : 'OPPONENT ACTS'} — ${secondsLeft}s`
              : `${myTurn ? 'YOUR TURN' : 'OPPONENT TURN'} — ${secondsLeft}s`}
          </div>
        )}
        <Button variant="outline" size="sm" onClick={onExit}>Exit</Button>
      </div>

      <BattleStageBlock
        me={me}
        opponent={opponent}
        action={playbackAction}
        actionTick={playbackTick}
        skills={skills}
        onAnimationComplete={handlePlaybackComplete}
      />

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Fighter p={me} label="YOU" mine />
        <Fighter p={opponent} label={opponent.snapshot.name} />
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
            <Button disabled={!myTurn || submitting || playbackAnimating} onClick={() => doAction({ battleId, action: 'attack' })}>
              <Swords className="w-4 h-4 mr-1" /> Attack
            </Button>
            <Button disabled={!myTurn || submitting || playbackAnimating} variant="secondary" onClick={() => doAction({ battleId, action: 'defend' })}>
              <Shield className="w-4 h-4 mr-1" /> Defend
            </Button>
            <Button disabled={submitting || playbackAnimating} variant="destructive" size="sm" onClick={() => doAction({ battleId, action: 'forfeit' })}>
              <Flag className="w-4 h-4 mr-1" /> Forfeit
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {skills.map(s => {
              const learned = (me.snapshot.skill_levels?.[s.slug] ?? 0) >= 1;
              const onCd = (me.cooldowns?.[s.slug] ?? 0) > 0;
              const lowEnergy = me.energy < s.energy_cost;
              const lowLvl = me.snapshot.level < s.unlock_level;
               const disabled = !myTurn || submitting || playbackAnimating || !learned || onCd || lowEnergy || lowLvl;
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

function BattleStageBlock({ me, opponent, action, actionTick, skills, onAnimationComplete }: {
  me: ParticipantRow;
  opponent: ParticipantRow;
  action: ActionRow | null;
  actionTick: number;
  skills: SkillCatalog[];
  onAnimationComplete: () => void;
}) {
  const lastActor: 'player' | 'enemy' | null = !action
    ? null
    : action.actor_slot === me.slot ? 'player' : 'enemy';

  const hits = action?.result?.hits ?? [];
  const damage = hits.reduce((sum: number, hit: any) => sum + (hit.damage ?? 0), 0);
  const crit = hits.some((hit: any) => hit.crit);
  const skill = action?.skill_slug ? skills.find(entry => entry.slug === action.skill_slug) : null;

  return (
    <BattleStage
      player={{
        name: 'YOU',
        level: me.snapshot.level,
        hp: me.hp,
        maxHp: me.max_hp,
        mp: me.energy,
        maxMp: me.max_energy,
        armorVariant: me.snapshot.equipped?.armor_variant,
        weaponVariant: me.snapshot.equipped?.weapon_variant,
        isPlayer: true,
        characterClass: me.snapshot.class,
      }}
      enemy={{
        name: opponent.snapshot.name,
        level: opponent.snapshot.level,
        hp: opponent.hp,
        maxHp: opponent.max_hp,
        mp: opponent.energy,
        maxMp: opponent.max_energy,
        armorVariant: opponent.snapshot.equipped?.armor_variant,
        weaponVariant: opponent.snapshot.equipped?.weapon_variant,
        isPlayer: false,
        characterClass: opponent.snapshot.class,
      }}
      actionTick={actionTick}
      lastActor={lastActor}
      lastDamage={damage || null}
      lastWasHeal={false}
      lastSkillName={skill?.name ?? null}
      lastSkill={skill ?? null}
      crit={crit}
      onAnimationComplete={onAnimationComplete}
    />
  );
}

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
