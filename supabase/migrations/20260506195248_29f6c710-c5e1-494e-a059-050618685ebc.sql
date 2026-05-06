-- Extend item_slot enum with new slots
ALTER TYPE public.item_slot ADD VALUE IF NOT EXISTS 'wings';
ALTER TYPE public.item_slot ADD VALUE IF NOT EXISTS 'pet';

-- Add metadata columns to items
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS damage_type text,
  ADD COLUMN IF NOT EXISTS weapon_subtype text;

-- Add new equipped slots to characters
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS equipped_wings_id uuid,
  ADD COLUMN IF NOT EXISTS equipped_pet_id uuid;