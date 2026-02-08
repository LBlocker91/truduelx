import { Character } from '@/types/game';
import { Heart, Zap, Flame, Star } from 'lucide-react';

interface CharacterStatusProps {
  character: Character;
  isPlayer: boolean;
}

export const CharacterStatus = ({ character, isPlayer }: CharacterStatusProps) => {
  const healthPercent = (character.stats.health / character.stats.maxHealth) * 100;
  const energyPercent = (character.stats.energy / character.stats.maxEnergy) * 100;
  const ragePercent = (character.rage / character.maxRage) * 100;
  const xpPercent = character.xpToNext > 0 ? (character.xp / character.xpToNext) * 100 : 0;

  return (
    <div className={`flex items-start gap-2 ${isPlayer ? '' : 'flex-row-reverse'}`}>
      {/* Level circle */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-orbitron text-sm font-black border-2 ${
          isPlayer
            ? 'bg-primary/20 border-primary text-primary'
            : 'bg-accent/20 border-accent text-accent'
        }`}>
          {character.level}
        </div>
        {/* XP mini-bar under level circle (player only) */}
        {isPlayer && (
          <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${xpPercent}%`,
                background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))',
              }}
            />
          </div>
        )}
      </div>

      {/* Bars */}
      <div className={`flex flex-col gap-1 min-w-36 sm:min-w-44 ${isPlayer ? '' : 'items-end'}`}>
        <div className="flex items-center gap-2">
          <span className={`font-orbitron text-[11px] font-bold text-foreground/90 truncate max-w-32 leading-none ${isPlayer ? '' : 'text-right'}`}>
            {character.name}
          </span>
          {/* XP text (player only) */}
          {isPlayer && (
            <span className="font-orbitron text-[8px] text-muted-foreground flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 text-primary" />
              {character.xp}/{character.xpToNext}
            </span>
          )}
          {/* Status effect icons */}
          {character.statusEffects.length > 0 && (
            <div className="flex gap-0.5">
              {character.statusEffects.map((e, i) => (
                <span key={i} className="text-[10px]" title={`${e.type} (${e.turnsRemaining}t)`}>
                  {e.type === 'stun' ? '💫' : e.type === 'dot' ? '🔥' : e.type === 'buff_attack' ? '⚔️' : '🛡️'}
                </span>
              ))}
            </div>
          )}
          {character.isDefending && <span className="text-[10px]" title="Defending">🛡️</span>}
        </div>

        {/* HP bar */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 w-full">
            <Heart className="w-3 h-3 text-neon-green shrink-0" />
            <div className="flex-1 h-3.5 rounded-sm overflow-hidden relative" style={{ border: '1px solid hsl(var(--border))' }}>
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

        {/* Rage bar */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 w-full">
            <Flame className="w-3 h-3 text-accent shrink-0" />
            <div className="flex-1 h-2.5 rounded-sm overflow-hidden relative" style={{ border: '1px solid hsl(var(--border))' }}>
              <div
                className="h-full transition-all duration-300 rounded-sm"
                style={{
                  width: `${ragePercent}%`,
                  background: ragePercent >= 100
                    ? 'linear-gradient(180deg, hsl(340 100% 60%) 0%, hsl(20 100% 50%) 100%)'
                    : 'linear-gradient(180deg, hsl(25 100% 55%) 0%, hsl(340 80% 45%) 100%)',
                  marginLeft: isPlayer ? 0 : 'auto',
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center font-orbitron text-[8px] font-bold text-white drop-shadow-md">
                {Math.floor(character.rage)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
