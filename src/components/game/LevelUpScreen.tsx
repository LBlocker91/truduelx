import { useState } from 'react';
import { Character } from '@/types/game';
import { StatKey, STAT_LABELS, allocateStat } from '@/lib/leveling';
import { Button } from '@/components/ui/button';
import { Plus, Check, Star } from 'lucide-react';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';

interface LevelUpScreenProps {
  player: Character;
  xpGained: number;
  onComplete: (updatedPlayer: Character) => void;
}

const STATS: StatKey[] = ['strength', 'dexterity', 'technology', 'support'];

export const LevelUpScreen = ({ player, xpGained, onComplete }: LevelUpScreenProps) => {
  const [character, setCharacter] = useState(player);

  const handleAllocate = (stat: StatKey) => {
    setCharacter(prev => allocateStat(prev, stat));
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `url(${battleArenaBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90" />

      <div className="relative z-10 w-full max-w-md mx-4 space-y-6 animate-scale-in">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 glow-cyan">
            <Star className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-orbitron text-4xl font-black text-primary text-glow-cyan">
            LEVEL {character.level}
          </h1>
          <p className="text-muted-foreground font-rajdhani mt-1">
            +{xpGained} XP earned
          </p>
        </div>

        {/* Stat points remaining */}
        <div className="text-center">
          <span className="font-orbitron text-lg font-bold text-secondary">
            {character.statPoints} STAT POINTS
          </span>
          <span className="text-muted-foreground ml-2 text-sm">remaining</span>
        </div>

        {/* Stat allocation */}
        <div className="game-card rounded-xl p-4 space-y-3">
          {STATS.map(stat => {
            const info = STAT_LABELS[stat];
            const value = character.stats[stat];
            const baseValue = player.stats[stat];
            const added = value - baseValue;

            return (
              <div
                key={stat}
                className="flex items-center justify-between gap-3 p-3 rounded-lg"
                style={{ background: 'hsl(var(--muted) / 0.5)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{info.icon}</span>
                    <span className="font-orbitron text-sm font-bold text-foreground">
                      {info.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-orbitron text-lg font-bold text-foreground w-8 text-right">
                    {value}
                  </span>
                  {added > 0 && (
                    <span className="font-orbitron text-sm font-bold text-primary">
                      +{added}
                    </span>
                  )}
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full btn-neon"
                    disabled={character.statPoints <= 0}
                    onClick={() => handleAllocate(stat)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* XP bar */}
        <div className="game-card rounded-xl p-4">
          <div className="flex justify-between text-xs font-orbitron mb-1">
            <span className="text-muted-foreground">XP</span>
            <span className="text-muted-foreground">{character.xp} / {character.xpToNext}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(character.xp / character.xpToNext) * 100}%`,
                background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))',
              }}
            />
          </div>
        </div>

        {/* Continue button */}
        <Button
          onClick={() => onComplete(character)}
          className="w-full btn-neon text-lg py-5 rounded-lg text-primary-foreground"
        >
          <Check className="w-5 h-5 mr-2" />
          {character.statPoints > 0 ? 'CONTINUE (points remaining)' : 'CONTINUE'}
        </Button>
      </div>
    </div>
  );
};
