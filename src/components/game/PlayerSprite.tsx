import { memo } from 'react';
import bodyBase from '@/assets/sprites/body-base.png';

export type SpriteDirection = 'left' | 'right';
export type SpriteState = 'idle' | 'walk';
export type SpriteRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface PlayerSpriteProps {
  direction: SpriteDirection;
  state: SpriteState;
  armorVariant?: string | null;
  weaponVariant?: string | null;
  rarity?: SpriteRarity;
  scale?: number;
  className?: string;
  showShadow?: boolean;
  showGlow?: boolean;
}

// SVG color palettes for armor variants (with rim accent for shading)
const ARMOR_PALETTES: Record<string, { primary: string; accent: string; glow: string; rim: string }> = {
  light_gray:   { primary: '#9aa3ad', accent: '#3a4250', glow: '#e8eef5', rim: '#ffffff' },
  medium_green: { primary: '#3da06b', accent: '#0f3a24', glow: '#7af0b0', rim: '#c2ffd9' },
  medium_blue:  { primary: '#3a7bd1', accent: '#102a55', glow: '#7ab6ff', rim: '#cfe3ff' },
  heavy_violet: { primary: '#8a4bd1', accent: '#2d0e58', glow: '#c79bff', rim: '#ecd6ff' },
  heavy_gold:   { primary: '#d1a23a', accent: '#5b3f0d', glow: '#ffe27a', rim: '#fff4c2' },
};

const WEAPON_PALETTES: Record<string, { color: string; edge: string; glow: string }> = {
  sword: { color: '#cfd8e0', edge: '#5a6470', glow: '#7ad9ff' },
  gun:   { color: '#3a3f47', edge: '#0d0f12', glow: '#ff7a3a' },
  staff: { color: '#6a4a2a', edge: '#2a1a0a', glow: '#c79bff' },
  axe:   { color: '#a0a8b0', edge: '#3a4350', glow: '#ff5050' },
};

const RARITY_GLOW: Record<SpriteRarity, string> = {
  common:    'transparent',
  uncommon:  'hsl(150 100% 55% / 0.55)',
  rare:      'hsl(210 100% 60% / 0.6)',
  epic:      'hsl(280 100% 65% / 0.65)',
  legendary: 'hsl(40 100% 60% / 0.75)',
};

const ArmorOverlay = ({ variant }: { variant: string }) => {
  const p = ARMOR_PALETTES[variant] ?? ARMOR_PALETTES.light_gray;
  const gradId = `armor-grad-${variant}`;
  return (
    <svg
      viewBox="0 0 100 200"
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.rim} stopOpacity="0.95" />
          <stop offset="40%" stopColor={p.primary} />
          <stop offset="100%" stopColor={p.accent} />
        </linearGradient>
      </defs>
      {/* Chest plate, anchored to body torso (slightly tighter to body) */}
      <path
        d="M34 62 L66 62 L70 96 L60 110 L40 110 L30 96 Z"
        fill={`url(#${gradId})`}
        stroke={p.accent}
        strokeWidth="1.2"
      />
      {/* Shoulder pads */}
      <ellipse cx="35" cy="62" rx="8" ry="5" fill={p.primary} stroke={p.accent} strokeWidth="1" />
      <ellipse cx="65" cy="62" rx="8" ry="5" fill={p.primary} stroke={p.accent} strokeWidth="1" />
      {/* Top-down lighting highlight */}
      <path d="M36 64 L64 64 L62 70 L38 70 Z" fill={p.rim} opacity="0.35" />
      {/* Glow seam — animated shimmer */}
      <line x1="40" y1="80" x2="60" y2="80" stroke={p.glow} strokeWidth="1.4" opacity="0.85" className="armor-shimmer" />
      <circle cx="50" cy="80" r="1.5" fill={p.glow} className="armor-shimmer" />
      {/* Belt */}
      <rect x="38" y="106" width="24" height="4" fill={p.accent} />
      <rect x="49" y="106" width="3" height="4" fill={p.glow} />
      {/* Soft edge shadow blending with body */}
      <path d="M34 62 L30 96 L40 110" fill="none" stroke="#000" strokeWidth="0.8" opacity="0.35" />
      <path d="M66 62 L70 96 L60 110" fill="none" stroke="#000" strokeWidth="0.8" opacity="0.35" />
    </svg>
  );
};

