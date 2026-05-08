import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  User as UserIcon, Backpack, ScrollText, Map as MapIcon, Swords,
  Sparkles, Store, Settings as SettingsIcon, LogOut, Crown, Coins, Gem,
  Maximize2, Minimize2,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { OverworldScreen } from './OverworldScreen';
import { BuildPanel } from './panels/BuildPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { QuestsPanel } from './panels/QuestsPanel';
import { PvpPanel } from './panels/PvpPanel';
import { SkillsPanel } from './panels/SkillsPanel';
import { xpForLevel } from '@/lib/leveling';
import type { LevelUpInfo } from '@/pages/Index';

type PanelKey = 'profile' | 'inventory' | 'quests' | 'map' | 'pvp' | 'skills' | 'shop' | 'settings' | null;

interface GameHudProps {
  characterId: string;
  characterName: string;
  characterClass: string;
  characterLevel: number;
  characterXp: number;
  credits: number;
  isPremium: boolean;
  refreshTick: number;
  onEnterNpcBattle: (battleId: string) => void;
  onJoinPvpQueue: () => void;
  onExitToSlots: () => void;
  onProgressionChange: (level?: LevelUpInfo | null) => void;
}

export const GameHud = (props: GameHudProps) => {
  const [panel, setPanel] = useState<PanelKey>(null);
  const [loadoutBust, setLoadoutBust] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [vibranium, setVibranium] = useState<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => setPanel(null);

  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // Refresh vibranium whenever character/refresh changes or the profile panel closes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('characters').select('vibranium').eq('id', props.characterId).maybeSingle();
      if (!cancelled) setVibranium(Number(data?.vibranium ?? 0));
    })();
    return () => { cancelled = true; };
  }, [props.characterId, props.refreshTick, panel]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch { /* ignore */ }
  };

  const items: { key: PanelKey; icon: React.ReactNode; label: string }[] = [
    { key: 'profile',   icon: <UserIcon className="w-4 h-4" />,   label: 'Build' },
    { key: 'inventory', icon: <Backpack className="w-4 h-4" />,   label: 'Inventory' },
    { key: 'quests',    icon: <ScrollText className="w-4 h-4" />, label: 'Quests' },
    { key: 'pvp',       icon: <Swords className="w-4 h-4" />,     label: 'PvP' },
    { key: 'skills',    icon: <Sparkles className="w-4 h-4" />,   label: 'Skills' },
    { key: 'map',       icon: <MapIcon className="w-4 h-4" />,    label: 'Map' },
    { key: 'shop',      icon: <Store className="w-4 h-4" />,      label: 'Shop' },
    { key: 'settings',  icon: <SettingsIcon className="w-4 h-4" />, label: 'Settings' },
  ];

  // xpForLevel client formula is approximate vs server pacing curve, used only
  // for the HUD bar fill. Numerical values come from the DB row directly.
  const need = xpForLevel(props.characterLevel);
  const pct = Math.min(100, Math.round((props.characterXp / need) * 100));

  return (
    <div ref={rootRef} className="relative grid h-[100dvh] w-screen grid-rows-[auto_minmax(0,1fr)] bg-black overflow-hidden">
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
          <div className="hidden sm:flex items-center gap-2 min-w-[140px] max-w-[260px] flex-1">
            <span className="text-[10px] text-muted-foreground font-orbitron">XP</span>
            <div className="h-2 flex-1 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {props.characterXp}/{need}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-shield font-orbitron flex items-center gap-1">
            <Coins className="w-3 h-3" /> {props.credits.toLocaleString()}
          </span>
          <span className="text-xs text-neon-purple font-orbitron flex items-center gap-1" title="Diamonds — premium currency">
            <Gem className="w-3 h-3" /> {vibranium.toLocaleString()}
          </span>
          <Button
            size="sm"
            onClick={() => setPanel('profile')}
            title="Open Build (character, gear, skills)"
            className="bg-gradient-to-r from-secondary to-primary text-primary-foreground font-orbitron tracking-wider shadow-[0_0_12px_hsl(var(--primary)/0.45)] hover:shadow-[0_0_18px_hsl(var(--primary)/0.6)]"
          >
            <UserIcon className="w-4 h-4 mr-1" /> BUILD
          </Button>
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
          onCharacterChanged={() => props.onProgressionChange(null)}
        />

        <nav className="absolute top-3 right-3 z-30 flex flex-col gap-1 bg-card/85 backdrop-blur border border-border rounded-lg p-1.5">
          {items.map((it) => {
            const isBuild = it.key === 'profile';
            return (
              <Button
                key={it.label}
                size="sm"
                variant={isBuild ? 'default' : 'ghost'}
                className={
                  isBuild
                    ? 'justify-start gap-2 h-8 px-2 text-xs bg-gradient-to-r from-secondary to-primary text-primary-foreground font-orbitron'
                    : 'justify-start gap-2 h-8 px-2 text-xs'
                }
                onClick={() => setPanel(it.key)}
                title={it.label}
              >
                {it.icon}
                <span className="hidden md:inline">{it.label}</span>
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Build = full-screen overlay (its own modal, NOT inside the side Sheet) */}
      <BuildPanel
        characterId={props.characterId}
        open={panel === 'profile'}
        onClose={close}
        refreshTick={props.refreshTick}
        onProgressionChange={props.onProgressionChange}
        onLoadoutChanged={() => setLoadoutBust((n) => n + 1)}
      />

      <Sheet open={panel !== null && panel !== 'profile'} onOpenChange={(o) => !o && close()}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-orbitron capitalize">{panel}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {panel === 'inventory' && <InventoryPanel characterId={props.characterId} onLoadoutChanged={() => setLoadoutBust((n) => n + 1)} />}
            {panel === 'quests'    && <QuestsPanel characterId={props.characterId} refreshTick={props.refreshTick} onProgressionChange={props.onProgressionChange} />}
            {panel === 'pvp'       && <PvpPanel onJoinRanked={() => { close(); props.onJoinPvpQueue(); }} />}
            {panel === 'skills'    && <SkillsPanel characterId={props.characterId} refreshTick={props.refreshTick} onProgressionChange={props.onProgressionChange} />}
            {panel === 'map'       && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Travel between zones by walking through glowing portals in the world.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                  <li><span className="text-foreground font-orbitron">Bazaar Station</span> — central hub, vendors and mission boards.</li>
                  <li><span className="text-foreground font-orbitron">Wasteland</span> — open frontier, hostile drones and marauders.</li>
                  <li><span className="text-foreground font-orbitron">Neon District</span> — syndicate territory, higher-tier rewards.</li>
                </ul>
              </div>
            )}
            {panel === 'shop'      && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Approach a vendor in the world and press <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[10px] font-mono">E</kbd> to trade.
                </p>
                <p className="text-xs text-muted-foreground">
                  Try <span className="text-foreground font-orbitron">Broker Vexon</span> for weapons,
                  {' '}<span className="text-foreground font-orbitron">Medic Nara Coil</span> for armor, and
                  {' '}<span className="text-foreground font-orbitron">Cyber-Doc Riku</span> for potions.
                </p>
              </div>
            )}
            {panel === 'settings'  && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Display & account options.</p>
                <Button size="sm" variant="outline" onClick={toggleFullscreen} className="w-full justify-start">
                  {isFullscreen ? <Minimize2 className="w-4 h-4 mr-2" /> : <Maximize2 className="w-4 h-4 mr-2" />}
                  {isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { close(); props.onExitToSlots(); }} className="w-full justify-start">
                  <LogOut className="w-4 h-4 mr-2" /> Switch character
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => { await supabase.auth.signOut(); }}
                  className="w-full justify-start text-muted-foreground"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Placeholder = ({ text }: { text: string }) => (
  <p className="text-sm text-muted-foreground">{text}</p>
);
