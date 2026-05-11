import { useState, useEffect, useCallback, useRef } from 'react';
import { Character, Ability, BattleState, BASIC_ATTACK } from '@/types/game';
import {
  resolveAttack,
  calcRageGains,
  RAGE_THRESHOLD,
  MAX_RAGE,
  RAGE_PER_TURN,
  applyRageDamageCap,
  applyAbilityEffect,
  applyInlineEffect,
  applyEnergyDrain,
  tickStatusEffects,
  isStunned,
  isSkillDisabled,
  calcFirstStrike,
} from '@/lib/combat';
import { RAGE_SKILLS } from '@/data/class-definitions';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';
import { CharacterStatus } from './battle/CharacterStatus';
import { AbilityPanel } from './battle/AbilityPanel';
import { CombatLog } from './battle/CombatLog';
import { AttackPhase } from './battle/BattleCharacter';
import { Battle3DScene } from './battle/Battle3DScene';

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
    playerRageUsed: false,
    enemyRageUsed: false,
  });

  const [playerAttackPhase, setPlayerAttackPhase] = useState<AttackPhase>('idle');
  const [enemyAttackPhase, setEnemyAttackPhase] = useState<AttackPhase>('idle');
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [playerDamage, setPlayerDamage] = useState<number | null>(null);
  const [enemyDamage, setEnemyDamage] = useState<number | null>(null);
  const [turnBanner, setTurnBanner] = useState<string | null>(firstTurn === 'player' ? 'YOUR TURN' : 'ENEMY TURN');
  const [hitLabel, setHitLabel] = useState<{ target: 'player' | 'enemy'; text: string } | null>(null);
  const [punchKey, setPunchKey] = useState(0);

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
        setPunchKey(k => k + 1);

        // Build log
        const emoji = isPlayer ? '🗡️' : '💀';
        let logMsg = `${emoji} ${attackerChar.name} uses ${ability.name} for ${result.damage} damage!`;
        if (result.critical) logMsg += ' 💥 CRITICAL!';
        if (result.blocked) logMsg += ' 🛡️ Blocked!';
        if (result.deflected) logMsg += ' ↩️ Deflected!';

        const targetKey = isPlayer ? 'enemy' : 'player';
        const attackerKey = isPlayer ? 'player' : 'enemy';

        // Build defender (damage applied later after rage cap check)
        const newDefender = {
          ...defenderChar,
          stats: { ...defenderChar.stats },
        };

        // Inline effects (heal, energy recovery, drain, cooldown increase)
        const inlineResult = applyInlineEffect(ability, attackerChar, defenderChar);
        if (inlineResult.defenderUpdate) {
          Object.assign(newDefender.stats, inlineResult.defenderUpdate);
        }
        if (inlineResult.log) logMsg += ` ${inlineResult.log}`;

        // Apply status effect (buff on attacker, debuff on defender)
        const effect = applyAbilityEffect(ability, defenderChar, attackerChar);
        if (effect) {
          // Buffs go on attacker, debuffs on defender
          const isBuff = ['buff_attack', 'defense_buff', 'crit_buff', 'damage_absorb', 'dodge', 'stat_buff_all', 'reflect'].includes(effect.type);
          if (isBuff) {
            // Will be applied to attacker below
          } else {
            newDefender.statusEffects = [...newDefender.statusEffects, effect];
          }
          logMsg += ` [${effect.type}]`;
        }

        // Cooldown increase effect
        if (ability.effect === 'cooldown_increase') {
          newDefender.abilities = newDefender.abilities?.map(a => ({
            ...a,
            currentCooldown: a.currentCooldown > 0 ? a.currentCooldown + 1 : a.currentCooldown,
          })) || [];
        }

        // Rage gain (new EpicDuel formulas)
        const isRageSkill = ability.id === 'rage-attack' || ability.id === 'enemy-rage';
        let finalDamage = result.damage;

        // Apply rage damage cap for rage skills
        if (isRageSkill) {
          finalDamage = applyRageDamageCap(result.damage, defenderChar.stats.health, defenderChar.stats.maxHealth);
        }

        // No rage from rage skills, DOT, self-damage, or pets
        const grantRage = !isRageSkill && ability.effect !== 'dot';
        const { attackerRage, defenderRage } = grantRage
          ? calcRageGains(
              finalDamage,
              attackerChar.stats.maxHealth,
              defenderChar.stats.maxHealth,
              attackerChar.stats.support,
              defenderChar.stats.support,
              result.blocked
            )
          : { attackerRage: 0, defenderRage: 0 };

        // Apply damage (use finalDamage for rage-capped)
        const newDefenderHP = Math.max(0, defenderChar.stats.health - finalDamage);

        const newAttacker = {
          ...attackerChar,
          stats: {
            ...attackerChar.stats,
            energy: Math.max(0, attackerChar.stats.energy - ability.energyCost),
            ...(inlineResult.attackerUpdate || {}),
          },
          abilities: attackerChar.abilities.map(a => a.id === ability.id ? { ...a, currentCooldown: a.cooldown } : a),
          rage: Math.min(MAX_RAGE, attackerChar.rage + attackerRage),
          isDefending: false,
          statusEffects: effect && ['buff_attack', 'defense_buff', 'crit_buff', 'damage_absorb', 'dodge', 'stat_buff_all', 'reflect'].includes(effect.type)
            ? [...attackerChar.statusEffects, effect]
            : attackerChar.statusEffects,
        };

        const newDefenderWithRage = {
          ...newDefender,
          stats: { ...newDefender.stats, health: newDefenderHP },
          rage: Math.min(MAX_RAGE, newDefender.rage + defenderRage),
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

      // Passive rage per turn (both players get +3)
      tickedPlayer.rage = Math.min(MAX_RAGE, tickedPlayer.rage + RAGE_PER_TURN);
      tickedEnemy.rage = Math.min(MAX_RAGE, tickedEnemy.rage + RAGE_PER_TURN);

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
    if (battleState.player.rage < RAGE_THRESHOLD || battleState.playerRageUsed) return;

    // Use class-specific rage skill
    const classRageSkill = RAGE_SKILLS[battleState.player.class];
    const rageAbility: Ability = {
      ...classRageSkill,
      id: 'rage-attack',
      currentCooldown: 0,
    };

    setBattleState(prev => ({
      ...prev,
      player: { ...prev.player, rage: 0 },
      playerRageUsed: true,
    }));

    performAttack('player', rageAbility, switchTurn);
  }, [battleState, performAttack, switchTurn]);

  // --- Enemy AI ---
  useEffect(() => {
    if (battleState.turn !== 'enemy' || battleState.isAnimating || battleState.battleOver) return;

    const timer = setTimeout(() => {
      if (isStunned(battleState.enemy)) {
        addLog(`💫 ${battleState.enemy.name} is stunned!`);
        switchTurn();
        return;
      }

      // Enemy rage check (once per battle)
      if (battleState.enemy.rage >= RAGE_THRESHOLD && !battleState.enemyRageUsed) {
        const classRageSkill = RAGE_SKILLS[battleState.enemy.class];
        const rageAbility: Ability = {
          ...classRageSkill,
          id: 'enemy-rage',
          currentCooldown: 0,
        };
        setBattleState(prev => ({
          ...prev,
          enemy: { ...prev.enemy, rage: 0 },
          enemyRageUsed: true,
        }));
        performAttack('enemy', rageAbility, switchTurn);
        return;
      }

      // AI: pick best available ability (filtered by level and unlock) or basic attack
      const available = battleState.enemy.abilities.filter(
        a => a.currentCooldown === 0 &&
             battleState.enemy.stats.energy >= a.energyCost &&
             (a.unlockLevel || 1) <= battleState.enemy.level &&
             (battleState.enemy.abilityLevels[a.id] || 0) > 0
      );

      if (available.length === 0) {
        // Use basic attack
        performAttack('enemy', { ...BASIC_ATTACK, currentCooldown: 0 }, switchTurn);
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
        <div className="absolute top-8 left-3 right-3 z-30 flex justify-between items-start pointer-events-none">
          <div className="pointer-events-auto"><CharacterStatus character={battleState.player} isPlayer /></div>
          <div className="pointer-events-auto"><CharacterStatus character={battleState.enemy} isPlayer={false} /></div>
        </div>

        {/* Pseudo-3D perspective floor grid overlaid on the bg */}
        <div className="absolute left-0 right-0 bottom-0 h-[42%] pointer-events-none stage-3d overflow-hidden">
          <svg
            viewBox="0 0 100 60"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full stage-floor-3d opacity-50"
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 7.5} x2="100" y2={i * 7.5}
                stroke="hsl(var(--primary))" strokeWidth="0.18" opacity={0.25 + i * 0.08} />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 8.33} y1="0" x2={i * 8.33} y2="60"
                stroke="hsl(var(--primary))" strokeWidth="0.12" opacity="0.35" />
            ))}
          </svg>
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, transparent 0%, hsl(0 0% 0% / 0.55) 100%)' }} />
        </div>

        {/* True 3D battle scene (react-three-fiber) */}
        <div key={punchKey} className="absolute inset-0 z-10 screen-punch">
          <Battle3DScene
            player={battleState.player}
            enemy={battleState.enemy}
            playerPhase={playerAttackPhase}
            enemyPhase={enemyAttackPhase}
            playerHit={playerHit}
            enemyHit={enemyHit}
          />
          {/* Floating damage numbers (DOM overlay) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-[18%]">
            <div className="relative w-0 h-0">
              {playerDamage !== null && (
                <div className="absolute -top-24 left-0 -translate-x-1/2 font-orbitron text-3xl font-black animate-damage-float"
                  style={{ color: 'hsl(var(--accent))', textShadow: '0 0 12px hsl(var(--accent) / 0.9), 2px 2px 0 rgba(0,0,0,0.7)' }}>
                  -{playerDamage}
                </div>
              )}
            </div>
            <div className="relative w-0 h-0">
              {enemyDamage !== null && (
                <div className="absolute -top-24 left-0 -translate-x-1/2 font-orbitron text-3xl font-black animate-damage-float"
                  style={{ color: 'hsl(var(--accent))', textShadow: '0 0 12px hsl(var(--accent) / 0.9), 2px 2px 0 rgba(0,0,0,0.7)' }}>
                  -{enemyDamage}
                </div>
              )}
            </div>
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
              playerLevel={battleState.player.level}
              abilityLevels={battleState.player.abilityLevels}
              canAct={canAct}
              onUseAbility={useAbility}
              onDefend={handleDefend}
              rageReady={battleState.player.rage >= RAGE_THRESHOLD && !battleState.playerRageUsed}
              onRageAttack={handleRageAttack}
              rageSkillName={RAGE_SKILLS[battleState.player.class]?.name}
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
