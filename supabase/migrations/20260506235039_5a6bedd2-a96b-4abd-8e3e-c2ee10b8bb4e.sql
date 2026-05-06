ALTER TYPE item_slot ADD VALUE IF NOT EXISTS 'gun';
ALTER TYPE item_slot ADD VALUE IF NOT EXISTS 'launcher';
ALTER TYPE item_slot ADD VALUE IF NOT EXISTS 'staff';

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS equipped_gun_id uuid,
  ADD COLUMN IF NOT EXISTS equipped_launcher_id uuid,
  ADD COLUMN IF NOT EXISTS equipped_staff_id uuid;