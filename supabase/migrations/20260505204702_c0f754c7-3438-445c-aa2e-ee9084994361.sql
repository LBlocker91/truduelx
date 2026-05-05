
-- 1. Add HP/MP bonus columns on characters
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS bonus_max_hp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_max_mp integer NOT NULL DEFAULT 0;

-- 2. Extend item_slot enum with consumable
ALTER TYPE item_slot ADD VALUE IF NOT EXISTS 'consumable';

-- 3. Add consumable flag + subtype on items
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS consumable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtype text;

-- 4. Add quantity on inventory
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
