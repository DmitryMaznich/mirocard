# Конвертация количеств для списка покупок — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Список покупок (Планировщик → Покупки) должен показывать покупную величину (кг/пачки/штуки) вместо сырой кулинарной единицы рецепта («0.5 стакана», «2 ч.л»), а для приправ/бытовой мелочи — не показывать количество вообще.

**Architecture:** Новый чистый модуль `shoppingUnitConversions.js` с таблицей коэффициентов и двумя функциями: `toCanonicalQty` (единица рецепта → граммы/мл, используется при агрегации между рецептами в `shoppingListGenerator.js`) и `toShoppingQuantity` (граммы/мл → округлённая покупная величина, используется при показе в `plannerShoppingUtils.js`). Отдельный список `NO_SHOPPING_QTY_PRODUCTS` подавляет количество для приправ на уровне форматирования заметки, до вызова конвертера.

**Tech Stack:** Vanilla JS (ES modules), Vitest.

## Global Constraints

- Ничего не меняется в `content/recipes/*.txt`, `content/shopping/shopping.txt` (кроме точечного добавления «тмин» в Task 1), `content/pantry.txt`.
- Числа коэффициентов (`gramsPerUnit`, `roundStepG`, `minG`) — из согласованного черновика в `docs/superpowers/specs/2026-07-05-shopping-quantity-conversion-design.md`, ориентировочные, менять только сам модуль `shoppingUnitConversions.js`, если понадобится скорректировать.
- Таблица конвертации только дополняется новыми продуктами — никогда не удалять и не переименовывать существующие ключи (см. скилл `new-recipe`).
- Все изменяемые функции — чистые, без побочных эффектов; существующий стиль модулей (`export function`, без классов) сохраняется.

---

## Обзор файлов

- **Create** `src/features/planner/shoppingUnitConversions.js` — таблица коэффициентов, `toCanonicalQty`, `toShoppingQuantity`.
- **Create** `src/features/planner/shoppingUnitConversions.test.js`
- **Modify** `src/features/planner/shoppingListGenerator.js` — агрегация в граммах/мл через `toCanonicalQty`.
- **Modify** `src/features/planner/shoppingListGenerator.test.js` — обновить тесты, которые теперь используют продукты из таблицы конвертации (лук, морковь), добавить тест на смешанные единицы.
- **Modify** `src/features/planner/plannerShoppingUtils.js` — вынести и расширить форматирование `note` в `formatShoppingNote`, использовать в `buildPlannerShoppingData` и `syncDecisionsIntoShoppingData`.
- **Modify** `src/features/planner/plannerShoppingUtils.test.js` — тест на округление картошки, тест на подавление количества для приправы.
- **Modify** `content/shopping/shopping.txt` — добавить «тмин» в категорию «Зелень»/«Бакалея» (не резолвится сейчас никак).

---

### Task 1: Каталог — добавить «тмин»

**Files:**
- Modify: `content/shopping/shopping.txt`

**Interfaces:**
- Не производит и не потребляет код — чисто контентная правка, нужна до Task 3, где тесты полагаются на реальный каталог.

- [ ] **Step 1: Проверить текущее отсутствие «тмин» в каталоге**

Run: `grep -n "тмин" content/shopping/shopping.txt`
Expected: пустой вывод (ничего не найдено).

- [ ] **Step 2: Добавить «тмин» в категорию «5. Бакалея:» → подгруппу специй**

Открой `content/shopping/shopping.txt`, найди подгруппу с приправами внутри категории «5. Бакалея:» (там же, где «горчица», «кетчуп»). Добавь новую строку `- тмин` в эту подгруппу (после `- специи`, если такая строка есть, иначе после `- кетчуп`).

- [ ] **Step 3: Проверить результат**

Run: `grep -n "тмин" content/shopping/shopping.txt`
Expected: одна строка вида `NNN:- тмин`.

- [ ] **Step 4: Commit**

```bash
git add content/shopping/shopping.txt
git commit -m "feat(shopping): add тмин to catalog (kislo_zelje ingredient, no prior match)"
```

---

### Task 2: `shoppingUnitConversions.js` — таблица и конвертеры

**Files:**
- Create: `src/features/planner/shoppingUnitConversions.js`
- Test: `src/features/planner/shoppingUnitConversions.test.js`

