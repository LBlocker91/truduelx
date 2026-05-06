## Phase: Progression Feel + Stat Draft + Vibranium + Skill Ranks + Class Ultimates

Large but cohesive phase. I'll ship it in one coordinated pass — DB migration first, then edge functions, then UI.

### 1. Faster early leveling (XP curve tune)

In both `src/lib/leveling.ts` and `supabase/functions/_shared/leveling.ts`, retune `xpForLevel` / `xpForNextLevel` for L1–10:
- L1→2: 80 XP (was 200)
- L2→3: 140
- L3→4: 220
- L4→5: 320
- Smooth ramp into existing L20 value (~2,100)
- L20→50 and L50→100 curves unchanged → long-term pacing preserved

Training Drone XP/credits scaling stays as-is (already player-level scaled).

### 2. Vibranium currency

Migration:
- `characters.vibranium int not null default 100` (new chars start with 100 for testing; backfill existing chars to 100)
- `characters.stat_allocations jsonb not null default '{"strength":0,"dexterity":0,"technology":0,"support":0,"defense":0,"resistance":0,"max_hp":0,"max_energy":0}'`

Display Vibranium in HUD and ProfilePanel with a small gem icon (lucide `Gem`).

### 3. Stat allocation: draft mode + batch save

- ProfilePanel: local `draft` state for all 8 stat targets. Clicking `+` only mutates draft + decrements local available points. `Save` and `Cancel` buttons appear when draft is non-zero.
- New edge function `allocate-stat-points`: validates ownership, all keys are in the allowed set, ints ≥ 0, sum ≤ stat_points; applies atomically; updates `stat_allocations` cumulatively.
- Keep `spend-stat-point` (legacy, still works) but ProfilePanel uses batch.

### 4. Stat reset with Vibranium

New edge function `reset-stats`:
- Requires character ownership and `vibranium >= 100`
- Deducts 100 Vibranium
- Refunds total of `stat_allocations` values back to `stat_points`
- Subtracts allocations from current stats (strength, dexterity, technology, support, defense, resistance, bonus_max_hp = -allocs.max_hp*5, bonus_max_mp = -allocs.max_energy*3)
- Resets `stat_allocations` to zeros
- Preserves: level, XP, credits, inventory, equipment, skills, quests

Confirmation dialog in ProfilePanel before calling.

### 5. Skill ranks (1–20) + scaling

- `character_skills.rank` already exists (default 1). Keep it.
- `characters.skill_levels` jsonb stores `{slug: rank}`. Backfill existing entries to ensure rank ≥ 1.
- Update `unlock-skill` edge function → rename behavior to "rank up": if not learned, unlock at rank 1 (cost 1 SP); if learned and rank < 20 and level ≥ unlock_level, increment rank (cost 1 SP). Single endpoint, single SP per call.
- `combat.ts` → apply `rankMultiplier = 1 + (rank - 1) * 0.06` to skill base damage and effect_value. Read rank from snapshot's `skill_levels`.
- Battle snapshot already includes `skill_levels` — verify it's passed through.
- Battle UI: show "R{n}" badge on skill button.

### 6. Class ultimates (3 per class, L5/L20/L50)

Insert 9 new skills (3 each for mercenary, tech-mage, gunner) via `supabase--insert`. Map class names from existing DB: check what classes are actually in `skills.class` enum. Mercenary, Tech Mage, and Gunner per project memory.

Skill design (high MP, high CD, high base damage, scales with primary stat):
- **Mercenary**: Titan Breaker (L5, str), Warzone Slam (L20, str + debuff_defense), Omega Berserker (L50, str + buff_attack)
- **Tech Mage**: Plasma Nova (L5, tech, magical), Gravity Lock (L20, tech, stun), Singularity Storm (L50, tech, magical)
- **Gunner**: Deadeye Burst (L5, dex), Trap Field (L20, dex, stun), Phantom Execution (L50, dex, bonus_low_hp)

SkillsPanel groups skills into Basic / Advanced / Ultimate sections. Locked ultimates show "Unlocks at Level X".

### 7. Existing skills preserved

- Migration backfills any `character_skills` rows with `rank = 0 or null` → `rank = 1`
- Backfills `characters.skill_levels` so existing slugs map to at least 1
- New ultimates start locked (not in skill_levels) until player ranks them

### Files

**New**
- `supabase/functions/allocate-stat-points/index.ts`
- `supabase/functions/reset-stats/index.ts`

**Edited**
- `src/lib/leveling.ts` + `supabase/functions/_shared/leveling.ts` (XP curve)
- `supabase/functions/_shared/combat.ts` (rank multiplier)
- `supabase/functions/unlock-skill/index.ts` (rank-up support)
- `supabase/functions/npc-battle/index.ts` (snapshot already has skill_levels — verify)
- `src/components/game/panels/ProfilePanel.tsx` (draft mode, vibranium, reset button)
- `src/components/game/panels/SkillsPanel.tsx` (rank display, group sections, ultimates)
- `src/components/game/NpcBattleScreen.tsx` (rank badge on skill buttons)
- `src/components/game/GameHud.tsx` (vibranium display)
- `src/lib/overworld.ts` (allocateStatPoints, resetStats helpers)

**Migration**
- Add `vibranium`, `stat_allocations` columns; backfill skill ranks; insert 9 ultimate skills
