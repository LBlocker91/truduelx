
-- Expand zone sizes 3x and recenter spawns
UPDATE public.zones SET width = 4800, height = 3000, spawn_x = 2400, spawn_y = 2400 WHERE id = 'station-hub';
UPDATE public.zones SET width = 4800, height = 3000, spawn_x = 600,  spawn_y = 2500 WHERE id = 'wasteland';
UPDATE public.zones SET width = 4800, height = 3000, spawn_x = 4200, spawn_y = 2500 WHERE id = 'neon-district';

-- Spread NPCs across the larger maps
-- station-hub
UPDATE public.npcs SET position_x = 2400, position_y = 1900 WHERE zone_id = 'station-hub' AND name = 'Commander Hale';
UPDATE public.npcs SET position_x = 3600, position_y = 2300 WHERE zone_id = 'station-hub' AND name = 'Doc Circuits';
UPDATE public.npcs SET position_x = 900,  position_y = 2200 WHERE zone_id = 'station-hub' AND name = 'Quartermaster Vex';
UPDATE public.npcs SET position_x = 1500, position_y = 2700 WHERE zone_id = 'station-hub' AND name = 'Scout Junko';
UPDATE public.npcs SET position_x = 4100, position_y = 2700 WHERE zone_id = 'station-hub' AND name = 'Tinker Mira';

-- wasteland
UPDATE public.npcs SET position_x = 1200, position_y = 2400 WHERE zone_id = 'wasteland' AND name = 'Scrapper Drone';
UPDATE public.npcs SET position_x = 2200, position_y = 2700 WHERE zone_id = 'wasteland' AND name = 'Wasteland Marauder';
UPDATE public.npcs SET position_x = 3000, position_y = 2200 WHERE zone_id = 'wasteland' AND name = 'Rogue War-Mech';
UPDATE public.npcs SET position_x = 4400, position_y = 2600 WHERE zone_id = 'wasteland' AND name = 'Wasteland Overlord';
UPDATE public.npcs SET position_x = 2700, position_y = 2800 WHERE zone_id = 'wasteland' AND name = 'Stranded Survivor';

-- neon-district
UPDATE public.npcs SET position_x = 800,  position_y = 2400 WHERE zone_id = 'neon-district' AND name = 'Whisper';
UPDATE public.npcs SET position_x = 1700, position_y = 2700 WHERE zone_id = 'neon-district' AND name = 'Cyber-Doc Riku';
UPDATE public.npcs SET position_x = 2500, position_y = 2300 WHERE zone_id = 'neon-district' AND name = 'Neon Gangster';
UPDATE public.npcs SET position_x = 3400, position_y = 2700 WHERE zone_id = 'neon-district' AND name = 'Syndicate Enforcer';
UPDATE public.npcs SET position_x = 4200, position_y = 2200 WHERE zone_id = 'neon-district' AND name = 'The Fixer';
