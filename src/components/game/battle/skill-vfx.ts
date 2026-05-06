/** Map a skill (or basic attack) to a visual VFX category for the BattleStage. */

export type SkillVfx =
  | 'physical_light'    // jab/quick strike
  | 'physical_heavy'    // shockwave/heavy impact
  | 'ranged_shot'       // tracer/bullet
  | 'tech_bolt'         // plasma bolt
  | 'tech_aoe'          // plasma nova
  | 'support_heal'      // green heal glow
  | 'support_buff'      // golden buff ring
  | 'support_shield'    // shield shimmer
  | 'control_stun'      // electric ring lock
  | 'control_dot'       // sickly green/purple drip
  | 'ultimate';         // big VFX + camera shake banner

export interface SkillLike {
  slug?: string;
  type?: string;          // physical | magical | special
  effect?: string;        // stun | dot | heal | buff_attack | debuff_defense | dodge | damage_absorb | crit_buff | bonus_low_hp | cooldown_increase | none
  scale_stat?: string;    // strength | dexterity | technology | support
  base_damage?: number;
  energy_cost?: number;
}

/** Threshold for considering a skill an "ultimate" by raw cost/damage. */
const ULTIMATE_DMG = 280;
const ULTIMATE_MP = 60;

/** Classify a skill (or null = basic attack) into a VFX bucket.
 *  weaponVariant is used as a fallback for basic attacks / vague skills. */
export const classifySkillVfx = (
  skill: SkillLike | null | undefined,
  weaponVariant?: string | null,
): SkillVfx => {
  // Basic attack — drive by weapon
  if (!skill) {
    if (weaponVariant === 'gun') return 'ranged_shot';
    if (weaponVariant === 'staff') return 'tech_bolt';
    if (weaponVariant === 'axe') return 'physical_heavy';
    return 'physical_light';
  }

  const effect = (skill.effect ?? 'none').toLowerCase();
  const type = (skill.type ?? '').toLowerCase();
  const dmg = skill.base_damage ?? 0;
  const mp = skill.energy_cost ?? 0;

  // Ultimate detection — heavy damage OR very high cost
  const isUltimate = dmg >= ULTIMATE_DMG || mp >= ULTIMATE_MP;

  // Support / control effects take priority over raw damage type
  if (effect === 'heal') return 'support_heal';
  if (effect === 'buff_attack' || effect === 'crit_buff') return 'support_buff';
  if (effect === 'damage_absorb' || effect === 'dodge') return 'support_shield';
  if (effect === 'stun' || effect === 'cooldown_increase') return 'control_stun';
  if (effect === 'dot') return isUltimate ? 'ultimate' : 'control_dot';

  if (isUltimate) return 'ultimate';

  // Damage type
  if (type === 'magical') {
    return dmg >= 150 ? 'tech_aoe' : 'tech_bolt';
  }

  // Physical — split by scale stat
  const scale = (skill.scale_stat ?? '').toLowerCase();
  if (scale === 'dexterity' && (weaponVariant === 'gun' || /shot|fire|bullet|trap|mark/.test(skill.slug ?? '')))
    return 'ranged_shot';
  if (scale === 'support' && weaponVariant === 'gun') return 'ranged_shot';
  if (dmg >= 150) return 'physical_heavy';
  return 'physical_light';
};

