import { useEffect, useState } from 'react';
import { Loader2, Heart, Zap, Sword, Brain, Cpu, Users, Award, Coins, Crown, Plus, Shield, ShieldCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { spendStatPoint, type SpendableStat } from '@/lib/overworld';
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

const STAT_KEYS = ['strength', 'dexterity', 'technology', 'support', 'defense', 'resistance'] as const;
type StatKey = SpendableStat;

export const ProfilePanel = ({ characterId, refreshTick, onProgressionChange }: ProfilePanelProps) => {
  const [c, setC] = useState<CharRow | null>(null);
  const [equipped, setEquipped] = useState<EquippedItem[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<StatKey | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: charRow } = await supabase.from('characters').select('*').eq('id', characterId).maybeSingle();
      if (!charRow) return;
      setC(charRow as CharRow);

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

  const handleSpend = async (stat: StatKey) => {
    if (!c || c.stat_points <= 0 || busy) return;
    setBusy(stat);
    try {
      const r = await spendStatPoint(characterId, stat);
      setC(r.character as CharRow);
      onProgressionChange?.(null);
      const labels: Record<string, string> = {
        strength: '+1 Strength', dexterity: '+1 Dexterity', technology: '+1 Tech', support: '+1 Support',
        defense: '+1 Defense', resistance: '+1 Resistance', max_hp: '+5 Max HP', max_energy: '+3 Max MP',
      };
      toast.success(labels[stat] ?? `+1 ${stat}`);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading || !c) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const meta = (CLASS_META as any)[c.class];
  const maxHp = Math.floor(100 + c.strength * 8 + c.level * 12) + (c.bonus_max_hp ?? 0);
  const maxMp = 100 + c.technology * 2 + (c.bonus_max_mp ?? 0);
  const canSpend = c.stat_points > 0;

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

        {(c.stat_points > 0 || c.skill_points > 0) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {c.stat_points > 0 && (
              <Badge className="bg-secondary/80"><Award className="w-3 h-3 mr-1" /> {c.stat_points} stat pts</Badge>
            )}
            {c.skill_points > 0 && (
              <Badge className="bg-primary/80"><Award className="w-3 h-3 mr-1" /> {c.skill_points} skill pts</Badge>
            )}
          </div>
        )}
      </div>

      <div className="game-card rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2 flex items-center justify-between">
          <span>VITALS</span>
          {canSpend && <span className="text-[10px] text-secondary">Tap + to spend</span>}
        </h3>
        <BarSpend
          icon={<Heart className="w-4 h-4 text-health" />} label="Max HP" value={maxHp} max={maxHp} color="bg-health"
          plusLabel="+5" onPlus={() => handleSpend('max_hp')} disabled={!canSpend || busy === 'max_hp'} busy={busy === 'max_hp'}
        />
        <BarSpend
          icon={<Zap className="w-4 h-4 text-energy" />} label="Max MP" value={maxMp} max={maxMp} color="bg-energy"
          plusLabel="+3" onPlus={() => handleSpend('max_energy')} disabled={!canSpend || busy === 'max_energy'} busy={busy === 'max_energy'}
        />
      </div>

      <div className="game-card rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2 flex items-center justify-between">
          <span>ATTRIBUTES</span>
          {c.stat_points > 0 && <span className="text-[10px] text-secondary">Tap + to spend</span>}
        </h3>
        <div className="grid grid-cols-1 gap-2">
          <Stat icon={<Sword className="w-4 h-4 text-secondary" />} label="Strength" value={c.strength}
                onPlus={() => handleSpend('strength')} disabled={c.stat_points <= 0 || busy === 'strength'} busy={busy === 'strength'} />
          <Stat icon={<Brain className="w-4 h-4 text-primary" />} label="Dexterity" value={c.dexterity}
                onPlus={() => handleSpend('dexterity')} disabled={c.stat_points <= 0 || busy === 'dexterity'} busy={busy === 'dexterity'} />
          <Stat icon={<Cpu className="w-4 h-4 text-neon-purple" />} label="Tech" value={c.technology}
                onPlus={() => handleSpend('technology')} disabled={c.stat_points <= 0 || busy === 'technology'} busy={busy === 'technology'} />
          <Stat icon={<Users className="w-4 h-4 text-neon-green" />} label="Support" value={c.support}
                onPlus={() => handleSpend('support')} disabled={c.stat_points <= 0 || busy === 'support'} busy={busy === 'support'} />
          <Stat icon={<Shield className="w-4 h-4 text-shield" />} label="Defense" value={c.defense}
                onPlus={() => handleSpend('defense')} disabled={c.stat_points <= 0 || busy === 'defense'} busy={busy === 'defense'}
                hint="Reduces physical damage" />
          <Stat icon={<ShieldCheck className="w-4 h-4 text-energy" />} label="Resistance" value={c.resistance}
                onPlus={() => handleSpend('resistance')} disabled={c.stat_points <= 0 || busy === 'resistance'} busy={busy === 'resistance'}
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

      <div className="game-card rounded-lg p-4 flex items-center justify-between">
        <span className="font-orbitron text-sm text-muted-foreground flex items-center gap-2">
          <Coins className="w-4 h-4 text-shield" /> CREDITS
        </span>
        <span className="font-orbitron text-lg text-shield">{c.credits.toLocaleString()}</span>
      </div>
    </div>
  );
};

const Bar = ({ icon, label, value, max, color }: { icon: React.ReactNode; label: string; value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-foreground">{icon} {label}</span>
        <span className="text-muted-foreground">{value} / {max}</span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const Stat = ({
  icon, label, value, onPlus, disabled, busy, hint,
}: { icon: React.ReactNode; label: string; value: number; onPlus: () => void; disabled: boolean; busy: boolean; hint?: string }) => (
  <div className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5">
    {icon}
    <div className="flex-1 min-w-0">
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      {hint && <div className="text-[10px] text-muted-foreground/70 truncate">{hint}</div>}
    </div>
    <span className="font-orbitron text-sm w-8 text-right">{value}</span>
    <Button size="icon" variant="outline" className="h-7 w-7" disabled={disabled} onClick={onPlus}>
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
    </Button>
  </div>
);

const BarSpend = ({
  icon, label, value, max, color, plusLabel, onPlus, disabled, busy,
}: {
  icon: React.ReactNode; label: string; value: number; max: number; color: string;
  plusLabel: string; onPlus: () => void; disabled: boolean; busy: boolean;
}) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-foreground">{icon} {label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{value} / {max}</span>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={disabled} onClick={onPlus}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : plusLabel}
          </Button>
        </div>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
