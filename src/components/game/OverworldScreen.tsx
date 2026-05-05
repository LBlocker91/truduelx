import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Loader2, Swords, Map, Store, ScrollText, Skull, Users, Shield, Zap,
  Crosshair, Wrench, Flame, Cpu, Sparkles, Ghost, Target,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Zone, Npc, NearbyPlayer,
  fetchZones, fetchNpcs, fetchNearbyPlayers,
  enterZone, heartbeat, setInBattle,
  fetchVendorItems, fetchQuestForNpc, fetchPlayerQuests, acceptQuest,
  startNpcBattle,
  fetchMyLoadout, publishLoadout, EquippedLoadout,
} from '@/lib/overworld';
import { PlayerSprite, SpriteDirection, SpriteRarity } from './PlayerSprite';
import { NpcMarker } from './NpcMarker';
import {
  walkableFor, clampToWalkable, pointInPolygon, polygonToSvgPath,
} from '@/lib/zone-walkable';
import stationHub from '@/assets/zones/station-hub.jpg';
import wasteland from '@/assets/zones/wasteland.jpg';
import neonDistrict from '@/assets/zones/neon-district.jpg';

const ZONE_BG: Record<string, string> = {
  'station-hub': stationHub,
  'wasteland': wasteland,
  'neon-district': neonDistrict,
};

interface OverworldScreenProps {
  characterId: string;
  characterName: string;
  characterClass: string;
  characterLevel: number;
  onEnterNpcBattle: (battleId: string) => void;
  onJoinPvpQueue: () => void;
  onExit: () => void;
  /** When true, the GameHud owns the chrome — hide internal header / zone bar / footer. */
  hideChrome?: boolean;
  /** Bump this number to force the overworld to re-fetch the equipped loadout. */
  loadoutBust?: number;
}

// ---------- Hub-mode tuning ----------
const HEARTBEAT_MS = 400;
const NEARBY_POLL_MS = 1500;
const INTERACTION_RADIUS_PCT = 14;     // distance in % space to allow [E] interact
const MOVE_SPEED_PCT = 0.65;           // % per frame at 60fps
const MOVE_ACCEL = 0.2;

// Class → icon for nameplates
const CLASS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  warrior: Swords, soldier: Crosshair, mercenary: Shield, tactician: Cpu,
  hunter: Target, technician: Wrench, mage: Sparkles, pyromancer: Flame,
  cyber: Zap, ghost: Ghost,
};
const getClassIcon = (cls: string) => CLASS_ICON[cls?.toLowerCase?.() ?? ''] ?? Shield;

const RARITY_HSL: Record<SpriteRarity, string> = {
  common: '210 10% 70%',
  uncommon: '150 100% 55%',
  rare: '210 100% 60%',
  epic: '280 100% 65%',
  legendary: '40 100% 60%',
};
const variantToRarity = (armor: string | null, weapon: string | null): SpriteRarity => {
  if (!armor && !weapon) return 'common';
  if (armor?.startsWith('heavy_')) return (weapon === 'staff' || weapon === 'axe') ? 'legendary' : 'epic';
  if (armor?.startsWith('medium_')) return 'rare';
  if (armor?.startsWith('light_')) return 'uncommon';
  return 'rare';
};

// Per-NPC placement (visual + interaction) is now defined in zone-walkable.ts.
// We resolve a placement for each seeded NPC by name; if not present, we fall
// back to an evenly spaced spot inside the zone's walkable polygon.
const fallbackNpcSpot = (zoneId: string, idx: number, total: number) => {
  const wk = walkableFor(zoneId);
  // Evenly spread across the front edge of the polygon.
  const front = wk.polygon.reduce((a, b) => (b.y > a.y ? b : a), wk.polygon[0]);
  const back = wk.polygon.reduce((a, b) => (b.y < a.y ? b : a), wk.polygon[0]);
  const y = back.y + (front.y - back.y) * 0.65;
  const minX = Math.min(...wk.polygon.map(p => p.x));
  const maxX = Math.max(...wk.polygon.map(p => p.x));
  const x = minX + ((maxX - minX) * (idx + 1)) / (total + 1);
  const spot = { x, y };
  return { visual: spot, interaction: spot };
};
const npcPlacement = (zoneId: string, name: string, idx: number, total: number) => {
  const wk = walkableFor(zoneId);
  return wk.npcs[name] ?? fallbackNpcSpot(zoneId, idx, total);
};

