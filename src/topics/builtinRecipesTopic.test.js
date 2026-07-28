import { describe, it, expect } from 'vitest';
import { buildRecipesTopicRecord, getBuiltinRecipeRawText, RECIPES_TOPIC_ID, parseAdjustable, parseOptionGroups } from './builtinRecipesTopic.js';

describe('buildRecipesTopicRecord', () => {
  const record = buildRecipesTopicRecord();

  it('uses the reading_dad_texts id and reading renderer', () => {
    expect(record.meta.id).toBe(RECIPES_TOPIC_ID);
    expect(record.meta.renderer).toBe('reading');
  });

  it('is marked builtin and hidden', () => {
    expect(record.meta.builtin).toBe(true);
    expect(record.meta.hidden).toBe(true);
  });

  it('produces exactly 36 instruction texts', () => {
    expect(record.texts).toHaveLength(36);
    expect(record.texts.every((t) => t.kind === 'instruction')).toBe(true);
  });

  it('gives each text entry a title, file, and stepCount', () => {
    const soup = record.texts.find((t) => t.file === 'recipes/soup.txt');
    expect(soup).toBeDefined();
    expect(soup.title.ru).toBe('Куриный суп с вермишелью');
    expect(soup.stepCount).toBeGreaterThan(0);
  });

  it('marks a fixed-type recipe with fixedPortions equal to its portions', () => {
    const soup = record.texts.find((t) => t.file === 'recipes/soup.txt');
    expect(soup.portions).toBe(6);
    expect(soup.fixedPortions).toBe(6);
  });

  it('leaves fixedPortions unset for a per_portion recipe', () => {
    const omelet = record.texts.find((t) => t.file === 'recipes/omelet.txt');
    expect(omelet.fixedPortions).toBeUndefined();
  });

  it('reads # max_portions: as a per-recipe override to the global portions ceiling', () => {
    const omelet = record.texts.find((t) => t.file === 'recipes/omelet.txt');
    expect(omelet.maxPortions).toBe(3);
  });

  it('leaves maxPortions unset for a recipe with no # max_portions: line', () => {
    const soup = record.texts.find((t) => t.file === 'recipes/soup.txt');
    expect(soup.maxPortions).toBeUndefined();
  });

  it('leaves adjustable unset for a recipe with no # adjustable: block', () => {
    const soup = record.texts.find((t) => t.file === 'recipes/soup.txt');
    expect(soup.adjustable).toBeUndefined();
  });

  it('parses a keyed option qty (e.g. omelette milk\'s "milk:2") the same way flat ingredients do, not as a bare number', () => {
    const omelet = record.texts.find((t) => t.file === 'recipes/omelet.txt');
    expect(omelet.options.milk).toEqual([{ product: 'молоко', qty: 2, unit: 'ст.л', key: 'milk' }]);
    expect(omelet.adjustable.milk).toEqual({ group: 'ingredient', label: 'Молоко', unit: 'ст.л.', optionGroup: 'milk' });
  });

  it('parses a keyed additive option qty (e.g. omelette herbs\' "herbs:0.5+0.25")', () => {
    const omelet = record.texts.find((t) => t.file === 'recipes/omelet.txt');
    expect(omelet.options.herbs).toEqual([{ product: 'укроп', qty: 0.5, unit: 'пучок', key: 'herbs', additiveStep: 0.25 }]);
    expect(omelet.adjustable.herbs).toEqual({ group: 'ingredient', label: 'Зелень', unit: 'пучок', optionGroup: 'herbs' });
  });

  it('gives every text entry a media/ prefixed photo and image path', () => {
    for (const text of record.texts) {
      expect(text.photo).toMatch(/^media\//);
      expect(text.image).toMatch(/^media\/.*\.svg$/);
    }
  });
});

describe('getBuiltinRecipeRawText', () => {
  it('returns the raw txt content for a known file path', () => {
    const content = getBuiltinRecipeRawText('recipes/soup.txt');
    expect(content).toContain('Куриный суп с вермишелью');
  });

  it('returns null for an unknown file path', () => {
    expect(getBuiltinRecipeRawText('recipes/does_not_exist.txt')).toBeNull();
  });
});

describe('parseAdjustable', () => {
  it('parses key | group | label | unit lines under # adjustable:', () => {
    const content = '# adjustable:\n#   oil | ingredient | Растительное масло | ст.л.\n#   sauteTime | time | Лук и морковь | мин\nТест\n';
    expect(parseAdjustable(content)).toEqual({
      oil: { group: 'ingredient', label: 'Растительное масло', unit: 'ст.л.' },
      sauteTime: { group: 'time', label: 'Лук и морковь', unit: 'мин' },
    });
  });

  it('returns an empty object when there is no # adjustable: block', () => {
    expect(parseAdjustable('Тест рецепт без метаданных\n')).toEqual({});
  });

  it('stops the block at the next # key', () => {
    const content = '# adjustable:\n#   oil | ingredient | Масло | ст.л.\n# ingredients:\n#   яйца | 3 | шт\nТест\n';
    expect(parseAdjustable(content)).toEqual({ oil: { group: 'ingredient', label: 'Масло', unit: 'ст.л.' } });
  });

  it('skips a line missing any of the four fields', () => {
    const content = '# adjustable:\n#   oil | ingredient | Масло\nТест\n';
    expect(parseAdjustable(content)).toEqual({});
  });

  it('parses an optional 5th column linking the key to an option group (e.g. omelette milk)', () => {
    const content = '# adjustable:\n#   milk | ingredient | Молоко | ст.л. | milk\nТест\n';
    expect(parseAdjustable(content)).toEqual({
      milk: { group: 'ingredient', label: 'Молоко', unit: 'ст.л.', optionGroup: 'milk' },
    });
  });

  it('omits optionGroup entirely when the 5th column is absent', () => {
    const content = '# adjustable:\n#   oil | ingredient | Масло | ст.л.\nТест\n';
    expect(parseAdjustable(content)).toEqual({ oil: { group: 'ingredient', label: 'Масло', unit: 'ст.л.' } });
  });
});

describe('parseOptionGroups', () => {
  it('parses groupId | mode | label lines under # option_groups:', () => {
    const content = '# option_groups:\n#   filling | single | Начинка\nТест\n';
    expect(parseOptionGroups(content)).toEqual({ filling: { mode: 'single', label: 'Начинка' } });
  });

  it('returns an empty object when there is no # option_groups: block', () => {
    expect(parseOptionGroups('Тест рецепт без метаданных\n')).toEqual({});
  });

  it('stops the block at the next # key', () => {
    const content = '# option_groups:\n#   filling | single | Начинка\n# options:\n#   filling | колбаса | 80 | гр\nТест\n';
    expect(parseOptionGroups(content)).toEqual({ filling: { mode: 'single', label: 'Начинка' } });
  });

  it('skips a line missing any of the three fields', () => {
    const content = '# option_groups:\n#   filling | single\nТест\n';
    expect(parseOptionGroups(content)).toEqual({});
  });

  it("oatmeal's topping group is single-optional (at most one topping, skippable), honey is its own independent multi/toggle group", () => {
    const oatmeal = getBuiltinRecipeRawText('recipes/oatmeal.txt') ?? '';
    expect(parseOptionGroups(oatmeal)).toEqual({
      topping: { mode: 'single-optional', label: 'Топпинг' },
      honey: { mode: 'multi', label: 'Мёд' },
    });
  });

  it("omelet's filling group is single-mode and its milk/herbs groups are multi-mode, all with custom labels", () => {
    const omelet = getBuiltinRecipeRawText('recipes/omelet.txt') ?? '';
    expect(parseOptionGroups(omelet)).toEqual({
      filling: { mode: 'single', label: 'Добавка' },
      milk: { mode: 'multi', label: 'Молоко' },
      herbs: { mode: 'multi', label: 'Зелень' },
    });
  });
});
