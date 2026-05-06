import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Swords, Shield, Loader2, Flag, Sparkles } from 'lucide-react';
import { submitNpcAction } from '@/lib/overworld';
import { setInBattle } from '@/lib/overworld';
import { resolvePlaybackState } from '@/lib/battle-playback';
import { BattleStage } from './battle/BattleStage';

interface LevelUpInfo {
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
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
  turn_deadline?: string | null;
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
  const [potions, setPotions] = useState<{ hp: number; mp: number }>({ hp: 0, mp: 0 });
  const [characterId, setCharacterId] = useState<string | null>(null);

  // Live (DB) view
  const liveMe = participants.find(p => p.user_id === myUserId);
  const liveEnemy = participants.find(p => p.is_bot);
  const finished = battle?.status === 'finished';
  const won = finished && battle?.winner_user_id === myUserId;

  const refreshPotions = useCallback(async (charId: string) => {
    const { data } = await supabase
      .from('inventory')
      .select('quantity, items!inner(subtype, consumable)')
      .eq('character_id', charId)
      .eq('items.consumable', true);
    let hp = 0, mp = 0;
    for (const row of (data ?? []) as any[]) {
      if (row.items?.subtype === 'hp_potion') hp += row.quantity ?? 0;
      else if (row.items?.subtype === 'mp_potion') mp += row.quantity ?? 0;
    }
    setPotions({ hp, mp });
  }, []);

