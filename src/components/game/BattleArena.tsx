import { useState, useEffect, useCallback, useRef } from 'react';
import { Character, Ability, BattleState } from '@/types/game';
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

export const BattleArena = ({ player: initialPlayer, enemy: initialEnemy, onBattleEnd }: BattleArenaProps) => {
  const [battleState, setBattleState] = useState<BattleState>({
    player: { ...initialPlayer, stats: { ...initialPlayer.stats } },
    enemy: { ...initialEnemy, stats: { ...initialEnemy.stats } },
    turn: 'player',
    combatLog: ['⚔️ Battle begins!'],
    isAnimating: false,
    battleOver: false,
    winner: null,
  });

  const [playerAttackPhase, setPlayerAttackPhase] = useState<AttackPhase>('idle');
  const [enemyAttackPhase, setEnemyAttackPhase] = useState<AttackPhase>('idle');
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);
  const [playerDamage, setPlayerDamage] = useState<number | null>(null);
  const [enemyDamage, setEnemyDamage] = useState<number | null>(null);
  const [turnBanner, setTurnBanner] = useState<string | null>('YOUR TURN');

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

      const state = battleState;
      const attackerChar = isPlayer ? state.player : state.enemy;
      const defenderChar = isPlayer ? state.enemy : state.player;
      const baseDamage = ability.damage + attackerChar.stats.attack;
      const defense = defenderChar.stats.defense;
      const damage = Math.max(5, baseDamage - defense + Math.floor(Math.random() * 10));

      setTargetHit(true);
      setTargetDamage(damage);
      addLog(`${isPlayer ? '🗡️' : '💀'} ${attackerChar.name} uses ${ability.name} for ${damage} damage!`);

      setBattleState(prev => {
        const targetKey = isPlayer ? 'enemy' : 'player';
        const attackerKey = isPlayer ? 'player' : 'enemy';
        const newState = {
          ...prev,
          [attackerKey]: {
            ...prev[attackerKey],
            stats: { ...prev[attackerKey].stats, energy: Math.max(0, prev[attackerKey].stats.energy - ability.energyCost) },
            abilities: prev[attackerKey].abilities.map(a => a.id === ability.id ? { ...a, currentCooldown: a.cooldown } : a),
          },
          [targetKey]: {
            ...prev[targetKey],
            stats: { ...prev[targetKey].stats, health: Math.max(0, prev[targetKey].stats.health - damage) },
          },
          isAnimating: true,
        };
        return checkBattleEnd(newState as BattleState);
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
  }, [battleState, addLog, checkBattleEnd]);

  const useAbility = useCallback((ability: Ability) => {
    if (battleState.isAnimating || battleState.turn !== 'player' || battleState.battleOver) return;
    if (ability.currentCooldown > 0 || battleState.player.stats.energy < ability.energyCost) return;

    performAttack('player', ability, () => {
      setBattleState(prev => prev.battleOver ? prev : { ...prev, turn: 'enemy' as const });
    });
  }, [battleState, performAttack]);

  // Enemy AI
  useEffect(() => {
    if (battleState.turn !== 'enemy' || battleState.isAnimating || battleState.battleOver) return;

    const timer = setTimeout(() => {
      const available = battleState.enemy.abilities.filter(
        a => a.currentCooldown === 0 && battleState.enemy.stats.energy >= a.energyCost
      );
      const ability = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : battleState.enemy.abilities[0];

      performAttack('enemy', ability, () => {
        setBattleState(prev => {
          if (prev.battleOver) return prev;
          return {
            ...prev,
            player: {
              ...prev.player,
              stats: { ...prev.player.stats, energy: Math.min(prev.player.stats.maxEnergy, prev.player.stats.energy + 10) },
              abilities: prev.player.abilities.map(a => ({ ...a, currentCooldown: Math.max(0, a.currentCooldown - 1) })),
            },
            enemy: {
              ...prev.enemy,
              stats: { ...prev.enemy.stats, energy: Math.min(prev.enemy.stats.maxEnergy, prev.enemy.stats.energy + 10) },
              abilities: prev.enemy.abilities.map(a => ({ ...a, currentCooldown: Math.max(0, a.currentCooldown - 1) })),
            },
            turn: 'player' as const,
          };
        });
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [battleState.turn, battleState.isAnimating, battleState.battleOver, battleState.enemy, performAttack]);

  // Battle end
  useEffect(() => {
    if (battleState.battleOver && battleState.winner) {
      const timer = setTimeout(() => onBattleEnd(battleState.winner!), 2500);
      return () => clearTimeout(timer);
    }
  }, [battleState.battleOver, battleState.winner, onBattleEnd]);

  const canAct = battleState.turn === 'player' && !battleState.isAnimating && !battleState.battleOver;

  return (
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4" style={{ background: 'hsl(var(--background))' }}>
      {/* Game window container - like EpicDuel's contained game area */}
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-lg border-2 border-border/60"
        style={{
          aspectRatio: '16 / 10',
          maxHeight: 'calc(100vh - 32px)',
          boxShadow: '0 0 40px hsl(var(--primary) / 0.1), 0 20px 60px hsl(0 0% 0% / 0.5)',
        }}
      >
        {/* Background scene */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${battleArenaBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
        />
        {/* Scene overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />

        {/* ===== TURN BANNER (top center) ===== */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-center">
          <div
            className="px-6 py-1.5 font-orbitron text-xs sm:text-sm font-bold tracking-widest rounded-b-lg"
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
            {battleState.turn === 'player' ? "IT'S YOUR TURN!" : "ENEMY'S TURN"}
          </div>
        </div>

        {/* Turn change flash banner */}
        {turnBanner && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-fade-in">
            <div
              className="font-orbitron text-4xl sm:text-5xl md:text-6xl font-black tracking-wider animate-scale-in"
              style={{
                color: battleState.turn === 'player' ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
                textShadow: `0 0 30px ${battleState.turn === 'player' ? 'hsl(var(--primary) / 0.8)' : 'hsl(var(--accent) / 0.8)'}, 0 0 60px ${battleState.turn === 'player' ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--accent) / 0.4)'}`,
              }}
            >
              {turnBanner}
            </div>
          </div>
        )}

        {/* ===== HUD: HP/Energy bars ===== */}
        <div className="absolute top-8 left-3 right-3 z-10 flex justify-between items-start">
          <CharacterStatus character={battleState.player} isPlayer />
          <CharacterStatus character={battleState.enemy} isPlayer={false} />
        </div>

        {/* ===== BATTLE STAGE: Characters on ground ===== */}
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

        {/* ===== BOTTOM PANEL: Combat log + Skills ===== */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          {/* Combat log strip */}
          <div className="px-3 py-1">
            <CombatLog logs={battleState.combatLog} />
          </div>

          {/* Skill bar - like EpicDuel's bottom toolbar */}
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
            />
          </div>
        </div>

        {/* ===== BATTLE OVER OVERLAY ===== */}
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
