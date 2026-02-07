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

const TURN_TIME = 15; // seconds per turn

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
        if (prev.turnTimer <= 1) {
          // Time's up — auto-defend for player, auto-attack for enemy
          return prev; // handled below
        }
        return { ...prev, turnTimer: prev.turnTimer - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [battleState.isAnimating, battleState.battleOver, battleState.turn]);

  // Auto-defend when player timer runs out
  useEffect(() => {
    if (battleState.turn === 'player' && battleState.turnTimer <= 0 && !battleState.isAnimating && !battleState.battleOver) {
      handleDefend();
    }
  }, [battleState.turnTimer, battleState.turn, battleState.isAnimating, battleState.battleOver]);

  const showTurnBanner = useCallback((text: string) => {
    setTurnBanner(text);
    setTimeout(() => setTurnBanner(null), 1500);
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

  // --- Core attack with full hit resolution ---
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

        // Show hit label
        let label = '';
        if (result.critical) label = 'CRITICAL!';
        if (result.blocked) label = 'BLOCKED!';
        if (result.deflected) label = 'DEFLECTED!';
        if (label) setHitLabel({ target: isPlayer ? 'enemy' : 'player', text: label });
        setTimeout(() => setHitLabel(null), 1200);

        setTargetHit(true);
        setTargetDamage(result.damage);

        // Build log
        const emoji = isPlayer ? '🗡️' : '💀';
        let logMsg = `${emoji} ${attackerChar.name} uses ${ability.name} for ${result.damage} damage!`;
        if (result.critical) logMsg += ' 💥 CRITICAL!';
        if (result.blocked) logMsg += ' 🛡️ Blocked!';
        if (result.deflected) logMsg += ' ↩️ Deflected!';

        const targetKey = isPlayer ? 'enemy' : 'player';
        const attackerKey = isPlayer ? 'player' : 'enemy';

        // Apply damage
        const newDefender = {
          ...defenderChar,
          stats: { ...defenderChar.stats, health: Math.max(0, defenderChar.stats.health - result.damage) },
        };

        // Energy drain
        const drainAmount = applyEnergyDrain(ability, defenderChar);
        if (drainAmount > 0) {
          newDefender.stats.energy = Math.max(0, newDefender.stats.energy - drainAmount);
          logMsg += ` ⚡ Drained ${drainAmount} energy!`;
        }

        // Apply status effect to defender
        const effect = applyAbilityEffect(ability, defenderChar);
        if (effect) {
          newDefender.statusEffects = [...newDefender.statusEffects, effect];
          logMsg += ` [${effect.type}]`;
        }

        // Rage gain
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
        }, 350);
      }, 300);
    }, 300);
  }, [checkBattleEnd]);

  // --- Switch turn helper ---
  const switchTurn = useCallback(() => {
    setBattleState(prev => {
      if (prev.battleOver) return prev;

      const nextTurn = prev.turn === 'player' ? 'enemy' : 'player';

      // Tick status effects & DOT at turn end
      const { char: tickedPlayer, dotDamage: playerDot } = tickStatusEffects(prev.player);
      const { char: tickedEnemy, dotDamage: enemyDot } = tickStatusEffects(prev.enemy);

      const logs = [...prev.combatLog];
      if (playerDot > 0) logs.push(`🔥 ${prev.player.name} takes ${playerDot} burn damage!`);
      if (enemyDot > 0) logs.push(`🔥 ${prev.enemy.name} takes ${enemyDot} burn damage!`);

      // Energy regen at turn start
      const regenAmount = 8;
      const nextChar = nextTurn === 'player' ? tickedPlayer : tickedEnemy;
      nextChar.stats.energy = Math.min(nextChar.stats.maxEnergy, nextChar.stats.energy + regenAmount);

      // Cooldown reduction for next turn's character
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

  // --- Player actions ---
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

    // Create a special rage ability
    const rageAbility: Ability = {
      id: 'rage-attack',
      name: 'Rage Unleashed',
      description: 'Devastating rage attack',
      energyCost: 0,
      baseDamage: 50,
      type: 'physical',
      scaleStat: 'strength',
      cooldown: 0,
      currentCooldown: 0,
    };

    // Reset rage after use
    setBattleState(prev => ({
      ...prev,
      player: { ...prev.player, rage: 0 },
    }));

    performAttack('player', rageAbility, switchTurn);
  }, [battleState, performAttack, switchTurn]);

  // --- Enemy AI ---
  useEffect(() => {
    if (battleState.turn !== 'enemy' || battleState.isAnimating || battleState.battleOver) return;

    const timer = setTimeout(() => {
      // Check stun
      if (isStunned(battleState.enemy)) {
        addLog(`💫 ${battleState.enemy.name} is stunned!`);
        switchTurn();
        return;
      }

      // Enemy rage check
      if (battleState.enemy.rage >= RAGE_THRESHOLD) {
        const rageAbility: Ability = {
          id: 'enemy-rage',
          name: 'Rage Unleashed',
          description: 'Devastating rage attack',
          energyCost: 0,
          baseDamage: 50,
          type: 'physical',
          scaleStat: 'strength',
          cooldown: 0,
          currentCooldown: 0,
        };
        setBattleState(prev => ({
          ...prev,
          enemy: { ...prev.enemy, rage: 0 },
        }));
        performAttack('enemy', rageAbility, switchTurn);
        return;
      }

      // AI: pick best available ability or defend
      const available = battleState.enemy.abilities.filter(
        a => a.currentCooldown === 0 && battleState.enemy.stats.energy >= a.energyCost
      );

      if (available.length === 0) {
        // Defend if no energy
        addLog(`🛡️ ${battleState.enemy.name} defends!`);
        setBattleState(prev => ({
          ...prev,
          enemy: { ...prev.enemy, isDefending: true },
        }));
        setTimeout(() => switchTurn(), 500);
        return;
      }

      // Pick strongest available ability with some randomness
      const sorted = [...available].sort((a, b) => b.baseDamage - a.baseDamage);
      const pick = Math.random() < 0.6 ? sorted[0] : sorted[Math.floor(Math.random() * sorted.length)];

      performAttack('enemy', pick, switchTurn);
    }, 800);

    return () => clearTimeout(timer);
  }, [battleState.turn, battleState.isAnimating, battleState.battleOver, battleState.enemy, performAttack, switchTurn, addLog]);

  // --- Battle end ---
  useEffect(() => {
    if (battleState.battleOver && battleState.winner) {
      const timer = setTimeout(() => onBattleEnd(battleState.winner!), 2500);
      return () => clearTimeout(timer);
    }
  }, [battleState.battleOver, battleState.winner, onBattleEnd]);

  const canAct = battleState.turn === 'player' && !battleState.isAnimating && !battleState.battleOver;

  return (
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4" style={{ background: 'hsl(var(--background))' }}>
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-lg border-2 border-border/60"
        style={{
          aspectRatio: '16 / 10',
          maxHeight: 'calc(100vh - 32px)',
          boxShadow: '0 0 40px hsl(var(--primary) / 0.1), 0 20px 60px hsl(0 0% 0% / 0.5)',
        }}
      >
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${battleArenaBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />

        {/* Turn banner + timer */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-center">
          <div
            className="px-6 py-1.5 font-orbitron text-xs sm:text-sm font-bold tracking-widest rounded-b-lg flex items-center gap-3"
            style={{
              background: battleState.turn === 'player'
                ? 'linear-gradient(180deg, hsl(var(--primary) / 0.9), hsl(var(--primary) / 0.6))'
                : 'linear-gradient(180deg, hsl(var(--accent) / 0.9), hsl(var(--accent) / 0.6))',
              color: battleState.turn === 'player'
                ? 'hsl(var(--primary-foreground))'
                : 'hsl(var(--accent-foreground))',
              boxShadow: battleState.turn === 'player'
                ? '0 4px 15px hsl(var(--primary) / 0.4)'
                : '0 4px 15px hsl(var(--accent) / 0.4)',
            }}
          >
            {battleState.turn === 'player' ? "YOUR TURN" : "ENEMY TURN"}
            <span className={`ml-1 font-mono text-sm ${battleState.turnTimer <= 5 ? 'text-accent animate-pulse' : ''}`}>
              {battleState.turnTimer}s
            </span>
          </div>
        </div>

        {/* Turn change flash */}
        {turnBanner && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-fade-in">
            <div
              className="font-orbitron text-4xl sm:text-5xl md:text-6xl font-black tracking-wider animate-scale-in"
              style={{
                color: battleState.turn === 'player' ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
                textShadow: `0 0 30px ${battleState.turn === 'player' ? 'hsl(var(--primary) / 0.8)' : 'hsl(var(--accent) / 0.8)'}`,
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
                color: hitLabel.text === 'CRITICAL!' ? 'hsl(var(--secondary))' : 'hsl(var(--primary))',
                textShadow: '0 0 20px currentColor',
              }}
            >
              {hitLabel.text}
            </div>
          </div>
        )}

        {/* HUD */}
        <div className="absolute top-8 left-3 right-3 z-10 flex justify-between items-start">
          <CharacterStatus character={battleState.player} isPlayer />
          <CharacterStatus character={battleState.enemy} isPlayer={false} />
        </div>

        {/* Characters */}
        <div className="absolute inset-0 flex items-end justify-center z-10 pb-[25%]">
          <div className="flex items-end justify-between w-full px-[10%] sm:px-[12%]">
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

        {/* Bottom panel */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="px-3 py-1">
            <CombatLog logs={battleState.combatLog} />
          </div>
          <div
            className="px-2 py-2.5 sm:py-3"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--card) / 0.95) 0%, hsl(var(--background) / 0.98) 100%)',
              borderTop: '2px solid hsl(var(--border) / 0.6)',
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
          <div className="absolute inset-0 bg-background/85 flex items-center justify-center z-50 animate-fade-in">
            <div className="text-center">
              <h2
                className={`font-orbitron text-5xl md:text-7xl font-black mb-3 ${
                  battleState.winner === 'player' ? 'text-primary' : 'text-accent'
                }`}
                style={{
                  textShadow: battleState.winner === 'player'
                    ? '0 0 30px hsl(var(--primary) / 0.8), 0 0 60px hsl(var(--primary) / 0.4)'
                    : '0 0 30px hsl(var(--accent) / 0.8), 0 0 60px hsl(var(--accent) / 0.4)',
                }}
              >
                {battleState.winner === 'player' ? 'VICTORY!' : 'DEFEAT!'}
              </h2>
              <p className="text-muted-foreground text-lg font-rajdhani">
                {battleState.winner === 'player' ? 'You have defeated your opponent!' : 'You have been defeated...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
