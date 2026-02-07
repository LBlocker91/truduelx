import { Ability } from '@/types/game';
import { Clock } from 'lucide-react';

interface AbilityPanelProps {
  abilities: Ability[];
  playerEnergy: number;
  canAct: boolean;
  onUseAbility: (ability: Ability) => void;
  onDefend: () => void;
  rageReady: boolean;
  onRageAttack: () => void;
}

const abilityIcon = (type: Ability['type']) => {
  switch (type) {
    case 'physical': return '⚔️';
    case 'magical': return '✨';
    case 'special': return '🎯';
  }
};

export const AbilityPanel = ({ abilities, playerEnergy, canAct, onUseAbility, onDefend, rageReady, onRageAttack }: AbilityPanelProps) => {
  return (
    <div className="flex items-stretch justify-center gap-1 px-1 flex-wrap">
      {/* Defend */}
      <SkillButton
        icon="🛡️"
        label="Defend"
        sublabel="-50%"
        canUse={canAct}
        onClick={() => canAct && onDefend()}
        tooltip="Reduce incoming damage by 50%"
      />

      {/* Abilities */}
      {abilities.map((ability) => {
        const canUse = ability.currentCooldown === 0 && playerEnergy >= ability.energyCost && canAct;
        const isOnCooldown = ability.currentCooldown > 0;
        const notEnoughEnergy = !isOnCooldown && playerEnergy < ability.energyCost;

        return (
          <button
            key={ability.id}
            onClick={() => canUse && onUseAbility(ability)}
            disabled={!canUse}
            className="relative flex flex-col items-center justify-center transition-all"
            style={{
              width: '62px',
              height: '58px',
              background: canUse
                ? 'linear-gradient(180deg, hsl(230 20% 22%) 0%, hsl(230 25% 14%) 100%)'
                : 'linear-gradient(180deg, hsl(230 20% 15%) 0%, hsl(230 25% 10%) 100%)',
              border: `1.5px solid ${canUse ? 'hsl(185 60% 40%)' : 'hsl(230 20% 20%)'}`,
              borderRadius: '4px',
              cursor: canUse ? 'pointer' : 'not-allowed',
              opacity: canUse ? 1 : 0.5,
            }}
            onMouseEnter={(e) => {
              if (canUse) {
                e.currentTarget.style.borderColor = 'hsl(185 100% 50%)';
                e.currentTarget.style.boxShadow = '0 0 8px hsl(185 100% 50% / 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = canUse ? 'hsl(185 60% 40%)' : 'hsl(230 20% 20%)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title={`${ability.name}: ${ability.description}\nDMG: ${ability.baseDamage} | EP: ${ability.energyCost}${ability.effect ? ` | ${ability.effect}` : ''}`}
          >
            {/* Cooldown overlay */}
            {isOnCooldown && (
              <div className="absolute inset-0 flex items-center justify-center rounded z-10"
                style={{ background: 'hsl(0 0% 0% / 0.6)' }}>
                <span className="flex items-center gap-0.5 font-orbitron text-xs font-bold" style={{ color: 'hsl(var(--accent))' }}>
                  <Clock className="w-3 h-3" />
                  {ability.currentCooldown}
                </span>
              </div>
            )}

            <span className="text-base leading-none">{abilityIcon(ability.type)}</span>
            <span className="font-orbitron text-[7px] font-bold leading-tight text-center mt-0.5 px-0.5"
              style={{ color: 'hsl(var(--foreground))' }}>
              {ability.name}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="font-orbitron text-[7px]" style={{ color: 'hsl(var(--secondary))' }}>
                {ability.baseDamage}
              </span>
              <span className="font-orbitron text-[7px]" style={{ color: notEnoughEnergy ? 'hsl(var(--accent))' : 'hsl(var(--energy))' }}>
                {ability.energyCost}e
              </span>
            </div>
          </button>
        );
      })}

      {/* Rage */}
      <SkillButton
        icon="🔥"
        label="RAGE"
        canUse={rageReady && canAct}
        onClick={() => rageReady && canAct && onRageAttack()}
        tooltip="Unleash devastating rage attack!"
        isRage
        rageReady={rageReady}
      />
    </div>
  );
};

interface SkillButtonProps {
  icon: string;
  label: string;
  sublabel?: string;
  canUse: boolean;
  onClick: () => void;
  tooltip: string;
  isRage?: boolean;
  rageReady?: boolean;
}

const SkillButton = ({ icon, label, sublabel, canUse, onClick, tooltip, isRage, rageReady }: SkillButtonProps) => (
  <button
    onClick={onClick}
    disabled={!canUse}
    className={`relative flex flex-col items-center justify-center transition-all ${isRage && rageReady ? 'animate-pulse-glow' : ''}`}
    style={{
      width: '62px',
      height: '58px',
      background: isRage && rageReady
        ? 'linear-gradient(180deg, hsl(25 80% 25%) 0%, hsl(340 70% 20%) 100%)'
        : canUse
          ? 'linear-gradient(180deg, hsl(230 20% 22%) 0%, hsl(230 25% 14%) 100%)'
          : 'linear-gradient(180deg, hsl(230 20% 15%) 0%, hsl(230 25% 10%) 100%)',
      border: `1.5px solid ${isRage && rageReady ? 'hsl(var(--accent))' : canUse ? 'hsl(185 60% 40%)' : 'hsl(230 20% 20%)'}`,
      borderRadius: '4px',
      cursor: canUse ? 'pointer' : 'not-allowed',
      opacity: canUse ? 1 : (isRage ? 0.35 : 0.5),
    }}
    onMouseEnter={(e) => {
      if (canUse) {
        e.currentTarget.style.boxShadow = isRage
          ? '0 0 10px hsl(var(--accent) / 0.5)'
          : '0 0 8px hsl(185 100% 50% / 0.4)';
      }
    }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    title={tooltip}
  >
    <span className="text-lg leading-none">{icon}</span>
    <span className="font-orbitron text-[7px] font-bold mt-0.5" style={{
      color: isRage ? 'hsl(var(--accent))' : 'hsl(var(--foreground))',
    }}>
      {label}
    </span>
    {sublabel && (
      <span className="font-orbitron text-[7px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {sublabel}
      </span>
    )}
  </button>
);
