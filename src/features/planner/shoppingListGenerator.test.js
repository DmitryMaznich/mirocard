import { describe, it, expect } from 'vitest';
import { generateShoppingList, applyIngredientDecisions } from './shoppingListGenerator.js';

function recipe(textId, ingredients, portions = 1, portionMultiplier = 1) {
  const lines = [
    `# portions: ${portions}`,
    '# ingredients:',
    ...ingredients.map(([p, q, u]) => `#   ${p} | ${q ?? ''} | ${u ?? ''}`),
    'Текст рецепта',
  ];
  return { textId, content: lines.join('\n'), portionMultiplier };
}

describe('generateShoppingList', () => {
  it('returns item from single recipe', () => {
    const list = generateShoppingList([recipe('r1', [['яйца', 3, 'шт']])]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ product: 'яйца', qty: 3, unit: 'шт', include: true, recipeIds: ['r1'] });
  });

  it('aggregates same product from two recipes', () => {
    const r1 = recipe('r1', [['лук', 2, 'шт']]);
    const r2 = recipe('r2', [['лук', 1, 'шт']]);
    const list = generateShoppingList([r1, r2]);
    const luk = list.find((i) => i.product === 'лук');
    expect(luk.qty).toBe(3);
    expect(luk.recipeIds).toEqual(['r1', 'r2']);
  });

  it('scales qty by portionMultiplier / portions', () => {
    const r = recipe('r1', [['мясо', 400, 'г']], 4, 2); // need 2 portions, recipe is for 4
    const list = generateShoppingList([r]);
    expect(list[0].qty).toBe(200); // 400 * (2/4)
  });

  it('marks pantry items as include: false', () => {
    const r = recipe('r1', [['соль', null, null]]);
    const list = generateShoppingList([r], new Set(['соль']));
    expect(list[0].include).toBe(false);
  });

  it('marks non-pantry items as include: true', () => {
    const r = recipe('r1', [['яйца', 3, 'шт']]);
    const list = generateShoppingList([r], new Set(['соль']));
    expect(list[0].include).toBe(true);
  });

  it('sets qty null when same product appears with and without qty', () => {
    const r1 = recipe('r1', [['соль', 5, 'г']]);
    const r2 = recipe('r2', [['соль', null, null]]);
    const list = generateShoppingList([r1, r2]);
    expect(list[0].qty).toBeNull();
  });

  it('uses portionMultiplier 1 by default', () => {
    const r = recipe('r1', [['морковь', 2, 'шт']], 2, 2);
    const list = generateShoppingList([r]);
    expect(list[0].qty).toBe(2); // 2 * (2/2) = 2
  });

  it('deduplicates by lowercase product name', () => {
    const r1 = recipe('r1', [['Лук', 1, 'шт']]);
    const r2 = recipe('r2', [['лук', 2, 'шт']]);
    const list = generateShoppingList([r1, r2]);
    expect(list).toHaveLength(1);
    expect(list[0].qty).toBe(3);
  });

  it('returns empty list for empty recipes', () => {
    expect(generateShoppingList([])).toEqual([]);
  });
});

describe('applyIngredientDecisions', () => {
  it('excludes an item decided "have" even if it would normally be included', () => {
    const items = [{ product: 'Картошка', include: true }];
    const result = applyIngredientDecisions(items, { 'картошка': 'have' });
    expect(result[0].include).toBe(false);
  });

  it('includes an item decided "buy" even if it would normally be excluded (pantry item)', () => {
    const items = [{ product: 'Соль', include: false }];
    const result = applyIngredientDecisions(items, { 'соль': 'buy' });
    expect(result[0].include).toBe(true);
  });

  it('leaves an item with no decision unchanged', () => {
    const items = [{ product: 'Лук', include: true }];
    const result = applyIngredientDecisions(items, {});
    expect(result[0].include).toBe(true);
  });

  it('matches the decision key case-insensitively against the product name', () => {
    const items = [{ product: 'КАРТОШКА', include: true }];
    const result = applyIngredientDecisions(items, { 'картошка': 'have' });
    expect(result[0].include).toBe(false);
  });

  it('does not mutate the input items', () => {
    const items = [{ product: 'Лук', include: true }];
    applyIngredientDecisions(items, { 'лук': 'have' });
    expect(items[0].include).toBe(true);
  });

  it('defaults to an empty decisions map when omitted', () => {
    const items = [{ product: 'Лук', include: true }];
    expect(applyIngredientDecisions(items)).toEqual(items);
  });
});
