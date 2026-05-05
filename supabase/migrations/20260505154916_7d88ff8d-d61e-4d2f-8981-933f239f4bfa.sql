
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS equipped_armor_id uuid,
  ADD COLUMN IF NOT EXISTS equipped_weapon_id uuid;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS sprite_layer text,
  ADD COLUMN IF NOT EXISTS sprite_variant text;

ALTER TABLE public.player_state
  ADD COLUMN IF NOT EXISTS equipped_armor_variant text,
  ADD COLUMN IF NOT EXISTS equipped_weapon_variant text;

DROP FUNCTION IF EXISTS public.get_zone_players(text);

CREATE OR REPLACE FUNCTION public.get_zone_players(_zone_id text)
 RETURNS TABLE(user_id uuid, display_name text, character_class character_class, character_level integer, x_position integer, y_position integer, facing text, is_in_battle boolean, equipped_armor_variant text, equipped_weapon_variant text, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT user_id, display_name, character_class, character_level,
         x_position, y_position, facing, is_in_battle,
         equipped_armor_variant, equipped_weapon_variant, updated_at
  FROM public.player_state
  WHERE zone_id = _zone_id
    AND updated_at > now() - interval '1 minute';
$function$;
