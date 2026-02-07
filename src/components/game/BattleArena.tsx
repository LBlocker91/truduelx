import { useState, useEffect, useCallback, useRef } from 'react';
import { Character, Ability, BattleState } from '@/types/game';
import {
  resolveAttack,
  calcRageGain,
  RAGE_THRESHOLD,
  applyAbilityEffect,
  applyEnergyDrain,
  tickStatusEffects,
  isStunned,
  calcFirstStrike,
} from '@/lib/combat';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';
import { CharacterStatus } from './battle/CharacterStatus';
import { AbilityPanel } from './battle/AbilityPanel';
import { CombatLog } from './battle/CombatLog';
import { BattleCharacter, AttackPhase } from './battle/BattleCharacter';

interface BattleArenaProps {
  player: Character;
  enemy: Character;
  onBattleEnd: (winner: 'player' | 'enemy') => void;
}

const TURN_TIME = 15;

export const BattleArena = ({ player: initialPlayer, enemy: initialEnemy, onBattleEnd }: BattleArenaProps) => {
  const firstTurn = calcFirstStrike(initialPlayer, initialEnemy);

  const [battleState, setBattleState] = useState<BattleState>({
    player: { ...initialPlayer, stats: { ...initialPlayer.stats }, statusEffects: [] },
    enemy: { ...initialEnemy, stats: { ...initialEnemy.stats }, statusEffects: [] },
    turn: firstTurn,
    combatLog: [`⚔️ Battle begins! ${firstTurn === 'player' ? 'You strike first!' : 'Enemy strikes first!'}`],
    isAnimating: false,
    battleOver: false,
    winner: null,
    turnTimer: TURN_TIME,
    turnNumber: 1,
  });

  const [playerAttackPhase, setPlayerAttackPhase] = useState<AttackPhase>('idle');
  const [enemyAttackPhase, setEnemyAttackPhase] = useState<AttackPhase>('idle');
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [playerDamage, setPlayerDamage] = useState<number | null>(null);
  const [enemyDamage, setEnemyDamage] = useState<number | null>(null);
  const [turnBanner, setTurnBanner] = useState<string | null>(firstTurn === 'player' ? 'YOUR TURN' : 'ENEMY TURN');
  const [hitLabel, setHitLabel] = useState<{ target: 'player' | 'enemy'; text: string } | null>(null);

  // --- Turn timer ---
  useEffect(() => {
    if (battleState.isAnimating || battleState.battleOver) return;
    const interval = setInterval(() => {
      setBattleState(prev => {
        if (prev.turnTimer <= 1) return prev;
        return { ...prev, turnTimer: prev.turnTimer - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [battleState.isAnimating, battleState.battleOver, battleState.turn]);

  useEffect(() => {
    if (battleState.turn === 'player' && battleState.turnTimer <= 0 && !battleState.isAnimating && !battleState.battleOver) {
      handleDefend();
    }
  }, [battleState.turnTimer, battleState.turn, battleState.isAnimating, battleState.battleOver]);

  const showTurnBanner = useCallback((text: string) => {
    setTurnBanner(text);
    setTimeout(() => setTurnBanner(null), 1200);
  }, []);

  const prevTurn = useRef(battleState.turn);
  useEffect(() => {
    if (prevTurn.current !== battleState.turn && !battleState.battleOver) {
      showTurnBanner(battleState.turn === 'player' ? 'YOUR TURN' : 'ENEMY TURN');
      prevTurn.current = battleState.turn;
    }
  }, [battleState.turn, battleState.battleOver, showTurnBanner]);

  const addLog = useCallback((message: string) => {
    setBattleState(prev => ({
      ...prev,
      combatLog: [...prev.combatLog.slice(-4), message],
    }));
  }, []);

  const checkBattleEnd = useCallback((state: BattleState): BattleState => {
    if (state.player.stats.health <= 0) return { ...state, battleOver: true, winner: 'enemy' };
    if (state.enemy.stats.health <= 0) return { ...state, battleOver: true, winner: 'player' };
    return state;
  }, []);

  const performAttack = useCallback((
    attacker: 'player' | 'enemy',
    ability: Ability,
    onComplete: () => void
  ) => {
    const isPlayer = attacker === 'player';
    const setAttackPhase = isPlayer ? setPlayerAttackPhase : setEnemyAttackPhase;
    const setTargetHit = isPlayer ? setEnemyHit : setPlayerHit;
    const setTargetDamage = isPlayer ? setEnemyDamage : setPlayerDamage;

    setBattleState(prev => ({ ...prev, isAnimating: true }));
    setAttackPhase('lunging');

    setTimeout(() => {
      setAttackPhase('striking');

      setBattleState(prev => {
        const attackerChar = isPlayer ? prev.player : prev.enemy;
        const defenderChar = isPlayer ? prev.enemy : prev.player;
        const result = resolveAttack(attackerChar, defenderChar, ability);

        let label = '';
        if (result.critical) label = 'CRITICAL!';
        if (result.blocked) label = 'BLOCKED!';
        if (result.deflected) label = 'DEFLECTED!';
        if (label) setHitLabel({ target: isPlayer ? 'enemy' : 'player', text: label });
        setTimeout(() => setHitLabel(null), 1200);

        setTargetHit(true);
        setTargetDamage(result.damage);

        const emoji = isPlayer ? '🗡️' : '💀';
        let logMsg = `${emoji} ${attackerChar.name} uses ${ability.name} for ${result.damage} damage!`;
        if (result.critical) logMsg += ' 💥 CRITICAL!';
        if (result.blocked) logMsg += ' 🛡️ Blocked!';
        if (result.deflected) logMsg += ' ↩️ Deflected!';

        const targetKey = isPlayer ? 'enemy' : 'player';
        const attackerKey = isPlayer ? 'player' : 'enemy';

        const newDefender = {
          ...defenderChar,
          stats: { ...defenderChar.stats, health: Math.max(0, defenderChar.stats.health - result.damage) },
        };

        const drainAmount = applyEnergyDrain(ability, defenderChar);
        if (drainAmount > 0) {
          newDefender.stats.energy = Math.max(0, newDefender.stats.energy - drainAmount);
          logMsg += ` ⚡ Drained ${drainAmount} energy!`;
        }

        const effect = applyAbilityEffect(ability, defenderChar);
        if (effect) {
          newDefender.statusEffects = [...newDefender.statusEffects, effect];
          logMsg += ` [${effect.type}]`;
        }

        const rageGain = calcRageGain(result.damage);
        const newAttacker = {
          ...attackerChar,
          stats: { ...attackerChar.stats, energy: Math.max(0, attackerChar.stats.energy - ability.energyCost) },
          abilities: attackerChar.abilities.map(a => a.id === ability.id ? { ...a, currentCooldown: a.cooldown } : a),
          rage: Math.min(attackerChar.maxRage, attackerChar.rage + rageGain),
          isDefending: false,
        };

        const newDefenderWithRage = {
          ...newDefender,
          rage: Math.min(newDefender.maxRage, newDefender.rage + Math.floor(rageGain * 0.5)),
        };

        const newState: BattleState = {
          ...prev,
          [attackerKey]: newAttacker,
          [targetKey]: newDefenderWithRage,
          combatLog: [...prev.combatLog.slice(-4), logMsg],
          isAnimating: true,
        };

        return checkBattleEnd(newState);
      });

      setTimeout(() => {
        setTargetHit(false);
        setTargetDamage(null);
        setAttackPhase('returning');
        setTimeout(() => {
          setAttackPhase('idle');
          setBattleState(prev => ({ ...prev, isAnimating: false }));
          onComplete();
        }, 300);
      }, 250);
    }, 250);
  }, [checkBattleEnd]);

  const switchTurn = useCallback(() => {
    setBattleState(prev => {
      if (prev.battleOver) return prev;
      const nextTurn = prev.turn === 'player' ? 'enemy' : 'player';
      const { char: tickedPlayer, dotDamage: playerDot } = tickStatusEffects(prev.player);
      const { char: tickedEnemy, dotDamage: enemyDot } = tickStatusEffects(prev.enemy);
      const logs = [...prev.combatLog];
      if (playerDot > 0) logs.push(`🔥 ${prev.player.name} takes ${playerDot} burn damage!`);
      if (enemyDot > 0) logs.push(`🔥 ${prev.enemy.name} takes ${enemyDot} burn damage!`);
      const regenAmount = 8;
      const nextChar = nextTurn === 'player' ? tickedPlayer : tickedEnemy;
      nextChar.stats.energy = Math.min(nextChar.stats.maxEnergy, nextChar.stats.energy + regenAmount);
      nextChar.abilities = nextChar.abilities.map(a => ({
        ...a,
        currentCooldown: Math.max(0, a.currentCooldown - 1),
      }));
      const newState: BattleState = {
        ...prev,
        player: nextTurn === 'player' ? nextChar : tickedPlayer,
        enemy: nextTurn === 'enemy' ? nextChar : tickedEnemy,
        turn: nextTurn,
        combatLog: logs.slice(-5),
        turnTimer: TURN_TIME,
        turnNumber: prev.turnNumber + 1,
      };
      return checkBattleEnd(newState);
    });
  }, [checkBattleEnd]);

  const useAbility = useCallback((ability: Ability) => {
    if (battleState.isAnimating || battleState.turn !== 'player' || battleState.battleOver) return;
    if (ability.currentCooldown > 0 || battleState.player.stats.energy < ability.energyCost) return;
    if (isStunned(battleState.player)) {
      addLog('💫 You are stunned and cannot act!');
      switchTurn();
      return;
    }
    performAttack('player', ability, switchTurn);
  }, [battleState, performAttack, switchTurn, addLog]);

  const handleDefend = useCallback(() => {
    if (battleState.isAnimating || battleState.turn !== 'player' || battleState.battleOver) return;
    setBattleState(prev => ({
      ...prev,
      player: { ...prev.player, isDefending: true },
      combatLog: [...prev.combatLog.slice(-4), '🛡️ You take a defensive stance! (-50% damage)'],
    }));
    setTimeout(() => switchTurn(), 500);
  }, [battleState, switchTurn]);

  const handleRageAttack = useCallback(() => {
    if (battleState.isAnimating || battleState.turn !== 'player' || battleState.battleOver) return;
    if (battleState.player.rage < RAGE_THRESHOLD) return;
    const rageAbility: Ability = {
      id: 'rage-attack', name: 'Rage Unleashed', description: 'Devastating rage attack',
      energyCost: 0, baseDamage: 50, type: 'physical', scaleStat: 'strength', cooldown: 0, currentCooldown: 0,
    };
    setBattleState(prev => ({ ...prev, player: { ...prev.player, rage: 0 } }));
    performAttack('player', rageAbility, switchTurn);
  }, [battleState, performAttack, switchTurn]);

  // Enemy AI
  useEffect(() => {
    if (battleState.turn !== 'enemy' || battleState.isAnimating || battleState.battleOver) return;
    const timer = setTimeout(() => {
      if (isStunned(battleState.enemy)) {
        addLog(`💫 ${battleState.enemy.name} is stunned!`);
        switchTurn();
        return;
      }
      if (battleState.enemy.rage >= RAGE_THRESHOLD) {
        const rageAbility: Ability = {
          id: 'enemy-rage', name: 'Rage Unleashed', description: 'Devastating rage attack',
          energyCost: 0, baseDamage: 50, type: 'physical', scaleStat: 'strength', cooldown: 0, currentCooldown: 0,
        };
        setBattleState(prev => ({ ...prev, enemy: { ...prev.enemy, rage: 0 } }));
        performAttack('enemy', rageAbility, switchTurn);
        return;
      }
      const available = battleState.enemy.abilities.filter(
        a => a.currentCooldown === 0 && battleState.enemy.stats.energy >= a.energyCost
      );
      if (available.length === 0) {
        addLog(`🛡️ ${battleState.enemy.name} defends!`);
        setBattleState(prev => ({ ...prev, enemy: { ...prev.enemy, isDefending: true } }));
        setTimeout(() => switchTurn(), 500);
        return;
      }
      const sorted = [...available].sort((a, b) => b.baseDamage - a.baseDamage);
      const pick = Math.random() < 0.6 ? sorted[0] : sorted[Math.floor(Math.random() * sorted.length)];
      performAttack('enemy', pick, switchTurn);
    }, 800);
    return () => clearTimeout(timer);
  }, [battleState.turn, battleState.isAnimating, battleState.battleOver, battleState.enemy, performAttack, switchTurn, addLog]);

  // Battle end
  useEffect(() => {
    if (battleState.battleOver && battleState.winner) {
      const timer = setTimeout(() => onBattleEnd(battleState.winner!), 2500);
      return () => clearTimeout(timer);
    }
  }, [battleState.battleOver, battleState.winner, onBattleEnd]);

  const canAct = battleState.turn === 'player' && !battleState.isAnimating && !battleState.battleOver;

  return (
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4" style={{ background: '#0a0a12' }}>
      {/* EpicDuel-style game window with metallic border */}
      <div
        className="relative w-full max-w-4xl overflow-hidden"
        style={{
          aspectRatio: '16 / 10',
          maxHeight: 'calc(100vh - 32px)',
          border: '3px solid hsl(230 20% 28%)',
          borderRadius: '6px',
          boxShadow: '0 0 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.3)',
          background: '#0d0d1a',
        }}
      >
        {/* Background arena */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${battleArenaBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
        />
        {/* Slight vignette overlay */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }} />

        {/* Top HUD bar - metallic dark strip */}
        <div
          className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between px-3 pt-2"
          style={{
            background: 'linear-gradient(180deg, rgba(10,10,20,0.85) 0%, rgba(10,10,20,0.4) 80%, transparent 100%)',
            paddingBottom: '12px',
          }}
        >
          <CharacterStatus character={battleState.player} isPlayer />

          {/* Center: Turn indicator + timer */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <div
              className="px-4 py-1 font-orbitron text-[10px] sm:text-xs font-bold tracking-widest"
              style={{
                background: battleState.turn === 'player'
                  ? 'linear-gradient(180deg, hsl(185 80% 30%) 0%, hsl(185 60% 20%) 100%)'
                  : 'linear-gradient(180deg, hsl(340 80% 30%) 0%, hsl(340 60% 20%) 100%)',
                border: `1.5px solid ${battleState.turn === 'player' ? 'hsl(185 60% 50%)' : 'hsl(340 60% 50%)'}`,
                borderRadius: '3px',
                color: 'white',
              }}
            >
              {battleState.turn === 'player' ? "YOUR TURN" : "ENEMY TURN"}
            </div>
            <span
              className={`font-orbitron text-sm font-bold ${battleState.turnTimer <= 5 ? 'animate-pulse' : ''}`}
              style={{
                color: battleState.turnTimer <= 5 ? 'hsl(var(--accent))' : 'hsl(var(--foreground))',
                textShadow: '0 0 6px rgba(0,0,0,0.8)',
              }}
            >
              {battleState.turnTimer}
            </span>
          </div>

          <CharacterStatus character={battleState.enemy} isPlayer={false} />
        </div>

        {/* Turn change flash */}
        {turnBanner && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-fade-in">
            <div
              className="font-orbitron text-4xl sm:text-5xl md:text-6xl font-black tracking-wider animate-scale-in"
              style={{
                color: battleState.turn === 'player' ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
                textShadow: `0 0 30px ${battleState.turn === 'player' ? 'hsl(185 100% 50% / 0.8)' : 'hsl(340 100% 60% / 0.8)'}`,
              }}
            >
              {turnBanner}
            </div>
          </div>
        )}

        {/* Hit label */}
        {hitLabel && (
          <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
            <div
              className="font-orbitron text-2xl sm:text-3xl font-black animate-scale-in"
              style={{
                color: hitLabel.text === 'CRITICAL!' ? '#ff6b00' : '#00e5ff',
                textShadow: '0 0 20px currentColor, 0 0 40px currentColor',
              }}
            >
              {hitLabel.text}
            </div>
          </div>
        )}

        {/* Characters on the battlefield - positioned like EpicDuel side-view */}
        <div className="absolute inset-0 flex items-end justify-center z-10" style={{ paddingBottom: '22%' }}>
          <div className="flex items-end justify-between w-full px-[8%] sm:px-[10%]">
            <BattleCharacter
              character={battleState.player}
              isPlayer
              attackPhase={playerAttackPhase}
              isBeingHit={playerHit}
              damageNumber={playerDamage}
            />
            <BattleCharacter
              character={battleState.enemy}
              isPlayer={false}
              attackPhase={enemyAttackPhase}
              isBeingHit={enemyHit}
              damageNumber={enemyDamage}
            />
          </div>
        </div>

        {/* Bottom panel - EpicDuel style dark panel with combat log + skills */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          {/* Combat log strip */}
          <div className="px-2 pb-1">
            <CombatLog logs={battleState.combatLog} />
          </div>

          {/* Skill bar - dark metallic panel */}
          <div
            className="px-2 py-2"
            style={{
              background: 'linear-gradient(180deg, hsl(230 30% 10%) 0%, hsl(230 35% 6%) 100%)',
              borderTop: '2px solid hsl(230 20% 22%)',
            }}
          >
            <AbilityPanel
              abilities={battleState.player.abilities}
              playerEnergy={battleState.player.stats.energy}
              canAct={canAct}
              onUseAbility={useAbility}
              onDefend={handleDefend}
              rageReady={battleState.player.rage >= RAGE_THRESHOLD}
              onRageAttack={handleRageAttack}
            />
          </div>
        </div>

        {/* Battle over overlay */}
        {battleState.battleOver && (
          <div className="absolute inset-0 flex items-center justify-center z-50 animate-fade-in"
            style={{ background: 'rgba(5,5,15,0.88)' }}>
            <div className="text-center">
              <h2
                className="font-orbitron text-5xl md:text-7xl font-black mb-3"
                style={{
                  color: battleState.winner === 'player' ? '#00e5ff' : '#ff4444',
                  textShadow: battleState.winner === 'player'
                    ? '0 0 30px rgba(0,229,255,0.8), 0 0 60px rgba(0,229,255,0.4)'
                    : '0 0 30px rgba(255,68,68,0.8), 0 0 60px rgba(255,68,68,0.4)',
                }}
              >
                {battleState.winner === 'player' ? 'VICTORY!' : 'DEFEAT!'}
              </h2>
              <p className="font-rajdhani text-lg" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {battleState.winner === 'player' ? 'You have defeated your opponent!' : 'You have been defeated...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
