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
  const dir = isPlayer ? 1 : -1;
  const flip = isPlayer ? '' : 'scaleX(-1)';

  const getTransform = () => {
    if (attackPhase === 'lunging') {
      // Anticipation: brief pull-back then forward lunge with slight depth scale
      return `${flip} translateX(${dir * 140}px) translateZ(0) scale(1.04)`;
    }
    if (attackPhase === 'striking') {
      return `${flip} translateX(${dir * 170}px) translateY(-4px) scale(1.12)`;
    }
    if (attackPhase === 'returning') {
      return `${flip} translateX(${dir * 30}px) scale(0.98)`;
    }
    return flip;
  };

  const getTransitionDuration = () => {
    if (attackPhase === 'lunging') return '220ms';
    if (attackPhase === 'striking') return '90ms';
    if (attackPhase === 'returning') return '380ms';
    return '260ms';
  };

  const idleAnimation = attackPhase === 'idle' && !isBeingHit ? 'animate-battle-idle' : '';
  const hitAnimation = isBeingHit ? 'animate-battle-hit' : '';
  // Anticipation crouch on lunge wind-up
  const stanceAnim = attackPhase === 'lunging'
    ? 'battle-anticipate'
    : attackPhase === 'returning'
      ? 'battle-recover'
      : '';

  // Show melee VFX on strike
  const showStrikeVfx = attackPhase === 'striking';

  return (
    <div className="relative flex flex-col items-center" style={{ perspective: '900px' }}>
      {/* Damage number */}
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

      {/* Speed lines trailing the lunge (behind character, on attacker side) */}
      {attackPhase === 'lunging' && (
        <div
          className="absolute pointer-events-none z-10 speed-lines"
          style={{
            top: '40%',
            [isPlayer ? 'left' : 'right']: '-40px',
            width: '60px',
            height: '4px',
            background: `linear-gradient(${isPlayer ? 90 : 270}deg, transparent, hsl(var(--primary) / 0.85), transparent)`,
            filter: 'blur(1px)',
            boxShadow: '0 -10px 0 -1px hsl(var(--primary) / 0.6), 0 10px 0 -1px hsl(var(--primary) / 0.6)',
          }}
        />
      )}

      {/* Character — anticipation/recover wrapper, then transform wrapper, then sprite */}
      <div
        className={stanceAnim}
        style={{
          transform: getTransform(),
          transition: `transform ${getTransitionDuration()} cubic-bezier(0.25, 0.1, 0.25, 1)`,
          transformOrigin: 'bottom center',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          className={`${idleAnimation} ${hitAnimation}`}
          style={{
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

          {/* Slash arc — sweeping crescent from forward of character */}
          {showStrikeVfx && (
            <div
              className="absolute pointer-events-none z-20"
              style={{
                top: '38%',
                [isPlayer ? 'right' : 'left']: '-30px',
                width: '110px',
                height: '110px',
              }}
            >
              <div
                className="slash-arc absolute inset-0"
                style={{
                  borderRadius: '50%',
                  border: '4px solid transparent',
                  borderTopColor: 'hsl(var(--primary))',
                  borderRightColor: 'hsl(var(--primary) / 0.6)',
                  filter: 'drop-shadow(0 0 12px hsl(var(--primary)))',
                  transformOrigin: 'center center',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Dust puff on lunge / strike */}
      {(attackPhase === 'lunging' || attackPhase === 'striking') && (
        <div
          className="absolute left-1/2 dust-puff pointer-events-none z-10"
          style={{
            bottom: 0,
            width: '70px',
            height: '20px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, hsl(0 0% 80% / 0.7) 0%, transparent 70%)',
            filter: 'blur(2px)',
          }}
        />
      )}

      {/* Impact ring on receiver */}
      {isBeingHit && (
        <div
          className="absolute left-1/2 top-1/2 impact-ring pointer-events-none z-20"
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: '3px solid hsl(var(--accent))',
            boxShadow: '0 0 24px hsl(var(--accent) / 0.8), inset 0 0 24px hsl(var(--accent) / 0.4)',
          }}
        />
      )}

      {/* Ground shadow */}
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
