import { describe, it, expect } from 'vitest';
import { stepPortionsMultiplier, applyPortions, formatPortionsPhrase, computeStepSegments, parseTimerMinutesFromText, applyFireEmoji, applyOptionSelections, filterStepsByOptions, extractAdjustableTemplates, computeAdjustableDefault, formatWithUnit, formatCompact } from './parseRecipeTxt.js';

describe('stepPortionsMultiplier', () => {
  it('scales a regular recipe by chosen/base portions', () => {
    expect(stepPortionsMultiplier(4, null, 8)).toBe(2);
  });

  it('returns 1 when chosen portions equal the base', () => {
    expect(stepPortionsMultiplier(4, null, 4)).toBe(1);
  });

  it('falls back to base portions when nothing else is chosen', () => {
    expect(stepPortionsMultiplier(4, null, undefined)).toBe(1);
  });

  it('fixed_portions recipes get a multiplier of 1 when fixedPortions equals base (regression: used to multiply by the absolute fixedPortions value)', () => {
    expect(stepPortionsMultiplier(6, 6, 3)).toBe(1);
  });

  it('fixedPortions always wins over chosenPortions', () => {
    expect(stepPortionsMultiplier(4, 4, 20)).toBe(1);
  });

  it('matches the shopping list scale ratio (fixedPortions / basePortions) even when they differ', () => {
    expect(stepPortionsMultiplier(3, 6, 1)).toBe(2);
  });

  it('treats a falsy basePortions as 1', () => {
    expect(stepPortionsMultiplier(0, null, 2)).toBe(2);
  });
});

describe('applyPortions with stepPortionsMultiplier (integration)', () => {
  it('leaves a fixed_portions recipe step at its written amount', () => {
    const multiplier = stepPortionsMultiplier(6, 6, 6);
    const text = 'Добавить {2|чайную ложку|чайные ложки|чайных ложек} соли.';
    expect(applyPortions(text, multiplier)).toBe('Добавить 2 чайные ложки соли.');
  });

  it('scales a regular recipe step to the chosen portions', () => {
    const multiplier = stepPortionsMultiplier(4, null, 8);
    const text = 'Добавить {2|столовую ложку|столовые ложки|столовых ложек} сливочного масла.';
    expect(applyPortions(text, multiplier)).toBe('Добавить 4 столовые ложки сливочного масла.');
  });

  it('declines "половину X" correctly for a teaspoon at half quantity', () => {
    const multiplier = stepPortionsMultiplier(4, null, 2); // 1 * (2/4) = 0.5
    const text = 'Добавить {1|чайную ложку|чайные ложки|чайных ложек} тмина.';
    expect(applyPortions(text, multiplier)).toBe('Добавить половину чайной ложки тмина.');
  });

  it('declines "половину X" correctly for a tablespoon at half quantity', () => {
    const multiplier = stepPortionsMultiplier(4, null, 2); // 1 * (2/4) = 0.5
    const text = 'Добавить {1|столовую ложку|столовые ложки|столовых ложек} масла.';
    expect(applyPortions(text, multiplier)).toBe('Добавить половину столовой ложки масла.');
  });

  it('declines "N с половиной X" correctly for a teaspoon', () => {
    const multiplier = stepPortionsMultiplier(4, null, 6); // 1 * (6/4) = 1.5
    const text = 'Добавить {1|чайную ложку|чайные ложки|чайных ложек} соли.';
    expect(applyPortions(text, multiplier)).toBe('Добавить 1 с половиной чайной ложки соли.');
  });

  it('additive {base+step|...} stays at base when the multiplier is 1 (recipe\'s own base portions)', () => {
    const text = 'Подогревать {3+1|минуту|минуты|минут}.';
    expect(applyPortions(text, 1)).toBe('Подогревать 3 минуты.');
  });

  it('additive {base+step|...} adds a flat step per extra batch multiple, not a re-multiplication', () => {
    const text = 'Подогревать {3+1|минуту|минуты|минут}.';
    expect(applyPortions(text, 2)).toBe('Подогревать 4 минуты.'); // 3 + 1*(2-1), not 3*2=6
    expect(applyPortions(text, 3)).toBe('Подогревать 5 минут.');
    expect(applyPortions(text, 8)).toBe('Подогревать 10 минут.');
  });

  it('additive {base+step|...} and ordinary {N|...} templates can coexist in the same text', () => {
    const text = 'Налить {1|стакан|стакана|стаканов} молока. Подогревать {3+1|минуту|минуты|минут}.';
    expect(applyPortions(text, 2)).toBe('Налить 2 стакана молока. Подогревать 4 минуты.');
  });

  it('conditional {N?singular|plural} picks the singular phrase when the scaled quantity is exactly 1', () => {
    const text = 'Аккуратно разлить какао {1?в кружку|по кружкам}.';
    expect(applyPortions(text, 1)).toBe('Аккуратно разлить какао в кружку.');
  });

  it('conditional {N?singular|plural} picks the plural phrase for anything above 1', () => {
    const text = 'Аккуратно разлить какао {1?в кружку|по кружкам}.';
    expect(applyPortions(text, 2)).toBe('Аккуратно разлить какао по кружкам.');
    expect(applyPortions(text, 3)).toBe('Аккуратно разлить какао по кружкам.');
    expect(applyPortions(text, 8)).toBe('Аккуратно разлить какао по кружкам.');
  });

  it('conditional {N?...} coexists with additive and ordinary templates in the same text', () => {
    const text = 'Подогревать {3+1|минуту|минуты|минут}. Разлить {1|кружку|кружки|кружек}, {1?в кружку|по кружкам}.';
    expect(applyPortions(text, 2)).toBe('Подогревать 4 минуты. Разлить 2 кружки, по кружкам.');
  });
});

