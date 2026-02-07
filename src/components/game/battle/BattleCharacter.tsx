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
      const move = isPlayer ? 'translateX(120px)' : 'translateX(-120px)';
      return `${flip} ${move}`;
    }
    if (attackPhase === 'striking') {
      const move = isPlayer ? 'translateX(140px) scale(1.05)' : 'translateX(-140px) scale(1.05)';
      return `${flip} ${move}`;
    }
    return flip;
  };

  const getTransitionDuration = () => {
    if (attackPhase === 'lunging') return '200ms';
    if (attackPhase === 'striking') return '60ms';
    if (attackPhase === 'returning') return '300ms';
    return '200ms';
  };

  const idleAnim = attackPhase === 'idle' && !isBeingHit ? 'animate-battle-idle' : '';
  const hitAnim = isBeingHit ? 'animate-battle-hit' : '';

  return (
    <div className="relative flex flex-col items-center">
      {/* Floating damage number */}
      {damageNumber !== null && (
        <div
          className="absolute -top-10 left-1/2 z-30 font-orbitron text-3xl sm:text-4xl font-black animate-damage-float pointer-events-none select-none"
          style={{
            color: '#ff4444',
            textShadow: '0 0 10px rgba(255,0,0,0.8), 2px 2px 0 rgba(0,0,0,0.8), -1px -1px 0 rgba(0,0,0,0.5)',
            WebkitTextStroke: '1px rgba(0,0,0,0.3)',
          }}
        >
          -{damageNumber}
        </div>
      )}

      {/* Character sprite with animations */}
      <div
        className={`${idleAnim} ${hitAnim}`}
        style={{
          transform: getTransform(),
          transition: `transform ${getTransitionDuration()} cubic-bezier(0.4, 0, 0.2, 1)`,
          filter: isBeingHit
            ? 'brightness(3) saturate(0.3) drop-shadow(0 0 15px rgba(255,0,0,0.8))'
            : 'drop-shadow(3px 5px 8px rgba(0,0,0,0.7))',
          transformOrigin: 'bottom center',
        }}
      >
        <img
          src={character.image}
          alt={character.name}
          className="h-44 sm:h-56 md:h-64 object-contain select-none"
          draggable={false}
          style={{
            imageRendering: 'auto',
          }}
        />
      </div>

      {/* Ground shadow - elliptical like EpicDuel */}
      <div
        className="animate-shadow-pulse"
        style={{
          width: '100px',
          height: '12px',
          marginTop: '2px',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 50%, transparent 70%)',
          borderRadius: '50%',
        }}
      />
    </div>
  );
};
