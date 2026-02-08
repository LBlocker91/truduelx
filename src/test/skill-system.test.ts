import { describe, it, expect } from 'vitest';
import { createCharacter, createEnemy } from '@/data/characters';
import { applyXp, upgradeAbility } from '@/lib/leveling';
import { BASIC_ATTACK, MAX_ABILITY_LEVEL } from '@/types/game';

describe('Skill System', () => {
  it('new characters start with empty abilityLevels', () => {
    const player = createCharacter('mercenary', 'Test', 'p1');
    expect(player.abilityLevels).toEqual({});
  });

  it('BASIC_ATTACK is always available (0 energy, 0 cooldown)', () => {
    expect(BASIC_ATTACK.energyCost).toBe(0);
    expect(BASIC_ATTACK.cooldown).toBe(0);
    expect(BASIC_ATTACK.id).toBe('basic-attack');
  });

  it('leveling up grants skill points', () => {
    const player = createCharacter('mercenary', 'Test', 'p1');
    const leveled = applyXp(player, 10000);
    expect(leveled.level).toBeGreaterThan(1);
    expect(leveled.skillPoints).toBeGreaterThan(0);
  });

  it('can upgrade an ability with skill points (up to 20)', () => {
    const player = createCharacter('mercenary', 'Test', 'p1');
    const leveled = applyXp(player, 10000);
    expect(leveled.skillPoints).toBeGreaterThan(0);

    const ability = leveled.abilities.find(a => (a.unlockLevel || 1) <= leveled.level);
    expect(ability).toBeDefined();

    const after1 = upgradeAbility(leveled, ability!.id);
    expect(after1.abilityLevels[ability!.id]).toBe(1);
    expect(after1.skillPoints).toBe(leveled.skillPoints - 1);

    // Can upgrade again
    const after2 = upgradeAbility({ ...after1, skillPoints: 5 }, ability!.id);
    expect(after2.abilityLevels[ability!.id]).toBe(2);
  });

  it('cannot upgrade abilities above character level', () => {
    const player = createCharacter('mercenary', 'Test', 'p1');
    const leveled = applyXp(player, 1000);
    const highLvlAbility = leveled.abilities.find(a => (a.unlockLevel || 1) > leveled.level);
    if (highLvlAbility) {
      const result = upgradeAbility(leveled, highLvlAbility.id);
      expect(result.abilityLevels[highLvlAbility.id]).toBeUndefined();
    }
  });

  it('enemies auto-set ability levels at their level', () => {
    const enemy = createEnemy(5);
    const unlockedCount = Object.keys(enemy.abilityLevels).length;
    expect(unlockedCount).toBeGreaterThan(0);
  });
});
