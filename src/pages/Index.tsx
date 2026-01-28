import { useState, useCallback } from 'react';
import { GameState, CharacterClass, Character } from '@/types/game';
import { createCharacter, createEnemy } from '@/data/characters';
import { TitleScreen } from '@/components/game/TitleScreen';
import { CharacterSelect } from '@/components/game/CharacterSelect';
import { BattleArena } from '@/components/game/BattleArena';
import { ResultScreen } from '@/components/game/ResultScreen';

const Index = () => {
  const [gameState, setGameState] = useState<GameState>({
    screen: 'title',
    player: null,
    enemy: null,
    battleState: null,
  });

  const handleStart = useCallback(() => {
    setGameState(prev => ({ ...prev, screen: 'character-select' }));
  }, []);

  const handleBackToTitle = useCallback(() => {
    setGameState({
      screen: 'title',
      player: null,
      enemy: null,
      battleState: null,
    });
  }, []);

  const handleCharacterSelect = useCallback((characterClass: CharacterClass, name: string) => {
    const player = createCharacter(characterClass, name, 'player');
    const enemy = createEnemy();
    
    setGameState({
      screen: 'battle',
      player,
      enemy,
      battleState: null,
    });
  }, []);

  const handleBattleEnd = useCallback((winner: 'player' | 'enemy') => {
    setGameState(prev => ({
      ...prev,
      screen: winner === 'player' ? 'victory' : 'defeat',
    }));
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (!gameState.player) return;
    
    // Reset player health and energy
    const resetPlayer: Character = {
      ...gameState.player,
      stats: {
        ...gameState.player.stats,
        health: gameState.player.stats.maxHealth,
        energy: gameState.player.stats.maxEnergy,
      },
      abilities: gameState.player.abilities.map(a => ({ ...a, currentCooldown: 0 })),
    };
    
    const newEnemy = createEnemy();
    
    setGameState({
      screen: 'battle',
      player: resetPlayer,
      enemy: newEnemy,
      battleState: null,
    });
  }, [gameState.player]);

  return (
    <div className="min-h-screen">
      {gameState.screen === 'title' && (
        <TitleScreen onStart={handleStart} />
      )}
      
      {gameState.screen === 'character-select' && (
        <CharacterSelect 
          onSelect={handleCharacterSelect} 
          onBack={handleBackToTitle} 
        />
      )}
      
      {gameState.screen === 'battle' && gameState.player && gameState.enemy && (
        <BattleArena 
          player={gameState.player} 
          enemy={gameState.enemy}
          onBattleEnd={handleBattleEnd}
        />
      )}
      
      {(gameState.screen === 'victory' || gameState.screen === 'defeat') && gameState.player && (
        <ResultScreen 
          isVictory={gameState.screen === 'victory'}
          playerName={gameState.player.name}
          onPlayAgain={handlePlayAgain}
          onMainMenu={handleBackToTitle}
        />
      )}
    </div>
  );
};

export default Index;
