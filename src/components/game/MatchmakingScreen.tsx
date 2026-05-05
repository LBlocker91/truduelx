import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Swords, X } from 'lucide-react';
import { joinMatchmaking, leaveMatchmaking, pollMatchmaking } from '@/lib/cloud-pvp';

interface MatchmakingScreenProps {
  characterId: string;
  onMatched: (battleId: string) => void;
  onCancel: () => void;
}

export const MatchmakingScreen = ({ characterId, onMatched, onCancel }: MatchmakingScreenProps) => {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    (async () => {
      try {
        const res = await joinMatchmaking(characterId);
        if (cancelled) return;
        if (res.paired && res.battleId) {
          onMatched(res.battleId);
          return;
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Failed to join queue');
        return;
      }

      // Poll every 3s to attempt pairing
      const tick = async () => {
        try {
          const res = await pollMatchmaking();
          if (cancelled) return;
          if (res.paired && res.battleId) {
            onMatched(res.battleId);
            return;
          }
        } catch (e) {
          // ignore transient errors
        }
        timer = window.setTimeout(tick, 3000);
      };
      timer = window.setTimeout(tick, 3000);
    })();

    const counter = window.setInterval(() => setSeconds(s => s + 1), 1000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(counter);
      leaveMatchmaking().catch(() => {});
    };
  }, [characterId, onMatched]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="text-center space-y-6 max-w-md">
        <Swords className="w-16 h-16 text-primary mx-auto animate-pulse" />
        <h2 className="font-orbitron text-3xl text-primary">FINDING OPPONENT</h2>
        <p className="text-muted-foreground font-rajdhani">
          Scanning the galaxy for a worthy duelist…
        </p>
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="font-orbitron text-xl">{seconds}s</span>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button variant="outline" onClick={onCancel} className="mt-4">
          <X className="w-4 h-4 mr-2" /> Cancel
        </Button>
      </div>
    </div>
  );
};