// Map any legacy world-pixel coordinate (~0..5000) into normalized %.
// Players moving in another tab may still be writing world-px values — clamp to hub.
const toPct = (v: number, max = 100) => {
  if (!Number.isFinite(v)) return 50;
  if (v <= 100) return Math.max(0, Math.min(100, v));
  // Treat as world px: divide by an assumed world span ~5000 then clamp to playable band.
  const pct = (v / 5000) * 100;
  return Math.max(0, Math.min(100, pct));
};

export const OverworldScreen = ({
  characterId, characterName, characterClass, characterLevel,
  onEnterNpcBattle, onJoinPvpQueue, onExit,
  hideChrome = false, loadoutBust = 0,
}: OverworldScreenProps) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zone, setZone] = useState<Zone | null>(null);
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [nearby, setNearby] = useState<NearbyPlayer[]>([]);
  const [loadout, setLoadout] = useState<EquippedLoadout>({ armorVariant: null, weaponVariant: null });

  // Normalized player position
  const [pos, setPos] = useState({ x: 50, y: 75 });   // xPercent, yPercent
  const [direction, setDirection] = useState<SpriteDirection>('right');
  const [moving, setMoving] = useState(false);

  const posRef = useRef(pos);
  posRef.current = pos;
  const dirRef = useRef<SpriteDirection>('right');
  dirRef.current = direction;

  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const velRef = useRef({ vx: 0, vy: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [vendorItems, setVendorItems] = useState<any[]>([]);
  const [questData, setQuestData] = useState<any>(null);
  const [myQuests, setMyQuests] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [debug, setDebug] = useState(false);
  const [rootSize, setRootSize] = useState({ w: 0, h: 0 });

  const playerRarity = useMemo(
    () => variantToRarity(loadout.armorVariant, loadout.weaponVariant),
    [loadout.armorVariant, loadout.weaponVariant]
  );
  const ClassIcon = getClassIcon(characterClass);

  // Track root size for debug + click-to-move math
  useEffect(() => {
    if (!rootRef.current) return;
    const el = rootRef.current;
    const measure = () => setRootSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    document.addEventListener('fullscreenchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      document.removeEventListener('fullscreenchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  // Load zones & enter starting zone
  useEffect(() => {
    (async () => {
      const zs = await fetchZones();
      setZones(zs);
      const start = zs.find(z => z.id === 'station-hub') ?? zs[0];
      if (start) await switchZone(start.id, zs);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchZone = useCallback(async (zoneId: string, zoneList?: Zone[]) => {
    const list = zoneList ?? zones;
    const z = list.find(x => x.id === zoneId);
    if (!z) return;
    await enterZone(zoneId);
    const ns = await fetchNpcs(zoneId);
    setZone(z);
    setNpcs(ns);
    setPos({ x: 50, y: 78 });
    targetRef.current = null;
  }, [zones]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key;
      if (['w','a','s','d','W','A','S','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)) {
        keysRef.current.add(k.toLowerCase());
        targetRef.current = null;
      }
      if (k === 'e' || k === 'E') tryInteract();
      if (k === '`') setDebug(d => !d);
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  // Movement loop (normalized %)
  useEffect(() => {
    if (!zone) return;
    let raf = 0;
    const loop = () => {
      setPos(prev => {
        let { x, y } = prev;
        let tdx = 0, tdy = 0;
        const k = keysRef.current;
        if (k.has('a') || k.has('arrowleft')) tdx -= 1;
        if (k.has('d') || k.has('arrowright')) tdx += 1;
        if (k.has('w') || k.has('arrowup')) tdy -= 1;
        if (k.has('s') || k.has('arrowdown')) tdy += 1;
        const klen = Math.hypot(tdx, tdy);
        if (klen > 0) { tdx = (tdx / klen) * MOVE_SPEED_PCT; tdy = (tdy / klen) * MOVE_SPEED_PCT; }

        const t = targetRef.current;
        if (!tdx && !tdy && t) {
          const ddx = t.x - x, ddy = t.y - y;
          const dist = Math.hypot(ddx, ddy);
          if (dist < 0.3) { targetRef.current = null; }
          else { tdx = (ddx / dist) * MOVE_SPEED_PCT; tdy = (ddy / dist) * MOVE_SPEED_PCT; }
        }

        const v = velRef.current;
        v.vx += (tdx - v.vx) * MOVE_ACCEL;
        v.vy += (tdy - v.vy) * MOVE_ACCEL;
        if (Math.abs(v.vx) < 0.01) v.vx = 0;
        if (Math.abs(v.vy) < 0.01) v.vy = 0;

        const candidate = { x: x + v.vx, y: y + v.vy };
        const wk = walkableFor(zone!.id);
        const clamped = clampToWalkable(candidate, wk.polygon);
        // If we hit a wall, kill velocity in the rejected axes so we don't shudder.
        if (clamped.x !== candidate.x) v.vx = 0;
        if (clamped.y !== candidate.y) v.vy = 0;
        x = clamped.x;
        y = clamped.y;

        const speed = Math.hypot(v.vx, v.vy);
        const isMoving = speed > 0.04;
        if (Math.abs(v.vx) > 0.02) {
          const nd: SpriteDirection = v.vx < 0 ? 'left' : 'right';
          if (dirRef.current !== nd) setDirection(nd);
        }
        setMoving(prevMoving => prevMoving === isMoving ? prevMoving : isMoving);
        return { x, y };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [zone]);

  // Presence — keep using same edge function. Send normalized coords scaled into the
  // zone's stored width/height range so legacy consumers still see a number in-bounds.
  useEffect(() => {
    if (!zone) return;
    const hb = setInterval(() => {
      const wx = (posRef.current.x / 100) * (zone.width || 100);
      const wy = (posRef.current.y / 100) * (zone.height || 100);
      heartbeat(zone.id, wx, wy, dirRef.current);
    }, HEARTBEAT_MS);
    const np = setInterval(async () => {
      try { setNearby(await fetchNearbyPlayers(zone.id)); } catch { /* ignore */ }
    }, NEARBY_POLL_MS);
    return () => { clearInterval(hb); clearInterval(np); };
  }, [zone]);

  // Loadout
  useEffect(() => {
    (async () => {
      const lo = await fetchMyLoadout(characterId);
      setLoadout(lo);
      await publishLoadout(lo);
    })();
  }, [characterId, loadoutBust]);

  // Player quest list (refresh whenever NPC dialog changes)
  useEffect(() => { (async () => {
    const { data } = await import('@/integrations/supabase/client').then(m => m.supabase.auth.getUser());
    if (data?.user) setMyQuests(await fetchPlayerQuests(data.user.id));
  })(); }, [activeNpc]);

  // ---------- Interaction ----------
  const npcsWithPos = useMemo(() => {
    return npcs.map((n, i) => {
      const place = npcPlacement(zone?.id ?? '', n.name, i, npcs.length);
      return {
        ...n,
        _vx: place.visual.x, _vy: place.visual.y,           // visual anchor
        _ix: place.interaction.x, _iy: place.interaction.y, // floor interaction point
      };
    });
  }, [npcs, zone?.id]);

  const closestNpc = () => {
    let best: (typeof npcsWithPos)[number] | null = null;
    let bestD = Infinity;
    for (const n of npcsWithPos) {
      // Distance is measured against the floor interaction point, not the visual.
      const d = Math.hypot(n._ix - pos.x, n._iy - pos.y);
      if (d < bestD && d <= INTERACTION_RADIUS_PCT) { best = n; bestD = d; }
    }
    return best;
  };

  const tryInteract = () => {
    const n = closestNpc();
    if (n) openNpc(n);
  };

  const openNpc = async (npc: Npc) => {
    setActiveNpc(npc);
    if (npc.type === 'vendor') setVendorItems(await fetchVendorItems(npc.id));
    if (npc.type === 'quest') setQuestData(await fetchQuestForNpc(npc.id));
  };
  const closeNpc = () => { setActiveNpc(null); setVendorItems([]); setQuestData(null); };

  const handleFightNpc = async () => {
    if (!activeNpc) return;
    setBusy(true);
    try {
      await setInBattle(true);
      const battleId = await startNpcBattle(activeNpc.id, characterId);
      onEnterNpcBattle(battleId);
    } catch (e: any) {
      toast.error(`Couldn't start battle: ${e.message ?? e}`);
      await setInBattle(false);
    } finally {
      setBusy(false);
      closeNpc();
    }
  };

  const handleAcceptQuest = async () => {
    if (!questData) return;
    const { data } = await import('@/integrations/supabase/client').then(m => m.supabase.auth.getUser());
    if (!data?.user) return;
    await acceptQuest(data.user.id, questData.id);
    toast.success(`Accepted: ${questData.name}`);
    setMyQuests(await fetchPlayerQuests(data.user.id));
    closeNpc();
  };

  const handlePvpQueue = async () => {
    await setInBattle(true);
    onJoinPvpQueue();
  };

  // Click-to-move within hub: convert click → normalized %.
  const handleStageClick = (e: React.MouseEvent) => {
    if (!rootRef.current || !zone) return;
    const rect = rootRef.current.getBoundingClientRect();
    const xp = ((e.clientX - rect.left) / rect.width) * 100;
    const yp = ((e.clientY - rect.top) / rect.height) * 100;
    targetRef.current = {
      x: Math.max(PLAYER_X_MIN, Math.min(PLAYER_X_MAX, xp)),
      y: Math.max(PLAYER_Y_MIN, Math.min(PLAYER_Y_MAX, yp)),
    };
  };

  // ---------- Render ----------
  if (!zone) {
    return (
      <div className={`${hideChrome ? 'absolute inset-0' : 'min-h-screen'} flex items-center justify-center bg-background`}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const bg = ZONE_BG[zone.id] ?? stationHub;
  const interactable = closestNpc();

  return (
    <div className={`${hideChrome ? 'absolute inset-0 h-full w-full flex flex-col' : 'min-h-screen flex flex-col'} bg-black text-foreground min-h-0`}>
      {!hideChrome && (
        <header className="flex items-center justify-between gap-2 px-3 py-2 bg-card/80 backdrop-blur border-b border-border z-10">
          <div className="flex items-center gap-3">
            <Map className="w-4 h-4 text-primary" />
            <span className="font-orbitron text-sm">{zone.name}</span>
            <span className="text-xs text-muted-foreground hidden md:inline">{zone.description}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden md:inline">
              {characterName} · Lv {characterLevel} {characterClass}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" /> {nearby.length}
            </div>
            <Button size="sm" variant="default" onClick={handlePvpQueue}>
              <Swords className="w-3 h-3 mr-1" /> PvP
            </Button>
            <Button size="sm" variant="outline" onClick={onExit}>Menu</Button>
          </div>
        </header>
      )}

      {!hideChrome && (
        <div className="flex gap-1 px-3 py-2 bg-card/40 border-b border-border z-10 overflow-x-auto">
          {zones.map(z => (
            <Button
              key={z.id}
              size="sm"
              variant={z.id === zone.id ? 'default' : 'outline'}
              onClick={() => switchZone(z.id)}
            >
              {z.name}
            </Button>
          ))}
        </div>
      )}

      {/* Stage — flex:1, fills remaining HUD area */}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
        <div
          ref={rootRef}
          onClick={handleStageClick}
          className="absolute inset-0 w-full h-full overflow-hidden cursor-crosshair select-none"
          style={{
            backgroundImage: `url(${bg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#000',
          }}
        >
          {/* Soft tint overlay (no heavy vignette → never reads as black gap) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                zone.id === 'neon-district'
                  ? 'linear-gradient(180deg, hsl(280 70% 25% / 0.18), hsl(190 80% 25% / 0.18))'
                  : zone.id === 'wasteland'
                  ? 'linear-gradient(180deg, hsl(30 60% 30% / 0.20), hsl(15 50% 20% / 0.18))'
                  : 'linear-gradient(180deg, hsl(210 50% 20% / 0.18), hsl(220 40% 12% / 0.18))',
              mixBlendMode: 'soft-light',
            }}
          />

          {/* In-hub zone selector (always visible, top-left) */}
          {hideChrome && (
            <div className="absolute top-3 left-3 z-30 flex flex-wrap gap-1 bg-card/85 backdrop-blur border border-border rounded-lg p-1.5 max-w-[60vw]">
              <span className="text-[10px] text-muted-foreground font-orbitron px-1 self-center">
                <Map className="w-3 h-3 inline mr-1" /> {zone.name}
              </span>
              {zones.map(z => (
                <Button
                  key={z.id}
                  size="sm"
                  variant={z.id === zone.id ? 'default' : 'ghost'}
                  className="h-7 px-2 text-[11px]"
                  onClick={(e) => { e.stopPropagation(); switchZone(z.id); }}
                >
                  {z.name}
                </Button>
              ))}
            </div>
          )}

          {/* NPCs — anchored to background via xPercent/yPercent */}
          {npcsWithPos.map((n) => {
            const close = interactable?.id === n.id;
            return (
              <button
                key={n.id}
                onClick={(e) => { e.stopPropagation(); openNpc(n); }}
                className="absolute group"
                style={{
                  left: `${n._x}%`,
                  top: `${n._y}%`,
                  transform: 'translate(-50%, -100%)',
                  height: 'clamp(55px, 9vh, 100px)',
                }}
              >
                <NpcMarker
                  kind={n.type as 'vendor' | 'quest' | 'enemy'}
                  name={n.name}
                  close={close}
                />
              </button>
            );
          })}

          {/* Other players */}
          {nearby.map(p => {
            const xp = toPct(p.x_position);
            const yp = toPct(p.y_position);
            const dir: SpriteDirection = p.facing === 'left' ? 'left' : 'right';
            const otherRarity = variantToRarity(p.equipped_armor_variant, p.equipped_weapon_variant);
            const OtherIcon = getClassIcon(p.character_class ?? '');
            return (
              <div
                key={p.user_id}
                className="absolute flex flex-col items-center pointer-events-none"
                style={{
                  left: `${xp}%`,
                  top: `${yp}%`,
                  transform: 'translate(-50%, -100%)',
                  height: 'clamp(70px, 8vh, 120px)',
                }}
              >
                <div
                  className="text-[10px] font-orbitron px-1.5 py-0.5 rounded bg-card/85 mb-0.5 flex items-center gap-1"
                  style={{ border: `1px solid hsl(${RARITY_HSL[otherRarity]} / 0.7)` }}
                >
                  <OtherIcon className="w-2.5 h-2.5" />
                  <span>{p.display_name}</span>
                  <span className="opacity-70">L{p.character_level}</span>
                </div>
                <PlayerSprite
                  direction={dir}
                  state="idle"
                  armorVariant={p.equipped_armor_variant}
                  weaponVariant={p.equipped_weapon_variant}
                  rarity={otherRarity}
                  scale={0.7}
                />
              </div>
            );
          })}

          {/* Local player */}
          <div
            className="absolute flex flex-col items-center pointer-events-none"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -100%)',
              height: 'clamp(80px, 10vh, 140px)',
              transition: 'left 90ms linear, top 90ms linear',
            }}
          >
            <div
              className="text-[11px] font-orbitron px-2 py-0.5 rounded mb-1 flex items-center gap-1.5 bg-background/90 backdrop-blur drop-shadow"
              style={{
                border: `1px solid hsl(${RARITY_HSL[playerRarity]})`,
                boxShadow: `0 0 8px hsl(${RARITY_HSL[playerRarity]} / 0.55)`,
                color: `hsl(${RARITY_HSL[playerRarity]})`,
              }}
            >
              <ClassIcon className="w-3 h-3" />
              <span className="text-foreground">{characterName}</span>
              <span className="opacity-80">L{characterLevel}</span>
            </div>
            <PlayerSprite
              direction={direction}
              state={moving ? 'walk' : 'idle'}
              armorVariant={loadout.armorVariant}
              weaponVariant={loadout.weaponVariant}
              rarity={playerRarity}
              scale={0.85}
            />
          </div>

          {/* Debug overlay */}
          {debug && (
            <div className="absolute top-2 right-2 z-40 bg-black/75 text-[11px] font-mono text-emerald-300 px-2 py-1.5 rounded border border-emerald-500/40 leading-tight pointer-events-none space-y-0.5">
              <div>rootSize: {rootSize.w}×{rootSize.h}</div>
              <div>player: x={pos.x.toFixed(1)}% y={pos.y.toFixed(1)}% dir={direction} {moving ? 'walk' : 'idle'}</div>
              <div>fitMode: cover-fixed</div>
              <div>backgroundPosition: center center</div>
              <div>noCameraMode: true</div>
              <div className="text-emerald-500/70">[`] toggle debug</div>
            </div>
          )}
          {!debug && (
            <div className="absolute bottom-2 right-2 z-30 text-[10px] text-white/40 font-mono pointer-events-none">[`] debug</div>
          )}
        </div>
      </div>

      {!hideChrome && (
        <footer className="px-3 py-2 bg-card/80 border-t border-border text-xs text-muted-foreground flex justify-between">
          <span>WASD or click to move · [E] to interact</span>
          <span>{interactable ? `Press E to talk to ${interactable.name}` : 'Find an NPC to interact'}</span>
        </footer>
      )}

      {/* NPC dialog — unchanged behavior */}
      <Dialog open={!!activeNpc} onOpenChange={(o) => !o && closeNpc()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2">
              {activeNpc?.type === 'vendor' && <Store className="w-4 h-4 text-blue-400" />}
              {activeNpc?.type === 'quest'  && <ScrollText className="w-4 h-4 text-amber-400" />}
              {activeNpc?.type === 'enemy'  && <Skull className="w-4 h-4 text-red-400" />}
              {activeNpc?.name}
            </DialogTitle>
            <DialogDescription>{activeNpc?.dialogue}</DialogDescription>
          </DialogHeader>

          {activeNpc?.type === 'vendor' && (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {vendorItems.length === 0 && <p className="text-xs text-muted-foreground">No stock right now.</p>}
              {vendorItems.map(vi => (
                <div key={vi.id} className="flex items-center justify-between border border-border rounded p-2">
                  <div>
                    <div className="text-sm font-medium">{vi.items?.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Lv {vi.items?.level_req} · {vi.items?.rarity} · {vi.items?.slot}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" disabled>{vi.price}c</Button>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground italic">Currency system coming soon — items are display-only.</p>
            </div>
          )}

          {activeNpc?.type === 'quest' && questData && (
            <div className="space-y-2">
              <div className="text-sm font-medium">{questData.name}</div>
              <div className="text-xs text-muted-foreground">{questData.description}</div>
              <div className="text-xs">
                <strong>Objectives:</strong>{' '}
                {Object.entries(questData.objectives?.defeat ?? {}).map(([k, v]: any) =>
                  <span key={k} className="mr-2">Defeat {v}× {k.replace('enemy-', '')}</span>
                )}
              </div>
              <div className="text-xs"><strong>Reward:</strong> {questData.rewards?.xp ?? 0} XP</div>
              {myQuests.find(q => q.quest_id === questData.id)
                ? <p className="text-xs text-primary">Already accepted.</p>
                : null}
            </div>
          )}

          {activeNpc?.type === 'enemy' && (
            <p className="text-sm text-muted-foreground">Ready to fight?</p>
          )}

          <DialogFooter className="flex gap-2">
            {activeNpc?.type === 'enemy' && (
              <Button onClick={handleFightNpc} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Swords className="w-4 h-4 mr-1" /> Fight</>}
              </Button>
            )}
            {activeNpc?.type === 'quest' && questData && !myQuests.find(q => q.quest_id === questData.id) && (
              <Button onClick={handleAcceptQuest}>Accept</Button>
            )}
            <Button variant="outline" onClick={closeNpc}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
