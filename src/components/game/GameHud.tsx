import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  User as UserIcon, Backpack, ScrollText, Map as MapIcon, Swords,
  Sparkles, Store, Settings as SettingsIcon, LogOut, Crown, Coins,
  Maximize2, Minimize2,
} from 'lucide-react';
import { OverworldScreen } from './OverworldScreen';
import { ProfilePanel } from './panels/ProfilePanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { QuestsPanel } from './panels/QuestsPanel';
import { PvpPanel } from './panels/PvpPanel';
import { xpForLevel } from '@/lib/leveling';

type PanelKey = 'profile' | 'inventory' | 'quests' | 'map' | 'pvp' | 'skills' | 'shop' | 'settings' | null;

interface GameHudProps {
  characterId: string;
  characterName: string;
  characterClass: string;
  characterLevel: number;
  characterXp: number;
  credits: number;
  isPremium: boolean;
  onEnterNpcBattle: (battleId: string) => void;
  onJoinPvpQueue: () => void;
  onExitToSlots: () => void;
}

export const GameHud = (props: GameHudProps) => {
  const [panel, setPanel] = useState<PanelKey>(null);
  const [loadoutBust, setLoadoutBust] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => setPanel(null);

  // Track fullscreen state so the icon stays in sync if user presses Esc
  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      /* ignore — some browsers block without user gesture */
    }
  };

  const items: { key: PanelKey; icon: React.ReactNode; label: string }[] = [
    { key: 'profile',   icon: <UserIcon className="w-4 h-4" />,   label: 'Profile' },
    { key: 'inventory', icon: <Backpack className="w-4 h-4" />,   label: 'Inventory' },
    { key: 'quests',    icon: <ScrollText className="w-4 h-4" />, label: 'Quests' },
    { key: 'pvp',       icon: <Swords className="w-4 h-4" />,     label: 'PvP' },
    { key: 'skills',    icon: <Sparkles className="w-4 h-4" />,   label: 'Skills' },
    { key: 'map',       icon: <MapIcon className="w-4 h-4" />,    label: 'Map' },
    { key: 'shop',      icon: <Store className="w-4 h-4" />,      label: 'Shop' },
    { key: 'settings',  icon: <SettingsIcon className="w-4 h-4" />, label: 'Settings' },
  ];

  return (
    <div ref={rootRef} className="relative grid h-[100dvh] w-screen grid-rows-[auto_minmax(0,1fr)] bg-black overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-3 py-2 bg-card/85 backdrop-blur border-b border-border z-20">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-orbitron text-sm truncate">{props.characterName}</span>
          <span className="text-xs text-muted-foreground capitalize whitespace-nowrap">
            Lv {props.characterLevel} · {props.characterClass}
          </span>
          {props.isPremium && (
            <span className="text-[10px] text-shield font-orbitron flex items-center gap-1">
              <Crown className="w-3 h-3" /> PREMIUM
            </span>
          )}
          {/* XP bar */}
          {(() => {
            const need = xpForLevel(props.characterLevel);
            const pct = Math.min(100, Math.round((props.characterXp / need) * 100));
            return (
              <div className="hidden sm:flex items-center gap-2 min-w-[140px] max-w-[260px] flex-1">
                <span className="text-[10px] text-muted-foreground font-orbitron">XP</span>
                <div className="h-2 flex-1 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {props.characterXp}/{need}
                </span>
              </div>
            );
          })()}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-shield font-orbitron flex items-center gap-1">
            <Coins className="w-3 h-3" /> {props.credits.toLocaleString()}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setPanel('pvp')} title="PvP">
            <Swords className="w-4 h-4 mr-1" /> PvP
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onExitToSlots}>
            <LogOut className="w-4 h-4 mr-1" /> Characters
          </Button>
        </div>
      </header>

      {/* Game viewport (overworld) */}
      <div className="relative min-h-0 h-full overflow-hidden">
        <OverworldScreen
          characterId={props.characterId}
          characterName={props.characterName}
          characterClass={props.characterClass}
          characterLevel={props.characterLevel}
          onEnterNpcBattle={props.onEnterNpcBattle}
          onJoinPvpQueue={props.onJoinPvpQueue}
          onExit={props.onExitToSlots}
          hideChrome
          loadoutBust={loadoutBust}
        />

        {/* Vertical dock (right side) */}
        <nav className="absolute top-3 right-3 z-30 flex flex-col gap-1 bg-card/85 backdrop-blur border border-border rounded-lg p-1.5">
          {items.map((it) => (
            <Button
              key={it.label}
              size="sm"
              variant="ghost"
              className="justify-start gap-2 h-8 px-2 text-xs"
              onClick={() => setPanel(it.key)}
              title={it.label}
            >
              {it.icon}
              <span className="hidden md:inline">{it.label}</span>
            </Button>
          ))}
        </nav>
      </div>

      {/* Side panel */}
      <Sheet open={panel !== null} onOpenChange={(o) => !o && close()}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-orbitron capitalize">{panel}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {panel === 'profile'   && <ProfilePanel characterId={props.characterId} />}
            {panel === 'inventory' && <InventoryPanel characterId={props.characterId} onLoadoutChanged={() => setLoadoutBust((n) => n + 1)} />}
            {panel === 'quests'    && <QuestsPanel characterId={props.characterId} />}
            {panel === 'pvp'       && <PvpPanel onJoinRanked={() => { close(); props.onJoinPvpQueue(); }} />}
            {panel === 'skills'    && <Placeholder text="Skills tree — open from Profile to spend skill points (coming soon: dedicated tree view)." />}
            {panel === 'map'       && <Placeholder text="Use the zone selector in the overworld to travel. Full minimap coming soon." />}
            {panel === 'shop'      && <Placeholder text="Walk up to a vendor NPC in the overworld to trade." />}
            {panel === 'settings'  && <Placeholder text="Settings — sound and graphics options coming soon." />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Placeholder = ({ text }: { text: string }) => (
  <p className="text-sm text-muted-foreground">{text}</p>
);
