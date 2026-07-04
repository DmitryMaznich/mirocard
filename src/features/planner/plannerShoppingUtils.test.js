import { describe, it, expect } from 'vitest';
import { findFuzzyMatch, buildPlannerShoppingData, syncDecisionsIntoShoppingData } from './plannerShoppingUtils.js';

describe('findFuzzyMatch', () => {
  const lookup = [
    { norm: 'картошка', catName: 'Овощи', ii: 0 },
    { norm: 'куриное филе', catName: 'Мясо', ii: 0 },
  ];

  it('matches by exact normalized string', () => {
    expect(findFuzzyMatch(lookup, 'картошка')).toEqual({ norm: 'картошка', catName: 'Овощи', ii: 0 });
  });

  it('matches by substring either direction', () => {
    expect(findFuzzyMatch(lookup, 'филе')).toEqual({ norm: 'куриное филе', catName: 'Мясо', ii: 0 });
  });

  it('matches by a shared word longer than 3 characters when no substring matches', () => {
    expect(findFuzzyMatch(lookup, 'филе куриное охлажденное')).toEqual({ norm: 'куриное филе', catName: 'Мясо', ii: 0 });
  });

  it('returns undefined when nothing matches', () => {
    expect(findFuzzyMatch(lookup, 'зюзюкревельды')).toBeUndefined();
  });
});

describe('buildPlannerShoppingData (after findFuzzyMatch extraction)', () => {
  it('checks a matched item and adds a note for its quantity', () => {
    const { plan } = buildPlannerShoppingData([
      { product: 'картошка', qty: 2, unit: 'шт', include: true },
    ]);
    expect(plan['Овощи_0']).toEqual({ note: '2 шт' });
  });

  it('places a completely unmatched item into the Из меню catch-all', () => {
    const { customData, plan } = buildPlannerShoppingData([
      { product: 'зкшзкш плюфь', qty: null, unit: null, include: true },
    ]);
    const menuCat = customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['зкшзкш плюфь']);
    expect(plan['Из меню_0']).toBe(true);
  });

  it('skips items with include: false', () => {
    const { plan } = buildPlannerShoppingData([
      { product: 'картошка', qty: null, unit: null, include: false },
    ]);
    expect(plan).toEqual({});
  });
});

function makeCustomData() {
  return {
    categories: [
      { id: 'base_Овощи', name: 'Овощи', icon: '🥦', subgroups: [{ name: null, items: ['картошка', 'морковь'] }] },
      { id: 'base_Молочные продукты', name: 'Молочные продукты', icon: '🥛', subgroups: [{ name: null, items: ['молоко'] }] },
      { id: 'user_custom', name: 'Своё', icon: '📦', subgroups: [{ name: null, items: ['Салфетки'] }] },
    ],
  };
}

describe('syncDecisionsIntoShoppingData', () => {
  it('checks an existing matching item when decided buy', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'картошка': 'buy' });
    expect(planned).toEqual({ 'Овощи_0': true });
  });

  it('adds an unmatched buy-decided ingredient to Из меню, labeled with its quantity', () => {
    const items = [{ product: 'экзотика икс', qty: 2, unit: 'шт' }];
    const { customData, planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'экзотика икс': 'buy' });
    const menuCat = customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['экзотика икс 2 шт']);
    expect(planned).toEqual({ 'Из меню_0': true });
  });

  it('does not duplicate an already-added Из меню item on a repeated sync', () => {
    const items = [{ product: 'экзотика икс', qty: null, unit: null }];
    const decisions = { 'экзотика икс': 'buy' };
    const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, decisions);
    const second = syncDecisionsIntoShoppingData(first.customData, first.planned, items, decisions);
    const menuCat = second.customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['экзотика икс']);
  });

  it('removes a Из меню item entirely when its decision reverts to have', () => {
    const items = [{ product: 'экзотика икс', qty: null, unit: null }];
    const added = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'экзотика икс': 'buy' });
    const reverted = syncDecisionsIntoShoppingData(added.customData, added.planned, items, { 'экзотика икс': 'have' });
    const menuCat = reverted.customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual([]);
    expect(reverted.planned).toEqual({});
  });

  it('unchecks but does not remove a normal category item when its decision reverts to have', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const bought = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'картошка': 'buy' });
    const reverted = syncDecisionsIntoShoppingData(bought.customData, bought.planned, items, { 'картошка': 'have' });
    expect(reverted.planned).toEqual({});
    expect(reverted.customData.categories[0].subgroups[0].items).toEqual(['картошка', 'морковь']);
  });

  it('leaves an item with no decision untouched', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const customData = makeCustomData();
    const { planned, customData: next } = syncDecisionsIntoShoppingData(customData, {}, items, {});
    expect(planned).toEqual({});
    expect(next).toEqual(customData);
  });

  it('preserves an existing note on an already-checked buy item', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const planned = { 'Овощи_0': { note: '2 кг' } };
    const { planned: next } = syncDecisionsIntoShoppingData(makeCustomData(), planned, items, { 'картошка': 'buy' });
    expect(next['Овощи_0']).toEqual({ note: '2 кг' });
  });

  it('leaves a custom ad-hoc item untouched since it never appears in ingredientItems', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const customData = makeCustomData();
    const { customData: next } = syncDecisionsIntoShoppingData(customData, { 'Своё_0': true }, items, { 'картошка': 'buy' });
    const customCat = next.categories.find((c) => c.id === 'user_custom');
    expect(customCat.subgroups[0].items).toEqual(['Салфетки']);
  });

  it('matches product names case-insensitively', () => {
    const items = [{ product: 'КАРТОШКА', qty: null, unit: null }];
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'картошка': 'buy' });
    expect(planned['Овощи_0']).toBe(true);
  });

  it('applies decisions across multiple categories in one pass', () => {
    const items = [
      { product: 'картошка', qty: null, unit: null },
      { product: 'молоко', qty: null, unit: null },
    ];
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'картошка': 'buy', 'молоко': 'have' });
    expect(planned['Овощи_0']).toBe(true);
    expect(planned['Молочные продукты_0']).toBeUndefined();
  });

  it('does not mutate the input customData or planned objects', () => {
    const customData = makeCustomData();
    const planned = {};
    const items = [{ product: 'картошка', qty: null, unit: null }];
    syncDecisionsIntoShoppingData(customData, planned, items, { 'картошка': 'buy' });
    expect(planned).toEqual({});
    expect(customData.categories[0].subgroups[0].items).toEqual(['картошка', 'морковь']);
  });
});
