import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CharacterClass } from '@/types/game';
import { characterTemplates } from '@/data/characters';
import { CLASS_META, FREE_CLASSES, LEVEL_UNLOCK_CLASSES, PREMIUM_CLASSES } from '@/data/class-definitions';
import {
  ArrowLeft, Shield, Wand2, Crosshair, Heart, Zap, Sword, Brain, Cpu, Users,
  Lock, Crown, Swords,
} from 'lucide-react';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';

interface CharacterSelectProps {
  onSelect: (characterClass: CharacterClass, name: string) => void;
  onBack: () => void;
  playerLevel: number;
  unlockedPremiumClasses: CharacterClass[];
}

const classIcons: Record<CharacterClass, React.ReactNode> = {
  mercenary: <Sword className="w-6 h-6" />,
  'tech-mage': <Wand2 className="w-6 h-6" />,
  gunner: <Crosshair className="w-6 h-6" />,
  blademaster: <Swords className="w-6 h-6" />,
  'tech-sentinel': <Shield className="w-6 h-6" />,
  tactician: <Users className="w-6 h-6" />,
  'shadow-operative': <Crosshair className="w-6 h-6" />,
  demolisher: <Zap className="w-6 h-6" />,
  'cyber-warden': <Cpu className="w-6 h-6" />,
};

export const CharacterSelect = ({ onSelect, onBack, playerLevel, unlockedPremiumClasses }: CharacterSelectProps) => {
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [playerName, setPlayerName] = useState('');

  const isClassAvailable = (cls: CharacterClass): boolean => {
    const meta = CLASS_META[cls];
    if (meta.unlockType === 'free') return true;
    if (meta.unlockType === 'level') return playerLevel >= (meta.unlockLevel ?? 30);
    if (meta.unlockType === 'premium') return (unlockedPremiumClasses ?? []).includes(cls);
    return false;
  };

  const handleConfirm = () => {
    if (selectedClass && playerName.trim() && isClassAvailable(selectedClass)) {
      onSelect(selectedClass, playerName.trim());
    }
  };

  const renderClassCard = (classType: CharacterClass) => {
    const meta = CLASS_META[classType];
    const template = characterTemplates[classType];
    const isSelected = selectedClass === classType;
    const available = isClassAvailable(classType);

    return (
      <button
        key={classType}
        onClick={() => available && setSelectedClass(classType)}
        className={`game-card p-3 rounded-xl text-left transition-all duration-300 relative overflow-hidden ${
          available ? 'game-card-hover cursor-pointer' : 'opacity-60 cursor-not-allowed'
        } ${isSelected ? 'ring-2 ring-primary glow-cyan scale-[1.03]' : ''}`}
      >
        {/* Lock overlay */}
        {!available && (
          <div className="absolute inset-0 z-10 bg-background/60 flex items-center justify-center rounded-xl">
            <div className="text-center">
              {meta.unlockType === 'level' ? (
                <>
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                  <span className="font-orbitron text-xs text-muted-foreground">LVL {meta.unlockLevel}</span>
                </>
              ) : (
                <>
                  <Crown className="w-8 h-8 text-shield mx-auto mb-1" />
                  <span className="font-orbitron text-xs text-shield">PREMIUM</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Class Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className={meta.color}>{classIcons[classType]}</div>
          <div className="min-w-0">
            <h3 className={`font-orbitron text-sm font-bold ${meta.color} truncate`}>{meta.name}</h3>
            <p className="text-[10px] text-muted-foreground font-rajdhani">{meta.playstyle}</p>
          </div>
        </div>

        {/* Character Image */}
        <div className="relative h-28 mb-2 rounded-lg overflow-hidden bg-muted/30">
          <img src={template.image} alt={meta.name} className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          <div className="absolute bottom-1 left-1.5 right-1.5">
            <span className="font-orbitron text-[9px] text-muted-foreground">{meta.primaryStats}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-muted-foreground text-xs mb-2 font-rajdhani line-clamp-2 leading-tight">
          {meta.description}
        </p>

        {/* Compact Stats */}
        <div className="grid grid-cols-2 gap-1">
          <MiniStat icon={<Heart className="w-3 h-3 text-health" />} label="HP" value={template.stats.health} />
          <MiniStat icon={<Zap className="w-3 h-3 text-energy" />} label="EP" value={template.stats.energy} />
          <MiniStat icon={<Sword className="w-3 h-3 text-secondary" />} label="STR" value={template.stats.strength} />
          <MiniStat icon={<Brain className="w-3 h-3 text-primary" />} label="DEX" value={template.stats.dexterity} />
          <MiniStat icon={<Cpu className="w-3 h-3 text-neon-purple" />} label="TCH" value={template.stats.technology} />
          <MiniStat icon={<Users className="w-3 h-3 text-neon-green" />} label="SUP" value={template.stats.support} />
        </div>
      </button>
    );
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
      <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/90" />

      <div className="relative z-10 flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-orbitron text-2xl font-bold text-glow-cyan">SELECT YOUR CLASS</h1>
        </div>

        {/* Name Input */}
        <div className="mb-4 max-w-sm">
          <label className="font-orbitron text-xs text-muted-foreground mb-1 block">ENTER YOUR NAME</label>
          <Input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Commander..."
            className="bg-muted/50 border-border text-foreground font-rajdhani text-base"
            maxLength={20}
          />
        </div>

        {/* Class Sections */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {/* Free Classes */}
          <ClassSection title="STARTER CLASSES" subtitle="Available from Level 1" badgeColor="text-neon-green">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FREE_CLASSES.map(renderClassCard)}
            </div>
          </ClassSection>

          {/* Level 30 Unlock */}
          <ClassSection title="ADVANCED CLASSES" subtitle="Unlock at Level 30" badgeColor="text-primary">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {LEVEL_UNLOCK_CLASSES.map(renderClassCard)}
            </div>
          </ClassSection>

          {/* Premium */}
          <ClassSection title="PREMIUM CLASSES" subtitle="Premium Unlock" badgeColor="text-shield">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PREMIUM_CLASSES.map(renderClassCard)}
            </div>
          </ClassSection>
        </div>

        {/* Confirm Button */}
        <div className="flex justify-center py-2">
          <Button
            onClick={handleConfirm}
            disabled={!selectedClass || !playerName.trim() || (selectedClass ? !isClassAvailable(selectedClass) : true)}
            className="btn-fire text-lg px-10 py-5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-secondary-foreground"
            size="lg"
          >
            ENTER BATTLE
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- Sub-components ---

const ClassSection = ({ title, subtitle, badgeColor, children }: {
  title: string; subtitle: string; badgeColor: string; children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center gap-3 mb-2">
      <h2 className={`font-orbitron text-sm font-bold ${badgeColor}`}>{title}</h2>
      <span className="text-xs text-muted-foreground font-rajdhani">{subtitle}</span>
    </div>
    {children}
  </div>
);

const MiniStat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="flex items-center gap-1">
    {icon}
    <span className="font-orbitron text-[9px] text-muted-foreground w-6">{label}</span>
    <span className="font-orbitron text-[10px] text-foreground">{value}</span>
  </div>
);
