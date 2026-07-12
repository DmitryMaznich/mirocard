import { describe, it, expect } from 'vitest';
import { validateInstructionDraft } from './instructionValidation.js';

describe('validateInstructionDraft', () => {
  it('is valid with a title and at least one non-empty step', () => {
    const result = validateInstructionDraft({ title: 'Собираем портфель', steps: ['Найди дневник'] });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects an empty or whitespace-only title', () => {
    expect(validateInstructionDraft({ title: '', steps: ['Шаг'] }).valid).toBe(false);
    expect(validateInstructionDraft({ title: '   ', steps: ['Шаг'] }).errors.title).toBeTruthy();
  });

  it('rejects when every step is empty or whitespace-only', () => {
    const result = validateInstructionDraft({ title: 'Название', steps: ['', '   '] });
    expect(result.valid).toBe(false);
    expect(result.errors.steps).toBeTruthy();
  });

  it('rejects an empty steps array', () => {
    const result = validateInstructionDraft({ title: 'Название', steps: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.steps).toBeTruthy();
  });

  it('is valid when at least one step has real text even if others are blank', () => {
    const result = validateInstructionDraft({ title: 'Название', steps: ['', 'Реальный шаг', '  '] });
    expect(result.valid).toBe(true);
  });
});
