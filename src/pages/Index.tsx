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
import {
  createNewCharacter,
  getMaxSlots,
  listMyCharacters,
  CharacterSummary,
} from '@/lib/characters-db';
import type { CharacterClass } from '@/types/game';
import { supabase } from '@/integrations/supabase/client';

type Screen = 'slots' | 'create' | 'game' | 'pvp-queue' | 'pvp-battle' | 'npc-battle';

const Index = () => {
  const { user, ready } = useAuth();
  const [screen, setScreen] = useState<Screen>('slots');
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [activeChar, setActiveChar] = useState<CharacterSummary | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [pvpBattleId, setPvpBattleId] = useState<string | null>(null);
  const [npcBattleId, setNpcBattleId] = useState<string | null>(null);

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
  }, []);

  const handlePlayCharacter = useCallback(async (id: string) => {
    setActiveCharId(id);
    await reloadActiveChar(id);
    setScreen('game');
  }, [reloadActiveChar]);

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

  // ---- Render ----

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // A. Not authenticated
  if (!user) return <AuthScreen />;

  // B. Authenticated but no character chosen → slot select / create
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

  // PvP queue & battles
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
        onExit={() => setScreen('game')}
      />
    );
  }

  if (screen === 'npc-battle' && npcBattleId && user) {
    return (
      <NpcBattleScreen
        battleId={npcBattleId}
        myUserId={user.id}
        onExit={() => setScreen('game')}
      />
    );
  }

  // C. In game with HUD
  if (screen === 'game' && activeCharId && activeChar) {
    return (
      <GameHud
        characterId={activeCharId}
        characterName={activeChar.name}
        characterClass={activeChar.class}
        characterLevel={activeChar.level}
        characterXp={activeChar.xp ?? 0}
        credits={activeChar.credits ?? 0}
        isPremium={isPremium}
        onEnterNpcBattle={handleEnterNpcBattle}
        onJoinPvpQueue={handleJoinPvp}
        onExitToSlots={handleExitToSlots}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
};

export default Index;
