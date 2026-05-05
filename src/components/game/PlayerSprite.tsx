import { memo } from 'react';
import bodyBase from '@/assets/sprites/body-base.png';

export type SpriteDirection = 'left' | 'right';
export type SpriteState = 'idle' | 'walk';

export interface PlayerSpriteProps {
  direction: SpriteDirection;
  state: SpriteState;
  armorVariant?: string | null;
  weaponVariant?: string | null;
  scale?: number;
  className?: string;
}

// SVG color palettes for armor variants
const ARMOR_PALETTES: Record<string, { primary: string; accent: string; glow: string }> = {
  light_gray:    { primary: '#9aa3ad', accent: '#5a6470', glow: '#cdd5dd' },
  medium_green:  { primary: '#3da06b', accent: '#1d5e3c', glow: '#7af0b0' },
  medium_blue:   { primary: '#3a7bd1', accent: '#1d3f7a', glow: '#7ab6ff' },
  heavy_violet:  { primary: '#8a4bd1', accent: '#4a1d7a', glow: '#c79bff' },
  heavy_gold:    { primary: '#d1a23a', accent: '#7a5b1d', glow: '#ffe27a' },
};

// SVG palettes for weapons
const WEAPON_PALETTES: Record<string, { color: string; edge: string; glow: string }> = {
  sword: { color: '#cfd8e0', edge: '#7a8590', glow: '#7ad9ff' },
  gun:   { color: '#3a3f47', edge: '#1a1d22', glow: '#ff7a3a' },
  staff: { color: '#6a4a2a', edge: '#3a2a1a', glow: '#c79bff' },
  axe:   { color: '#a0a8b0', edge: '#5a6470', glow: '#ff5050' },
};

// Walk bob: subtle vertical bounce keyframes via inline animation
// We use CSS animation defined in index.css for performance.

const ArmorOverlay = ({ variant }: { variant: string }) => {
  const p = ARMOR_PALETTES[variant] ?? ARMOR_PALETTES.light_gray;
  return (
    // Positioned over the torso area of the body sprite (~30%-55% of height)
    <svg
      viewBox="0 0 100 200"
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Chest plate */}
      <path
        d="M32 60 L68 60 L72 95 L62 110 L38 110 L28 95 Z"
        fill={p.primary}
        stroke={p.accent}
        strokeWidth="1.5"
      />
      {/* Shoulder pad */}
      <ellipse cx="34" cy="60" rx="10" ry="6" fill={p.primary} stroke={p.accent} strokeWidth="1.2" />
      <ellipse cx="66" cy="60" rx="10" ry="6" fill={p.primary} stroke={p.accent} strokeWidth="1.2" />
      {/* Glow line */}
      <line x1="40" y1="78" x2="60" y2="78" stroke={p.glow} strokeWidth="1.2" opacity="0.9" />
      {/* Belt */}
      <rect x="36" y="108" width="28" height="4" fill={p.accent} />
      <rect x="48" y="108" width="4" height="4" fill={p.glow} />
    </svg>
  );
};

const WeaponOverlay = ({ variant, direction }: { variant: string; direction: SpriteDirection }) => {
  const p = WEAPON_PALETTES[variant] ?? WEAPON_PALETTES.sword;
  // weapon anchored at hand (~right side of body, around y=95)
  const flip = direction === 'left' ? -1 : 1;
  return (
    <svg
      viewBox="0 0 100 200"
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g transform={`translate(${flip > 0 ? 70 : 30} 100) scale(${flip} 1)`}>
        {variant === 'sword' && (
          <>
            <rect x="0" y="-2" width="22" height="4" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <polygon points="22,-3 30,0 22,3" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <line x1="0" y1="0" x2="22" y2="0" stroke={p.glow} strokeWidth="0.8" opacity="0.85" />
            <rect x="-3" y="-3" width="3" height="6" fill={p.edge} />
          </>
        )}
        {variant === 'gun' && (
          <>
            <rect x="0" y="-3" width="16" height="6" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <rect x="14" y="-2" width="8" height="3" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <rect x="-2" y="-2" width="3" height="8" fill={p.edge} />
            <circle cx="22" cy="-1" r="1.2" fill={p.glow} />
          </>
        )}
        {variant === 'staff' && (
          <>
            <rect x="0" y="-1" width="26" height="2" fill={p.color} stroke={p.edge} strokeWidth="0.5" transform="rotate(-15)" />
            <circle cx="25" cy="-7" r="3" fill={p.glow} opacity="0.85" />
            <circle cx="25" cy="-7" r="1.5" fill="#fff" />
          </>
        )}
        {variant === 'axe' && (
          <>
            <rect x="0" y="-1" width="20" height="2" fill={p.edge} />
            <polygon points="18,-6 26,-2 26,4 18,6" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <line x1="20" y1="-4" x2="24" y2="-4" stroke={p.glow} strokeWidth="0.6" />
          </>
        )}
      </g>
    </svg>
  );
};

const PlayerSpriteImpl = ({
  direction,
  state,
  armorVariant,
  weaponVariant,
  scale = 1,
  className = '',
}: PlayerSpriteProps) => {
  const flip = direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)';
  const animClass = state === 'walk' ? 'sprite-walk' : 'sprite-idle';
  // base sprite is 512x768 (2:3). Default render width 56px → 84px tall.
  const w = 56 * scale;
  const h = 84 * scale;
  return (
    <div
      className={`relative ${className}`}
      style={{
        width: w,
        height: h,
        transform: flip,
        transformOrigin: 'center bottom',
        willChange: 'transform',
      }}
    >
      <div className={`relative w-full h-full ${animClass}`}>
        <img
          src={bodyBase}
          alt=""
          width={512}
          height={768}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain select-none"
        />
        {armorVariant && <ArmorOverlay variant={armorVariant} />}
        {weaponVariant && <WeaponOverlay variant={weaponVariant} direction="right" />}
      </div>
    </div>
  );
};

export const PlayerSprite = memo(PlayerSpriteImpl);
