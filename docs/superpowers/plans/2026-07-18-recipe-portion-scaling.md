# Осмысленное масштабирование порций рецептов — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Курица в сливочном соусе (`content/recipes/chicken.txt`) масштабирует масло/время
готовки аддитивно вместо линейного умножения, а Планировщик (Меню/Покупки) и экран настроек
перед готовкой (степперы ингредиентов) видят и уважают ту же формулу — вместо трёх независимых
реализаций, каждая из которых сейчас знает только про линейное умножение.

**Architecture:** Расширяем существующий шаблонный синтаксис `{N|...}`/`{база+шаг|...}`
необязательным именованным ключом `{ключ:...}` (обратно совместимо — без ключа всё работает как
раньше). Ключ связывает конкретную плашку в тексте шага с (а) строкой в `# ingredients:` для
списка покупок и (б) степпером на экране настроек «Начать готовить». Одна общая формула
`qty + additiveStep*(scale-1) : qty*scale` используется во всех местах, где раньше было отдельное
`qty * scale`.

**Tech Stack:** React (Vite), Zustand (store), Vitest.

## Global Constraints

- Синтаксис `{ключ:...}` обязан быть обратно совместим — без ключа все 28 существующих рецептов
  работают ровно как сейчас, ни один существующий тест не должен измениться в поведении.
- `# ingredients:`/`# options:` без ключа сохраняют ТОЧНО тот же объект `{product, qty, unit}` —
  никаких новых полей `key`/`additiveStep` на неключевых строках (иначе ломаются существующие
  `toEqual`-тесты с точной формой объекта в `recipeParser.test.js`).
- Формула масштабирования одна и та же везде: `additiveStep != null ? qty + additiveStep*(scale-1)
  : qty*scale`. Не дублировать её с расхождениями.
- Степперы ингредиентов существуют только на экране `RecipeStartParams` (сессионный флоу готовки
  одного рецепта). Планировщик (Меню/Покупки) их не показывает — там только формула, без override.
- Референс-документ: `docs/superpowers/specs/2026-07-18-recipe-portion-scaling-design.md`.

---

### Task 1: Именованные ключи и overrides в движке рендеринга шагов

**Files:**
- Modify: `src/topics/renderers/reading/parseRecipeTxt.js`
- Test: `src/topics/renderers/reading/parseRecipeTxt.test.js`

**Interfaces:**
- Consumes: ничего нового (базовый файл темы).
- Produces: `applyPortions(text, portions, overrides = {})` — третий параметр `{ [key]: число }`;
  `extractAdjustableTemplates(rawText) → [{key, kind: 'additive'|'proportional', base, step?, one,
  few, many}]`; `computeAdjustableDefault(template, factor) → number`; `formatWithUnit` теперь
  экспортирован. Всё это использует Task 8 (`ParamsScreen.jsx`).

- [ ] **Step 1: Написать падающие тесты**

Добавить в конец `src/topics/renderers/reading/parseRecipeTxt.test.js` (после существующего
`describe('filterStepsByOptions', ...)`, перед закрывающим концом файла):

```js
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
```

Update the import line at the top of the same file:

