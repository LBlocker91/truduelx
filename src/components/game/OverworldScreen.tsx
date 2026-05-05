import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Swords, Map, Store, ScrollText, Skull, Users, Shield, Zap, Crosshair, Wrench, Flame, Cpu, Sparkles, Ghost, Target } from 'lucide-react';
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
}

const MOVE_SPEED = 6.5;            // faster on a much larger map
const MOVE_ACCEL = 0.18;           // softer start/stop easing
const HEARTBEAT_MS = 300;
const NEARBY_POLL_MS = 1500;
const INTERACTION_RADIUS = 110;
const CAMERA_ZOOM = 1.05;          // zoomed OUT — more visible world
const CAMERA_LERP = 0.10;          // slightly delayed, smooth follow
const RENDER_RADIUS = 1400;        // only render players within this world distance
const FADE_RADIUS  = 900;          // distant players fade out softly

// Map class name → icon for the nameplate
const CLASS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  warrior: Swords, soldier: Crosshair, mercenary: Shield, tactician: Cpu,
  hunter: Target, technician: Wrench, mage: Sparkles, pyromancer: Flame,
  cyber: Zap, ghost: Ghost,
};
const getClassIcon = (cls: string) => {
  const key = cls?.toLowerCase?.() ?? '';
  return CLASS_ICON[key] ?? Shield;
};

// Rarity → display color (HSL components)
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

