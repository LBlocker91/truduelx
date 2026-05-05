-- ZONES
CREATE TABLE public.zones (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  background_url text,
  width integer NOT NULL DEFAULT 1600,
  height integer NOT NULL DEFAULT 1000,
  spawn_x integer NOT NULL DEFAULT 800,
  spawn_y integer NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY zones_select_all ON public.zones FOR SELECT TO authenticated USING (true);

-- NPCs
CREATE TYPE public.npc_type AS ENUM ('vendor', 'quest', 'enemy');

CREATE TABLE public.npcs (
  id text PRIMARY KEY,
  zone_id text NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.npc_type NOT NULL,
  position_x integer NOT NULL,
  position_y integer NOT NULL,
  sprite text,
  dialogue text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_npcs_zone ON public.npcs(zone_id);
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY npcs_select_all ON public.npcs FOR SELECT TO authenticated USING (true);

-- NPC enemy combat stats
CREATE TABLE public.npc_enemies (
  npc_id text PRIMARY KEY REFERENCES public.npcs(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  class public.character_class NOT NULL,
  strength integer NOT NULL DEFAULT 10,
  dexterity integer NOT NULL DEFAULT 10,
  technology integer NOT NULL DEFAULT 10,
  support integer NOT NULL DEFAULT 10,
  weapon_min integer NOT NULL DEFAULT 80,
  weapon_max integer NOT NULL DEFAULT 100,
  defense integer NOT NULL DEFAULT 0,
  skill_slugs text[] NOT NULL DEFAULT ARRAY[]::text[],
  xp_reward integer NOT NULL DEFAULT 50
);
ALTER TABLE public.npc_enemies ENABLE ROW LEVEL SECURITY;
CREATE POLICY npc_enemies_select_all ON public.npc_enemies FOR SELECT TO authenticated USING (true);

-- Vendor items
CREATE TABLE public.vendor_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id text NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  price integer NOT NULL DEFAULT 100
);
CREATE INDEX idx_vendor_items_npc ON public.vendor_items(npc_id);
ALTER TABLE public.vendor_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_items_select_all ON public.vendor_items FOR SELECT TO authenticated USING (true);

-- QUESTS
CREATE TABLE public.quests (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  giver_npc_id text REFERENCES public.npcs(id) ON DELETE SET NULL,
  objectives jsonb NOT NULL DEFAULT '{}'::jsonb,
  rewards jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY quests_select_all ON public.quests FOR SELECT TO authenticated USING (true);

CREATE TABLE public.player_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quest_id text NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  claimed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_id)
);
ALTER TABLE public.player_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY pq_select_self ON public.player_quests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pq_insert_self ON public.player_quests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pq_update_self ON public.player_quests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pq_delete_self ON public.player_quests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PLAYER STATE (overworld presence)
CREATE TABLE public.player_state (
  user_id uuid PRIMARY KEY,
  zone_id text NOT NULL REFERENCES public.zones(id) ON DELETE SET DEFAULT DEFAULT 'station-hub',
  x_position integer NOT NULL DEFAULT 800,
  y_position integer NOT NULL DEFAULT 500,
  facing text NOT NULL DEFAULT 'down',
  is_in_battle boolean NOT NULL DEFAULT false,
  display_name text,
  character_class public.character_class,
  character_level integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_player_state_zone ON public.player_state(zone_id);
ALTER TABLE public.player_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps_select_self ON public.player_state FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ps_upsert_self ON public.player_state FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ps_update_self ON public.player_state FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Function to fetch other players in same zone (bypasses RLS, returns minimal info)
CREATE OR REPLACE FUNCTION public.get_zone_players(_zone_id text)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  character_class public.character_class,
  character_level integer,
  x_position integer,
  y_position integer,
  facing text,
  is_in_battle boolean,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, display_name, character_class, character_level,
         x_position, y_position, facing, is_in_battle, updated_at
  FROM public.player_state
  WHERE zone_id = _zone_id
    AND updated_at > now() - interval '1 minute';
$$;
REVOKE ALL ON FUNCTION public.get_zone_players(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_zone_players(text) TO authenticated;

-- Battles: track NPC opponent
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS npc_id text REFERENCES public.npcs(id) ON DELETE SET NULL;

-- Add 'pve_npc' to battle_mode enum
ALTER TYPE public.battle_mode ADD VALUE IF NOT EXISTS 'pve_npc';

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_state;