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

// Simple deterministic hash → 0..1 to vary palette/silhouette per NPC name.
const hashFloat = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

const skinTones = ['#e8c5a0', '#c89a76', '#a07555', '#8a5a3c', '#7a8b9a', '#cdd9ff'];
const accentTones = ['#7ad9ff', '#7af0b0', '#ffb04a', '#ff7a3a', '#c79bff', '#ff5050'];

const NpcMarkerImpl = ({ kind, name, close }: NpcMarkerProps) => {
  const c = COLOR[kind];
  const color = `hsl(${c.hsl})`;
  const colorSoft = `hsl(${c.hsl} / 0.45)`;
  const colorFaint = `hsl(${c.hsl} / 0.18)`;

  const seed = hashFloat(name);
  const skin = skinTones[Math.floor(seed * skinTones.length)];
  const accent = accentTones[Math.floor((seed * 7.13) % 1 * accentTones.length)];

  return (
    <div className="relative flex flex-col items-center" style={{ color }}>
      <div
        className={`flex items-center gap-1 mb-1 ${close ? 'animate-pulse' : 'opacity-90 group-hover:opacity-100'}`}
      >
        <span
          className="text-[11px] font-orbitron px-2 py-0.5 rounded whitespace-nowrap"
          style={{
            background: 'rgba(8,12,18,0.88)',
            border: `1px solid ${close ? color : colorSoft}`,
            color,
            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
            boxShadow: close ? `0 0 10px ${colorSoft}` : 'none',
          }}
        >
          {name}
        </span>
        <span
          className="text-[8px] font-orbitron tracking-widest px-1 py-0.5 rounded"
          style={{ color, background: 'rgba(0,0,0,0.7)', border: `1px solid ${colorSoft}` }}
        >
          {c.label}
        </span>
      </div>

      <div className="relative npc-bob w-full h-full">
        {close && (
          <>
            <div
              className="absolute left-1/2 top-1/2 interact-ring rounded-full pointer-events-none"
              style={{ width: 96, height: 32, border: `2px solid ${color}`, boxShadow: `0 0 16px ${color}` }}
            />
            <div
              className="absolute left-1/2 top-1/2 interact-ring rounded-full pointer-events-none"
              style={{ width: 96, height: 32, border: `1px solid ${color}`, boxShadow: `0 0 10px ${color}`, animationDelay: '0.7s' }}
            />
          </>
        )}

        <svg viewBox="0 0 64 100" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id={`body-${kind}-${seed.toFixed(3)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0a0f18" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Head */}
          <ellipse cx="32" cy="14" rx="7" ry="8" fill={skin} stroke="#000" strokeWidth="0.6" />
          {/* Hair / hood (varies by seed) */}
          {seed > 0.5 ? (
            <path d="M25 10 Q32 4 39 10 Q39 14 32 14 Q25 14 25 10 Z" fill={accent} opacity="0.85" />
          ) : (
            <path d="M24 12 Q32 2 40 12 L40 18 Q32 16 24 18 Z" fill="#1a2230" opacity="0.9" />
          )}
          {/* Eyes */}
          <circle cx="29" cy="14" r="0.9" fill={kind === 'enemy' ? color : '#000'} />
          <circle cx="35" cy="14" r="0.9" fill={kind === 'enemy' ? color : '#000'} />

          {/* Body / jacket */}
          <path d="M22 26 L42 26 L46 60 L40 78 L24 78 L18 60 Z"
            fill={`url(#body-${kind}-${seed.toFixed(3)})`} stroke="#000" strokeWidth="0.6" />
          {/* Shoulder pads */}
          <ellipse cx="22" cy="28" rx="5" ry="3" fill={accent} opacity="0.85" />
          <ellipse cx="42" cy="28" rx="5" ry="3" fill={accent} opacity="0.85" />
          {/* Chest seam glow */}
          <line x1="28" y1="40" x2="36" y2="40" stroke={color} strokeWidth="1.2" opacity="0.9" />
          {/* Belt */}
          <rect x="22" y="60" width="20" height="3" fill="#0a0f18" stroke={color} strokeWidth="0.4" />
          {/* Legs */}
          <rect x="25" y="78" width="5" height="14" fill="#0a0f18" stroke="#000" strokeWidth="0.4" />
          <rect x="34" y="78" width="5" height="14" fill="#0a0f18" stroke="#000" strokeWidth="0.4" />

          {/* Role-specific accessories */}
          {kind === 'vendor' && (
            <g>
              {/* Holo-screen above shoulder */}
              <rect x="44" y="22" width="14" height="12" rx="1" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="0.5" />
              <line x1="46" y1="26" x2="56" y2="26" stroke={color} strokeWidth="0.4" />
              <line x1="46" y1="29" x2="56" y2="29" stroke={color} strokeWidth="0.4" />
              {/* Counter / crate */}
              <rect x="14" y="84" width="36" height="10" rx="1" fill="#1a2230" stroke={color} strokeWidth="0.5" />
              <rect x="18" y="86" width="6" height="6" fill={color} fillOpacity="0.6" />
              <rect x="28" y="86" width="6" height="6" fill={accent} fillOpacity="0.7" />
              <rect x="38" y="86" width="6" height="6" fill={color} fillOpacity="0.6" />
            </g>
          )}
          {kind === 'quest' && (
            <g>
              {/* Floating data-pad */}
              <rect x="44" y="34" width="12" height="16" rx="1" fill={color} fillOpacity="0.45" stroke={color} strokeWidth="0.6" />
              <line x1="46" y1="38" x2="54" y2="38" stroke={color} strokeWidth="0.4" />
              <line x1="46" y1="41" x2="54" y2="41" stroke={color} strokeWidth="0.4" />
              <line x1="46" y1="44" x2="52" y2="44" stroke={color} strokeWidth="0.4" />
              {/* Exclamation halo */}
              <circle cx="32" cy="2" r="2.4" fill={color}>
                <animate attributeName="r" values="1.6;2.6;1.6" dur="1.2s" repeatCount="indefinite" />
              </circle>
              <text x="32" y="3.5" textAnchor="middle" fontSize="3.2" fill="#000" fontWeight="bold">!</text>
            </g>
          )}
          {kind === 'enemy' && (
            <g>
              {/* Weapon */}
              <rect x="44" y="44" width="14" height="3" fill="#3a3f47" stroke="#000" strokeWidth="0.3" />
              <polygon points="58,42 62,45.5 58,49" fill={color} />
              {/* Menacing chest light */}
              <circle cx="32" cy="44" r="1.8" fill={color}>
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite" />
              </circle>
            </g>
          )}
        </svg>

        {/* Ground glow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: -6,
            width: close ? 78 : 56,
            height: close ? 16 : 12,
            background: close
              ? `radial-gradient(ellipse at center, ${color} 0%, ${colorSoft} 45%, transparent 80%)`
              : `radial-gradient(ellipse at center, ${colorSoft} 0%, ${colorFaint} 45%, transparent 75%)`,
            filter: close ? 'blur(4px)' : 'blur(3px)',
            transition: 'width 250ms ease-out, height 250ms ease-out, filter 250ms ease-out',
          }}
        />
      </div>

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
