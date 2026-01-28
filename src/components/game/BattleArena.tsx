import { useState, useEffect, useCallback } from 'react';
import { Character, Ability, BattleState } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Heart, Zap, Swords, Shield, Clock } from 'lucide-react';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';

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

  const [playerAnimating, setPlayerAnimating] = useState(false);
  const [enemyAnimating, setEnemyAnimating] = useState(false);
  const [damageNumbers, setDamageNumbers] = useState<{ id: number; value: number; isPlayer: boolean }[]>([]);

  const addLog = useCallback((message: string) => {
    setBattleState(prev => ({
      ...prev,
      combatLog: [...prev.combatLog.slice(-4), message],
    }));
  }, []);

  const showDamage = useCallback((damage: number, isPlayer: boolean) => {
    const id = Date.now();
    setDamageNumbers(prev => [...prev, { id, value: damage, isPlayer }]);
    setTimeout(() => {
      setDamageNumbers(prev => prev.filter(d => d.id !== id));
    }, 1000);
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

  const useAbility = useCallback((ability: Ability) => {
    if (battleState.isAnimating || battleState.turn !== 'player' || battleState.battleOver) return;
    if (ability.currentCooldown > 0) return;
    if (battleState.player.stats.energy < ability.energyCost) return;

    setBattleState(prev => ({ ...prev, isAnimating: true }));
    setPlayerAnimating(true);

    // Calculate damage
    const baseDamage = ability.damage + battleState.player.stats.attack;
    const defense = battleState.enemy.stats.defense;
    const damage = Math.max(5, baseDamage - defense + Math.floor(Math.random() * 10));

    setTimeout(() => {
      setPlayerAnimating(false);
      setEnemyAnimating(true);
      showDamage(damage, false);

      setBattleState(prev => {
        const newState = {
          ...prev,
          player: {
            ...prev.player,
            stats: {
              ...prev.player.stats,
              energy: prev.player.stats.energy - ability.energyCost,
            },
            abilities: prev.player.abilities.map(a => 
              a.id === ability.id ? { ...a, currentCooldown: a.cooldown } : a
            ),
          },
          enemy: {
            ...prev.enemy,
            stats: {
              ...prev.enemy.stats,
              health: Math.max(0, prev.enemy.stats.health - damage),
            },
          },
          turn: 'enemy' as const,
          isAnimating: true,
        };

        addLog(`🗡️ ${prev.player.name} uses ${ability.name} for ${damage} damage!`);
        return checkBattleEnd(newState);
      });

      setTimeout(() => {
        setEnemyAnimating(false);
        setBattleState(prev => {
          if (prev.battleOver) {
            return { ...prev, isAnimating: false };
          }
          return { ...prev, isAnimating: false };
        });
      }, 300);
    }, 500);
  }, [battleState, addLog, showDamage, checkBattleEnd]);

  // Enemy AI turn
  useEffect(() => {
    if (battleState.turn !== 'enemy' || battleState.isAnimating || battleState.battleOver) return;

    const timer = setTimeout(() => {
      setBattleState(prev => ({ ...prev, isAnimating: true }));
      setEnemyAnimating(true);

      // Pick a random available ability
      const availableAbilities = battleState.enemy.abilities.filter(
        a => a.currentCooldown === 0 && battleState.enemy.stats.energy >= a.energyCost
      );
      
      const ability = availableAbilities.length > 0
        ? availableAbilities[Math.floor(Math.random() * availableAbilities.length)]
        : battleState.enemy.abilities[0];

      const baseDamage = ability.damage + battleState.enemy.stats.attack;
      const defense = battleState.player.stats.defense;
      const damage = Math.max(5, baseDamage - defense + Math.floor(Math.random() * 10));

      setTimeout(() => {
        setEnemyAnimating(false);
        setPlayerAnimating(true);
        showDamage(damage, true);

        setBattleState(prev => {
          const newState = {
            ...prev,
            enemy: {
              ...prev.enemy,
              stats: {
                ...prev.enemy.stats,
                energy: Math.max(0, prev.enemy.stats.energy - ability.energyCost),
              },
              abilities: prev.enemy.abilities.map(a => 
                a.id === ability.id ? { ...a, currentCooldown: a.cooldown } : a
              ),
            },
            player: {
              ...prev.player,
              stats: {
                ...prev.player.stats,
                health: Math.max(0, prev.player.stats.health - damage),
              },
            },
            turn: 'player' as const,
            isAnimating: true,
          };

          addLog(`💀 ${prev.enemy.name} uses ${ability.name} for ${damage} damage!`);
          return checkBattleEnd(newState);
        });

        setTimeout(() => {
          setPlayerAnimating(false);
          
          // Reduce cooldowns and regenerate energy
          setBattleState(prev => ({
            ...prev,
            player: {
              ...prev.player,
              stats: {
                ...prev.player.stats,
                energy: Math.min(prev.player.stats.maxEnergy, prev.player.stats.energy + 10),
              },
              abilities: prev.player.abilities.map(a => ({
                ...a,
                currentCooldown: Math.max(0, a.currentCooldown - 1),
              })),
            },
            enemy: {
              ...prev.enemy,
              stats: {
                ...prev.enemy.stats,
                energy: Math.min(prev.enemy.stats.maxEnergy, prev.enemy.stats.energy + 10),
              },
              abilities: prev.enemy.abilities.map(a => ({
                ...a,
                currentCooldown: Math.max(0, a.currentCooldown - 1),
              })),
            },
            isAnimating: false,
          }));
        }, 300);
      }, 500);
    }, 1000);

    return () => clearTimeout(timer);
  }, [battleState.turn, battleState.isAnimating, battleState.battleOver, battleState.enemy, addLog, showDamage, checkBattleEnd]);

  // Handle battle end
  useEffect(() => {
    if (battleState.battleOver && battleState.winner) {
      const timer = setTimeout(() => {
        onBattleEnd(battleState.winner!);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [battleState.battleOver, battleState.winner, onBattleEnd]);

  return (
    <div 
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url(${battleArenaBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60" />

      {/* Battle Area */}
      <div className="relative z-10 flex-1 flex flex-col p-4 max-w-6xl mx-auto w-full">
        {/* Health Bars */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <CharacterStatus character={battleState.player} isPlayer />
          <div className="font-orbitron text-sm text-muted-foreground px-4 py-2 game-card rounded">
            {battleState.turn === 'player' ? '⚔️ YOUR TURN' : '⏳ ENEMY TURN'}
          </div>
          <CharacterStatus character={battleState.enemy} isPlayer={false} />
        </div>

        {/* Characters */}
        <div className="flex-1 flex items-center justify-between px-8 relative">
          {/* Damage Numbers */}
          {damageNumbers.map(dn => (
            <div
              key={dn.id}
              className={`absolute font-orbitron text-3xl font-black animate-slide-up ${
                dn.isPlayer ? 'left-1/4' : 'right-1/4'
              } text-accent`}
              style={{ top: '30%' }}
            >
              -{dn.value}
            </div>
          ))}

          {/* Player Character */}
          <div 
            className={`relative transition-transform duration-300 ${
              playerAnimating ? 'animate-damage' : ''
            } ${battleState.turn === 'player' && !battleState.isAnimating ? 'animate-attack-left' : ''}`}
          >
            <div className="relative">
              <img
                src={battleState.player.image}
                alt={battleState.player.name}
                className="h-64 md:h-80 object-contain drop-shadow-2xl"
              />
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-card/90 px-4 py-1 rounded-full border border-primary">
                <span className="font-orbitron text-sm text-primary">{battleState.player.name}</span>
              </div>
            </div>
          </div>

          {/* VS Icon */}
          <div className="flex flex-col items-center gap-2">
            <Swords className="w-12 h-12 text-secondary animate-pulse-glow" />
            <span className="font-orbitron text-2xl font-black text-secondary">VS</span>
          </div>

          {/* Enemy Character */}
          <div 
            className={`relative transition-transform duration-300 ${
              enemyAnimating ? 'animate-damage' : ''
            } ${battleState.turn === 'enemy' && !battleState.isAnimating ? 'animate-attack-right' : ''}`}
          >
            <div className="relative transform -scale-x-100">
              <img
                src={battleState.enemy.image}
                alt={battleState.enemy.name}
                className="h-64 md:h-80 object-contain drop-shadow-2xl"
              />
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-card/90 px-4 py-1 rounded-full border border-accent">
              <span className="font-orbitron text-sm text-accent">{battleState.enemy.name}</span>
            </div>
          </div>
        </div>

        {/* Combat Log */}
        <div className="game-card rounded-lg p-3 mb-4 max-h-24 overflow-hidden">
          <div className="space-y-1">
            {battleState.combatLog.map((log, i) => (
              <p key={i} className="text-sm text-muted-foreground font-rajdhani animate-fade-in">
                {log}
              </p>
            ))}
          </div>
        </div>

        {/* Abilities */}
        <div className="game-card rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {battleState.player.abilities.map((ability) => {
              const canUse = 
                ability.currentCooldown === 0 && 
                battleState.player.stats.energy >= ability.energyCost &&
                battleState.turn === 'player' &&
                !battleState.isAnimating &&
                !battleState.battleOver;

              return (
                <Button
                  key={ability.id}
                  onClick={() => useAbility(ability)}
                  disabled={!canUse}
                  className={`relative h-auto py-3 px-4 flex flex-col items-start gap-1 transition-all ${
                    canUse 
                      ? 'game-card-hover hover:scale-105' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  variant="outline"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-orbitron text-sm font-bold text-foreground">
                      {ability.name}
                    </span>
                    {ability.currentCooldown > 0 && (
                      <span className="flex items-center gap-1 text-accent text-xs">
                        <Clock className="w-3 h-3" />
                        {ability.currentCooldown}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-secondary">
                      <Swords className="w-3 h-3" />
                      {ability.damage}
                    </span>
                    <span className="flex items-center gap-1 text-energy">
                      <Zap className="w-3 h-3" />
                      {ability.energyCost}
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Battle Over Overlay */}
        {battleState.battleOver && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50 animate-fade-in">
            <div className="text-center">
              <h2 className={`font-orbitron text-5xl font-black mb-4 ${
                battleState.winner === 'player' ? 'text-primary text-glow-cyan' : 'text-accent text-glow-red'
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

interface CharacterStatusProps {
  character: Character;
  isPlayer: boolean;
}

const CharacterStatus = ({ character, isPlayer }: CharacterStatusProps) => {
  const healthPercent = (character.stats.health / character.stats.maxHealth) * 100;
  const energyPercent = (character.stats.energy / character.stats.maxEnergy) * 100;

  return (
    <div className={`game-card rounded-lg p-3 min-w-48 ${isPlayer ? '' : 'text-right'}`}>
      <div className={`flex items-center gap-2 mb-2 ${isPlayer ? '' : 'flex-row-reverse'}`}>
        <div className={`p-1.5 rounded ${isPlayer ? 'bg-primary/20' : 'bg-accent/20'}`}>
          <Shield className={`w-4 h-4 ${isPlayer ? 'text-primary' : 'text-accent'}`} />
        </div>
        <span className="font-orbitron text-sm font-bold truncate max-w-24">{character.name}</span>
        <span className="text-xs text-muted-foreground">Lv.{character.level}</span>
      </div>
      
      {/* Health Bar */}
      <div className="space-y-1.5">
        <div className={`flex items-center gap-2 ${isPlayer ? '' : 'flex-row-reverse'}`}>
          <Heart className="w-4 h-4 text-health" />
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full health-bar transition-all duration-500 rounded-full"
              style={{ 
                width: `${healthPercent}%`,
                marginLeft: isPlayer ? 0 : 'auto',
              }}
            />
          </div>
          <span className="text-xs font-orbitron w-12 text-health">
            {character.stats.health}/{character.stats.maxHealth}
          </span>
        </div>
        
        {/* Energy Bar */}
        <div className={`flex items-center gap-2 ${isPlayer ? '' : 'flex-row-reverse'}`}>
          <Zap className="w-4 h-4 text-energy" />
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full energy-bar transition-all duration-500 rounded-full"
              style={{ 
                width: `${energyPercent}%`,
                marginLeft: isPlayer ? 0 : 'auto',
              }}
            />
          </div>
          <span className="text-xs font-orbitron w-12 text-energy">
            {character.stats.energy}/{character.stats.maxEnergy}
          </span>
        </div>
      </div>
    </div>
  );
};
