import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Heart, Zap, Sword, Shield, ShieldCheck, Sparkles, Crown, Coins, Gem,
  Award, Plus, Save, X, RotateCcw, Sword as SwordIcon, Brain, Cpu, Users,
  Feather, Bot, Lock, Target, ChevronRight, Store, Pill,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { allocateStatPoints, resetStats, unlockClassSkill, type SpendableStat } from '@/lib/overworld';
import { CLASS_META } from '@/data/class-definitions';
import { calculateDamagePreview, type ScaleStat, type DamageType } from '@/lib/damage-preview';
import { fetchInventory, equipItem, unequipItem, type InventoryItem } from '@/lib/inventory';
import { xpForLevel } from '@/lib/leveling';
import { classDisplayName } from '@/lib/display-names';
import type { LevelUpInfo } from '@/pages/Index';

interface BuildPanelProps {
  characterId: string;
  open: boolean;
  onClose: () => void;
  refreshTick?: number;
  onProgressionChange?: (level?: LevelUpInfo | null) => void;
  onLoadoutChanged?: () => void;
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
  skill_levels: Record<string, number>;
  equipped_weapon_id: string | null;
  equipped_armor_id: string | null;
  equipped_wings_id: string | null;
  equipped_pet_id: string | null;
}

interface SkillRow {
  slug: string;
  name: string;
  description: string | null;
  class: string;
  unlock_level: number;
  energy_cost: number;
  cooldown: number;
  base_damage: number;
  scale_stat: string;
  type: string;
  effect: string;
  max_level: number;
}

type DraftKey = SpendableStat;
const EMPTY_DRAFT: Record<DraftKey, number> = {
  strength: 0, dexterity: 0, technology: 0, support: 0,
  defense: 0, resistance: 0, max_hp: 0, max_energy: 0,
};

const ULTIMATE_LEVELS = new Set([5, 20, 50]);
const isUltimate = (s: SkillRow) => ULTIMATE_LEVELS.has(s.unlock_level) && s.base_damage >= 150;

const RARITY_TEXT: Record<string, string> = {
  common: 'text-muted-foreground',
  uncommon: 'text-neon-green',
  rare: 'text-primary',
  epic: 'text-neon-purple',
  legendary: 'text-shield',
};
const RARITY_BORDER: Record<string, string> = {
  common: 'border-muted/50',
  uncommon: 'border-neon-green/40',
  rare: 'border-primary/40',
  epic: 'border-neon-purple/40',
  legendary: 'border-shield/40',
};

const STAT_HINTS: Record<string, string> = {
  strength: 'Boosts blade & heavy physical damage',
  dexterity: 'Boosts pistols/rifles, precision & crit',
  technology: 'Boosts energy/staff damage and shields',
  support: 'Boosts launchers, drones, pets, healing',
  defense: 'Reduces physical damage taken',
  resistance: 'Reduces energy damage taken',
  max_hp: 'Increases survivability (+5 HP per point)',
  max_energy: 'Allows more skill usage (+3 MP per point)',
};

const subtypeToScale = (sub: string | null | undefined): ScaleStat =>
  sub === 'pistol' || sub === 'rifle' ? 'dexterity' :
  sub === 'tech_staff' ? 'technology' :
  sub === 'rocket_launcher' || sub === 'drone' ? 'support' : 'strength';

