import { Ability } from '@/types/game';
import { Swords, Zap, Clock, Sparkles, Target, Shield } from 'lucide-react';

interface AbilityPanelProps {
  abilities: Ability[];
  playerEnergy: number;
  canAct: boolean;
  onUseAbility: (ability: Ability) => void;
  onDefend: () => void;
  rageReady: boolean;
  onRageAttack: () => void;
}

const abilityTypeIcon = (type: Ability['type']) => {
  switch (type) {
    case 'physical': return <Swords className="w-4 h-4" />;
    case 'magical': return <Sparkles className="w-4 h-4" />;
    case 'special': return <Target className="w-4 h-4" />;
  }
};

export const AbilityPanel = ({ abilities, playerEnergy, canAct, onUseAbility, onDefend, rageReady, onRageAttack }: AbilityPanelProps) => {
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 flex-wrap">
      {/* Defend button */}
      <button
        onClick={() => canAct && onDefend()}
        disabled={!canAct}
        className={`
          relative group flex flex-col items-center gap-0.5 p-2 sm:p-2.5 rounded-lg border transition-all
          min-w-[60px] sm:min-w-[70px]
          ${canAct
            ? 'border-primary/50 bg-card/80 hover:border-primary hover:bg-primary/10 hover:scale-110 cursor-pointer'
            : 'border-border/30 bg-card/40 opacity-50 cursor-not-allowed'
          }
        `}
        title="Defend: Reduce incoming damage by 50%"
      >
        <div className={`${canAct ? 'text-primary' : 'text-muted-foreground'}`}>
          <Shield className="w-4 h-4" />
        </div>
        <span className="font-orbitron text-[9px] sm:text-[10px] font-bold text-foreground leading-tight text-center">
          Defend
        </span>
        <span className="text-[9px] text-muted-foreground">-50% DMG</span>
      </button>

      {/* Ability buttons */}
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
              min-w-[60px] sm:min-w-[70px]
              ${canUse
                ? 'border-primary/50 bg-card/80 hover:border-primary hover:bg-primary/10 hover:scale-110 cursor-pointer'
                : 'border-border/30 bg-card/40 opacity-50 cursor-not-allowed'
              }
            `}
            title={`${ability.name}: ${ability.description}\nDamage: ${ability.baseDamage} | Energy: ${ability.energyCost}${ability.effect ? ` | Effect: ${ability.effect}` : ''}`}
          >
            {isOnCooldown && (
              <div className="absolute inset-0 bg-background/60 rounded-lg flex items-center justify-center">
                <span className="flex items-center gap-0.5 text-accent font-orbitron text-xs font-bold">
                  <Clock className="w-3 h-3" />
                  {ability.currentCooldown}
                </span>
              </div>
            )}

            <div className={`${canUse ? 'text-primary' : 'text-muted-foreground'}`}>
              {abilityTypeIcon(ability.type)}
            </div>

            <span className="font-orbitron text-[9px] sm:text-[10px] font-bold text-foreground leading-tight text-center">
              {ability.name}
            </span>

            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="flex items-center gap-0.5 text-secondary">
                <Swords className="w-2.5 h-2.5" />
                {ability.baseDamage}
              </span>
              <span className={`flex items-center gap-0.5 ${notEnoughEnergy ? 'text-accent' : 'text-energy'}`}>
                <Zap className="w-2.5 h-2.5" />
                {ability.energyCost}
              </span>
            </div>
          </button>
        );
      })}

      {/* Rage attack button */}
      <button
        onClick={() => rageReady && canAct && onRageAttack()}
        disabled={!rageReady || !canAct}
        className={`
          relative group flex flex-col items-center gap-0.5 p-2 sm:p-2.5 rounded-lg border transition-all
          min-w-[60px] sm:min-w-[70px]
          ${rageReady && canAct
            ? 'border-accent bg-accent/20 hover:bg-accent/30 hover:scale-110 cursor-pointer animate-pulse-glow'
            : 'border-border/30 bg-card/40 opacity-40 cursor-not-allowed'
          }
        `}
        title="Rage Attack: Unleash devastating damage when rage is full!"
      >
        <span className="text-accent text-lg">🔥</span>
        <span className="font-orbitron text-[9px] sm:text-[10px] font-bold text-accent leading-tight text-center">
          RAGE
        </span>
      </button>
    </div>
  );
};
