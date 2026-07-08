import { describe, it, expect } from 'vitest';
import { buildRecipesTopicRecord, getBuiltinRecipeRawText, RECIPES_TOPIC_ID } from './builtinRecipesTopic.js';

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

  it('produces exactly 27 instruction texts', () => {
    expect(record.texts).toHaveLength(27);
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
