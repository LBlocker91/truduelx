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
    if (attackPhase === 'lunging') {
      return isPlayer ? 'translateX(120px)' : 'translateX(-120px)';
    }
    if (attackPhase === 'striking') {
      return isPlayer ? 'translateX(140px) scale(1.05)' : 'translateX(-140px) scale(1.05)';
    }
    return 'translateX(0)';
  };

  const getTransitionDuration = () => {
    if (attackPhase === 'lunging') return '300ms';
    if (attackPhase === 'striking') return '100ms';
    if (attackPhase === 'returning') return '400ms';
    return '300ms';
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Damage number */}
      {damageNumber !== null && (
        <div 
          className="absolute -top-8 left-1/2 -translate-x-1/2 font-orbitron text-3xl font-black text-accent animate-slide-up z-20"
          style={{ textShadow: '0 0 10px hsl(var(--accent) / 0.8)' }}
        >
          -{damageNumber}
        </div>
      )}

      {/* Character sprite */}
      <div
        className="relative"
        style={{
          transform: getTransform(),
          transition: `transform ${getTransitionDuration()} cubic-bezier(0.25, 0.1, 0.25, 1)`,
          filter: isBeingHit ? 'brightness(3) saturate(0.5)' : 'none',
        }}
      >
        <img
          src={character.image}
          alt={character.name}
          className="h-48 sm:h-56 md:h-72 object-contain drop-shadow-2xl"
          style={{
            transform: isPlayer ? 'scaleX(1)' : 'scaleX(-1)',
          }}
        />

        {/* Hit flash overlay */}
        {isBeingHit && (
          <div className="absolute inset-0 bg-accent/30 mix-blend-screen rounded-lg animate-fade-in" />
        )}
      </div>

      {/* Name plate on the ground */}
      <div 
        className={`mt-2 px-4 py-1 rounded-full border ${
          isPlayer ? 'border-primary bg-primary/10' : 'border-accent bg-accent/10'
        }`}
      >
        <span className={`font-orbitron text-xs font-bold ${isPlayer ? 'text-primary' : 'text-accent'}`}>
          {character.name}
        </span>
      </div>
    </div>
  );
};
