import { memo } from 'react';
import bossWarmech from '@/assets/enemies/boss-warmech.png';

export type EnemyKind = 'drone' | 'bot' | 'humanoid' | 'beast' | 'boss';

export interface EnemySpriteProps {
  /** Enemy display/internal name. Used to pick sprite variant + accent color. */
  name: string;
  scale?: number;
  /** Triggers attack animation pose (slight forward lean / charging glow). */
  attacking?: boolean;
  /** Triggers hit reaction (red flash handled by parent). */
  hit?: boolean;
}

const BOSS_NAME_RE = /(boss|warmech|overseer|tyrant|warden|colossus|prime|alpha|elite)/i;

/** Choose enemy kind from name keywords. Defaults to drone for training/calibration units. */
export const inferEnemyKind = (name: string): EnemyKind => {
  const n = (name ?? '').toLowerCase();
  if (BOSS_NAME_RE.test(n)) return 'boss';
  if (/(drone|calibrat|training|dummy|target|unit\s*mk|sentinel|servitor)/.test(n)) return 'drone';
  if (/(bot|mech|automaton|construct)/.test(n)) return 'bot';
  if (/(beast|hound|wolf|crawler|spawn)/.test(n)) return 'beast';
  return 'humanoid';
};

/** Deterministic color from name so different enemies look different. */
const accentFromName = (name: string): string => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 90% 60%)`;
};

const DroneSprite = ({ accent, attacking }: { accent: string; attacking?: boolean }) => (
  <svg viewBox="0 0 120 180" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMax meet">
    <defs>
      <radialGradient id="dr-core" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fff" />
        <stop offset="35%" stopColor={accent} stopOpacity="0.95" />
        <stop offset="100%" stopColor={accent} stopOpacity="0" />
      </radialGradient>
      <linearGradient id="dr-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5a6470" />
        <stop offset="50%" stopColor="#2c333d" />
        <stop offset="100%" stopColor="#0e1218" />
      </linearGradient>
    </defs>

    {/* Hover glow under unit */}
    <ellipse cx="60" cy="160" rx="34" ry="6" fill={accent} opacity="0.35">
      <animate attributeName="opacity" values="0.25;0.5;0.25" dur="1.6s" repeatCount="indefinite" />
    </ellipse>
    <ellipse cx="60" cy="160" rx="22" ry="3" fill="#fff" opacity="0.2" />

    {/* Hovering body group — bobs */}
    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="2.4s" repeatCount="indefinite" />

      {/* Lower thruster ring */}
      <ellipse cx="60" cy="138" rx="26" ry="6" fill="#1b2028" stroke="#0a0d12" strokeWidth="1.2" />
      <ellipse cx="60" cy="138" rx="20" ry="3" fill={accent} opacity="0.55">
        <animate attributeName="opacity" values="0.4;0.85;0.4" dur="1.2s" repeatCount="indefinite" />
      </ellipse>

      {/* Main chassis — angular, mech-like */}
      <polygon points="36,70 84,70 92,118 80,140 40,140 28,118" fill="url(#dr-body)" stroke="#0a0d12" strokeWidth="1.5" />
      {/* Side fins */}
      <polygon points="28,118 18,108 18,128 32,130" fill="#2c333d" stroke="#0a0d12" strokeWidth="1" />
      <polygon points="92,118 102,108 102,128 88,130" fill="#2c333d" stroke="#0a0d12" strokeWidth="1" />

      {/* Glowing core */}
      <circle cx="60" cy="100" r="18" fill="url(#dr-core)" />
      <circle cx="60" cy="100" r="7" fill="#ffffff" opacity="0.9">
        <animate attributeName="r" values="6;8;6" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="100" r="14" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.8" />

      {/* Sensor / "head" pod */}
      <rect x="50" y="48" width="20" height="22" rx="6" fill="#1b2028" stroke="#0a0d12" strokeWidth="1.4" />
      <rect x="53" y="55" width="14" height="6" rx="2" fill={accent}>
        <animate attributeName="fill-opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
      </rect>
      {/* Antennae */}
      <line x1="52" y1="48" x2="46" y2="36" stroke="#3a4250" strokeWidth="1.4" />
      <line x1="68" y1="48" x2="74" y2="36" stroke="#3a4250" strokeWidth="1.4" />
      <circle cx="46" cy="36" r="1.6" fill={accent} />
      <circle cx="74" cy="36" r="1.6" fill={accent} />

      {/* Emitter arm — charges when attacking */}
      <g>
        <rect x="84" y="92" width="22" height="6" rx="2" fill="#3a4250" stroke="#0a0d12" strokeWidth="0.8" />
        <circle cx="108" cy="95" r={attacking ? 6 : 3} fill={accent}>
          {attacking && <animate attributeName="r" values="3;7;3" dur="0.4s" repeatCount="indefinite" />}
        </circle>
      </g>
      <g>
        <rect x="14" y="92" width="22" height="6" rx="2" fill="#3a4250" stroke="#0a0d12" strokeWidth="0.8" />
        <circle cx="14" cy="95" r="2.4" fill={accent} opacity="0.7" />
      </g>

      {/* Panel detail */}
      <line x1="40" y1="120" x2="80" y2="120" stroke={accent} strokeWidth="0.8" opacity="0.6" />
      <rect x="56" y="124" width="8" height="3" fill={accent} opacity="0.6" />
    </g>
  </svg>
);

const BotSprite = ({ accent, attacking }: { accent: string; attacking?: boolean }) => (
  <svg viewBox="0 0 120 180" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMax meet">
    <defs>
      <linearGradient id="bot-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7a8290" />
        <stop offset="100%" stopColor="#1c2128" />
      </linearGradient>
    </defs>
    {/* Legs */}
    <rect x="42" y="130" width="12" height="36" fill="#2c333d" stroke="#0a0d12" />
    <rect x="66" y="130" width="12" height="36" fill="#2c333d" stroke="#0a0d12" />
    <rect x="40" y="162" width="16" height="6" fill="#0a0d12" />
    <rect x="64" y="162" width="16" height="6" fill="#0a0d12" />
    {/* Torso */}
    <rect x="34" y="74" width="52" height="60" rx="6" fill="url(#bot-body)" stroke="#0a0d12" strokeWidth="1.4" />
    <circle cx="60" cy="100" r="9" fill={accent}>
      <animate attributeName="fill-opacity" values="0.6;1;0.6" dur="1.4s" repeatCount="indefinite" />
    </circle>
    {/* Head */}
    <rect x="46" y="46" width="28" height="26" rx="4" fill="#1b2028" stroke="#0a0d12" strokeWidth="1.4" />
    <rect x="50" y="54" width="20" height="6" rx="1" fill={accent} />
    {/* Arms */}
    <rect x="20" y="78" width="14" height="46" fill="#2c333d" stroke="#0a0d12" />
    <rect x="86" y="78" width="14" height="46" fill="#2c333d" stroke="#0a0d12" />
    {/* Weapon arm */}
    <rect x="98" y="100" width="18" height="8" fill="#3a4250" stroke="#0a0d12" />
    <circle cx="116" cy="104" r={attacking ? 6 : 3} fill={accent}>
      {attacking && <animate attributeName="r" values="3;7;3" dur="0.35s" repeatCount="indefinite" />}
    </circle>
  </svg>
);

const BeastSprite = ({ accent, attacking }: { accent: string; attacking?: boolean }) => (
  <svg viewBox="0 0 120 180" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMax meet">
    {/* Hunched beast silhouette */}
    <ellipse cx="60" cy="160" rx="40" ry="6" fill="#000" opacity="0.5" />
    <path d="M20 140 Q30 80 70 80 Q105 80 105 130 L100 160 L80 160 L78 140 L42 140 L40 160 L25 160 Z"
      fill="#2a1a14" stroke="#0a0604" strokeWidth="1.6" />
    {/* Head */}
    <path d="M70 80 Q88 70 96 86 L92 100 L78 102 Z" fill="#3a241a" stroke="#0a0604" strokeWidth="1.4" />
    {/* Eyes */}
    <circle cx="86" cy="86" r="2.4" fill={accent}>
      <animate attributeName="fill-opacity" values="0.6;1;0.6" dur={attacking ? '0.4s' : '1.6s'} repeatCount="indefinite" />
    </circle>
    {/* Spikes */}
    <polygon points="40,80 44,68 48,80" fill="#1a0e08" />
    <polygon points="52,76 56,62 60,76" fill="#1a0e08" />
    <polygon points="64,76 68,64 72,76" fill="#1a0e08" />
    {/* Claws */}
    <polygon points="22,140 14,150 22,150" fill="#0a0604" />
    <polygon points="100,140 110,150 100,150" fill="#0a0604" />
  </svg>
);

const HumanoidSprite = ({ accent, attacking }: { accent: string; attacking?: boolean }) => (
  <svg viewBox="0 0 120 180" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMax meet">
    {/* Hooded sci-fi humanoid silhouette — distinct from player avatar */}
    <ellipse cx="60" cy="166" rx="30" ry="5" fill="#000" opacity="0.55" />
    <path d="M40 70 L80 70 L90 130 L82 166 L38 166 L30 130 Z" fill="#1a1f28" stroke="#05080d" strokeWidth="1.4" />
    {/* Hood */}
    <path d="M38 70 Q60 28 82 70 L74 78 L46 78 Z" fill="#0d1116" stroke="#05080d" strokeWidth="1.2" />
    {/* Visor */}
    <rect x="48" y="60" width="24" height="6" rx="2" fill={accent}>
      <animate attributeName="fill-opacity" values="0.5;1;0.5" dur="1.8s" repeatCount="indefinite" />
    </rect>
    {/* Belt accent */}
    <rect x="40" y="116" width="40" height="4" fill={accent} opacity="0.6" />
    {/* Weapon — energy blade */}
    <g>
      <rect x="86" y="108" width="6" height="20" fill="#3a4250" />
      <rect x="88" y="78" width="2" height="34" fill={accent}>
        {attacking && <animate attributeName="opacity" values="0.7;1;0.7" dur="0.3s" repeatCount="indefinite" />}
      </rect>
    </g>
  </svg>
);

const EnemySpriteImpl = ({ name, scale = 1.3, attacking, hit }: EnemySpriteProps) => {
  const kind = inferEnemyKind(name);
  const accent = kind === 'boss' ? 'hsl(0 100% 60%)' : accentFromName(name);
  const isBoss = kind === 'boss';
  const w = (isBoss ? 170 : 130) * scale;
  const h = (isBoss ? 230 : 195) * scale;

  return (
    <div
      className="relative"
      style={{
        width: w, height: h,
        filter: hit
          ? 'brightness(2.2) drop-shadow(0 0 12px hsl(0 100% 60%))'
          : isBoss
            ? 'drop-shadow(0 8px 6px rgba(0,0,0,0.7)) drop-shadow(0 0 18px hsl(0 100% 50% / 0.45))'
            : 'drop-shadow(0 6px 4px rgba(0,0,0,0.55))',
        transition: 'filter 120ms linear',
        animation: isBoss ? 'battle-stance 1.8s ease-in-out infinite' : undefined,
        transformOrigin: 'center bottom',
      }}
    >
      {/* Charge aura when attacking */}
      {attacking && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 55%, ${accent}${isBoss ? '88' : '66'} 0%, transparent ${isBoss ? '70%' : '60%'})`,
            animation: 'pulse 0.8s ease-in-out infinite',
          }}
        />
      )}
      {/* Boss menacing ground glow */}
      {isBoss && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 pointer-events-none"
          style={{
            width: w * 0.85,
            height: 16,
            background: 'radial-gradient(ellipse at center, hsl(0 100% 50% / 0.55) 0%, transparent 70%)',
            filter: 'blur(4px)',
            animation: 'arena-pulse 2s ease-in-out infinite',
          }}
        />
      )}
      {kind === 'boss' && (
        <img
          src={bossWarmech}
          alt={name}
          width={1024}
          height={1024}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain select-none"
        />
      )}
      {kind === 'drone' && <DroneSprite accent={accent} attacking={attacking} />}
      {kind === 'bot' && <BotSprite accent={accent} attacking={attacking} />}
      {kind === 'beast' && <BeastSprite accent={accent} attacking={attacking} />}
      {kind === 'humanoid' && <HumanoidSprite accent={accent} attacking={attacking} />}
    </div>
  );
};

export const EnemySprite = memo(EnemySpriteImpl);
