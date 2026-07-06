import { describe, it, expect } from 'vitest';
import { findFuzzyMatch, buildPlannerShoppingData, syncDecisionsIntoShoppingData, formatShoppingNote } from './plannerShoppingUtils.js';

describe('formatShoppingNote', () => {
  it('returns empty string for a seasoning product regardless of qty', () => {
    expect(formatShoppingNote('соль', 1, 'ч.л')).toBe('');
    expect(formatShoppingNote('масло растительное', 3, 'ст.л')).toBe('');
  });

  it('returns empty string when qty is null', () => {
    expect(formatShoppingNote('яйца', null, null)).toBe('');
  });

  it('formats a purchase-rounded quantity for a converted product', () => {
    expect(formatShoppingNote('картошка', 300, 'г')).toBe('500 г');
  });

  it('falls back to the raw rounded qty/unit when there is no conversion entry', () => {
    expect(formatShoppingNote('незнакомый продукт', 2.34, 'ст.л')).toBe('2.3 ст.л');
  });

  it('ceils a discrete unit even without a conversion table entry', () => {
    expect(formatShoppingNote('яйца', 5.5, 'шт')).toBe('6 шт');
  });
});

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
  it('checks a matched item and adds a purchase-rounded note for its quantity', () => {
    const { plan } = buildPlannerShoppingData([
      { product: 'картошка', qty: 300, unit: 'г', include: true },
    ]);
    // 300 г округляется вверх до шага покупки (500 г)
    expect(plan['Овощи_0']).toEqual({ note: '500 г' });
  });

  it('shows no quantity note for a seasoning product even with an exact recipe dose', () => {
    const { plan } = buildPlannerShoppingData([
      { product: 'масло оливковое', qty: 3, unit: 'ст.л', include: true },
    ]);
    // «масло оливковое» — 8-й товар (индекс 7) в плоском списке категории «5. Бакалея:»
    // (рис, гречка, макароны, полента, овсяные хлопья, киноа, масло растительное, масло оливковое, ...).
    expect(plan['Бакалея_7']).toBe(true); // чекбокс без note, а не { note: '...' }
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
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
    expect(planned).toEqual({ 'Овощи_0': true });
  });

  it('tracks a checked buy-decision as menu-managed', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const { menuKeys } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
    expect(menuKeys).toEqual(['Овощи_0']);
  });

  it('adds an unmatched buy-decided ingredient to Из меню, labeled with its quantity', () => {
    const items = [{ product: 'экзотика икс', qty: 2, unit: 'шт' }];
    const { customData, planned, menuKeys } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'экзотика икс': 'buy' });
    const menuCat = customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['экзотика икс 2 шт']);
    expect(planned).toEqual({ 'Из меню_0': true });
    expect(menuKeys).toEqual(['Из меню_0']);
  });

  it('does not duplicate an already-added Из меню item on a repeated sync', () => {
    const items = [{ product: 'экзотика икс', qty: null, unit: null }];
    const decisions = { 'экзотика икс': 'buy' };
    const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, decisions);
    const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, items, decisions);
    const menuCat = second.customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['экзотика икс']);
  });

  it('removes a Из меню item entirely when its decision reverts to have', () => {
    const items = [{ product: 'экзотика икс', qty: null, unit: null }];
    const added = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'экзотика икс': 'buy' });
    const reverted = syncDecisionsIntoShoppingData(added.customData, added.planned, added.menuKeys, items, { 'экзотика икс': 'have' });
    const menuCat = reverted.customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual([]);
    expect(reverted.planned).toEqual({});
  });

  it('unchecks but does not remove a normal category item when its decision reverts to have', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const bought = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
    const reverted = syncDecisionsIntoShoppingData(bought.customData, bought.planned, bought.menuKeys, items, { 'картошка': 'have' });
    expect(reverted.planned).toEqual({});
    expect(reverted.customData.categories[0].subgroups[0].items).toEqual(['картошка', 'морковь']);
  });

  it('leaves an item with no decision untouched', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const customData = makeCustomData();
    const { planned, customData: next } = syncDecisionsIntoShoppingData(customData, {}, [], items, {});
    expect(planned).toEqual({});
    expect(next).toEqual(customData);
  });

  it('preserves an existing note on an already-checked buy item', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const planned = { 'Овощи_0': { note: '2 кг' } };
    const { planned: next } = syncDecisionsIntoShoppingData(makeCustomData(), planned, [], items, { 'картошка': 'buy' });
    expect(next['Овощи_0']).toEqual({ note: '2 кг' });
  });

  it('leaves a custom ad-hoc item untouched since it never appears in ingredientItems', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const customData = makeCustomData();
    const { customData: next } = syncDecisionsIntoShoppingData(customData, { 'Своё_0': true }, [], items, { 'картошка': 'buy' });
    const customCat = next.categories.find((c) => c.id === 'user_custom');
    expect(customCat.subgroups[0].items).toEqual(['Салфетки']);
  });

  it('matches product names case-insensitively', () => {
    const items = [{ product: 'КАРТОШКА', qty: null, unit: null }];
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
    expect(planned['Овощи_0']).toBe(true);
  });

  it('applies decisions across multiple categories in one pass', () => {
    const items = [
      { product: 'картошка', qty: null, unit: null },
      { product: 'молоко', qty: null, unit: null },
    ];
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy', 'молоко': 'have' });
    expect(planned['Овощи_0']).toBe(true);
    expect(planned['Молочные продукты_0']).toBeUndefined();
  });

  it('does not mutate the input customData, planned, or menuKeys', () => {
    const customData = makeCustomData();
    const planned = {};
    const menuKeys = ['Овощи_0'];
    const items = [{ product: 'картошка', qty: null, unit: null }];
    syncDecisionsIntoShoppingData(customData, planned, menuKeys, items, { 'картошка': 'buy' });
    expect(planned).toEqual({});
    expect(menuKeys).toEqual(['Овощи_0']);
    expect(customData.categories[0].subgroups[0].items).toEqual(['картошка', 'морковь']);
  });

  describe('reconciliation (a menu-managed item whose ingredient drops out of the menu)', () => {
    it('unchecks a menu-managed normal-category item once its ingredient is no longer in the menu at all', () => {
      const items = [{ product: 'картошка', qty: null, unit: null }];
      const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
      expect(first.planned['Овощи_0']).toBe(true);
      // Recipe using картошка removed from the menu: no items, no decisions this pass.
      const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, [], {});
      expect(second.planned['Овощи_0']).toBeUndefined();
    });

    it('removes a menu-managed Из меню item once its ingredient is no longer in the menu at all', () => {
      const items = [{ product: 'экзотика икс', qty: null, unit: null }];
      const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'экзотика икс': 'buy' });
      const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, [], {});
      const menuCat = second.customData.categories.find((c) => c.id === 'planner_menu_extras');
      expect(menuCat.subgroups[0].items).toEqual([]);
    });

    it('keeps a still-needed menu-managed item checked across reconciliation', () => {
      const items = [{ product: 'картошка', qty: null, unit: null }];
      const decisions = { 'картошка': 'buy' };
      const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, decisions);
      const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, items, decisions);
      expect(second.planned['Овощи_0']).toBe(true);
    });

    it('leaves a manually-checked item untouched during reconciliation, since it was never menu-managed', () => {
      const customData = makeCustomData();
      const planned = { 'Своё_0': true }; // manually checked "Салфетки", never via sync
      const { planned: next } = syncDecisionsIntoShoppingData(customData, planned, [], [], {});
      expect(next['Своё_0']).toBe(true);
    });

    it('removes two no-longer-needed Из меню items in the same pass without corrupting either', () => {
      const items = [
        { product: 'фыфымба одна', qty: null, unit: null },
        { product: 'щурбулет два', qty: null, unit: null },
      ];
      const decisions = { 'фыфымба одна': 'buy', 'щурбулет два': 'buy' };
      const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, decisions);
      const menuCat1 = first.customData.categories.find((c) => c.id === 'planner_menu_extras');
      expect(menuCat1.subgroups[0].items).toEqual(['фыфымба одна', 'щурбулет два']);

      // Both recipes removed from the menu in one go.
      const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, [], {});
      const menuCat2 = second.customData.categories.find((c) => c.id === 'planner_menu_extras');
      expect(menuCat2.subgroups[0].items).toEqual([]);
      expect(second.planned).toEqual({});
    });
  });
});
