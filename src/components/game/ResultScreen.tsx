import { Button } from '@/components/ui/button';
import { Trophy, Skull, RotateCcw, Home, Star, Coins, ArrowRight } from 'lucide-react';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';

interface ResultScreenProps {
  isVictory: boolean;
  playerName: string;
  xpGained: number;
  onPlayAgain: () => void;
  onMainMenu: () => void;
  onContinue: () => void;
}

export const ResultScreen = ({ isVictory, playerName, xpGained, onPlayAgain, onMainMenu, onContinue }: ResultScreenProps) => {
  const credits = isVictory ? Math.floor(Math.random() * 100) + 50 : 0;

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `url(${battleArenaBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background/80" />

      <div className="relative z-10 text-center space-y-8 animate-scale-in max-w-lg mx-4">
        {/* Result Icon */}
        <div className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center ${
          isVictory
            ? 'bg-gradient-to-br from-primary to-neon-green glow-cyan'
            : 'bg-gradient-to-br from-accent to-destructive glow-red'
        }`}>
          {isVictory
            ? <Trophy className="w-16 h-16 text-primary-foreground" />
            : <Skull className="w-16 h-16 text-foreground" />
          }
        </div>

        {/* Title */}
        <div>
          <h1 className={`font-orbitron text-5xl md:text-6xl font-black mb-2 ${
            isVictory ? 'text-primary text-glow-cyan' : 'text-accent'
          }`}>
            {isVictory ? 'VICTORY!' : 'DEFEAT'}
          </h1>
          <p className="text-muted-foreground text-lg font-rajdhani">
            {isVictory
              ? `Congratulations, ${playerName}! You dominated the arena!`
              : `${playerName}, you fought bravely but fell in battle.`
            }
          </p>
        </div>

        {/* Rewards */}
        <div className="game-card rounded-xl p-6 space-y-4">
          <h3 className="font-orbitron text-lg font-bold text-secondary">
            BATTLE REWARDS
          </h3>
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Star className="w-5 h-5 text-primary animate-pulse-glow" />
                <span className="font-orbitron text-2xl font-bold text-primary">
                  +{xpGained}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">EXPERIENCE</p>
            </div>
            {credits > 0 && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Coins className="w-5 h-5 text-shield animate-pulse-glow" />
                  <span className="font-orbitron text-2xl font-bold text-shield">
                    +{credits}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">CREDITS</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button
            onClick={onContinue}
            className="btn-neon text-lg px-8 py-5 rounded-lg text-primary-foreground"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            COLLECT XP
          </Button>
          <Button
            onClick={onPlayAgain}
            variant="outline"
            className="text-lg px-8 py-5 rounded-lg border-border hover:bg-muted"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            BATTLE AGAIN
          </Button>
          <Button
            onClick={onMainMenu}
            variant="outline"
            className="text-lg px-8 py-5 rounded-lg border-border hover:bg-muted"
          >
            <Home className="w-5 h-5 mr-2" />
            MAIN MENU
          </Button>
        </div>
      </div>
    </div>
  );
};
