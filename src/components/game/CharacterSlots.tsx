import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Crown, Lock, Trash2, Play, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import {
  CharacterSummary, listMyCharacters, getMaxSlots,
  deleteCharacter, migrateLegacySaveIfAny, setLastPlayed,
} from '@/lib/characters-db';
import { useAuth } from '@/hooks/useAuth';
import { CLASS_META } from '@/data/class-definitions';
import battleArenaBg from '@/assets/battle-arena-bg.jpg';

interface CharacterSlotsProps {
  onPlay: (characterId: string) => void;
  onCreateNew: () => void;
}

export const CharacterSlots = ({ onPlay, onCreateNew }: CharacterSlotsProps) => {
  const { signOut } = useAuth();
  const [chars, setChars] = useState<CharacterSummary[]>([]);
  const [maxSlots, setMaxSlots] = useState(3);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<CharacterSummary | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      // Migrate any legacy localStorage save first (no-op if already migrated)
      await migrateLegacySaveIfAny();
      const [list, slots] = await Promise.all([listMyCharacters(), getMaxSlots()]);
      setChars(list);
      setMaxSlots(slots);
    } catch (e: any) {
      toast.error(`Couldn't load characters: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handlePlay = (c: CharacterSummary) => {
    setLastPlayed(c.id);
    onPlay(c.id);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteCharacter(confirmDelete.id);
      toast.success('Character deleted');
      setConfirmDelete(null);
      await refresh();
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message ?? e}`);
    }
  };

  const usedSlots = chars.length;
  const freeSlots = Math.max(0, 3 - usedSlots);
  const premiumSlots = Math.max(0, maxSlots - 3);
  const slotsArr = Array.from({ length: 9 }, (_, i) => i);

  return (
    <main
      className="relative min-h-screen flex flex-col"
      style={{ backgroundImage: `url(${battleArenaBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/95" />

      <div className="relative z-10 flex-1 flex flex-col p-4 max-w-6xl mx-auto w-full">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-glow-cyan">CHARACTER SELECT</h1>
            <p className="text-xs text-muted-foreground">
              {usedSlots} / {maxSlots} slots used {maxSlots === 3 && '(upgrade to Premium for 9)'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="w-4 h-4 mr-1" /> Sign out
          </Button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slotsArr.map((i) => {
              const c = chars[i];
              const isPremiumSlot = i >= 3;
              const unlocked = i < maxSlots;
              if (c) return <FilledSlot key={i} c={c} onPlay={handlePlay} onDelete={setConfirmDelete} />;
              if (!unlocked) return <PremiumLockedSlot key={i} index={i} />;
              return (
                <EmptySlot key={i} isPremiumSlot={isPremiumSlot} onCreate={onCreateNew} />
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this character, their inventory, and all progress.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

const FilledSlot = ({
  c, onPlay, onDelete,
}: {
  c: CharacterSummary;
  onPlay: (c: CharacterSummary) => void;
  onDelete: (c: CharacterSummary) => void;
}) => {
  const meta = CLASS_META[c.class];
  return (
    <div className="game-card rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`font-orbitron text-lg font-bold truncate ${meta?.color ?? ''}`}>{c.name}</h3>
          <p className="text-xs text-muted-foreground capitalize">
            Lv {c.level} · {meta?.name ?? c.class}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(c)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>XP: {c.xp.toLocaleString()}</div>
        <div>Credits: {(c.credits ?? 0).toLocaleString()}</div>
        <div className="truncate">Last zone: {c.current_zone_id ?? 'station-hub'}</div>
      </div>
      <Button onClick={() => onPlay(c)} className="btn-neon text-primary-foreground mt-auto">
        <Play className="w-4 h-4 mr-1" /> Play
      </Button>
    </div>
  );
};

const EmptySlot = ({ isPremiumSlot, onCreate }: { isPremiumSlot: boolean; onCreate: () => void }) => (
  <button
    onClick={onCreate}
    className="game-card game-card-hover rounded-xl p-4 flex flex-col items-center justify-center gap-2 min-h-[180px] border-dashed text-muted-foreground hover:text-foreground"
  >
    <Plus className="w-8 h-8" />
    <span className="font-orbitron text-sm">Create Character</span>
    {isPremiumSlot && (
      <span className="text-[10px] text-shield font-orbitron flex items-center gap-1">
        <Crown className="w-3 h-3" /> Premium slot
      </span>
    )}
  </button>
);

const PremiumLockedSlot = ({ index }: { index: number }) => (
  <div className="game-card rounded-xl p-4 flex flex-col items-center justify-center gap-2 min-h-[180px] opacity-70 relative">
    <Lock className="w-8 h-8 text-shield" />
    <span className="font-orbitron text-sm text-shield">Slot {index + 1} Locked</span>
    <p className="text-[11px] text-muted-foreground text-center px-2">
      Premium subscription unlocks slots 4–9 (up to 9 total characters)
    </p>
    <Button size="sm" variant="outline" disabled className="text-xs">
      <Crown className="w-3 h-3 mr-1" /> Upgrade (coming soon)
    </Button>
  </div>
);
