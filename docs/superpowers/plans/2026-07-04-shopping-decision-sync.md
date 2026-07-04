# Покупки decision-sync fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Покупки silently dropping ingredients decided "Купить" in Меню when they don't already exist in the previously-generated shopping list, by replacing the exact-match-only re-sync with one that can also add (to an "Из меню" catch-all) and remove items, using the same fuzzy-match logic first-generation already trusts.

**Architecture:** Extract the existing three-tier fuzzy-match cascade out of `buildPlannerShoppingData` into a shared `findFuzzyMatch` helper. Add a new `syncDecisionsIntoShoppingData` in `plannerShoppingUtils.js` that uses it to add/check/uncheck/remove items against a live `customData`, replacing `applyDecisionsToPlanned`. Wire it into `PlannerShoppingScreen.jsx`'s `loadAndApply`, which now also loads `allRecipes` (already-existing `loadAllRecipes`) to get properly-cased, portion-scaled ingredient data (`buildSelectedIngredientsSummary`) instead of relying on the bare `ingredientDecisions` map alone.

**Tech Stack:** Plain JS (React 19 project), Vitest for unit tests.

## Global Constraints

- The store list (Меркатор/Спар/Лидл/Хофер + current selection) is untouched — confirmed intentional, session-independent, out of scope.
- Manually adding non-recipe items (napkins, chemicals, table fruit) via the category editor (✏️) already works and is untouched by this fix.
- A "Из меню" item whose decision reverts to "Дома" is removed from the category entirely (not just unchecked); a normal (permanent, shopping.txt-derived) category item whose decision reverts to "Дома" is only unchecked, never removed.
- This fix does not attempt to solve the general `planKey(category, itemIndex)` index-fragility problem (reordering/deleting an item shifts every later index in that category) — the "Из меню" removal uses a plain array splice, the same mechanism the existing `CategoryEditor`'s manual item deletion already uses, accepting the same pre-existing limitation rather than solving a larger architectural problem in this bug-fix pass.
- Full spec: `docs/superpowers/specs/2026-07-04-shopping-decision-sync-design.md`.

---

## Task 1: `findFuzzyMatch` + `syncDecisionsIntoShoppingData` in `plannerShoppingUtils.js`

**Files:**
- Modify: `src/features/planner/plannerShoppingUtils.js`
- Create: `src/features/planner/plannerShoppingUtils.test.js` (this file has no tests today)

**Interfaces:**
- Consumes: nothing new — pure functions operating on the existing `customData`/`planned` shapes already used throughout this file.
- Produces:
  - `export function findFuzzyMatch(lookup, prodNorm): { norm, catName, ii } | undefined` — the three-tier cascade (exact → substring either direction → shared word longer than 3 chars), shared by `buildPlannerShoppingData` and the new sync function.
  - `export function syncDecisionsIntoShoppingData(customData, planned, ingredientItems, ingredientDecisions): { customData, planned }` — consumed by Task 2's `PlannerShoppingScreen.jsx`. `ingredientItems` is shaped like `buildSelectedIngredientsSummary`'s output: `Array<{product: string, qty: number|null, unit: string|null}>`. `ingredientDecisions` is `plan.ingredientDecisions` (`Object<string, 'have'|'buy'>`, keys already lowercase).
  - `applyDecisionsToPlanned` is removed entirely (superseded).

- [ ] **Step 1: Write the failing tests**

