import { useEffect, useMemo, useState } from 'react';
import { Loader2, Heart, Zap, Sword, Brain, Cpu, Users, Award, Coins, Crown, Plus, Shield, ShieldCheck, Gem, RotateCcw, Save, X, Sparkles, Target, Feather, Bot } from 'lucide-react';
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
import { calculateDamagePreview, type ScaleStat, type DamageType } from '@/lib/damage-preview';
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
  equipped_wings_id: string | null;
  equipped_pet_id: string | null;
}

interface EquippedItem {
  id: string;
  name: string;
  rarity: string;
  slot: string;
  min_damage: number | null;
  max_damage: number | null;
  defense: number;
  damage_type: DamageType | null;
  weapon_subtype: string | null;
  stat_modifiers: Record<string, number> | null;
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

      const ids = [
        charRow.equipped_weapon_id,
        charRow.equipped_armor_id,
        (charRow as any).equipped_wings_id,
        (charRow as any).equipped_pet_id,
      ].filter(Boolean) as string[];
      if (ids.length) {
        const { data: items } = await supabase
          .from('items')
          .select('id, name, rarity, slot, min_damage, max_damage, defense, damage_type, weapon_subtype, stat_modifiers')
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

  // Aggregate gear bonuses from every equipped item (mirrors server snapshot logic).
  const gearBonus = useMemo(() => {
    const out = { strength: 0, dexterity: 0, technology: 0, support: 0, defense: 0, resistance: 0, max_hp: 0, max_energy: 0 };
    for (const it of equipped) {
      const m = it.stat_modifiers ?? {};
      for (const k of Object.keys(out) as (keyof typeof out)[]) out[k] += Number((m as any)[k] ?? 0);
      out.defense += Number(it.defense ?? 0);
    }
    return out;
  }, [equipped]);

  // Effective values include pending draft + equipped gear.
  const effStr = c.strength + draft.strength + gearBonus.strength;
  const effDex = c.dexterity + draft.dexterity + gearBonus.dexterity;
  const effTech = c.technology + draft.technology + gearBonus.technology;
  const effSup = c.support + draft.support + gearBonus.support;
  const effDef = c.defense + draft.defense + gearBonus.defense;
  const effRes = c.resistance + draft.resistance + gearBonus.resistance;
  const effBonusHp = (c.bonus_max_hp ?? 0) + draft.max_hp * 5 + gearBonus.max_hp;
  const effBonusMp = (c.bonus_max_mp ?? 0) + draft.max_energy * 3 + gearBonus.max_energy;

  const maxHp = Math.floor(100 + effStr * 8 + c.level * 12) + effBonusHp;
  const maxMp = 100 + effTech * 2 + effBonusMp;
  const canSpend = remainingPoints > 0;

  // Damage preview against a Lv-equivalent dummy, using equipped weapon (or fallback).
  const weapon = equipped.find(e => e.slot === 'weapon');
  const weaponSubtype = weapon?.weapon_subtype ?? 'unarmed';
  const weaponDamageType: DamageType = (weapon?.damage_type as DamageType) ?? 'physical';
  const weaponScale: ScaleStat =
    weaponSubtype === 'pistol' || weaponSubtype === 'rifle' ? 'dexterity' :
    weaponSubtype === 'tech_staff' ? 'technology' :
    weaponSubtype === 'rocket_launcher' || weaponSubtype === 'drone' ? 'support' : 'strength';
  const weaponMin = weapon?.min_damage ?? 40;
  const weaponMax = weapon?.max_damage ?? 55;
  const dmg = useMemo(() => calculateDamagePreview({
    attacker: { level: c.level, strength: effStr, dexterity: effDex, technology: effTech, support: effSup, defense: effDef, resistance: effRes },
    weapon: { min: weaponMin, max: weaponMax, damageType: weaponDamageType, scaleStat: weaponScale, subtype: weaponSubtype },
  }), [c.level, effStr, effDex, effTech, effSup, effDef, effRes, weaponMin, weaponMax, weaponDamageType, weaponScale, weaponSubtype]);


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
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-secondary" /> DAMAGE PREVIEW
        </h3>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">vs Lv {c.level} dummy</div>
            <div className="font-orbitron text-2xl text-secondary">
              {dmg.min}<span className="text-muted-foreground text-base"> – </span>{dmg.max}
            </div>
          </div>
          <div className="text-right text-[10px] text-muted-foreground space-y-0.5">
            <div>type: <span className="text-foreground capitalize">{dmg.damageType}</span></div>
            <div>scales: <span className="text-foreground uppercase">{dmg.scaleStat.slice(0, 3)}</span></div>
            <div>mit: <span className="text-foreground">{Math.round(dmg.mitPct * 100)}%</span></div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
          Live preview of your weapon's basic attack. Allocating stats updates this instantly.
        </p>
      </div>

      <div className="game-card rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2">EQUIPPED</h3>
        {equipped.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing equipped. Open Inventory to equip gear.</p>
        ) : (
          <ul className="space-y-1.5">
            {equipped.map((it) => {
              const mods = it.stat_modifiers ?? {};
              const modParts = Object.entries(mods)
                .filter(([, v]) => Number(v) !== 0)
                .map(([k, v]) => `+${v} ${k.replace('max_', '').slice(0, 3).toUpperCase()}`);
              const right =
                it.slot === 'weapon' && it.min_damage != null
                  ? `${it.min_damage}-${it.max_damage} dmg`
                  : it.defense > 0 ? `+${it.defense} def` : modParts[0] ?? '';
              const SlotIcon =
                it.slot === 'weapon' ? Sword :
                it.slot === 'armor' ? Shield :
                it.slot === 'wings' ? Feather :
                it.slot === 'pet' ? Bot : Sparkles;
              return (
                <li key={it.id} className="flex items-center justify-between text-sm gap-2">
                  <span className="font-rajdhani flex items-center gap-2 min-w-0">
                    <SlotIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground capitalize text-xs">{it.slot}</span>
                    <span className="truncate">{it.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{right}</span>
                </li>
              );
            })}
          </ul>
        )}
        {(gearBonus.strength || gearBonus.dexterity || gearBonus.technology || gearBonus.support || gearBonus.defense || gearBonus.resistance || gearBonus.max_hp || gearBonus.max_energy) ? (
          <div className="mt-3 pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 font-rajdhani">
            <span className="text-foreground/80 font-orbitron text-[9px] uppercase tracking-wider">Gear bonus:</span>
            {gearBonus.strength ? <span>+{gearBonus.strength} STR</span> : null}
            {gearBonus.dexterity ? <span>+{gearBonus.dexterity} DEX</span> : null}
            {gearBonus.technology ? <span>+{gearBonus.technology} TEC</span> : null}
            {gearBonus.support ? <span>+{gearBonus.support} SUP</span> : null}
            {gearBonus.defense ? <span>+{gearBonus.defense} DEF</span> : null}
            {gearBonus.resistance ? <span>+{gearBonus.resistance} RES</span> : null}
            {gearBonus.max_hp ? <span>+{gearBonus.max_hp} HP</span> : null}
            {gearBonus.max_energy ? <span>+{gearBonus.max_energy} MP</span> : null}
          </div>
        ) : null}
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
