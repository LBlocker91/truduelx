import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AuthScreen } from '@/components/game/AuthScreen';
import { CharacterSlots } from '@/components/game/CharacterSlots';
import { CharacterSelect } from '@/components/game/CharacterSelect';
import { GameHud } from '@/components/game/GameHud';
import { MatchmakingScreen } from '@/components/game/MatchmakingScreen';
import { PvpBattleScreen } from '@/components/game/PvpBattleScreen';
import { NpcBattleScreen } from '@/components/game/NpcBattleScreen';
import { LevelUpToast } from '@/components/game/LevelUpToast';
import {
  createNewCharacter,
  getMaxSlots,
  listMyCharacters,
  getLastPlayed,
  setLastPlayed,
  CharacterSummary,
} from '@/lib/characters-db';
import type { CharacterClass } from '@/types/game';
import { supabase } from '@/integrations/supabase/client';

type Screen = 'slots' | 'create' | 'game' | 'pvp-queue' | 'pvp-battle' | 'npc-battle';

export interface LevelUpInfo {
  oldLevel: number;
  newLevel: number;
  statPointsGained: number;
  skillPointsGained: number;
  maxHpGained: number;
}

const Index = () => {
  const { user, ready } = useAuth();
  const [screen, setScreen] = useState<Screen>('slots');
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [activeChar, setActiveChar] = useState<CharacterSummary | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [pvpBattleId, setPvpBattleId] = useState<string | null>(null);
  const [npcBattleId, setNpcBattleId] = useState<string | null>(null);
  const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpInfo | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Load premium flag whenever the user changes
  useEffect(() => {
    if (!user) { setIsPremium(false); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles').select('is_premium').eq('user_id', user.id).maybeSingle();
      setIsPremium(!!data?.is_premium);
    })();
  }, [user]);

  const reloadActiveChar = useCallback(async (id: string) => {
    const all = await listMyCharacters();
    const found = all.find(c => c.id === id) ?? null;
    setActiveChar(found);
    setRefreshTick(t => t + 1);
  }, []);

  const handlePlayCharacter = useCallback(async (id: string) => {
    setLastPlayed(id);
    setActiveCharId(id);
    await reloadActiveChar(id);
    setScreen('game');
  }, [reloadActiveChar]);

  // Auto-resume into last-played character on refresh
  useEffect(() => {
    if (!user || activeCharId) return;
    let cancelled = false;
    (async () => {
      const lastId = getLastPlayed();
      if (!lastId) return;
      const all = await listMyCharacters();
      const found = all.find(c => c.id === lastId);
      if (!found || cancelled) return;
      setActiveCharId(found.id);
      setActiveChar(found);
      setScreen('game');
    })();
    return () => { cancelled = true; };
  }, [user, activeCharId]);

  const handleExitToSlots = useCallback(() => {
    setActiveCharId(null);
    setActiveChar(null);
    setScreen('slots');
  }, []);

  const handleOpenCreate = useCallback(async () => {
    const slots = await getMaxSlots();
    const list = await listMyCharacters();
    if (list.length >= slots) {
      toast.error('All character slots are full');
      return;
    }
    setScreen('create');
  }, []);

  const handleCreateCharacter = useCallback(async (cls: CharacterClass, name: string) => {
    try {
      const id = await createNewCharacter(cls, name);
      toast.success(`${name} created`);
      await handlePlayCharacter(id);
    } catch (e: any) {
      toast.error(`Couldn't create character: ${e.message ?? e}`);
    }
  }, [handlePlayCharacter]);

  const handleJoinPvp = useCallback(() => {
    if (!activeCharId) return;
    setScreen('pvp-queue');
  }, [activeCharId]);

  const handleMatched = useCallback((battleId: string) => {
    setPvpBattleId(battleId);
    setScreen('pvp-battle');
  }, []);

  const handleEnterNpcBattle = useCallback((battleId: string) => {
    setNpcBattleId(battleId);
    setScreen('npc-battle');
  }, []);

  const handleNpcBattleExit = useCallback(async (won: boolean, level?: LevelUpInfo | null) => {
    setScreen('game');
    if (activeCharId) await reloadActiveChar(activeCharId);
    if (won && level && level.newLevel > level.oldLevel) {
      setPendingLevelUp(level);
    }
  }, [activeCharId, reloadActiveChar]);

  const handleProgressionChange = useCallback(async (level?: LevelUpInfo | null) => {
    if (activeCharId) await reloadActiveChar(activeCharId);
    if (level && level.newLevel > level.oldLevel) {
      setPendingLevelUp(level);
    }
  }, [activeCharId, reloadActiveChar]);

  // ---- Render ----

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (screen === 'slots') {
    return (
      <CharacterSlots
        onPlay={handlePlayCharacter}
        onCreateNew={handleOpenCreate}
      />
    );
  }

  if (screen === 'create') {
    return (
      <CharacterSelect
        onSelect={handleCreateCharacter}
        onBack={() => setScreen('slots')}
        playerLevel={1}
        unlockedPremiumClasses={[]}
      />
    );
  }

  if (screen === 'pvp-queue' && activeCharId) {
    return (
      <MatchmakingScreen
        characterId={activeCharId}
        onMatched={handleMatched}
        onCancel={() => setScreen('game')}
      />
    );
  }

  if (screen === 'pvp-battle' && pvpBattleId && user) {
    return (
      <PvpBattleScreen
        battleId={pvpBattleId}
        myUserId={user.id}
        onExit={() => { setScreen('game'); if (activeCharId) reloadActiveChar(activeCharId); }}
      />
    );
  }

  if (screen === 'npc-battle' && npcBattleId && user) {
    return (
      <NpcBattleScreen
        battleId={npcBattleId}
        myUserId={user.id}
        onExit={handleNpcBattleExit}
      />
    );
  }

  if (screen === 'game' && activeCharId && activeChar) {
    return (
      <>
        <GameHud
          characterId={activeCharId}
          characterName={activeChar.name}
          characterClass={activeChar.class}
          characterLevel={activeChar.level}
          characterXp={activeChar.xp ?? 0}
          credits={activeChar.credits ?? 0}
          isPremium={isPremium}
          refreshTick={refreshTick}
          onEnterNpcBattle={handleEnterNpcBattle}
          onJoinPvpQueue={handleJoinPvp}
          onExitToSlots={handleExitToSlots}
          onProgressionChange={handleProgressionChange}
        />
        {pendingLevelUp && (
          <LevelUpToast info={pendingLevelUp} onClose={() => setPendingLevelUp(null)} />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
};

export default Index;