Create `src/features/planner/plannerShoppingUtils.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { findFuzzyMatch, buildPlannerShoppingData, syncDecisionsIntoShoppingData } from './plannerShoppingUtils.js';

describe('findFuzzyMatch', () => {
  const lookup = [
    { norm: 'картошка', catName: 'Овощи', ii: 0 },
    { norm: 'куриное филе', catName: 'Мясо', ii: 0 },
  ];

  it('matches by exact normalized string', () => {
    expect(findFuzzyMatch(lookup, 'картошка')).toEqual({ norm: 'картошка', catName: 'Овощи', ii: 0 });
  });

  it('matches by substring either direction', () => {
    expect(findFuzzyMatch(lookup, 'филе')).toEqual({ norm: 'куриное филе', catName: 'Мясо', ii: 0 });
  });

  it('matches by a shared word longer than 3 characters when no substring matches', () => {
    expect(findFuzzyMatch(lookup, 'филе куриное охлажденное')).toEqual({ norm: 'куриное филе', catName: 'Мясо', ii: 0 });
  });

  it('returns undefined when nothing matches', () => {
    expect(findFuzzyMatch(lookup, 'зюзюкревельды')).toBeUndefined();
  });
});

describe('buildPlannerShoppingData (after findFuzzyMatch extraction)', () => {
  it('checks a matched item and adds a note for its quantity', () => {
    const { plan } = buildPlannerShoppingData([
      { product: 'картошка', qty: 2, unit: 'шт', include: true },
    ]);
    expect(plan['Овощи_0']).toEqual({ note: '2 шт' });
  });

  it('places a completely unmatched item into the Из меню catch-all', () => {
    const { customData, plan } = buildPlannerShoppingData([
      { product: 'экзотика икс', qty: null, unit: null, include: true },
    ]);
    const menuCat = customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['экзотика икс']);
    expect(plan['Из меню_0']).toBe(true);
  });

  it('skips items with include: false', () => {
    const { plan } = buildPlannerShoppingData([
      { product: 'картошка', qty: null, unit: null, include: false },
    ]);
    expect(plan).toEqual({});
  });
});

function makeCustomData() {
  return {
    categories: [
      { id: 'base_Овощи', name: 'Овощи', icon: '🥦', subgroups: [{ name: null, items: ['картошка', 'морковь'] }] },
    ],
  };
}

describe('syncDecisionsIntoShoppingData', () => {
  it('checks an existing matching item when decided buy', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'картошка': 'buy' });
    expect(planned).toEqual({ 'Овощи_0': true });
  });

  it('adds an unmatched buy-decided ingredient to Из меню, labeled with its quantity', () => {
    const items = [{ product: 'экзотика икс', qty: 2, unit: 'шт' }];
    const { customData, planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'экзотика икс': 'buy' });
    const menuCat = customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['экзотика икс 2 шт']);
    expect(planned).toEqual({ 'Из меню_0': true });
  });

  it('does not duplicate an already-added Из меню item on a repeated sync', () => {
    const items = [{ product: 'экзотика икс', qty: null, unit: null }];
    const decisions = { 'экзотика икс': 'buy' };
    const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, decisions);
    const second = syncDecisionsIntoShoppingData(first.customData, first.planned, items, decisions);
    const menuCat = second.customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['экзотика икс']);
  });

  it('removes a Из меню item entirely when its decision reverts to have', () => {
    const items = [{ product: 'экзотика икс', qty: null, unit: null }];
    const added = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'экзотика икс': 'buy' });
    const reverted = syncDecisionsIntoShoppingData(added.customData, added.planned, items, { 'экзотика икс': 'have' });
    const menuCat = reverted.customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual([]);
    expect(reverted.planned).toEqual({});
  });

  it('unchecks but does not remove a normal category item when its decision reverts to have', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const bought = syncDecisionsIntoShoppingData(makeCustomData(), {}, items, { 'картошка': 'buy' });
    const reverted = syncDecisionsIntoShoppingData(bought.customData, bought.planned, items, { 'картошка': 'have' });
    expect(reverted.planned).toEqual({});
    expect(reverted.customData.categories[0].subgroups[0].items).toEqual(['картошка', 'морковь']);
  });

  it('leaves an item with no decision untouched', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const customData = makeCustomData();
    const { planned, customData: next } = syncDecisionsIntoShoppingData(customData, {}, items, {});
    expect(planned).toEqual({});
    expect(next).toEqual(customData);
  });

  it('preserves an existing note on an already-checked buy item', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const planned = { 'Овощи_0': { note: '2 кг' } };
    const { planned: next } = syncDecisionsIntoShoppingData(makeCustomData(), planned, items, { 'картошка': 'buy' });
    expect(next['Овощи_0']).toEqual({ note: '2 кг' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/planner/plannerShoppingUtils.test.js`
Expected: FAIL — `findFuzzyMatch` and `syncDecisionsIntoShoppingData` are not exported yet.

- [ ] **Step 3: Implement `findFuzzyMatch` and refactor `buildPlannerShoppingData`**

In `src/features/planner/plannerShoppingUtils.js`, change:

