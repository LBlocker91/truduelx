ALTER TABLE public.battle_participants ADD COLUMN IF NOT EXISTS ultimate_charge integer NOT NULL DEFAULT 0;
ALTER TABLE public.npc_enemies ADD COLUMN IF NOT EXISTS hp_multiplier numeric NOT NULL DEFAULT 1.6;
UPDATE public.npc_enemies SET hp_multiplier = 1.8 WHERE hp_multiplier = 1.6;