import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CharacterClass } from '@/types/game';
import { characterTemplates } from '@/data/characters';
import { ArrowLeft, Shield, Wand2, Crosshair, Heart, Zap, Sword, Brain, Cpu, Users } from 'lucide-react';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';

interface CharacterSelectProps {
  onSelect: (characterClass: CharacterClass, name: string) => void;
  onBack: () => void;
}

const classInfo: Record<CharacterClass, { name: string; icon: React.ReactNode; description: string; color: string }> = {
  warrior: {
    name: 'WARRIOR',
    icon: <Shield className="w-8 h-8" />,
    description: 'High defense and health. Excels in close combat with devastating melee attacks.',
    color: 'text-primary',
  },
  mage: {
    name: 'MAGE',
    icon: <Wand2 className="w-8 h-8" />,
    description: 'Master of arcane arts. High magical damage but lower defense.',
    color: 'text-neon-purple',
  },
  hunter: {
    name: 'HUNTER',
    icon: <Crosshair className="w-8 h-8" />,
    description: 'Agile ranged specialist. Balanced stats with high speed and precision.',
    color: 'text-secondary',
  },
};

export const CharacterSelect = ({ onSelect, onBack }: CharacterSelectProps) => {
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [playerName, setPlayerName] = useState('');

  const handleConfirm = () => {
    if (selectedClass && playerName.trim()) {
      onSelect(selectedClass, playerName.trim());
    }
  };

  return (
    <div 
      className="relative min-h-screen flex flex-col"
      style={{
        backgroundImage: `url(${battleArenaBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/90" />
      
      <div className="relative z-10 flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="font-orbitron text-3xl font-bold text-glow-cyan">
            SELECT YOUR CLASS
          </h1>
        </div>

        {/* Name Input */}
        <div className="mb-8 max-w-md">
          <label className="font-orbitron text-sm text-muted-foreground mb-2 block">
            ENTER YOUR NAME
          </label>
          <Input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Commander..."
            className="bg-muted/50 border-border text-foreground font-rajdhani text-lg"
            maxLength={20}
          />
        </div>

        {/* Character Cards */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {(Object.keys(characterTemplates) as CharacterClass[]).map((classType) => {
            const info = classInfo[classType];
            const template = characterTemplates[classType];
            const isSelected = selectedClass === classType;

            return (
              <button
                key={classType}
                onClick={() => setSelectedClass(classType)}
                className={`game-card game-card-hover p-6 rounded-xl text-left transition-all duration-300 ${
                  isSelected ? 'ring-2 ring-primary glow-cyan scale-105' : ''
                }`}
              >
                {/* Class Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`${info.color}`}>
                    {info.icon}
                  </div>
                  <h2 className={`font-orbitron text-xl font-bold ${info.color}`}>
                    {info.name}
                  </h2>
                </div>

                {/* Character Image */}
                <div className="relative h-48 mb-4 rounded-lg overflow-hidden bg-muted/30">
                  <img
                    src={template.image}
                    alt={info.name}
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                </div>

                {/* Description */}
                <p className="text-muted-foreground text-sm mb-4 font-rajdhani">
                  {info.description}
                </p>

                {/* Stats */}
                <div className="space-y-2">
                  <StatBar 
                    icon={<Heart className="w-4 h-4 text-health" />}
                    label="HP"
                    value={template.stats.health}
                    max={120}
                    color="health-bar"
                  />
                  <StatBar 
                    icon={<Zap className="w-4 h-4 text-energy" />}
                    label="EP"
                    value={template.stats.energy}
                    max={120}
                    color="energy-bar"
                  />
                  <StatBar 
                    icon={<Sword className="w-4 h-4 text-secondary" />}
                    label="STR"
                    value={template.stats.strength}
                    max={15}
                    color="bg-secondary"
                  />
                  <StatBar 
                    icon={<Brain className="w-4 h-4 text-primary" />}
                    label="DEX"
                    value={template.stats.dexterity}
                    max={15}
                    color="bg-primary"
                  />
                  <StatBar 
                    icon={<Cpu className="w-4 h-4 text-neon-purple" />}
                    label="TECH"
                    value={template.stats.technology}
                    max={15}
                    color="bg-neon-purple"
                  />
                  <StatBar 
                    icon={<Users className="w-4 h-4 text-neon-green" />}
                    label="SUP"
                    value={template.stats.support}
                    max={15}
                    color="bg-neon-green"
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Confirm Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleConfirm}
            disabled={!selectedClass || !playerName.trim()}
            className="btn-fire text-xl px-12 py-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-secondary-foreground"
            size="lg"
          >
            ENTER BATTLE
          </Button>
        </div>
      </div>
    </div>
  );
};

interface StatBarProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  color: string;
}

const StatBar = ({ icon, label, value, max, color }: StatBarProps) => {
  const percentage = (value / max) * 100;
  
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="font-orbitron text-xs text-muted-foreground w-12">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="font-orbitron text-xs text-foreground w-8">{value}</span>
    </div>
  );
};
