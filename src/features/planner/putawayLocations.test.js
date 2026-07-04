import { describe, it, expect } from 'vitest';
import { ZONES, getZoneForProduct } from './putawayLocations.js';

describe('ZONES', () => {
  it('has exactly six zones with the fixed ids', () => {
    expect(ZONES.map((z) => z.id)).toEqual(['freezer', 'fridge', 'pantry', 'veg', 'chem', 'table']);
  });

  it('every zone has a non-empty label and icon', () => {
    for (const zone of ZONES) {
      expect(zone.label.length).toBeGreaterThan(0);
      expect(zone.icon.length).toBeGreaterThan(0);
    }
  });
});

describe('getZoneForProduct', () => {
  it('sends most vegetables to the fridge by category default', () => {
    expect(getZoneForProduct('Овощи', 'огурцы')).toBe('fridge');
    expect(getZoneForProduct('Овощи', 'помидоры')).toBe('fridge');
  });

  it('sends root vegetables that keep at room temperature to the veg spot, not the fridge', () => {
    expect(getZoneForProduct('Овощи', 'картошка')).toBe('veg');
    expect(getZoneForProduct('Овощи', 'лук')).toBe('veg');
    expect(getZoneForProduct('Овощи', 'чеснок')).toBe('veg');
    expect(getZoneForProduct('Овощи', 'капуста')).toBe('veg');
  });

  it('does not let "зелёный лук" (green onion) false-match the "лук" override', () => {
    expect(getZoneForProduct('Зелень', 'зелёный лук')).toBe('fridge');
  });

  it('sends fruit to the table', () => {
    expect(getZoneForProduct('Фрукты', 'бананы')).toBe('table');
  });

  it('sends raw meat and fish to the freezer (v1 simplification)', () => {
    expect(getZoneForProduct('Мясо', 'грудка')).toBe('freezer');
    expect(getZoneForProduct('Рыба', 'лосось')).toBe('freezer');
  });

  it('sends ice cream to the freezer even though its category is dairy', () => {
    expect(getZoneForProduct('Молочные продукты', 'мороженое')).toBe('freezer');
  });

  it('sends other dairy to the fridge', () => {
    expect(getZoneForProduct('Молочные продукты', 'молоко')).toBe('fridge');
  });

  it('sends household chemicals to their own cupboard', () => {
    expect(getZoneForProduct('Бытовая химия', 'мыло')).toBe('chem');
  });

  it('sends dry-goods categories to the pantry', () => {
    expect(getZoneForProduct('Бакалея', 'рис')).toBe('pantry');
    expect(getZoneForProduct('Консервы', 'оливки')).toBe('pantry');
    expect(getZoneForProduct('Напитки', 'чай')).toBe('pantry');
  });

  it('matches product overrides case-insensitively', () => {
    expect(getZoneForProduct('Овощи', 'КАРТОШКА')).toBe('veg');
  });

  it('returns null for an unrecognized category', () => {
    expect(getZoneForProduct('Из меню', 'что-то непонятное')).toBeNull();
  });
});
