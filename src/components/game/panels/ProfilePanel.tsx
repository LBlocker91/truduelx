import { useEffect, useState } from 'react';
import { Loader2, Heart, Zap, Sword, Brain, Cpu, Users, Award, Coins, Crown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { loadCharacter } from '@/lib/characters-db';
import { xpForLevel } from '@/lib/leveling';
import { CLASS_META } from '@/data/class-definitions';
import type { Character } from '@/types/game';

interface ProfilePanelProps {
  characterId: string;
}

interface EquippedItem {
  name: string;
  rarity: string;
  slot: string;
  min_damage: number | null;
  max_damage: number | null;
  defense: number;
}

export const ProfilePanel = ({ characterId }: ProfilePanelProps) => {
  const [c, setC] = useState<Character | null>(null);
  const [credits, setCredits] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [equipped, setEquipped] = useState<EquippedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [character, charRow, profile] = await Promise.all([
          loadCharacter(characterId),
          supabase.from('characters').select('credits, equipped_weapon_id, equipped_armor_id').eq('id', characterId).maybeSingle(),
          supabase.auth.getUser().then(async ({ data }) => {
            if (!data.user) return null;
            return (await supabase.from('profiles').select('is_premium').eq('user_id', data.user.id).maybeSingle()).data;
          }),
        ]);
        setC(character);
        setCredits(charRow.data?.credits ?? 0);
        setIsPremium(!!profile?.is_premium);

        const ids = [charRow.data?.equipped_weapon_id, charRow.data?.equipped_armor_id].filter(Boolean) as string[];
        if (ids.length) {
          const { data: items } = await supabase
            .from('items')
            .select('name, rarity, slot, min_damage, max_damage, defense')
            .in('id', ids);
          setEquipped(items ?? []);
        } else {
          setEquipped([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [characterId]);

  if (loading || !c) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const meta = CLASS_META[c.class];
  const xpNeeded = xpForLevel(c.level);
  const xpPct = Math.min(100, Math.round((c.xp / xpNeeded) * 100));

  return (
    <div className="space-y-4">
      <div className="game-card rounded-lg p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className={`font-orbitron text-xl font-bold ${meta?.color ?? ''}`}>{c.name}</h2>
            <p className="text-sm text-muted-foreground">Lv {c.level} {meta?.name ?? c.class}</p>
          </div>
          {isPremium && (
            <Badge variant="outline" className="text-shield border-shield/50">
              <Crown className="w-3 h-3 mr-1" /> Premium
            </Badge>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>XP</span>
            <span>{c.xp.toLocaleString()} / {xpNeeded.toLocaleString()}</span>
          </div>
          <Progress value={xpPct} className="h-2" />
          <p className="text-[10px] text-muted-foreground">
            {(xpNeeded - c.xp).toLocaleString()} XP to next level
          </p>
        </div>

        {(c.statPoints > 0 || c.skillPoints > 0) && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {c.statPoints > 0 && (
              <Badge className="bg-secondary/80"><Award className="w-3 h-3 mr-1" /> {c.statPoints} stat pts</Badge>
            )}
            {c.skillPoints > 0 && (
              <Badge className="bg-primary/80"><Award className="w-3 h-3 mr-1" /> {c.skillPoints} skill pts</Badge>
            )}
          </div>
        )}
      </div>

      <div className="game-card rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2">VITALS</h3>
        <Bar icon={<Heart className="w-4 h-4 text-health" />} label="Health" value={c.stats.health} max={c.stats.maxHealth} color="bg-health" />
        <Bar icon={<Zap className="w-4 h-4 text-energy" />} label="Energy" value={c.stats.energy} max={c.stats.maxEnergy} color="bg-energy" />
      </div>

      <div className="game-card rounded-lg p-4">
        <h3 className="font-orbitron text-sm text-muted-foreground mb-2">ATTRIBUTES</h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat icon={<Sword className="w-4 h-4 text-secondary" />} label="Strength" value={c.stats.strength} />
          <Stat icon={<Brain className="w-4 h-4 text-primary" />} label="Dexterity" value={c.stats.dexterity} />
          <Stat icon={<Cpu className="w-4 h-4 text-neon-purple" />} label="Technology" value={c.stats.technology} />
          <Stat icon={<Users className="w-4 h-4 text-neon-green" />} label="Support" value={c.stats.support} />
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
        <span className="font-orbitron text-lg text-shield">{credits.toLocaleString()}</span>
      </div>
    </div>
  );
};

const Bar = ({
  icon, label, value, max, color,
}: { icon: React.ReactNode; label: string; value: number; max: number; color: string }) => {
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

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5">
    {icon}
    <span className="text-xs text-muted-foreground flex-1">{label}</span>
    <span className="font-orbitron text-sm">{value}</span>
  </div>
);