```js
// Maps generated shopping list items to shopping.txt categories.
// Returns { customData, plan } ready to save to planner shop storage.
export function buildPlannerShoppingData(shoppingListItems) {
  // Flat lookup: normalised string → { catName, ii (item index within category) }
  const lookup = [];
  SHOPPING_STEPS.forEach((step) => {
    const catName = sName(step);
    (step.items ?? []).forEach((item, ii) => {
      lookup.push({ norm: item.toLowerCase().trim(), catName, ii });
    });
  });

  const plan = {};
  const unmatchedItems = [];

  for (const { product, qty, unit, include } of shoppingListItems) {
    if (!include) continue;
    const prodNorm = product.toLowerCase().trim();

    let match = lookup.find((l) => l.norm === prodNorm);
    if (!match) {
      match = lookup.find((l) => prodNorm.includes(l.norm) || l.norm.includes(prodNorm));
    }
    if (!match) {
      const prodWords = prodNorm.split(/\s+/);
      match = lookup.find((l) => {
        const bw = l.norm.split(/\s+/);
        return prodWords.some((w) => w.length > 3 && bw.some((b) => b.includes(w) || w.includes(b)));
      });
    }

    const note = qty != null ? `${Math.round(qty * 10) / 10}${unit ? ' ' + unit : ''}` : '';

    if (match) {
      plan[planKey(match.catName, match.ii)] = note ? { note } : true;
    } else {
      const label = note ? `${product} ${note}` : product;
      unmatchedItems.push(label);
    }
  }
```

to:

```js
// Three-tier fuzzy match, shared by first-generation (buildPlannerShoppingData)
// and re-sync (syncDecisionsIntoShoppingData below): exact normalized string,
// then substring either direction, then any shared word longer than 3 chars.
export function findFuzzyMatch(lookup, prodNorm) {
  let match = lookup.find((l) => l.norm === prodNorm);
  if (!match) {
    match = lookup.find((l) => prodNorm.includes(l.norm) || l.norm.includes(prodNorm));
  }
  if (!match) {
    const prodWords = prodNorm.split(/\s+/);
    match = lookup.find((l) => {
      const bw = l.norm.split(/\s+/);
      return prodWords.some((w) => w.length > 3 && bw.some((b) => b.includes(w) || w.includes(b)));
    });
  }
  return match;
}

// Maps generated shopping list items to shopping.txt categories.
// Returns { customData, plan } ready to save to planner shop storage.
export function buildPlannerShoppingData(shoppingListItems) {
  // Flat lookup: normalised string → { catName, ii (item index within category) }
  const lookup = [];
  SHOPPING_STEPS.forEach((step) => {
    const catName = sName(step);
    (step.items ?? []).forEach((item, ii) => {
      lookup.push({ norm: item.toLowerCase().trim(), catName, ii });
    });
  });

  const plan = {};
  const unmatchedItems = [];

  for (const { product, qty, unit, include } of shoppingListItems) {
    if (!include) continue;
    const prodNorm = product.toLowerCase().trim();
    const match = findFuzzyMatch(lookup, prodNorm);
    const note = qty != null ? `${Math.round(qty * 10) / 10}${unit ? ' ' + unit : ''}` : '';

    if (match) {
      plan[planKey(match.catName, match.ii)] = note ? { note } : true;
    } else {
      const label = note ? `${product} ${note}` : product;
      unmatchedItems.push(label);
    }
  }
```

(The rest of `buildPlannerShoppingData` — building `customData`, adding the "Из меню" category for `unmatchedItems`, returning `{ customData, plan }` — is unchanged.)

- [ ] **Step 4: Run the new tests for `findFuzzyMatch` and `buildPlannerShoppingData`**

Run: `npx vitest run src/features/planner/plannerShoppingUtils.test.js`
Expected: The `findFuzzyMatch` and `buildPlannerShoppingData` describe blocks now PASS. The `syncDecisionsIntoShoppingData` block still FAILS (not implemented yet).

- [ ] **Step 5: Replace `applyDecisionsToPlanned` with `syncDecisionsIntoShoppingData`**

In `src/features/planner/plannerShoppingUtils.js`, replace the entire `applyDecisionsToPlanned` function (including its docstring) — currently:

