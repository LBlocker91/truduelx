import { Character } from '@/types/game';
import { Heart, Zap } from 'lucide-react';

interface CharacterStatusProps {
  character: Character;
  isPlayer: boolean;
}

export const CharacterStatus = ({ character, isPlayer }: CharacterStatusProps) => {
  const healthPercent = (character.stats.health / character.stats.maxHealth) * 100;
  const energyPercent = (character.stats.energy / character.stats.maxEnergy) * 100;

  return (
    <div className={`flex items-start gap-2 ${isPlayer ? '' : 'flex-row-reverse'}`}>
      {/* Level circle */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-orbitron text-sm font-black border-2 shrink-0 ${
        isPlayer
          ? 'bg-primary/20 border-primary text-primary'
          : 'bg-accent/20 border-accent text-accent'
      }`}>
        {character.level}
      </div>

      {/* Bars */}
      <div className={`flex flex-col gap-1 min-w-36 sm:min-w-44 ${isPlayer ? '' : 'items-end'}`}>
        <span className={`font-orbitron text-[11px] font-bold text-foreground/90 truncate max-w-32 leading-none ${isPlayer ? '' : 'text-right'}`}>
          {character.name}
        </span>

        {/* HP bar */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 w-full">
            <Heart className="w-3 h-3 text-neon-green shrink-0" />
            <div className={`flex-1 h-3.5 rounded-sm overflow-hidden relative ${
              isPlayer ? 'bg-muted/60' : 'bg-muted/60'
            }`} style={{ border: '1px solid hsl(var(--border))' }}>
              <div
                className="h-full transition-all duration-500 rounded-sm"
                style={{
                  width: `${healthPercent}%`,
                  background: 'linear-gradient(180deg, hsl(130 70% 50%) 0%, hsl(130 60% 35%) 100%)',
                  marginLeft: isPlayer ? 0 : 'auto',
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center font-orbitron text-[9px] font-bold text-white drop-shadow-md">
                {character.stats.health}
              </span>
            </div>
          </div>
        </div>

        {/* Energy bar */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 w-full">
            <Zap className="w-3 h-3 text-energy shrink-0" />
            <div className="flex-1 h-3 rounded-sm overflow-hidden relative" style={{ border: '1px solid hsl(var(--border))' }}>
              <div
                className="h-full transition-all duration-500 rounded-sm"
                style={{
                  width: `${energyPercent}%`,
                  background: 'linear-gradient(180deg, hsl(200 90% 55%) 0%, hsl(210 80% 40%) 100%)',
                  marginLeft: isPlayer ? 0 : 'auto',
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center font-orbitron text-[9px] font-bold text-white drop-shadow-md">
                {character.stats.energy}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
