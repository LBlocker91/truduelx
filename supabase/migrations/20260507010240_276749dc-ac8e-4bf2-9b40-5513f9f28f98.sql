-- 1. Reslot all staff items to weapon (keep weapon_subtype = 'tech_staff' for VFX/scale).
UPDATE public.items SET slot = 'weapon' WHERE slot = 'staff';

-- 2. For characters that had a staff equipped and no melee weapon, promote it.
UPDATE public.characters
   SET equipped_weapon_id = equipped_staff_id,
       equipped_staff_id = NULL
 WHERE equipped_staff_id IS NOT NULL
   AND equipped_weapon_id IS NULL;

-- 3. Otherwise just unequip the staff (and the inventory row).
UPDATE public.inventory
   SET equipped = false
 WHERE id IN (
   SELECT inv.id FROM public.inventory inv
   JOIN public.characters c ON c.equipped_staff_id IS NOT NULL
                            AND c.id = inv.character_id
                            AND inv.item_id = c.equipped_staff_id
 );
UPDATE public.characters SET equipped_staff_id = NULL WHERE equipped_staff_id IS NOT NULL;

-- 4. Give pet items damage values so they can attack in battle.
UPDATE public.items
   SET min_damage = COALESCE(min_damage, 22),
       max_damage = COALESCE(max_damage, 36),
       weapon_subtype = COALESCE(weapon_subtype, 'drone'),
       damage_type   = COALESCE(damage_type, 'energy')
 WHERE slot = 'pet';
