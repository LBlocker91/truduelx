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

const MOVE_SPEED = 4;
const HEARTBEAT_MS = 300;
const NEARBY_POLL_MS = 1500;
const INTERACTION_RADIUS = 60;

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
  const posRef = useRef(pos);
  posRef.current = pos;
  const dirRef = useRef<SpriteDirection>('right');
  dirRef.current = direction;

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

  useEffect(() => {
    if (!zone) return;
    let raf = 0;
    const loop = () => {
      setPos(prev => {
        let { x, y } = prev;
        let dx = 0, dy = 0;
        const k = keysRef.current;
        if (k.has('a') || k.has('arrowleft')) dx -= MOVE_SPEED;
        if (k.has('d') || k.has('arrowright')) dx += MOVE_SPEED;
        if (k.has('w') || k.has('arrowup')) dy -= MOVE_SPEED;
        if (k.has('s') || k.has('arrowdown')) dy += MOVE_SPEED;
        const t = targetRef.current;
        if (!dx && !dy && t) {
          const tdx = t.x - x, tdy = t.y - y;
          const dist = Math.hypot(tdx, tdy);
          if (dist < MOVE_SPEED) { x = t.x; y = t.y; targetRef.current = null; }
          else { dx = (tdx / dist) * MOVE_SPEED; dy = (tdy / dist) * MOVE_SPEED; }
        }
        x += dx; y += dy;
        x = Math.max(40, Math.min(zone.width - 40, x));
        y = Math.max(zone.height * 0.55, Math.min(zone.height - 40, y));
        const isMoving = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
        // Update direction & moving via refs avoids per-frame React re-render unless changed
        if (Math.abs(dx) > 0.01) {
          const nd: SpriteDirection = dx < 0 ? 'left' : 'right';
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

  const handleStageClick = (e: React.MouseEvent) => {
    if (!zone || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const scaleX = zone.width / rect.width;
    const scaleY = zone.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
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
          className="relative w-full max-w-[1400px] aspect-[16/10] bg-cover bg-center cursor-crosshair border border-border rounded overflow-hidden select-none"
          style={{ backgroundImage: `url(${bg})` }}
        >
          {npcs.map(n => {
            const sx = (n.position_x / zone.width) * 100;
            const sy = (n.position_y / zone.height) * 100;
            const ico = n.type === 'vendor' ? Store : n.type === 'quest' ? ScrollText : Skull;
            const Icon = ico;
            const close = interactable?.id === n.id;
            return (
              <button
                key={n.id}
                onClick={(e) => { e.stopPropagation(); openNpc(n); }}
                style={{ left: `${sx}%`, top: `${sy}%` }}
                className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center group"
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
                <div className={`w-10 h-12 rounded-t-full flex items-end justify-center pb-1
                  ${n.type === 'vendor' ? 'bg-blue-500/80' : n.type === 'quest' ? 'bg-amber-500/80' : 'bg-red-500/80'}
                  border-2 ${close ? 'border-primary' : 'border-white/50'} shadow-lg`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="w-2 h-2 rounded-full bg-black/40" />
              </button>
            );
          })}

          {nearby.map(p => {
            const sx = (p.x_position / zone.width) * 100;
            const sy = (p.y_position / zone.height) * 100;
            const dir: SpriteDirection = p.facing === 'left' ? 'left' : 'right';
            return (
              <div key={p.user_id}
                style={{ left: `${sx}%`, top: `${sy}%` }}
                className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none"
              >
                <div className="text-[9px] px-1 rounded bg-card/80 border border-secondary/50 mb-0.5">
                  {p.display_name} L{p.character_level}
                </div>
                <PlayerSprite
                  direction={dir}
                  state="idle"
                  armorVariant={p.equipped_armor_variant}
                  weaponVariant={p.equipped_weapon_variant}
                  scale={0.85}
                />
                <div className="w-6 h-1.5 rounded-full bg-black/40 -mt-1 blur-[1px]" />
              </div>
            );
          })}

          <div
            style={{
              left: `${(pos.x / zone.width) * 100}%`,
              top: `${(pos.y / zone.height) * 100}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none transition-none"
          >
            <div className="text-[10px] font-orbitron px-1.5 py-0.5 rounded bg-primary text-primary-foreground mb-0.5 drop-shadow">
              {characterName}
            </div>
            <PlayerSprite
              direction={direction}
              state={moving ? 'walk' : 'idle'}
              armorVariant={loadout.armorVariant}
              weaponVariant={loadout.weaponVariant}
              scale={1}
              className="drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]"
            />
            <div className="w-8 h-2 rounded-full bg-black/50 -mt-1 blur-[1px]" />
          </div>
        </div>
      </div>

      <footer className="px-3 py-2 bg-card/80 border-t border-border text-xs text-muted-foreground flex justify-between">
        <span>WASD or click to move · [E] to interact</span>
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
