# Покупки lifecycle: menu-managed reconciliation + comprehensive reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Покупки from leaving stale, menu-driven checked items behind when a recipe is removed from Меню, and give the app one comprehensive "start everything over" reset instead of three disconnected partial ones.

**Architecture:** A persisted `plannerShopMenuKeys` set (planKey strings) tracks which checked items are menu-driven, so `syncDecisionsIntoShoppingData` can reconcile — uncheck/remove keys the menu no longer wants — without ever touching manually-checked items, which are never in that set. A new shared `resetShoppingData(studentId)` clears `customData`/`planned`/`bought`/`putawayPlan`/`menuKeys` together, called from both Меню's "Начать меню заново" and Покупки's "Пересоставить из рецептов".

**Tech Stack:** Plain JS (React 19 project), Vitest for unit tests, `fake-indexeddb` (already configured globally in `src/test-setup.js`) for the IndexedDB-backed `resetShoppingData` test.

## Global Constraints

- The store list and shopping history (🕒, last 5 completed trips) are untouched by any reset in this plan — confirmed intentional.
- Pruning stale entries out of `plan.ingredientDecisions` when a recipe is deselected is explicitly out of scope — not needed for correctness, since reconciliation only ever looks at currently-selected recipes' ingredients.
- When multiple "Из меню" items need removing in the same reconciliation pass, remove them in descending flat-index order so removing one doesn't shift another still pending removal in the same pass.
- Full spec: `docs/superpowers/specs/2026-07-04-shopping-lifecycle-reset-design.md`.

---

## Task 1: `plannerShopMenuKeys` persistence

**Files:**
- Modify: `src/core/groupStore.js` (insert after the existing `savePlannerPutawayPlan`, currently ending at line 259)

**Interfaces:**
- Consumes: `getDb`, `kv` from `@/core/db` (already imported at the top of `groupStore.js`).
- Produces:
  - `export async function getPlannerShopMenuKeys(studentId): Promise<string[]>` — defaults to `[]`.
  - `export async function savePlannerShopMenuKeys(studentId, keys: string[]): Promise<void>`.
  - Consumed by Task 2's tests indirectly (Task 2 tests the pure `syncDecisionsIntoShoppingData` function, which doesn't call these directly) and directly by Task 3's `resetShoppingData` and Task 4's `PlannerShoppingScreen.jsx`.

- [ ] **Step 1: Add the new KV pair**

In `src/core/groupStore.js`, immediately after the existing block ending with:

```js
export async function savePlannerPutawayPlan(studentId, plan) {
  const db = await getDb();
  await kv.set(db, plannerPutawayPlanKey(studentId), plan);
}
```

add:

```js

// ─── Planner "menu-managed" keys ──────────────────────────────────────────
// { planKey: true } → array of planKey strings currently checked *because*
// Меню decided "Купить" for them (as opposed to checked manually in
// Покупки, e.g. napkins) — lets syncDecisionsIntoShoppingData tell the two
// apart when a recipe leaves the menu and its ingredients need un-checking.

const plannerShopMenuKeysKey = (sid) => `planner_shop_menu_keys_${sid}`;

export async function getPlannerShopMenuKeys(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerShopMenuKeysKey(studentId))) ?? [];
}

export async function savePlannerShopMenuKeys(studentId, keys) {
  const db = await getDb();
  await kv.set(db, plannerShopMenuKeysKey(studentId), keys);
}
```

- [ ] **Step 2: Run the full test suite to make sure nothing broke**

Run: `npx vitest run src/features/planner`
Expected: all planner tests still pass (this is an additive change, no existing behavior touched).

- [ ] **Step 3: Commit**

```bash
git add src/core/groupStore.js
git commit -m "feat(planner): persist which Покупки checks are menu-managed"
```

---

## Task 2: Reconciliation in `syncDecisionsIntoShoppingData`

**Files:**
- Modify: `src/features/planner/plannerShoppingUtils.js`
- Modify: `src/features/planner/plannerShoppingUtils.test.js`

