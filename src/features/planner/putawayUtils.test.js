import { describe, it, expect } from 'vitest';
import { buildPutawayQueue, getRequiredZones } from './putawayUtils.js';

function customData(categories) {
  // categories: [{ name, items: string[] }]
  return {
    categories: categories.map((c, i) => ({
      id: `cat_${i}`,
      name: c.name,
      icon: c.icon ?? '📦',
      subgroups: [{ name: null, items: c.items }],
    })),
  };
}

describe('buildPutawayQueue', () => {
  it('includes a bought item that has a known zone', () => {
    const cd = customData([{ name: 'Молочные продукты', items: ['молоко'] }]);
    const queue = buildPutawayQueue(cd, { 'Молочные продукты_0': true }, {});
    expect(queue).toEqual([
      { key: 'Молочные продукты_0', category: 'Молочные продукты', product: 'молоко', zoneId: 'fridge' },
    ]);
  });

  it('excludes an item that was not marked bought', () => {
    const cd = customData([{ name: 'Молочные продукты', items: ['молоко'] }]);
    const queue = buildPutawayQueue(cd, {}, {});
    expect(queue).toEqual([]);
  });

  it('excludes an item that has already been placed', () => {
    const cd = customData([{ name: 'Молочные продукты', items: ['молоко'] }]);
    const queue = buildPutawayQueue(cd, { 'Молочные продукты_0': true }, { 'Молочные продукты_0': 'fridge' });
    expect(queue).toEqual([]);
  });

  it('excludes a bought item with no known zone (e.g. the "Из меню" catch-all category)', () => {
    const cd = customData([{ name: 'Из меню', items: ['непонятный ингредиент'] }]);
    const queue = buildPutawayQueue(cd, { 'Из меню_0': true }, {});
    expect(queue).toEqual([]);
  });

  it('preserves category/item order across multiple categories', () => {
    const cd = customData([
      { name: 'Овощи', items: ['картошка', 'огурцы'] },
      { name: 'Фрукты', items: ['бананы'] },
    ]);
    const bought = { 'Овощи_0': true, 'Овощи_1': true, 'Фрукты_0': true };
    const queue = buildPutawayQueue(cd, bought, {});
    expect(queue.map((q) => q.product)).toEqual(['картошка', 'огурцы', 'бананы']);
    expect(queue.map((q) => q.zoneId)).toEqual(['veg', 'fridge', 'table']);
  });

  it('returns an empty queue for an empty customData', () => {
    expect(buildPutawayQueue({ categories: [] }, {}, {})).toEqual([]);
  });
});

describe('getRequiredZones', () => {
  it('returns unique zone ids from putawayPlan values, ordered as in ZONES', () => {
    const plan = { 'Молочные продукты_0': 'fridge', 'Заморозка_0': 'freezer', 'Овощи_0': 'fridge' };
    expect(getRequiredZones(plan)).toEqual(['freezer', 'fridge']);
  });

  it('returns an empty array for an empty putawayPlan', () => {
    expect(getRequiredZones({})).toEqual([]);
  });

  it('treats a missing putawayPlan as empty', () => {
    expect(getRequiredZones(undefined)).toEqual([]);
  });
});