export const BuildPanel = ({
  characterId, open, onClose, refreshTick, onProgressionChange, onLoadoutChanged,
}: BuildPanelProps) => {
  const [c, setC] = useState<CharRow | null>(null);
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<DraftKey, number>>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [busyEquip, setBusyEquip] = useState<string | null>(null);
  const [busySkill, setBusySkill] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: charRow } = await supabase.from('characters').select('*').eq('id', characterId).maybeSingle();
      if (!charRow) return;
      setC(charRow as any);
      setDraft(EMPTY_DRAFT);

      const [invRes, skillRes] = await Promise.all([
        fetchInventory(characterId),
        supabase.from('skills')
          .select('slug, name, description, class, unlock_level, energy_cost, cooldown, base_damage, scale_stat, type, effect, max_level')
          .eq('class', charRow.class).order('unlock_level'),
      ]);
      setInv(invRes);
      setSkills((skillRes.data ?? []) as SkillRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [characterId, refreshTick, open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const equipped = useMemo(() => inv.filter(i => i.equipped && !i.item.consumable), [inv]);
  const consumables = useMemo(() => inv.filter(i => i.item.consumable), [inv]);
  const ownedBySlot = (slot: string) => inv.filter(i => !i.item.consumable && i.item.slot === slot);

  const gearBonus = useMemo(() => {
    const out: Record<string, number> = {
      strength: 0, dexterity: 0, technology: 0, support: 0,
      defense: 0, resistance: 0, max_hp: 0, max_energy: 0,
    };
    for (const it of equipped) {
      const m = (it.item.stat_modifiers ?? {}) as Record<string, number>;
      for (const k of Object.keys(out)) out[k] += Number(m[k] ?? 0);
      out.defense += Number(it.item.defense ?? 0);
    }
    return out;
  }, [equipped]);

  const draftTotal = Object.values(draft).reduce((a, b) => a + b, 0);
  const remainingPoints = (c?.stat_points ?? 0) - draftTotal;
  const dirty = draftTotal > 0;

  const effStr = (c?.strength ?? 0) + draft.strength + gearBonus.strength;
  const effDex = (c?.dexterity ?? 0) + draft.dexterity + gearBonus.dexterity;
  const effTech = (c?.technology ?? 0) + draft.technology + gearBonus.technology;
  const effSup = (c?.support ?? 0) + draft.support + gearBonus.support;
  const effDef = (c?.defense ?? 0) + draft.defense + gearBonus.defense;
  const effRes = (c?.resistance ?? 0) + draft.resistance + gearBonus.resistance;
  const effBonusHp = (c?.bonus_max_hp ?? 0) + draft.max_hp * 5 + gearBonus.max_hp;
  const effBonusMp = (c?.bonus_max_mp ?? 0) + draft.max_energy * 3 + gearBonus.max_energy;
  const charLevel = c?.level ?? 1;

  const equippedWeaponItem = equipped.find(e => e.item.slot === 'weapon');
  const weaponSubtype = equippedWeaponItem?.item.weapon_subtype ?? equippedWeaponItem?.item.subtype ?? 'unarmed';
  const weaponDamageType: DamageType = (equippedWeaponItem?.item.damage_type as DamageType) ?? 'physical';
  const weaponScale: ScaleStat = subtypeToScale(weaponSubtype);
  const weaponMin = equippedWeaponItem?.item.min_damage ?? 40;
  const weaponMax = equippedWeaponItem?.item.max_damage ?? 55;

  const attacker = {
    level: charLevel, strength: effStr, dexterity: effDex, technology: effTech,
    support: effSup, defense: effDef, resistance: effRes,
  };

  const basicDmg = useMemo(() => calculateDamagePreview({
    attacker,
    weapon: { min: weaponMin, max: weaponMax, damageType: weaponDamageType, scaleStat: weaponScale, subtype: weaponSubtype },
  }), [charLevel, effStr, effDex, effTech, effSup, effDef, effRes, weaponMin, weaponMax, weaponDamageType, weaponScale, weaponSubtype]);

  const selSkill = skills.find(s => s.slug === selectedSkill) ?? null;
  const selRank = selSkill ? Math.max(1, c?.skill_levels?.[selSkill.slug] ?? 1) : 1;

  const skillDmg = useMemo(() => {
    if (!selSkill) return null;
    return calculateDamagePreview({
      attacker,
      weapon: { min: weaponMin, max: weaponMax, damageType: weaponDamageType, scaleStat: weaponScale, subtype: weaponSubtype },
      skill: {
        baseDamage: selSkill.base_damage,
        scaleStat: (selSkill.scale_stat as ScaleStat) ?? 'strength',
        rank: selRank,
        type: (selSkill.type as 'physical' | 'magical' | 'special') ?? 'physical',
      },
    });
  }, [selSkill, selRank, attacker, weaponMin, weaponMax, weaponDamageType, weaponScale, weaponSubtype]);

  const bestUlt = useMemo(() => {
    const learnedUlts = skills.filter(s => isUltimate(s) && (c?.skill_levels?.[s.slug] ?? 0) >= 1);
    if (learnedUlts.length === 0) return null;
    return learnedUlts.sort((a, b) => b.base_damage - a.base_damage)[0];
  }, [skills, c?.skill_levels]);

  const ultDmg = useMemo(() => {
    if (!bestUlt) return null;
    const rank = c?.skill_levels?.[bestUlt.slug] ?? 1;
    return calculateDamagePreview({
      attacker,
      weapon: { min: weaponMin, max: weaponMax, damageType: weaponDamageType, scaleStat: weaponScale, subtype: weaponSubtype },
      skill: {
        baseDamage: bestUlt.base_damage,
        scaleStat: (bestUlt.scale_stat as ScaleStat) ?? 'strength',
        rank,
        type: (bestUlt.type as any) ?? 'physical',
      },
    });
  }, [bestUlt, c?.skill_levels, attacker, weaponMin, weaponMax, weaponDamageType, weaponScale, weaponSubtype]);

  const bumpDraft = (k: DraftKey) => {
    if (!c || remainingPoints <= 0) return;
    setDraft(d => ({ ...d, [k]: d[k] + 1 }));
  };
  const decDraft = (k: DraftKey) => {
    setDraft(d => ({ ...d, [k]: Math.max(0, d[k] - 1) }));
  };

  const cancelDraft = () => setDraft(EMPTY_DRAFT);

  const saveDraft = async () => {
    if (!c || !dirty || saving) return;
    setSaving(true);
    try {
      const r = await allocateStatPoints(characterId, draft);
      setC(prev => ({ ...(prev as any), ...(r.character as any) }));
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
      setC(prev => ({ ...(prev as any), ...(r.character as any) }));
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

  const handleEquip = async (it: InventoryItem) => {
    setBusyEquip(it.id);
    try {
      if (it.equipped) await unequipItem(characterId, it.id, it.item.slot);
      else await equipItem(characterId, it.id, it.item_id, it.item.slot);
      const fresh = await fetchInventory(characterId);
      setInv(fresh);
      const { data: charRow } = await supabase.from('characters').select('*').eq('id', characterId).maybeSingle();
      if (charRow) setC(charRow as any);
      onLoadoutChanged?.();
    } catch (e: any) {
      toast.error(`Action failed: ${e.message ?? e}`);
    } finally {
      setBusyEquip(null);
    }
  };

  const handleRankUp = async (slug: string) => {
    if (!c || c.skill_points <= 0 || busySkill) return;
    setBusySkill(slug);
    try {
      const r = await unlockClassSkill(characterId, slug);
      setC(prev => prev ? ({
        ...prev,
        skill_points: r.character.skill_points,
        skill_levels: r.character.skill_levels ?? {},
      }) : prev);
      onProgressionChange?.(null);
      toast.success(`${r.skill?.name ?? slug} → Rank ${r.rank}`);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusySkill(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in-0">
      <div
        className="relative w-[95vw] h-[92vh] max-w-[1600px] rounded-xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card/60">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-secondary" />
            <h2 className="font-orbitron text-lg tracking-wider">CHARACTER BUILD</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </div>

        {loading || !c ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <BuildBody
            c={c}
            classDisplay={classDisplayName(c.class) || (CLASS_META as any)[c.class]?.name || c.class}
            classColor={(CLASS_META as any)[c.class]?.color ?? ''}
            equipped={equipped}
            inv={inv}
            consumables={consumables}
            ownedBySlot={ownedBySlot}
            skills={skills}
            gearBonus={gearBonus}
            draft={draft}
            draftTotal={draftTotal}
            remainingPoints={remainingPoints}
            dirty={dirty}
            saving={saving}
            effStr={effStr} effDex={effDex} effTech={effTech} effSup={effSup}
            effDef={effDef} effRes={effRes} effBonusHp={effBonusHp} effBonusMp={effBonusMp}
            basicDmg={basicDmg}
            selectedSkill={selectedSkill}
            setSelectedSkill={setSelectedSkill}
            selSkill={selSkill}
            selRank={selRank}
            skillDmg={skillDmg}
            bestUlt={bestUlt}
            ultDmg={ultDmg}
            busyEquip={busyEquip}
            busySkill={busySkill}
            bumpDraft={bumpDraft}
            decDraft={decDraft}
            cancelDraft={cancelDraft}
            saveDraft={saveDraft}
            handleEquip={handleEquip}
            handleRankUp={handleRankUp}
            openReset={() => setResetOpen(true)}
            weaponDamageType={weaponDamageType}
            weaponScale={weaponScale}
            weaponSubtype={weaponSubtype}
            weaponMin={weaponMin}
            weaponMax={weaponMax}
          />
        )}
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Allocated Stats?</AlertDialogTitle>
            <AlertDialogDescription>
              Spend <strong>100 Aetherium</strong> to refund every stat point you've allocated.
              Level, XP, credits, inventory, equipment, and skills are kept.
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

// ---------------- Body (broken out so the parent stays readable) ----------------

interface BuildBodyProps {
  c: CharRow;
  classDisplay: string;
  classColor: string;
  equipped: InventoryItem[];
  inv: InventoryItem[];
  consumables: InventoryItem[];
  ownedBySlot: (slot: string) => InventoryItem[];
  skills: SkillRow[];
  gearBonus: Record<string, number>;
  draft: Record<DraftKey, number>;
  draftTotal: number;
  remainingPoints: number;
  dirty: boolean;
  saving: boolean;
  effStr: number; effDex: number; effTech: number; effSup: number;
  effDef: number; effRes: number; effBonusHp: number; effBonusMp: number;
  basicDmg: ReturnType<typeof calculateDamagePreview>;
  selectedSkill: string | null;
  setSelectedSkill: (s: string | null) => void;
  selSkill: SkillRow | null;
  selRank: number;
  skillDmg: ReturnType<typeof calculateDamagePreview> | null;
  bestUlt: SkillRow | null;
  ultDmg: ReturnType<typeof calculateDamagePreview> | null;
  busyEquip: string | null;
  busySkill: string | null;
  bumpDraft: (k: DraftKey) => void;
  decDraft: (k: DraftKey) => void;
  cancelDraft: () => void;
  saveDraft: () => void;
  handleEquip: (it: InventoryItem) => void;
  handleRankUp: (slug: string) => void;
  openReset: () => void;
  weaponDamageType: DamageType;
  weaponScale: ScaleStat;
  weaponSubtype: string;
  weaponMin: number;
  weaponMax: number;
}

const BuildBody = (p: BuildBodyProps) => {
  const xpNeed = xpForLevel(p.c.level);
  const xpPct = Math.min(100, Math.round((p.c.xp / Math.max(1, xpNeed)) * 100));

  const maxHp = Math.floor(100 + p.effStr * 8 + p.c.level * 12) + p.effBonusHp;
  const maxMp = 100 + p.effTech * 2 + p.effBonusMp;

  // Power summary (approximate, scales with effective stats)
  const attackPower = Math.round(p.basicDmg.avg);
  const skillPower = Math.round(((p.effStr + p.effDex + p.effTech + p.effSup) / 4) * 4 + p.c.level * 2);
  const survivability = Math.round(maxHp + p.effDef * 4 + p.effRes * 4);

  const ultimates = p.skills.filter(isUltimate);
  const basics = p.skills.filter(s => !isUltimate(s) && s.unlock_level <= 10);
  const advanced = p.skills.filter(s => !isUltimate(s) && s.unlock_level > 10);

  const hpPotion = p.consumables.find(i => i.item.subtype === 'hp_potion');
  const mpPotion = p.consumables.find(i => i.item.subtype === 'mp_potion');

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Character header strip */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-card/40 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-4 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className={`font-orbitron text-xl truncate ${p.classColor}`}>{p.c.name}</h3>
            <span className="text-xs text-muted-foreground">Lv {p.c.level}</span>
            <span className={`text-xs font-orbitron ${p.classColor}`}>{p.classDisplay}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-orbitron">XP</span>
            <div className="h-1.5 flex-1 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${xpPct}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{p.c.xp}/{xpNeed}</span>
          </div>
        </div>

        <div className="md:col-span-5 grid grid-cols-3 gap-2">
          <PowerStat label="Attack" value={attackPower} color="text-secondary" />
          <PowerStat label="Skill Pow" value={skillPower} color="text-primary" />
          <PowerStat label="Survival" value={survivability} color="text-health" />
        </div>

        <div className="md:col-span-3 flex items-center justify-end gap-3 flex-wrap">
          <span className="text-xs text-shield font-orbitron flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" /> {p.c.credits.toLocaleString()}
          </span>
          <span className="text-xs text-neon-purple font-orbitron flex items-center gap-1">
            <Gem className="w-3.5 h-3.5" /> {(p.c.vibranium ?? 0).toLocaleString()}
          </span>
          {p.remainingPoints > 0 && (
            <Badge className="bg-secondary/80"><Award className="w-3 h-3 mr-1" />{p.remainingPoints} stat</Badge>
          )}
          {p.c.skill_points > 0 && (
            <Badge className="bg-primary/80"><Award className="w-3 h-3 mr-1" />{p.c.skill_points} skill</Badge>
          )}
        </div>
      </div>

      {/* Pending banner */}
      {p.dirty && (
        <div className="shrink-0 px-4 py-2 bg-secondary/10 border-b border-secondary/30 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-secondary font-orbitron">
            {p.draftTotal} unsaved allocation{p.draftTotal === 1 ? '' : 's'} — preview reflects pending build
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={p.cancelDraft} disabled={p.saving}>
              <X className="w-3 h-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={p.saveDraft} disabled={p.saving}>
              {p.saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              Save Build
            </Button>
          </div>
        </div>
      )}

      {/* 3-column grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-y-auto lg:overflow-hidden">
        {/* COLUMN 1 — Equipment + Owned Gear */}
        <section className="lg:col-span-4 lg:overflow-y-auto lg:pr-1 space-y-3">
          <ColHeader icon={<Shield className="w-4 h-4" />} title="EQUIPMENT" />

          <div className="grid grid-cols-2 gap-2">
            <EquippedSlot label="Weapon" icon={<Sword className="w-3.5 h-3.5" />} item={p.equipped.find(e => e.item.slot === 'weapon')} onUnequip={p.handleEquip} busy={p.busyEquip} />
            <EquippedSlot label="Armor" icon={<Shield className="w-3.5 h-3.5" />} item={p.equipped.find(e => e.item.slot === 'armor')} onUnequip={p.handleEquip} busy={p.busyEquip} />
            <EquippedSlot label="Wings" icon={<Feather className="w-3.5 h-3.5" />} item={p.equipped.find(e => e.item.slot === 'wings')} onUnequip={p.handleEquip} busy={p.busyEquip} emptyHint="Buy from Broker Vexon" />
            <EquippedSlot label="Robot Pet" icon={<Bot className="w-3.5 h-3.5" />} item={p.equipped.find(e => e.item.slot === 'pet')} onUnequip={p.handleEquip} busy={p.busyEquip} emptyHint="Buy from Broker Vexon" />
          </div>

          <ColHeader icon={<Sword className="w-4 h-4" />} title="OWNED GEAR" />
          <OwnedGroup title="Weapons" icon={<Sword className="w-3 h-3" />} items={p.ownedBySlot('weapon')} char={p.c} onEquip={p.handleEquip} busy={p.busyEquip} />
          <OwnedGroup title="Armor" icon={<Shield className="w-3 h-3" />} items={p.ownedBySlot('armor')} char={p.c} onEquip={p.handleEquip} busy={p.busyEquip} />
          <OwnedGroup title="Wings" icon={<Feather className="w-3 h-3" />} items={p.ownedBySlot('wings')} char={p.c} onEquip={p.handleEquip} busy={p.busyEquip} />
          <OwnedGroup title="Robot Pets" icon={<Bot className="w-3 h-3" />} items={p.ownedBySlot('pet')} char={p.c} onEquip={p.handleEquip} busy={p.busyEquip} />

          {/* Consumables compact */}
          <div className="game-card rounded-lg p-3">
            <h4 className="font-orbitron text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Pill className="w-3 h-3" /> Consumables
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/30 rounded px-2 py-1.5">
                <div className="text-health font-orbitron flex items-center gap-1">
                  <Heart className="w-3 h-3" /> HP Potion ×{hpPotion?.quantity ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Restores 50% HP</div>
              </div>
              <div className="bg-muted/30 rounded px-2 py-1.5">
                <div className="text-energy font-orbitron flex items-center gap-1">
                  <Zap className="w-3 h-3" /> MP Potion ×{mpPotion?.quantity ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Restores 50% MP</div>
              </div>
            </div>
          </div>

          <div className="game-card rounded-lg p-3 border-dashed">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Store className="w-3 h-3" /> Need gear? Visit <span className="text-foreground font-orbitron">Broker Vexon</span> in the world.
            </p>
          </div>
        </section>

        {/* COLUMN 2 — Stats */}
        <section className="lg:col-span-4 lg:overflow-y-auto lg:pr-1 space-y-3">
          <ColHeader icon={<Target className="w-4 h-4" />} title="STATS & ALLOCATION" />

          <div className="game-card rounded-lg p-3 space-y-2">
            <BarSpend
              icon={<Heart className="w-4 h-4 text-health" />} label="Max HP"
              value={maxHp} color="bg-health"
              plusLabel="+5" onPlus={() => p.bumpDraft('max_hp')}
              onMinus={() => p.decDraft('max_hp')}
              disabled={p.remainingPoints <= 0}
              pending={p.draft.max_hp}
              hint={STAT_HINTS.max_hp}
            />
            <BarSpend
              icon={<Zap className="w-4 h-4 text-energy" />} label="Max MP"
              value={maxMp} color="bg-energy"
              plusLabel="+3" onPlus={() => p.bumpDraft('max_energy')}
              onMinus={() => p.decDraft('max_energy')}
              disabled={p.remainingPoints <= 0}
              pending={p.draft.max_energy}
              hint={STAT_HINTS.max_energy}
            />
          </div>

          <div className="game-card rounded-lg p-3 space-y-1.5">
            <h4 className="font-orbitron text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Attributes</h4>
            <StatRow icon={<SwordIcon className="w-4 h-4 text-secondary" />} label="Strength"
              base={p.c.strength} draft={p.draft.strength} gear={p.gearBonus.strength} value={p.effStr}
              onPlus={() => p.bumpDraft('strength')} onMinus={() => p.decDraft('strength')} disabled={p.remainingPoints <= 0}
              hint={STAT_HINTS.strength} />
            <StatRow icon={<Brain className="w-4 h-4 text-primary" />} label="Dexterity"
              base={p.c.dexterity} draft={p.draft.dexterity} gear={p.gearBonus.dexterity} value={p.effDex}
              onPlus={() => p.bumpDraft('dexterity')} onMinus={() => p.decDraft('dexterity')} disabled={p.remainingPoints <= 0}
              hint={STAT_HINTS.dexterity} />
            <StatRow icon={<Cpu className="w-4 h-4 text-neon-purple" />} label="Tech"
              base={p.c.technology} draft={p.draft.technology} gear={p.gearBonus.technology} value={p.effTech}
              onPlus={() => p.bumpDraft('technology')} onMinus={() => p.decDraft('technology')} disabled={p.remainingPoints <= 0}
              hint={STAT_HINTS.technology} />
            <StatRow icon={<Users className="w-4 h-4 text-neon-green" />} label="Support"
              base={p.c.support} draft={p.draft.support} gear={p.gearBonus.support} value={p.effSup}
              onPlus={() => p.bumpDraft('support')} onMinus={() => p.decDraft('support')} disabled={p.remainingPoints <= 0}
              hint={STAT_HINTS.support} />
            <StatRow icon={<Shield className="w-4 h-4 text-shield" />} label="Defense"
              base={p.c.defense} draft={p.draft.defense} gear={p.gearBonus.defense} value={p.effDef}
              onPlus={() => p.bumpDraft('defense')} onMinus={() => p.decDraft('defense')} disabled={p.remainingPoints <= 0}
              hint={STAT_HINTS.defense} />
            <StatRow icon={<ShieldCheck className="w-4 h-4 text-energy" />} label="Resistance"
              base={p.c.resistance} draft={p.draft.resistance} gear={p.gearBonus.resistance} value={p.effRes}
              onPlus={() => p.bumpDraft('resistance')} onMinus={() => p.decDraft('resistance')} disabled={p.remainingPoints <= 0}
              hint={STAT_HINTS.resistance} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" className="flex-1"
              disabled={!p.dirty || p.saving}
              onClick={p.saveDraft}>
              {p.saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              Save Build
            </Button>
            <Button size="sm" variant="ghost" disabled={!p.dirty || p.saving} onClick={p.cancelDraft}>
              <X className="w-3 h-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" variant="ghost"
              disabled={(p.c.vibranium ?? 0) < 100 || p.dirty}
              onClick={p.openReset}
              title={p.dirty ? 'Save or cancel pending changes first' : (p.c.vibranium ?? 0) < 100 ? 'Need 100 Aetherium' : 'Reset all allocated stat points'}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          </div>
        </section>

        {/* COLUMN 3 — Skills + Damage */}
        <section className="lg:col-span-4 lg:overflow-y-auto lg:pr-1 space-y-3">
          <ColHeader icon={<Sparkles className="w-4 h-4" />} title="SKILLS & DAMAGE" />

          {/* Damage previews */}
          <div className="game-card rounded-lg p-3 space-y-2">
            <h4 className="font-orbitron text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3 h-3 text-secondary" /> Damage Preview vs Lv {p.c.level} dummy
            </h4>
            <DmgRow label="Basic Attack" sub={`${p.weaponSubtype} · ${p.weaponDamageType}`} dmg={p.basicDmg} />
            {p.selSkill && p.skillDmg && (
              <DmgRow label={p.selSkill.name} sub={`Rank ${p.selRank} · ${p.skillDmg.damageType}`} dmg={p.skillDmg} accent />
            )}
            {p.bestUlt && p.ultDmg && (
              <DmgRow label={`★ ${p.bestUlt.name}`} sub={`Ultimate · ${p.ultDmg.damageType}`} dmg={p.ultDmg} ult />
            )}
            <p className="text-[10px] text-muted-foreground leading-tight pt-1">
              Updates live with stat allocation, gear changes, and skill rank-ups.
              Click any skill below to preview its damage.
            </p>
          </div>

          <SkillSection title="Basic Skills" skills={basics} c={p.c} busy={p.busySkill}
            onRank={p.handleRankUp} selected={p.selectedSkill} onSelect={p.setSelectedSkill} />
          <SkillSection title="Advanced Skills" skills={advanced} c={p.c} busy={p.busySkill}
            onRank={p.handleRankUp} selected={p.selectedSkill} onSelect={p.setSelectedSkill} />
          <SkillSection title="Ultimates" skills={ultimates} c={p.c} busy={p.busySkill}
            onRank={p.handleRankUp} selected={p.selectedSkill} onSelect={p.setSelectedSkill} ultimate />

          {p.skills.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No skills found for this class.</p>
          )}
        </section>
      </div>
    </div>
  );
};

// ---------------- Small presentational helpers ----------------

const ColHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <h3 className="font-orbitron text-xs uppercase tracking-wider text-foreground/80 flex items-center gap-1.5 sticky top-0 bg-background/95 backdrop-blur py-1 -mx-1 px-1 z-10 border-b border-border/40">
    {icon} {title}
  </h3>
);

const PowerStat = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="bg-muted/30 rounded px-2 py-1.5">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`font-orbitron text-base ${color}`}>{value.toLocaleString()}</div>
  </div>
);

const EquippedSlot = ({
  label, icon, item, onUnequip, busy, emptyHint,
}: {
  label: string; icon: React.ReactNode; item?: InventoryItem;
  onUnequip: (it: InventoryItem) => void; busy: string | null; emptyHint?: string;
}) => {
  if (!item) {
    return (
      <div className="game-card rounded-lg p-2.5 border-dashed opacity-70">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          {icon} {label}
        </div>
        <div className="text-xs text-muted-foreground mt-1">No {label} Equipped</div>
        {emptyHint && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{emptyHint}</div>}
      </div>
    );
  }
  const it = item.item;
  return (
    <div className={`game-card rounded-lg p-2.5 border ${RARITY_BORDER[it.rarity] ?? ''} ring-1 ring-primary/40`}>
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          {icon} {label}
        </div>
        <Badge className="text-[9px] bg-primary/80 px-1.5 py-0">EQ</Badge>
      </div>
      <div className={`font-orbitron text-xs mt-1 truncate ${RARITY_TEXT[it.rarity] ?? ''}`}>{it.name}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        Lv {it.level_req}{it.weapon_subtype ? ` · ${it.weapon_subtype}` : it.subtype ? ` · ${it.subtype}` : ''}
      </div>
      {it.min_damage != null && (
        <div className="text-[10px] text-secondary">{it.min_damage}-{it.max_damage} dmg</div>
      )}
      {it.defense > 0 && <div className="text-[10px] text-shield">+{it.defense} DEF</div>}
      <ModBadges mods={it.stat_modifiers ?? {}} />
      <Button size="sm" variant="ghost" className="w-full h-6 mt-1.5 text-[10px]"
        disabled={busy === item.id} onClick={() => onUnequip(item)}>
        {busy === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Unequip'}
      </Button>
    </div>
  );
};

const ModBadges = ({ mods }: { mods: Record<string, number> }) => {
  const parts = Object.entries(mods).filter(([, v]) => Number(v) !== 0);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {parts.map(([k, v]) => (
        <span key={k} className="text-[9px] px-1 py-0.5 rounded bg-muted/50 text-foreground/80 font-rajdhani">
          +{v} {k.replace('max_', '').slice(0, 3).toUpperCase()}
        </span>
      ))}
    </div>
  );
};

const OwnedGroup = ({
  title, icon, items, char, onEquip, busy,
}: {
  title: string; icon: React.ReactNode; items: InventoryItem[]; char: CharRow;
  onEquip: (it: InventoryItem) => void; busy: string | null;
}) => {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="font-orbitron text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
        {icon} {title} <span className="text-muted-foreground/60">({items.length})</span>
      </h4>
      <div className="space-y-1.5">
        {items.map(it => {
          const lvlOk = char.level >= it.item.level_req;
          return (
            <div key={it.id} className={`game-card rounded p-2 border ${RARITY_BORDER[it.item.rarity] ?? ''} ${it.equipped ? 'ring-1 ring-primary/60' : ''} ${!lvlOk ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className={`font-orbitron text-xs truncate ${RARITY_TEXT[it.item.rarity] ?? ''}`}>{it.item.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">
                    {it.item.rarity} · Lv {it.item.level_req}
                    {it.item.weapon_subtype ? ` · ${it.item.weapon_subtype}` : ''}
                  </div>
                  <div className="text-[10px] text-muted-foreground/90 flex flex-wrap gap-x-2">
                    {it.item.min_damage != null && <span className="text-secondary">{it.item.min_damage}-{it.item.max_damage} dmg</span>}
                    {it.item.defense > 0 && <span className="text-shield">+{it.item.defense} DEF</span>}
                  </div>
                  <ModBadges mods={(it.item.stat_modifiers ?? {}) as any} />
                </div>
                <Button size="sm" variant={it.equipped ? 'outline' : 'default'}
                  className="h-7 text-[10px] px-2 shrink-0"
                  disabled={busy === it.id || (!it.equipped && !lvlOk)}
                  onClick={() => onEquip(it)}
                  title={!lvlOk ? `Requires Lv ${it.item.level_req}` : ''}>
                  {busy === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                    it.equipped ? 'Unequip' : !lvlOk ? <Lock className="w-3 h-3" /> : 'Equip'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatRow = ({
  icon, label, base, draft, gear, value, onPlus, onMinus, disabled, hint,
}: {
  icon: React.ReactNode; label: string; base: number; draft: number; gear: number; value: number;
  onPlus: () => void; onMinus: () => void; disabled: boolean; hint?: string;
}) => (
  <div className="bg-muted/30 rounded px-2 py-1.5">
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-foreground truncate">{label}</div>
        {hint && <div className="text-[9px] text-muted-foreground/70 truncate">{hint}</div>}
      </div>
      <span className="font-orbitron text-base w-10 text-right">
        {value}
        {draft > 0 && <span className="text-secondary text-[10px] ml-1">+{draft}</span>}
      </span>
      <div className="flex items-center gap-0.5">
        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={draft === 0} onClick={onMinus}>
          <X className="w-3 h-3" />
        </Button>
        <Button size="icon" variant="outline" className="h-6 w-6" disabled={disabled} onClick={onPlus}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
    <div className="text-[9px] text-muted-foreground/70 ml-6 mt-0.5 font-rajdhani">
      Base {base}{gear ? ` · Gear +${gear}` : ''}{draft ? ` · Draft +${draft}` : ''}
    </div>
  </div>
);

const BarSpend = ({
  icon, label, value, color, plusLabel, onPlus, onMinus, disabled, pending, hint,
}: {
  icon: React.ReactNode; label: string; value: number; color: string;
  plusLabel: string; onPlus: () => void; onMinus: () => void; disabled: boolean; pending: number; hint?: string;
}) => (
  <div>
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="flex items-center gap-1.5 text-foreground">{icon} {label}</span>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground font-orbitron">
          {value}
          {pending > 0 && <span className="text-secondary ml-1">(+{pending})</span>}
        </span>
        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={pending === 0} onClick={onMinus}>
          <X className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={disabled} onClick={onPlus}>
          {plusLabel}
        </Button>
      </div>
    </div>
    <div className="h-1.5 rounded bg-muted overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: '100%' }} />
    </div>
    {hint && <div className="text-[9px] text-muted-foreground/70 mt-0.5">{hint}</div>}
  </div>
);

const DmgRow = ({
  label, sub, dmg, accent, ult,
}: {
  label: string; sub: string;
  dmg: ReturnType<typeof calculateDamagePreview>;
  accent?: boolean; ult?: boolean;
}) => (
  <div className={`rounded p-2 ${ult ? 'bg-secondary/10 border border-secondary/40' : accent ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'}`}>
    <div className="flex items-baseline justify-between">
      <div className="min-w-0">
        <div className={`font-orbitron text-xs truncate ${ult ? 'text-secondary' : accent ? 'text-primary' : 'text-foreground'}`}>{label}</div>
        <div className="text-[9px] text-muted-foreground capitalize truncate">{sub} · scales {dmg.scaleStat.slice(0, 3).toUpperCase()}</div>
      </div>
      <div className="text-right shrink-0 ml-2">
        <div className="font-orbitron text-lg leading-none">
          {dmg.min}<span className="text-muted-foreground text-xs">–</span>{dmg.max}
        </div>
        <div className="text-[9px] text-muted-foreground">mit {Math.round(dmg.mitPct * 100)}%</div>
      </div>
    </div>
  </div>
);

const SkillSection = ({
  title, skills, c, busy, onRank, selected, onSelect, ultimate,
}: {
  title: string; skills: SkillRow[]; c: CharRow; busy: string | null;
  onRank: (slug: string) => void; selected: string | null;
  onSelect: (s: string | null) => void; ultimate?: boolean;
}) => {
  if (skills.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className={`font-orbitron text-[10px] uppercase tracking-wider flex items-center gap-1 ${ultimate ? 'text-secondary' : 'text-muted-foreground'}`}>
        {ultimate && <Crown className="w-3 h-3" />} {title}
      </h4>
      {skills.map(s => {
        const rank = c.skill_levels?.[s.slug] ?? 0;
        const maxRank = s.max_level ?? 20;
        const lvlOk = c.level >= s.unlock_level;
        const atMax = rank >= maxRank;
        const canRank = !atMax && lvlOk && c.skill_points > 0;
        const learned = rank >= 1;
        const isSel = selected === s.slug;
        return (
          <div key={s.slug}
            onClick={() => onSelect(isSel ? null : s.slug)}
            className={`game-card rounded p-2 cursor-pointer transition-colors
              ${learned ? (ultimate ? 'border-secondary/40 bg-secondary/5' : 'border-primary/40 bg-primary/5') : !lvlOk ? 'opacity-60' : ''}
              ${isSel ? 'ring-1 ring-secondary' : ''}`}>
            <div className="flex items-start gap-2">
              <Sparkles className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ultimate ? 'text-secondary' : learned ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h5 className="font-orbitron text-xs">{s.name}</h5>
                  {ultimate && <Badge variant="outline" className="text-[8px] text-secondary border-secondary/40 px-1 py-0">ULT</Badge>}
                  {learned && (
                    <Badge variant="outline" className={`text-[8px] px-1 py-0 ${ultimate ? 'text-secondary border-secondary/40' : 'text-primary border-primary/40'}`}>
                      R{rank}/{maxRank}
                    </Badge>
                  )}
                  {!lvlOk && <span className="text-[9px] text-muted-foreground">Lv {s.unlock_level}</span>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0 font-rajdhani">
                  <span>⚡{s.energy_cost}</span>
                  <span>CD {s.cooldown}</span>
                  <span>DMG {s.base_damage}</span>
                  <span className="capitalize">{s.scale_stat.slice(0, 3)} · {s.type}</span>
                </div>
                {isSel && s.description && (
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{s.description}</p>
                )}
              </div>
              <div className="shrink-0">
                {!lvlOk ? (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Button size="icon" variant="outline" className="h-6 w-6"
                    disabled={!canRank || busy === s.slug}
                    onClick={(e) => { e.stopPropagation(); onRank(s.slug); }}
                    title={atMax ? 'Max rank' : !learned ? 'Spend 1 skill point to unlock' : `Rank up → ${rank + 1}`}>
                    {busy === s.slug ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
