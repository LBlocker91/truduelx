import { useEffect, useMemo, useState } from 'react';
import { Loader2, Heart, Zap, Sword, Brain, Cpu, Users, Award, Coins, Crown, Plus, Shield, ShieldCheck, Gem, RotateCcw, Save, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { allocateStatPoints, resetStats, type SpendableStat } from '@/lib/overworld';
import { CLASS_META } from '@/data/class-definitions';
import type { LevelUpInfo } from '@/pages/Index';

interface ProfilePanelProps {
  characterId: string;
  refreshTick?: number;
  onProgressionChange?: (level?: LevelUpInfo | null) => void;
}

interface CharRow {
  id: string;
  name: string;
  class: string;
  level: number;
  xp: number;
  credits: number;
  vibranium: number;
  stat_points: number;
  skill_points: number;
  strength: number;
  dexterity: number;
  technology: number;
  support: number;
  defense: number;
  resistance: number;
  bonus_max_hp: number;
  bonus_max_mp: number;
  equipped_weapon_id: string | null;
  equipped_armor_id: string | null;
}

interface EquippedItem {
  name: string;
  rarity: string;
  slot: string;
  min_damage: number | null;
  max_damage: number | null;
  defense: number;
}

type DraftKey = SpendableStat;
const EMPTY_DRAFT: Record<DraftKey, number> = {
  strength: 0, dexterity: 0, technology: 0, support: 0,
  defense: 0, resistance: 0, max_hp: 0, max_energy: 0,
};

export const ProfilePanel = ({ characterId, refreshTick, onProgressionChange }: ProfilePanelProps) => {
  const [c, setC] = useState<CharRow | null>(null);
  const [equipped, setEquipped] = useState<EquippedItem[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<DraftKey, number>>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: charRow } = await supabase.from('characters').select('*').eq('id', characterId).maybeSingle();
      if (!charRow) return;
      setC(charRow as any);
      setDraft(EMPTY_DRAFT);

      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        const { data: prof } = await supabase.from('profiles').select('is_premium').eq('user_id', u.user.id).maybeSingle();
        setIsPremium(!!prof?.is_premium);
      }

      const ids = [charRow.equipped_weapon_id, charRow.equipped_armor_id].filter(Boolean) as string[];
      if (ids.length) {
        const { data: items } = await supabase
          .from('items')
          .select('name, rarity, slot, min_damage, max_damage, defense')
          .in('id', ids);
        setEquipped((items ?? []) as EquippedItem[]);
      } else {
        setEquipped([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [characterId, refreshTick]);

  const draftTotal = useMemo(() => Object.values(draft).reduce((a, b) => a + b, 0), [draft]);
  const remainingPoints = (c?.stat_points ?? 0) - draftTotal;
  const dirty = draftTotal > 0;

  const bumpDraft = (k: DraftKey) => {
    if (!c || remainingPoints <= 0) return;
    setDraft(d => ({ ...d, [k]: d[k] + 1 }));
  };

  const cancelDraft = () => setDraft(EMPTY_DRAFT);

  const saveDraft = async () => {
    if (!c || !dirty || saving) return;
    setSaving(true);
    try {
      const r = await allocateStatPoints(characterId, draft);
      setC(r.character as any);
      setDraft(EMPTY_DRAFT);
      onProgressionChange?.(null);
      toast.success(`Allocated ${draftTotal} stat point${draftTotal === 1 ? '' : 's'}`);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    if (!c || resetting) return;
    setResetting(true);
    try {
      const r = await resetStats(characterId);
      setC(r.character as any);
      setDraft(EMPTY_DRAFT);
      onProgressionChange?.(null);
      toast.success(`Stats reset — refunded ${r.refunded} points`);
      setResetOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setResetting(false);
    }
  };

  if (loading || !c) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const meta = (CLASS_META as any)[c.class];
  // Effective values include pending draft.
  const effStr = c.strength + draft.strength;
  const effDex = c.dexterity + draft.dexterity;
  const effTech = c.technology + draft.technology;
  const effSup = c.support + draft.support;
  const effDef = c.defense + draft.defense;
  const effRes = c.resistance + draft.resistance;
  const effBonusHp = (c.bonus_max_hp ?? 0) + draft.max_hp * 5;
  const effBonusMp = (c.bonus_max_mp ?? 0) + draft.max_energy * 3;

  const maxHp = Math.floor(100 + effStr * 8 + c.level * 12) + effBonusHp;
  const maxMp = 100 + effTech * 2 + effBonusMp;
  const canSpend = remainingPoints > 0;

  return (
    <div className="space-y-4">
      <div className="game-card rounded-lg p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className={`font-orbitron text-xl font-bold ${meta?.color ?? ''}`}>{c.name}</h2>
            <p className="text-sm text-muted-foreground capitalize">Lv {c.level} {meta?.name ?? c.class}</p>
          </div>
          {isPremium && (
            <Badge variant="outline" className="text-shield border-shield/50">
              <Crown className="w-3 h-3 mr-1" /> Premium
            </Badge>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>XP</span><span>{c.xp.toLocaleString()}</span>
          </div>
          <Progress value={Math.min(100, (c.xp / Math.max(1, c.xp + 100)) * 100)} className="h-2" />
        </div>

        {(remainingPoints > 0 || c.skill_points > 0 || dirty) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {remainingPoints > 0 && (
              <Badge className="bg-secondary/80"><Award className="w-3 h-3 mr-1" /> {remainingPoints} stat pts</Badge>
            )}
            {dirty && (
              <Badge variant="outline" className="border-secondary/60 text-secondary">Pending: {draftTotal}</Badge>
            )}
            {c.skill_points > 0 && (
              <Badge className="bg-primary/80"><Award className="w-3 h-3 mr-1" /> {c.skill_points} skill pts</Badge>
            )}
          </div>
        )}
      </div>

      {dirty && (
        <div className="game-card rounded-lg p-3 flex items-center justify-between border-secondary/40">
          <span className="text-xs text-muted-foreground">
            {draftTotal} pending allocation{draftTotal === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancelDraft} disabled={saving}>
              <X className="w-3 h-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={saveDraft} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}

      <div className="game-card rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2 flex items-center justify-between">
          <span>VITALS</span>
          {canSpend && <span className="text-[10px] text-secondary">Tap + to spend</span>}
        </h3>
        <BarSpend
          icon={<Heart className="w-4 h-4 text-health" />} label="Max HP" value={maxHp} max={maxHp} color="bg-health"
          plusLabel="+5" onPlus={() => bumpDraft('max_hp')} disabled={!canSpend}
          pending={draft.max_hp}
        />
        <BarSpend
          icon={<Zap className="w-4 h-4 text-energy" />} label="Max MP" value={maxMp} max={maxMp} color="bg-energy"
          plusLabel="+3" onPlus={() => bumpDraft('max_energy')} disabled={!canSpend}
          pending={draft.max_energy}
        />
      </div>

      <div className="game-card rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2 flex items-center justify-between">
          <span>ATTRIBUTES</span>
          {canSpend && <span className="text-[10px] text-secondary">Tap + to spend</span>}
        </h3>
        <div className="grid grid-cols-1 gap-2">
          <Stat icon={<Sword className="w-4 h-4 text-secondary" />} label="Strength" value={effStr}
                pending={draft.strength} onPlus={() => bumpDraft('strength')} disabled={!canSpend} />
          <Stat icon={<Brain className="w-4 h-4 text-primary" />} label="Dexterity" value={effDex}
                pending={draft.dexterity} onPlus={() => bumpDraft('dexterity')} disabled={!canSpend} />
          <Stat icon={<Cpu className="w-4 h-4 text-neon-purple" />} label="Tech" value={effTech}
                pending={draft.technology} onPlus={() => bumpDraft('technology')} disabled={!canSpend} />
          <Stat icon={<Users className="w-4 h-4 text-neon-green" />} label="Support" value={effSup}
                pending={draft.support} onPlus={() => bumpDraft('support')} disabled={!canSpend} />
          <Stat icon={<Shield className="w-4 h-4 text-shield" />} label="Defense" value={effDef}
                pending={draft.defense} onPlus={() => bumpDraft('defense')} disabled={!canSpend}
                hint="Reduces physical damage" />
          <Stat icon={<ShieldCheck className="w-4 h-4 text-energy" />} label="Resistance" value={effRes}
                pending={draft.resistance} onPlus={() => bumpDraft('resistance')} disabled={!canSpend}
                hint="Reduces energy damage" />
        </div>
      </div>

      <div className="game-card rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2">EQUIPPED</h3>
        {equipped.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing equipped. Open Inventory to equip gear.</p>
        ) : (
          <ul className="space-y-1.5">
            {equipped.map((it) => (
              <li key={it.slot} className="flex items-center justify-between text-sm">
                <span className="font-rajdhani"><span className="text-muted-foreground capitalize text-xs mr-2">{it.slot}</span>{it.name}</span>
                <span className="text-xs text-muted-foreground">
                  {it.slot === 'weapon' && it.min_damage != null ? `${it.min_damage}-${it.max_damage} dmg` : `+${it.defense} def`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="game-card rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-orbitron text-sm text-muted-foreground flex items-center gap-2">
            <Coins className="w-4 h-4 text-shield" /> CREDITS
          </span>
          <span className="font-orbitron text-lg text-shield">{c.credits.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-orbitron text-sm text-muted-foreground flex items-center gap-2">
            <Gem className="w-4 h-4 text-neon-purple" /> AETHERIUM
          </span>
          <span className="font-orbitron text-lg text-neon-purple">{(c.vibranium ?? 0).toLocaleString()}</span>
        </div>
        <Button
          size="sm" variant="outline" className="w-full"
          disabled={(c.vibranium ?? 0) < 100 || dirty}
          onClick={() => setResetOpen(true)}
          title={dirty ? 'Save or cancel pending changes first' : (c.vibranium ?? 0) < 100 ? 'Need 100 Aetherium' : 'Reset all allocated stat points'}
        >
          <RotateCcw className="w-3 h-3 mr-1" /> Reset Stats (100 <Gem className="w-3 h-3 mx-0.5" />)
        </Button>
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Allocated Stats?</AlertDialogTitle>
            <AlertDialogDescription>
              Spend <strong>100 Aetherium</strong> to refund every stat point you've allocated.
              Your level, XP, credits, inventory, equipment, and skills are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doReset} disabled={resetting}>
              {resetting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Stat = ({
  icon, label, value, pending, onPlus, disabled, hint,
}: { icon: React.ReactNode; label: string; value: number; pending: number; onPlus: () => void; disabled: boolean; hint?: string }) => (
  <div className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5">
    {icon}
    <div className="flex-1 min-w-0">
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      {hint && <div className="text-[10px] text-muted-foreground/70 truncate">{hint}</div>}
    </div>
    <span className="font-orbitron text-sm w-12 text-right">
      {value}
      {pending > 0 && <span className="text-secondary text-[10px] ml-1">+{pending}</span>}
    </span>
    <Button size="icon" variant="outline" className="h-7 w-7" disabled={disabled} onClick={onPlus}>
      <Plus className="w-3 h-3" />
    </Button>
  </div>
);

const BarSpend = ({
  icon, label, value, max, color, plusLabel, onPlus, disabled, pending,
}: {
  icon: React.ReactNode; label: string; value: number; max: number; color: string;
  plusLabel: string; onPlus: () => void; disabled: boolean; pending: number;
}) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-foreground">{icon} {label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {value} / {max}
            {pending > 0 && <span className="text-secondary ml-1">(+{pending})</span>}
          </span>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={disabled} onClick={onPlus}>
            {plusLabel}
          </Button>
        </div>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
