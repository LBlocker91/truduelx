import { useState, useCallback, useEffect } from 'react';
import { GameState, CharacterClass, Character } from '@/types/game';
import { createCharacter, createEnemy } from '@/data/characters';
import { calcBattleXp, applyXp } from '@/lib/leveling';
import { saveGame, loadGame, SaveData } from '@/lib/save-game';
import { useAuth } from '@/hooks/useAuth';
import { syncCharacterToCloud } from '@/lib/cloud-pvp';
import { TitleScreen } from '@/components/game/TitleScreen';
import { CharacterSelect } from '@/components/game/CharacterSelect';
import { BattleArena } from '@/components/game/BattleArena';
import { ResultScreen } from '@/components/game/ResultScreen';
import { LevelUpScreen } from '@/components/game/LevelUpScreen';
import { MatchmakingScreen } from '@/components/game/MatchmakingScreen';
import { PvpBattleScreen } from '@/components/game/PvpBattleScreen';
import { toast } from 'sonner';

type Screen = GameState['screen'] | 'pvp-queue' | 'pvp-battle';

const INITIAL_STATE: GameState = {
  screen: 'title',
  player: null,
  enemy: null,
  battleState: null,
  pendingXp: 0,
  unlockedPremiumClasses: [],
};

const Index = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [screen, setScreen] = useState<Screen>('title');
  const [saveData, setSaveData] = useState<SaveData | null>(null);
  const [pvpCharacterId, setPvpCharacterId] = useState<string | null>(null);
  const [pvpBattleId, setPvpBattleId] = useState<string | null>(null);
  const { user, ready } = useAuth();

  useEffect(() => {
    setSaveData(loadGame());
  }, []);

  const autoSave = useCallback((player: Character, premiumClasses?: CharacterClass[]) => {
    const classes = premiumClasses ?? gameState.unlockedPremiumClasses;
    saveGame(player, classes);
    setSaveData({ player, unlockedPremiumClasses: classes, savedAt: Date.now() });
    // Also push to cloud (best-effort, don't block)
    syncCharacterToCloud(player).catch(err => console.warn('cloud sync failed', err));
  }, [gameState.unlockedPremiumClasses]);

  const handleStart = useCallback(() => {
    setScreen('character-select');
    setGameState(prev => ({ ...prev, screen: 'character-select' }));
  }, []);

  const handleContinue = useCallback(() => {
    const saved = loadGame();
    if (!saved) return;
    const player = saved.player;
    const resetPlayer: Character = {
      ...player,
      stats: { ...player.stats, health: player.stats.maxHealth, energy: player.stats.maxEnergy },
      abilities: player.abilities.map(a => ({ ...a, currentCooldown: 0 })),
      rage: 0, isDefending: false, statusEffects: [],
    };
    const enemy = createEnemy(resetPlayer.level);
    setScreen('battle');
    setGameState({
      screen: 'battle', player: resetPlayer, enemy, battleState: null, pendingXp: 0,
      unlockedPremiumClasses: saved.unlockedPremiumClasses,
    });
  }, []);

  const handleBackToTitle = useCallback(() => {
    setSaveData(loadGame());
    setScreen('title');
    setGameState(prev => ({ ...INITIAL_STATE, unlockedPremiumClasses: prev.unlockedPremiumClasses, player: prev.player }));
  }, []);

  const handlePvp = useCallback(async () => {
    if (!user) { toast.error('Connecting…'); return; }
    if (!saveData) { toast.error('Create a character first'); return; }
    try {
      toast('Syncing character to cloud…');
      const synced = await syncCharacterToCloud(saveData.player);
      if (!synced?.id) throw new Error('sync failed');
      setPvpCharacterId(synced.id);
      setScreen('pvp-queue');
    } catch (e: any) {
      toast.error(`PvP unavailable: ${e.message ?? e}`);
    }
  }, [user, saveData]);

  const handleMatched = useCallback((battleId: string) => {
    setPvpBattleId(battleId);
    setScreen('pvp-battle');
  }, []);

  const handleCharacterSelect = useCallback((characterClass: CharacterClass, name: string) => {
    const player = createCharacter(characterClass, name, 'player');
    const enemy = createEnemy(player.level);
    autoSave(player);
    setScreen('battle');
    setGameState(prev => ({ ...prev, screen: 'battle', player, enemy, battleState: null, pendingXp: 0 }));
  }, [autoSave]);

  const handleBattleEnd = useCallback((winner: 'player' | 'enemy') => {
    setGameState(prev => {
      const playerLevel = prev.player?.level ?? 1;
      const enemyLevel = prev.enemy?.level ?? 1;
      const xp = calcBattleXp(playerLevel, enemyLevel, winner === 'player');
      const next = winner === 'player' ? 'victory' as const : 'defeat' as const;
      setScreen(next);
      return { ...prev, screen: next, pendingXp: xp };
    });
  }, []);

  const handleResultContinue = useCallback(() => {
    if (!gameState.player) return;
    const updated = applyXp(gameState.player, gameState.pendingXp);
    autoSave(updated);
    if (updated.statPoints > 0 || updated.skillPoints > 0) {
      setScreen('level-up');
      setGameState(prev => ({ ...prev, screen: 'level-up', player: updated }));
    } else {
      const resetPlayer: Character = {
        ...updated,
        stats: { ...updated.stats, health: updated.stats.maxHealth, energy: updated.stats.maxEnergy },
        abilities: updated.abilities.map(a => ({ ...a, currentCooldown: 0 })),
        rage: 0, isDefending: false, statusEffects: [],
      };
      const newEnemy = createEnemy(resetPlayer.level);
      setScreen('battle');
      setGameState(prev => ({ ...prev, screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 }));
    }
  }, [gameState.player, gameState.pendingXp, autoSave]);

  const handleLevelUpComplete = useCallback((updatedPlayer: Character) => {
    autoSave(updatedPlayer);
    const newEnemy = createEnemy(updatedPlayer.level);
    const resetPlayer: Character = {
      ...updatedPlayer,
      stats: { ...updatedPlayer.stats, health: updatedPlayer.stats.maxHealth, energy: updatedPlayer.stats.maxEnergy },
      abilities: updatedPlayer.abilities.map(a => ({ ...a, currentCooldown: 0 })),
      rage: 0, isDefending: false, statusEffects: [],
    };
    setScreen('battle');
    setGameState(prev => ({ ...prev, screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 }));
  }, [autoSave]);

  const handlePlayAgain = useCallback(() => {
    if (!gameState.player) return;
    const updated = applyXp(gameState.player, gameState.pendingXp);
    autoSave(updated);
    const resetPlayer: Character = {
      ...updated,
      stats: { ...updated.stats, health: updated.stats.maxHealth, energy: updated.stats.maxEnergy },
      abilities: updated.abilities.map(a => ({ ...a, currentCooldown: 0 })),
      rage: 0, isDefending: false, statusEffects: [],
    };
    if (updated.statPoints > 0 || updated.skillPoints > 0) {
      setScreen('level-up');
      setGameState(prev => ({ ...prev, screen: 'level-up', player: updated, pendingXp: gameState.pendingXp }));
    } else {
      const newEnemy = createEnemy(resetPlayer.level);
      setScreen('battle');
      setGameState(prev => ({ ...prev, screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 }));
    }
  }, [gameState.player, gameState.pendingXp, autoSave]);

  const playerLevel = gameState.player?.level ?? 0;

  return (
    <div className="min-h-screen">
      {screen === 'title' && (
        <TitleScreen
          onStart={handleStart}
          onContinue={saveData ? handleContinue : undefined}
          onPvp={ready ? handlePvp : undefined}
          saveData={saveData}
        />
      )}
      {screen === 'character-select' && (
        <CharacterSelect
          onSelect={handleCharacterSelect}
          onBack={handleBackToTitle}
          playerLevel={playerLevel}
          unlockedPremiumClasses={gameState.unlockedPremiumClasses}
        />
      )}
      {screen === 'battle' && gameState.player && gameState.enemy && (
        <BattleArena player={gameState.player} enemy={gameState.enemy} onBattleEnd={handleBattleEnd} />
      )}
      {(screen === 'victory' || screen === 'defeat') && gameState.player && (
        <ResultScreen
          isVictory={screen === 'victory'}
          playerName={gameState.player.name}
          xpGained={gameState.pendingXp}
          onPlayAgain={handlePlayAgain}
          onMainMenu={handleBackToTitle}
          onContinue={handleResultContinue}
        />
      )}
      {screen === 'level-up' && gameState.player && (
        <LevelUpScreen
          player={gameState.player}
          xpGained={gameState.pendingXp}
          onComplete={handleLevelUpComplete}
        />
      )}
      {screen === 'pvp-queue' && pvpCharacterId && (
        <MatchmakingScreen
          characterId={pvpCharacterId}
          onMatched={handleMatched}
          onCancel={handleBackToTitle}
        />
      )}
      {screen === 'pvp-battle' && pvpBattleId && user && (
        <PvpBattleScreen
          battleId={pvpBattleId}
          myUserId={user.id}
          onExit={handleBackToTitle}
        />
      )}
    </div>
  );
};

export default Index;
