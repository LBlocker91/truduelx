import { useState, useCallback, useEffect } from 'react';
import { GameState, CharacterClass, Character } from '@/types/game';
import { createCharacter, createEnemy } from '@/data/characters';
import { calcBattleXp, applyXp } from '@/lib/leveling';
import { saveGame, loadGame, deleteSave, SaveData } from '@/lib/save-game';
import { TitleScreen } from '@/components/game/TitleScreen';
import { CharacterSelect } from '@/components/game/CharacterSelect';
import { BattleArena } from '@/components/game/BattleArena';
import { ResultScreen } from '@/components/game/ResultScreen';
import { LevelUpScreen } from '@/components/game/LevelUpScreen';

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
  const [saveData, setSaveData] = useState<SaveData | null>(null);

  // Load save on mount
  useEffect(() => {
    setSaveData(loadGame());
  }, []);

  // Auto-save helper
  const autoSave = useCallback((player: Character, premiumClasses?: CharacterClass[]) => {
    const classes = premiumClasses ?? gameState.unlockedPremiumClasses;
    saveGame(player, classes);
    setSaveData({ player, unlockedPremiumClasses: classes, savedAt: Date.now() });
  }, [gameState.unlockedPremiumClasses]);

  const handleStart = useCallback(() => {
    setGameState(prev => ({ ...prev, screen: 'character-select' }));
  }, []);

  const handleContinue = useCallback(() => {
    const saved = loadGame();
    if (!saved) return;
    const player = saved.player;
    // Reset combat state for a fresh battle
    const resetPlayer: Character = {
      ...player,
      stats: { ...player.stats, health: player.stats.maxHealth, energy: player.stats.maxEnergy },
      abilities: player.abilities.map(a => ({ ...a, currentCooldown: 0 })),
      rage: 0,
      isDefending: false,
      statusEffects: [],
    };
    const enemy = createEnemy(resetPlayer.level);
    setGameState(prev => ({
      ...prev,
      screen: 'battle',
      player: resetPlayer,
      enemy,
      battleState: null,
      pendingXp: 0,
      unlockedPremiumClasses: saved.unlockedPremiumClasses,
    }));
  }, []);

  const handleBackToTitle = useCallback(() => {
    setSaveData(loadGame());
    setGameState(prev => ({ ...INITIAL_STATE, unlockedPremiumClasses: prev.unlockedPremiumClasses, player: prev.player }));
  }, []);

  const handleCharacterSelect = useCallback((characterClass: CharacterClass, name: string) => {
    const player = createCharacter(characterClass, name, 'player');
    const enemy = createEnemy(player.level);
    // Save on character creation
    autoSave(player);
    setGameState(prev => ({ ...prev, screen: 'battle', player, enemy, battleState: null, pendingXp: 0 }));
  }, [autoSave]);

  const handleBattleEnd = useCallback((winner: 'player' | 'enemy') => {
    setGameState(prev => {
      const playerLevel = prev.player?.level ?? 1;
      const enemyLevel = prev.enemy?.level ?? 1;
      const xp = calcBattleXp(playerLevel, enemyLevel, winner === 'player');
      return {
        ...prev,
        screen: winner === 'player' ? 'victory' : 'defeat',
        pendingXp: xp,
      };
    });
  }, []);

  const handleResultContinue = useCallback(() => {
    if (!gameState.player) return;
    const updated = applyXp(gameState.player, gameState.pendingXp);

    // Auto-save after XP applied
    autoSave(updated);

    if (updated.statPoints > 0 || updated.skillPoints > 0) {
      setGameState(prev => ({ ...prev, screen: 'level-up', player: updated }));
    } else {
      const resetPlayer: Character = {
        ...updated,
        stats: { ...updated.stats, health: updated.stats.maxHealth, energy: updated.stats.maxEnergy },
        abilities: updated.abilities.map(a => ({ ...a, currentCooldown: 0 })),
        rage: 0,
        isDefending: false,
        statusEffects: [],
      };
      const newEnemy = createEnemy(resetPlayer.level);
      setGameState(prev => ({ ...prev, screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 }));
    }
  }, [gameState.player, gameState.pendingXp, autoSave]);

  const handleLevelUpComplete = useCallback((updatedPlayer: Character) => {
    // Auto-save after level up
    autoSave(updatedPlayer);

    const newEnemy = createEnemy(updatedPlayer.level);
    const resetPlayer: Character = {
      ...updatedPlayer,
      stats: { ...updatedPlayer.stats, health: updatedPlayer.stats.maxHealth, energy: updatedPlayer.stats.maxEnergy },
      abilities: updatedPlayer.abilities.map(a => ({ ...a, currentCooldown: 0 })),
      rage: 0,
      isDefending: false,
      statusEffects: [],
    };
    setGameState(prev => ({ ...prev, screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 }));
  }, [autoSave]);

  const handlePlayAgain = useCallback(() => {
    if (!gameState.player) return;
    const updated = applyXp(gameState.player, gameState.pendingXp);

    // Auto-save
    autoSave(updated);

    const resetPlayer: Character = {
      ...updated,
      stats: { ...updated.stats, health: updated.stats.maxHealth, energy: updated.stats.maxEnergy },
      abilities: updated.abilities.map(a => ({ ...a, currentCooldown: 0 })),
      rage: 0,
      isDefending: false,
      statusEffects: [],
    };
    if (updated.statPoints > 0 || updated.skillPoints > 0) {
      setGameState(prev => ({ ...prev, screen: 'level-up', player: updated, pendingXp: gameState.pendingXp }));
    } else {
      const newEnemy = createEnemy(resetPlayer.level);
      setGameState(prev => ({ ...prev, screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 }));
    }
  }, [gameState.player, gameState.pendingXp, autoSave]);

  const playerLevel = gameState.player?.level ?? 0;

  return (
    <div className="min-h-screen">
      {gameState.screen === 'title' && (
        <TitleScreen
          onStart={handleStart}
          onContinue={saveData ? handleContinue : undefined}
          saveData={saveData}
        />
      )}
      {gameState.screen === 'character-select' && (
        <CharacterSelect
          onSelect={handleCharacterSelect}
          onBack={handleBackToTitle}
          playerLevel={playerLevel}
          unlockedPremiumClasses={gameState.unlockedPremiumClasses}
        />
      )}
      {gameState.screen === 'battle' && gameState.player && gameState.enemy && (
        <BattleArena player={gameState.player} enemy={gameState.enemy} onBattleEnd={handleBattleEnd} />
      )}
      {(gameState.screen === 'victory' || gameState.screen === 'defeat') && gameState.player && (
        <ResultScreen
          isVictory={gameState.screen === 'victory'}
          playerName={gameState.player.name}
          xpGained={gameState.pendingXp}
          onPlayAgain={handlePlayAgain}
          onMainMenu={handleBackToTitle}
          onContinue={handleResultContinue}
        />
      )}
      {gameState.screen === 'level-up' && gameState.player && (
        <LevelUpScreen
          player={gameState.player}
          xpGained={gameState.pendingXp}
          onComplete={handleLevelUpComplete}
        />
      )}
    </div>
  );
};

export default Index;
