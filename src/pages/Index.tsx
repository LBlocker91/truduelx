import { useState, useCallback } from 'react';
import { GameState, CharacterClass, Character } from '@/types/game';
import { createCharacter, createEnemy } from '@/data/characters';
import { calcBattleXp, applyXp } from '@/lib/leveling';
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

  const handleStart = useCallback(() => {
    setGameState(prev => ({ ...prev, screen: 'character-select' }));
  }, []);

  const handleBackToTitle = useCallback(() => {
    setGameState(prev => ({ ...INITIAL_STATE, unlockedPremiumClasses: prev.unlockedPremiumClasses, player: prev.player }));
  }, []);

  const handleCharacterSelect = useCallback((characterClass: CharacterClass, name: string) => {
    const player = createCharacter(characterClass, name, 'player');
    const enemy = createEnemy(player.level);
    setGameState(prev => ({ ...prev, screen: 'battle', player, enemy, battleState: null, pendingXp: 0 }));
  }, []);

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

    if (updated.statPoints > 0) {
      setGameState(prev => ({ ...prev, screen: 'level-up', player: updated }));
    } else {
      setGameState(prev => ({ ...prev, screen: 'title', player: updated }));
    }
  }, [gameState.player, gameState.pendingXp]);

  const handleLevelUpComplete = useCallback((updatedPlayer: Character) => {
    setGameState(prev => ({ ...prev, player: updatedPlayer }));
    const newEnemy = createEnemy(updatedPlayer.level);
    const resetPlayer: Character = {
      ...updatedPlayer,
      stats: {
        ...updatedPlayer.stats,
        health: updatedPlayer.stats.maxHealth,
        energy: updatedPlayer.stats.maxEnergy,
      },
      abilities: updatedPlayer.abilities.map(a => ({ ...a, currentCooldown: 0 })),
      rage: 0,
      isDefending: false,
      statusEffects: [],
    };
    setGameState(prev => ({ ...prev, screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 }));
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (!gameState.player) return;
    // Apply pending XP before starting a new battle
    const updated = applyXp(gameState.player, gameState.pendingXp);
    const resetPlayer: Character = {
      ...updated,
      stats: {
        ...updated.stats,
        health: updated.stats.maxHealth,
        energy: updated.stats.maxEnergy,
      },
      abilities: updated.abilities.map(a => ({ ...a, currentCooldown: 0 })),
      rage: 0,
      isDefending: false,
      statusEffects: [],
    };
    const newEnemy = createEnemy(resetPlayer.level);
    // If leveled up with stat points, go to level-up screen first
    if (updated.statPoints > 0 && updated.level > gameState.player.level) {
      setGameState(prev => ({ ...prev, screen: 'level-up', player: updated, pendingXp: gameState.pendingXp }));
    } else {
      setGameState(prev => ({ ...prev, screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 }));
    }
  }, [gameState.player, gameState.pendingXp]);

  const playerLevel = gameState.player?.level ?? 0;

  return (
    <div className="min-h-screen">
      {gameState.screen === 'title' && (
        <TitleScreen onStart={handleStart} />
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
