-- Insert intro quest chain. Uses the existing quests table with extended objective shape.
-- Objectives may now include: defeat (existing), talk { npc-id: 1 }, visit_zone { zone-id: 1 }, open_build { any: 1 }.
-- Rewards may include next_quest_id (string) to auto-accept the next quest on claim.

INSERT INTO public.quests (id, name, description, giver_npc_id, objectives, rewards) VALUES
('q-init-1-report',
 'Report to Marshal Kael Orin',
 'New on the station? Find the marshal at the central platform and check in. He runs the merc board.',
 NULL,
 '{"talk": {"quest-commander": 1}}'::jsonb,
 '{"xp": 40, "credits": 25, "next_quest_id": "q-init-2-calibrate"}'::jsonb),

('q-init-2-calibrate',
 'Calibrate Your Combat Rig',
 'Hale wants you to take a swing at a Calibration Unit Mk-I. Standard procedure — break it, prove the rig works.',
 'quest-commander',
 '{"defeat": {"enemy-training-drone": 1}}'::jsonb,
 '{"xp": 90, "credits": 35, "next_quest_id": "q-init-3-build"}'::jsonb),

('q-init-3-build',
 'Check Your Build',
 'Open your character build screen. Allocate stats, review skills — your rig is what keeps you alive out there.',
 'quest-commander',
 '{"open_build": {"any": 1}}'::jsonb,
 '{"xp": 60, "next_quest_id": "q-init-4-supply"}'::jsonb),

('q-init-4-supply',
 'Supply Run',
 'Stop by Medic Nara Coil. She''ll set you up with something to keep you breathing in the field.',
 NULL,
 '{"talk": {"vendor-armor": 1}}'::jsonb,
 '{"xp": 70, "credits": 50, "next_quest_id": "q-init-5-recon"}'::jsonb),

('q-init-5-recon',
 'Neon District Recon',
 'The Marshal wants eyes on the District. Travel there and survey the situation.',
 NULL,
 '{"visit_zone": {"neon-district": 1}}'::jsonb,
 '{"xp": 80, "next_quest_id": "q-init-6-threat"}'::jsonb),

('q-init-6-threat',
 'Street Threat',
 'Local Syndicate is muscling in. Take down a Neon Gangster and send a message back.',
 NULL,
 '{"defeat": {"enemy-gangster": 1}}'::jsonb,
 '{"xp": 160, "credits": 75, "next_quest_id": "q-init-7-return"}'::jsonb),

('q-init-7-return',
 'Return and Report',
 'Head back to Bazaar Station and check in with Marshal Kael Orin. You''ve earned a real merc rating.',
 NULL,
 '{"talk": {"quest-commander": 1}, "visit_zone": {"station-hub": 1}}'::jsonb,
 '{"xp": 220, "credits": 120, "skill_points": 1}'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  giver_npc_id = EXCLUDED.giver_npc_id,
  objectives = EXCLUDED.objectives,
  rewards = EXCLUDED.rewards;