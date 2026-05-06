import { memo } from 'react';
import { ArrowRight, DoorOpen, Zap, Truck } from 'lucide-react';

export type PortalKind = 'door' | 'airlock' | 'portal' | 'transport';

interface PortalMarkerProps {
  kind: PortalKind;
  label: string;
  close: boolean;
}

const KIND_COLOR: Record<PortalKind, string> = {
  door: '180 100% 60%',
  airlock: '30 100% 60%',
  portal: '290 100% 65%',
  transport: '210 100% 65%',
};

const KIND_ICON: Record<PortalKind, React.ComponentType<{ className?: string }>> = {
  door: DoorOpen,
  airlock: DoorOpen,
  portal: Zap,
  transport: Truck,
};

const PortalMarkerImpl = ({ kind, label, close }: PortalMarkerProps) => {
  const hsl = KIND_COLOR[kind];
  const color = `hsl(${hsl})`;
  const colorSoft = `hsl(${hsl} / 0.45)`;
  const Icon = KIND_ICON[kind];

  return (
    <div className="relative flex flex-col items-center pointer-events-none" style={{ color }}>
      {close ? (
        <div
          className="text-xs font-orbitron px-2.5 py-1 rounded mb-1.5 animate-pulse whitespace-nowrap flex items-center gap-1"
          style={{ background: color, color: '#000', boxShadow: `0 0 16px ${color}` }}
        >
          [E] Enter {label} <ArrowRight className="w-3 h-3" />
        </div>
      ) : (
        <div
          className="text-[11px] font-orbitron px-2 py-0.5 rounded mb-1.5 opacity-90 whitespace-nowrap flex items-center gap-1"
          style={{ background: 'rgba(8,12,18,0.85)', border: `1px solid ${colorSoft}`, color }}
        >
          <Icon className="w-3 h-3" /> {label}
        </div>
      )}

      {/* Door / portal frame */}
      <div className="relative npc-bob" style={{ width: 70, height: 110 }}>
        <svg viewBox="0 0 70 110" className="absolute inset-0 w-full h-full hologram-flicker">
          <defs>
            <linearGradient id={`door-${kind}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={color} stopOpacity="0.15" />
            </linearGradient>
          </defs>
          {/* Frame */}
          <rect x="6" y="8" width="58" height="92" rx="6"
            fill="rgba(8,12,18,0.6)" stroke={color} strokeWidth="1.6" />
          {/* Inner glowing portal */}
          <rect x="14" y="16" width="42" height="76" rx="4"
            fill={`url(#door-${kind})`} opacity={close ? 0.95 : 0.7}>
            <animate attributeName="opacity" values="0.55;0.95;0.55" dur="2.2s" repeatCount="indefinite" />
          </rect>
          {/* Energy lines */}
          <line x1="20" y1="30" x2="50" y2="30" stroke={color} strokeWidth="0.6" opacity="0.6" />
          <line x1="20" y1="50" x2="50" y2="50" stroke={color} strokeWidth="0.6" opacity="0.6" />
          <line x1="20" y1="70" x2="50" y2="70" stroke={color} strokeWidth="0.6" opacity="0.6" />
          {/* Top light */}
          <circle cx="35" cy="14" r="2" fill={color}>
            <animate attributeName="r" values="1.5;2.5;1.5" dur="1.4s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Ground halo */}
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: -6,
            width: close ? 90 : 70,
            height: close ? 18 : 14,
            background: `radial-gradient(ellipse at center, ${color} 0%, ${colorSoft} 45%, transparent 80%)`,
            filter: 'blur(4px)',
            transition: 'all 250ms ease-out',
          }}
        />
      </div>
    </div>
  );
};

export const PortalMarker = memo(PortalMarkerImpl);
