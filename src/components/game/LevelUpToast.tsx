import { Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LevelUpInfo } from '@/pages/Index';

interface Props {
  info: LevelUpInfo;
  onClose: () => void;
}

export const LevelUpToast = ({ info, onClose }: Props) => {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-2 glow-cyan">
            <Star className="w-7 h-7 text-primary-foreground" />
          </div>
          <DialogTitle className="font-orbitron text-2xl text-primary text-glow-cyan">
            LEVEL {info.newLevel}!
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          You leveled up from <span className="text-foreground font-bold">{info.oldLevel}</span> →{' '}
          <span className="text-primary font-bold">{info.newLevel}</span>
        </p>
        <ul className="text-sm space-y-1 my-2 font-rajdhani">
          <li>+<span className="text-secondary font-bold">{info.statPointsGained}</span> stat points</li>
          <li>+<span className="text-accent font-bold">{info.skillPointsGained}</span> skill points</li>
          <li>+<span className="text-health font-bold">{info.maxHpGained}</span> max HP</li>
        </ul>
        <p className="text-xs text-muted-foreground mb-2">
          Open Profile to spend stat points, or Skills to unlock class abilities.
        </p>
        <Button className="w-full btn-neon" onClick={onClose}>
          <X className="w-4 h-4 mr-1" /> Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
};