export const OverworldScreen = ({
  characterId, characterName, characterClass, characterLevel,
  onEnterNpcBattle, onJoinPvpQueue, onExit,
}: OverworldScreenProps) => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zone, setZone] = useState<Zone | null>(null);
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [nearby, setNearby] = useState<NearbyPlayer[]>([]);
  const [pos, setPos] = useState({ x: 800, y: 750 });
  const [direction, setDirection] = useState<SpriteDirection>('right');
  const [moving, setMoving] = useState(false);
  const [loadout, setLoadout] = useState<EquippedLoadout>({ armorVariant: null, weaponVariant: null });
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const stageRef = useRef<HTMLDivElement>(null);
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [vendorItems, setVendorItems] = useState<any[]>([]);
  const [questData, setQuestData] = useState<any>(null);
  const [myQuests, setMyQuests] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [debug, setDebug] = useState(false);
  const [camPos, setCamPos] = useState({ x: 800, y: 750 }); // smoothed follow target (world coords)
  const posRef = useRef(pos);
  posRef.current = pos;
  const camPosRef = useRef(camPos);
  camPosRef.current = camPos;
  const dirRef = useRef<SpriteDirection>('right');
  dirRef.current = direction;

  // Movement trail puffs (small list, auto-pruned)
  const [trail, setTrail] = useState<{ id: number; x: number; y: number }[]>([]);
  const trailIdRef = useRef(0);
  const lastTrailRef = useRef(0);

  // Interaction flash (player-centered burst)
  const [flashKey, setFlashKey] = useState(0);
  // Camera nudge trigger (re-triggers .camera-nudge animation by key change)
  const [nudgeKey, setNudgeKey] = useState(0);

  // Ambient particles (positions in viewport-relative %)
  const ambientParticles = useMemo(
    () => Array.from({ length: 28 }, (_, i) => {
      const r1 = ((i * 9301 + 49297) % 233280) / 233280;
      const r2 = ((i * 1103 + 12345) % 233280) / 233280;
      const r3 = ((i * 7919 + 6151) % 233280) / 233280;
      return {
        left: r1 * 100,
        delay: r2 * 14,
        duration: 9 + r3 * 9,
        size: 1.5 + r1 * 3,
        hue: 170 + (r3 * 140),
        drift: -20 + r2 * 40, // horizontal drift offset (px)
      };
    }),
    []
  );

  const playerRarity = useMemo(
    () => variantToRarity(loadout.armorVariant, loadout.weaponVariant),
    [loadout.armorVariant, loadout.weaponVariant]
  );
  const ClassIcon = getClassIcon(characterClass);

  // Track stage size for camera math
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setStageSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    (async () => {
      const zs = await fetchZones();
      setZones(zs);
      const start = zs.find(z => z.id === 'station-hub') ?? zs[0];
      if (start) await switchZone(start.id, zs);
    })();
  }, []);

  const switchZone = useCallback(async (zoneId: string, zoneList?: Zone[]) => {
    const list = zoneList ?? zones;
    const z = list.find(x => x.id === zoneId);
    if (!z) return;
    await enterZone(zoneId);
    const ns = await fetchNpcs(zoneId);
    setZone(z);
    setNpcs(ns);
    setPos({ x: z.spawn_x, y: z.spawn_y });
    setCamPos({ x: z.spawn_x, y: z.spawn_y });
    targetRef.current = null;
  }, [zones]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['w','a','s','d','W','A','S','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        keysRef.current.add(e.key.toLowerCase());
        targetRef.current = null;
      }
      if (e.key === 'e' || e.key === 'E') tryInteract();
      if (e.key === '`') setDebug(d => !d);
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  // Velocity-based movement with easing (no instant start/stop)
  const velRef = useRef({ vx: 0, vy: 0 });
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
        // Normalize keyboard direction
        const klen = Math.hypot(tdx, tdy);
        if (klen > 0) { tdx = (tdx / klen) * MOVE_SPEED; tdy = (tdy / klen) * MOVE_SPEED; }

        const t = targetRef.current;
        if (!tdx && !tdy && t) {
          const ddx = t.x - x, ddy = t.y - y;
          const dist = Math.hypot(ddx, ddy);
          if (dist < 2) { targetRef.current = null; }
          else { tdx = (ddx / dist) * MOVE_SPEED; tdy = (ddy / dist) * MOVE_SPEED; }
        }

        // Ease velocity toward target
        const v = velRef.current;
        v.vx += (tdx - v.vx) * MOVE_ACCEL;
        v.vy += (tdy - v.vy) * MOVE_ACCEL;
        if (Math.abs(v.vx) < 0.05) v.vx = 0;
        if (Math.abs(v.vy) < 0.05) v.vy = 0;

        x += v.vx; y += v.vy;
        x = Math.max(40, Math.min(zone.width - 40, x));
        y = Math.max(zone.height * 0.35, Math.min(zone.height - 40, y));

        const speed = Math.hypot(v.vx, v.vy);
        const isMoving = speed > 0.4;
        if (Math.abs(v.vx) > 0.1) {
          const nd: SpriteDirection = v.vx < 0 ? 'left' : 'right';
          if (dirRef.current !== nd) setDirection(nd);
        }
        setMoving(prevMoving => prevMoving === isMoving ? prevMoving : isMoving);
        return { x, y };
      });
      // Smooth camera follow (per-frame lerp). Camera target = player pos.
      setCamPos(prev => {
        const px = posRef.current.x, py = posRef.current.y;
        const nx = prev.x + (px - prev.x) * CAMERA_LERP;
        const ny = prev.y + (py - prev.y) * CAMERA_LERP;
        // Snap when very close to avoid sub-pixel jitter
        return {
          x: Math.abs(px - nx) < 0.1 ? px : nx,
          y: Math.abs(py - ny) < 0.1 ? py : ny,
        };
      });
      // Emit movement trail puffs while moving (~every 90ms)
      const now = performance.now();
      const v = velRef.current;
      const speed = Math.hypot(v.vx, v.vy);
      if (speed > 0.6 && now - lastTrailRef.current > 90) {
        lastTrailRef.current = now;
        const id = ++trailIdRef.current;
        const px = posRef.current.x, py = posRef.current.y;
        setTrail(prev => {
          const next = [...prev, { id, x: px, y: py }];
          // Cap and let CSS animation finish; prune after ~700ms
          return next.length > 12 ? next.slice(-12) : next;
        });
        window.setTimeout(() => {
          setTrail(prev => prev.filter(p => p.id !== id));
        }, 750);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [zone]);

  useEffect(() => {
    if (!zone) return;
    const hb = setInterval(() => {
      heartbeat(zone.id, posRef.current.x, posRef.current.y, dirRef.current);
    }, HEARTBEAT_MS);
    const np = setInterval(async () => {
      try { setNearby(await fetchNearbyPlayers(zone.id)); } catch { }
    }, NEARBY_POLL_MS);
    return () => { clearInterval(hb); clearInterval(np); };
  }, [zone]);

  // Load equipped loadout once and publish to presence so others can see it
  useEffect(() => {
    (async () => {
      const lo = await fetchMyLoadout(characterId);
      setLoadout(lo);
      await publishLoadout(lo);
    })();
  }, [characterId]);

  useEffect(() => { (async () => {
    const { data } = await import('@/integrations/supabase/client').then(m => m.supabase.auth.getUser());
    if (data?.user) setMyQuests(await fetchPlayerQuests(data.user.id));
  })(); }, [activeNpc]);

  // Camera offset (in viewport CSS px) — kept in a ref so click handler can invert it
  const cameraRef = useRef({ tx: 0, ty: 0, scale: 1 });

  const handleStageClick = (e: React.MouseEvent) => {
    if (!zone || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const cam = cameraRef.current;
    // viewport px → world px (inverse of: world * scale + tx)
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    const x = (vx - cam.tx) / cam.scale;
    const y = (vy - cam.ty) / cam.scale;
    targetRef.current = {
      x: Math.max(40, Math.min(zone.width - 40, x)),
      y: Math.max(zone.height * 0.35, Math.min(zone.height - 40, y)),
    };
  };

  const closestNpc = (): Npc | null => {
    let best: Npc | null = null; let bestD = Infinity;
    for (const n of npcs) {
      const d = Math.hypot(n.position_x - pos.x, n.position_y - pos.y);
      if (d < bestD && d <= INTERACTION_RADIUS) { best = n; bestD = d; }
    }
    return best;
  };

  const tryInteract = () => {
    const n = closestNpc();
    // Always fire flash + camera nudge for immediate feedback
    setFlashKey(k => k + 1);
    setNudgeKey(k => k + 1);
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

  if (!zone) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>;
  }

  const bg = ZONE_BG[zone.id] ?? stationHub;
  const interactable = closestNpc();

  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col">
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

      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden bg-black">
        <div
          ref={stageRef}
          onClick={handleStageClick}
          className="relative bg-black cursor-crosshair border border-border rounded overflow-hidden select-none"
          style={{
            width: 'min(100%, calc((100vh - 140px) * 16 / 10))',
            aspectRatio: '16 / 10',
          }}
        >
          {/* Camera-follow world layer (translate + scale around viewport center) */}
          {(() => {
            const vw = stageSize.w || 1;
            const vh = stageSize.h || 1;
            // Auto-fit zoom: never let world be smaller than viewport
            const fitScale = Math.max(vw / zone.width, vh / zone.height);
            const scale = Math.max(CAMERA_ZOOM, fitScale);
            const worldW = zone.width * scale;
            const worldH = zone.height * scale;
            // Use SMOOTHED camera position (lerped per-frame in rAF)
            let tx = vw / 2 - camPos.x * scale;
            let ty = vh / 2 - camPos.y * scale;
            if (worldW <= vw) tx = (vw - worldW) / 2;
            else tx = Math.min(0, Math.max(vw - worldW, tx));
            if (worldH <= vh) ty = (vh - worldH) / 2;
            else ty = Math.min(0, Math.max(vh - worldH, ty));
            cameraRef.current = { tx, ty, scale };

            // Parallax background — moves at 70% camera speed → depth illusion
            const PARALLAX_BG = 0.7;
            const bgScale = scale * 1.08; // slightly oversized to never expose edges
            const bgW = zone.width * bgScale;
            const bgH = zone.height * bgScale;
            const bgTx = (vw / 2 - camPos.x * bgScale) * PARALLAX_BG + (1 - PARALLAX_BG) * (vw / 2 - (zone.width / 2) * bgScale);
            const bgTy = (vh / 2 - camPos.y * bgScale) * PARALLAX_BG + (1 - PARALLAX_BG) * (vh / 2 - (zone.height / 2) * bgScale);

            return (
              <>
                {/* === BACKGROUND LAYER (parallax, slower) === */}
                <div
                  className="absolute top-0 left-0 origin-top-left pointer-events-none"
                  style={{
                    width: bgW,
                    height: bgH,
                    transform: `translate3d(${bgTx}px, ${bgTy}px, 0)`,
                    backgroundImage: `url(${bg})`,
                    backgroundSize: '100% 100%',
                    filter: 'brightness(0.85) saturate(1.05)',
                  }}
                >
                  {/* Subtle panel flickers — desynced specks of brightness */}
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="absolute bg-flicker pointer-events-none"
                      style={{
                        left: `${15 + i * 22}%`,
                        top: `${20 + (i * 13) % 50}%`,
                        width: 60 + (i * 18) % 40,
                        height: 14 + (i * 7) % 18,
                        background:
                          zone.id === 'neon-district'
                            ? 'radial-gradient(ellipse, hsl(190 100% 70% / 0.7), transparent 70%)'
                            : zone.id === 'wasteland'
                            ? 'radial-gradient(ellipse, hsl(30 100% 65% / 0.55), transparent 70%)'
                            : 'radial-gradient(ellipse, hsl(210 100% 75% / 0.55), transparent 70%)',
                        animationDelay: `${i * 1.7}s`,
                      }}
                    />
                  ))}
                  {/* Slow horizontal light strip sweep */}
                  <div
                    className="absolute light-sweep pointer-events-none"
                    style={{
                      top: '38%',
                      left: 0,
                      width: '40%',
                      height: 2,
                      background:
                        'linear-gradient(90deg, transparent, hsl(190 100% 80% / 0.55), transparent)',
                      filter: 'blur(1px)',
                    }}
                  />
                  <div
                    className="absolute light-sweep pointer-events-none"
                    style={{
                      top: '62%',
                      left: 0,
                      width: '30%',
                      height: 1.5,
                      background:
                        'linear-gradient(90deg, transparent, hsl(280 100% 75% / 0.45), transparent)',
                      filter: 'blur(1px)',
                      animationDelay: '5s',
                    }}
                  />
                </div>

                {/* === MIDGROUND LAYER (world + actors, true 1:1 with player) ===
                    The camera transform lives on the OUTER div and must NEVER be
                    overwritten by an animation. The nudge is applied to a nested
                    wrapper so it composes with (not replaces) the camera matrix. */}
                <div
                  className="absolute top-0 left-0 origin-top-left"
                  style={{
                    width: zone.width,
                    height: zone.height,
                    transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
                    transformOrigin: '0 0',
                    willChange: 'transform',
                  }}
                >
                  <div
                    key={`nudge-${nudgeKey}`}
                    className="absolute inset-0 camera-nudge"
                  >
                  {/* NPCs in world coords (px) */}
                  {npcs.map((n, idx) => {
                    const close = interactable?.id === n.id;
                    return (
                      <button
                        key={n.id}
                        onClick={(e) => { e.stopPropagation(); openNpc(n); }}
                        style={{
                          left: n.position_x,
                          top: n.position_y,
                          position: 'absolute',
                          // Desync NPC idle bob/flicker per NPC
                          animationDelay: `${(idx * 0.37) % 2.6}s`,
                        }}
                        className="-translate-x-1/2 -translate-y-full group"
                      >
                        <NpcMarker
                          kind={n.type as 'vendor' | 'quest' | 'enemy'}
                          name={n.name}
                          close={close}
                        />
                      </button>
                    );
                  })}

                  {/* Movement trail puffs — small fading energy specks under feet */}
                  {trail.map(t => {
                    const auraColor = `hsl(${RARITY_HSL[playerRarity]} / 0.85)`;
                    return (
                      <div
                        key={t.id}
                        className="absolute trail-puff pointer-events-none"
                        style={{
                          left: t.x,
                          top: t.y - 4,
                          width: 14,
                          height: 6,
                          borderRadius: '50%',
                          background: `radial-gradient(ellipse, ${auraColor} 0%, transparent 70%)`,
                          filter: 'blur(2px)',
                        }}
                      />
                    );
                  })}

                  {/* Other players */}
                  {nearby.map(p => {
                    // Distance-based culling + opacity fade
                    const dx = p.x_position - pos.x;
                    const dy = p.y_position - pos.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > RENDER_RADIUS) return null;
                    const fade = dist <= FADE_RADIUS
                      ? 1
                      : Math.max(0.25, 1 - (dist - FADE_RADIUS) / (RENDER_RADIUS - FADE_RADIUS));
                    const dir: SpriteDirection = p.facing === 'left' ? 'left' : 'right';
                    const otherRarity = variantToRarity(p.equipped_armor_variant, p.equipped_weapon_variant);
                    const OtherIcon = getClassIcon(p.character_class ?? '');
                    return (
                      <div key={p.user_id}
                        style={{ left: p.x_position, top: p.y_position, position: 'absolute', opacity: fade }}
                        className="-translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none"
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

                  {/* Player */}
                  <div
                    style={{ left: pos.x, top: pos.y, position: 'absolute' }}
                    className="-translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none"
                  >
                    {/* Upgraded nameplate: class icon + name + level, ringed by rarity color */}
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
                    <div className="relative">
                      <PlayerSprite
                        direction={direction}
                        state={moving ? 'walk' : 'idle'}
                        armorVariant={loadout.armorVariant}
                        weaponVariant={loadout.weaponVariant}
                        rarity={playerRarity}
                        scale={1.15}
                      />
                      {/* Interaction flash — re-mounts on each E press via key */}
                      {flashKey > 0 && (
                        <div
                          key={`flash-${flashKey}`}
                          className="absolute left-1/2 top-1/2 interact-flash pointer-events-none rounded-full"
                          style={{
                            width: 80,
                            height: 80,
                            background: `radial-gradient(circle, hsl(${RARITY_HSL[playerRarity]} / 0.85) 0%, transparent 70%)`,
                            border: `2px solid hsl(${RARITY_HSL[playerRarity]})`,
                            mixBlendMode: 'screen',
                          }}
                        />
                      )}
                    </div>
                  </div>
                  </div>
                </div>

                {/* === FOREGROUND LAYER (vignette + ambient lighting, viewport-fixed) === */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse 80% 70% at 50% 55%, transparent 40%, rgba(0,0,0,0.55) 100%)',
                  }}
                />
                {/* Ambient color tint — zone mood */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      zone.id === 'neon-district'
                        ? 'linear-gradient(180deg, hsl(280 70% 30% / 0.18), hsl(190 80% 30% / 0.18))'
                        : zone.id === 'wasteland'
                        ? 'linear-gradient(180deg, hsl(30 60% 35% / 0.22), hsl(15 50% 25% / 0.18))'
                        : 'linear-gradient(180deg, hsl(210 50% 25% / 0.18), hsl(220 40% 15% / 0.18))',
                    mixBlendMode: 'soft-light',
                  }}
                />

                {/* Ambient floating particles — viewport-fixed, low opacity */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {ambientParticles.map((p, i) => (
                    <div
                      key={i}
                      className="absolute particle-drift rounded-full"
                      style={{
                        left: `${p.left}%`,
                        bottom: '-10px',
                        width: p.size,
                        height: p.size,
                        background: `hsl(${p.hue} 100% 70% / 0.6)`,
                        boxShadow: `0 0 ${p.size * 2}px hsl(${p.hue} 100% 70% / 0.5)`,
                        animationDuration: `${p.duration}s`,
                        animationDelay: `${p.delay}s`,
                        ['--drift-x' as any]: `${p.drift}px`,
                      }}
                    />
                  ))}
                </div>
              </>
            );
          })()}

          {debug && (
            <div className="absolute top-2 left-2 z-20 bg-black/75 text-[11px] font-mono text-emerald-300 px-2 py-1.5 rounded border border-emerald-500/40 leading-tight pointer-events-none space-y-0.5">
              <div>player: x={pos.x.toFixed(0)} y={pos.y.toFixed(0)} dir={direction} {moving ? 'walk' : 'idle'}</div>
              <div>world: {zone.width}×{zone.height}</div>
              <div>viewport: {stageSize.w}×{stageSize.h}</div>
              <div>camera: tx={cameraRef.current.tx.toFixed(0)} ty={cameraRef.current.ty.toFixed(0)} scale={cameraRef.current.scale.toFixed(2)}</div>
              <div className="text-emerald-500/70">[`] toggle debug</div>
            </div>
          )}
          {!debug && (
            <div className="absolute top-2 right-2 z-20 text-[10px] text-white/40 font-mono pointer-events-none">[`] debug</div>
          )}
        </div>
      </div>


      <footer className="px-3 py-2 bg-card/80 border-t border-border text-xs text-muted-foreground flex justify-between">
        <span>WASD or click to move · [E] to interact</span>
        <span>{interactable ? `Press E to talk to ${interactable.name}` : 'Find an NPC to interact'}</span>
      </footer>

      <Dialog open={!!activeNpc} onOpenChange={(o) => !o && closeNpc()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-orbitron flex items-center gap-2">
              {activeNpc?.type === 'vendor' && <Store className="w-4 h-4 text-blue-400" />}
              {activeNpc?.type === 'quest' && <ScrollText className="w-4 h-4 text-amber-400" />}
              {activeNpc?.type === 'enemy' && <Skull className="w-4 h-4 text-red-400" />}
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
