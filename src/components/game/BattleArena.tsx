import { useState, useEffect, useCallback, useRef } from 'react';
import { Character, Ability, BattleState } from '@/types/game';
import { Swords } from 'lucide-react';
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
  const [turnBanner, setTurnBanner] = useState<string | null>(null);

  const showTurnBanner = useCallback((text: string) => {
    setTurnBanner(text);
    setTimeout(() => setTurnBanner(null), 1200);
  }, []);

  // Show turn banner on turn change
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
    if (state.player.stats.health <= 0) {
      return { ...state, battleOver: true, winner: 'enemy' };
    }
    if (state.enemy.stats.health <= 0) {
      return { ...state, battleOver: true, winner: 'player' };
    }
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

    // Phase 1: Lunge toward enemy
    setAttackPhase('lunging');

    setTimeout(() => {
      // Phase 2: Strike - flash enemy + show damage
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

      // Apply damage to state
      setBattleState(prev => {
        const targetKey = isPlayer ? 'enemy' : 'player';
        const attackerKey = isPlayer ? 'player' : 'enemy';
        const newState = {
          ...prev,
          [attackerKey]: {
            ...prev[attackerKey],
            stats: {
              ...prev[attackerKey].stats,
              energy: Math.max(0, prev[attackerKey].stats.energy - ability.energyCost),
            },
            abilities: prev[attackerKey].abilities.map(a =>
              a.id === ability.id ? { ...a, currentCooldown: a.cooldown } : a
            ),
          },
          [targetKey]: {
            ...prev[targetKey],
            stats: {
              ...prev[targetKey].stats,
              health: Math.max(0, prev[targetKey].stats.health - damage),
            },
          },
          isAnimating: true,
        };
        return checkBattleEnd(newState as BattleState);
      });

      setTimeout(() => {
        setTargetHit(false);
        setTargetDamage(null);
        // Phase 3: Return to position
        setAttackPhase('returning');

        setTimeout(() => {
          setAttackPhase('idle');
          setBattleState(prev => ({ ...prev, isAnimating: false }));
          onComplete();
        }, 400);
      }, 350);
    }, 350);
  }, [battleState, addLog, checkBattleEnd]);

  const useAbility = useCallback((ability: Ability) => {
    if (battleState.isAnimating || battleState.turn !== 'player' || battleState.battleOver) return;
    if (ability.currentCooldown > 0) return;
    if (battleState.player.stats.energy < ability.energyCost) return;

    performAttack('player', ability, () => {
      setBattleState(prev => {
        if (prev.battleOver) return prev;
        return { ...prev, turn: 'enemy' as const };
      });
    });
  }, [battleState, performAttack]);

  // Enemy AI turn
  useEffect(() => {
    if (battleState.turn !== 'enemy' || battleState.isAnimating || battleState.battleOver) return;

    const timer = setTimeout(() => {
      const availableAbilities = battleState.enemy.abilities.filter(
        a => a.currentCooldown === 0 && battleState.enemy.stats.energy >= a.energyCost
      );
      const ability = availableAbilities.length > 0
        ? availableAbilities[Math.floor(Math.random() * availableAbilities.length)]
        : battleState.enemy.abilities[0];

      performAttack('enemy', ability, () => {
        // Reduce cooldowns and regenerate energy for both
        setBattleState(prev => {
          if (prev.battleOver) return prev;
          return {
            ...prev,
            player: {
              ...prev.player,
              stats: {
                ...prev.player.stats,
                energy: Math.min(prev.player.stats.maxEnergy, prev.player.stats.energy + 10),
              },
              abilities: prev.player.abilities.map(a => ({
                ...a, currentCooldown: Math.max(0, a.currentCooldown - 1),
              })),
            },
            enemy: {
              ...prev.enemy,
              stats: {
                ...prev.enemy.stats,
                energy: Math.min(prev.enemy.stats.maxEnergy, prev.enemy.stats.energy + 10),
              },
              abilities: prev.enemy.abilities.map(a => ({
                ...a, currentCooldown: Math.max(0, a.currentCooldown - 1),
              })),
            },
            turn: 'player' as const,
          };
        });
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [battleState.turn, battleState.isAnimating, battleState.battleOver, battleState.enemy, performAttack]);

  // Handle battle end
  useEffect(() => {
    if (battleState.battleOver && battleState.winner) {
      const timer = setTimeout(() => {
        onBattleEnd(battleState.winner!);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [battleState.battleOver, battleState.winner, onBattleEnd]);

  const canAct = battleState.turn === 'player' && !battleState.isAnimating && !battleState.battleOver;

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url(${battleArenaBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
      }}
    >
      {/* Darkening overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/70" />

      <div className="relative z-10 flex-1 flex flex-col max-w-6xl mx-auto w-full">
        {/* Top HUD: HP bars in corners + turn indicator center */}
        <div className="flex items-start justify-between p-4 gap-2">
          <CharacterStatus character={battleState.player} isPlayer />
          <div className="flex-shrink-0 pt-2">
            <div className={`font-orbitron text-xs px-3 py-1.5 rounded-full border ${
              battleState.turn === 'player'
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-accent/50 bg-accent/10 text-accent'
            }`}>
              {battleState.turn === 'player' ? '⚔️ YOUR TURN' : '⏳ ENEMY TURN'}
            </div>
          </div>
          <CharacterStatus character={battleState.enemy} isPlayer={false} />
        </div>

        {/* Turn banner overlay */}
        {turnBanner && (
          <div className="absolute top-1/3 left-0 right-0 z-30 flex justify-center pointer-events-none">
            <div className="font-orbitron text-4xl md:text-5xl font-black tracking-wider animate-scale-in"
              style={{
                color: battleState.turn === 'player' ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
                textShadow: battleState.turn === 'player'
                  ? '0 0 20px hsl(var(--primary) / 0.8), 0 0 40px hsl(var(--primary) / 0.4)'
                  : '0 0 20px hsl(var(--accent) / 0.8), 0 0 40px hsl(var(--accent) / 0.4)',
              }}
            >
              {turnBanner}
            </div>
          </div>
        )}

        {/* Battle stage - characters on ground plane */}
        <div className="flex-1 flex items-end justify-center pb-4 relative">
          {/* Ground plane */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/90 to-transparent" />
          
          <div className="flex items-end justify-between w-full px-8 md:px-16 relative z-10" style={{ maxWidth: '900px' }}>
            {/* Player character */}
            <BattleCharacter
              character={battleState.player}
              isPlayer
              attackPhase={playerAttackPhase}
              isBeingHit={playerHit}
              damageNumber={playerDamage}
            />

            {/* VS indicator */}
            <div className="flex flex-col items-center mb-12 opacity-40">
              <Swords className="w-8 h-8 text-muted-foreground" />
            </div>

            {/* Enemy character */}
            <BattleCharacter
              character={battleState.enemy}
              isPlayer={false}
              attackPhase={enemyAttackPhase}
              isBeingHit={enemyHit}
              damageNumber={enemyDamage}
            />
          </div>
        </div>

        {/* Bottom panel: combat log + abilities */}
        <div className="p-4 space-y-3">
          <CombatLog logs={battleState.combatLog} />
          <AbilityPanel
            abilities={battleState.player.abilities}
            playerEnergy={battleState.player.stats.energy}
            canAct={canAct}
            onUseAbility={useAbility}
          />
        </div>

        {/* Battle Over Overlay */}
        {battleState.battleOver && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="text-center">
              <h2 className={`font-orbitron text-5xl md:text-6xl font-black mb-4 ${
                battleState.winner === 'player' ? 'text-primary text-glow-cyan' : 'text-accent text-glow-red'  // custom glow class, not raw color
              }`}>
                {battleState.winner === 'player' ? 'VICTORY!' : 'DEFEAT!'}
              </h2>
              <p className="text-muted-foreground text-lg">
                {battleState.winner === 'player'
                  ? 'You have defeated your opponent!'
                  : 'You have been defeated...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
