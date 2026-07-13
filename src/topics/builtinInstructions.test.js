import { describe, it, expect } from 'vitest';
import { BUILTIN_INSTRUCTIONS } from './builtinInstructions.js';

describe('BUILTIN_INSTRUCTIONS', () => {
  it('includes the kitchen cleaning instruction', () => {
    const kitchen = BUILTIN_INSTRUCTIONS.find((i) => i.id === 'kitchen_cleaning');
    expect(kitchen).toBeDefined();
    expect(kitchen.title).toBe('Уборка кухни после приготовления еды');
    expect(kitchen.emoji).toBe('🧽');
    expect(kitchen.steps).toHaveLength(11);
    expect(kitchen.steps[0]).toEqual({
      text: 'Унести всю грязную посуду со столов в раковину.',
      photo: null,
    });
  });

  it('marks every built-in instruction as builtin with at least one step', () => {
    expect(BUILTIN_INSTRUCTIONS.length).toBeGreaterThan(0);
    for (const instruction of BUILTIN_INSTRUCTIONS) {
      expect(instruction.builtin).toBe(true);
      expect(instruction.steps.length).toBeGreaterThan(0);
      expect(typeof instruction.id).toBe('string');
      expect(instruction.id.length).toBeGreaterThan(0);
    }
  });
});