/** Visual presets per VFX bucket. Hue used for projectiles, glows, damage numbers. */
export const VFX_PRESET: Record<SkillVfx, {
  hue: string;            // CSS hsl()
  damageColor: string;
  bannerColor: string;
  shake: 'none' | 'small' | 'large';
  hasProjectile: boolean;
  hasMuzzle: boolean;
  hasCharge: boolean;
  hasSlash: boolean;
  hasShockwave: boolean;
  hasHealAura: boolean;
  hasBuffRing: boolean;
  hasShieldDome: boolean;
  hasStunRing: boolean;
  hasDotDrip: boolean;
  isUltimate: boolean;
}> = {
  physical_light: {
    hue: 'hsl(15 100% 60%)',
    damageColor: 'hsl(20 100% 65%)',
    bannerColor: 'hsl(20 100% 70%)',
    shake: 'small', hasProjectile: false, hasMuzzle: false, hasCharge: false,
    hasSlash: true, hasShockwave: false, hasHealAura: false, hasBuffRing: false,
    hasShieldDome: false, hasStunRing: false, hasDotDrip: false, isUltimate: false,
  },
  physical_heavy: {
    hue: 'hsl(10 100% 55%)',
    damageColor: 'hsl(15 100% 60%)',
    bannerColor: 'hsl(15 100% 65%)',
    shake: 'large', hasProjectile: false, hasMuzzle: false, hasCharge: false,
    hasSlash: true, hasShockwave: true, hasHealAura: false, hasBuffRing: false,
    hasShieldDome: false, hasStunRing: false, hasDotDrip: false, isUltimate: false,
  },
  ranged_shot: {
    hue: 'hsl(45 100% 60%)',
    damageColor: 'hsl(45 100% 65%)',
    bannerColor: 'hsl(45 100% 70%)',
    shake: 'small', hasProjectile: true, hasMuzzle: true, hasCharge: false,
    hasSlash: false, hasShockwave: false, hasHealAura: false, hasBuffRing: false,
    hasShieldDome: false, hasStunRing: false, hasDotDrip: false, isUltimate: false,
  },
  tech_bolt: {
    hue: 'hsl(195 100% 65%)',
    damageColor: 'hsl(195 100% 70%)',
    bannerColor: 'hsl(195 100% 75%)',
    shake: 'small', hasProjectile: true, hasMuzzle: false, hasCharge: true,
    hasSlash: false, hasShockwave: false, hasHealAura: false, hasBuffRing: false,
    hasShieldDome: false, hasStunRing: false, hasDotDrip: false, isUltimate: false,
  },
  tech_aoe: {
    hue: 'hsl(280 100% 70%)',
    damageColor: 'hsl(280 100% 75%)',
    bannerColor: 'hsl(280 100% 75%)',
    shake: 'large', hasProjectile: true, hasMuzzle: false, hasCharge: true,
    hasSlash: false, hasShockwave: true, hasHealAura: false, hasBuffRing: false,
    hasShieldDome: false, hasStunRing: false, hasDotDrip: false, isUltimate: false,
  },
  support_heal: {
    hue: 'hsl(140 100% 60%)',
    damageColor: 'hsl(140 100% 60%)',
    bannerColor: 'hsl(140 100% 70%)',
    shake: 'none', hasProjectile: false, hasMuzzle: false, hasCharge: false,
    hasSlash: false, hasShockwave: false, hasHealAura: true, hasBuffRing: false,
    hasShieldDome: false, hasStunRing: false, hasDotDrip: false, isUltimate: false,
  },
  support_buff: {
    hue: 'hsl(45 100% 65%)',
    damageColor: 'hsl(45 100% 65%)',
    bannerColor: 'hsl(45 100% 70%)',
    shake: 'none', hasProjectile: false, hasMuzzle: false, hasCharge: false,
    hasSlash: false, hasShockwave: false, hasHealAura: false, hasBuffRing: true,
    hasShieldDome: false, hasStunRing: false, hasDotDrip: false, isUltimate: false,
  },
  support_shield: {
    hue: 'hsl(195 100% 70%)',
    damageColor: 'hsl(195 100% 70%)',
    bannerColor: 'hsl(195 100% 75%)',
    shake: 'none', hasProjectile: false, hasMuzzle: false, hasCharge: false,
    hasSlash: false, hasShockwave: false, hasHealAura: false, hasBuffRing: false,
    hasShieldDome: true, hasStunRing: false, hasDotDrip: false, isUltimate: false,
  },
  control_stun: {
    hue: 'hsl(55 100% 60%)',
    damageColor: 'hsl(195 100% 70%)',
    bannerColor: 'hsl(55 100% 65%)',
    shake: 'small', hasProjectile: true, hasMuzzle: false, hasCharge: true,
    hasSlash: false, hasShockwave: false, hasHealAura: false, hasBuffRing: false,
    hasShieldDome: false, hasStunRing: true, hasDotDrip: false, isUltimate: false,
  },
  control_dot: {
    hue: 'hsl(120 80% 50%)',
    damageColor: 'hsl(120 80% 60%)',
    bannerColor: 'hsl(120 80% 60%)',
    shake: 'small', hasProjectile: true, hasMuzzle: false, hasCharge: false,
    hasSlash: false, hasShockwave: false, hasHealAura: false, hasBuffRing: false,
    hasShieldDome: false, hasStunRing: false, hasDotDrip: true, isUltimate: false,
  },
  ultimate: {
    hue: 'hsl(330 100% 65%)',
    damageColor: 'hsl(45 100% 60%)',
    bannerColor: 'hsl(330 100% 70%)',
    shake: 'large', hasProjectile: true, hasMuzzle: true, hasCharge: true,
    hasSlash: true, hasShockwave: true, hasHealAura: false, hasBuffRing: false,
    hasShieldDome: false, hasStunRing: false, hasDotDrip: false, isUltimate: true,
  },
};
