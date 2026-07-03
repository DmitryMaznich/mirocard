import { describe, it, expect } from 'vitest';
import { parseRecipeMetadata } from './recipeParser.js';

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

  it('extracts fixed_portions as integer', () => {
    const content = '# portions: 6\n# fixed_portions: 6\nТест\n';
    const { fixedPortions } = parseRecipeMetadata(content);
    expect(fixedPortions).toBe(6);
  });

  it('defaults fixedPortions to null when absent', () => {
    const { fixedPortions } = parseRecipeMetadata('# portions: 2\nТест\n');
    expect(fixedPortions).toBeNull();
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
    expect(result.ingredients).toHaveLength(4);
    expect(result.ingredients[0]).toEqual({ product: 'колбаса', qty: 200, unit: 'г' });
    expect(result.ingredients[3]).toEqual({ product: 'соль', qty: null, unit: null });
  });
});
