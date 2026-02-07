import { Character } from '@/types/game';
import { Heart, Zap, Shield } from 'lucide-react';

interface CharacterStatusProps {
  character: Character;
  isPlayer: boolean;
}

export const CharacterStatus = ({ character, isPlayer }: CharacterStatusProps) => {
  const healthPercent = (character.stats.health / character.stats.maxHealth) * 100;
  const energyPercent = (character.stats.energy / character.stats.maxEnergy) * 100;

  return (
    <div className={`game-card rounded-lg p-3 min-w-52 ${isPlayer ? '' : 'text-right'}`}>
      <div className={`flex items-center gap-2 mb-2 ${isPlayer ? '' : 'flex-row-reverse'}`}>
        <div className={`p-1.5 rounded ${isPlayer ? 'bg-primary/20' : 'bg-accent/20'}`}>
          <Shield className={`w-4 h-4 ${isPlayer ? 'text-primary' : 'text-accent'}`} />
        </div>
        <span className="font-orbitron text-sm font-bold truncate max-w-28">{character.name}</span>
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
          <span className="text-xs font-orbitron w-16 text-health">
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
          <span className="text-xs font-orbitron w-16 text-energy">
            {character.stats.energy}/{character.stats.maxEnergy}
          </span>
        </div>
      </div>
    </div>
  );
};
