
# Riftbound Duel — Real Damage, Build Page, Gear Scaling, New Slots

This phase rewires combat math so stats/skill rank/weapon/gear visibly drive damage, adds wings + robot pet equipment slots, expands the store with new item types, and consolidates progression into a single **Build** page with live damage previews.

The work is large. To keep risk low and the build green between steps, it is grouped into 4 sequential parts. Auth, character slots, quests, XP, credits, potions, portals, turn timer, and existing battle pipeline are NOT touched.

---

## Part 1 — Damage formula rewrite (server + shared)

Goal: no more flat 44/53 hits. Every component (weapon roll, stat, rank, level, mitigation, variance, crit) actively moves the number.

**Files**
- `supabase/functions/_shared/combat.ts` — replace `resolveHit` with new formula:
  - `weaponRoll = rng(weapon_min..weapon_max)` (per hit, not per turn)
  - `rankMultiplier = 1 + (skillRank-1) * 0.06`
  - `statPower = attacker[skill.scale_stat] * scaleMultiplier` where multiplier depends on skill type
  - `levelPower = level * 1.5`
  - `raw = (weaponRoll + skill.base_damage + statPower + levelPower) * rankMultiplier`
  - Mitigation by damage type: physical → defense, magical/energy → resistance, special/hybrid → average
  - `mitPct = mitStat / (mitStat + 100)`
  - Variance `0.92..1.08`
  - Crit: `0.05 + dex * 0.0005` chance, ×1.5
  - Floor `max(3, raw*0.15)`; remove the hard 25%-max-HP cap that was flattening big hits
  - Return enriched `HitResult` including `scaleStat`, `damageType`, `weaponRoll`, `statPower`, `mitigation`, `rank` so the log/preview can explain it.
- Snapshot now includes `weapon_subtype` (blade/pistol/rifle/rocket_launcher/tech_staff/heavy/pet/wings) so VFX + scaling rules know what was used.
- `supabase/functions/npc-battle/index.ts` & `battle-action/index.ts` — pass new fields into snapshot from equipped items, no other behavior change.

**Acceptance:** consecutive identical-input attacks now vary; equipping a stronger weapon raises damage; raising STR raises STR-scaling skills; raising DEF lowers physical incoming.

---

## Part 2 — DB: new equipment slots, item subtypes, store catalog

Single migration:
- `characters`: add `equipped_wings_id uuid`, `equipped_pet_id uuid`.
- `items`: add `damage_type text` ('physical'|'energy'|'hybrid'), `weapon_subtype text` (nullable). Extend `item_slot` enum with `wings` and `pet`.
- Seed new items via INSERT (separate insert call after migration approval):
  - Weapons: Pulse Saber (blade/STR/phys), Arc Pistol (pistol/DEX/phys), Ion Staff (tech_staff/TECH/energy), Scrapline Rifle (rifle/DEX/phys), Training Launcher (rocket_launcher/SUP+DEX/hybrid).
  - Armor: Scout Plating (DEF+DEX), Vanguard Shell (DEF+HP), Circuit Robe (RES+MP).
  - Wings: Glider Fins (DEX+MP), Ion Wings (TECH+RES), Rift Wings (SUP+MP).
  - Pets: Spark Drone (SUP+TECH), Med Bot (SUP+HP), Rail Pup (SUP+DEX).
  - Stock all into Broker Vexon's vendor inventory at tiered prices (starter 200–600 cr, mid 1.2k–3k, wings/pets 2.5k–5k).

---

## Part 3 — Build page + previews + gear bonus pipeline

Goal: one page that combines stats, skills, equipped gear, and shows damage preview that updates live when draft stats change.

**New shared util:** `src/lib/damage-preview.ts`
- `getEquippedBonuses(items[])` → flat stat/HP/MP modifiers
- `calculateDamagePreview({ stats, weapon, skill, skillRank, target })` → `{ minDamage, maxDamage, damageType, scalingStat, mitigationType, rankMultiplier }`
- Mirrors server formula closely.

**Snapshots:** `src/lib/overworld.ts` builds the snapshot used to start NPC battles — extend it to:
- Read all 4 equipped items (weapon, armor, wings, pet)
- Fold their `stat_modifiers` into snapshot stats and HP/MP bonuses
- Carry `weapon_subtype` and `damage_type` into the weapon snapshot

**ProfilePanel → BuildPanel** (`src/components/game/panels/ProfilePanel.tsx`):
- Add an "Equipped" grid showing all 4 slots (weapon/armor/wings/pet) with quick stats.
- Add a "Final Stats" block showing `base + allocated + gear = total` for each stat.
- Inline a compact "Skills" section (pulled from `SkillsPanel`) — collapsible.
- Add "Damage Preview" — pick a skill, show `min–max` damage vs a Lv-equivalent dummy, with a one-line scaling explanation. Updates instantly with draft stat changes.
- `SkillsPanel` keeps existing route, but Profile button is renamed "Build" in the HUD.

**Inventory** (`src/components/game/panels/InventoryPanel.tsx`):
- Recognize new slots `wings` and `pet`; show their stat bonuses, equip/unequip works via existing flow (extend `equipItem`/`unequipItem` to mirror onto `equipped_wings_id` / `equipped_pet_id`).

---

## Part 4 — Combat log clarity + weapon-typed VFX

- `CombatLog`: when hit result has scaling info, show: `"<Skill/Attack> dealt 51 physical damage."` and a small dim line: `"Scaled with STR · Reduced by Defense"`. Crits and dodges keep their callouts.
- Battle screens read `weapon_subtype` from the snapshot and pick a VFX preset in `skill-vfx.ts`:
  - blade → slash arc, pistol/rifle → muzzle flash + tracer, rocket_launcher → projectile + impact burst, tech_staff → plasma bolt, pet → small drone projectile.
  - Wings render as a subtle aura on the character sprite (cosmetic + passive only — no attack).

---

## Technical details

```text
Final formula (server + preview):
  weaponRoll  = rand(weapon.min, weapon.max)            // per hit
  statPower   = attacker[skill.scale_stat] * scaleMult  // 1.6 phys, 1.4 energy, 1.2 hybrid
  levelPower  = attacker.level * 1.5
  rankMult    = 1 + (rank - 1) * 0.06
  raw         = (weaponRoll + skill.base_damage + statPower + levelPower) * rankMult
  if crit: raw *= 1.5     // chance = 0.05 + dex * 0.0005
  mitStat     = phys ? def : energy ? res : (def+res)/2
  mitPct      = mitStat / (mitStat + 100)
  dmg         = raw * (1 - mitPct) * rand(0.92, 1.08)
  return max(round(dmg), max(3, round(raw*0.15)))
```

Stat-modifier shape on items already exists as `stat_modifiers jsonb`; we just start populating and reading it consistently. No breaking changes to existing tables — only additive columns + enum values.

---

## Out of scope (per the brief)

- Auth, character slot screens, quest/XP/credit/potion/portal logic.
- Turn timer, NPC turn pipeline (already verified).
- AoE/multi-target. Wings stay passive. Pets stay passive (stat bonus only) — active pet attacks are a future phase.

---

## Order of operations (so each step is testable)

1. Migration (new columns + enum values) — wait for approval.
2. Insert new items + vendor stock.
3. Rewrite `_shared/combat.ts` and snapshot building. Build should pass; existing battles keep working.
4. Inventory + equip flow for wings/pet.
5. Build page (rename Profile → Build, add equipped grid, final stats, damage preview).
6. Combat log + weapon VFX presets.
7. Smoke-test a Calibration Unit Mk-I battle: damage varies, log explains scaling, gear changes preview and real damage.
