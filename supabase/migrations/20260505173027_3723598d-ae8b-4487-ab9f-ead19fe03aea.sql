-- Shrink world to 2880x1800 and scale NPC + spawn positions by 0.6
UPDATE zones SET width = 2880, height = 1800;

UPDATE zones SET spawn_x = 1440, spawn_y = 1300 WHERE id = 'station-hub';
UPDATE zones SET spawn_x = 2520, spawn_y = 1500 WHERE id = 'neon-district';
UPDATE zones SET spawn_x = 360,  spawn_y = 1500 WHERE id = 'wasteland';

-- Reposition Bazaar Station NPCs around spawn for readability
UPDATE npcs SET position_x = 1440, position_y = 1140 WHERE id = 'quest-commander';
UPDATE npcs SET position_x = 1100, position_y = 1380 WHERE id = 'quest-scout';
UPDATE npcs SET position_x = 1780, position_y = 1380 WHERE id = 'vendor-tech';
UPDATE npcs SET position_x = 800,  position_y = 1300 WHERE id = 'vendor-arms';
UPDATE npcs SET position_x = 2100, position_y = 1500 WHERE id = 'vendor-armor';

-- Neon District scaled
UPDATE npcs SET position_x = 1020, position_y = 1620 WHERE id = 'vendor-cyberdoc';
UPDATE npcs SET position_x = 1500, position_y = 1380 WHERE id = 'enemy-gangster';
UPDATE npcs SET position_x = 2040, position_y = 1620 WHERE id = 'enemy-enforcer';
UPDATE npcs SET position_x = 2520, position_y = 1320 WHERE id = 'quest-fixer';
UPDATE npcs SET position_x = 480,  position_y = 1440 WHERE id = 'vendor-blackmarket';

-- Wasteland scaled
UPDATE npcs SET position_x = 1800, position_y = 1320 WHERE id = 'enemy-warmech';
UPDATE npcs SET position_x = 720,  position_y = 1440 WHERE id = 'enemy-scrapper';
UPDATE npcs SET position_x = 1620, position_y = 1680 WHERE id = 'quest-survivor';
UPDATE npcs SET position_x = 1320, position_y = 1620 WHERE id = 'enemy-marauder';
UPDATE npcs SET position_x = 2640, position_y = 1560 WHERE id = 'enemy-overlord';