describe('formatPortionsPhrase', () => {
  it('uses collective numerals for 1-8 portions', () => {
    expect(formatPortionsPhrase(1)).toBe('Готовим на одного');
    expect(formatPortionsPhrase(2)).toBe('Готовим на двоих');
    expect(formatPortionsPhrase(3)).toBe('Готовим на троих');
    expect(formatPortionsPhrase(4)).toBe('Готовим на четверых');
    expect(formatPortionsPhrase(5)).toBe('Готовим на пятерых');
    expect(formatPortionsPhrase(6)).toBe('Готовим на шестерых');
    expect(formatPortionsPhrase(7)).toBe('Готовим на семерых');
    expect(formatPortionsPhrase(8)).toBe('Готовим на восьмерых');
  });

  it('falls back to "на N человек" above 8', () => {
    expect(formatPortionsPhrase(9)).toBe('Готовим на 9 человек');
    expect(formatPortionsPhrase(12)).toBe('Готовим на 12 человек');
  });

  it('treats a falsy/zero count as 1', () => {
    expect(formatPortionsPhrase(0)).toBe('Готовим на одного');
    expect(formatPortionsPhrase(undefined)).toBe('Готовим на одного');
  });

  it('rounds a fractional count', () => {
    expect(formatPortionsPhrase(2.4)).toBe('Готовим на двоих');
  });
});

