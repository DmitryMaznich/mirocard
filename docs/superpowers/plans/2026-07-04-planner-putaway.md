# Раскладка продуктов (planner putaway) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the «Раскладка» step of the Planner — after a shopping trip, the child sorts each bought product, one at a time, into the correct storage zone (freezer / fridge / pantry / vegetable spot / cleaning-supplies cupboard / fruit bowl), with mistake feedback and an escalating hint.

**Architecture:** Two new pure data/logic modules (`putawayLocations.js` for the zone list and product→zone mapping, `putawayUtils.js` for turning "what's bought" into an ordered queue of items-to-place), a new persistence layer in `groupStore.js` (both for the shopping screen's previously-ephemeral "взял" state and for the putaway placements themselves), a new screen (`PlannerPutawayScreen.jsx`) that walks through the queue one item at a time, and two small wiring changes (unlocking the 4th hub card, adding a shortcut button from the shopping screen).

**Tech Stack:** React 19 (function components + hooks), Zustand (`useAppStore`), IndexedDB via the project's `kv`/`getDb` wrapper (`src/core/db.js`), Vitest for unit tests (already configured with `fake-indexeddb` + `jsdom` in `vite.config.js`).

## Global Constraints

- Six storage zones, fixed ids: `freezer` (❄️ Морозилка), `fridge` (🧊 Холодильник), `pantry` (🌾 Шкаф), `veg` (🥔 Место для овощей), `chem` (🧹 Шкаф бытовой химии), `table` (🍎 Стол).
- No per-family photos in v1 — zones use the generic icons above, consistent with the rest of the Planner.
- Raw meat and fish (categories «Мясо», «Рыба») always default to `freezer` — no link to today's `mealAssignments` (explicit v1 simplification, do not add this).
- Products with no zone mapping (unmatched recipe ingredients, the "Из меню" catch-all category) are excluded from the putaway queue entirely — never block the exercise on them.
- Interaction is tap-only: tap a zone tile to answer for the currently-shown product. No drag-and-drop.
- Wrong tap: shake/flash the tapped zone, no penalty, same item stays up, unlimited retries. After 2 consecutive wrong taps on the same item, the correct zone starts a soft pulsing highlight until the item is placed.
- «Раскладка» unlocks (hub card becomes tappable) as soon as at least one item is marked bought — never require 100% of the shopping list to be bought.
- Follow the codebase's existing convention of not writing dedicated unit tests for thin `groupStore.js` KV getter/setter pairs (see `getPlannerShopPlan`/`savePlannerShopPlan` — no test file exists for them); verify those via manual browser testing instead.
- Full spec: `docs/superpowers/specs/2026-07-04-planner-putaway-design.md`.

---

## Task 1: Storage zones and product→zone mapping

**Files:**
- Create: `src/features/planner/putawayLocations.js`
- Test: `src/features/planner/putawayLocations.test.js`

**Interfaces:**
- Consumes: nothing (pure data module).
- Produces:
  - `export const ZONES: Array<{ id: string, label: string, icon: string }>` — the six zones, in display order `freezer, fridge, pantry, veg, chem, table`.
  - `export function getZoneForProduct(categoryName: string, productName: string): string | null` — returns a zone id, or `null` if the category is unrecognized.

- [ ] **Step 1: Write the failing tests**

Create `src/features/planner/putawayLocations.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/planner/putawayLocations.test.js`
Expected: FAIL — `putawayLocations.js` does not exist yet ("Failed to resolve import").

- [ ] **Step 3: Implement `putawayLocations.js`**

Create `src/features/planner/putawayLocations.js`:

```js
export const ZONES = [
  { id: 'freezer', label: 'Морозилка', icon: '❄️' },
  { id: 'fridge', label: 'Холодильник', icon: '🧊' },
  { id: 'pantry', label: 'Шкаф', icon: '🌾' },
  { id: 'veg', label: 'Место для овощей', icon: '🥔' },
  { id: 'chem', label: 'Шкаф бытовой химии', icon: '🧹' },
  { id: 'table', label: 'Стол', icon: '🍎' },
];

// Default zone per shopping.txt category. Most items in a category really
// do share one real-world storage spot, so most products need no override —
// see PRODUCT_ZONE_OVERRIDES below for the handful that don't.
const CATEGORY_DEFAULT_ZONE = {
  'Овощи': 'fridge',
  'Фрукты': 'table',
  'Ягоды': 'fridge',
  'Зелень': 'fridge',
  'Бакалея': 'pantry',
  'Мясо': 'freezer',
  'Рыба': 'freezer',
  'Гастрономия': 'fridge',
  'Напитки': 'pantry',
  'Молочные продукты': 'fridge',
  'Бытовая химия': 'chem',
  'Сладости': 'pantry',
  'Хлебобулочные изделия': 'pantry',
  'Консервы': 'pantry',
  'Заморозка': 'freezer',
  'Товары для животных': 'pantry',
};

// Exact-match (not substring) overrides for products whose category default
// is wrong for that specific product — e.g. root vegetables that keep at
// room temperature, unlike the rest of "Овощи". Exact match on purpose: a
// substring check would make "зелёный лук" incorrectly inherit "лук" -> veg.
const PRODUCT_ZONE_OVERRIDES = {
  'картошка': 'veg',
  'лук': 'veg',
  'чеснок': 'veg',
  'капуста': 'veg',
  'мороженое': 'freezer',
};

export function getZoneForProduct(categoryName, productName) {
  const norm = productName.trim().toLowerCase();
  if (PRODUCT_ZONE_OVERRIDES[norm]) return PRODUCT_ZONE_OVERRIDES[norm];
  return CATEGORY_DEFAULT_ZONE[categoryName] ?? null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/planner/putawayLocations.test.js`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/putawayLocations.js src/features/planner/putawayLocations.test.js
git commit -m "feat(planner): add product-to-storage-zone mapping for putaway"
```

---

## Task 2: Putaway queue builder

**Files:**
- Modify: `src/features/planner/plannerShoppingUtils.js:8-14` (export `CATEGORY_ICONS`)
- Create: `src/features/planner/putawayUtils.js`
- Test: `src/features/planner/putawayUtils.test.js`

**Interfaces:**
- Consumes:
  - `getZoneForProduct(categoryName, productName): string | null` from Task 1's `putawayLocations.js`.
  - `customDataToSteps(customData): Array<{ type: 'checklist', text: string, items: string[], itemSubgroups: (string|null)[] }>` — already exists in `plannerShoppingUtils.js`.
  - `CATEGORY_ICONS: Record<string, string>` — already exists in `plannerShoppingUtils.js`, needs to become exported (currently a private `const`).
- Produces:
  - `export function buildPutawayQueue(customData, bought, placed): Array<{ key: string, category: string, product: string, zoneId: string, categoryIcon: string }>` — used by Task 4's `PlannerPutawayScreen.jsx`. `key` is `${category}_${itemIndex}`, matching the `planKey` format already used throughout the shopping screens.
    - `bought` and `placed` are both `{ [key]: true }`-shaped maps (matching `getPlannerShopBought`/`getPlannerPutawayPlan`'s persisted shape from Task 3/4).
    - Only items present in `bought`, absent from `placed`, and with a non-null `getZoneForProduct` result are included.
    - Order follows the category/item order already present in `customData.categories` (same order the "Покупки"/"В магазине" screens show).

- [ ] **Step 1: Export `CATEGORY_ICONS` from `plannerShoppingUtils.js`**

In `src/features/planner/plannerShoppingUtils.js:8`, change:

```js
const CATEGORY_ICONS = {
```

to:

```js
export const CATEGORY_ICONS = {
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/planner/putawayUtils.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildPutawayQueue } from './putawayUtils.js';

function customData(categories) {
  // categories: [{ name, items: string[] }]
  return {
    categories: categories.map((c, i) => ({
      id: `cat_${i}`,
      name: c.name,
      icon: c.icon ?? '📦',
      subgroups: [{ name: null, items: c.items }],
    })),
  };
}

describe('buildPutawayQueue', () => {
  it('includes a bought item that has a known zone', () => {
    const cd = customData([{ name: 'Молочные продукты', items: ['молоко'] }]);
    const queue = buildPutawayQueue(cd, { 'Молочные продукты_0': true }, {});
    expect(queue).toEqual([
      { key: 'Молочные продукты_0', category: 'Молочные продукты', product: 'молоко', zoneId: 'fridge', categoryIcon: '🥛' },
    ]);
  });

  it('excludes an item that was not marked bought', () => {
    const cd = customData([{ name: 'Молочные продукты', items: ['молоко'] }]);
    const queue = buildPutawayQueue(cd, {}, {});
    expect(queue).toEqual([]);
  });

  it('excludes an item that has already been placed', () => {
    const cd = customData([{ name: 'Молочные продукты', items: ['молоко'] }]);
    const queue = buildPutawayQueue(cd, { 'Молочные продукты_0': true }, { 'Молочные продукты_0': 'fridge' });
    expect(queue).toEqual([]);
  });

  it('excludes a bought item with no known zone (e.g. the "Из меню" catch-all category)', () => {
    const cd = customData([{ name: 'Из меню', items: ['непонятный ингредиент'] }]);
    const queue = buildPutawayQueue(cd, { 'Из меню_0': true }, {});
    expect(queue).toEqual([]);
  });

  it('preserves category/item order across multiple categories', () => {
    const cd = customData([
      { name: 'Овощи', items: ['картошка', 'огурцы'] },
      { name: 'Фрукты', items: ['бананы'] },
    ]);
    const bought = { 'Овощи_0': true, 'Овощи_1': true, 'Фрукты_0': true };
    const queue = buildPutawayQueue(cd, bought, {});
    expect(queue.map((q) => q.product)).toEqual(['картошка', 'огурцы', 'бананы']);
    expect(queue.map((q) => q.zoneId)).toEqual(['veg', 'fridge', 'table']);
  });

  it('returns an empty queue for an empty customData', () => {
    expect(buildPutawayQueue({ categories: [] }, {}, {})).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/planner/putawayUtils.test.js`
Expected: FAIL — `putawayUtils.js` does not exist yet.

- [ ] **Step 4: Implement `putawayUtils.js`**

Create `src/features/planner/putawayUtils.js`:

```js
import { customDataToSteps, CATEGORY_ICONS } from './plannerShoppingUtils.js';
import { getZoneForProduct } from './putawayLocations.js';

function sName(step) { return step.text.replace(/:$/, '').trim(); }
function planKey(name, ii) { return `${name}_${ii}`; }

// Builds the ordered list of bought-but-not-yet-placed items for the
// putaway screen. `bought` and `placed` are both { [planKey]: truthy } maps.
export function buildPutawayQueue(customData, bought, placed) {
  const steps = customDataToSteps(customData);
  const queue = [];
  for (const step of steps) {
    const category = sName(step);
    (step.items ?? []).forEach((product, ii) => {
      const key = planKey(category, ii);
      if (!bought[key] || placed[key]) return;
      const zoneId = getZoneForProduct(category, product);
      if (!zoneId) return;
      queue.push({ key, category, product, zoneId, categoryIcon: CATEGORY_ICONS[category] ?? '📦' });
    });
  }
  return queue;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/planner/putawayUtils.test.js`
Expected: PASS (6 tests)

- [ ] **Step 6: Run the full test suite to make sure nothing else broke**

Run: `npx vitest run`
Expected: all test files pass, including the pre-existing `plannerUtils.test.js`, `recipeParser.test.js`, `shoppingListGenerator.test.js`.

- [ ] **Step 7: Commit**

```bash
git add src/features/planner/plannerShoppingUtils.js src/features/planner/putawayUtils.js src/features/planner/putawayUtils.test.js
git commit -m "feat(planner): add putaway queue builder from bought items"
```

---

## Task 3: Persist the "В магазине" bought state

Today `ShopView` (inside `PlannerShoppingScreen.jsx`) tracks which items were physically taken ("взял") in a local `useState({})` that resets every time the screen unmounts. This task makes it persist, which is also the data source Task 4's putaway screen depends on.

**Files:**
- Modify: `src/core/groupStore.js` (add two functions after the existing planner-shop block, currently ending at line 227)
- Modify: `src/features/planner/PlannerShoppingScreen.jsx`

**Interfaces:**
- Consumes: `getDb`, `kv` from `@/core/db` (already imported in `groupStore.js`).
- Produces:
  - `export async function getPlannerShopBought(studentId): Promise<Record<string, true>>`
  - `export async function savePlannerShopBought(studentId, bought: Record<string, true>): Promise<void>`
  - These are consumed by Task 4's `PlannerPutawayScreen.jsx`.

- [ ] **Step 1: Add persistence functions to `groupStore.js`**

In `src/core/groupStore.js`, immediately after line 227 (`export async function savePlannerShopCustomData(studentId, data) { ... }` and its closing brace), add:

```js
// ─── Planner shopping "bought" state (persists ShopView's tap-to-take
// checks — previously local useState, lost on navigating away; Раскладка
// needs to know what was actually bought, not just planned) ────────────────

const plannerShopBoughtKey = (sid) => `planner_shop_bought_${sid}`;

export async function getPlannerShopBought(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerShopBoughtKey(studentId))) ?? {};
}

export async function savePlannerShopBought(studentId, bought) {
  const db = await getDb();
  await kv.set(db, plannerShopBoughtKey(studentId), bought);
}
```

- [ ] **Step 2: Update `PlannerShoppingScreen.jsx` imports**

In `src/features/planner/PlannerShoppingScreen.jsx:3`, change:

```js
import { getRawRecipeTxt, getPlannerShopPlan, savePlannerShopPlan, getPlannerShopCustomData, savePlannerShopCustomData } from '@/core/groupStore';
```

to:

```js
import { getRawRecipeTxt, getPlannerShopPlan, savePlannerShopPlan, getPlannerShopCustomData, savePlannerShopCustomData, getPlannerShopBought, savePlannerShopBought } from '@/core/groupStore';
```

- [ ] **Step 3: Lift "bought" state into `ShopView`'s props**

In `src/features/planner/PlannerShoppingScreen.jsx`, replace the `ShopView` function (originally lines 148-242) with:

```jsx
function ShopView({ steps, icons, planned, bought, onToggleBought, onBack, onPutaway }) {
  const list = steps.map((step, si) => {
    const name = sName(step);
    const icon = icons[si] ?? '📦';
    const items = (step.items ?? [])
      .map((item, ii) => ({ item, ii, sub: step.itemSubgroups?.[ii] ?? null }))
      .filter(({ ii }) => planned[planKey(name, ii)]);
    return { step, name, icon, items };
  }).filter(({ items }) => items.length > 0);

  const total = list.reduce((s, { items }) => s + items.length, 0);
  const totalDone = list.reduce((s, { name, items }) =>
    s + items.filter(({ ii }) => bought[planKey(name, ii)]).length, 0);
  const allDone = total > 0 && totalDone === total;
  const progress = total > 0 ? (totalDone / total) * 100 : 0;

  function toggle(step, ii) {
    onToggleBought(planKey(sName(step), ii));
  }

  if (total === 0) return (
    <div className="shopping-body shop-center">
      <div className="shop-state">
        <div className="shop-state__icon">🛒</div>
        <div className="shop-state__title">Список пуст</div>
        <div className="shop-state__hint">Выбери продукты в списке покупок</div>
        <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onBack}><BackArrowIcon size={16} /> Выбрать продукты</button>
      </div>
    </div>
  );

  if (allDone) return (
    <div className="shopping-body shop-center">
      <div className="shop-state">
        <div className="shop-state__icon">🎉</div>
        <div className="shop-state__title">Всё куплено!</div>
        <div className="shop-state__hint">{total} продуктов</div>
        <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onBack}><BackArrowIcon size={16} /> К списку</button>
        <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onPutaway}>📦 Разложить продукты</button>
      </div>
    </div>
  );

  return (
    <div className="shopping-body">
      <div className="shop-progress">
        <div className="shop-progress__bar">
          <div className="shop-progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="shop-progress__label">{totalDone} / {total}</span>
      </div>
      <ul className="shopping-items">
        {list.map(({ step, name, icon, items }) => {
          const catDone = items.every(({ ii }) => bought[planKey(name, ii)]);
          return (
            <Fragment key={name}>
              <li className={`shop-section-header${catDone ? ' shop-section-header--done' : ''}`}>
                <span>{icon}</span>
                <span>{step.text.replace(/:$/, '')}</span>
                {catDone && <span className="shop-section-check"> ✓</span>}
              </li>
              {items.map(({ item, ii, sub }, idx) => {
                const prevSub = idx > 0 ? items[idx - 1].sub : null;
                const showSub = sub && sub !== prevSub && !isDupSub(sub, name);
                const isDoneItem = !!bought[planKey(name, ii)];
                const note = noteFor(planned, planKey(name, ii));
                return (
                  <Fragment key={`${name}_${ii}`}>
                    {showSub && <li className="shopping-subgroup-header">{sub}</li>}
                    <li role="checkbox" aria-checked={isDoneItem}
                      className={`shopping-item${isDoneItem ? ' shopping-item--done' : ''}`}
                      onClick={() => toggle(step, ii)}
                    >
                      <span className="shopping-checkbox">{isDoneItem ? '✓' : ''}</span>
                      <span className="shopping-item-body">
                        <span className="shopping-item-label">{item}</span>
                        {note && <span className="shopping-item-note shopping-item-note--set">{note}</span>}
                      </span>
                      {!isDoneItem && <span className="shopping-tap-hint">взял</span>}
                    </li>
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </ul>
      <div className="shopping-actions">
        <button className="shopping-view-btn" onClick={onBack}><BackArrowIcon size={16} /> К списку</button>
      </div>
    </div>
  );
}
```

(This removes the internal `const [done, setDone] = useState({})` and its `toggle` implementation — `ShopView` no longer imports `useState` for this purpose. Note: `useState` is still used by `PlannerShoppingScreen` itself, so leave the top-of-file `import { useState, useEffect, Fragment } from 'react';` unchanged.)

- [ ] **Step 4: Add `bought` state, load/save/reset it in the main component**

In `src/features/planner/PlannerShoppingScreen.jsx`, in `export default function PlannerShoppingScreen()`, change:

```jsx
  const [planned, setPlanned]   = useState({});
  const [confirmReset, setConfirmReset] = useState(false);
```

to:

```jsx
  const [planned, setPlanned]   = useState({});
  const [bought, setBought]     = useState({});
  const [confirmReset, setConfirmReset] = useState(false);
```

Change the `loadAndApply` function's early-return branch from:

```jsx
    if (!forceRegen) {
      const [savedCustom, savedPlan] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopPlan(studentId),
      ]);
      if (savedCustom) {
        setSteps(customDataToSteps(savedCustom));
        setIcons(savedCustom.categories.map((c) => c.icon));
        setPlanned(savedPlan ?? {});
        setLoading(false);
        return;
      }
    }
```

to:

```jsx
    if (!forceRegen) {
      const [savedCustom, savedPlan, savedBought] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopPlan(studentId),
        getPlannerShopBought(studentId),
      ]);
      if (savedCustom) {
        setSteps(customDataToSteps(savedCustom));
        setIcons(savedCustom.categories.map((c) => c.icon));
        setPlanned(savedPlan ?? {});
        setBought(savedBought ?? {});
        setLoading(false);
        return;
      }
    }
```

And at the end of `loadAndApply` (the freshly-generated-from-recipes path), change:

```jsx
    setSteps(customDataToSteps(customData));
    setIcons(customData.categories.map((c) => c.icon));
    setPlanned(newPlan);
    setLoading(false);
  }
```

to:

```jsx
    setSteps(customDataToSteps(customData));
    setIcons(customData.categories.map((c) => c.icon));
    setPlanned(newPlan);
    setBought((await getPlannerShopBought(studentId)) ?? {});
    setLoading(false);
  }
```

Add a `toggleBought` function next to the existing `toggleItem`/`saveNote` functions:

```jsx
  function toggleBought(key) {
    setBought((prev) => {
      const next = { ...prev };
      if (next[key]) { delete next[key]; } else { next[key] = true; }
      savePlannerShopBought(studentId, next).catch(() => {});
      return next;
    });
  }
```

Update `handleReset` to also clear the bought state, so a "Пересоставить из рецептов" doesn't leave stale "взял" flags pointing at categories/indices that no longer mean the same thing:

```jsx
  async function handleReset() {
    await savePlannerShopCustomData(studentId, null);
    await savePlannerShopPlan(studentId, {});
    await savePlannerShopBought(studentId, {});
    setConfirmReset(false);
    setView('grid');
    loadAndApply(true);
  }
```

- [ ] **Step 5: Pass the new props into `ShopView`**

Change:

```jsx
      {view === 'shop' ? (
        <ShopView steps={steps} icons={icons} planned={planned} onBack={() => setView('grid')} />
      ) : typeof view === 'number' ? (
```

to:

```jsx
      {view === 'shop' ? (
        <ShopView
          steps={steps} icons={icons} planned={planned}
          bought={bought} onToggleBought={toggleBought}
          onBack={() => setView('grid')}
          onPutaway={() => setScreen('planner_putaway')}
        />
      ) : typeof view === 'number' ? (
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests still pass (this task has no new pure-logic module, so no new test file — see Global Constraints on why `groupStore.js` KV wrappers aren't unit-tested here).

- [ ] **Step 7: Manual verification**

Using the `run` skill (start the dev server, open in browser):
1. Navigate to Планировщик → Покупки → В магазине (need at least one item checked in the Покупки grid first).
2. Tap an item to mark it "взял" — it shows a checkmark.
3. Navigate back to the hub (Home) and back into В магазине — the item is still marked "взял" (this is the persistence check; before this change it would have reset).
4. Mark every planned item as bought — the "Всё куплено!" celebration appears with two buttons: "К списку" and "📦 Разложить продукты". **Do not tap "Разложить продукты" yet** — `planner_putaway` isn't a registered screen until Task 4, so tapping it now would show `NotFoundScreen`.

- [ ] **Step 8: Commit**

```bash
git add src/core/groupStore.js src/features/planner/PlannerShoppingScreen.jsx
git commit -m "feat(planner): persist bought state in В магазине instead of losing it on navigation"
```

---

## Task 4: Build the putaway screen

**Files:**
- Modify: `src/core/groupStore.js` (add putaway-plan persistence, after Task 3's additions)
- Create: `src/features/planner/PlannerPutawayScreen.jsx`
- Modify: `src/features/planner/planner.css` (append putaway styles)
- Modify: `src/App.jsx` (register the screen)

**Interfaces:**
- Consumes:
  - `ZONES` from `src/features/planner/putawayLocations.js` (Task 1).
  - `buildPutawayQueue(customData, bought, placed)` from `src/features/planner/putawayUtils.js` (Task 2).
  - `getPlannerShopCustomData(studentId)`, `getPlannerShopBought(studentId)` from `@/core/groupStore` (existing / Task 3).
  - `useAppStore` for `activeStudentId` and `setScreen` (existing global store).
- Produces:
  - `export async function getPlannerPutawayPlan(studentId): Promise<Record<string, string>>` and `export async function savePlannerPutawayPlan(studentId, plan)` in `groupStore.js` — consumed by Task 5's hub-unlock logic is NOT required (hub only needs the bought count), but is available for any future screen that wants to show putaway completion state.
  - Default export `PlannerPutawayScreen` — registered under the `planner_putaway` screen key, used by Task 5's hub card and by Task 3's `onPutaway` button.

- [ ] **Step 1: Add putaway-plan persistence to `groupStore.js`**

In `src/core/groupStore.js`, immediately after the `savePlannerShopBought` function added in Task 3, add:

```js
// ─── Planner putaway (Раскладка) placements ──────────────────────────────
// { [planKey]: zoneId } — keyed the same way as the shopping plan/bought
// maps, so no new identifier scheme is introduced.

const plannerPutawayPlanKey = (sid) => `planner_putaway_plan_${sid}`;

export async function getPlannerPutawayPlan(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerPutawayPlanKey(studentId))) ?? {};
}

export async function savePlannerPutawayPlan(studentId, plan) {
  const db = await getDb();
  await kv.set(db, plannerPutawayPlanKey(studentId), plan);
}
```

- [ ] **Step 2: Add putaway CSS to `planner.css`**

Append to the end of `src/features/planner/planner.css`:

```css
/* ── Putaway (Раскладка) ────────────────────────────────────────
   One product at a time: a spotlight card up top, six storage-zone
   tiles below to tap the answer into. Progress dots track completion
   across the whole bought list — placements persist, so re-entering
   the screen resumes instead of restarting. */
.putaway-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.putaway-progress {
  font-size: 12px;
  font-weight: 700;
  color: #7d8f8a;
  margin-bottom: 14px;
}

.putaway-card {
  width: 160px;
  height: 160px;
  border-radius: 24px;
  background: rgba(250, 247, 242, 0.97);
  box-shadow: 0 8px 22px rgba(71, 61, 48, 0.10);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}

.putaway-card__icon {
  font-size: 44px;
}

.putaway-card__name {
  font-size: 15px;
  font-weight: 800;
  color: #263131;
  text-align: center;
  padding: 0 10px;
}

.putaway-zones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
  max-width: 340px;
}

.putaway-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 8px;
  border-radius: 16px;
  border: 2px solid transparent;
  background: rgba(250, 247, 242, 0.97);
  box-shadow: 0 4px 14px rgba(71, 61, 48, 0.05);
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.1s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.putaway-zone:active {
  transform: scale(0.96);
}

.putaway-zone__icon {
  font-size: 26px;
}

.putaway-zone__label {
  font-size: 12px;
  font-weight: 700;
  color: #263131;
  text-align: center;
}

.putaway-zone--wrong {
  animation: putaway-shake 0.3s ease;
  border-color: #e07a5f;
  background: #fdeeea;
}

@keyframes putaway-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.putaway-zone--hint {
  border-color: #4a9b8f;
  animation: putaway-glow 1s ease-in-out infinite;
}

@keyframes putaway-glow {
  0%, 100% { box-shadow: 0 4px 14px rgba(71, 61, 48, 0.05); background: rgba(250, 247, 242, 0.97); }
  50% { box-shadow: 0 0 0 6px rgba(74, 155, 143, 0.25); background: rgba(74, 155, 143, 0.1); }
}

.putaway-hint {
  min-height: 16px;
  margin-top: 12px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  color: #e07a5f;
}

.putaway-dots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 20px;
  max-width: 280px;
}

.putaway-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d8cbc0;
  flex-shrink: 0;
}

.putaway-dot--done {
  background: #4a9b8f;
}

.putaway-complete {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 32px;
}

.putaway-complete__icon {
  font-size: 48px;
}

.putaway-complete__title {
  font-size: 18px;
  font-weight: 800;
  color: #263131;
}

.putaway-complete__hint {
  font-size: 14px;
  color: #7d8f8a;
}

.putaway-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  color: #a8978a;
  font-size: 15px;
}
```

- [ ] **Step 3: Create `PlannerPutawayScreen.jsx`**

Create `src/features/planner/PlannerPutawayScreen.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getPlannerShopCustomData, getPlannerShopBought, getPlannerPutawayPlan, savePlannerPutawayPlan } from '@/core/groupStore';
import { buildPutawayQueue } from './putawayUtils.js';
import { ZONES } from './putawayLocations.js';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import './planner.css';

export default function PlannerPutawayScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const studentId = useAppStore((s) => s.activeStudentId);

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [putawayPlan, setPutawayPlan] = useState({});
  const [doneCount, setDoneCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongZoneId, setWrongZoneId] = useState(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [customData, bought, plan] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopBought(studentId),
        getPlannerPutawayPlan(studentId),
      ]);
      if (cancelled) return;
      const safePlan = plan ?? {};
      const builtQueue = customData ? buildPutawayQueue(customData, bought ?? {}, safePlan) : [];
      setQueue(builtQueue);
      setPutawayPlan(safePlan);
      setDoneCount(Object.keys(safePlan).length);
      setTotalCount(Object.keys(safePlan).length + builtQueue.length);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [studentId]);

  const current = queue[0];

  function handlePick(zoneId) {
    if (!current) return;
    if (zoneId !== current.zoneId) {
      setWrongZoneId(zoneId);
      setTimeout(() => setWrongZoneId(null), 300);
      setWrongCount((n) => n + 1);
      return;
    }
    const nextPlan = { ...putawayPlan, [current.key]: current.zoneId };
    setPutawayPlan(nextPlan);
    savePlannerPutawayPlan(studentId, nextPlan).catch(() => {});
    setQueue((q) => q.slice(1));
    setDoneCount((n) => n + 1);
    setWrongCount(0);
    setWrongZoneId(null);
  }

  if (loading) return <div className="screen screen-center">Загрузка…</div>;

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={() => setScreen('home')}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">Раскладка</h1>
      </div>

      {!current ? (
        totalCount === 0 ? (
          <div className="putaway-empty">Пока нечего раскладывать — сначала отметь купленные продукты в «В магазине».</div>
        ) : (
          <div className="putaway-complete">
            <div className="putaway-complete__icon">🎉</div>
            <div className="putaway-complete__title">Всё разложено!</div>
            <div className="putaway-complete__hint">{totalCount} продуктов на своих местах</div>
          </div>
        )
      ) : (
        <div className="putaway-body">
          <div className="putaway-progress">Продукт {doneCount + 1} из {totalCount}</div>

          <div className="putaway-card">
            <div className="putaway-card__icon">{current.categoryIcon}</div>
            <div className="putaway-card__name">{current.product}</div>
          </div>

          <div className="putaway-zones">
            {ZONES.map((zone) => (
              <button
                key={zone.id}
                className={`putaway-zone${wrongZoneId === zone.id ? ' putaway-zone--wrong' : ''}${wrongCount >= 2 && zone.id === current.zoneId ? ' putaway-zone--hint' : ''}`}
                onClick={() => handlePick(zone.id)}
              >
                <span className="putaway-zone__icon">{zone.icon}</span>
                <span className="putaway-zone__label">{zone.label}</span>
              </button>
            ))}
          </div>

          <div className="putaway-hint">
            {wrongCount >= 2 ? 'Вот сюда — попробуй эту зону' : wrongZoneId ? 'Не совсем — попробуй другое место' : ''}
          </div>

          <div className="putaway-dots">
            {Array.from({ length: totalCount }).map((_, i) => (
              <span key={i} className={`putaway-dot${i < doneCount ? ' putaway-dot--done' : ''}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Register the screen in `App.jsx`**

In `src/App.jsx:40`, change:

```js
import PlannerShoppingScreen from "@/features/planner/PlannerShoppingScreen";
```

to:

```js
import PlannerShoppingScreen from "@/features/planner/PlannerShoppingScreen";
import PlannerPutawayScreen from "@/features/planner/PlannerPutawayScreen";
```

In `src/App.jsx:86`, change:

```js
  planner_shopping: PlannerShoppingScreen,
};
```

to:

```js
  planner_shopping: PlannerShoppingScreen,
  planner_putaway: PlannerPutawayScreen,
};
```

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (no new pure-logic module in this step — `PlannerPutawayScreen.jsx` is a screen component, verified manually per this codebase's existing convention of not unit-testing screen components).

- [ ] **Step 6: Manual verification**

Using the `run` skill:
1. Complete the flow from Task 3's manual check up through marking at least one (not necessarily all) item "взял" in В магазине.
2. From ShopView (still mid-list, or from the "Всё куплено!" state), tap "📦 Разложить продукты" — the putaway screen now loads correctly (screen is registered).
3. Confirm the spotlight shows one product, its category icon, and 6 zone tiles.
4. Tap a wrong zone twice for the same product — it shakes/flashes red both times, then on the 3rd render the correct zone starts pulsing and the hint text changes to "Вот сюда — попробуй эту зону".
5. Tap the correct zone — the dot row advances, the next product appears, `Продукт N из M` increments.
6. Place every item — the "Всё разложено!" celebration appears.
7. Reload the page and re-open «Раскладка» via the hub (may still be `locked` until Task 5 — if so, temporarily verify via directly setting `screen: 'planner_putaway'` in the Zustand devtools, or proceed to Task 5 first) — confirm it opens straight to the celebration state (placements persisted), not back at product 1.

- [ ] **Step 7: Commit**

```bash
git add src/core/groupStore.js src/features/planner/PlannerPutawayScreen.jsx src/features/planner/planner.css src/App.jsx
git commit -m "feat(planner): add Раскладка putaway screen"
```

---

## Task 5: Wire up entry points and final verification

**Files:**
- Modify: `src/features/home/HomeScreen.jsx`

**Interfaces:**
- Consumes: `getPlannerShopBought(studentId)` from `@/core/groupStore` (Task 3).
- Produces: nothing new — this is the final wiring task.

- [ ] **Step 1: Import `getPlannerShopBought` in `HomeScreen.jsx`**

In `src/features/home/HomeScreen.jsx:12`, change:

```js
import { loadPlan } from "@/features/planner/plannerApi";
```

to:

```js
import { loadPlan } from "@/features/planner/plannerApi";
import { getPlannerShopBought } from "@/core/groupStore";
```

- [ ] **Step 2: Track bought count in `PlannerTab`**

In `src/features/home/HomeScreen.jsx`, inside `function PlannerTab({ student, setScreen })`, change:

```jsx
function PlannerTab({ student, setScreen }) {
  const setPlannerInitialView = useAppStore((s) => s.setPlannerInitialView);
  const [existingPlan, setExistingPlan] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!student) { setExistingPlan(null); return; }
    loadPlan(student.id).then(setExistingPlan);
  }, [student?.id]);
```

to:

```jsx
function PlannerTab({ student, setScreen }) {
  const setPlannerInitialView = useAppStore((s) => s.setPlannerInitialView);
  const [existingPlan, setExistingPlan] = useState(undefined); // undefined = loading
  const [boughtCount, setBoughtCount] = useState(0);

  useEffect(() => {
    if (!student) { setExistingPlan(null); return; }
    loadPlan(student.id).then(setExistingPlan);
  }, [student?.id]);

  useEffect(() => {
    if (!student) { setBoughtCount(0); return; }
    getPlannerShopBought(student.id).then((bought) => setBoughtCount(Object.keys(bought ?? {}).length));
  }, [student?.id]);
```

(Two separate effects, matching the existing style of one effect per concern in this file. `HomeScreen` fully remounts on every navigation back to `home` — see the `homeActiveTab` comment already in `src/core/store.js` — so this refetches fresh every time the hub is shown, without needing any extra invalidation plumbing.)

- [ ] **Step 3: Unlock the 4th hub card**

In `src/features/home/HomeScreen.jsx`, change:

```jsx
        <HubCard
          state="locked"
          icon="📦"
          title="Раскладка"
          value="После покупок"
          disabled
        />
```

to:

```jsx
        <HubCard
          state={boughtCount > 0 ? 'active' : 'locked'}
          icon="📦"
          title="Раскладка"
          value={boughtCount > 0 ? `${boughtCount} товаров готово к раскладке` : 'После покупок'}
          onClick={() => setScreen('planner_putaway')}
          disabled={boughtCount === 0}
        />
```

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: no new errors introduced by these changes.

- [ ] **Step 6: Full end-to-end manual verification**

Using the `run` skill, starting from a student with no plan at all (or a fresh test student):
1. Hub: with no plan, «Раскладка» card is `locked`/dashed with "После покупок", not tappable.
2. Build a menu (Рецепты → add a couple of recipes), open Покупки, select some items in the grid.
3. Open В магазине, mark 2-3 items (not all) as "взял".
4. Go back to the hub — «Раскладка» card is now `active`, showing "N товаров готово к раскладке", and is tappable.
5. Tap the card — lands on the putaway screen, showing the first bought item.
6. Confirm an item known to need the room-temperature veg spot (e.g. "картошка", if it was bought) resolves correctly there, not the fridge.
7. Confirm a bought item with no shopping.txt match (simulate by having an unmatched recipe ingredient show up under the "Из меню" category in Покупки, then marking it bought) does **not** appear in the putaway queue.
8. Complete the queue — "Всё разложено!" appears.
9. Reload the app entirely (hard refresh) — hub still shows «Раскладка» as `active` (or however many new items are bought since), re-entering the screen shows the "Всё разложено!" state again (not reset to product 1), confirming persistence survived a full reload.
10. From В магазине, mark all remaining planned items as bought until "Всё куплено!" shows, tap "📦 Разложить продукты" — lands directly on the putaway screen with the newly-bought items queued up.

- [ ] **Step 7: Commit**

```bash
git add src/features/home/HomeScreen.jsx
git commit -m "feat(planner): unlock Раскладка hub card once items are bought"
```
