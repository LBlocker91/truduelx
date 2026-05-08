// Shared rarity color tokens — used by inventory/build/shop UIs.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical';

export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-muted-foreground',
  uncommon: 'text-neon-green',
  rare: 'text-primary',
  epic: 'text-neon-purple',
  legendary: 'text-shield',
  mythical: 'text-neon-red',
};

export const RARITY_BORDER: Record<Rarity, string> = {
  common: 'border-muted/50',
  uncommon: 'border-neon-green/40',
  rare: 'border-primary/40',
  epic: 'border-neon-purple/40',
  legendary: 'border-shield/40',
  mythical: 'border-neon-red/60',
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];

/** Cap on upgrade levels per rarity. */
export const RARITY_MAX_UPGRADE: Record<Rarity, number> = {
  common: 3,
  uncommon: 5,
  rare: 7,
  epic: 10,
  legendary: 14,
  mythical: 20,
};

export const RARITY_UPGRADE_BASE_COST: Record<Rarity, number> = {
  common: 50,
  uncommon: 100,
  rare: 250,
  epic: 600,
  legendary: 1500,
  mythical: 4000,
};

/** Multiplicative bonus to weapon damage / armor defense per upgrade level. 8% per level. */
export function upgradeMultiplier(level: number): number {
  return Math.pow(1.08, Math.max(0, level | 0));
}

/** Sell value = floor(base_value * 0.5 * upgrade-bonus * quantity). */
export function sellValue(baseValue: number, upgradeLevel: number, quantity = 1): number {
  const refund = Math.floor(baseValue * 0.5 * upgradeMultiplier(upgradeLevel)) * Math.max(1, quantity);
  return Math.max(1, refund);
}

/** Upgrade cost for going from `level` → `level+1`. */
export function upgradeCost(rarity: Rarity, nextLevel: number): { credits: number; diamonds: number } {
  const base = RARITY_UPGRADE_BASE_COST[rarity] ?? 50;
  const credits = Math.floor(base * Math.pow(nextLevel + 1, 1.6));
  // Mythical needs diamonds beyond level 10
  const diamonds = rarity === 'mythical' && nextLevel >= 10 ? Math.ceil((nextLevel - 9) * 5) : 0;
  return { credits, diamonds };
}
