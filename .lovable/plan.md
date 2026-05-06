## Goal
Guns, launchers and tech staves stop replacing blades. Each character can equip up to one of every weapon type at the same time, and the right one is used automatically depending on the skill (or basic attack) being executed. Build page entry is made more obvious.

## 1. Database (single migration)

- Extend `item_slot` enum with `gun`, `launcher`, `staff`. (`weapon` stays = melee.)
- `characters`: add nullable `equipped_gun_id`, `equipped_launcher_id`, `equipped_staff_id`.
- Data backfill (insert tool): re-slot existing items by `weapon_subtype`:
  - `pistol`, `rifle` → `gun`
  - `rocket_launcher` → `launcher`
  - `tech_staff` → `staff`
  - `blade`, `heavy` stay as `weapon` (melee)
- Move any rows in `inventory` that were equipped to a moved item: rebind `characters.equipped_*_id` to match new slot, clear `equipped_weapon_id` if the item moved out of melee.

## 2. Equip / unequip logic (`src/lib/inventory.ts`)
- Map slot → character column for all four slots. Same "unequip others in same slot" pattern, just expanded.

## 3. Inventory & Build UI
- `InventoryPanel.tsx`: add `gun`, `launcher`, `staff` to slot list with icons.
- `BuildPanel.tsx`: equipped grid shows 4 weapon slots side-by-side instead of just "Weapon", plus armor/wings/pet. Damage Preview gains a small dropdown to pick which weapon (or skill) to preview against — defaults to whatever the chosen skill auto-uses.
- HUD (`GameHud.tsx`): make Build button visually prominent (filled, neon outline) and keep it always visible on the action bar, both desktop and mobile.

## 4. Snapshot (battles)
- `buildPlayerSnapshot` (in `npc-battle/index.ts` and `matchmaking/index.ts`) collects ALL equipped weapons into a new `weapons` map on the snapshot:
  ```
  weapons: {
    melee?:    { min, max, subtype, damage_type, scale_stat },
    gun?:      { ... },
    launcher?: { ... },
    staff?:    { ... },
  }
  ```
  Old `weapon_min/max/subtype/damage_type/weapon_scale_stat` fields stay populated with the "primary" (melee preferred, else first available) for backward compatibility.

## 5. Combat engine (`supabase/functions/_shared/combat.ts`)
- New helper `pickWeaponForSkill(snap, skill | null)`:
  - Skill present → match by `scale_stat`: strength→melee, dexterity→gun, technology→staff, support→launcher.
  - Basic attack (no skill) → priority: melee → gun → staff → launcher → unarmed.
  - Falls back to top-level weapon fields if the matching slot is empty.
- `resolveHit` uses that helper to pick `weaponMin`, `weaponMax`, `weaponSubtype`, `damageType`, and the scaling stat instead of always reading the snapshot's single weapon.
- This means equipping a Gun grants ranged skills real teeth even if your equipped Sword was used for the basic attack.

## 6. Damage preview (`src/lib/damage-preview.ts` + Build page)
- Mirror the same auto-pick logic so the preview matches what combat will use.
- Build page shows, for each skill row, a tiny tag like "uses Gun" / "uses Launcher" so it's obvious why damage changes.

## 7. Combat log / VFX
- `weapon_subtype` already feeds VFX; since each hit now reports the actual weapon used, slashes/tracers/rockets appear correctly without further work.

## Out of scope
- Changing skill→stat mappings, NPCs, quests, XP, or auth. NPCs continue to use a single weapon snapshot field.
- Visual sprite layering for multiple weapons at once on the overworld — only the primary weapon variant is broadcast.