describe('computeStepSegments', () => {
  it('groups a typical recipe into segments by heading', () => {
    const steps = [
      { type: 'heading', text: 'Омлет' },
      { type: 'heading', text: 'Подготовка' },
      { type: 'checklist', text: 'Собери ингредиенты' },
      { type: 'heading', text: 'Готовим' },
      { type: 'action', text: 'Разбей яйца' },
      { type: 'action', text: 'Взбей вилкой' },
    ];
    expect(computeStepSegments(steps)).toEqual([
      { title: 'Омлет', startIndex: 0, count: 1 },
      { title: 'Подготовка', startIndex: 1, count: 2 },
      { title: 'Готовим', startIndex: 3, count: 3 },
    ]);
  });

  it('puts steps before the first heading into an untitled segment', () => {
    const steps = [
      { type: 'action', text: 'Разогрей сковороду' },
      { type: 'heading', text: 'Готовим' },
      { type: 'action', text: 'Налей масло' },
    ];
    expect(computeStepSegments(steps)).toEqual([
      { title: null, startIndex: 0, count: 1 },
      { title: 'Готовим', startIndex: 1, count: 2 },
    ]);
  });

  it('treats a recipe with no headings as one untitled segment', () => {
    const steps = [
      { type: 'action', text: 'Раз' },
      { type: 'action', text: 'Два' },
    ];
    expect(computeStepSegments(steps)).toEqual([
      { title: null, startIndex: 0, count: 2 },
    ]);
  });

  it('handles back-to-back headings as separate single-step segments', () => {
    const steps = [
      { type: 'heading', text: 'А' },
      { type: 'heading', text: 'Б' },
      { type: 'action', text: 'Шаг' },
    ];
    expect(computeStepSegments(steps)).toEqual([
      { title: 'А', startIndex: 0, count: 1 },
      { title: 'Б', startIndex: 1, count: 2 },
    ]);
  });

  it('returns an empty array for no steps', () => {
    expect(computeStepSegments([])).toEqual([]);
  });
});

describe('parseTimerMinutesFromText', () => {
  it('returns null for steps with no timer marker', () => {
    expect(parseTimerMinutesFromText('Нарезать лук мелким кубиком.')).toBeNull();
  });

  it('reads a plain "N минут (установить таймер)" duration', () => {
    expect(parseTimerMinutesFromText('Варить 25 минут (установить таймер).')).toBe(25);
  });

  it('reads a "N минуту" singular duration', () => {
    expect(parseTimerMinutesFromText('Томить 1 минуту (установить таймер). Перемешать.')).toBe(1);
  });

  it('rounds sub-minute "N секунд" waits up to 1 minute (dial has no finer resolution)', () => {
    expect(parseTimerMinutesFromText('Подождать 45 секунд (установить таймер).')).toBe(1);
  });

  it('prefers an explicit "установить таймер на N минут" override over the earlier duration', () => {
    expect(parseTimerMinutesFromText('Запекать 1 час (установить таймер на 60 минут).')).toBe(60);
  });

  it('honors an explicit override even when it disagrees with the earlier duration', () => {
    expect(parseTimerMinutesFromText('Варить 10 минут (установить таймер на 12 минут).')).toBe(12);
  });

  it('picks the last duration mention before the marker when several numbers appear', () => {
    expect(parseTimerMinutesFromText('Обжаривать вместе 3 минуты, помешивая (установить таймер).')).toBe(3);
  });

  it('ignores durations mentioned after the timer marker', () => {
    expect(parseTimerMinutesFromText('Варить 8 минут, часто помешивать ложкой (установить таймер). Потом добавить 2 ложки соли.')).toBe(8);
  });
});

describe('applyFireEmoji', () => {
  it('replaces each heat level with the matching number of fire emoji, no mapping given', () => {
    expect(applyFireEmoji('Включить нагрев (слабый огонь).')).toBe('Включить нагрев (🔥).');
    expect(applyFireEmoji('Включить нагрев (средний огонь).')).toBe('Включить нагрев (🔥🔥).');
    expect(applyFireEmoji('Включить нагрев (сильный огонь).')).toBe('Включить нагрев (🔥🔥🔥).');
    expect(applyFireEmoji('Включить нагрев (очень сильный огонь).')).toBe('Включить нагрев (🔥🔥🔥🔥).');
  });

  it('does not let "сильный огонь" swallow "очень сильный огонь"', () => {
    expect(applyFireEmoji('очень сильный огонь')).toBe('🔥🔥🔥🔥');
  });

  it('appends the family\'s configured stove dial number next to the emoji', () => {
    const mapping = { weak: 2, medium: 4, strong: 6, veryStrong: 9 };
    expect(applyFireEmoji('Включить нагрев (слабый огонь).', mapping)).toBe('Включить нагрев (🔥 · 2).');
    expect(applyFireEmoji('Включить нагрев (средний огонь).', mapping)).toBe('Включить нагрев (🔥🔥 · 4).');
    expect(applyFireEmoji('Включить нагрев (сильный огонь).', mapping)).toBe('Включить нагрев (🔥🔥🔥 · 6).');
    expect(applyFireEmoji('Включить нагрев (очень сильный огонь).', mapping)).toBe('Включить нагрев (🔥🔥🔥🔥 · 9).');
  });

  it('falls back to plain emoji for a level left unconfigured in the mapping', () => {
    const mapping = { weak: 2, medium: null, strong: null, veryStrong: null };
    expect(applyFireEmoji('Включить нагрев (слабый огонь).', mapping)).toBe('Включить нагрев (🔥 · 2).');
    expect(applyFireEmoji('Включить нагрев (средний огонь).', mapping)).toBe('Включить нагрев (🔥🔥).');
  });

  it('returns an empty string for empty/nullish input', () => {
    expect(applyFireEmoji('')).toBe('');
    expect(applyFireEmoji(null)).toBe('');
    expect(applyFireEmoji(undefined)).toBe('');
  });
});

