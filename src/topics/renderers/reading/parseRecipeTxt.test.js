import { describe, it, expect } from 'vitest';
import { stepPortionsMultiplier, applyPortions, formatPortionsPhrase } from './parseRecipeTxt.js';

describe('stepPortionsMultiplier', () => {
  it('scales a regular recipe by chosen/base portions', () => {
    expect(stepPortionsMultiplier(4, null, 8)).toBe(2);
  });

  it('returns 1 when chosen portions equal the base', () => {
    expect(stepPortionsMultiplier(4, null, 4)).toBe(1);
  });

  it('falls back to base portions when nothing else is chosen', () => {
    expect(stepPortionsMultiplier(4, null, undefined)).toBe(1);
  });

  it('fixed_portions recipes get a multiplier of 1 when fixedPortions equals base (regression: used to multiply by the absolute fixedPortions value)', () => {
    expect(stepPortionsMultiplier(6, 6, 3)).toBe(1);
  });

  it('fixedPortions always wins over chosenPortions', () => {
    expect(stepPortionsMultiplier(4, 4, 20)).toBe(1);
  });

  it('matches the shopping list scale ratio (fixedPortions / basePortions) even when they differ', () => {
    expect(stepPortionsMultiplier(3, 6, 1)).toBe(2);
  });

  it('treats a falsy basePortions as 1', () => {
    expect(stepPortionsMultiplier(0, null, 2)).toBe(2);
  });
});

describe('applyPortions with stepPortionsMultiplier (integration)', () => {
  it('leaves a fixed_portions recipe step at its written amount', () => {
    const multiplier = stepPortionsMultiplier(6, 6, 6);
    const text = 'Добавить {2|чайную ложку|чайные ложки|чайных ложек} соли.';
    expect(applyPortions(text, multiplier)).toBe('Добавить 2 чайные ложки соли.');
  });

  it('scales a regular recipe step to the chosen portions', () => {
    const multiplier = stepPortionsMultiplier(4, null, 8);
    const text = 'Добавить {2|столовую ложку|столовые ложки|столовых ложек} сливочного масла.';
    expect(applyPortions(text, multiplier)).toBe('Добавить 4 столовые ложки сливочного масла.');
  });
});

describe('formatPortionsPhrase', () => {
  it('uses collective numerals for 1-8 portions', () => {
    expect(formatPortionsPhrase(1)).toBe('Готовим на одного');
    expect(formatPortionsPhrase(2)).toBe('Готовим на двоих');
    expect(formatPortionsPhrase(3)).toBe('Готовим на троих');
    expect(formatPortionsPhrase(4)).toBe('Готовим на четверых');
    expect(formatPortionsPhrase(5)).toBe('Готовим на пятерых');
    expect(formatPortionsPhrase(6)).toBe('Готовим на шестерых');
    expect(formatPortionsPhrase(7)).toBe('Готовим на семерых');
    expect(formatPortionsPhrase(8)).toBe('Готовим на восьмерых');
  });

  it('falls back to "на N человек" above 8', () => {
    expect(formatPortionsPhrase(9)).toBe('Готовим на 9 человек');
    expect(formatPortionsPhrase(12)).toBe('Готовим на 12 человек');
  });

  it('treats a falsy/zero count as 1', () => {
    expect(formatPortionsPhrase(0)).toBe('Готовим на одного');
    expect(formatPortionsPhrase(undefined)).toBe('Готовим на одного');
  });

  it('rounds a fractional count', () => {
    expect(formatPortionsPhrase(2.4)).toBe('Готовим на двоих');
  });
});