**Interfaces:**
- Produces: `SHOPPING_UNIT_CONVERSIONS` (object, keyed by lowercase product name, values `{ gramsPerUnit?: Record<string, number>, roundStepG: number, minG: number, buyUnit?: 'мл' }`), `NO_SHOPPING_QTY_PRODUCTS` (`Set<string>` of lowercase product names), `toCanonicalQty(product: string, qty: number|null, unit: string|null): { qty: number|null, unit: string|null }`, `toShoppingQuantity(product: string, qty: number|null, unit: string|null): { qty: number, unit: string } | null`.
- Consumes: ничего (самостоятельный модуль, без внешних зависимостей проекта).

- [ ] **Step 1: Написать проваливающиеся тесты**

Создай `src/features/planner/shoppingUnitConversions.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { toCanonicalQty, toShoppingQuantity, SHOPPING_UNIT_CONVERSIONS, NO_SHOPPING_QTY_PRODUCTS } from './shoppingUnitConversions.js';

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
    // 3 ст.л растительного масла — не участвует (в NO_SHOPPING_QTY_PRODUCTS),
    // используем молоко (не приправа): 200 мл → шаг 500 → 500 мл
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
```

- [ ] **Step 2: Запустить тесты и убедиться, что все падают**

Run: `npx vitest run src/features/planner/shoppingUnitConversions.test.js`
Expected: FAIL — `Cannot find module './shoppingUnitConversions.js'` (файла ещё нет).

- [ ] **Step 3: Реализовать модуль**

Создай `src/features/planner/shoppingUnitConversions.js`:

