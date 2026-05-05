import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Lock, Check, Plus, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { unlockClassSkill } from '@/lib/overworld';
import type { LevelUpInfo } from '@/pages/Index';

interface SkillsPanelProps {
  characterId: string;
  refreshTick?: number;
  onProgressionChange?: (level?: LevelUpInfo | null) => void;
}

interface CharRow {
  id: string;
  class: string;
  level: number;
  skill_points: number;
  skill_levels: Record<string, number>;
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
}

export const SkillsPanel = ({ characterId, refreshTick, onProgressionChange }: SkillsPanelProps) => {
  const [c, setC] = useState<CharRow | null>(null);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: charRow } = await supabase.from('characters')
        .select('id, class, level, skill_points, skill_levels')
        .eq('id', characterId).maybeSingle();
      if (!charRow) return;
      setC(charRow as CharRow);
      const { data: skillRows } = await supabase.from('skills')
        .select('slug, name, description, class, unlock_level, energy_cost, cooldown, base_damage, scale_stat, type, effect')
        .eq('class', charRow.class).order('unlock_level');
      setSkills((skillRows ?? []) as SkillRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [characterId, refreshTick]);

  const handleUnlock = async (slug: string) => {
    if (!c || c.skill_points <= 0 || busy) return;
    setBusy(slug);
    try {
      const r = await unlockClassSkill(characterId, slug);
      setC({
        ...c,
        skill_points: r.character.skill_points,
        skill_levels: r.character.skill_levels ?? {},
      });
      onProgressionChange?.(null);
      toast.success(`Unlocked ${r.skill?.name ?? slug}`);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading || !c) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="game-card rounded-lg p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Class</p>
          <p className="font-orbitron capitalize">{c.class}</p>
        </div>
        <Badge className="bg-primary/80">
          <Award className="w-3 h-3 mr-1" /> {c.skill_points} skill pts
        </Badge>
      </div>

      {skills.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No skills found for this class.</p>
      )}

      {skills.map((s) => {
        const learned = (c.skill_levels?.[s.slug] ?? 0) >= 1;
        const lvlOk = c.level >= s.unlock_level;
        const canUnlock = !learned && lvlOk && c.skill_points > 0;
        return (
          <div key={s.slug}
            className={`game-card rounded-lg p-3 ${learned ? 'border-primary/40 bg-primary/5' : !lvlOk ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-2">
              <Sparkles className={`w-4 h-4 mt-0.5 ${learned ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-orbitron text-sm">{s.name}</h4>
                  <span className="text-[10px] text-muted-foreground">Lv {s.unlock_level}+</span>
                  {learned && <Badge variant="outline" className="text-[9px] text-primary border-primary/40">UNLOCKED</Badge>}
                </div>
                {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-rajdhani">
                  <span>⚡ {s.energy_cost}</span>
                  <span>CD {s.cooldown}</span>
                  <span>DMG {s.base_damage}</span>
                  <span className="capitalize">scales: {s.scale_stat}</span>
                  <span className="capitalize">type: {s.type}</span>
                  {s.effect && s.effect !== 'none' && <span>FX: {s.effect}</span>}
                </div>
              </div>
              <div className="flex items-center">
                {learned ? (
                  <Check className="w-5 h-5 text-primary" />
                ) : !lvlOk ? (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Button size="icon" variant="outline" className="h-8 w-8" disabled={!canUnlock || busy === s.slug}
                    onClick={() => handleUnlock(s.slug)} title="Spend 1 skill point to unlock">
                    {busy === s.slug ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-4 h-4" />}
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
