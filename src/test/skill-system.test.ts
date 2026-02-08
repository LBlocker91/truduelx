import { describe, it, expect } from 'vitest';
import { createCharacter, createEnemy } from '@/data/characters';
import { applyXp, unlockAbility } from '@/lib/leveling';
import { BASIC_ATTACK } from '@/types/game';

describe('Skill System', () => {
  it('new characters start with zero unlocked abilities', () => {
    const player = createCharacter('mercenary', 'Test', 'p1');
    expect(player.unlockedAbilityIds).toEqual([]);
  });

  it('BASIC_ATTACK is always available (0 energy, 0 cooldown)', () => {
    expect(BASIC_ATTACK.energyCost).toBe(0);
    expect(BASIC_ATTACK.cooldown).toBe(0);
    expect(BASIC_ATTACK.id).toBe('basic-attack');
  });

  it('leveling up grants skill points', () => {
    const player = createCharacter('mercenary', 'Test', 'p1');
    const leveled = applyXp(player, 10000); // enough to level up
    expect(leveled.level).toBeGreaterThan(1);
    expect(leveled.skillPoints).toBeGreaterThan(0);
  });

  it('can unlock a Row 1 ability with skill points', () => {
    const player = createCharacter('mercenary', 'Test', 'p1');
    const leveled = applyXp(player, 10000);
    expect(leveled.skillPoints).toBeGreaterThan(0);

    const ability = leveled.abilities.find(a => (a.unlockLevel || 1) <= leveled.level);
    expect(ability).toBeDefined();

    const afterUnlock = unlockAbility(leveled, ability!.id);
    expect(afterUnlock.unlockedAbilityIds).toContain(ability!.id);
    expect(afterUnlock.skillPoints).toBe(leveled.skillPoints - 1);
  });

  it('cannot unlock abilities above character level', () => {
    const player = createCharacter('mercenary', 'Test', 'p1');
    const leveled = applyXp(player, 1000);
    // Find a high-level ability
    const highLvlAbility = leveled.abilities.find(a => (a.unlockLevel || 1) > leveled.level);
    if (highLvlAbility) {
      const result = unlockAbility(leveled, highLvlAbility.id);
      expect(result.unlockedAbilityIds).not.toContain(highLvlAbility.id);
    }
  });

  it('enemies auto-unlock abilities at their level', () => {
    const enemy = createEnemy(5);
    // Enemies should have some unlocked abilities
    expect(enemy.unlockedAbilityIds.length).toBeGreaterThan(0);
  });
});
