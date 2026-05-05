// Server-side leveling helpers used by npc-battle and claim-quest-reward.
// Pacing target (≈1 hr/day):
//   - L1→20: ~3 days  → quick early growth
//   - L20→50: ~14 days
//   - L50→100: ~300 days (long endgame grind)
//
// Curve is piecewise quadratic on the level so that successive levels need
// progressively more XP, with a steep coefficient bump after L20 and L50.

export const MAX_LEVEL = 100;

export function xpForNextLevel(level: number): number {
  if (level < 1) return 200;
  if (level <= 20) {
    // Fast: ~200 → ~2,000 over levels 1..20
    return 100 + level * 100;
  }
  if (level <= 50) {
    // Medium: ~3,000 → ~25,000
    return 1500 + (level - 20) * (level - 20) * 25 + (level - 20) * 200;
  }
  // Slow endgame: scales hard
  return 25_000 + (level - 50) * (level - 50) * 200 + (level - 50) * 1_500;
}

// Stat points granted on level up (matches client tier rule).
export function statPointsOnLevel(level: number): number {
  if (level <= 50) return 4;
  if (level <= 80) return 3;
  return 2;
}
export const SKILL_POINTS_PER_LEVEL = 1;

export function calcMaxHp(strength: number, level: number): number {
  return Math.floor(100 + strength * 8 + level * 12);
}

export interface ApplyXpInput {
  xp: number;
  level: number;
  statPoints: number;
  skillPoints: number;
  strength: number;
}

export interface ApplyXpResult {
  xp: number;
  level: number;
  statPoints: number;
  skillPoints: number;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
  statPointsGained: number;
  skillPointsGained: number;
  oldMaxHp: number;
  newMaxHp: number;
  maxHpGained: number;
}

export function applyXp(c: ApplyXpInput, gained: number): ApplyXpResult {
  const oldLevel = c.level;
  const oldMaxHp = calcMaxHp(c.strength, c.level);

  let xp = c.xp + Math.max(0, Math.floor(gained));
  let level = c.level;
  let statPoints = c.statPoints;
  let skillPoints = c.skillPoints;
  let statPointsGained = 0;
  let skillPointsGained = 0;

  while (level < MAX_LEVEL) {
    const need = xpForNextLevel(level);
    if (xp < need) break;
    xp -= need;
    level += 1;
    const sp = statPointsOnLevel(level);
    statPoints += sp;
    skillPoints += SKILL_POINTS_PER_LEVEL;
    statPointsGained += sp;
    skillPointsGained += SKILL_POINTS_PER_LEVEL;
  }
  if (level >= MAX_LEVEL) xp = 0;

  const newMaxHp = calcMaxHp(c.strength, level);

  return {
    xp,
    level,
    statPoints,
    skillPoints,
    oldLevel,
    newLevel: level,
    levelsGained: level - oldLevel,
    statPointsGained,
    skillPointsGained,
    oldMaxHp,
    newMaxHp,
    maxHpGained: newMaxHp - oldMaxHp,
  };
}
