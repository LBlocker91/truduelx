import { Character } from '@/types/game';

export type AttackPhase = 'idle' | 'lunging' | 'striking' | 'returning';

interface BattleCharacterProps {
  character: Character;
  isPlayer: boolean;
  attackPhase: AttackPhase;
  isBeingHit: boolean;
  damageNumber: number | null;
}

export const BattleCharacter = ({ character, isPlayer, attackPhase, isBeingHit, damageNumber }: BattleCharacterProps) => {
  const getTransform = () => {
    const flip = isPlayer ? '' : 'scaleX(-1)';
    if (attackPhase === 'lunging') {
      const move = isPlayer ? 'translateX(140px)' : 'translateX(-140px)';
      return `${flip} ${move}`;
    }
    if (attackPhase === 'striking') {
      const move = isPlayer ? 'translateX(160px) scale(1.08)' : 'translateX(-160px) scale(1.08)';
      return `${flip} ${move}`;
    }
    return flip;
  };

  const getTransitionDuration = () => {
    if (attackPhase === 'lunging') return '250ms';
    if (attackPhase === 'striking') return '80ms';
    if (attackPhase === 'returning') return '350ms';
    return '250ms';
  };

  // Idle bobbing animation style
  const idleAnimation = attackPhase === 'idle' && !isBeingHit
    ? 'animate-battle-idle'
    : '';

  // Hit shake animation
  const hitAnimation = isBeingHit ? 'animate-battle-hit' : '';

  return (
    <div className="relative flex flex-col items-center">
      {/* Damage number floating up */}
      {damageNumber !== null && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 z-30 font-orbitron text-2xl sm:text-3xl font-black animate-damage-float pointer-events-none"
          style={{
            color: 'hsl(var(--accent))',
            textShadow: '0 0 12px hsl(var(--accent) / 0.9), 2px 2px 0 hsl(0 0% 0% / 0.7)',
          }}
        >
          -{damageNumber}
        </div>
      )}

      {/* Character container with idle + hit animations */}
      <div
        className={`${idleAnimation} ${hitAnimation}`}
        style={{
          transform: getTransform(),
          transition: `transform ${getTransitionDuration()} cubic-bezier(0.25, 0.1, 0.25, 1)`,
          filter: isBeingHit
            ? 'brightness(4) saturate(0.2) drop-shadow(0 0 18px hsl(var(--accent)))'
            : 'drop-shadow(2px 4px 8px hsl(0 0% 0% / 0.6))',
          transformOrigin: 'bottom center',
        }}
      >
        <img
          src={character.image}
          alt={character.name}
          className="h-40 sm:h-52 md:h-64 object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Ground shadow - pulsates with idle */}
      <div
        className="mt-1 rounded-full blur-sm animate-shadow-pulse"
        style={{
          width: '90px',
          height: '10px',
          background: 'radial-gradient(ellipse, hsl(0 0% 0% / 0.45) 0%, transparent 70%)',
        }}
      />
    </div>
  );
};
