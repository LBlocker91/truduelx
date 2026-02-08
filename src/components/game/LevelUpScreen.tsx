import { useState } from 'react';
import { Character, MAX_ABILITY_LEVEL } from '@/types/game';
import { StatKey, STAT_LABELS, allocateStat, upgradeAbility } from '@/lib/leveling';
import { Button } from '@/components/ui/button';
import { Plus, Check, Star, Lock, Unlock } from 'lucide-react';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';

interface LevelUpScreenProps {
  player: Character;
  xpGained: number;
  onComplete: (updatedPlayer: Character) => void;
}

const STATS: StatKey[] = ['strength', 'dexterity', 'technology', 'support'];
const SKILL_ROWS = [
  { label: 'Row 1', minLevel: 1 },
  { label: 'Row 2', minLevel: 10 },
  { label: 'Row 3', minLevel: 30 },
  { label: 'Row 4', minLevel: 50 },
];

export const LevelUpScreen = ({ player, xpGained, onComplete }: LevelUpScreenProps) => {
  const [character, setCharacter] = useState(player);

  const handleAllocate = (stat: StatKey) => {
    setCharacter(prev => allocateStat(prev, stat));
  };

  const handleUpgradeSkill = (abilityId: string) => {
    setCharacter(prev => upgradeAbility(prev, abilityId));
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

      <div className="relative z-10 w-full max-w-lg mx-4 space-y-4 animate-scale-in max-h-[95vh] overflow-y-auto py-4">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-2 glow-cyan">
            <Star className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-orbitron text-3xl font-black text-primary text-glow-cyan">
            LEVEL {character.level}
          </h1>
          <p className="text-muted-foreground font-rajdhani mt-1">+{xpGained} XP earned</p>
        </div>

        {/* Points remaining */}
        <div className="flex justify-center gap-6 text-center">
          <div>
            <span className="font-orbitron text-lg font-bold text-secondary">{character.statPoints}</span>
            <span className="text-muted-foreground ml-1 text-sm">Stat Pts</span>
          </div>
          <div>
            <span className="font-orbitron text-lg font-bold text-accent">{character.skillPoints}</span>
            <span className="text-muted-foreground ml-1 text-sm">Skill Pts</span>
          </div>
        </div>

        {/* Stat allocation */}
        <div className="game-card rounded-xl p-3 space-y-2">
          <h2 className="font-orbitron text-xs font-bold text-muted-foreground tracking-wider">STAT ALLOCATION</h2>
          {STATS.map(stat => {
            const info = STAT_LABELS[stat];
            const value = character.stats[stat];
            const baseValue = player.stats[stat];
            const added = value - baseValue;

            return (
              <div
                key={stat}
                className="flex items-center justify-between gap-2 p-2 rounded-lg"
                style={{ background: 'hsl(var(--muted) / 0.5)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{info.icon}</span>
                    <span className="font-orbitron text-xs font-bold text-foreground">{info.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{info.description}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-orbitron text-sm font-bold text-foreground w-7 text-right">{value}</span>
                  {added > 0 && <span className="font-orbitron text-xs font-bold text-primary">+{added}</span>}
                  <Button size="icon" className="h-7 w-7 rounded-full btn-neon" disabled={character.statPoints <= 0} onClick={() => handleAllocate(stat)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Skill Tree */}
        <div className="game-card rounded-xl p-3 space-y-2">
          <h2 className="font-orbitron text-xs font-bold text-muted-foreground tracking-wider">SKILL TREE</h2>
          {SKILL_ROWS.map(row => {
            const rowAbilities = character.abilities.filter(a => {
              const lvl = a.unlockLevel || 1;
              if (row.minLevel === 1) return lvl <= 1;
              if (row.minLevel === 10) return lvl > 1 && lvl <= 10;
              if (row.minLevel === 30) return lvl > 10 && lvl <= 30;
              return lvl > 30;
            });
            if (rowAbilities.length === 0) return null;
            const rowLocked = character.level < row.minLevel;

            return (
              <div key={row.label}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-orbitron text-[10px] font-bold text-muted-foreground">{row.label}</span>
                  <span className="text-[10px] text-muted-foreground">Lv {row.minLevel}+</span>
                  {rowLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                </div>
                <div className="space-y-1">
                  {rowAbilities.map(ability => {
                    const abilityLevel = character.abilityLevels[ability.id] || 0;
                    const isMaxed = abilityLevel >= MAX_ABILITY_LEVEL;
                    const canUpgrade = !rowLocked && !isMaxed && character.skillPoints > 0;

                    return (
                      <div
                        key={ability.id}
                        className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs ${
                          abilityLevel > 0 ? 'bg-primary/10 border border-primary/30' : rowLocked ? 'opacity-40' : ''
                        }`}
                        style={{ background: abilityLevel > 0 ? undefined : 'hsl(var(--muted) / 0.3)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-orbitron text-[10px] font-bold text-foreground">{ability.name}</span>
                            {abilityLevel > 0 && (
                              <span className="font-orbitron text-[9px] font-bold text-primary">
                                Lv {abilityLevel}{isMaxed ? ' MAX' : `/${MAX_ABILITY_LEVEL}`}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-muted-foreground truncate">{ability.description}</p>
                        </div>
                        {isMaxed ? (
                          <Unlock className="w-3.5 h-3.5 text-primary shrink-0" />
                        ) : (
                          <Button
                            size="icon"
                            className="h-6 w-6 rounded-full btn-neon shrink-0"
                            disabled={!canUpgrade}
                            onClick={() => handleUpgradeSkill(ability.id)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* XP bar */}
        <div className="game-card rounded-xl p-3">
          <div className="flex justify-between text-xs font-orbitron mb-1">
            <span className="text-muted-foreground">XP</span>
            <span className="text-muted-foreground">{character.xp} / {character.xpToNext}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(character.xp / character.xpToNext) * 100}%`,
                background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))',
              }}
            />
          </div>
        </div>

        {/* Continue */}
        <Button onClick={() => onComplete(character)} className="w-full btn-neon text-lg py-5 rounded-lg text-primary-foreground">
          <Check className="w-5 h-5 mr-2" />
          {(character.statPoints > 0 || character.skillPoints > 0) ? 'CONTINUE (points remaining)' : 'CONTINUE'}
        </Button>
      </div>
    </div>
  );
};
