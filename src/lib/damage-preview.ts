// Mirror of supabase/functions/_shared/combat.ts resolveHit math, used for
// in-UI damage previews. Stays in sync by formula, not by import (edge runtime
// is Deno and cannot share modules with the browser bundle).

export type ScaleStat = 'strength' | 'dexterity' | 'technology' | 'support';
export type DamageType = 'physical' | 'energy' | 'hybrid';

export interface PreviewStats {
  level: number;
  strength: number;
  dexterity: number;
  technology: number;
  support: number;
  defense: number;
  resistance: number;
}

export interface PreviewWeapon {
  min: number;
  max: number;
  damageType: DamageType;
  scaleStat: ScaleStat;
  subtype?: string | null;
}

export interface PreviewSkill {
  baseDamage: number;
  scaleStat: ScaleStat;
  rank: number;
  /** physical | magical | special — same enum the DB uses */
  type: 'physical' | 'magical' | 'special';
}

export interface PreviewTarget {
  level: number;
  defense: number;
  resistance: number;
  strength: number;
  dexterity: number;
  technology: number;
}

export interface DamagePreview {
  min: number;
  max: number;
  avg: number;
  damageType: DamageType;
  scaleStat: ScaleStat;
  rankMult: number;
  mitPct: number;
}

const effectiveStr = (s: number) => (s <= 60 ? s : 60 + (s - 60) * 0.5);

const statScaleMult = (t: DamageType) => (t === 'physical' ? 1.6 : t === 'energy' ? 1.4 : 1.2);

const skillDamageType = (t: PreviewSkill['type']): DamageType =>
  t === 'magical' ? 'energy' : t === 'special' ? 'hybrid' : 'physical';

/** Sum gear stat_modifiers (and flat HP/MP bonuses) into a flat record. */
export function getEquippedBonuses(items: Array<{ stat_modifiers?: Record<string, number> | null; defense?: number | null }>) {
  const out: Record<string, number> = {
    strength: 0, dexterity: 0, technology: 0, support: 0,
    defense: 0, resistance: 0, max_hp: 0, max_energy: 0,
  };
  for (const it of items ?? []) {
    const m = it?.stat_modifiers ?? {};
    for (const k of Object.keys(out)) out[k] += Number((m as any)[k] ?? 0);
    out.defense += Number(it?.defense ?? 0);
  }
  return out;
}

/** Build a Lv-equivalent dummy target — used as the preview yardstick. */
export function dummyTarget(level: number): PreviewTarget {
  return {
    level,
    defense: 5 + level * 2,
    resistance: 5 + level * 2,
    strength: 10 + level,
    dexterity: 10 + level,
    technology: 10 + level,
  };
}

/** Compute min/max/avg damage for a given weapon + optional skill against target. */
export function calculateDamagePreview(opts: {
  attacker: PreviewStats;
  weapon: PreviewWeapon;
  skill?: PreviewSkill | null;
  target?: PreviewTarget;
}): DamagePreview {
  const { attacker, weapon, skill } = opts;
  const target = opts.target ?? dummyTarget(attacker.level);

  const dmgType: DamageType = skill ? skillDamageType(skill.type) : weapon.damageType;
  const scaleStat: ScaleStat = skill ? skill.scaleStat : weapon.scaleStat;

  const rawStat = attacker[scaleStat] ?? 0;
  const statVal = scaleStat === 'strength' ? effectiveStr(rawStat) : rawStat;
  const statPower = statVal * statScaleMult(dmgType);

  const rank = Math.max(1, skill?.rank ?? 1);
  const rankMult = 1 + (rank - 1) * 0.06;
  const levelPower = attacker.level * 1.5;
  const skillBase = skill?.baseDamage ?? 0;

  // Mitigation
  let mitStat: number;
  if (dmgType === 'physical') {
    mitStat = target.defense + target.strength * 0.4;
  } else if (dmgType === 'energy') {
    mitStat = target.resistance + target.technology * 0.4;
  } else {
    mitStat = (target.defense + target.resistance) / 2 + target.dexterity * 0.25;
  }
  const mitPct = Math.max(0, Math.min(0.85, mitStat / (mitStat + 100)));

  const calc = (roll: number) => {
    const raw = (roll + skillBase + statPower + levelPower) * rankMult;
    return Math.max(3, Math.floor(raw * (1 - mitPct)));
  };

  const min = calc(weapon.min);
  const max = calc(weapon.max);
  const avg = Math.round((min + max) / 2);

  return { min, max, avg, damageType: dmgType, scaleStat, rankMult, mitPct };
}
