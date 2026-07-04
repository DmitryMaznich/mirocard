import { describe, it, expect } from 'vitest';
import { applyDecisionsToPlanned } from './plannerShoppingUtils.js';

function step(catName, items) {
  return { type: 'checklist', text: `${catName}:`, items };
}

describe('applyDecisionsToPlanned', () => {
  it('checks an item decided "buy" that was not already checked', () => {
    const steps = [step('Овощи', ['картошка', 'лук'])];
    const result = applyDecisionsToPlanned(steps, {}, { 'картошка': 'buy' });
    expect(result['Овощи_0']).toBe(true);
  });

  it('unchecks an item decided "have" even if it was already checked', () => {
    const steps = [step('Овощи', ['картошка'])];
    const result = applyDecisionsToPlanned(steps, { 'Овощи_0': true }, { 'картошка': 'have' });
    expect(result['Овощи_0']).toBeUndefined();
  });

  it('preserves an existing note when the item is already checked "buy"', () => {
    const steps = [step('Овощи', ['картошка'])];
    const planned = { 'Овощи_0': { note: '2 кг' } };
    const result = applyDecisionsToPlanned(steps, planned, { 'картошка': 'buy' });
    expect(result['Овощи_0']).toEqual({ note: '2 кг' });
  });

  it('leaves items with no matching decision untouched (e.g. custom ad-hoc items)', () => {
    const steps = [step('Своё', ['Салфетки'])];
    const planned = { 'Своё_0': true };
    const result = applyDecisionsToPlanned(steps, planned, { 'картошка': 'buy' });
    expect(result['Своё_0']).toBe(true);
  });

  it('matches product names case-insensitively', () => {
    const steps = [step('Овощи', ['Картошка'])];
    const result = applyDecisionsToPlanned(steps, {}, { 'картошка': 'buy' });
    expect(result['Овощи_0']).toBe(true);
  });

  it('does not mutate the input planned object', () => {
    const steps = [step('Овощи', ['картошка'])];
    const planned = {};
    applyDecisionsToPlanned(steps, planned, { 'картошка': 'buy' });
    expect(planned).toEqual({});
  });

  it('applies decisions across multiple categories', () => {
    const steps = [step('Овощи', ['картошка']), step('Молочные продукты', ['молоко'])];
    const result = applyDecisionsToPlanned(steps, {}, { 'картошка': 'buy', 'молоко': 'have' });
    expect(result['Овощи_0']).toBe(true);
    expect(result['Молочные продукты_0']).toBeUndefined();
  });
});
