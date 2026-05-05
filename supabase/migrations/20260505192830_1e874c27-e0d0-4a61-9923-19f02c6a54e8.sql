INSERT INTO public.npcs (id, zone_id, name, type, position_x, position_y, dialogue)
VALUES (
  'enemy-training-drone',
  'station-hub',
  'Training Drone',
  'enemy',
  800, 700,
  'A combat training drone used by hub recruits. Safe to engage.'
)
ON CONFLICT (id) DO UPDATE
  SET zone_id = EXCLUDED.zone_id,
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      dialogue = EXCLUDED.dialogue;

INSERT INTO public.npc_enemies (
  npc_id, level, class, strength, dexterity, technology, support, defense,
  weapon_min, weapon_max, xp_reward, skill_slugs
) VALUES (
  'enemy-training-drone', 1, 'mercenary',
  8, 8, 6, 6, 0,
  40, 60, 25,
  ARRAY['measured-strike']::text[]
)
ON CONFLICT (npc_id) DO UPDATE
  SET level = EXCLUDED.level,
      strength = EXCLUDED.strength,
      dexterity = EXCLUDED.dexterity,
      technology = EXCLUDED.technology,
      support = EXCLUDED.support,
      defense = EXCLUDED.defense,
      weapon_min = EXCLUDED.weapon_min,
      weapon_max = EXCLUDED.weapon_max,
      xp_reward = EXCLUDED.xp_reward,
      skill_slugs = EXCLUDED.skill_slugs;

INSERT INTO public.quests (id, name, description, giver_npc_id, objectives, rewards) VALUES
  (
    'q-first-calibration',
    'First Calibration',
    'Commander Hale wants you to prove your gear works. Defeat a Training Drone.',
    'quest-commander',
    '{"defeat": {"enemy-training-drone": 1}}'::jsonb,
    '{"xp": 120, "credits": 50}'::jsonb
  ),
  (
    'q-secure-station',
    'Secure the Station',
    'Hostile drones have been spotted near the hub. Take down 3 Training Drones.',
    'quest-commander',
    '{"defeat": {"enemy-training-drone": 3}}'::jsonb,
    '{"xp": 280, "credits": 120, "skill_points": 1}'::jsonb
  ),
  (
    'q-supply-run',
    'Supply Run',
    'Scout Junko needs a courier. Clear a hostile patrol on your way to the Quartermaster.',
    'quest-scout',
    '{"defeat": {"enemy-training-drone": 1}}'::jsonb,
    '{"xp": 100, "credits": 60}'::jsonb
  ),
  (
    'q-field-repairs',
    'Field Repairs',
    'Doc Circuits is testing field-recovery protocols. Win two Training Drone fights to gather data.',
    'vendor-tech',
    '{"defeat": {"enemy-training-drone": 2}}'::jsonb,
    '{"xp": 200, "credits": 90}'::jsonb
  ),
  (
    'q-weapon-test',
    'Weapon Test',
    'Tinker Mira wants live combat data. Equip a weapon and win a fight.',
    'vendor-armor',
    '{"defeat": {"enemy-training-drone": 1}}'::jsonb,
    '{"xp": 150, "credits": 80}'::jsonb
  )
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      giver_npc_id = EXCLUDED.giver_npc_id,
      objectives = EXCLUDED.objectives,
      rewards = EXCLUDED.rewards;