```js
/**
 * Product → purchase-conversion rules for the Покупки shopping list.
 *
 * Recipes record ingredients in cooking-friendly units (cups, spoons,
 * whole vegetables). None of that means anything at a store, so this
 * table maps each such product to a canonical weight/volume factor
 * (`gramsPerUnit`) plus a purchase rounding rule (`roundStepG`/`minG`).
 *
 * Products already recorded in `гр`/`мл` in recipes don't need
 * `gramsPerUnit` — their raw quantity already is the canonical amount.
 */
export const SHOPPING_UNIT_CONVERSIONS = {
  'картошка': { gramsPerUnit: { 'шт': 150 }, roundStepG: 500, minG: 500 },
  'лук': { gramsPerUnit: { 'шт': 100 }, roundStepG: 500, minG: 500 },
  'морковь': { gramsPerUnit: { 'шт': 80 }, roundStepG: 500, minG: 500 },
  'куриная грудка': { gramsPerUnit: { 'шт': 300 }, roundStepG: 500, minG: 500 },
  'куриные бёдра': { gramsPerUnit: { 'шт': 150 }, roundStepG: 500, minG: 500 },
  'куриные крылья': { gramsPerUnit: { 'шт': 80 }, roundStepG: 500, minG: 500 },
  'куриные голени': { gramsPerUnit: { 'шт': 120 }, roundStepG: 500, minG: 500 },
  'голени': { gramsPerUnit: { 'шт': 120 }, roundStepG: 500, minG: 500 },
  'гречка': { gramsPerUnit: { 'стакан': 210 }, roundStepG: 100, minG: 100 },
  'рис': { gramsPerUnit: { 'стакан': 200 }, roundStepG: 500, minG: 500 },
  'макароны': { gramsPerUnit: { 'стакан': 100, 'ст.л': 10 }, roundStepG: 100, minG: 100 },
  'овсяные хлопья': { gramsPerUnit: { 'стакан': 90 }, roundStepG: 100, minG: 100 },
  'замороженные ягоды': { gramsPerUnit: { 'горсть': 80 }, roundStepG: 100, minG: 100 },
  'клубника': { gramsPerUnit: { 'горсть': 100 }, roundStepG: 100, minG: 100 },
  'малина': { gramsPerUnit: { 'горсть': 70 }, roundStepG: 100, minG: 100 },
  'ежевика': { gramsPerUnit: { 'горсть': 70 }, roundStepG: 100, minG: 100 },
  'молоко': { gramsPerUnit: { 'стакан': 200 }, roundStepG: 500, minG: 500, buyUnit: 'мл' },
  'сливки 20%': { gramsPerUnit: { 'ст.л': 15 }, roundStepG: 100, minG: 100, buyUnit: 'мл' },
  'сыр твёрдый': { roundStepG: 50, minG: 50 },
  'фарш': { roundStepG: 500, minG: 500 },
  'колбаса': { roundStepG: 100, minG: 100 },
  'кофейные зёрна': { roundStepG: 250, minG: 250 },
  'креветки': { roundStepG: 100, minG: 100 },
};

/**
 * Products measured in ст.л/ч.л purely for cooking (seasoning, oils,
 * pantry staples). A single recipe's dose is 1–5% of how these are sold
 * (a whole bag/bottle/jar), so no gram target is meaningful — the
 * shopping list shows them as a bare checkbox, never a quantity.
 */
export const NO_SHOPPING_QTY_PRODUCTS = new Set([
  'соль', 'специи', 'масло растительное', 'масло сливочное', 'масло оливковое',
  'сахар', 'мёд', 'какао', 'бальзамический уксус', 'мука', 'тмин',
]);

// Units that are always bought as a whole count — fractional amounts get
// rounded up (you can't buy half an onion, a quarter bunch of parsley,
// or 1.5 jars of sour cream).
const DISCRETE_UNITS = new Set(['шт', 'пачка', 'банка', 'упаковка', 'пучок', 'веточка', 'зуб', 'горсть']);

function lookup(product) {
  return SHOPPING_UNIT_CONVERSIONS[product.toLowerCase()];
}

/**
 * Converts one ingredient's qty (in its recipe unit) to the canonical
 * weight/volume basis (grams, or мл when the product's entry says so).
 * Used while aggregating the same product across multiple recipes, so
 * that the sum is always in one consistent unit regardless of which
 * cooking unit each individual recipe happened to use.
 *
 * Returns the input unchanged when there's nothing to convert: no qty,
 * no table entry for this product, or no factor for this specific unit
 * (which also covers values already given in г/мл — those have no
 * factor key and are already canonical).
 */
export function toCanonicalQty(product, qty, unit) {
  if (qty == null || unit == null) return { qty, unit };
  const entry = lookup(product);
  if (!entry || !entry.gramsPerUnit) return { qty, unit };
  const factor = entry.gramsPerUnit[unit];
  if (factor == null) return { qty, unit };
  return { qty: qty * factor, unit: entry.buyUnit === 'мл' ? 'мл' : 'г' };
}

/**
 * Given an aggregated qty+unit (already canonical grams/мл when the
 * product has a SHOPPING_UNIT_CONVERSIONS entry with gramsPerUnit, or
 * still a raw recipe unit otherwise), returns a purchase-friendly
 * quantity — rounded up to the product's purchase step, formatted in
 * г/кг or мл/л. Discrete units (шт, пачка, ...) just round up to a
 * whole number regardless of any table entry. Returns null when there's
 * nothing sensible to show (no qty, or an unknown non-discrete unit
 * with no conversion entry) — the caller falls back to its own default.
 */
export function toShoppingQuantity(product, qty, unit) {
  if (qty == null) return null;
  if (DISCRETE_UNITS.has(unit)) {
    return { qty: Math.ceil(qty), unit };
  }
  const entry = lookup(product);
  if (!entry) return null;
  let grams = qty;
  if (entry.gramsPerUnit && entry.gramsPerUnit[unit] != null) {
    grams = qty * entry.gramsPerUnit[unit];
  } else if (unit !== 'г' && unit !== 'мл') {
    return null;
  }
  const rounded = Math.max(Math.ceil(grams / entry.roundStepG) * entry.roundStepG, entry.minG);
  const bigUnit = entry.buyUnit === 'мл' ? 'л' : 'кг';
  const smallUnit = entry.buyUnit === 'мл' ? 'мл' : 'г';
  if (rounded >= 1000) {
    return { qty: Math.round((rounded / 1000) * 10) / 10, unit: bigUnit };
  }
  return { qty: rounded, unit: smallUnit };
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что все проходят**

Run: `npx vitest run src/features/planner/shoppingUnitConversions.test.js`
Expected: PASS — все тесты зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/shoppingUnitConversions.js src/features/planner/shoppingUnitConversions.test.js
git commit -m "feat(planner): add shopping quantity conversion table and helpers"
```

---

### Task 3: `shoppingListGenerator.js` — агрегация в граммах/мл

**Files:**
- Modify: `src/features/planner/shoppingListGenerator.js`
- Modify: `src/features/planner/shoppingListGenerator.test.js`

