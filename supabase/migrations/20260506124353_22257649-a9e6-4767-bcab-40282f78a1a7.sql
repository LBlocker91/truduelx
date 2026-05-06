-- Vibranium + stat allocations
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS vibranium integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stat_allocations jsonb NOT NULL DEFAULT '{"strength":0,"dexterity":0,"technology":0,"support":0,"defense":0,"resistance":0,"max_hp":0,"max_energy":0}'::jsonb;

-- Grant existing characters 100 Vibranium for testing
UPDATE public.characters SET vibranium = 100 WHERE vibranium = 0;

-- Backfill character_skills.rank to at least 1
UPDATE public.character_skills SET rank = 1 WHERE rank IS NULL OR rank < 1;

-- Backfill characters.skill_levels: ensure any existing slug entry is at least 1
UPDATE public.characters
SET skill_levels = (
  SELECT COALESCE(jsonb_object_agg(k, CASE WHEN (v::text)::int < 1 THEN to_jsonb(1) ELSE v END), '{}'::jsonb)
  FROM jsonb_each(skill_levels) AS e(k, v)
)
WHERE skill_levels IS NOT NULL AND skill_levels <> '{}'::jsonb;

-- Insert 9 class ultimates (idempotent on slug)
INSERT INTO public.skills (slug, name, description, class, type, scale_stat, base_damage, energy_cost, cooldown, hits, effect, effect_value, unlock_level, max_level)
VALUES
  -- Mercenary
  ('titan-breaker',    'Titan Breaker',    'Devastating overhead strike that crushes armor.',           'mercenary', 'physical', 'strength', 180, 35, 4, 1, 'none',            0,  5, 20),
  ('warzone-slam',     'Warzone Slam',     'Shockwave slam that weakens enemy defense.',                'mercenary', 'physical', 'strength', 220, 50, 6, 1, 'debuff_defense', 25, 20, 20),
  ('omega-berserker',  'Omega Berserker',  'Unleash fury: massive hit and self-empower.',               'mercenary', 'physical', 'strength', 320, 70, 8, 1, 'buff_attack',    30, 50, 20),
  -- Tech Mage
  ('plasma-nova',      'Plasma Nova',      'Eruption of plasma energy that scorches the target.',       'tech-mage', 'magical',  'technology', 175, 35, 4, 1, 'none',          0,  5, 20),
  ('gravity-lock',     'Gravity Lock',     'Crushing gravity field that may stun the target.',          'tech-mage', 'magical',  'technology', 200, 50, 6, 1, 'stun',          1, 20, 20),
  ('singularity-storm','Singularity Storm','Collapsing singularity that annihilates the enemy.',        'tech-mage', 'magical',  'technology', 330, 75, 8, 1, 'dot',          15, 50, 20),
  -- Gunner
  ('deadeye-burst',    'Deadeye Burst',    'Precision burst fire that strikes vital points.',           'gunner',    'physical', 'dexterity', 170, 30, 4, 1, 'none',           0,  5, 20),
  ('trap-field',       'Trap Field',       'Deploys a trap field that may stun and weaken.',            'gunner',    'special',  'dexterity', 190, 50, 6, 1, 'stun',           1, 20, 20),
  ('phantom-execution','Phantom Execution','A finishing shot that hits much harder on low-HP foes.',    'gunner',    'physical', 'dexterity', 310, 70, 8, 1, 'bonus_low_hp',  50, 50, 20)
ON CONFLICT (slug) DO NOTHING;