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
};

const Index = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);

  const handleStart = useCallback(() => {
    setGameState(prev => ({ ...prev, screen: 'character-select' }));
  }, []);

  const handleBackToTitle = useCallback(() => {
    setGameState(INITIAL_STATE);
  }, []);

  const handleCharacterSelect = useCallback((characterClass: CharacterClass, name: string) => {
    const player = createCharacter(characterClass, name, 'player');
    const enemy = createEnemy(player.level);
    setGameState({ screen: 'battle', player, enemy, battleState: null, pendingXp: 0 });
  }, []);

  const handleBattleEnd = useCallback((winner: 'player' | 'enemy') => {
    setGameState(prev => {
      const enemyLevel = prev.enemy?.level ?? 1;
      const xp = calcBattleXp(enemyLevel, winner === 'player');
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
    // Go straight to next battle
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
    setGameState({ screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 });
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (!gameState.player) return;
    const resetPlayer: Character = {
      ...gameState.player,
      stats: {
        ...gameState.player.stats,
        health: gameState.player.stats.maxHealth,
        energy: gameState.player.stats.maxEnergy,
      },
      abilities: gameState.player.abilities.map(a => ({ ...a, currentCooldown: 0 })),
      rage: 0,
      isDefending: false,
      statusEffects: [],
    };
    const newEnemy = createEnemy(gameState.player.level);
    setGameState({ screen: 'battle', player: resetPlayer, enemy: newEnemy, battleState: null, pendingXp: 0 });
  }, [gameState.player]);

  return (
    <div className="min-h-screen">
      {gameState.screen === 'title' && (
        <TitleScreen onStart={handleStart} />
      )}
      {gameState.screen === 'character-select' && (
        <CharacterSelect onSelect={handleCharacterSelect} onBack={handleBackToTitle} />
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
