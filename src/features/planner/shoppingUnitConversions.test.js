import { describe, it, expect } from 'vitest';
import { toCanonicalQty, toShoppingQuantity, SHOPPING_UNIT_CONVERSIONS, NO_SHOPPING_QTY_PRODUCTS, scaleIngredientQty } from './shoppingUnitConversions.js';

describe('scaleIngredientQty', () => {
  it('scales an ordinary ingredient proportionally', () => {
    expect(scaleIngredientQty(2, 'шт', 3)).toBe(6);
  });

  it('respects additiveStep instead of multiplying (e.g. omelette butter: 1 + 0.5 per extra portion)', () => {
    expect(scaleIngredientQty(1, 'ст.л', 3, 0.5)).toBe(2);
  });

  it('respects coverDivisor as a ceiling-division cover count (e.g. one tomato covers up to 5 burgers)', () => {
    expect(scaleIngredientQty(1, 'шт', 7, null, 5)).toBe(2);
  });

  it('rounds a half-snap unit to the nearest half after additive scaling', () => {
    expect(scaleIngredientQty(1, 'ст.л', 2, 0.5)).toBe(1.5);
  });
});

describe('toCanonicalQty', () => {
  it('converts a recipe unit to grams using the product gramsPerUnit factor', () => {
    expect(toCanonicalQty('картошка', 2, 'шт')).toEqual({ qty: 300, unit: 'г' });
  });

  it('converts to мл when the entry has buyUnit "мл"', () => {
    expect(toCanonicalQty('молоко', 2, 'стакан')).toEqual({ qty: 400, unit: 'мл' });
  });

  it('passes through unchanged when the product has no conversion entry', () => {
    expect(toCanonicalQty('яйца', 6, 'шт')).toEqual({ qty: 6, unit: 'шт' });
  });

  it('passes through unchanged when qty is already null', () => {
    expect(toCanonicalQty('соль', null, null)).toEqual({ qty: null, unit: null });
  });

  it('passes through unchanged when the unit has no factor for this product (already-canonical grams)', () => {
    // гречка only has a factor for 'стакан' — a value already in 'г' has nothing to convert.
    expect(toCanonicalQty('гречка', 100, 'г')).toEqual({ qty: 100, unit: 'г' });
  });

  it('matches product name case-insensitively', () => {
    expect(toCanonicalQty('КАРТОШКА', 1, 'шт')).toEqual({ qty: 150, unit: 'г' });
  });
});

describe('toShoppingQuantity', () => {
  it('rounds a weight-based product up to its purchase step', () => {
    // 2 шт картошки → 300 г → округление вверх до шага 500 → 500 г
    expect(toShoppingQuantity('картошка', 300, 'г')).toEqual({ qty: 500, unit: 'г' });
  });

  it('formats as кг when the rounded amount reaches 1000 г or more', () => {
    // 4 куриных бедра по 150 г = 600 г → округление вверх до шага 500 → 1000 г → 1 кг
    expect(toShoppingQuantity('куриные бёдра', 600, 'г')).toEqual({ qty: 1, unit: 'кг' });
  });

  it('applies minG as a floor even when the computed amount is smaller', () => {
    // 1 шт лука = 100 г, но минимальная покупка — 500 г
    expect(toShoppingQuantity('лук', 100, 'г')).toEqual({ qty: 500, unit: 'г' });
  });

  it('formats мл/л for liquid products using buyUnit', () => {
    // 200 мл молока → шаг 500 → 500 мл
    expect(toShoppingQuantity('молоко', 200, 'мл')).toEqual({ qty: 500, unit: 'мл' });
  });

  it('rounds any discrete purchase unit up to a whole number regardless of a table entry', () => {
    expect(toShoppingQuantity('яйца', 5.5, 'шт')).toEqual({ qty: 6, unit: 'шт' });
    expect(toShoppingQuantity('петрушка', 0.25, 'пучок')).toEqual({ qty: 1, unit: 'пучок' });
    expect(toShoppingQuantity('чеснок', 2.5, 'зуб')).toEqual({ qty: 3, unit: 'зуб' });
  });

  it('returns null when there is no conversion entry and the unit is not discrete', () => {
    expect(toShoppingQuantity('незнакомый продукт', 3, 'ст.л')).toBeNull();
  });

  it('returns null when qty is null', () => {
    expect(toShoppingQuantity('картошка', null, 'шт')).toBeNull();
  });
});

describe('NO_SHOPPING_QTY_PRODUCTS', () => {
  it('contains every seasoning/pantry product measured in spoons', () => {
    for (const p of ['соль', 'специи', 'масло растительное', 'масло сливочное', 'масло оливковое', 'сахар', 'мёд', 'какао', 'бальзамический уксус', 'мука', 'тмин']) {
      expect(NO_SHOPPING_QTY_PRODUCTS.has(p)).toBe(true);
    }
  });

  it('does not contain a real quantity-bearing product', () => {
    expect(NO_SHOPPING_QTY_PRODUCTS.has('картошка')).toBe(false);
  });
});
