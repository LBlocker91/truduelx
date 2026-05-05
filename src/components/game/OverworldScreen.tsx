import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Swords, Map, Store, ScrollText, Skull, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Zone, Npc, NearbyPlayer,
  fetchZones, fetchNpcs, fetchNearbyPlayers,
  enterZone, heartbeat, setInBattle,
  fetchVendorItems, fetchQuestForNpc, fetchPlayerQuests, acceptQuest,
  startNpcBattle,
  fetchMyLoadout, publishLoadout, EquippedLoadout,
} from '@/lib/overworld';
import { PlayerSprite, SpriteDirection } from './PlayerSprite';
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

const MOVE_SPEED = 4.5;
const MOVE_ACCEL = 0.25; // easing factor 0..1 (lerp toward target velocity)
const HEARTBEAT_MS = 300;
const NEARBY_POLL_MS = 1500;
const INTERACTION_RADIUS = 90;
const CAMERA_ZOOM = 1.6; // makes player ~12-18% of screen
const CAMERA_LERP = 0.14;

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
  const posRef = useRef(pos);
  posRef.current = pos;
  const dirRef = useRef<SpriteDirection>('right');
  dirRef.current = direction;

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
    targetRef.current = null;
  }, [zones]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['w','a','s','d','W','A','S','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        keysRef.current.add(e.key.toLowerCase());
        targetRef.current = null;
      }
      if (e.key === 'e' || e.key === 'E') tryInteract();
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
        y = Math.max(zone.height * 0.55, Math.min(zone.height - 40, y));

        const speed = Math.hypot(v.vx, v.vy);
        const isMoving = speed > 0.4;
        if (Math.abs(v.vx) > 0.1) {
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
      y: Math.max(zone.height * 0.55, Math.min(zone.height - 40, y)),
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

      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        <div
          ref={stageRef}
          onClick={handleStageClick}
          className="relative w-full max-w-[1400px] aspect-[16/10] bg-black cursor-crosshair border border-border rounded overflow-hidden select-none"
        >
          {/* Camera-follow world layer (translate + scale around viewport center) */}
          {(() => {
            const scale = CAMERA_ZOOM;
            const vw = stageSize.w || 1;
            const vh = stageSize.h || 1;
            // World pixel size when scaled
            const worldW = zone.width * scale;
            const worldH = zone.height * scale;
            // Desired translate to put player at viewport center
            let tx = vw / 2 - pos.x * scale;
            let ty = vh / 2 - pos.y * scale;
            // Clamp so we don't show beyond world edges
            const minTx = vw - worldW;
            const minTy = vh - worldH;
            tx = Math.min(0, Math.max(minTx, tx));
            ty = Math.min(0, Math.max(minTy, ty));
            cameraRef.current = { tx, ty, scale };
            return (
              <div
                className="absolute top-0 left-0 origin-top-left camera-smooth"
                style={{
                  width: zone.width,
                  height: zone.height,
                  transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
                  transformOrigin: '0 0',
                  backgroundImage: `url(${bg})`,
                  backgroundSize: '100% 100%',
                }}
              >
                {/* NPCs in world coords (px) */}
                {npcs.map(n => {
                  const Icon = n.type === 'vendor' ? Store : n.type === 'quest' ? ScrollText : Skull;
                  const close = interactable?.id === n.id;
                  return (
                    <button
                      key={n.id}
                      onClick={(e) => { e.stopPropagation(); openNpc(n); }}
                      style={{ left: n.position_x, top: n.position_y, position: 'absolute' }}
                      className="-translate-x-1/2 -translate-y-full flex flex-col items-center group"
                    >
                      {close && (
                        <div className="text-[10px] font-orbitron px-1.5 py-0.5 rounded bg-primary text-primary-foreground mb-0.5 animate-pulse">
                          [E] {n.name}
                        </div>
                      )}
                      {!close && (
                        <div className="text-[10px] font-orbitron px-1 py-0.5 rounded bg-card/90 border border-border opacity-0 group-hover:opacity-100 mb-0.5">
                          {n.name}
                        </div>
                      )}
                      <div className={`w-14 h-16 rounded-t-full flex items-end justify-center pb-1
                        ${n.type === 'vendor' ? 'bg-blue-500/80' : n.type === 'quest' ? 'bg-amber-500/80' : 'bg-red-500/80'}
                        border-2 ${close ? 'border-primary' : 'border-white/50'} shadow-lg`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="w-3 h-3 rounded-full bg-black/50 blur-[1px]" />
                    </button>
                  );
                })}

                {/* Other players */}
                {nearby.map(p => {
                  const dir: SpriteDirection = p.facing === 'left' ? 'left' : 'right';
                  return (
                    <div key={p.user_id}
                      style={{ left: p.x_position, top: p.y_position, position: 'absolute' }}
                      className="-translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none"
                    >
                      <div className="text-[10px] px-1.5 py-0.5 rounded bg-card/85 border border-secondary/50 mb-0.5">
                        {p.display_name} L{p.character_level}
                      </div>
                      <PlayerSprite
                        direction={dir}
                        state="idle"
                        armorVariant={p.equipped_armor_variant}
                        weaponVariant={p.equipped_weapon_variant}
                        scale={0.9}
                      />
                    </div>
                  );
                })}

                {/* Player */}
                <div
                  style={{ left: pos.x, top: pos.y, position: 'absolute' }}
                  className="-translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none"
                >
                  <div className="text-[11px] font-orbitron px-2 py-0.5 rounded bg-primary text-primary-foreground mb-1 drop-shadow">
                    {characterName}
                  </div>
                  <PlayerSprite
                    direction={direction}
                    state={moving ? 'walk' : 'idle'}
                    armorVariant={loadout.armorVariant}
                    weaponVariant={loadout.weaponVariant}
                    rarity="rare"
                    scale={1}
                  />
                </div>
              </div>
            );
          })()}
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
