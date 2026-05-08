
-- 1. Add mythical rarity tier
ALTER TYPE public.item_rarity ADD VALUE IF NOT EXISTS 'mythical';

-- 2. Boss flag on NPCs
ALTER TABLE public.npc_enemies
  ADD COLUMN IF NOT EXISTS is_boss boolean NOT NULL DEFAULT false;
UPDATE public.npc_enemies SET is_boss = true WHERE level >= 9;

-- 3. Premium / diamond pricing on items
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_diamonds integer,
  ADD COLUMN IF NOT EXISTS base_value integer;

-- Backfill base_value (sell-reference price) by rarity / level when not set.
UPDATE public.items SET base_value =
  CASE rarity
    WHEN 'common'    THEN 40  + level_req * 10
    WHEN 'uncommon'  THEN 90  + level_req * 18
    WHEN 'rare'      THEN 220 + level_req * 35
    WHEN 'epic'      THEN 600 + level_req * 70
    WHEN 'legendary' THEN 1500 + level_req * 140
    ELSE 50
  END
WHERE base_value IS NULL;

-- 4. Upgrade level per inventory copy
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS upgrade_level integer NOT NULL DEFAULT 0;
