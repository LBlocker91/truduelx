
-- 1. credit_reward on enemies
ALTER TABLE public.npc_enemies
  ADD COLUMN IF NOT EXISTS credit_reward integer NOT NULL DEFAULT 10;

UPDATE public.npc_enemies
   SET credit_reward = 25
 WHERE npc_id = 'enemy-training-drone';

-- 2. character_skills (unlocked class skills per character)
CREATE TABLE IF NOT EXISTS public.character_skills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  skill_slug    text NOT NULL,
  rank          integer NOT NULL DEFAULT 1,
  unlocked_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, skill_slug)
);

ALTER TABLE public.character_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_select_own"
  ON public.character_skills FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.characters c
     WHERE c.id = character_skills.character_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "cs_insert_own"
  ON public.character_skills FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.characters c
     WHERE c.id = character_skills.character_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "cs_update_own"
  ON public.character_skills FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.characters c
     WHERE c.id = character_skills.character_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "cs_delete_own"
  ON public.character_skills FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.characters c
     WHERE c.id = character_skills.character_id AND c.user_id = auth.uid()
  ));
