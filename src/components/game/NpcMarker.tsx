import { memo } from 'react';

export type NpcKind = 'vendor' | 'quest' | 'enemy';

interface NpcMarkerProps {
  kind: NpcKind;
  name: string;
  close: boolean;
}

const COLOR: Record<NpcKind, { hsl: string; label: string }> = {
  vendor: { hsl: '195 100% 60%', label: 'TRADE' },
  quest:  { hsl: '42 100% 62%',  label: 'TASK' },
  enemy:  { hsl: '0 85% 60%',    label: 'HOSTILE' },
};

const NpcMarkerImpl = ({ kind, name, close }: NpcMarkerProps) => {
  const c = COLOR[kind];
  const color = `hsl(${c.hsl})`;
  const colorSoft = `hsl(${c.hsl} / 0.45)`;
  const colorFaint = `hsl(${c.hsl} / 0.18)`;

  return (
    <div className="relative flex flex-col items-center" style={{ color }}>
      {/* Name / interaction prompt */}
      {close ? (
        <div
          className="text-[10px] font-orbitron px-2 py-0.5 rounded mb-1 animate-pulse"
          style={{ background: color, color: '#000', boxShadow: `0 0 10px ${color}` }}
        >
          [E] {name}
        </div>
      ) : (
        <div
          className="text-[10px] font-orbitron px-1.5 py-0.5 rounded mb-1 opacity-80 group-hover:opacity-100"
          style={{ background: 'rgba(8,12,18,0.85)', border: `1px solid ${colorSoft}`, color }}
        >
          {name}
        </div>
      )}

      {/* In-world figure */}
      <div className="relative npc-bob" style={{ width: 64, height: 88 }}>
        {/* Interaction ring on hover/proximity */}
        {close && (
          <div
            className="absolute left-1/2 top-1/2 interact-ring rounded-full pointer-events-none"
            style={{ width: 90, height: 30, border: `2px solid ${color}`, boxShadow: `0 0 12px ${color}` }}
          />
        )}

        {kind === 'enemy' ? (
          /* Enemy silhouette — ominous standing figure */
          <svg viewBox="0 0 64 88" className="absolute inset-0 w-full h-full hologram-flicker">
            <defs>
              <linearGradient id="enemy-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                <stop offset="100%" stopColor="#1a0408" stopOpacity="1" />
              </linearGradient>
            </defs>
            {/* Head */}
            <ellipse cx="32" cy="14" rx="9" ry="10" fill="url(#enemy-body)" stroke={color} strokeWidth="0.8" />
            {/* Eyes */}
            <circle cx="29" cy="13" r="1.4" fill={color} />
            <circle cx="35" cy="13" r="1.4" fill={color} />
            {/* Body */}
            <path d="M20 26 L44 26 L46 58 L40 70 L24 70 L18 58 Z" fill="url(#enemy-body)" stroke={color} strokeWidth="0.8" />
            {/* Shoulders */}
            <ellipse cx="20" cy="28" rx="5" ry="3" fill={color} opacity="0.7" />
            <ellipse cx="44" cy="28" rx="5" ry="3" fill={color} opacity="0.7" />
            {/* Legs */}
            <rect x="25" y="68" width="5" height="14" fill="#1a0408" stroke={color} strokeWidth="0.6" />
            <rect x="34" y="68" width="5" height="14" fill="#1a0408" stroke={color} strokeWidth="0.6" />
            {/* Chest seam glow */}
            <line x1="28" y1="40" x2="36" y2="40" stroke={color} strokeWidth="1.2" opacity="0.9" />
          </svg>
        ) : (
          /* Vendor / Quest hologram terminal */
          <svg viewBox="0 0 64 88" className="absolute inset-0 w-full h-full hologram-flicker">
            <defs>
              <linearGradient id={`term-body-${kind}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0a0f18" />
                <stop offset="100%" stopColor="#1a2230" />
              </linearGradient>
              <linearGradient id={`term-screen-${kind}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.85" />
                <stop offset="100%" stopColor={color} stopOpacity="0.25" />
              </linearGradient>
            </defs>
            {/* Base / pylon */}
            <rect x="22" y="78" width="20" height="6" fill="#0a0f18" stroke={color} strokeWidth="0.6" rx="1" />
            <rect x="27" y="64" width="10" height="16" fill={`url(#term-body-${kind})`} stroke={color} strokeWidth="0.6" />
            {/* Terminal body */}
            <rect x="14" y="18" width="36" height="48" rx="3" fill={`url(#term-body-${kind})`} stroke={color} strokeWidth="0.9" />
            {/* Screen */}
            <rect x="18" y="22" width="28" height="32" rx="1.5" fill={`url(#term-screen-${kind})`} />
            {/* Scan lines */}
            <line x1="18" y1="28" x2="46" y2="28" stroke={color} strokeWidth="0.4" opacity="0.5" />
            <line x1="18" y1="34" x2="46" y2="34" stroke={color} strokeWidth="0.4" opacity="0.5" />
            <line x1="18" y1="40" x2="46" y2="40" stroke={color} strokeWidth="0.4" opacity="0.5" />
            <line x1="18" y1="46" x2="46" y2="46" stroke={color} strokeWidth="0.4" opacity="0.5" />
            {/* Icon glyph */}
            {kind === 'vendor' ? (
              <g transform="translate(32 38)" fill="#000" stroke={color} strokeWidth="0.8">
                <rect x="-7" y="-5" width="14" height="10" rx="1" fill={color} />
                <rect x="-5" y="-7" width="10" height="3" fill={color} />
              </g>
            ) : (
              <g transform="translate(32 38)" stroke={color} strokeWidth="1.2" fill="none">
                <path d="M-6 -6 L6 -6 L6 6 L0 8 L-6 6 Z" fill={color} fillOpacity="0.4" />
                <line x1="-3" y1="-2" x2="3" y2="-2" />
                <line x1="-3" y1="1"  x2="3" y2="1" />
              </g>
            )}
            {/* Indicator LED */}
            <circle cx="42" cy="60" r="1.6" fill={color}>
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite" />
            </circle>
            {/* Antenna */}
            <line x1="32" y1="18" x2="32" y2="12" stroke={color} strokeWidth="0.8" />
            <circle cx="32" cy="11" r="1.2" fill={color} />
          </svg>
        )}

        {/* Holographic ground glow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: -6,
            width: 56,
            height: 12,
            background: `radial-gradient(ellipse at center, ${colorSoft} 0%, ${colorFaint} 45%, transparent 75%)`,
            filter: 'blur(3px)',
          }}
        />
      </div>

      {/* Type badge */}
      <div
        className="text-[8px] font-orbitron tracking-widest mt-1 px-1 rounded"
        style={{ color, background: 'rgba(0,0,0,0.55)', border: `1px solid ${colorSoft}` }}
      >
        {c.label}
      </div>
    </div>
  );
};

export const NpcMarker = memo(NpcMarkerImpl);
