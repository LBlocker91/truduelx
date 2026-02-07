import { Character } from '@/types/game';

interface CharacterStatusProps {
  character: Character;
  isPlayer: boolean;
}

/**
 * EpicDuel-style compact status display:
 * Large HP number with green bar, EP number with blue bar, Rage bar
 * Designed to sit inside the bottom HUD panel
 */
export const CharacterStatus = ({ character, isPlayer }: CharacterStatusProps) => {
  const healthPercent = (character.stats.health / character.stats.maxHealth) * 100;
  const energyPercent = (character.stats.energy / character.stats.maxEnergy) * 100;
  const ragePercent = (character.rage / character.maxRage) * 100;

  return (
    <div className={`flex flex-col gap-[3px] ${isPlayer ? 'items-start' : 'items-end'}`} style={{ width: '140px' }}>
      {/* Name + Level */}
      <div className={`flex items-center gap-1.5 w-full ${isPlayer ? '' : 'flex-row-reverse'}`}>
        <div
          className="font-orbitron text-[9px] font-black px-1.5 py-0.5 rounded-sm"
          style={{
            background: '#1a1a2e',
            border: '1px solid #2a2a4a',
            color: '#8888aa',
          }}
        >
          Lv.{character.level}
        </div>
        <span
          className="font-orbitron text-[10px] font-bold truncate"
          style={{ color: '#e0e0e0' }}
        >
          {character.name}
        </span>
        {/* Status icons */}
        <div className="flex gap-0.5">
          {character.statusEffects.map((e, i) => (
            <span key={i} className="text-[8px]">
              {e.type === 'stun' ? '💫' : e.type === 'dot' ? '🔥' : e.type === 'buff_attack' ? '⚔️' : '🛡️'}
            </span>
          ))}
          {character.isDefending && <span className="text-[8px]">🛡️</span>}
        </div>
      </div>

      {/* HP - large number + bar */}
      <div className={`flex items-center gap-1.5 w-full ${isPlayer ? '' : 'flex-row-reverse'}`}>
        <span
          className="font-orbitron text-lg font-black leading-none"
          style={{
            color: healthPercent > 50 ? '#44dd44' : healthPercent > 25 ? '#dddd44' : '#dd4444',
            textShadow: '0 0 6px rgba(0,255,0,0.3)',
            minWidth: '36px',
            textAlign: isPlayer ? 'left' : 'right',
          }}
        >
          {character.stats.health}
        </span>
        <div className="flex-1 relative" style={{ height: '12px' }}>
          <div
            className="absolute inset-0 rounded-sm"
            style={{
              background: '#0a0a15',
              border: '1px solid #1a1a30',
            }}
          />
          <div
            className="absolute top-0 bottom-0 rounded-sm transition-all duration-500"
            style={{
              width: `${healthPercent}%`,
              left: isPlayer ? 0 : undefined,
              right: isPlayer ? undefined : 0,
              background: 'linear-gradient(180deg, #55ee55 0%, #22aa22 40%, #118811 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
              border: '1px solid #0a0a15',
            }}
          />
        </div>
      </div>

      {/* EP - smaller number + bar */}
      <div className={`flex items-center gap-1.5 w-full ${isPlayer ? '' : 'flex-row-reverse'}`}>
        <span
          className="font-orbitron text-sm font-bold leading-none"
          style={{
            color: '#44aaff',
            textShadow: '0 0 4px rgba(0,150,255,0.3)',
            minWidth: '36px',
            textAlign: isPlayer ? 'left' : 'right',
          }}
        >
          {character.stats.energy}
        </span>
        <div className="flex-1 relative" style={{ height: '9px' }}>
          <div
            className="absolute inset-0 rounded-sm"
            style={{
              background: '#0a0a15',
              border: '1px solid #1a1a30',
            }}
          />
          <div
            className="absolute top-0 bottom-0 rounded-sm transition-all duration-500"
            style={{
              width: `${energyPercent}%`,
              left: isPlayer ? 0 : undefined,
              right: isPlayer ? undefined : 0,
              background: 'linear-gradient(180deg, #44bbff 0%, #2288dd 40%, #1166aa 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
              border: '1px solid #0a0a15',
            }}
          />
        </div>
      </div>

      {/* Rage bar - thin */}
      <div className={`flex items-center gap-1.5 w-full ${isPlayer ? '' : 'flex-row-reverse'}`}>
        <span
          className="font-orbitron text-[10px] font-bold leading-none"
          style={{
            color: ragePercent >= 100 ? '#ff6633' : '#aa5533',
            minWidth: '36px',
            textAlign: isPlayer ? 'left' : 'right',
          }}
        >
          {Math.floor(character.rage)}%
        </span>
        <div className="flex-1 relative" style={{ height: '6px' }}>
          <div
            className="absolute inset-0 rounded-sm"
            style={{ background: '#0a0a15', border: '1px solid #1a1a30' }}
          />
          <div
            className="absolute top-0 bottom-0 rounded-sm transition-all duration-300"
            style={{
              width: `${ragePercent}%`,
              left: isPlayer ? 0 : undefined,
              right: isPlayer ? undefined : 0,
              background: ragePercent >= 100
                ? 'linear-gradient(180deg, #ff6633 0%, #ee3311 50%, #cc2200 100%)'
                : 'linear-gradient(180deg, #cc6633 0%, #aa4422 50%, #882211 100%)',
              border: '1px solid #0a0a15',
            }}
          />
        </div>
      </div>
    </div>
  );
};
