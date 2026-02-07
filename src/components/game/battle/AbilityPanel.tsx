import { Ability } from '@/types/game';

interface AbilityPanelProps {
  abilities: Ability[];
  playerEnergy: number;
  canAct: boolean;
  onUseAbility: (ability: Ability) => void;
  onDefend: () => void;
  rageReady: boolean;
  onRageAttack: () => void;
}

const abilityIcon = (ability: Ability) => {
  if (ability.effect === 'stun') return '💫';
  if (ability.effect === 'dot') return '🔥';
  if (ability.effect === 'energy_drain') return '⚡';
  if (ability.effect === 'buff_attack') return '⚔️';
  if (ability.effect === 'debuff_defense') return '🔻';
  switch (ability.type) {
    case 'physical': return '⚔️';
    case 'magical': return '✨';
    case 'special': return '🎯';
  }
};

/**
 * EpicDuel-style skill icon row:
 * Small square buttons with icons, arranged horizontally
 */
export const AbilityPanel = ({ abilities, playerEnergy, canAct, onUseAbility, onDefend, rageReady, onRageAttack }: AbilityPanelProps) => {
  return (
    <div className="flex items-center gap-[3px]">
      {/* Defend button */}
      <SkillIcon
        icon="🛡️"
        tooltip="Defend (-50% damage)"
        canUse={canAct}
        onClick={() => canAct && onDefend()}
      />

      {/* Ability buttons */}
      {abilities.map((ability) => {
        const canUse = ability.currentCooldown === 0 && playerEnergy >= ability.energyCost && canAct;
        const isOnCooldown = ability.currentCooldown > 0;

        return (
          <SkillIcon
            key={ability.id}
            icon={abilityIcon(ability)}
            tooltip={`${ability.name} (${ability.baseDamage} dmg, ${ability.energyCost} EP)${ability.effect ? ` [${ability.effect}]` : ''}`}
            canUse={canUse}
            onClick={() => canUse && onUseAbility(ability)}
            cooldown={isOnCooldown ? ability.currentCooldown : undefined}
          />
        );
      })}

      {/* Rage button */}
      <SkillIcon
        icon="🔥"
        tooltip="Rage Attack (requires 100% rage)"
        canUse={rageReady && canAct}
        onClick={() => rageReady && canAct && onRageAttack()}
        isRage
        rageReady={rageReady}
      />
    </div>
  );
};

interface SkillIconProps {
  icon: string;
  tooltip: string;
  canUse: boolean;
  onClick: () => void;
  cooldown?: number;
  isRage?: boolean;
  rageReady?: boolean;
}

const SkillIcon = ({ icon, tooltip, canUse, onClick, cooldown, isRage, rageReady }: SkillIconProps) => (
  <button
    onClick={onClick}
    disabled={!canUse}
    className="relative flex items-center justify-center transition-all"
    style={{
      width: '36px',
      height: '36px',
      background: isRage && rageReady
        ? 'linear-gradient(135deg, #442200 0%, #331100 100%)'
        : canUse
          ? 'linear-gradient(135deg, #1e1e35 0%, #14142a 100%)'
          : '#0c0c18',
      border: `1.5px solid ${
        isRage && rageReady ? '#ff6633' :
        canUse ? '#3a3a60' : '#1a1a30'
      }`,
      borderRadius: '3px',
      cursor: canUse ? 'pointer' : 'not-allowed',
      opacity: canUse ? 1 : 0.4,
      fontSize: '16px',
    }}
    onMouseEnter={(e) => {
      if (canUse) {
        e.currentTarget.style.borderColor = isRage ? '#ff8844' : '#5588cc';
        e.currentTarget.style.boxShadow = isRage ? '0 0 6px #ff440066' : '0 0 6px #4488cc44';
      }
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = isRage && rageReady ? '#ff6633' : canUse ? '#3a3a60' : '#1a1a30';
      e.currentTarget.style.boxShadow = 'none';
    }}
    title={tooltip}
  >
    {/* Cooldown overlay */}
    {cooldown !== undefined && (
      <div
        className="absolute inset-0 flex items-center justify-center rounded-sm"
        style={{ background: 'rgba(0,0,0,0.7)' }}
      >
        <span className="font-orbitron text-[10px] font-bold" style={{ color: '#ff6644' }}>
          {cooldown}
        </span>
      </div>
    )}
    <span className="leading-none select-none">{icon}</span>
  </button>
);
