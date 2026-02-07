import { Ability } from '@/types/game';
import { Swords, Zap, Clock, Sparkles, Target } from 'lucide-react';

interface AbilityPanelProps {
  abilities: Ability[];
  playerEnergy: number;
  canAct: boolean;
  onUseAbility: (ability: Ability) => void;
}

const abilityTypeIcon = (type: Ability['type']) => {
  switch (type) {
    case 'physical': return <Swords className="w-4 h-4" />;
    case 'magical': return <Sparkles className="w-4 h-4" />;
    case 'special': return <Target className="w-4 h-4" />;
  }
};

export const AbilityPanel = ({ abilities, playerEnergy, canAct, onUseAbility }: AbilityPanelProps) => {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 px-2">
      {abilities.map((ability) => {
        const canUse =
          ability.currentCooldown === 0 &&
          playerEnergy >= ability.energyCost &&
          canAct;

        const isOnCooldown = ability.currentCooldown > 0;
        const notEnoughEnergy = !isOnCooldown && playerEnergy < ability.energyCost;

        return (
          <button
            key={ability.id}
            onClick={() => canUse && onUseAbility(ability)}
            disabled={!canUse}
            className={`
              relative group flex flex-col items-center gap-0.5 p-2 sm:p-2.5 rounded-lg border transition-all
              min-w-[70px] sm:min-w-[80px]
              ${canUse
                ? 'border-primary/50 bg-card/80 hover:border-primary hover:bg-primary/10 hover:scale-110 cursor-pointer'
                : 'border-border/30 bg-card/40 opacity-50 cursor-not-allowed'
              }
            `}
            title={`${ability.name}: ${ability.description}\nDamage: ${ability.damage} | Energy: ${ability.energyCost}`}
          >
            {/* Cooldown overlay */}
            {isOnCooldown && (
              <div className="absolute inset-0 bg-background/60 rounded-lg flex items-center justify-center">
                <span className="flex items-center gap-0.5 text-accent font-orbitron text-xs font-bold">
                  <Clock className="w-3 h-3" />
                  {ability.currentCooldown}
                </span>
              </div>
            )}

            {/* Icon */}
            <div className={`${canUse ? 'text-primary' : 'text-muted-foreground'}`}>
              {abilityTypeIcon(ability.type)}
            </div>

            {/* Name */}
            <span className="font-orbitron text-[9px] sm:text-[10px] font-bold text-foreground leading-tight text-center">
              {ability.name}
            </span>

            {/* Stats */}
            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="flex items-center gap-0.5 text-secondary">
                <Swords className="w-2.5 h-2.5" />
                {ability.damage}
              </span>
              <span className={`flex items-center gap-0.5 ${notEnoughEnergy ? 'text-accent' : 'text-energy'}`}>
                <Zap className="w-2.5 h-2.5" />
                {ability.energyCost}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