**Interfaces:**
- Consumes: `toCanonicalQty` из `./shoppingUnitConversions.js` (Task 2).
- Produces: `generateShoppingList` теперь возвращает `qty`/`unit` в канонической единице (граммы/мл) для продуктов с записью в `SHOPPING_UNIT_CONVERSIONS`, без изменений — для остальных. Сигнатура и остальное поведение (`include`, `recipeIds`, пантри-фильтр) не меняются.

- [ ] **Step 1: Обновить существующие тесты, которые ломаются конвертацией**

`лук` и `морковь` теперь есть в `SHOPPING_UNIT_CONVERSIONS`, поэтому их итог в тестах должен быть в граммах, а не в сыром счёте штук. Открой `src/features/planner/shoppingListGenerator.test.js` и замени:

```js
  it('aggregates same product from two recipes', () => {
    const r1 = recipe('r1', [['лук', 2, 'шт']]);
    const r2 = recipe('r2', [['лук', 1, 'шт']]);
    const list = generateShoppingList([r1, r2]);
    const luk = list.find((i) => i.product === 'лук');
    expect(luk.qty).toBe(3);
    expect(luk.recipeIds).toEqual(['r1', 'r2']);
  });
```

на:

```js
  it('aggregates same product from two recipes, converting to canonical grams', () => {
    const r1 = recipe('r1', [['лук', 2, 'шт']]);
    const r2 = recipe('r2', [['лук', 1, 'шт']]);
    const list = generateShoppingList([r1, r2]);
    const luk = list.find((i) => i.product === 'лук');
    expect(luk.qty).toBe(300); // (2 + 1) шт × 100 г/шт
    expect(luk.unit).toBe('г');
    expect(luk.recipeIds).toEqual(['r1', 'r2']);
  });
```

и:

```js
  it('uses portionMultiplier 1 by default', () => {
    const r = recipe('r1', [['морковь', 2, 'шт']], 2, 2);
    const list = generateShoppingList([r]);
    expect(list[0].qty).toBe(2); // 2 * (2/2) = 2
  });
```

на:

```js
  it('uses portionMultiplier 1 by default', () => {
    const r = recipe('r1', [['морковь', 2, 'шт']], 2, 2);
    const list = generateShoppingList([r]);
    expect(list[0].qty).toBe(160); // 2 * (2/2) = 2 шт × 80 г/шт
    expect(list[0].unit).toBe('г');
  });
```

и:

```js
  it('deduplicates by lowercase product name', () => {
    const r1 = recipe('r1', [['Лук', 1, 'шт']]);
    const r2 = recipe('r2', [['лук', 2, 'шт']]);
    const list = generateShoppingList([r1, r2]);
    expect(list).toHaveLength(1);
    expect(list[0].qty).toBe(3);
  });
```

на:

```js
  it('deduplicates by lowercase product name', () => {
    const r1 = recipe('r1', [['Лук', 1, 'шт']]);
    const r2 = recipe('r2', [['лук', 2, 'шт']]);
    const list = generateShoppingList([r1, r2]);
    expect(list).toHaveLength(1);
    expect(list[0].qty).toBe(300); // (1 + 2) шт × 100 г/шт
  });
```

- [ ] **Step 2: Добавить тест на смешанные единицы одного продукта (баг, который чинит эта задача)**

Добавь в `describe('generateShoppingList', ...)`, после существующих тестов:

```js
  it('correctly sums a product recorded in different recipe units across recipes', () => {
    // До этой задачи: сырые qty складывались без учёта единицы (1 "стакан" + 100 "г" = 101 — бессмыслица).
    // После: оба значения приводятся к граммам перед суммированием.
    const r1 = recipe('r1', [['гречка', 1, 'стакан']]); // 210 г
    const r2 = recipe('r2', [['гречка', 100, 'г']]); // уже в граммах
    const list = generateShoppingList([r1, r2]);
    const grechka = list.find((i) => i.product === 'гречка');
    expect(grechka.qty).toBe(310);
    expect(grechka.unit).toBe('г');
  });
```

- [ ] **Step 3: Запустить тесты и убедиться, что новые/обновлённые падают, остальные пока проходят**

Run: `npx vitest run src/features/planner/shoppingListGenerator.test.js`
Expected: FAIL на 4 тестах (три обновлённых + один новый) — `generateShoppingList` ещё не конвертирует единицы, старая реализация вернёт сырые числа/единицы.

