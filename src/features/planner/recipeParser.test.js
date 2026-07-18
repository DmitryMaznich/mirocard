import { describe, it, expect } from 'vitest';
import { parseRecipeMetadata, GLOBAL_MAX_PORTIONS, scalePortionQty } from './recipeParser.js';

describe('parseRecipeMetadata', () => {
  it('extracts tags from # tags: line', () => {
    const content = '# tags: завтрак, обед\nТест рецепт\n';
    const { tags } = parseRecipeMetadata(content);
    expect(tags).toEqual(['завтрак', 'обед']);
  });

  it('extracts single tag without trailing comma', () => {
    const content = '# tags: ужин\nТест\n';
    const { tags } = parseRecipeMetadata(content);
    expect(tags).toEqual(['ужин']);
  });

  it('extracts portions as integer', () => {
    const content = '# portions: 4\nТест\n';
    const { portions } = parseRecipeMetadata(content);
    expect(portions).toBe(4);
  });

  it('defaults portions to 1 when absent', () => {
    const { portions } = parseRecipeMetadata('Тест рецепт без метаданных\n');
    expect(portions).toBe(1);
  });

  it('extracts photo filename', () => {
    const { photo } = parseRecipeMetadata('# photo: soup.webp\nТест\n');
    expect(photo).toBe('soup.webp');
  });

  it('defaults photo to null when absent', () => {
    const { photo } = parseRecipeMetadata('# portions: 2\nТест\n');
    expect(photo).toBeNull();
  });

  it('derives fixedPortions from type: fixed, using portions as the count', () => {
    const content = '# portions: 6\n# type: fixed\nТест\n';
    const { fixedPortions } = parseRecipeMetadata(content);
    expect(fixedPortions).toBe(6);
  });

  it('defaults fixedPortions to null when type is absent', () => {
    const { fixedPortions } = parseRecipeMetadata('# portions: 2\nТест\n');
    expect(fixedPortions).toBeNull();
  });

  it('defaults fixedPortions to null when type is not "fixed"', () => {
    const { fixedPortions } = parseRecipeMetadata('# portions: 2\n# type: per_portion\nТест\n');
    expect(fixedPortions).toBeNull();
  });

  it('derives fixedPortions correctly when type: fixed appears before portions:', () => {
    const content = '# type: fixed\n# portions: 4\nТест\n';
    const { fixedPortions } = parseRecipeMetadata(content);
    expect(fixedPortions).toBe(4);
  });

  it('exports a single global portions ceiling constant', () => {
    expect(GLOBAL_MAX_PORTIONS).toBe(8);
  });

  it('extracts ingredient with qty and unit', () => {
    const content = '# ingredients:\n#   яйца | 3 | шт\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toEqual([{ product: 'яйца', qty: 3, unit: 'шт' }]);
  });

  it('extracts ingredient with null qty and unit when empty', () => {
    const content = '# ingredients:\n#   соль | |\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toEqual([{ product: 'соль', qty: null, unit: null }]);
  });

  it('extracts multiple ingredients', () => {
    const content = '# ingredients:\n#   яйца | 3 | шт\n#   молоко | 100 | мл\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toHaveLength(2);
    expect(ingredients[0].product).toBe('яйца');
    expect(ingredients[1].product).toBe('молоко');
  });

  it('stops ingredient block at next # key', () => {
    const content = '# ingredients:\n#   яйца | 3 | шт\n# status: final\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toHaveLength(1);
  });

  it('stops ingredient block at non-comment line', () => {
    const content = '# ingredients:\n#   яйца | 3 | шт\nТекст рецепта\n#   молоко | 1 | шт\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toHaveLength(1);
  });

  it('extracts an additive keyed ingredient qty ("key:base+step")', () => {
    const content = '# ingredients:\n#   масло | oil:1+0.5 | ст.л\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toEqual([{ product: 'масло', qty: 1, unit: 'ст.л', key: 'oil', additiveStep: 0.5 }]);
  });

  it('extracts a keyed ingredient qty with no additive step ("key:base")', () => {
    const content = '# ingredients:\n#   соль | salt:2 | ч.л\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toEqual([{ product: 'соль', qty: 2, unit: 'ч.л', key: 'salt' }]);
  });

  it('leaves a plain unkeyed ingredient qty exactly as before (no key/additiveStep fields)', () => {
    const content = '# ingredients:\n#   яйца | 3 | шт\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toEqual([{ product: 'яйца', qty: 3, unit: 'шт' }]);
  });

  it('extracts an additive keyed option qty', () => {
    const content = '# options:\n#   topping | мёд | dip:1+0.5 | ч.л\nТест\n';
    const { options } = parseRecipeMetadata(content);
    expect(options.topping).toEqual([{ product: 'мёд', qty: 1, unit: 'ч.л', key: 'dip', additiveStep: 0.5 }]);
  });

  it('extracts status: final', () => {
    const { status } = parseRecipeMetadata('# status: final\nТест\n');
    expect(status).toBe('final');
  });

  it('extracts status: draft', () => {
    const { status } = parseRecipeMetadata('# status: draft\nТест\n');
    expect(status).toBe('draft');
  });

  it('defaults status to draft when absent', () => {
    const { status } = parseRecipeMetadata('Тест рецепт без метаданных\n');
    expect(status).toBe('draft');
  });

  it('treats an unrecognized status value as draft', () => {
    const { status } = parseRecipeMetadata('# status: review\nТест\n');
    expect(status).toBe('draft');
  });

  it('returns empty arrays when no metadata', () => {
    const { tags, ingredients } = parseRecipeMetadata('Просто рецепт без метаданных\n');
    expect(tags).toEqual([]);
    expect(ingredients).toEqual([]);
  });

  it('parses full realistic header', () => {
    const content = [
      '# photo: scramble_sausage.webp',
      '# status: final',
      '# tags: завтрак',
      '# portions: 2',
      '# ingredients:',
      '#   колбаса | 200 | г',
      '#   яйца | 3 | шт',
      '#   масло сливочное | 30 | г',
      '#   соль | |',
      'Скрамбл с колбасой',
    ].join('\n');
    const result = parseRecipeMetadata(content);
    expect(result.tags).toEqual(['завтрак']);
    expect(result.portions).toBe(2);
    expect(result.status).toBe('final');
    expect(result.photo).toBe('scramble_sausage.webp');
    expect(result.ingredients).toHaveLength(4);
    expect(result.ingredients[0]).toEqual({ product: 'колбаса', qty: 200, unit: 'г' });
    expect(result.ingredients[3]).toEqual({ product: 'соль', qty: null, unit: null });
  });
});

describe('scalePortionQty', () => {
  it('scales a plain (non-additive) qty proportionally', () => {
    expect(scalePortionQty(2, null, 3)).toBe(6);
  });

  it('grows an additive qty by a flat step per extra portion, not a re-multiplication', () => {
    expect(scalePortionQty(1, 0.5, 3)).toBe(2); // 1 + 0.5*(3-1)
  });

  it('stays at the base value when scale is 1 for an additive qty', () => {
    expect(scalePortionQty(1, 0.5, 1)).toBe(1);
  });

  it('returns null when qty is null, regardless of additiveStep', () => {
    expect(scalePortionQty(null, 0.5, 3)).toBeNull();
  });
});