describe('applyOptionSelections', () => {
  it('fills in a single chosen option', () => {
    expect(applyOptionSelections('Добавить в тарелку по вкусу: {topping}.', { topping: ['мёд'] }))
      .toBe('Добавить в тарелку по вкусу: мёд.');
  });

  it('joins two choices with "и"', () => {
    expect(applyOptionSelections('{topping}', { topping: ['мёд', 'ягоды'] })).toBe('мёд и ягоды');
  });

  it('joins three or more choices with commas and a final "и"', () => {
    expect(applyOptionSelections('{topping}', { topping: ['мёд', 'ягоды', 'банан'] })).toBe('мёд, ягоды и банан');
  });

  it('does not confuse a portions {N} token with an option placeholder', () => {
    expect(applyOptionSelections('{2} стакана', { topping: ['мёд'] })).toBe('{2} стакана');
  });

  it('leaves unrelated text untouched when selections is empty/undefined', () => {
    expect(applyOptionSelections('Обычный шаг без опций.', {})).toBe('Обычный шаг без опций.');
  });
});

describe('filterStepsByOptions', () => {
  it('keeps a step whose option group has at least one selection', () => {
    const steps = [{ id: 's1', type: 'action', text: 'Добавить {topping}.' }];
    expect(filterStepsByOptions(steps, { topping: ['мёд'] })).toEqual(steps);
  });

  it('drops a step whose option group has nothing selected', () => {
    const steps = [
      { id: 's1', type: 'action', text: 'Обычный шаг.' },
      { id: 's2', type: 'action', text: 'Добавить {topping}.' },
    ];
    expect(filterStepsByOptions(steps, { topping: [] })).toEqual([steps[0]]);
  });

  it('drops a step whose option group was never selected at all', () => {
    const steps = [{ id: 's1', type: 'action', text: 'Добавить {topping}.' }];
    expect(filterStepsByOptions(steps, {})).toEqual([]);
  });

  it('keeps steps with no option placeholder regardless of selections', () => {
    const steps = [{ id: 's1', type: 'action', text: 'Перемешать.' }];
    expect(filterStepsByOptions(steps, {})).toEqual(steps);
  });
});

describe('applyPortions with key: overrides', () => {
  it('uses the override value instead of the additive formula when a key matches', () => {
    const text = 'Добавить {oil:1+0.5|столовую ложку|столовые ложки|столовых ложек} масла.';
    expect(applyPortions(text, 3, { oil: 5 })).toBe('Добавить 5 столовых ложек масла.');
  });

  it('falls back to the additive formula when the key has no override', () => {
    const text = 'Добавить {oil:1+0.5|столовую ложку|столовые ложки|столовых ложек} масла.';
    expect(applyPortions(text, 3)).toBe('Добавить 2 столовые ложки масла.'); // 1 + 0.5*(3-1)
  });

  it('uses the override value instead of the proportional formula for a keyed {key:N|...} template', () => {
    const text = 'Добавить {salt:2|чайную ложку|чайные ложки|чайных ложек} соли.';
    expect(applyPortions(text, 4, { salt: 1 })).toBe('Добавить 1 чайную ложку соли.');
  });

  it('leaves an unkeyed template unaffected by an unrelated override', () => {
    const text = 'Добавить {2|чайную ложку|чайные ложки|чайных ложек} соли.';
    expect(applyPortions(text, 2, { oil: 99 })).toBe('Добавить 4 чайные ложки соли.');
  });

  it('defaults overrides to an empty object when omitted (no crash, ordinary scaling)', () => {
    const text = 'Добавить {oil:1+0.5|столовую ложку|столовые ложки|столовых ложек} масла.';
    expect(applyPortions(text, 1)).toBe('Добавить 1 столовую ложку масла.');
  });
});