  const refresh = useCallback(async () => {
    const [b, p, a] = await Promise.all([
      supabase.from('battles').select('*').eq('id', battleId).maybeSingle(),
      supabase.from('battle_participants').select('*').eq('battle_id', battleId).order('slot'),
      supabase.from('battle_actions').select('*').eq('battle_id', battleId).order('created_at', { ascending: false }).limit(20),
    ]);
    if (b.data) setBattle(b.data as any);
    if (p.data) {
      setParticipants(p.data as any);
      const myRow = (p.data as any[]).find(r => r.user_id === myUserId);
      if (myRow?.character_id) {
        setCharacterId(myRow.character_id);
        refreshPotions(myRow.character_id);
      }
    }
    if (a.data) {
      setActions(prev => {
        const map = new Map<string, ActionRow>();
        for (const row of (a.data as any[])) map.set(row.id, row as ActionRow);
        for (const row of prev) if (!map.has(row.id)) map.set(row.id, row);
        return Array.from(map.values()).sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()).slice(0, 20);
      });
    }
  }, [battleId, myUserId, refreshPotions]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!liveMe) return;
    (async () => {
      const { data } = await supabase.from('skills').select('*').eq('class', liveMe.snapshot.class);
      if (data) setSkills(data as any);
    })();
  }, [liveMe?.snapshot?.class]);

  useEffect(() => {
    const ch = supabase
      .channel(`npc-battle:${battleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants', filter: `battle_id=eq.${battleId}` }, () => refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battle_actions', filter: `battle_id=eq.${battleId}` },
          (payload) => setActions(prev => {
            const next = payload.new as ActionRow;
            if (prev.some(a => a.id === next.id)) return prev;
            return [next, ...prev].slice(0, 20);
          }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [battleId, refresh]);

  // Reward summary captured from the last action response.
  const [rewards, setRewards] = useState<{ xpGained: number; creditsGained: number } | null>(null);
  const [pendingLevel, setPendingLevel] = useState<LevelUpInfo | null>(null);
  const [playbackAction, setPlaybackAction] = useState<ActionRow | null>(null);
  const [playbackTick, setPlaybackTick] = useState(0);
  const [playbackAnimating, setPlaybackAnimating] = useState(false);
  // Displayed (lagged) state — only advances when an animation completes.
  const [displayedMe, setDisplayedMe] = useState<ParticipantRow | null>(null);
  const [displayedEnemy, setDisplayedEnemy] = useState<ParticipantRow | null>(null);
  const [displayedTurnNumber, setDisplayedTurnNumber] = useState<number>(1);
  const [displayedCurrentTurn, setDisplayedCurrentTurn] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const seenActionIdsRef = useRef<Set<string>>(new Set());
  const playbackQueueRef = useRef<ActionRow[]>([]);
  const playbackHydratedRef = useRef(false);
  const turnTickingRef = useRef(false);

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

  // Hydrate displayed state on first load and when a hydration is needed (battle ended w/ no playback).
  useEffect(() => {
    if (!battle || !liveMe || !liveEnemy) return;

    if (!playbackHydratedRef.current) {
      playbackHydratedRef.current = true;
      seenActionIdsRef.current = new Set(orderedActions.map((action) => action.id));
      playbackQueueRef.current = [];
      setPlaybackAnimating(false);
      setPlaybackAction(orderedActions[orderedActions.length - 1] ?? null);
      setDisplayedMe(liveMe);
      setDisplayedEnemy(liveEnemy);
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
  }, [battle, liveEnemy, liveMe, orderedActions, playbackAnimating, playNextQueuedAction]);

  const handlePlaybackComplete = useCallback(() => {
    if (playbackAction && displayedMe && displayedEnemy) {
      const next = resolvePlaybackState(playbackAction, displayedMe.slot, displayedMe, displayedEnemy);
      setDisplayedMe(next.me as ParticipantRow);
      setDisplayedEnemy(next.enemy as ParticipantRow);
      setDisplayedTurnNumber(next.nextTurnNumber);
      setDisplayedCurrentTurn(next.nextCurrentTurn);
    }
    playNextQueuedAction();
  }, [displayedEnemy, displayedMe, playNextQueuedAction, playbackAction]);

  // Use displayed snapshot for everything UI-facing.
  const me = displayedMe ?? liveMe;
  const enemy = displayedEnemy ?? liveEnemy;
  const myTurn = !finished && !playbackAnimating && (displayedCurrentTurn ?? battle?.current_turn) === myUserId;

  // When playback is fully drained, sync displayed → live (covers any missed snapshots, e.g. final state).
  useEffect(() => {
    if (playbackAnimating) return;
    if (playbackQueueRef.current.length > 0) return;
    if (liveMe) setDisplayedMe(liveMe);
    if (liveEnemy) setDisplayedEnemy(liveEnemy);
    if (battle) {
      setDisplayedTurnNumber(battle.turn_number);
      setDisplayedCurrentTurn(battle.current_turn);
    }
  }, [playbackAnimating, liveMe, liveEnemy, battle]);

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
    const expired = new Date(battle.turn_deadline).getTime() <= Date.now();
    if (!expired) return;

    turnTickingRef.current = true;
    submitNpcAction(battleId, 'tick')
      .catch((error) => console.error(error))
      .finally(() => {
        window.setTimeout(() => {
          turnTickingRef.current = false;
        }, 300);
      });
  }, [battle?.turn_deadline, battleId, finished, playbackAnimating]);

  const displayTurn = playbackAnimating && playbackAction ? playbackAction.turn_number : displayedTurnNumber;
  const turnStateLabel = finished
    ? 'BATTLE ENDED'
    : playbackAnimating && playbackAction
      ? playbackAction.actor_slot === me?.slot
        ? 'YOU ACT'
        : 'NPC ACTS'
      : myTurn
        ? 'YOUR TURN'
        : 'ENEMY TURN';

  const doAction = async (
    action: 'attack'|'defend'|'forfeit'|'skill'|'use_item',
    skillSlug?: string,
    itemSubtype?: 'hp_potion'|'mp_potion',
  ) => {
    if (submitting || playbackAnimating || !myTurn) return;
    setSubmitting(true);
    try {
      const r = await submitNpcAction(battleId, action, skillSlug, itemSubtype);
      if (r?.error) {
        const { toast } = await import('sonner');
        toast.error(r.error);
      }
      if (action === 'use_item' && characterId) await refreshPotions(characterId);
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
          <span className="text-muted-foreground">TURN</span> {displayTurn}
          <span className="ml-3 text-muted-foreground">vs NPC</span>
        </div>
        <div className={`font-orbitron text-sm ${turnStateLabel === 'YOUR TURN' || turnStateLabel === 'YOU ACT' ? 'text-primary' : 'text-muted-foreground'}`}>
          {finished ? turnStateLabel : `${turnStateLabel} — ${secondsLeft}s`}
        </div>
        <Button variant="outline" size="sm" onClick={handleExit}>Exit</Button>
      </div>

      {/* Animated battle stage */}
      <BattleStageBlock
        me={me}
        enemy={enemy}
        action={playbackAction}
        actionTick={playbackTick}
        skills={skills}
        onAnimationComplete={handlePlaybackComplete}
      />

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
        <div className="text-center py-6 space-y-2">
          <h2 className={`font-orbitron text-4xl ${won ? 'text-primary' : 'text-destructive'}`}>
            {won ? 'VICTORY' : 'DEFEAT'}
          </h2>
          {won && rewards && (
            <div className="text-sm font-rajdhani space-y-0.5">
              <div>+<span className="font-orbitron text-primary">{rewards.xpGained}</span> XP</div>
              <div>+<span className="font-orbitron text-shield">{rewards.creditsGained}</span> credits</div>
              {pendingLevel && pendingLevel.levelsGained > 0 && (
                <div className="text-secondary font-orbitron">
                  LEVEL UP! {pendingLevel.oldLevel} → {pendingLevel.newLevel}
                  {' '}(+{pendingLevel.statPointsGained} stat, +{pendingLevel.skillPointsGained} skill)
                </div>
              )}
            </div>
          )}
          <Button className="mt-4" onClick={handleExit}>Return to Overworld</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 justify-center">
            <Button disabled={!myTurn || submitting || playbackAnimating} onClick={() => doAction('attack')}>
              <Swords className="w-4 h-4 mr-1" /> Attack
            </Button>
            <Button disabled={!myTurn || submitting || playbackAnimating} variant="secondary" onClick={() => doAction('defend')}>
              <Shield className="w-4 h-4 mr-1" /> Defend
            </Button>
            <Button
              disabled={!myTurn || submitting || playbackAnimating || potions.hp <= 0 || me.hp >= me.max_hp}
              variant="outline"
              size="sm"
              onClick={() => doAction('use_item', undefined, 'hp_potion')}
              title={potions.hp <= 0 ? 'No HP Potions' : me.hp >= me.max_hp ? 'HP already full' : 'Restores 50% HP'}
            >
              ❤ HP Potion ×{potions.hp}
            </Button>
            <Button
              disabled={!myTurn || submitting || playbackAnimating || potions.mp <= 0 || me.energy >= me.max_energy}
              variant="outline"
              size="sm"
              onClick={() => doAction('use_item', undefined, 'mp_potion')}
              title={potions.mp <= 0 ? 'No MP Potions' : me.energy >= me.max_energy ? 'MP already full' : 'Restores 50% MP'}
            >
              ⚡ MP Potion ×{potions.mp}
            </Button>
            <Button disabled={submitting || playbackAnimating} variant="destructive" size="sm" onClick={() => doAction('forfeit')}>
              <Flag className="w-4 h-4 mr-1" /> Forfeit
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {skills.map(s => {
              const rank = me.snapshot.skill_levels?.[s.slug] ?? 0;
              const learned = rank >= 1;
              const onCd = (me.cooldowns?.[s.slug] ?? 0) > 0;
              const lowMp = me.energy < s.energy_cost;
              const lowLvl = me.snapshot.level < s.unlock_level;
              const disabled = !myTurn || submitting || playbackAnimating || !learned || onCd || lowMp || lowLvl;
              return (
                <Button key={s.slug} disabled={disabled} variant="outline" size="sm"
                  onClick={() => doAction('skill', s.slug)}
                  title={`${s.description} | MP ${s.energy_cost} | CD ${s.cooldown}${learned ? ` | Rank ${rank}` : ' | NOT LEARNED'}`}
                  className="flex flex-col h-auto py-1 px-2"
                >
                  <span className="font-orbitron text-[10px]">
                    {s.name}{learned && <span className="ml-1 text-secondary">R{rank}</span>}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {onCd ? `CD ${me.cooldowns[s.slug]}` : `MP ${s.energy_cost}`}
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

// --- Animated battle stage wrapper -----------------------------------------
function BattleStageBlock({ me, enemy, action, actionTick, skills, onAnimationComplete }: {
  me: ParticipantRow;
  enemy: ParticipantRow;
  action: ActionRow | null;
  actionTick: number;
  skills: SkillCatalog[];
  onAnimationComplete: () => void;
}) {
  const latest = action;

  const lastActor: 'player' | 'enemy' | null = !latest
    ? null
    : latest.actor_slot === me.slot ? 'player' : 'enemy';

  const hits = latest?.result?.hits ?? [];
  const damage = hits.reduce((s: number, h: any) => s + (h.damage ?? 0), 0);
  const crit = hits.some((h: any) => h.crit);
  const isHeal = latest?.action_type === 'use_item';
  const healAmt = latest?.result?.heal ?? latest?.result?.mpHeal ?? 0;

  // Resolve skill name + full skill row for VFX classification
  const skill = latest?.skill_slug ? skills.find(s => s.slug === latest.skill_slug) : null;
  const lastSkillName = skill?.name ?? null;

  return (
    <BattleStage
      zoneId={me.snapshot?.zone_id}
      player={{
        name: 'YOU',
        level: me.snapshot.level,
        hp: me.hp, maxHp: me.max_hp, mp: me.energy, maxMp: me.max_energy,
        armorVariant: me.snapshot.equipped?.armor_variant,
        weaponVariant: me.snapshot.equipped?.weapon_variant,
        isPlayer: true, characterClass: me.snapshot.class,
      }}
      enemy={{
        name: enemy.snapshot.name,
        level: enemy.snapshot.level,
        hp: enemy.hp, maxHp: enemy.max_hp, mp: enemy.energy, maxMp: enemy.max_energy,
        armorVariant: enemy.snapshot.equipped?.armor_variant ?? 'medium_blue',
        weaponVariant: enemy.snapshot.equipped?.weapon_variant ?? 'sword',
        isPlayer: false,
      }}
      actionTick={actionTick}
      lastActor={lastActor}
      lastDamage={isHeal ? healAmt : (damage || null)}
      lastWasHeal={isHeal}
      lastSkillName={lastSkillName}
      lastSkill={skill}
      crit={crit}
      onAnimationComplete={onAnimationComplete}
    />
  );
}


function Fighter({ p, label, mine }: { p: ParticipantRow; label: string; mine?: boolean }) {
  const hpPct = (p.hp / p.max_hp) * 100;
  const enPct = (p.energy / p.max_energy) * 100;
  return (
    <div className={`p-3 border rounded ${mine ? 'border-primary' : 'border-destructive'}`}>
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-orbitron text-sm">{label}</span>
        <span className="text-xs text-muted-foreground">Lv {p.snapshot.level}{mine ? ` ${p.snapshot.class}` : ''}</span>
      </div>
      <div className="space-y-1">
        <div>
          <div className="flex justify-between text-[10px] font-rajdhani"><span>HP</span><span>{p.hp}/{p.max_hp}</span></div>
          <Progress value={hpPct} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between text-[10px] font-rajdhani"><span>MP</span><span>{p.energy}/{p.max_energy}</span></div>
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
  if (a.action_type === 'use_item') {
    if (a.result?.item === 'hp_potion') return `used HP Potion. Restored ${a.result.heal ?? 0} HP.`;
    if (a.result?.item === 'mp_potion') return `used MP Potion. Restored ${a.result.mpHeal ?? 0} MP.`;
    return 'used an item.';
  }
  const hits = a.result?.hits ?? [];
  const total = hits.reduce((s: number, h: any) => s + (h.damage ?? 0), 0);
  const crit = hits.some((h: any) => h.crit);
  const dodged = hits.some((h: any) => h.dodged);
  if (a.action_type === 'skill') return `used ${a.skill_slug} → ${total} dmg${crit ? ' CRIT!' : ''}${dodged ? ' (dodged)' : ''}`;
  return `attacked for ${total} dmg${crit ? ' CRIT!' : ''}${dodged ? ' (dodged)' : ''}`;
}