const WeaponOverlay = ({ variant, direction }: { variant: string; direction: SpriteDirection }) => {
  const p = WEAPON_PALETTES[variant] ?? WEAPON_PALETTES.sword;
  const flip = direction === 'left' ? -1 : 1;
  const anchorX = flip > 0 ? 70 : 30;
  return (
    <svg
      viewBox="0 0 100 200"
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g transform={`translate(${anchorX} 102) scale(${flip} 1)`}>
        {/* Glow halo behind weapon */}
        <ellipse cx="14" cy="0" rx="16" ry="5" fill={p.glow} opacity="0.5" className="weapon-glow" />
        {variant === 'sword' && (
          <>
            <rect x="-3" y="-3" width="3" height="6" fill={p.edge} />
            <rect x="0" y="-2" width="22" height="4" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <polygon points="22,-3 32,0 22,3" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <line x1="2" y1="0" x2="30" y2="0" stroke={p.glow} strokeWidth="0.9" opacity="0.95" />
          </>
        )}
        {variant === 'gun' && (
          <>
            <rect x="-2" y="-2" width="3" height="8" fill={p.edge} />
            <rect x="0" y="-3" width="16" height="6" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <rect x="14" y="-2" width="10" height="3" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <circle cx="24" cy="-1" r="1.6" fill={p.glow} />
          </>
        )}
        {variant === 'staff' && (
          <>
            <g transform="rotate(-15)">
              <rect x="0" y="-1" width="28" height="2" fill={p.color} stroke={p.edge} strokeWidth="0.5" />
            </g>
            <circle cx="26" cy="-8" r="4" fill={p.glow} opacity="0.85" className="weapon-glow" />
            <circle cx="26" cy="-8" r="1.8" fill="#ffffff" />
          </>
        )}
        {variant === 'axe' && (
          <>
            <rect x="0" y="-1" width="20" height="2" fill={p.edge} />
            <polygon points="18,-7 28,-2 28,4 18,6" fill={p.color} stroke={p.edge} strokeWidth="0.6" />
            <line x1="20" y1="-4" x2="26" y2="-4" stroke={p.glow} strokeWidth="0.7" />
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
  rarity = 'common',
  scale = 1,
  className = '',
  showShadow = true,
  showGlow = true,
}: PlayerSpriteProps) => {
  const flip = direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)';
  const animClass = state === 'walk' ? 'sprite-walk' : 'sprite-idle';
  // Larger default: 110px wide → ~165px tall (vs old 56×84)
  const w = 110 * scale;
  const h = 165 * scale;
  const glowColor = RARITY_GLOW[rarity];
  const showSparkles = rarity === 'epic' || rarity === 'legendary';

  return (
    <div
      className={`relative ${className}`}
      style={{ width: w, height: h, willChange: 'transform' }}
    >
      {/* Ground shadow — fixed under feet, NOT inside the bobbing layer.
          Slightly larger when walking to sell weight transfer. */}
      {showShadow && (
        <div
          className={`absolute left-1/2 pointer-events-none ${state === 'walk' ? 'ground-shadow-walk' : 'ground-shadow'}`}
          style={{
            bottom: -4,
            width: w * 0.6,
            height: Math.max(8, h * 0.07),
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 75%)',
            filter: 'blur(2.5px)',
          }}
        />
      )}

      {/* Sprite stack — bobs / leans, but the shadow above stays put */}
      <div
        className="absolute inset-0"
        style={{ transform: flip, transformOrigin: 'center bottom' }}
      >
        <div className={`relative w-full h-full ${animClass}`}>
          {/* Rarity outer glow */}
          {showGlow && rarity !== 'common' && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: `0 0 ${18 * scale}px ${4 * scale}px ${glowColor}`,
                borderRadius: '40% 40% 30% 30% / 50% 50% 30% 30%',
                opacity: 0.85,
              }}
            />
          )}
          <img
            src={bodyBase}
            alt=""
            width={512}
            height={768}
            loading="lazy"
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain select-none"
            style={{ filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.6))' }}
          />
          {armorVariant && <ArmorOverlay variant={armorVariant} />}
          {weaponVariant && <WeaponOverlay variant={weaponVariant} direction="right" />}
          {/* Top-down rim light — sells the lighting direction */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 55% 25% at 50% 12%, rgba(255,240,210,0.28) 0%, rgba(255,240,210,0) 70%)',
              mixBlendMode: 'screen',
            }}
          />
          {/* Bottom contact darkening */}
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              height: '14%',
              background:
                'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0))',
            }}
          />
        </div>
      </div>

      {/* Sparkles for rare gear (not flipped) */}
      {showSparkles && (
        <>
          <div
            className="absolute sparkle pointer-events-none"
            style={{ left: '30%', bottom: '40%', width: 4, height: 4, background: glowColor, borderRadius: '50%', boxShadow: `0 0 6px ${glowColor}` }}
          />
          <div
            className="absolute sparkle pointer-events-none"
            style={{ left: '70%', bottom: '55%', width: 3, height: 3, background: glowColor, borderRadius: '50%', boxShadow: `0 0 5px ${glowColor}`, animationDelay: '0.9s' }}
          />
        </>
      )}
    </div>
  );
};

export const PlayerSprite = memo(PlayerSpriteImpl);