describe('extractAdjustableTemplates', () => {
  it('finds an additive keyed template', () => {
    const text = 'Добавить {oil:1+0.5|столовую ложку|столовые ложки|столовых ложек} масла.';
    expect(extractAdjustableTemplates(text)).toEqual([
      { key: 'oil', kind: 'additive', base: 1, step: 0.5, one: 'столовую ложку', few: 'столовые ложки', many: 'столовых ложек' },
    ]);
  });

  it('finds a proportional keyed template', () => {
    const text = 'Добавить {salt:2|чайную ложку|чайные ложки|чайных ложек} соли.';
    expect(extractAdjustableTemplates(text)).toEqual([
      { key: 'salt', kind: 'proportional', base: 2, one: 'чайную ложку', few: 'чайные ложки', many: 'чайных ложек' },
    ]);
  });

  it('ignores unkeyed templates', () => {
    const text = 'Добавить {2|чайную ложку|чайные ложки|чайных ложек} соли.';
    expect(extractAdjustableTemplates(text)).toEqual([]);
  });

  it('dedupes a repeated key, keeping the first occurrence', () => {
    const text = '{time:5+1|минуту|минуты|минут} и снова {time:5+1|минуту|минуты|минут}.';
    expect(extractAdjustableTemplates(text)).toHaveLength(1);
  });

  it('finds multiple distinct keys in the same text', () => {
    const text = '{oil:1+0.5|ложку|ложки|ложек} и {butter:1+0.5|ложку|ложки|ложек}.';
    expect(extractAdjustableTemplates(text).map((t) => t.key)).toEqual(['oil', 'butter']);
  });
});

describe('computeAdjustableDefault', () => {
  it("computes the additive formula at the recipe's own base portions", () => {
    expect(computeAdjustableDefault({ kind: 'additive', base: 1, step: 0.5 }, 1)).toBe(1);
  });

  it('computes the additive formula above base portions', () => {
    expect(computeAdjustableDefault({ kind: 'additive', base: 1, step: 0.5 }, 8)).toBe(4.5); // 1 + 0.5*7
  });

  it('computes the proportional formula', () => {
    expect(computeAdjustableDefault({ kind: 'proportional', base: 2 }, 3)).toBe(6);
  });
});

describe('formatWithUnit (exported for the ingredient-stepper UI)', () => {
  it('formats a whole number', () => {
    expect(formatWithUnit(3, 'минуту', 'минуты', 'минут')).toBe('3 минуты');
  });

  it('formats a half quantity as "половину X"', () => {
    expect(formatWithUnit(0.5, 'ложку', 'ложки', 'ложек')).toBe('половину ложки');
  });
});

describe('formatCompact (compact settings-screen readout)', () => {
  it('formats a whole number with the given unit', () => {
    expect(formatCompact(3, 'мин')).toBe('3 мин');
  });

  it('formats a half quantity with a fraction glyph, not a spelled-out word', () => {
    expect(formatCompact(4.5, 'ст.л.')).toBe('4½ ст.л.');
  });

  it('formats a half quantity below 1 as a bare fraction glyph', () => {
    expect(formatCompact(0.5, 'ч.л.')).toBe('½ ч.л.');
  });

  it('snaps a near-half float to the nearest half before formatting', () => {
    expect(formatCompact(2.4999999999, 'мин')).toBe('2½ мин');
  });
});
