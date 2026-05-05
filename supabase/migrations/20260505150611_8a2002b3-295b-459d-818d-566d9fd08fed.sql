
-- ENUMS
CREATE TYPE public.character_class AS ENUM (
  'mercenary','tech-mage','gunner',
  'blademaster','tech-sentinel','tactician',
  'shadow-operative','demolisher','cyber-warden'
);
CREATE TYPE public.item_slot AS ENUM ('weapon','armor','helmet','gloves','boots','accessory');
CREATE TYPE public.item_rarity AS ENUM ('common','uncommon','rare','epic','legendary');
CREATE TYPE public.skill_effect AS ENUM (
  'none','stun','dot','energy_drain','buff_attack','debuff_defense','heal',
  'energy_recovery','defense_buff','crit_buff','damage_absorb',
  'damage_taken_increase','reflect','stat_buff_all','skill_disable',
  'cooldown_increase','dodge','bonus_low_hp'
);
CREATE TYPE public.scale_stat AS ENUM ('strength','dexterity','technology','support');
CREATE TYPE public.skill_type AS ENUM ('physical','magical','special');
CREATE TYPE public.battle_mode AS ENUM ('pve','pvp');
CREATE TYPE public.battle_status AS ENUM ('pending','active','finished','abandoned');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- CHARACTERS
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class public.character_class NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  stat_points INTEGER NOT NULL DEFAULT 0,
  skill_points INTEGER NOT NULL DEFAULT 0,
  strength INTEGER NOT NULL DEFAULT 10,
  dexterity INTEGER NOT NULL DEFAULT 10,
  technology INTEGER NOT NULL DEFAULT 10,
  support INTEGER NOT NULL DEFAULT 10,
  skill_levels JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_characters_user ON public.characters(user_id);
CREATE POLICY "characters_select_own" ON public.characters FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "characters_insert_own" ON public.characters FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "characters_update_own" ON public.characters FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "characters_delete_own" ON public.characters FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ITEMS
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  slot public.item_slot NOT NULL,
  rarity public.item_rarity NOT NULL DEFAULT 'common',
  level_req INTEGER NOT NULL DEFAULT 1,
  class_req public.character_class,
  stat_modifiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  min_damage INTEGER,
  max_damage INTEGER,
  defense INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_select_all" ON public.items FOR SELECT TO authenticated USING (true);

-- INVENTORY
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  equipped BOOLEAN NOT NULL DEFAULT false,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_inventory_char ON public.inventory(character_id);
CREATE POLICY "inventory_select_own" ON public.inventory FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "inventory_insert_own" ON public.inventory FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "inventory_update_own" ON public.inventory FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "inventory_delete_own" ON public.inventory FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));

-- SKILLS
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  class public.character_class NOT NULL,
  type public.skill_type NOT NULL DEFAULT 'physical',
  scale_stat public.scale_stat NOT NULL DEFAULT 'strength',
  base_damage INTEGER NOT NULL DEFAULT 0,
  energy_cost INTEGER NOT NULL DEFAULT 0,
  cooldown INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 1,
  effect public.skill_effect NOT NULL DEFAULT 'none',
  effect_value NUMERIC NOT NULL DEFAULT 0,
  unlock_level INTEGER NOT NULL DEFAULT 1,
  max_level INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skills_select_all" ON public.skills FOR SELECT TO authenticated USING (true);

-- BATTLES (no policy yet, added after participants exists)
CREATE TABLE public.battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode public.battle_mode NOT NULL,
  status public.battle_status NOT NULL DEFAULT 'pending',
  current_turn UUID,
  turn_number INTEGER NOT NULL DEFAULT 1,
  turn_deadline TIMESTAMPTZ,
  winner_user_id UUID,
  seed BIGINT NOT NULL DEFAULT (random() * 9223372036854775807)::BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_battles_status ON public.battles(status);

-- BATTLE PARTICIPANTS
CREATE TABLE public.battle_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id UUID,
  character_id UUID,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  slot SMALLINT NOT NULL,
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL,
  energy INTEGER NOT NULL,
  max_energy INTEGER NOT NULL,
  rage INTEGER NOT NULL DEFAULT 0,
  status_effects JSONB NOT NULL DEFAULT '[]'::jsonb,
  cooldowns JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot JSONB NOT NULL,
  UNIQUE(battle_id, slot)
);
ALTER TABLE public.battle_participants ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_bp_battle ON public.battle_participants(battle_id);
CREATE INDEX idx_bp_user ON public.battle_participants(user_id);

-- Helper to avoid recursive RLS on battle_participants self-reference
CREATE OR REPLACE FUNCTION public.is_battle_participant(_battle_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.battle_participants
    WHERE battle_id = _battle_id AND user_id = _user_id
  )
$$;

CREATE POLICY "bp_select_participant" ON public.battle_participants FOR SELECT TO authenticated
  USING (public.is_battle_participant(battle_id, auth.uid()));

CREATE POLICY "battles_select_participant" ON public.battles FOR SELECT TO authenticated
  USING (public.is_battle_participant(id, auth.uid()));

-- BATTLE ACTIONS
CREATE TABLE public.battle_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  actor_user_id UUID,
  actor_slot SMALLINT NOT NULL,
  action_type TEXT NOT NULL,
  skill_slug TEXT,
  target_slot SMALLINT,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.battle_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ba_battle ON public.battle_actions(battle_id, turn_number);
CREATE POLICY "ba_select_participant" ON public.battle_actions FOR SELECT TO authenticated
  USING (public.is_battle_participant(battle_id, auth.uid()));

-- MATCHMAKING
CREATE TABLE public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  mmr INTEGER NOT NULL DEFAULT 1000,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mmq_mmr ON public.matchmaking_queue(mmr);
CREATE POLICY "mmq_select_self" ON public.matchmaking_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mmq_insert_self" ON public.matchmaking_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mmq_delete_self" ON public.matchmaking_queue FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_characters_updated BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_battles_updated BEFORE UPDATE ON public.battles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, is_anonymous)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Pilot-' || substr(NEW.id::text, 1, 6)),
    COALESCE(NEW.is_anonymous, false)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_actions;
ALTER TABLE public.battles REPLICA IDENTITY FULL;
ALTER TABLE public.battle_participants REPLICA IDENTITY FULL;
ALTER TABLE public.battle_actions REPLICA IDENTITY FULL;
