## Goals

Balance NPC difficulty so only bosses are hard, add loot drops, item selling, premium diamond gear, gear upgrades, and a 6-tier rarity color system.

## 1. NPC Balance (server)

- Add `is_boss boolean default false` to `npc_enemies`. Mark current high-tier NPCs (level ≥ 10 or named "Calibration Unit", overseers, etc.) as bosses; everything else non-boss.
- Non-boss tuning in `_shared/combat.ts` / `npc-battle`:
  - Reduce non-boss `hp_multiplier` to ~1.0–1.2 (boss stays 1.6–2.0).
  - Reduce non-boss stat scaling (drop +levelBonus on all 4 stats; only +1/2 levels).
  - Cap non-boss damage % of player max HP at 18% (boss keeps 28/32/45).
- Bosses keep current scaling and ultimate behavior.

## 2. Loot Drops

On NPC defeat (in `npc-battle` resolve-victory path), roll drops:

- **Non-boss:** 1 roll. 35% potion (HP/MP), 12% common, 6% uncommon, 2% rare, 0.5% epic, 0.05% pet.
- **Boss:** 2–3 rolls, with weights shifted up: 15% rare, 8% epic, 2% legendary, 0.5% mythical, 1% pet.
- Pets are always extremely rare (≤1%). Insert into `inventory` (stack potions via existing `quantity`).
- Show drops in battle result payload so the UI can list "Loot acquired".

## 3. Item Selling

- New edge function `sell-item` (POST `{characterId, inventoryId, quantity?}`) — validates ownership, computes refund = `floor(item.price * 0.5 * qty)` (use `vendor_items.price` if present, else fallback table by rarity), credits `characters.credits`, decrements/deletes inventory row, refuses to sell currently-equipped items.
- Add a "Sell" button in `InventoryPanel` next to Equip/Unequip with confirm dialog.

## 4. Diamond Premium Currency & Gear

- `characters.vibranium` already exists — repurpose as **Diamonds** (rename UI label to "Diamonds" with a 💎 icon; column stays `vibranium` to avoid migration churn).
- Extend `items` with `price_diamonds integer null` and `is_premium boolean default false`.
- Seed ~6 premium weapons (1 per slot: melee/gun/launcher + 1 each rarity epic/legendary/mythical) with substantially higher damage (≈2× same-level common) and `is_premium=true`, `price_diamonds` set.
- Extend `buy-item` to accept either `credits` or `diamonds`; deducts from the right column.
- Diamonds earned: small amount from boss kills only (e.g., 1–3 per boss). No other source for now.

## 5. Gear Upgrades

- New table `inventory_upgrades` (or columns on `inventory`): add `upgrade_level int default 0` to `inventory`.
- Max upgrade level by rarity: common 3, uncommon 5, rare 7, epic 10, legendary 14, mythical 20.
- Each upgrade adds +8% to weapon `min/max_damage` or +8% to armor `defense` (compounded per level).
- Cost in credits: `base_cost * (level+1)^1.6` where `base_cost = 50 * rarityMult`. Mythical may also require diamonds at higher tiers (≥10).
- New edge function `upgrade-item` validates and applies.
- New "Upgrade" button in `InventoryPanel` showing `+N`, current/next stats, and cost.
- Combat reads upgrade level via the snapshot builder in `_shared/combat.ts` and applies the multiplier when computing weapon damage / defense.

## 6. Rarity Tiers + Color Coding

- Add `mythical` to `item_rarity` enum.
- Centralize rarity colors in `src/lib/rarity.ts` mapping to existing tokens:
  - common → muted, uncommon → neon-green, rare → primary (cyan), epic → neon-purple, legendary → shield (gold), mythical → new `--rarity-mythical` red/pink HSL token.
- Add the `--rarity-mythical` token + `text-rarity-mythical` / `border-rarity-mythical` to `index.css` and `tailwind.config.ts`.
- Replace inline `RARITY_COLOR` maps in `InventoryPanel`, `BuildPanel`, vendor UI, and battle drop list to use the shared helper.

## Technical Notes

- Single migration adds: `is_boss`, `price_diamonds`, `is_premium` on items; `upgrade_level` on inventory; `mythical` on the rarity enum; flags existing high-level NPCs as bosses; seeds the new premium items.
- Server-side combat balance and drop rolls live in `supabase/functions/npc-battle/index.ts` and `_shared/combat.ts`.
- Client changes: `InventoryPanel` (sell + upgrade buttons), shop UI (diamond pricing badge), HUD (diamond counter), `rarity.ts` helper.

## Out of Scope (this pass)

- No new in-app purchase flow for buying diamonds (treated as earned-only for now).
- No reforging / sockets / enchantments — only flat upgrade levels.
