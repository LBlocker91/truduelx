import { memo } from 'react';
import { CharacterAvatar } from './CharacterAvatar';
import { npcArtFor, NpcKind } from '@/data/npc-art';

export type { NpcKind };

interface NpcMarkerProps {
  kind: NpcKind;
  name: string;
  close: boolean;
  /** When true, render the boss-tier avatar regardless of role (visual only). */
  isBoss?: boolean;
}

const COLOR: Record<NpcKind, { hsl: string; label: string }> = {
  vendor: { hsl: '195 100% 60%', label: 'TRADE' },
  quest:  { hsl: '42 100% 62%',  label: 'TASK' },
  enemy:  { hsl: '0 85% 60%',    label: 'HOSTILE' },
};

// Hash NPC name → boolean to flip half of them so they don't all face the same way.
const facingFor = (name: string): 'left' | 'right' => {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return (h & 1) === 0 ? 'left' : 'right';
};

const NpcMarkerImpl = ({ kind, name, close, isBoss = false }: NpcMarkerProps) => {
  const c = COLOR[kind];
  const color = `hsl(${c.hsl})`;
  const colorSoft = `hsl(${c.hsl} / 0.55)`;
  const art = npcArtFor(name, kind);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-end">
      {/* Proximity ring on the floor when player is close — anchors the NPC to the world */}
      {close && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: -6,
            width: '78%',
            height: 14,
            borderRadius: '50%',
            background: `radial-gradient(ellipse at center, ${color} 0%, transparent 70%)`,
            opacity: 0.55,
            animation: 'arena-pulse 1.4s ease-in-out infinite',
            filter: 'blur(1px)',
          }}
        />
      )}
      {/* Nameplate + role tag — single row, dark backing for bright zones */}
      <div
        className={`flex items-center gap-1 mb-1 ${close ? 'animate-pulse' : 'opacity-95 group-hover:opacity-100'}`}
        style={{ color }}
      >
        <span
          className="text-[11px] font-orbitron px-2 py-0.5 rounded whitespace-nowrap"
          style={{
            background: 'rgba(8,12,18,0.9)',
            border: `1px solid ${close ? color : colorSoft}`,
            color,
            textShadow: '0 1px 2px rgba(0,0,0,0.95)',
            boxShadow: close ? `0 0 12px ${colorSoft}` : 'none',
          }}
        >
          {name}
        </span>
        <span
          className="text-[8px] font-orbitron tracking-widest px-1 py-0.5 rounded"
          style={{ color, background: 'rgba(0,0,0,0.78)', border: `1px solid ${colorSoft}` }}
        >
          {c.label}
        </span>
      </div>

      {/* Real character avatar */}
      <CharacterAvatar
        src={art}
        alt={name}
        direction={kind === 'enemy' ? 'left' : facingFor(name)}
        state="idle"
        height={isBoss ? 200 : 150}
        accentHsl={c.hsl}
      />
    </div>
  );
};

export const NpcMarker = memo(NpcMarkerImpl);