```js
import { stepPortionsMultiplier, applyPortions, formatPortionsPhrase, computeStepSegments, parseTimerMinutesFromText, applyFireEmoji, applyOptionSelections, filterStepsByOptions, extractAdjustableTemplates, computeAdjustableDefault, formatWithUnit } from './parseRecipeTxt.js';
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: FAIL — `extractAdjustableTemplates`/`computeAdjustableDefault`/`formatWithUnit` не
экспортированы, и `applyPortions` игнорирует третий аргумент.

- [ ] **Step 3: Реализовать `key:` в обоих видах шаблона + `overrides`**

В `src/topics/renderers/reading/parseRecipeTxt.js` заменить функцию `applyAdditiveScaling`:

```js
// find:
function applyAdditiveScaling(text, factor) {
  return text.replace(
    /\{(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g,
    (_, base, step, one, few, many) =>
      formatWithUnit(parseFloat(base) + parseFloat(step) * (factor - 1), one, few, many)
  );
}
```

```js
// replace with:
function applyAdditiveScaling(text, factor, overrides) {
  return text.replace(
    /\{(?:([a-zA-Z]\w*):)?(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g,
    (_, key, base, step, one, few, many) => {
      const value = key && overrides[key] != null
        ? overrides[key]
        : parseFloat(base) + parseFloat(step) * (factor - 1);
      return formatWithUnit(value, one, few, many);
    }
  );
}
```

Replace `applyPortions`:

```js
// find:
export function applyPortions(text, portions) {
  if (!text) return text ?? "";
  const factor = portions || 1;
  let result = applyConditionalPhrase(text, factor);
  result = applyAdditiveScaling(result, factor);
  result = result.replace(
    /\{(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g,
    (_, n, one, few, many) => formatWithUnit(parseFloat(n) * factor, one, few, many)
  );
  result = result.replace(/\{(\d+(?:\.\d+)?)\}/g, (_, n) => {
    const snapped = Math.round(parseFloat(n) * factor * 2) / 2;
    const whole   = Math.floor(snapped);
    if (snapped - whole === 0.5)
      return whole > 0 ? `${whole} с половиной` : "половина";
    return Number.isInteger(snapped) ? String(snapped) : String(parseFloat(snapped.toFixed(2)));
  });
  return result;
}
```

```js
// replace with:
export function applyPortions(text, portions, overrides = {}) {
  if (!text) return text ?? "";
  const factor = portions || 1;
  let result = applyConditionalPhrase(text, factor);
  result = applyAdditiveScaling(result, factor, overrides);
  result = result.replace(
    /\{(?:([a-zA-Z]\w*):)?(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g,
    (_, key, n, one, few, many) => {
      const value = key && overrides[key] != null ? overrides[key] : parseFloat(n) * factor;
      return formatWithUnit(value, one, few, many);
    }
  );
  result = result.replace(/\{(\d+(?:\.\d+)?)\}/g, (_, n) => {
    const snapped = Math.round(parseFloat(n) * factor * 2) / 2;
    const whole   = Math.floor(snapped);
    if (snapped - whole === 0.5)
      return whole > 0 ? `${whole} с половиной` : "половина";
    return Number.isInteger(snapped) ? String(snapped) : String(parseFloat(snapped.toFixed(2)));
  });
  return result;
}
```

Export `formatWithUnit` (currently private):

```js
// find:
function formatWithUnit(val, one, few, many) {
```

```js
// replace with:
export function formatWithUnit(val, one, few, many) {
```

- [ ] **Step 4: Реализовать `extractAdjustableTemplates` и `computeAdjustableDefault`**

Добавить в `src/topics/renderers/reading/parseRecipeTxt.js` сразу после функции `applyPortions`:

```js
const ADDITIVE_TEMPLATE_RE = /\{([a-zA-Z]\w*):(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g;
const PROPORTIONAL_KEYED_TEMPLATE_RE = /\{([a-zA-Z]\w*):(\d+(?:\.\d+)?)\|([^|}]+)\|([^|}]+)\|([^|}]+)\}/g;

/**
 * Finds every {key:...} template in a recipe's raw text — the ones a cook
 * can override with a stepper on the start-cooking screen (see
 * RecipeStartParams in ParamsScreen.jsx). Keys with no {key:...} anywhere
 * in the text are not returned even if declared in # adjustable: — no
 * template to override means no stepper. First occurrence of a repeated
 * key wins.
 */
export function extractAdjustableTemplates(rawText) {
  const found = new Map();
  let match;
  ADDITIVE_TEMPLATE_RE.lastIndex = 0;
  while ((match = ADDITIVE_TEMPLATE_RE.exec(rawText)) !== null) {
    const [, key, base, step, one, few, many] = match;
    if (!found.has(key)) {
      found.set(key, { key, kind: "additive", base: parseFloat(base), step: parseFloat(step), one, few, many });
    }
  }
  PROPORTIONAL_KEYED_TEMPLATE_RE.lastIndex = 0;
  while ((match = PROPORTIONAL_KEYED_TEMPLATE_RE.exec(rawText)) !== null) {
    const [, key, base, one, few, many] = match;
    if (!found.has(key)) {
      found.set(key, { key, kind: "proportional", base: parseFloat(base), one, few, many });
    }
  }
  return [...found.values()];
}

/**
 * The value a {key:...} template resolves to at a given portions factor,
 * before any manual override — same formula applyPortions/applyAdditiveScaling
 * use internally, exposed so the start-cooking screen can pre-fill each
 * stepper with the number the step would otherwise show.
 */
export function computeAdjustableDefault(template, factor) {
  return template.kind === "additive"
    ? template.base + template.step * (factor - 1)
    : template.base * factor;
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: PASS — все тесты, включая существующие (проверить, что старые тесты `applyPortions`/
`stepPortionsMultiplier`/`formatPortionsPhrase`/`computeStepSegments`/`parseTimerMinutesFromText`/
`applyFireEmoji`/`applyOptionSelections`/`filterStepsByOptions` не сломались).

- [ ] **Step 6: Коммит**

```bash
git add src/topics/renderers/reading/parseRecipeTxt.js src/topics/renderers/reading/parseRecipeTxt.test.js
git commit -m "feat(recipes): support keyed {key:...} templates with per-key overrides in step text"
```

---

### Task 2: `key:база+шаг` в `# ingredients:`/`# options:` (Планировщик)

**Files:**
- Modify: `src/features/planner/recipeParser.js`
- Test: `src/features/planner/recipeParser.test.js`

**Interfaces:**
- Consumes: ничего нового.
- Produces: `parseRecipeMetadata(content).ingredients[i]` теперь может содержать `key`/`additiveStep`
  (только когда указаны в файле — неключевые строки остаются `{product, qty, unit}` без изменений).
  `scalePortionQty(qty, additiveStep, scale) → number|null` — используется в Task 3 и Task 4.

- [ ] **Step 1: Написать падающие тесты**

Добавить в `src/features/planner/recipeParser.test.js`, внутри существующего
`describe('parseRecipeMetadata', ...)`, после теста `'stops ingredient block at non-comment line'`:

```js
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
```

Добавить новый блок в конец файла (после закрывающей скобки `describe('parseRecipeMetadata', ...)`):

```js
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
```

Обновить импорт в начале файла:

```js
// find:
import { parseRecipeMetadata, GLOBAL_MAX_PORTIONS } from './recipeParser.js';
```

```js
// replace with:
import { parseRecipeMetadata, GLOBAL_MAX_PORTIONS, scalePortionQty } from './recipeParser.js';
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/planner/recipeParser.test.js`
Expected: FAIL — `key`/`additiveStep` не парсятся, `scalePortionQty` не экспортирован.

- [ ] **Step 3: Реализовать парсинг и `scalePortionQty`**

В `src/features/planner/recipeParser.js` добавить после `export const GLOBAL_MAX_PORTIONS = 8;` и
перед `export function parseRecipeMetadata(content) {`:

```js
// Parses one qty-column value from an ingredient/option line. Supports:
//   "3"            → { qty: 3, key: null, additiveStep: null }
//   "1+0.5"        → { qty: 1, key: null, additiveStep: 0.5 } (unkeyed additive — rare, but valid)
//   "oil:1+0.5"    → { qty: 1, key: "oil", additiveStep: 0.5 }
//   "oil:1"        → { qty: 1, key: "oil", additiveStep: null }
//   "" / undefined → { qty: null, key: null, additiveStep: null }
// Mirrors the {key:base+step|...} step-text syntax in parseRecipeTxt.js so a
// recipe's shopping-list quantity always matches what the step actually says
// to use — see docs/superpowers/specs/2026-07-18-recipe-portion-scaling-design.md.
function parseQtyField(raw) {
  if (!raw) return { qty: null, key: null, additiveStep: null };
  const keyMatch = raw.match(/^([a-zA-Z]\w*):(.+)$/);
  const key = keyMatch ? keyMatch[1] : null;
  const rest = keyMatch ? keyMatch[2] : raw;
  const stepMatch = rest.match(/^(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)$/);
  if (stepMatch) {
    return { qty: parseFloat(stepMatch[1]) || null, key, additiveStep: parseFloat(stepMatch[2]) || null };
  }
  return { qty: parseFloat(rest) || null, key, additiveStep: null };
}

// Scales one ingredient's qty for a chosen portions factor — additive
// ingredients (additiveStep set) grow by a flat step per extra portion
// instead of re-multiplying, matching applyAdditiveScaling in
// parseRecipeTxt.js. Shared by buildSelectedIngredientsSummary
// (plannerUtils.js) and generateShoppingList (shoppingListGenerator.js) so
// both screens agree with what a recipe's steps actually say to use.
export function scalePortionQty(qty, additiveStep, scale) {
  if (qty == null) return null;
  return additiveStep != null ? qty + additiveStep * (scale - 1) : qty * scale;
}
```

Заменить блок разбора ингредиентов:

```js
// find:
    if (inIngredients) {
      // Ingredient lines are indented with 2+ spaces: "#   product | qty | unit"
      // Metadata keys use a single space: "# status: final" — not ingredients
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const product = parts[0];
        if (product) {
          ingredients.push({
            product,
            qty: parts[1] ? parseFloat(parts[1]) || null : null,
            unit: parts[2] || null,
          });
        }
        continue;
      }
      inIngredients = false;
    }
```

```js
// replace with:
    if (inIngredients) {
      // Ingredient lines are indented with 2+ spaces: "#   product | qty | unit"
      // Metadata keys use a single space: "# status: final" — not ingredients
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const product = parts[0];
        if (product) {
          const { qty, key, additiveStep } = parseQtyField(parts[1]);
          ingredients.push({
            product,
            qty,
            unit: parts[2] || null,
            ...(key != null ? { key } : {}),
            ...(additiveStep != null ? { additiveStep } : {}),
          });
        }
        continue;
      }
      inIngredients = false;
    }
```

Заменить блок разбора опций:

```js
// find:
    if (inOptions) {
      // Option lines: "#   groupId | product | qty | unit"
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const [groupId, product] = parts;
        if (groupId && product) {
          if (!options[groupId]) options[groupId] = [];
          options[groupId].push({
            product,
            qty: parts[2] ? parseFloat(parts[2]) || null : null,
            unit: parts[3] || null,
          });
        }
        continue;
      }
      inOptions = false;
    }
```

```js
// replace with:
    if (inOptions) {
      // Option lines: "#   groupId | product | qty | unit"
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const [groupId, product] = parts;
        if (groupId && product) {
          if (!options[groupId]) options[groupId] = [];
          const { qty, key, additiveStep } = parseQtyField(parts[2]);
          options[groupId].push({
            product,
            qty,
            unit: parts[3] || null,
            ...(key != null ? { key } : {}),
            ...(additiveStep != null ? { additiveStep } : {}),
          });
        }
        continue;
      }
      inOptions = false;
    }
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/features/planner/recipeParser.test.js`
Expected: PASS — все тесты, включая существующие.

- [ ] **Step 5: Коммит**

```bash
git add src/features/planner/recipeParser.js src/features/planner/recipeParser.test.js
git commit -m "feat(recipes): parse key:base+step ingredient/option qty, add scalePortionQty helper"
```

---

### Task 3: `buildSelectedIngredientsSummary` использует общую формулу

**Files:**
- Modify: `src/features/planner/plannerUtils.js`
- Test: `src/features/planner/plannerUtils.test.js`

**Interfaces:**
- Consumes: `scalePortionQty` из Task 2 (`./recipeParser.js`).
- Produces: `buildSelectedIngredientsSummary` (форма выходных элементов не меняется — по-прежнему
  `{product, qty, unit}`, только сама формула расчёта `qty`).

- [ ] **Step 1: Написать падающий тест**

Добавить в `src/features/planner/plannerUtils.test.js`, внутри существующего
`describe('buildSelectedIngredientsSummary', ...)`, после теста `'merges the same ingredient
across different selected recipes'`:

```js
  it('scales an additive-keyed ingredient by a flat step per extra portion, not proportionally', () => {
    const chicken = {
      text: { id: 'chicken_01' },
      portions: 1,
      fixedPortions: null,
      ingredients: [{ product: 'масло растительное', qty: 1, unit: 'ст.л', key: 'oil', additiveStep: 0.5 }],
    };
    let plan = selectRecipe(createPlan('s1'), 'chicken_01');
    plan = setSelectedPortions(plan, 'chicken_01', 4); // additive: 1 + 0.5*(4-1) = 2.5, not proportional 1*4=4
    const summary = buildSelectedIngredientsSummary(plan, [chicken]);
    expect(summary).toContainEqual({ product: 'масло растительное', qty: 2.5, unit: 'ст.л' });
  });
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: FAIL — сейчас формула `ing.qty * scale` даёт `4`, а не `2.5`.

- [ ] **Step 3: Реализовать**

Добавить импорт в начало `src/features/planner/plannerUtils.js`:

```js
import { scalePortionQty } from './recipeParser.js';
```

Заменить в `buildSelectedIngredientsSummary`:

```js
// find:
      const scaledQty = ing.qty != null ? ing.qty * scale : null;
```

```js
// replace with:
      const scaledQty = scalePortionQty(ing.qty, ing.additiveStep, scale);
```

И:

```js
// find:
        const scaledQty = opt.qty != null ? opt.qty * scale : null;
```

```js
// replace with:
        const scaledQty = scalePortionQty(opt.qty, opt.additiveStep, scale);
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: PASS — все тесты, включая существующие.

- [ ] **Step 5: Коммит**

```bash
git add src/features/planner/plannerUtils.js src/features/planner/plannerUtils.test.js
git commit -m "fix(planner): buildSelectedIngredientsSummary respects additive ingredient scaling"
```

---

### Task 4: `generateShoppingList` использует общую формулу

**Files:**
- Modify: `src/features/planner/shoppingListGenerator.js`
- Test: `src/features/planner/shoppingListGenerator.test.js`

**Interfaces:**
- Consumes: `scalePortionQty` из Task 2 (`./recipeParser.js`).
- Produces: `generateShoppingList` — форма выходных элементов не меняется.

- [ ] **Step 1: Написать падающий тест**

Добавить в `src/features/planner/shoppingListGenerator.test.js`, внутри `describe('generateShoppingList',
...)`, после теста `'scales qty by portionMultiplier / portions'`:

```js
  it('scales an additive-keyed ingredient by a flat step per extra portion, not proportionally', () => {
    const r = recipe('r1', [['масло растительное', 'oil:1+0.5', 'ст.л']], 1, 4); // 1 + 0.5*(4-1) = 2.5, not 1*4
    const list = generateShoppingList([r]);
    expect(list[0].qty).toBe(2.5);
    expect(list[0].unit).toBe('ст.л');
  });
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/planner/shoppingListGenerator.test.js`
Expected: FAIL — сейчас `qty * scale` не понимает `additiveStep`, и парсер qty ещё не умеет
`key:база+шаг` (Task 2 это уже дал — но сюда это не прокинуто).

- [ ] **Step 3: Реализовать**

Заменить импорт в начале `src/features/planner/shoppingListGenerator.js`:

```js
// find:
import { parseRecipeMetadata } from './recipeParser.js';
```

```js
// replace with:
import { parseRecipeMetadata, scalePortionQty } from './recipeParser.js';
```

Заменить тело цикла в `generateShoppingList`:

```js
// find:
    for (const { product, qty, unit } of ingredients) {
      const key = product.toLowerCase();
      const scaledQty = qty != null ? qty * scale : null;
      const canonical = toCanonicalQty(product, scaledQty, unit);
```

```js
// replace with:
    for (const { product, qty, unit, additiveStep } of ingredients) {
      const key = product.toLowerCase();
      const scaledQty = scalePortionQty(qty, additiveStep, scale);
      const canonical = toCanonicalQty(product, scaledQty, unit);
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/features/planner/shoppingListGenerator.test.js`
Expected: PASS — все тесты, включая существующие.

- [ ] **Step 5: Коммит**

```bash
git add src/features/planner/shoppingListGenerator.js src/features/planner/shoppingListGenerator.test.js
git commit -m "fix(planner): generateShoppingList respects additive ingredient scaling"
```

---

### Task 5: `# adjustable:` блок → `activeText.adjustable`

**Files:**
- Modify: `src/topics/builtinRecipesTopic.js`
- Test: `src/topics/builtinRecipesTopic.test.js`

**Interfaces:**
- Consumes: ничего нового.
- Produces: `activeText.adjustable` — `{ [key]: label }`, отсутствует (`undefined`) когда в файле
  нет блока `# adjustable:`. `parseAdjustable(txt)` экспортирован для прямого юнит-теста (по той же
  логике, что и остальные экспорты этого файла — `getBuiltinRecipeRawText` уже публичный).
  Используется в Task 8 (`ParamsScreen.jsx`).

- [ ] **Step 1: Написать падающие тесты**

Добавить в `src/topics/builtinRecipesTopic.test.js` новый блок в конец файла:

```js
describe('parseAdjustable', () => {
  it('parses key | label lines under # adjustable:', () => {
    const content = '# adjustable:\n#   oil | Растительное масло\n#   butter | Сливочное масло\nТест\n';
    expect(parseAdjustable(content)).toEqual({ oil: 'Растительное масло', butter: 'Сливочное масло' });
  });

  it('returns an empty object when there is no # adjustable: block', () => {
    expect(parseAdjustable('Тест рецепт без метаданных\n')).toEqual({});
  });

  it('stops the block at the next # key', () => {
    const content = '# adjustable:\n#   oil | Масло\n# ingredients:\n#   яйца | 3 | шт\nТест\n';
    expect(parseAdjustable(content)).toEqual({ oil: 'Масло' });
  });
});
```

Добавить в существующий `describe('buildRecipesTopicRecord', ...)`, после теста
`'leaves fixedPortions unset for a per_portion recipe'`:

```js
  it('leaves adjustable unset for a recipe with no # adjustable: block', () => {
    const soup = record.texts.find((t) => t.file === 'recipes/soup.txt');
    expect(soup.adjustable).toBeUndefined();
  });
```

Обновить импорт в начале файла:

```js
// find:
import { buildRecipesTopicRecord, getBuiltinRecipeRawText, RECIPES_TOPIC_ID } from './builtinRecipesTopic.js';
```

```js
// replace with:
import { buildRecipesTopicRecord, getBuiltinRecipeRawText, RECIPES_TOPIC_ID, parseAdjustable } from './builtinRecipesTopic.js';
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/topics/builtinRecipesTopic.test.js`
Expected: FAIL — `parseAdjustable` не существует.

- [ ] **Step 3: Реализовать**

В `src/topics/builtinRecipesTopic.js` добавить после функции `parseOptions` (перед
`function buildTextEntry`):

```js
// "# adjustable:" declares which {key:...} template placeholders in the step
// text get an editable stepper on the cook-start screen, and what to label
// each one — each indented line is "key | label". A key only gets a stepper
// if it's ALSO declared here AND appears in a {key:...} template somewhere
// in the steps (see extractAdjustableTemplates in parseRecipeTxt.js) — this
// block supplies the label, the step text supplies the number.
export function parseAdjustable(txt) {
  const adjustable = {};
  let inAdjustable = false;
  for (const rawLine of txt.split('\n')) {
    if (!rawLine.startsWith('#')) { inAdjustable = false; continue; }
    const afterHash = rawLine.slice(1);
    if (inAdjustable) {
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const [key, label] = parts;
        if (key && label) adjustable[key] = label;
        continue;
      }
      inAdjustable = false;
    }
    if (afterHash.trim() === 'adjustable:') inAdjustable = true;
  }
  return adjustable;
}
```

Заменить `buildTextEntry`:

```js
// find:
function buildTextEntry(id, content) {
  const photo = parseHeaderField(content, 'photo:');
  const status = parseHeaderField(content, 'status:') === 'final' ? 'final' : 'draft';
  const type = parseHeaderField(content, 'type:');
  const portionsRaw = parseHeaderField(content, 'portions:');
  const portions = portionsRaw ? (parseInt(portionsRaw, 10) || 1) : 1;
  const fixedPortions = type === 'fixed' ? portions : null;
  const title = extractTitle(content);
  const options = parseOptions(content);

  return {
    id: `${id}_instruction`,
    kind: 'instruction',
    title: { ru: title, en: title },
    ...(photo ? { photo: `media/${photo}` } : {}),
    image: `media/${id}.svg`,
    portions,
    ...(fixedPortions ? { fixedPortions } : {}),
    ...(Object.keys(options).length ? { options } : {}),
    status,
    file: `recipes/${id}.txt`,
    stepCount: countSteps(content),
  };
}
```

```js
// replace with:
function buildTextEntry(id, content) {
  const photo = parseHeaderField(content, 'photo:');
  const status = parseHeaderField(content, 'status:') === 'final' ? 'final' : 'draft';
  const type = parseHeaderField(content, 'type:');
  const portionsRaw = parseHeaderField(content, 'portions:');
  const portions = portionsRaw ? (parseInt(portionsRaw, 10) || 1) : 1;
  const fixedPortions = type === 'fixed' ? portions : null;
  const title = extractTitle(content);
  const options = parseOptions(content);
  const adjustable = parseAdjustable(content);

  return {
    id: `${id}_instruction`,
    kind: 'instruction',
    title: { ru: title, en: title },
    ...(photo ? { photo: `media/${photo}` } : {}),
    image: `media/${id}.svg`,
    portions,
    ...(fixedPortions ? { fixedPortions } : {}),
    ...(Object.keys(options).length ? { options } : {}),
    ...(Object.keys(adjustable).length ? { adjustable } : {}),
    status,
    file: `recipes/${id}.txt`,
    stepCount: countSteps(content),
  };
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/topics/builtinRecipesTopic.test.js`
Expected: PASS — все тесты, включая существующие (в частности `'produces exactly 27 instruction
texts'` — количество не меняется).

- [ ] **Step 5: Коммит**

```bash
git add src/topics/builtinRecipesTopic.js src/topics/builtinRecipesTopic.test.js
git commit -m "feat(recipes): parse # adjustable: block into activeText.adjustable"
```

---

### Task 6: `sessionIngredientOverrides` в сторе

**Files:**
- Modify: `src/core/store.js`
- Test: `src/core/store.test.js`

**Interfaces:**
- Consumes: ничего нового.
- Produces: `useAppStore().sessionIngredientOverrides` (`null` по умолчанию, `{[key]: number}`
  когда задан) и `setSessionIngredientOverrides(value)`. Используется в Task 7 (`index.jsx`) и
  Task 8 (`ParamsScreen.jsx`).

- [ ] **Step 1: Написать падающие тесты**

Добавить в `src/core/store.test.js`, внутри `describe("initial state", ...)`:

```js
  it("has null sessionIngredientOverrides", () => {
    expect(getStore().sessionIngredientOverrides).toBeNull();
  });
```

И внутри `describe("actions", ...)`:

```js
  it("setSessionIngredientOverrides updates the value", () => {
    getStore().setSessionIngredientOverrides({ oil: 2.5 });
    expect(getStore().sessionIngredientOverrides).toEqual({ oil: 2.5 });
  });
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/core/store.test.js`
Expected: FAIL — `sessionIngredientOverrides`/`setSessionIngredientOverrides` не существуют.

- [ ] **Step 3: Реализовать**

В `src/core/store.js` добавить сразу после существующего поля `setSessionOptionsOverride`:

```js
// find:
  sessionOptionsOverride: null,
  setSessionOptionsOverride: (sessionOptionsOverride) => set({ sessionOptionsOverride }),
```

```js
// replace with:
  sessionOptionsOverride: null,
  setSessionOptionsOverride: (sessionOptionsOverride) => set({ sessionOptionsOverride }),
  // Same idea as sessionPortionsOverride, for a recipe's per-ingredient
  // stepper overrides on the cook-start screen — { [key]: absoluteValue }.
  // Null means "use whatever was saved last time via saveRecipeSettings".
  sessionIngredientOverrides: null,
  setSessionIngredientOverrides: (sessionIngredientOverrides) => set({ sessionIngredientOverrides }),
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/core/store.test.js`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/core/store.js src/core/store.test.js
git commit -m "feat(store): add sessionIngredientOverrides for the recipe ingredient-stepper feature"
```

---

### Task 7: Сессия готовки прокидывает overrides в рендер шага

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx`

**Interfaces:**
- Consumes: `sessionIngredientOverrides`/`setSessionIngredientOverrides` из Task 6;
  `applyPortions(text, portions, overrides)` из Task 1.
- Produces: ничего нового наружу — внутреннее поведение компонента `InstructionTask`.

Для этого файла нет отдельных юнит-тестов (большой интеграционный UI-компонент без покрытия —
как и для остальных экранов темы `reading`). Проверка — вручную/Playwright в Task 10.

- [ ] **Step 1: Подписаться на store и локальный state**

```js
// find:
  const setScreen               = useAppStore((s) => s.setScreen);
  const sessionPortionsOverride    = useAppStore((s) => s.sessionPortionsOverride);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const sessionOptionsOverride      = useAppStore((s) => s.sessionOptionsOverride);
  const setSessionOptionsOverride   = useAppStore((s) => s.setSessionOptionsOverride);
  const sessionReturnScreen        = useAppStore((s) => s.sessionReturnScreen);
  const setSessionReturnScreen     = useAppStore((s) => s.setSessionReturnScreen);

  const [portions,   setPortions]   = useState(1);
  const [portionsCount, setPortionsCount] = useState(1);
```

```js
// replace with:
  const setScreen               = useAppStore((s) => s.setScreen);
  const sessionPortionsOverride    = useAppStore((s) => s.sessionPortionsOverride);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const sessionIngredientOverrides    = useAppStore((s) => s.sessionIngredientOverrides);
  const setSessionIngredientOverrides = useAppStore((s) => s.setSessionIngredientOverrides);
  const sessionOptionsOverride      = useAppStore((s) => s.sessionOptionsOverride);
  const setSessionOptionsOverride   = useAppStore((s) => s.setSessionOptionsOverride);
  const sessionReturnScreen        = useAppStore((s) => s.sessionReturnScreen);
  const setSessionReturnScreen     = useAppStore((s) => s.setSessionReturnScreen);

  const [portions,   setPortions]   = useState(1);
  const [portionsCount, setPortionsCount] = useState(1);
  const [ingredientOverrides, setIngredientOverrides] = useState({});
```

- [ ] **Step 2: Консьюмить override из стора один раз при загрузке шагов**

```js
// find:
      const basePortions = task.text?.portions ?? 1;
      const chosenPortions = sessionPortionsOverride ?? settings.portions ?? basePortions;
      setPortions(stepPortionsMultiplier(basePortions, task.text?.fixedPortions, chosenPortions));
      setPortionsCount(chosenPortions);
      if (sessionPortionsOverride != null) setSessionPortionsOverride(null);
      if (sessionOptionsOverride != null) setSessionOptionsOverride(null);
```

```js
// replace with:
      const basePortions = task.text?.portions ?? 1;
      const chosenPortions = sessionPortionsOverride ?? settings.portions ?? basePortions;
      setPortions(stepPortionsMultiplier(basePortions, task.text?.fixedPortions, chosenPortions));
      setPortionsCount(chosenPortions);
      setIngredientOverrides(sessionIngredientOverrides ?? settings.ingredientOverrides ?? {});
      if (sessionPortionsOverride != null) setSessionPortionsOverride(null);
      if (sessionIngredientOverrides != null) setSessionIngredientOverrides(null);
      if (sessionOptionsOverride != null) setSessionOptionsOverride(null);
```

- [ ] **Step 3: Прокинуть `ingredientOverrides` в три вызова `applyPortions`**

```js
// find:
    const minutes = parseTimerMinutesFromText(applyPortions(step?.text, portions));
```

```js
// replace with:
    const minutes = parseTimerMinutesFromText(applyPortions(step?.text, portions, ingredientOverrides));
```

```js
// find:
              const text = applyFireEmoji(applyOptionSelections(applyPortions(step.text, portions), optionSelections), stoveHeatMapping);
```

```js
// replace with:
              const text = applyFireEmoji(applyOptionSelections(applyPortions(step.text, portions, ingredientOverrides), optionSelections), stoveHeatMapping);
```

```js
// find:
                      <span className="instruction-check-label">{applyFireEmoji(applyOptionSelections(applyPortions(item, portions), optionSelections), stoveHeatMapping)}</span>
```

```js
// replace with:
                      <span className="instruction-check-label">{applyFireEmoji(applyOptionSelections(applyPortions(item, portions, ingredientOverrides), optionSelections), stoveHeatMapping)}</span>
```

- [ ] **Step 4: Обновить зависимости эффекта таймера**

Таймер уже зависит от `[stepIndex, portions]` — добавить `ingredientOverrides`, иначе изменившийся
override не переотрисует таймер, пока не сменится шаг:

```js
// find:
    const minutes = parseTimerMinutesFromText(applyPortions(step?.text, portions, ingredientOverrides));
    if (minutes && requestTimer) requestTimer(minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, portions]); // step derived from stepIndex; portions loads asynchronously and may not be settled yet on the first render for this step
```

```js
// replace with:
    const minutes = parseTimerMinutesFromText(applyPortions(step?.text, portions, ingredientOverrides));
    if (minutes && requestTimer) requestTimer(minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, portions, ingredientOverrides]); // step derived from stepIndex; portions loads asynchronously and may not be settled yet on the first render for this step
```

- [ ] **Step 5: Прогнать полный тестовый набор темы, убедиться, что ничего не сломалось**

Run: `npx vitest run src/topics/renderers/reading/`
Expected: PASS — правки в `index.jsx` не имеют собственных тестов, но не должны ронять
`engine.test.js`/`parseRecipeTxt.test.js`.

- [ ] **Step 6: Коммит**

```bash
git add src/topics/renderers/reading/index.jsx
git commit -m "feat(recipes): apply sessionIngredientOverrides when rendering recipe steps"
```

---

### Task 8: Степперы ингредиентов на экране «Начать готовить»

**Files:**
- Modify: `src/features/session/ParamsScreen.jsx`

**Interfaces:**
- Consumes: `getBuiltinRecipeRawText` (Task 5, `@/topics/builtinRecipesTopic.js`);
  `extractAdjustableTemplates`, `computeAdjustableDefault`, `formatWithUnit`,
  `stepPortionsMultiplier` (Task 1, `@/topics/renderers/reading/parseRecipeTxt.js`);
  `setSessionIngredientOverrides` (Task 6); `activeText.adjustable` (Task 5).
- Produces: ничего нового наружу — внутреннее поведение `RecipeStartParams`.

Юнит-тестов для `ParamsScreen.jsx` в проекте нет (как и для `index.jsx`) — проверка вручную/
Playwright в Task 10.

- [ ] **Step 1: Обновить импорты**

```js
// find:
import { useState, useEffect } from "react";
```

```js
// replace with:
import { useState, useEffect, useMemo } from "react";
```

```js
// find:
import { GLOBAL_MAX_PORTIONS } from "@/features/planner/recipeParser.js";
```

```js
// replace with:
import { GLOBAL_MAX_PORTIONS } from "@/features/planner/recipeParser.js";
import { getBuiltinRecipeRawText } from "@/topics/builtinRecipesTopic.js";
import { extractAdjustableTemplates, computeAdjustableDefault, formatWithUnit, stepPortionsMultiplier } from "@/topics/renderers/reading/parseRecipeTxt.js";
```

- [ ] **Step 2: Переписать `RecipeStartParams`**

```js
// find:
function RecipeStartParams({ topicId, activeText, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const setSessionOptionsOverride = useAppStore((s) => s.setSessionOptionsOverride);
  const { markSessionStart } = useTimer();
  const fixedPortions = activeText.fixedPortions ?? null;
  // Defaults to 1, not the recipe file's "written for N people" portions —
  // that's a fact about the recipe, not a choice the cook has made yet (same
  // reasoning as the menu/catalog ingredient previews). getRecipeSettings
  // below still restores whatever the cook picked last time for this recipe.
  const basePortions = 1;
  const maxPortions = GLOBAL_MAX_PORTIONS;
  const [portions, setPortions] = useState(basePortions);
  const [stoveModalOpen, setStoveModalOpen] = useState(false);
  const [options, setOptions] = useState({}); // { groupId: string[] } — last cooked-with choice
  const optionGroups = Object.entries(activeText.options ?? {});

  useEffect(() => {
    let cancelled = false;
    getRecipeSettings(topicId, activeText.id).then((s) => { if (!cancelled) setPortions(s.portions ?? basePortions); }).catch(() => {});
    getRecipeOptionSelections(topicId, activeText.id).then((s) => { if (!cancelled) setOptions(s ?? {}); }).catch(() => {});
    return () => { cancelled = true; };
  }, [topicId, activeText.id, basePortions]);

  function startSession() {
    const finalPortions = fixedPortions || portions;
    setSessionPortionsOverride(finalPortions);
    saveRecipeSettings(topicId, activeText.id, { portions: finalPortions }).catch(() => {});
    setSessionOptionsOverride(options);
    saveRecipeOptionSelections(topicId, activeText.id, options).catch(() => {});
    markSessionStart();
    setScreen("session");
  }

  return (
    <div className="params-layout">
      <div className="params-info-col">
        {student && (
          <div className="params-info-student">
            <div className="params-info-student__avatar">
              {student.photoDataUrl
                ? <img src={student.photoDataUrl} alt={student.name} />
                : getInitials(student.name)
              }
            </div>
            <div className="params-info-student__name">{student.name}</div>
          </div>
        )}
        <div className="params-info-start">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      <div className="params-settings-col">
        <div className="params-body">
          <div className="param-row">
            <div className="param-label">Порций</div>
            {fixedPortions
              ? <span className="all-texts-portions-fixed">готовим {fixedPortions}</span>
              : <div className="all-texts-portions">
                  <button className="all-texts-portions-btn" onClick={() => setPortions((p) => Math.max(1, p - 1))} disabled={portions <= 1}>−</button>
                  <span className="all-texts-portions-value">{portions}</span>
                  <button className="all-texts-portions-btn" onClick={() => setPortions((p) => Math.min(maxPortions, p + 1))} disabled={portions >= maxPortions}>+</button>
                </div>
            }
          </div>
          <div className="param-row">
            <div className="param-label">Цифры на плите</div>
            <button
              type="button"
              className="link-btn"
              onClick={() => setStoveModalOpen(true)}
            >
              Настроить
            </button>
          </div>
          {optionGroups.map(([groupId, choices]) => (
            <OptionsPicker
              key={groupId}
              label="Топпинг (можно несколько или ничего)"
              choices={choices}
              selected={options[groupId] ?? []}
              onChange={(next) => setOptions((prev) => ({ ...prev, [groupId]: next }))}
            />
          ))}
        </div>
        <div className="params-start-phone">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      {stoveModalOpen && <StoveHeatModal onClose={() => setStoveModalOpen(false)} />}
    </div>
  );
}
```

```js
// replace with:
function RecipeStartParams({ topicId, activeText, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const setSessionIngredientOverrides = useAppStore((s) => s.setSessionIngredientOverrides);
  const setSessionOptionsOverride = useAppStore((s) => s.setSessionOptionsOverride);
  const { markSessionStart } = useTimer();
  const fixedPortions = activeText.fixedPortions ?? null;
  // Defaults to 1, not the recipe file's "written for N people" portions —
  // that's a fact about the recipe, not a choice the cook has made yet (same
  // reasoning as the menu/catalog ingredient previews). getRecipeSettings
  // below still restores whatever the cook picked last time for this recipe.
  const basePortions = 1;
  const maxPortions = GLOBAL_MAX_PORTIONS;
  const [portions, setPortions] = useState(basePortions);
  const [ingredientOverrides, setIngredientOverrides] = useState({});
  const [stoveModalOpen, setStoveModalOpen] = useState(false);
  const [options, setOptions] = useState({}); // { groupId: string[] } — last cooked-with choice
  const optionGroups = Object.entries(activeText.options ?? {});

  // Only keys BOTH declared in # adjustable: (for the label) AND actually
  // present as a {key:...} template in the steps (for the number/word
  // forms) get a stepper — adjusting a key with no visible effect on any
  // step would be a dead control. Memoized on the file path only (a stable
  // string) — filtering the small resulting array against the labels object
  // every render is cheap and avoids depending on a `?? {}` object literal
  // that would get a new identity on every render.
  const adjustableLabels = activeText.adjustable ?? {};
  const allTemplates = useMemo(
    () => extractAdjustableTemplates(getBuiltinRecipeRawText(activeText.file) ?? ""),
    [activeText.file]
  );
  const adjustableTemplates = allTemplates.filter((t) => adjustableLabels[t.key] != null);
  const factor = stepPortionsMultiplier(activeText.portions, fixedPortions, portions);

  useEffect(() => {
    let cancelled = false;
    getRecipeSettings(topicId, activeText.id).then((s) => {
      if (cancelled) return;
      setPortions(s.portions ?? basePortions);
      setIngredientOverrides(s.ingredientOverrides ?? {});
    }).catch(() => {});
    getRecipeOptionSelections(topicId, activeText.id).then((s) => { if (!cancelled) setOptions(s ?? {}); }).catch(() => {});
    return () => { cancelled = true; };
  }, [topicId, activeText.id, basePortions]);

  // Changing the batch size invalidates any manual per-ingredient tweak made
  // for the old size — silently carrying it over would quietly unbalance the
  // dish (e.g. an oil amount hand-tuned for 3 portions surviving a jump to 8).
  function changePortions(next) {
    setPortions(next);
    setIngredientOverrides({});
  }

  function startSession() {
    const finalPortions = fixedPortions || portions;
    setSessionPortionsOverride(finalPortions);
    setSessionIngredientOverrides(ingredientOverrides);
    saveRecipeSettings(topicId, activeText.id, { portions: finalPortions, ingredientOverrides }).catch(() => {});
    setSessionOptionsOverride(options);
    saveRecipeOptionSelections(topicId, activeText.id, options).catch(() => {});
    markSessionStart();
    setScreen("session");
  }

  return (
    <div className="params-layout">
      <div className="params-info-col">
        {student && (
          <div className="params-info-student">
            <div className="params-info-student__avatar">
              {student.photoDataUrl
                ? <img src={student.photoDataUrl} alt={student.name} />
                : getInitials(student.name)
              }
            </div>
            <div className="params-info-student__name">{student.name}</div>
          </div>
        )}
        <div className="params-info-start">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      <div className="params-settings-col">
        <div className="params-body">
          <div className="param-row">
            <div className="param-label">Порций</div>
            {fixedPortions
              ? <span className="all-texts-portions-fixed">готовим {fixedPortions}</span>
              : <div className="all-texts-portions">
                  <button className="all-texts-portions-btn" onClick={() => changePortions(Math.max(1, portions - 1))} disabled={portions <= 1}>−</button>
                  <span className="all-texts-portions-value">{portions}</span>
                  <button className="all-texts-portions-btn" onClick={() => changePortions(Math.min(maxPortions, portions + 1))} disabled={portions >= maxPortions}>+</button>
                </div>
            }
          </div>
          {adjustableTemplates.length > 0 && (
            <div className="param-section">
              <div className="param-section__header">Количества</div>
              {adjustableTemplates.map((t) => {
                const defaultValue = computeAdjustableDefault(t, factor);
                const value = ingredientOverrides[t.key] ?? defaultValue;
                const increment = t.kind === "additive" ? t.step : 1;
                const min = Math.max(0, t.base - increment);
                return (
                  <div className="param-row" key={t.key}>
                    <div className="param-label">{adjustableLabels[t.key]}</div>
                    <div className="param-stepper">
                      <button
                        className="stepper-btn"
                        disabled={value <= min}
                        onClick={() => setIngredientOverrides((prev) => ({ ...prev, [t.key]: Math.max(min, value - increment) }))}
                      >−</button>
                      <span className="stepper-value">{formatWithUnit(value, t.one, t.few, t.many)}</span>
                      <button
                        className="stepper-btn"
                        onClick={() => setIngredientOverrides((prev) => ({ ...prev, [t.key]: value + increment }))}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="param-row">
            <div className="param-label">Цифры на плите</div>
            <button
              type="button"
              className="link-btn"
              onClick={() => setStoveModalOpen(true)}
            >
              Настроить
            </button>
          </div>
          {optionGroups.map(([groupId, choices]) => (
            <OptionsPicker
              key={groupId}
              label="Топпинг (можно несколько или ничего)"
              choices={choices}
              selected={options[groupId] ?? []}
              onChange={(next) => setOptions((prev) => ({ ...prev, [groupId]: next }))}
            />
          ))}
        </div>
        <div className="params-start-phone">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      {stoveModalOpen && <StoveHeatModal onClose={() => setStoveModalOpen(false)} />}
    </div>
  );
}
```

Обе строки `param-stepper`/`stepper-btn`/`stepper-value` CSS-классы уже существуют и используются
компонентом `NumberStepper` в этом же файле — новых классов заводить не нужно.

- [ ] **Step 3: Прогнать существующий тестовый набор, убедиться, что ничего не сломалось**

Run: `npx vitest run`
Expected: PASS — весь набор (эта задача не имеет отдельных юнит-тестов для `ParamsScreen.jsx`, но
не должна ронять смежные тесты — планировщика, движка чтения, стора).

- [ ] **Step 4: Коммит**

```bash
git add src/features/session/ParamsScreen.jsx
git commit -m "feat(recipes): add per-ingredient/time steppers to the recipe start-cooking screen"
```

---

### Task 9: Применить синтаксис к `chicken.txt`

**Files:**
- Modify: `content/recipes/chicken.txt`

**Interfaces:**
- Consumes: весь синтаксис из Task 1/2/5.
- Produces: финальный рецепт — единственная задача, которая реально видна конечному пользователю.

- [ ] **Step 1: Заменить содержимое файла**

```
// find (весь текущий файл):
# photo: chicken.webp
# status: final
# tags: обед, ужин
# portions: 1
# ingredients:
#   куриная грудка | 1 | шт
#   лук | 1 | шт
#   морковь | 1 | шт
#   сливки 20% | 100 | мл
#   масло сливочное | 1 | ст.л
#   масло растительное | 1 | ст.л
#   соль | 0.5 | ч.л
#   специи | 0.5 | ч.л
#   укроп | 0.5 | пучок
Курица в сливочном соусе
[chicken.webp]

1. Вымыть руки с мылом и вытереть насухо.
2. Подготовить посуду:
- достать сковородку
- достать доску и нож
- достать лопатку
- достать ложку
- достать тёрку
3. Подготовить продукты:
- взять куриные грудки или бедра без кости
- взять {1|луковицу|луковицы|луковиц}
- взять {1|большую морковку|большие морковки|больших морковок}
- взять сливки
- взять сливочное масло
- взять растительное масло
- взять соль
- взять ароматные травы
- взять специи
- взять зелень

— Подготовка овощей —

4. Очистить лук.
5. Нарезать лук мелким кубиком.
6. Очистить морковь. Натереть на тёрке.
 
— Готовим курицу —

7. Нарезать курицу на кусочки.
8. Поставить сковородку на плиту. Включить нагрев (сильный огонь). Добавить {1|столовую ложку|столовые ложки|столовых ложек} растительного масла и {1|столовую ложку|столовые ложки|столовых ложек} сливочного масла.
9. Дождаться пока сливочное масло растает. Перемешать лопаткой.
10. Добавить лук. Жарить, помешивая лопаткой, пока не станет золотистым.
11. Добавить морковку. Обжаривать вместе 3 минуты, помешивая (установить таймер).
12. Добавить кусочки курицы. Жарить 5 минут, помешивая лопаткой (установить таймер).
13. Проверить — курица должна быть золотистой.
14. Включить нагрев (средний огонь).
15. Добавить сливки.
16. Добавить {0.5|чайную ложку|чайные ложки|чайных ложек} соли и {0.5|чайную ложку|чайные ложки|чайных ложек} специй. Добавить ароматные травы.
17. Тушить 5 минут (установить таймер).
18. Проверить, готова ли курица (попробовать).
19. Выключить плиту.
20. Посыпать зеленью.
21. Убрать грязную посуду в раковину. Выбросить мусор.
22. Курица в сливочном соусе готова! Можно есть!
23. Добер тек!
```

```
// replace with:
# photo: chicken.webp
# status: final
# tags: обед, ужин
# portions: 1
# adjustable:
#   oil | Растительное масло
#   butter | Сливочное масло
#   sauteTime | Лук и морковь на сковороде
#   fryTime | Курица на сковороде
#   simmerTime | Тушение в сливках
# ingredients:
#   куриная грудка | 1 | шт
#   лук | 1 | шт
#   морковь | 1 | шт
#   сливки 20% | 100 | мл
#   масло сливочное | butter:1+0.5 | ст.л
#   масло растительное | oil:1+0.5 | ст.л
#   соль | 0.5 | ч.л
#   специи | 0.5 | ч.л
#   укроп | 0.5+0.25 | пучок
Курица в сливочном соусе
[chicken.webp]

1. Вымыть руки с мылом и вытереть насухо.
2. Подготовить посуду:
- достать сковородку
- достать доску и нож
- достать лопатку
- достать ложку
- достать тёрку
3. Подготовить продукты:
- взять куриные грудки или бедра без кости
- взять {1|луковицу|луковицы|луковиц}
- взять {1|большую морковку|большие морковки|больших морковок}
- взять сливки
- взять сливочное масло
- взять растительное масло
- взять соль
- взять ароматные травы
- взять специи
- взять зелень

— Подготовка овощей —

4. Очистить лук.
5. Нарезать лук мелким кубиком.
6. Очистить морковь. Натереть на тёрке.
 
— Готовим курицу —

7. Нарезать курицу на кусочки.
8. Поставить сковородку на плиту. Включить нагрев (сильный огонь). Добавить {oil:1+0.5|столовую ложку|столовые ложки|столовых ложек} растительного масла и {butter:1+0.5|столовую ложку|столовые ложки|столовых ложек} сливочного масла.
9. Дождаться пока сливочное масло растает. Перемешать лопаткой.
10. Добавить лук. Жарить, помешивая лопаткой, пока не станет золотистым.
11. Добавить морковку. Обжаривать вместе {sauteTime:3+1|минуту|минуты|минут}, помешивая (установить таймер).
12. Добавить кусочки курицы. Жарить {fryTime:5+1|минуту|минуты|минут}, помешивая лопаткой (установить таймер).
13. Проверить — курица должна быть золотистой.
14. Включить нагрев (средний огонь).
15. Добавить сливки.
16. Добавить {0.5|чайную ложку|чайные ложки|чайных ложек} соли и {0.5|чайную ложку|чайные ложки|чайных ложек} специй. Добавить ароматные травы.
17. Тушить {simmerTime:5+1|минуту|минуты|минут} (установить таймер).
18. Проверить, готова ли курица (попробовать).
19. Выключить плиту.
20. Посыпать зеленью.
21. Убрать грязную посуду в раковину. Выбросить мусор.
22. Курица в сливочном соусе готова! Можно есть!
23. Добер тек!
```

- [ ] **Step 2: Проверить рендер на реальном движке**

Run: `node scripts/preview-recipe-portions.mjs content/recipes/chicken.txt 1 2 3 4 5 6 7 8`
Expected: масло (оба вида) — 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5 ст.л; обжарка лука/моркови — 3–10 мин;
жарка курицы — 5–12 мин; тушение — 5–12 мин; лук/морковь/соль/специи — растут пропорционально
(1..8 / 0.5..4) как раньше.

- [ ] **Step 3: Прогнать полный тестовый набор**

Run: `npx vitest run`
Expected: PASS — весь набор, включая `builtinRecipesTopic.test.js` (`chicken.txt` теперь имеет
`# adjustable:`, но это не ломает существующие проверки — они не привязаны к этому файлу).

- [ ] **Step 4: Коммит**

```bash
git add content/recipes/chicken.txt
git commit -m "feat(recipes): meaningful non-linear portion scaling for chicken.txt (oil/butter/dill/time)"
```

---

### Task 10: Ручная проверка в браузере

**Files:** нет (проверочная задача, изменений в коде не вносит).

- [ ] **Step 1: Запустить дев-сервер**

Run: `npm run dev` (в фоне)

- [ ] **Step 2: Открыть экран «Начать готовить» для «Курица в сливочном соусе» (Playwright,
headed-режим — см. проектное правило: пользователь хочет видеть проверку вживую)**

Проверить визуально:
- Степперы «Растительное масло», «Сливочное масло», «Лук и морковь на сковороде», «Курица на
  сковороде», «Тушение в сливках» отображаются с корректными подписями и стартовыми значениями
  при 1 порции (1 ст.л, 1 ст.л, 3 минуты, 5 минут, 5 минут).
- Изменение степпера «Порций» с 1 на 4 обновляет расчётные значения степперов ингредиентов до
  2.5 ст.л / 2.5 ст.л / 6 мин / 8 мин / 8 мин, и сбрасывает любой ранее выставленный override.
- Ручной сдвиг степпера «Растительное масло» (+/-) меняет только его значение, не трогая другие.
- Нажатие «Начать готовить» и переход по шагам рецепта — плашки масла/времени в тексте шага
  показывают именно то значение, что было выставлено на экране настроек (включая override, если
  он был сделан).
- Таймер на шаге с временем жарки/тушения предзаполняется тем же (возможно изменённым) числом
  минут.

- [ ] **Step 3: Проверить безопасное поведение для рецепта без `# adjustable:`**

Открыть любой другой рецепт (например, «Омлет») — секция «Количества» не должна появляться
вообще (пустой `adjustableTemplates`), остальной экран настроек не изменился.

- [ ] **Step 4: Закрыть браузер, остановить дев-сервер**