```js
/**
 * Re-applies the Дома/Купить decisions made in Меню onto an already
 * existing planned checklist, matching items by normalized product name
 * across every category. Runs every time the Покупки screen loads (not
 * just on first generation) so a decision changed in Меню after the list
 * was first built — or after custom items were added via the editor —
 * still lands in Покупки, without wiping any custom categories/items the
 * decisions don't mention.
 *
 * 'buy' checks the item only if it wasn't already checked (preserves an
 * existing note). 'have' always unchecks it, since Меню's decision
 * overrides whatever was manually toggled in Покупки before.
 *
 * @param {Array<{text: string, items: string[]}>} steps
 * @param {object} planned
 * @param {Object<string, 'have'|'buy'>} ingredientDecisions
 */
export function applyDecisionsToPlanned(steps, planned, ingredientDecisions) {
  const next = { ...planned };
  for (const step of steps) {
    const catName = step.text.replace(/:$/, '').trim();
    (step.items ?? []).forEach((item, ii) => {
      const decision = ingredientDecisions[item.toLowerCase().trim()];
      if (!decision) return;
      const key = `${catName}_${ii}`;
      if (decision === 'buy') {
        if (!next[key]) next[key] = true;
      } else if (decision === 'have') {
        if (next[key]) delete next[key];
      }
    });
  }
  return next;
}
```

with:

```js
function buildCustomDataLookup(customData) {
  const lookup = [];
  customData.categories.forEach((cat) => {
    let ii = 0;
    cat.subgroups.forEach((sg) => {
      sg.items.forEach((item) => {
        lookup.push({ norm: item.toLowerCase().trim(), catName: cat.name, ii });
        ii++;
      });
    });
  });
  return lookup;
}

// Splices out the item at a category's flat index (spanning all its
// subgroups) — same mechanism CategoryEditor's manual item deletion already
// uses, including its accepted limitation that later items in the same
// category shift down by one index.
function removeItemAtFlatIndex(category, flatIndex) {
  let idx = flatIndex;
  for (const sg of category.subgroups) {
    if (idx < sg.items.length) { sg.items.splice(idx, 1); return; }
    idx -= sg.items.length;
  }
}

function addMenuExtraItem(customData, label) {
  let menuCat = customData.categories.find((c) => c.id === 'planner_menu_extras');
  if (!menuCat) {
    menuCat = { id: 'planner_menu_extras', name: 'Из меню', icon: '📋', subgroups: [{ name: null, items: [] }] };
    customData.categories.unshift(menuCat);
  }
  if (!menuCat.subgroups.length) menuCat.subgroups.push({ name: null, items: [] });
  menuCat.subgroups[0].items.push(label);
}

/**
 * Re-syncs Меню's Дома/Купить decisions into an already-existing shopping
 * list. Runs every time the Покупки screen loads (not just on first
 * generation), so a decision changed in Меню after the list was first
 * built — or after a new recipe was added to the menu — still lands in
 * Покупки:
 *
 * - matched + 'buy': checks it (unless already checked — preserves an
 *   existing note).
 * - matched + 'have', item is in the "Из меню" catch-all: removes the item
 *   from the category entirely (it only existed because of the decision).
 * - matched + 'have', item is a normal (shopping.txt-derived) category item:
 *   just unchecks it — it's a permanent list fixture, not removed.
 * - no match + 'buy': adds a new item to "Из меню" (creating that category
 *   if needed, via the same fuzzy-match cascade first generation uses) and
 *   checks it.
 * - no match + 'have': nothing to do, it never existed.
 *
 * Never touches custom categories/items the decisions don't mention.
 *
 * @param {object} customData
 * @param {object} planned
 * @param {Array<{product: string, qty: number|null, unit: string|null}>} ingredientItems
 * @param {Object<string, 'have'|'buy'>} ingredientDecisions
 * @returns {{ customData: object, planned: object }}
 */
export function syncDecisionsIntoShoppingData(customData, planned, ingredientItems, ingredientDecisions) {
  const nextCustomData = JSON.parse(JSON.stringify(customData));
  const nextPlanned = { ...planned };

  for (const item of ingredientItems) {
    const prodNorm = item.product.toLowerCase().trim();
    const decision = ingredientDecisions[prodNorm];
    if (!decision) continue;

    const lookup = buildCustomDataLookup(nextCustomData);
    const match = findFuzzyMatch(lookup, prodNorm);

    if (match) {
      const key = planKey(match.catName, match.ii);
      if (decision === 'buy') {
        if (!nextPlanned[key]) nextPlanned[key] = true;
      } else if (match.catName === 'Из меню') {
        const menuCat = nextCustomData.categories.find((c) => c.id === 'planner_menu_extras');
        if (menuCat) removeItemAtFlatIndex(menuCat, match.ii);
        delete nextPlanned[key];
      } else {
        delete nextPlanned[key];
      }
    } else if (decision === 'buy') {
      const note = item.qty != null ? `${Math.round(item.qty * 10) / 10}${item.unit ? ' ' + item.unit : ''}` : '';
      const label = note ? `${item.product} ${note}` : item.product;
      addMenuExtraItem(nextCustomData, label);
      const newLookup = buildCustomDataLookup(nextCustomData);
      const added = newLookup.find((l) => l.catName === 'Из меню' && l.norm === label.toLowerCase().trim());
      if (added) nextPlanned[planKey(added.catName, added.ii)] = true;
    }
  }

  return { customData: nextCustomData, planned: nextPlanned };
}
```