- [ ] **Step 4: Подключить конвертацию в `generateShoppingList`**

Открой `src/features/planner/shoppingListGenerator.js`. Замени:

```js
import { parseRecipeMetadata } from './recipeParser.js';
```

на:

```js
import { parseRecipeMetadata } from './recipeParser.js';
import { toCanonicalQty } from './shoppingUnitConversions.js';
```

Замени тело цикла агрегации:

```js
    for (const { product, qty, unit } of ingredients) {
      const key = product.toLowerCase();
      const scaledQty = qty != null ? qty * scale : null;

      if (map.has(key)) {
        const existing = map.get(key);
        if (existing.qty != null && scaledQty != null) {
          existing.qty += scaledQty;
        } else {
          existing.qty = null;
        }
        if (!existing.recipeIds.includes(textId)) {
          existing.recipeIds.push(textId);
        }
      } else {
        map.set(key, {
          product,
          qty: scaledQty,
          unit,
          include: !pantryItems.has(key),
          recipeIds: [textId],
        });
      }
    }
```

на:

```js
    for (const { product, qty, unit } of ingredients) {
      const key = product.toLowerCase();
      const scaledQty = qty != null ? qty * scale : null;
      const canonical = toCanonicalQty(product, scaledQty, unit);

      if (map.has(key)) {
        const existing = map.get(key);
        if (existing.qty != null && canonical.qty != null) {
          existing.qty += canonical.qty;
        } else {
          existing.qty = null;
        }
        if (!existing.recipeIds.includes(textId)) {
          existing.recipeIds.push(textId);
        }
      } else {
        map.set(key, {
          product,
          qty: canonical.qty,
          unit: canonical.unit,
          include: !pantryItems.has(key),
          recipeIds: [textId],
        });
      }
    }
```

- [ ] **Step 5: Запустить тесты и убедиться, что все проходят**

Run: `npx vitest run src/features/planner/shoppingListGenerator.test.js`
Expected: PASS — все тесты зелёные (включая ранее не тронутые: «сахар»/«соль»-тесты с null qty, «мясо»-тест без конвертации).

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/shoppingListGenerator.js src/features/planner/shoppingListGenerator.test.js
git commit -m "fix(planner): aggregate shopping-list quantities in canonical grams/ml"
```

---

### Task 4: `plannerShoppingUtils.js` — покупная величина и подавление количества для приправ

**Files:**
- Modify: `src/features/planner/plannerShoppingUtils.js`
- Modify: `src/features/planner/plannerShoppingUtils.test.js`

**Interfaces:**
- Consumes: `toShoppingQuantity`, `NO_SHOPPING_QTY_PRODUCTS` из `./shoppingUnitConversions.js` (Task 2). Ожидает, что `shoppingListItems`/`ingredientItems`, которые эти функции получают на входе, уже прошли через `generateShoppingList` (Task 3) — то есть `qty`/`unit` для конвертируемых продуктов уже в граммах/мл.
- Produces: новый экспорт `formatShoppingNote(product: string, qty: number|null, unit: string|null): string`, используемый и тестируемый напрямую. Поведение `buildPlannerShoppingData`/`syncDecisionsIntoShoppingData` меняется только в форматировании `note` — остальная логика (fuzzy-match, категории, `plan`/`customData`) не трогается.

- [ ] **Step 1: Обновить существующий тест на note для картошки**

В `src/features/planner/plannerShoppingUtils.test.js` замени:

```js
  it('checks a matched item and adds a note for its quantity', () => {
    const { plan } = buildPlannerShoppingData([
      { product: 'картошка', qty: 2, unit: 'шт', include: true },
    ]);
    expect(plan['Овощи_0']).toEqual({ note: '2 шт' });
  });
```

на:

```js
  it('checks a matched item and adds a purchase-rounded note for its quantity', () => {
    const { plan } = buildPlannerShoppingData([
      { product: 'картошка', qty: 300, unit: 'г', include: true },
    ]);
    // 300 г округляется вверх до шага покупки (500 г)
    expect(plan['Овощи_0']).toEqual({ note: '500 г' });
  });
