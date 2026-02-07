import { useState, useEffect, useCallback, useRef } from 'react';
import { Character, Ability, BattleState } from '@/types/game';
import {
  resolveAttack, calcRageGain, RAGE_THRESHOLD, applyAbilityEffect,
  applyEnergyDrain, tickStatusEffects, isStunned, calcFirstStrike,
} from '@/lib/combat';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';
import { CharacterStatus } from './battle/CharacterStatus';
import { AbilityPanel } from './battle/AbilityPanel';
import { CombatLog } from './battle/CombatLog';
import { BattleCharacter, AttackPhase } from './battle/BattleCharacter';
import { useBattleActions } from '@/hooks/useBattleActions';

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

  const {
    handleDefend, useAbility, handleRageAttack,
    performAttack, switchTurn, addLog, checkBattleEnd,
  } = useBattleActions({
    battleState, setBattleState,
    setPlayerAttackPhase, setEnemyAttackPhase,
    setPlayerHit, setEnemyHit,
    setPlayerDamage, setEnemyDamage,
    setHitLabel, TURN_TIME,
  });

  // Turn timer
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
  }, [battleState.turnTimer, battleState.turn, battleState.isAnimating, battleState.battleOver, handleDefend]);

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
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4" style={{ background: '#050510' }}>
      {/* EpicDuel game window */}
      <div
        className="relative w-full max-w-4xl overflow-hidden"
        style={{
          aspectRatio: '16 / 10',
          maxHeight: 'calc(100vh - 32px)',
          border: '2px solid #2a2a45',
          borderRadius: '4px',
          boxShadow: '0 0 40px rgba(0,0,0,0.9)',
          background: '#0a0a18',
        }}
      >
        {/* Background arena - full area */}
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${battleArenaBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 35%',
        }} />

        {/* Turn change flash overlay */}
        {turnBanner && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-fade-in">
            <div
              className="font-orbitron text-4xl sm:text-5xl md:text-6xl font-black tracking-wider animate-scale-in"
              style={{
                color: battleState.turn === 'player' ? '#00ddff' : '#ff4444',
                textShadow: `0 0 40px ${battleState.turn === 'player' ? 'rgba(0,200,255,0.8)' : 'rgba(255,50,50,0.8)'}`,
              }}
            >
              {turnBanner}
            </div>
          </div>
        )}

        {/* Hit label (CRITICAL/BLOCKED/DEFLECTED) */}
        {hitLabel && (
          <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
            <div
              className="font-orbitron text-2xl sm:text-3xl font-black animate-scale-in"
              style={{
                color: hitLabel.text === 'CRITICAL!' ? '#ff8800' : '#00ccff',
                textShadow: '0 0 20px currentColor, 0 0 40px currentColor',
              }}
            >
              {hitLabel.text}
            </div>
          </div>
        )}

        {/* Characters - centered in the arena */}
        <div className="absolute inset-0 flex items-end justify-center z-10" style={{ paddingBottom: '18%' }}>
          <div className="flex items-end justify-between w-full px-[10%] sm:px-[14%]">
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

        {/* ============ BOTTOM HUD PANEL (EpicDuel style - ALL UI here) ============ */}
        <div
          className="absolute bottom-0 left-0 right-0 z-20"
          style={{
            background: 'linear-gradient(180deg, rgba(8,8,20,0.92) 0%, rgba(5,5,15,0.98) 100%)',
            borderTop: '2px solid #2a2a45',
          }}
        >
          {/* Main HUD row: Skills | Player Stats | Turn Info | Enemy Stats */}
          <div className="flex items-center justify-between px-2 py-1.5 gap-2">
            {/* Left: Skills + Player Status */}
            <div className="flex items-center gap-3">
              <AbilityPanel
                abilities={battleState.player.abilities}
                playerEnergy={battleState.player.stats.energy}
                canAct={canAct}
                onUseAbility={useAbility}
                onDefend={handleDefend}
                rageReady={battleState.player.rage >= RAGE_THRESHOLD}
                onRageAttack={handleRageAttack}
              />
              <div className="w-px h-10 bg-[#2a2a45]" />
              <CharacterStatus character={battleState.player} isPlayer />
            </div>

            {/* Center: Turn indicator + timer */}
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div
                className="px-3 py-0.5 font-orbitron text-[9px] font-bold tracking-widest rounded-sm"
                style={{
                  background: battleState.turn === 'player' ? '#0a2a3a' : '#3a0a1a',
                  border: `1px solid ${battleState.turn === 'player' ? '#1a5a7a' : '#7a1a3a'}`,
                  color: battleState.turn === 'player' ? '#00ccff' : '#ff4444',
                }}
              >
                {battleState.turn === 'player' ? 'YOUR TURN' : 'ENEMY TURN'}
              </div>
              <span
                className={`font-orbitron text-xs font-bold ${battleState.turnTimer <= 5 ? 'animate-pulse' : ''}`}
                style={{ color: battleState.turnTimer <= 5 ? '#ff4444' : '#888899' }}
              >
                {battleState.turnTimer}s
              </span>
            </div>

            {/* Right: Enemy Status */}
            <CharacterStatus character={battleState.enemy} isPlayer={false} />
          </div>

          {/* Combat log strip at very bottom */}
          <div className="px-2 pb-1">
            <CombatLog logs={battleState.combatLog} />
          </div>
        </div>

        {/* Battle over overlay */}
        {battleState.battleOver && (
          <div className="absolute inset-0 flex items-center justify-center z-50 animate-fade-in"
            style={{ background: 'rgba(3,3,10,0.9)' }}>
            <div className="text-center">
              <h2
                className="font-orbitron text-5xl md:text-7xl font-black mb-3"
                style={{
                  color: battleState.winner === 'player' ? '#00ddff' : '#ff3333',
                  textShadow: battleState.winner === 'player'
                    ? '0 0 30px rgba(0,220,255,0.8), 0 0 60px rgba(0,220,255,0.4)'
                    : '0 0 30px rgba(255,50,50,0.8), 0 0 60px rgba(255,50,50,0.4)',
                }}
              >
                {battleState.winner === 'player' ? 'VICTORY!' : 'DEFEAT!'}
              </h2>
              <p className="font-rajdhani text-lg" style={{ color: '#888899' }}>
                {battleState.winner === 'player' ? 'You have defeated your opponent!' : 'You have been defeated...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