- [ ] **Step 6: Run the full test file to verify everything passes**

Run: `npx vitest run src/features/planner/plannerShoppingUtils.test.js`
Expected: PASS (all describe blocks — `findFuzzyMatch`, `buildPlannerShoppingData`, `syncDecisionsIntoShoppingData`)

- [ ] **Step 7: Run the full planner test suite to make sure nothing else broke**

Run: `npx vitest run src/features/planner`
Expected: all planner test files pass (this includes files that don't reference `plannerShoppingUtils.js` at all, confirming no accidental breakage).

- [ ] **Step 8: Commit**

```bash
git add src/features/planner/plannerShoppingUtils.js src/features/planner/plannerShoppingUtils.test.js
git commit -m "fix(planner): sync new buy-decisions into an existing Покупки list instead of dropping them"
```

---

## Task 2: Wire `syncDecisionsIntoShoppingData` into `PlannerShoppingScreen.jsx`

**Files:**
- Modify: `src/features/planner/PlannerShoppingScreen.jsx`

**Interfaces:**
- Consumes: `syncDecisionsIntoShoppingData(customData, planned, ingredientItems, ingredientDecisions)` from Task 1; `loadAllRecipes(topicRecords)` (already exists in `plannerApi.js`, added for the Planner-hub "Начинаем готовить" work); `buildSelectedIngredientsSummary(plan, allRecipes)` (already exists in `plannerUtils.js`).
- Produces: nothing new — this is the final integration task.

- [ ] **Step 1: Update imports**

In `src/features/planner/PlannerShoppingScreen.jsx:15-19`, change:

```js
import { loadPlan, PANTRY_ITEMS } from './plannerApi.js';
import { getPlanRecipes } from './plannerUtils.js';
import { parseRecipeMetadata } from './recipeParser.js';
import { generateShoppingList, applyIngredientDecisions } from './shoppingListGenerator.js';
import { buildPlannerShoppingData, customDataToSteps, applyDecisionsToPlanned } from './plannerShoppingUtils.js';
```

to:

```js
import { loadPlan, loadAllRecipes, PANTRY_ITEMS } from './plannerApi.js';
import { getPlanRecipes, buildSelectedIngredientsSummary } from './plannerUtils.js';
import { parseRecipeMetadata } from './recipeParser.js';
import { generateShoppingList, applyIngredientDecisions } from './shoppingListGenerator.js';
import { buildPlannerShoppingData, customDataToSteps, syncDecisionsIntoShoppingData } from './plannerShoppingUtils.js';
```

- [ ] **Step 2: Load `allRecipes` alongside the other saved state and use the new sync function**

In `src/features/planner/PlannerShoppingScreen.jsx`, change:

```jsx
  async function loadAndApply(forceRegen = false) {
    setLoading(true);
    if (!forceRegen) {
      const [savedCustom, savedPlan, savedBought, currentPlan] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopPlan(studentId),
        getPlannerShopBought(studentId),
        loadPlan(studentId),
      ]);
      if (savedCustom) {
        const stepsFromSaved = customDataToSteps(savedCustom);
        // Re-sync with Меню's Дома/Купить decisions on every load — not
        // just the first generation — so a decision changed after this
        // list already existed (or after custom items were added via the
        // editor) still lands here, without touching custom items the
        // decisions don't mention.
        const mergedPlanned = currentPlan
          ? applyDecisionsToPlanned(stepsFromSaved, savedPlan ?? {}, currentPlan.ingredientDecisions ?? {})
          : (savedPlan ?? {});
        setSteps(stepsFromSaved);
        setIcons(savedCustom.categories.map((c) => c.icon));
        setPlanned(mergedPlanned);
        setBought(savedBought ?? {});
        setCustomData(savedCustom);
        setLoading(false);
        if (JSON.stringify(mergedPlanned) !== JSON.stringify(savedPlan ?? {})) {
          savePlannerShopPlan(studentId, mergedPlanned).catch(() => {});
        }
        return;
      }
    }
```

to:

```jsx
  async function loadAndApply(forceRegen = false) {
    setLoading(true);
    if (!forceRegen) {
      const [savedCustom, savedPlan, savedBought, currentPlan, allRecipes] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopPlan(studentId),
        getPlannerShopBought(studentId),
        loadPlan(studentId),
        loadAllRecipes(topicRecords),
      ]);
      if (savedCustom) {
        // Re-sync with Меню's Дома/Купить decisions on every load — not
        // just the first generation — so a decision changed after this
        // list already existed (or after a new recipe was added to the
        // menu) still lands here: newly-decided "buy" ingredients get added
        // (via the same fuzzy match first generation uses, falling back to
        // "Из меню"), without touching custom categories/items the
        // decisions don't mention.
        const ingredientItems = currentPlan ? buildSelectedIngredientsSummary(currentPlan, allRecipes) : [];
        const { customData: syncedCustomData, planned: mergedPlanned } = currentPlan
          ? syncDecisionsIntoShoppingData(savedCustom, savedPlan ?? {}, ingredientItems, currentPlan.ingredientDecisions ?? {})
          : { customData: savedCustom, planned: savedPlan ?? {} };
        setSteps(customDataToSteps(syncedCustomData));
        setIcons(syncedCustomData.categories.map((c) => c.icon));
        setPlanned(mergedPlanned);
        setBought(savedBought ?? {});
        setCustomData(syncedCustomData);
        setLoading(false);
        if (JSON.stringify(syncedCustomData) !== JSON.stringify(savedCustom)) {
          savePlannerShopCustomData(studentId, syncedCustomData).catch(() => {});
        }
        if (JSON.stringify(mergedPlanned) !== JSON.stringify(savedPlan ?? {})) {
          savePlannerShopPlan(studentId, mergedPlanned).catch(() => {});
        }
        return;
      }
    }
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run src/features/planner`
Expected: all planner tests still pass (this task changes a screen component, not a pure-logic module — no new unit tests here, consistent with this codebase's existing convention of verifying screen components manually rather than with dedicated component tests).

- [ ] **Step 4: Run lint**

Run: `npx eslint src/features/planner/PlannerShoppingScreen.jsx`
Expected: only whatever pre-existing issues this file already had before this plan (check with `git stash` + re-lint if unsure which errors are pre-existing) — no new errors introduced by this task's changes.

- [ ] **Step 5: Manual verification**

Using the `run` skill:
1. Build a menu, decide a couple of ingredients "Купить", open Покупки for the first time — confirm they're checked in the right categories (unchanged first-generation behavior).
2. Go back to Меню, add another recipe to the menu, decide its ingredients (including at least one with a name unlikely to fuzzy-match anything in `shopping.txt`, e.g. a distinctive brand-name product). Reopen Покупки — confirm the new ingredient now appears: either checked in an existing category (if it fuzzy-matched) or added to "Из меню" (if not), without losing any manually-added categories/items, notes, or bought progress from before.
3. Manually add a non-recipe item via the ✏️ editor (e.g. a napkins item under Бытовая химия) — confirm it's untouched by reopening Покупки again.
4. Flip a "Купить" decision that landed in "Из меню" back to "Дома" in Меню, reopen Покупки — confirm that item is now gone from the list entirely (not just unchecked).
5. Flip a "Купить" decision for an ingredient that matched a normal shopping.txt category item (e.g. "картошка") back to "Дома" — confirm it's unchecked but the item itself ("картошка") still exists in "Овощи".

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/PlannerShoppingScreen.jsx
git commit -m "fix(planner): wire syncDecisionsIntoShoppingData into Покупки's load path"
```