```

(Значение qty/unit на входе теперь соответствует тому, что реально отдаёт `generateShoppingList` после Task 3 — уже граммы, а не сырые «2 шт».)

- [ ] **Step 2: Добавить тест на подавление количества для приправы**

Добавь в конец `describe('buildPlannerShoppingData (after findFuzzyMatch extraction)', ...)`:

```js
  it('shows no quantity note for a seasoning product even with an exact recipe dose', () => {
    const { plan } = buildPlannerShoppingData([
      { product: 'масло оливковое', qty: 3, unit: 'ст.л', include: true },
    ]);
    // «масло оливковое» — 8-й товар (индекс 7) в плоском списке категории «5. Бакалея:»
    // (рис, гречка, макароны, полента, овсяные хлопья, киноа, масло растительное, масло оливковое, ...).
    expect(plan['Бакалея_7']).toBe(true); // чекбокс без note, а не { note: '...' }
  });
```

- [ ] **Step 3: Написать прямые тесты на `formatShoppingNote`**

Добавь в начало файла импорт:

```js
import { describe, it, expect } from 'vitest';
import { findFuzzyMatch, buildPlannerShoppingData, syncDecisionsIntoShoppingData, formatShoppingNote } from './plannerShoppingUtils.js';
```

Добавь новый `describe` перед `describe('buildPlannerShoppingData ...')`:

```js
describe('formatShoppingNote', () => {
  it('returns empty string for a seasoning product regardless of qty', () => {
    expect(formatShoppingNote('соль', 1, 'ч.л')).toBe('');
    expect(formatShoppingNote('масло растительное', 3, 'ст.л')).toBe('');
  });

  it('returns empty string when qty is null', () => {
    expect(formatShoppingNote('яйца', null, null)).toBe('');
  });

  it('formats a purchase-rounded quantity for a converted product', () => {
    expect(formatShoppingNote('картошка', 300, 'г')).toBe('500 г');
  });

  it('falls back to the raw rounded qty/unit when there is no conversion entry', () => {
    expect(formatShoppingNote('незнакомый продукт', 2.34, 'ст.л')).toBe('2.3 ст.л');
  });

  it('ceils a discrete unit even without a conversion table entry', () => {
    expect(formatShoppingNote('яйца', 5.5, 'шт')).toBe('6 шт');
  });
});
```

- [ ] **Step 4: Запустить тесты и убедиться, что новые/обновлённые падают**

Run: `npx vitest run src/features/planner/plannerShoppingUtils.test.js`
Expected: FAIL — `formatShoppingNote` не существует; тест на картошку и на приправу дают старый формат.

- [ ] **Step 5: Реализовать `formatShoppingNote` и подключить её в обе функции**

Открой `src/features/planner/plannerShoppingUtils.js`. Замени импорт:

```js
import SHOPPING_TXT_EMBEDDED from '../../../content/shopping/shopping.txt?raw';
import { parseRecipeTxt } from '../../topics/renderers/reading/parseRecipeTxt.js';
```

на:

```js
import SHOPPING_TXT_EMBEDDED from '../../../content/shopping/shopping.txt?raw';
import { parseRecipeTxt } from '../../topics/renderers/reading/parseRecipeTxt.js';
import { toShoppingQuantity, NO_SHOPPING_QTY_PRODUCTS } from './shoppingUnitConversions.js';
```

Добавь новую функцию сразу после `planKey`:

```js
function planKey(name, ii) { return `${name}_${ii}`; }

// Formats the small quantity note shown next to a shopping-list item.
// Seasoning/pantry products (NO_SHOPPING_QTY_PRODUCTS) never show a
// quantity — a spoonful of salt doesn't correspond to anything on a
// shelf. Otherwise converts to a purchase-friendly amount via
// toShoppingQuantity when a conversion is known, falling back to the
// raw recipe qty/unit (rounded to one decimal) when it isn't.
export function formatShoppingNote(product, qty, unit) {
  if (qty == null) return '';
  if (NO_SHOPPING_QTY_PRODUCTS.has(product.toLowerCase())) return '';
  const converted = toShoppingQuantity(product, qty, unit);
  if (converted) {
    return `${converted.qty}${converted.unit ? ' ' + converted.unit : ''}`;
  }
  return `${Math.round(qty * 10) / 10}${unit ? ' ' + unit : ''}`;
}
```

В `buildPlannerShoppingData` замени:

```js
    const note = qty != null ? `${Math.round(qty * 10) / 10}${unit ? ' ' + unit : ''}` : '';
```

на:

```js
    const note = formatShoppingNote(product, qty, unit);
