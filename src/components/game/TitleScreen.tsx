import { Button } from '@/components/ui/button';
import { Swords, Zap, Save } from 'lucide-react';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';
import { SaveData } from '@/lib/save-game';

interface TitleScreenProps {
  onStart: () => void;
  onContinue?: () => void;
  onPvp?: () => void;
  saveData?: SaveData | null;
}

export const TitleScreen = ({ onStart, onContinue, onPvp, saveData }: TitleScreenProps) => {
  return (
    <div 
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `url(${battleArenaBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80" />
      
      {/* Starfield effect */}
      <div className="absolute inset-0 starfield opacity-60" />
      
      {/* Content */}
      <div className="relative z-10 text-center space-y-8 animate-slide-up">
        {/* Logo */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Zap className="w-12 h-12 text-primary animate-pulse-glow" />
            <Swords className="w-16 h-16 text-secondary animate-float" />
            <Zap className="w-12 h-12 text-primary animate-pulse-glow" />
          </div>
          <h1 className="font-orbitron text-6xl md:text-8xl font-black tracking-wider">
            <span className="text-primary text-glow-cyan">COSMIC</span>
          </h1>
          <h1 className="font-orbitron text-5xl md:text-7xl font-black tracking-wider">
            <span className="text-secondary text-glow-orange">DUEL</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl font-rajdhani tracking-wide mt-4">
            Battle across the galaxy in epic PvP combat
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-3 pt-8">
          {saveData && onContinue && (
            <div>
              <Button
                onClick={onContinue}
                className="btn-neon text-xl px-12 py-6 rounded-lg text-primary-foreground w-full max-w-xs"
                size="lg"
              >
                <Save className="w-5 h-5 mr-2" />
                CONTINUE
              </Button>
              <p className="text-muted-foreground text-xs mt-1 font-rajdhani">
                {saveData.player.name} — Lv {saveData.player.level} {saveData.player.class}
              </p>
            </div>
          )}
          <Button
            onClick={onStart}
            className={`text-xl px-12 py-6 rounded-lg ${saveData ? 'bg-muted/60 hover:bg-muted text-foreground' : 'btn-neon text-primary-foreground'}`}
            size="lg"
            variant={saveData ? 'outline' : 'default'}
          >
            {saveData ? 'NEW GAME' : 'PLAY NOW (PvE)'}
          </Button>

          {onPvp && saveData && (
            <Button
              onClick={onPvp}
              size="lg"
              variant="secondary"
              className="text-xl px-12 py-6 rounded-lg w-full max-w-xs"
            >
              <Swords className="w-5 h-5 mr-2" />
              RANKED PvP
            </Button>
          )}
          
          <p className="text-muted-foreground text-sm">
            Choose your class • Master your abilities • Dominate the arena
          </p>
        </div>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-8 pt-8 max-w-2xl">
          {[
            { label: '3 CLASSES', desc: 'Warrior • Mage • Hunter' },
            { label: 'TURN-BASED', desc: 'Strategic Combat' },
            { label: 'ABILITIES', desc: 'Unique Skills' },
          ].map((feature) => (
            <div key={feature.label} className="text-center">
              <p className="font-orbitron text-primary text-sm font-bold">{feature.label}</p>
              <p className="text-muted-foreground text-xs">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Version */}
      <div className="absolute bottom-4 left-4 text-muted-foreground/50 text-xs font-orbitron">
        v1.0.0 ALPHA
      </div>
    </div>
  );
};
