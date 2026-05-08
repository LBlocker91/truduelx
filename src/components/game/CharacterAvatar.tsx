import { memo } from 'react';

export type AvatarDirection = 'left' | 'right';
export type AvatarState = 'idle' | 'walk';

interface CharacterAvatarProps {
  src: string;
  alt?: string;
  direction?: AvatarDirection;
  state?: AvatarState;
  /** Pixel height of the rendered avatar; width auto from aspect. */
  height?: number;
  /** Optional accent color (HSL string) for the ground halo, e.g. '195 100% 60%'. */
  accentHsl?: string;
  className?: string;
}

/**
 * Image-based world avatar with proper grounding:
 *   - real soft elliptical shadow under the feet (always behind sprite)
 *   - no glow bubble around the body
 *   - directional facing via scaleX
 *   - subtle idle bob / walk lean handled with CSS classes already in index.css
 */
const CharacterAvatarImpl = ({
  src,
  alt = '',
  direction = 'right',
  state = 'idle',
  height = 168,
  accentHsl,
  className = '',
}: CharacterAvatarProps) => {
  // Source images are 512x768 → preserve that aspect for width.
  const width = Math.round(height * (512 / 768));
  const animClass = state === 'walk' ? 'sprite-walk' : 'idle-micro';
  const flip = direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)';

  return (
    <div
      className={`relative pointer-events-none ${className}`}
      style={{ width, height }}
    >
      {/* Real ground shadow — sits BEHIND the sprite, anchored to feet,
          does not move with the bob layer so the character feels planted. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: -2,
          width: width * 0.62,
          height: Math.max(8, height * 0.07),
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 75%)',
          filter: 'blur(2.5px)',
          zIndex: 0,
        }}
      />
      {accentHsl && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: -1,
            width: width * 0.55,
            height: Math.max(5, height * 0.035),
            background: `radial-gradient(ellipse at center, hsl(${accentHsl} / 0.45) 0%, transparent 70%)`,
            filter: 'blur(3px)',
            zIndex: 0,
          }}
        />
      )}

      {/* Sprite layer — bobs / leans without disturbing the shadow */}
      <div
        className={`absolute inset-0 ${animClass}`}
        style={{ transform: flip, transformOrigin: 'center bottom', zIndex: 1 }}
      >
        <img
          src={src}
          alt={alt}
          width={512}
          height={768}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain select-none"
          style={{ filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.55))' }}
        />
      </div>
    </div>
  );
};

export const CharacterAvatar = memo(CharacterAvatarImpl);
