import { Ability } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Swords, Zap, Clock, Sparkles, Target } from 'lucide-react';

interface AbilityPanelProps {
  abilities: Ability[];
  playerEnergy: number;
  canAct: boolean;
  onUseAbility: (ability: Ability) => void;
}

const abilityTypeIcon = (type: Ability['type']) => {
  switch (type) {
    case 'physical': return <Swords className="w-3.5 h-3.5" />;
    case 'magical': return <Sparkles className="w-3.5 h-3.5" />;
    case 'special': return <Target className="w-3.5 h-3.5" />;
  }
};

export const AbilityPanel = ({ abilities, playerEnergy, canAct, onUseAbility }: AbilityPanelProps) => {
  return (
    <div className="game-card rounded-xl p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {abilities.map((ability) => {
          const canUse = 
            ability.currentCooldown === 0 && 
            playerEnergy >= ability.energyCost &&
            canAct;

          return (
            <Button
              key={ability.id}
              onClick={() => onUseAbility(ability)}
              disabled={!canUse}
              className={`relative h-auto py-3 px-4 flex flex-col items-start gap-1.5 transition-all ${
                canUse 
                  ? 'game-card-hover hover:scale-105' 
                  : 'opacity-50 cursor-not-allowed'
              }`}
              variant="outline"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  {abilityTypeIcon(ability.type)}
                  <span className="font-orbitron text-xs font-bold text-foreground">
                    {ability.name}
                  </span>
                </div>
                {ability.currentCooldown > 0 && (
                  <span className="flex items-center gap-1 text-accent text-xs">
                    <Clock className="w-3 h-3" />
                    {ability.currentCooldown}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground text-left w-full">{ability.description}</p>
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
  );
};
