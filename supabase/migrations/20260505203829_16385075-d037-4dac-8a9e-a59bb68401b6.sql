
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS defense integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS resistance integer NOT NULL DEFAULT 5;

UPDATE public.characters SET defense = 5 WHERE defense IS NULL OR defense < 0;
UPDATE public.characters SET resistance = 5 WHERE resistance IS NULL OR resistance < 0;

ALTER TABLE public.npc_enemies
  ADD COLUMN IF NOT EXISTS resistance integer NOT NULL DEFAULT 0;

-- npc_enemies.defense already exists per schema (default 0); ensure not null
UPDATE public.npc_enemies SET defense = 0 WHERE defense IS NULL;
UPDATE public.npc_enemies SET resistance = 0 WHERE resistance IS NULL;