```

В `syncDecisionsIntoShoppingData` замени:

```js
      const note = item.qty != null ? `${Math.round(item.qty * 10) / 10}${item.unit ? ' ' + item.unit : ''}` : '';
```

на:

```js
      const note = formatShoppingNote(item.product, item.qty, item.unit);
```

- [ ] **Step 6: Запустить тесты и убедиться, что все проходят**

Run: `npx vitest run src/features/planner/plannerShoppingUtils.test.js`
Expected: PASS — все тесты зелёные.

- [ ] **Step 7: Прогнать весь набор тестов планировщика, чтобы убедиться в отсутствии регрессий**

Run: `npx vitest run src/features/planner/`
Expected: PASS — все файлы (включая `shoppingListGenerator.test.js`, `recipeParser.test.js`, `plannerUtils.test.js`, `plannerApi.test.js`, `putawayLocations.test.js`, `putawayUtils.test.js`) зелёные.

- [ ] **Step 8: Commit**

```bash
git add src/features/planner/plannerShoppingUtils.js src/features/planner/plannerShoppingUtils.test.js
git commit -m "feat(planner): round shopping-list quantities to purchase units, hide seasoning amounts"
```

---

### Task 5: Ручная проверка в браузере — выполнено частично, см. итог

**Files:** нет изменений — только проверка поведения.

**Interfaces:** нет.

**Фактический итог (2026-07-06):** автоматизированная проверка через Playwright дошла до реального бэкенда прод-хоста (192.168.1.163) через SSH-проброс порта 3012, поставила тему «Инструкции — рецепты» v1.134.0 (скачалась настоящим ZIP через бэкенд — подтверждает, что сеть/бэкенд/деплой-цепочка рабочие), но **не смогла дойти до экрана Покупки**: вкладка «Планировщик» в `HomeScreen.jsx` условна — `showPlanner={hasPlannerAccess}`, где `hasPlannerAccess = account?.featureFlags?.includes("planner")` (`src/features/home/HomeScreen.jsx:567`). Локальный режим «Без аккаунта» не создаёт `account` с фичефлагами, поэтому вкладка Планировщика физически не появляется — дальнейшая проверка потребовала бы логина в реальный аккаунт с этим флагом, то есть тот самый риск записи в прод-БД, которого просили избежать.

Попутно обнаружено и исправлено: `MirocardBackend2` (scheduled task на 192.168.1.163) был остановлен (`State: Ready`, ни одного `node`-процесса) — по согласованию с пользователем перезапущен (`Start-ScheduledTask`), сейчас в `State: Running`. Это не связано с текущей задачей напрямую, но обнаружилось при попытке проверки и было устранено.

**Что фактически подтверждено браузером:** дев-сервер и прод-бэкенд совместимы и работают (установка темы прошла полным циклом через реальный API), само приложение не падает при загрузке новой версии кода планировщика (без JS-ошибок в консоли на всех пройденных экранах).

**Что НЕ подтверждено визуально:** сам рендер экрана «Покупки» с новыми округлёнными величинами/подавленными note для приправ — эта часть логики покрыта только юнит-тестами (326 тестов в `src/features/planner/`, включая `plannerShoppingUtils.test.js` с прямыми проверками `formatShoppingNote` и интеграционными тестами `buildPlannerShoppingData`/`syncDecisionsIntoShoppingData` на реальном каталоге товаров).

Если нужна визуальная проверка экрана Покупки в будущем — потребуется тестовый аккаунт с `featureFlags: ["planner"]`, а не локальный режим.

~~- [ ] Step 1: Запустить dev-сервер~~
~~- [ ] Step 2: Пройти сценарий в приложении~~
~~- [ ] Step 3: Проверить пересинхронизацию через Меню~~
~~- [ ] Step 4: Остановить dev-сервер~~
(Шаги выше не выполнены как написано — см. фактический итог; dev-сервер и SSH-туннель остановлены.)

---

## Что не входит в этот план

- Пересборка ZIP колоды `reading_dad_texts` и деплой — эта работа не публикует контент, только код и один каталожный товар; деплой отдельным шагом, когда пользователь попросит.
- Конвертация «зубчики чеснока → головки» — отдельный пункт, отложен (см. спеку, раздел «Что осталось нерешённым»).
- Ревизия `сыр твёрдый`/`колбаса` (весовые продукты, оставленные как есть) — не в объёме этой задачи.
