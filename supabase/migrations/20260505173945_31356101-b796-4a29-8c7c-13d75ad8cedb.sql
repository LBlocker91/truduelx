ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_zone_id text,
  ADD COLUMN IF NOT EXISTS last_x integer,
  ADD COLUMN IF NOT EXISTS last_y integer;

CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters(user_id);