**Interfaces:**
- Consumes: `findFuzzyMatch`, `buildCustomDataLookup`, `removeItemAtFlatIndex`, `addMenuExtraItem`, `planKey` — all already exist in this file, unchanged.
- Produces: `syncDecisionsIntoShoppingData(customData, planned, menuKeys, ingredientItems, ingredientDecisions): { customData, planned, menuKeys }` — the `menuKeys` parameter and return field are new; every other part of the signature keeps its existing meaning. Consumed by Task 4's `PlannerShoppingScreen.jsx`.

- [ ] **Step 1: Replace the test file with the updated signature plus new reconciliation tests**

Replace the full contents of `src/features/planner/plannerShoppingUtils.test.js` with:

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
      { product: 'зкшзкш плюфь', qty: null, unit: null, include: true },
    ]);
    const menuCat = customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['зкшзкш плюфь']);
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
      { id: 'base_Молочные продукты', name: 'Молочные продукты', icon: '🥛', subgroups: [{ name: null, items: ['молоко'] }] },
      { id: 'user_custom', name: 'Своё', icon: '📦', subgroups: [{ name: null, items: ['Салфетки'] }] },
    ],
  };
}

describe('syncDecisionsIntoShoppingData', () => {
  it('checks an existing matching item when decided buy', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
    expect(planned).toEqual({ 'Овощи_0': true });
  });

  it('tracks a checked buy-decision as menu-managed', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const { menuKeys } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
    expect(menuKeys).toEqual(['Овощи_0']);
  });

  it('adds an unmatched buy-decided ingredient to Из меню, labeled with its quantity', () => {
    const items = [{ product: 'экзотика икс', qty: 2, unit: 'шт' }];
    const { customData, planned, menuKeys } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'экзотика икс': 'buy' });
    const menuCat = customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['экзотика икс 2 шт']);
    expect(planned).toEqual({ 'Из меню_0': true });
    expect(menuKeys).toEqual(['Из меню_0']);
  });

  it('does not duplicate an already-added Из меню item on a repeated sync', () => {
    const items = [{ product: 'экзотика икс', qty: null, unit: null }];
    const decisions = { 'экзотика икс': 'buy' };
    const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, decisions);
    const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, items, decisions);
    const menuCat = second.customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual(['экзотика икс']);
  });

  it('removes a Из меню item entirely when its decision reverts to have', () => {
    const items = [{ product: 'экзотика икс', qty: null, unit: null }];
    const added = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'экзотика икс': 'buy' });
    const reverted = syncDecisionsIntoShoppingData(added.customData, added.planned, added.menuKeys, items, { 'экзотика икс': 'have' });
    const menuCat = reverted.customData.categories.find((c) => c.id === 'planner_menu_extras');
    expect(menuCat.subgroups[0].items).toEqual([]);
    expect(reverted.planned).toEqual({});
  });

  it('unchecks but does not remove a normal category item when its decision reverts to have', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const bought = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
    const reverted = syncDecisionsIntoShoppingData(bought.customData, bought.planned, bought.menuKeys, items, { 'картошка': 'have' });
    expect(reverted.planned).toEqual({});
    expect(reverted.customData.categories[0].subgroups[0].items).toEqual(['картошка', 'морковь']);
  });

  it('leaves an item with no decision untouched', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const customData = makeCustomData();
    const { planned, customData: next } = syncDecisionsIntoShoppingData(customData, {}, [], items, {});
    expect(planned).toEqual({});
    expect(next).toEqual(customData);
  });

  it('preserves an existing note on an already-checked buy item', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const planned = { 'Овощи_0': { note: '2 кг' } };
    const { planned: next } = syncDecisionsIntoShoppingData(makeCustomData(), planned, [], items, { 'картошка': 'buy' });
    expect(next['Овощи_0']).toEqual({ note: '2 кг' });
  });

  it('leaves a custom ad-hoc item untouched since it never appears in ingredientItems', () => {
    const items = [{ product: 'картошка', qty: null, unit: null }];
    const customData = makeCustomData();
    const { customData: next } = syncDecisionsIntoShoppingData(customData, { 'Своё_0': true }, [], items, { 'картошка': 'buy' });
    const customCat = next.categories.find((c) => c.id === 'user_custom');
    expect(customCat.subgroups[0].items).toEqual(['Салфетки']);
  });

  it('matches product names case-insensitively', () => {
    const items = [{ product: 'КАРТОШКА', qty: null, unit: null }];
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
    expect(planned['Овощи_0']).toBe(true);
  });

  it('applies decisions across multiple categories in one pass', () => {
    const items = [
      { product: 'картошка', qty: null, unit: null },
      { product: 'молоко', qty: null, unit: null },
    ];
    const { planned } = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy', 'молоко': 'have' });
    expect(planned['Овощи_0']).toBe(true);
    expect(planned['Молочные продукты_0']).toBeUndefined();
  });

  it('does not mutate the input customData, planned, or menuKeys', () => {
    const customData = makeCustomData();
    const planned = {};
    const menuKeys = ['Овощи_0'];
    const items = [{ product: 'картошка', qty: null, unit: null }];
    syncDecisionsIntoShoppingData(customData, planned, menuKeys, items, { 'картошка': 'buy' });
    expect(planned).toEqual({});
    expect(menuKeys).toEqual(['Овощи_0']);
    expect(customData.categories[0].subgroups[0].items).toEqual(['картошка', 'морковь']);
  });

  describe('reconciliation (a menu-managed item whose ingredient drops out of the menu)', () => {
    it('unchecks a menu-managed normal-category item once its ingredient is no longer in the menu at all', () => {
      const items = [{ product: 'картошка', qty: null, unit: null }];
      const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'картошка': 'buy' });
      expect(first.planned['Овощи_0']).toBe(true);
      // Recipe using картошка removed from the menu: no items, no decisions this pass.
      const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, [], {});
      expect(second.planned['Овощи_0']).toBeUndefined();
    });

    it('removes a menu-managed Из меню item once its ingredient is no longer in the menu at all', () => {
      const items = [{ product: 'экзотика икс', qty: null, unit: null }];
      const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, { 'экзотика икс': 'buy' });
      const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, [], {});
      const menuCat = second.customData.categories.find((c) => c.id === 'planner_menu_extras');
      expect(menuCat.subgroups[0].items).toEqual([]);
    });

    it('keeps a still-needed menu-managed item checked across reconciliation', () => {
      const items = [{ product: 'картошка', qty: null, unit: null }];
      const decisions = { 'картошка': 'buy' };
      const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, decisions);
      const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, items, decisions);
      expect(second.planned['Овощи_0']).toBe(true);
    });

    it('leaves a manually-checked item untouched during reconciliation, since it was never menu-managed', () => {
      const customData = makeCustomData();
      const planned = { 'Своё_0': true }; // manually checked "Салфетки", never via sync
      const { planned: next } = syncDecisionsIntoShoppingData(customData, planned, [], [], {});
      expect(next['Своё_0']).toBe(true);
    });

    it('removes two no-longer-needed Из меню items in the same pass without corrupting either', () => {
      const items = [
        { product: 'алябуба первая', qty: null, unit: null },
        { product: 'алябуба вторая', qty: null, unit: null },
      ];
      const decisions = { 'алябуба первая': 'buy', 'алябуба вторая': 'buy' };
      const first = syncDecisionsIntoShoppingData(makeCustomData(), {}, [], items, decisions);
      const menuCat1 = first.customData.categories.find((c) => c.id === 'planner_menu_extras');
      expect(menuCat1.subgroups[0].items).toEqual(['алябуба первая', 'алябуба вторая']);

      // Both recipes removed from the menu in one go.
      const second = syncDecisionsIntoShoppingData(first.customData, first.planned, first.menuKeys, [], {});
      const menuCat2 = second.customData.categories.find((c) => c.id === 'planner_menu_extras');
      expect(menuCat2.subgroups[0].items).toEqual([]);
      expect(second.planned).toEqual({});
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify the new/changed ones fail**

Run: `npx vitest run src/features/planner/plannerShoppingUtils.test.js`
Expected: FAIL — `syncDecisionsIntoShoppingData` still has its old 4-argument signature (no `menuKeys` parameter, no `menuKeys` in its return value), so every test in the `syncDecisionsIntoShoppingData` describe block breaks.

- [ ] **Step 3: Implement `menuKeys` tracking and reconciliation**

In `src/features/planner/plannerShoppingUtils.js`, replace the entire `syncDecisionsIntoShoppingData` function (including its docstring) — currently:

```js
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

with:

```js
/**
 * Re-syncs Меню's Дома/Купить decisions into an already-existing shopping
 * list. Runs every time the Покупки screen loads (not just on first
 * generation), so a decision changed in Меню after the list was first
 * built — or after a recipe was added to or removed from the menu — still
 * lands in Покупки:
 *
 * - matched + 'buy': checks it (unless already checked — preserves an
 *   existing note), and records its key as menu-managed.
 * - matched + 'have', item is in the "Из меню" catch-all: removes the item
 *   from the category entirely (it only existed because of the decision).
 * - matched + 'have', item is a normal (shopping.txt-derived) category item:
 *   just unchecks it — it's a permanent list fixture, not removed.
 * - no match + 'buy': adds a new item to "Из меню" (creating that category
 *   if needed, via the same fuzzy-match cascade first generation uses),
 *   checks it, and records its key as menu-managed.
 * - no match + 'have': nothing to do, it never existed.
 *
 * After processing every current ingredient, reconciles against `menuKeys`
 * (the menu-managed keys from the *previous* sync): any key that was
 * menu-managed before but isn't menu-managed this time — its ingredient's
 * recipe left the menu entirely, so it never even appears in
 * `ingredientItems` this pass — gets cleaned up the same way an explicit
 * "Дома" decision would. A manually-checked item (napkins, anything not
 * tied to a recipe) is never in `menuKeys` to begin with, so reconciliation
 * never touches it.
 *
 * Never touches custom categories/items the decisions don't mention.
 *
 * @param {object} customData
 * @param {object} planned
 * @param {string[]} menuKeys - planKey's the menu managed as of the last sync
 * @param {Array<{product: string, qty: number|null, unit: string|null}>} ingredientItems
 * @param {Object<string, 'have'|'buy'>} ingredientDecisions
 * @returns {{ customData: object, planned: object, menuKeys: string[] }}
 */
export function syncDecisionsIntoShoppingData(customData, planned, menuKeys, ingredientItems, ingredientDecisions) {
  const nextCustomData = JSON.parse(JSON.stringify(customData));
  const nextPlanned = { ...planned };
  const nextMenuKeys = new Set();

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
        nextMenuKeys.add(key);
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
      if (added) {
        const key = planKey(added.catName, added.ii);
        nextPlanned[key] = true;
        nextMenuKeys.add(key);
      }
    }
  }

  // Reconcile: a key the menu managed last time but doesn't need this time
  // (its ingredient's recipe was removed from the menu entirely, or dropped
  // out for any other reason) gets cleaned up the same way an explicit
  // "Дома" decision would.
  const menuExtrasRemovals = [];
  for (const oldKey of menuKeys) {
    if (nextMenuKeys.has(oldKey)) continue;
    const sep = oldKey.lastIndexOf('_');
    const catName = oldKey.slice(0, sep);
    const ii = Number(oldKey.slice(sep + 1));
    if (catName === 'Из меню') {
      menuExtrasRemovals.push(ii);
    }
    delete nextPlanned[oldKey];
  }
  if (menuExtrasRemovals.length) {
    const menuCat = nextCustomData.categories.find((c) => c.id === 'planner_menu_extras');
    if (menuCat) {
      // Descending order so removing one doesn't shift the flat index of
      // another item still pending removal in this same pass.
      menuExtrasRemovals.sort((a, b) => b - a);
      for (const ii of menuExtrasRemovals) removeItemAtFlatIndex(menuCat, ii);
    }
  }

  return { customData: nextCustomData, planned: nextPlanned, menuKeys: Array.from(nextMenuKeys) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/planner/plannerShoppingUtils.test.js`
Expected: PASS (all describe blocks, including the new "reconciliation" block)

- [ ] **Step 5: Run the full planner test suite**

Run: `npx vitest run src/features/planner`
Expected: all planner test files pass — this includes `plannerApi.test.js` from Task 3 if that task has already landed, otherwise just the existing files.

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/plannerShoppingUtils.js src/features/planner/plannerShoppingUtils.test.js
git commit -m "fix(planner): reconcile Покупки when a recipe leaves the menu, without touching manual checks"
```

---

## Task 3: `resetShoppingData`

**Files:**
- Modify: `src/features/planner/plannerApi.js`
- Create: `src/features/planner/plannerApi.test.js` (this file doesn't exist yet)

**Interfaces:**
- Consumes: `savePlannerShopCustomData`, `savePlannerShopPlan`, `savePlannerShopBought`, `savePlannerPutawayPlan` (all already exist in `@/core/groupStore`), `savePlannerShopMenuKeys` from Task 1.
- Produces: `export async function resetShoppingData(studentId): Promise<void>` — consumed by Task 4 (`PlannerShoppingScreen.jsx`'s `handleRegenerate`) and Task 5 (`PlannerMenuScreen.jsx`'s reset handler).

- [ ] **Step 1: Write the failing test**

Create `src/features/planner/plannerApi.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resetShoppingData } from './plannerApi.js';
import {
  savePlannerShopCustomData, getPlannerShopCustomData,
  savePlannerShopPlan, getPlannerShopPlan,
  savePlannerShopBought, getPlannerShopBought,
  savePlannerPutawayPlan, getPlannerPutawayPlan,
  savePlannerShopMenuKeys, getPlannerShopMenuKeys,
} from '@/core/groupStore';

describe('resetShoppingData', () => {
  it('clears customData, planned, bought, putaway plan, and menu keys', async () => {
    const studentId = 'test-student-reset-1';
    await savePlannerShopCustomData(studentId, { categories: [{ id: 'x', name: 'X', icon: '📦', subgroups: [] }] });
    await savePlannerShopPlan(studentId, { 'X_0': true });
    await savePlannerShopBought(studentId, { 'X_0': true });
    await savePlannerPutawayPlan(studentId, { 'X_0': 'fridge' });
    await savePlannerShopMenuKeys(studentId, ['X_0']);

    await resetShoppingData(studentId);

    expect(await getPlannerShopCustomData(studentId)).toBeNull();
    expect(await getPlannerShopPlan(studentId)).toEqual({});
    expect(await getPlannerShopBought(studentId)).toEqual({});
    expect(await getPlannerPutawayPlan(studentId)).toEqual({});
    expect(await getPlannerShopMenuKeys(studentId)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/planner/plannerApi.test.js`
Expected: FAIL — `resetShoppingData` is not exported from `plannerApi.js` yet.

- [ ] **Step 3: Implement `resetShoppingData`**

In `src/features/planner/plannerApi.js`, change the import line:

```js
import { getRawRecipeTxt } from '@/core/groupStore';
```

to:

```js
import {
  getRawRecipeTxt,
  savePlannerShopCustomData, savePlannerShopPlan, savePlannerShopBought,
  savePlannerPutawayPlan, savePlannerShopMenuKeys,
} from '@/core/groupStore';
```

Then, after the existing `loadAllRecipes` function at the end of the file, add:

```js

// Clears the whole downstream shopping-list lifecycle for a student: the
// generated category list, what's checked, what's bought, where it's been
// put away, and which checks were menu-managed. Used both when starting a
// brand-new menu (Меню's "Начать меню заново") and when regenerating the
// list from the current menu (Покупки's "Пересоставить из рецептов") — the
// store list and shopping history are untouched by this on purpose.
export async function resetShoppingData(studentId) {
  await savePlannerShopCustomData(studentId, null);
  await savePlannerShopPlan(studentId, {});
  await savePlannerShopBought(studentId, {});
  await savePlannerPutawayPlan(studentId, {});
  await savePlannerShopMenuKeys(studentId, []);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/planner/plannerApi.test.js`
Expected: PASS

- [ ] **Step 5: Run the full planner test suite**

Run: `npx vitest run src/features/planner`
Expected: all planner tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/plannerApi.js src/features/planner/plannerApi.test.js
git commit -m "feat(planner): add resetShoppingData, a single comprehensive shopping-lifecycle reset"
```

---

## Task 4: Wire `menuKeys` and `resetShoppingData` into `PlannerShoppingScreen.jsx`

**Files:**
- Modify: `src/features/planner/PlannerShoppingScreen.jsx`

**Interfaces:**
- Consumes: `syncDecisionsIntoShoppingData(customData, planned, menuKeys, ingredientItems, ingredientDecisions)` (Task 2's new signature), `resetShoppingData(studentId)` (Task 3), `getPlannerShopMenuKeys`/`savePlannerShopMenuKeys` (Task 1).
- Produces: nothing new — this is an integration task.

- [ ] **Step 1: Update imports**

In `src/features/planner/PlannerShoppingScreen.jsx`, change:

```js
import {
  getRawRecipeTxt,
  getPlannerShopPlan, savePlannerShopPlan,
  getPlannerShopCustomData, savePlannerShopCustomData,
  getPlannerShopStores, savePlannerShopStores,
  getPlannerShopHistory, savePlannerShopHistory,
  getPlannerShopBought, savePlannerShopBought,
  savePlannerPutawayPlan,
} from '@/core/groupStore';
import { loadPlan, loadAllRecipes, PANTRY_ITEMS } from './plannerApi.js';
```

to:

```js
import {
  getRawRecipeTxt,
  getPlannerShopPlan, savePlannerShopPlan,
  getPlannerShopCustomData, savePlannerShopCustomData,
  getPlannerShopStores, savePlannerShopStores,
  getPlannerShopHistory, savePlannerShopHistory,
  getPlannerShopBought, savePlannerShopBought,
  getPlannerShopMenuKeys, savePlannerShopMenuKeys,
  savePlannerPutawayPlan,
} from '@/core/groupStore';
import { loadPlan, loadAllRecipes, resetShoppingData, PANTRY_ITEMS } from './plannerApi.js';
```

- [ ] **Step 2: Add `menuKeys` state**

Find the state declarations that include `const [bought, setBought] = useState({});` and add a sibling line right after it:

```js
  const [bought, setBought] = useState({});
  const [menuKeys, setMenuKeys] = useState([]);
```

- [ ] **Step 3: Load and reconcile `menuKeys` in `loadAndApply`'s re-sync branch**

Change:

```jsx
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

to:

```jsx
    if (!forceRegen) {
      const [savedCustom, savedPlan, savedBought, savedMenuKeys, currentPlan, allRecipes] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopPlan(studentId),
        getPlannerShopBought(studentId),
        getPlannerShopMenuKeys(studentId),
        loadPlan(studentId),
        loadAllRecipes(topicRecords),
      ]);
      if (savedCustom) {
        // Re-sync with Меню's Дома/Купить decisions on every load — not
        // just the first generation — so a decision changed after this
        // list already existed (or after a recipe was added to or removed
        // from the menu) still lands here: newly-decided "buy" ingredients
        // get added (via the same fuzzy match first generation uses,
        // falling back to "Из меню"), and menu-managed items whose
        // ingredient left the menu entirely get cleaned up — without
        // touching custom categories/items or manually-checked items the
        // decisions don't mention.
        const ingredientItems = currentPlan ? buildSelectedIngredientsSummary(currentPlan, allRecipes) : [];
        const { customData: syncedCustomData, planned: mergedPlanned, menuKeys: syncedMenuKeys } = currentPlan
          ? syncDecisionsIntoShoppingData(savedCustom, savedPlan ?? {}, savedMenuKeys ?? [], ingredientItems, currentPlan.ingredientDecisions ?? {})
          : { customData: savedCustom, planned: savedPlan ?? {}, menuKeys: savedMenuKeys ?? [] };
        setSteps(customDataToSteps(syncedCustomData));
        setIcons(syncedCustomData.categories.map((c) => c.icon));
        setPlanned(mergedPlanned);
        setBought(savedBought ?? {});
        setMenuKeys(syncedMenuKeys);
        setCustomData(syncedCustomData);
        setLoading(false);
        if (JSON.stringify(syncedCustomData) !== JSON.stringify(savedCustom)) {
          savePlannerShopCustomData(studentId, syncedCustomData).catch(() => {});
        }
        if (JSON.stringify(mergedPlanned) !== JSON.stringify(savedPlan ?? {})) {
          savePlannerShopPlan(studentId, mergedPlanned).catch(() => {});
        }
        if (JSON.stringify(syncedMenuKeys) !== JSON.stringify(savedMenuKeys ?? [])) {
          savePlannerShopMenuKeys(studentId, syncedMenuKeys).catch(() => {});
        }
        return;
      }
    }
```

- [ ] **Step 4: Seed `menuKeys` on first-ever generation**

Find the end of `loadAndApply`'s fresh-generation branch:

```jsx
    const { customData: newCustomData, plan: newPlan } = buildPlannerShoppingData(items);

    await savePlannerShopCustomData(studentId, newCustomData);
    await savePlannerShopPlan(studentId, newPlan);

    setSteps(customDataToSteps(newCustomData));
    setIcons(newCustomData.categories.map((c) => c.icon));
    setPlanned(newPlan);
    setBought((await getPlannerShopBought(studentId)) ?? {});
    setCustomData(newCustomData);
    setLoading(false);
  }
```

Change it to:

```jsx
    const { customData: newCustomData, plan: newPlan } = buildPlannerShoppingData(items);

    await savePlannerShopCustomData(studentId, newCustomData);
    await savePlannerShopPlan(studentId, newPlan);
    await savePlannerShopMenuKeys(studentId, Object.keys(newPlan));

    setSteps(customDataToSteps(newCustomData));
    setIcons(newCustomData.categories.map((c) => c.icon));
    setPlanned(newPlan);
    setBought((await getPlannerShopBought(studentId)) ?? {});
    setMenuKeys(Object.keys(newPlan));
    setCustomData(newCustomData);
    setLoading(false);
  }
```

- [ ] **Step 5: Replace `handleRegenerate`'s inline resets with `resetShoppingData`**

Change:

```jsx
  async function handleRegenerate() {
    await savePlannerShopCustomData(studentId, null);
    await savePlannerShopPlan(studentId, {});
    await savePlannerShopBought(studentId, {});
    await savePlannerPutawayPlan(studentId, {});
    setConfirmReset(false);
    setView('grid');
    setEditMode(false);
    setEditingCategoryId(null);
    loadAndApply(true);
  }
```

to:

```jsx
  async function handleRegenerate() {
    await resetShoppingData(studentId);
    setConfirmReset(false);
    setView('grid');
    setEditMode(false);
    setEditingCategoryId(null);
    loadAndApply(true);
  }
```

- [ ] **Step 6: Reset `menuKeys` in `clearAllChecks`**

Change:

```jsx
  function clearAllChecks() {
    const next = {};
    setPlanned(next);
    setBought(next);
    savePlannerShopPlan(studentId, next).catch(() => {});
    savePlannerShopBought(studentId, next).catch(() => {});
    savePlannerPutawayPlan(studentId, next).catch(() => {});
    setConfirmClear(false);
  }
```

to:

```jsx
  function clearAllChecks() {
    const next = {};
    setPlanned(next);
    setBought(next);
    setMenuKeys([]);
    savePlannerShopPlan(studentId, next).catch(() => {});
    savePlannerShopBought(studentId, next).catch(() => {});
    savePlannerPutawayPlan(studentId, next).catch(() => {});
    savePlannerShopMenuKeys(studentId, []).catch(() => {});
    setConfirmClear(false);
  }
```

- [ ] **Step 7: Reset `menuKeys` in `handleNewListAfterShop`**

Find:

```jsx
    await savePlannerShopPlan(studentId, {});
    await savePlannerShopBought(studentId, {});
    await savePlannerPutawayPlan(studentId, {});
    setPlanned({});
    setBought({});
    setModeView('plan');
    setView('grid');
  }
```

Change it to:

```jsx
    await savePlannerShopPlan(studentId, {});
    await savePlannerShopBought(studentId, {});
    await savePlannerPutawayPlan(studentId, {});
    await savePlannerShopMenuKeys(studentId, []);
    setPlanned({});
    setBought({});
    setMenuKeys([]);
    setModeView('plan');
    setView('grid');
  }
```

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run src/features/planner`
Expected: all planner tests pass.

- [ ] **Step 9: Run lint**

Run: `npx eslint src/features/planner/PlannerShoppingScreen.jsx`
Expected: only whatever pre-existing issues this file already had (the `loadAndApply` `set-state-in-effect` error and the unrelated empty-block-statement error identified in earlier work on this file) — no new errors from this task's changes.

- [ ] **Step 10: Manual verification**

Using the `run` skill: build a menu, decide ingredients, open Покупки (confirm first-generation checks land correctly, as before). Go back to Меню and remove a recipe whose ingredient isn't used by any other selected recipe; reopen Покупки and confirm that ingredient is now gone (unchecked if a permanent category item, fully removed if it had landed in "Из меню"). Manually check an unrelated item (add one via the ✏️ editor if needed) and repeat the recipe-removal step — confirm the manual item survives untouched. Use "Очистить весь список" and "Пересоставить из рецептов" and confirm both still work end to end.

- [ ] **Step 11: Commit**

```bash
git add src/features/planner/PlannerShoppingScreen.jsx
git commit -m "fix(planner): wire menu-managed reconciliation and shared reset into Покупки"
```

---

## Task 5: Cascade the reset from Меню's "Начать меню заново"

**Files:**
- Modify: `src/features/planner/PlannerMenuScreen.jsx`

**Interfaces:**
- Consumes: `resetShoppingData(studentId)` from Task 3.
- Produces: nothing new — final integration task.

- [ ] **Step 1: Import `resetShoppingData`**

In `src/features/planner/PlannerMenuScreen.jsx`, change:

```js
import { loadPlan, savePlan, sendPlanToStudent, loadAllRecipes, PANTRY_ITEMS } from './plannerApi.js';
```

to:

```js
import { loadPlan, savePlan, sendPlanToStudent, loadAllRecipes, resetShoppingData, PANTRY_ITEMS } from './plannerApi.js';
```

- [ ] **Step 2: Cascade the reset**

Change:

```jsx
        onReset={() => setPlan(resetPlan(activeStudentId))}
```

to:

```jsx
        onReset={() => {
          setPlan(resetPlan(activeStudentId));
          resetShoppingData(activeStudentId).catch(() => {});
        }}
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run src/features/planner`
Expected: all planner tests pass.

- [ ] **Step 4: Run lint**

Run: `npx eslint src/features/planner/PlannerMenuScreen.jsx`
Expected: no new errors introduced by this one-line change.

- [ ] **Step 5: Manual verification**

Using the `run` skill: build a menu with a shopping list already generated (some items checked/bought, maybe something placed via Раскладка). In Меню, tap "Начать меню заново" and confirm. Go to Покупки — confirm it's back to "no plan yet" (first-generation state, nothing pre-checked from the old menu). Go to Раскладка (hub card) — confirm it's locked/empty again. Open the shopping history (🕒) if any entries exist from before — confirm they're still there, untouched.

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/PlannerMenuScreen.jsx
git commit -m "feat(planner): cascade a full shopping-lifecycle reset from Начать меню заново"
```
