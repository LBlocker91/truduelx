import { Button } from '@/components/ui/button';
import { Swords, Trophy } from 'lucide-react';

interface PvpPanelProps {
  onJoinRanked: () => void;
}

export const PvpPanel = ({ onJoinRanked }: PvpPanelProps) => (
  <div className="space-y-4">
    <div className="game-card rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-5 h-5 text-secondary" />
        <h3 className="font-orbitron">Ranked PvP</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Queue against another live player of similar rating. Win to climb the ladder.
      </p>
      <Button onClick={onJoinRanked} className="w-full btn-fire text-secondary-foreground">
        <Swords className="w-4 h-4 mr-2" /> Enter Matchmaking
      </Button>
    </div>

    <div className="game-card rounded-lg p-4 opacity-70">
      <h3 className="font-orbitron text-sm">Battle History</h3>
      <p className="text-xs text-muted-foreground mt-1">Coming soon.</p>
    </div>
  </div>
);
