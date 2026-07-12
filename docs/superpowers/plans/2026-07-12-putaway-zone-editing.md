# Раскладка: редактируемые зоны хранения + синхронизация модуля — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a family override which storage zone a product belongs to (and rename/add zones), fix items that currently have no zone at all, and make the whole Planner shopping/putaway module (not just the new zone data) actually sync across devices.

**Architecture:** Two new per-student KV records (`plannerZoneCustomizations`, `plannerProductZoneOverrides`) plug into the existing `getZoneForProduct`/`buildPutawayQueue` pure functions as an extra resolution step. A new shared `ZonePickerSheet` bottom-sheet component is reused from three call sites: Настройки (rename/add zones), Список покупок's category editor (per-product override), and Раскладка (PIN-gated live fix + orphan-item flow). Sync is fixed by extending the existing `pushOp`/`pullXFromServer` pattern (already used for recipe data) to the entire `planner_*` KV prefix.

**Tech Stack:** React (JS, no TypeScript), Zustand (`useAppStore`), IndexedDB via `src/core/db.js` (`kv.get/set`), custom sync queue (`src/core/syncApi.js: pushOp`), Vitest for unit tests.

## Global Constraints

- Per-family data only — no global/cross-family storage (spec section "Модель данных").
- Base 6 zones (`ZONES` in `putawayLocations.js`) cannot be deleted or have their `id` changed — only `label` can be overridden (spec section 2, "Вне скоупа").
- Product-level override keys are normalized product names (`trim().toLowerCase()`), never `planKey` (spec section "Модель данных" — survives category/index changes).
- The gear/live-fix affordance in Раскладка (`PlannerPutawayScreen.jsx`) must be PIN-gated (`adultPinHash`); the affordance in Список покупок's edit mode must not be (spec section 3).
- Any new fixed/floating screen-edge element must use `var(--app-safe-top/right/bottom/left, 0px)` per `CLAUDE.md`'s iOS safe-area rule.
- No migration of historical `putawayPlan` zone references on zone deletion (spec section "Вне скоупа").

---

## File Map

- **Modify** `src/features/planner/putawayLocations.js` — `getZoneForProduct` gains an `overrides` param; add `getEffectiveZones`.
- **Modify** `src/features/planner/putawayLocations.test.js` — cover both additions.
- **Modify** `src/features/planner/putawayUtils.js` — `buildPutawayQueue` gains an `overrides` param; stops dropping zoneless (orphan) items.
- **Modify** `src/features/planner/putawayUtils.test.js` — update the now-invalid "excludes item with no zone" test; add override coverage.
- **Modify** `src/core/groupStore.js` — two new KV pairs (zone customizations, product zone overrides); `pushOp` added to all existing `planner_*` save functions; new `pullPlannerKvFromServer()`.
- **Modify** `src/features/home/HomeScreen.jsx` — call the new pull before the Planner tab's existing data reads; pass overrides into its own `buildPutawayQueue` call.
- **Create** `src/features/planner/ZonePickerSheet.jsx` — shared zone-picker bottom sheet.
- **Create** `src/features/settings/ZoneSettingsSection.jsx` — rename/add zones UI.
- **Modify** `src/features/settings/SettingsScreen.jsx` — render the new section.
- **Modify** `src/features/planner/PlannerShoppingScreen.jsx` — load zones/overrides; `CategoryEditor` gets a per-item zone chip wired to `ZonePickerSheet`.
- **Modify** `src/features/planner/PlannerPutawayScreen.jsx` — PIN-gated gear-fab live fix + orphan-item ("нужна помощь взрослого") flow.
- **Modify** `src/styles.css` — `.cat-editor-item-zone-chip*`, `.settings-zone-*` rules.
- **Modify** `src/features/planner/planner.css` — `.zone-picker-*`, `.putaway-zone-fix-fab`, `.putaway-orphan*` rules.

---

### Task 1: `getZoneForProduct` override param + `getEffectiveZones`

**Files:**
- Modify: `src/features/planner/putawayLocations.js`
- Test: `src/features/planner/putawayLocations.test.js`

**Interfaces:**
- Produces: `getZoneForProduct(categoryName, productName, overrides = {})` — `overrides` is `{ [normalizedProductName]: zoneId }`, checked before the existing `PRODUCT_ZONE_OVERRIDES`/`CATEGORY_DEFAULT_ZONE` chain.
- Produces: `getEffectiveZones(customizations = { renamed: {}, added: [] })` → `Array<{ id, label, icon }>` — base `ZONES` with `renamed` labels applied, followed by `added` zones, in that order.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/planner/putawayLocations.test.js` (after the existing `getZoneForProduct` describe block):

```js
describe('getZoneForProduct with family overrides', () => {
  it('prefers a family override over the category default', () => {
    expect(getZoneForProduct('Овощи', 'огурцы', { 'огурцы': 'veg' })).toBe('veg');
  });

  it('prefers a family override over the global product override', () => {
    expect(getZoneForProduct('Овощи', 'картошка', { 'картошка': 'fridge' })).toBe('fridge');
  });

  it('falls back to the normal chain when no override matches', () => {
    expect(getZoneForProduct('Овощи', 'огурцы', { 'помидоры': 'table' })).toBe('fridge');
  });

  it('matches overrides case-insensitively, same as global overrides', () => {
    expect(getZoneForProduct('Овощи', 'ОГУРЦЫ', { 'огурцы': 'veg' })).toBe('veg');
  });
});

describe('getEffectiveZones', () => {
  it('returns the base six zones unchanged when there are no customizations', () => {
    expect(getEffectiveZones()).toEqual(ZONES);
  });

  it('applies a renamed label without changing the id or icon', () => {
    const result = getEffectiveZones({ renamed: { pantry: 'Кладовка' }, added: [] });
    const pantry = result.find((z) => z.id === 'pantry');
    expect(pantry).toEqual({ id: 'pantry', label: 'Кладовка', icon: '🌾' });
  });

  it('appends added zones after the base six, in insertion order', () => {
    const added = [{ id: 'custom_1', label: 'Балкон', icon: '🪟' }];
    const result = getEffectiveZones({ renamed: {}, added });
    expect(result).toHaveLength(7);
    expect(result[6]).toEqual(added[0]);
  });
});
```

Add `getEffectiveZones` to the import line at the top of the test file:

```js
import { ZONES, getZoneForProduct, getEffectiveZones } from './putawayLocations.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/planner/putawayLocations.test.js`
Expected: FAIL — `getEffectiveZones is not a function` (and the override tests fail since `getZoneForProduct` doesn't accept a 3rd arg yet).

- [ ] **Step 3: Implement**

In `src/features/planner/putawayLocations.js`, replace the existing `getZoneForProduct` function (lines 44-48) with:

```js
export function getZoneForProduct(categoryName, productName, overrides = {}) {
  const norm = productName.trim().toLowerCase();
  if (overrides[norm]) return overrides[norm];
  if (PRODUCT_ZONE_OVERRIDES[norm]) return PRODUCT_ZONE_OVERRIDES[norm];
  return CATEGORY_DEFAULT_ZONE[categoryName] ?? null;
}

// Merges a family's zone customizations (renamed labels + added zones) into
// the base ZONES list. Base zone ids/icons never change — only the label can
// be overridden — so callers that key off `id` (getZoneForProduct, the
// hardcoded overrides above) are unaffected by anything done here.
export function getEffectiveZones(customizations = {}) {
  const renamed = customizations.renamed ?? {};
  const added = customizations.added ?? [];
  const base = ZONES.map((z) => ({ ...z, label: renamed[z.id] ?? z.label }));
  return [...base, ...added];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/planner/putawayLocations.test.js`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/putawayLocations.js src/features/planner/putawayLocations.test.js
git commit -m "feat(putaway): support family zone overrides and custom zones"
```

---

### Task 2: `buildPutawayQueue` override param + stop dropping orphan items

**Files:**
- Modify: `src/features/planner/putawayUtils.js`
- Test: `src/features/planner/putawayUtils.test.js`
- Modify: `src/features/home/HomeScreen.jsx:375` (call site — loads and passes overrides)
- Modify: `src/features/planner/PlannerPutawayScreen.jsx:57-68` (call site — loads and passes overrides)

**Interfaces:**
- Consumes: `getZoneForProduct(categoryName, productName, overrides)` from Task 1.
- Produces: `buildPutawayQueue(customData, bought, placed, overrides = {})` — now **includes** items whose zone can't be resolved, with `zoneId: null`, instead of silently dropping them. Callers must handle `zoneId === null` (Task 9 does this in `PlannerPutawayScreen.jsx`; `HomeScreen.jsx`'s `putawayDone` check already treats a non-empty `remainingQueue` as "not done", so a null-zone item correctly keeps it from being marked done with zero other changes needed there).

- [ ] **Step 1: Update the now-invalid test and add override coverage**

In `src/features/planner/putawayUtils.test.js`, replace this test:

```js
  it('excludes a bought item with no known zone (e.g. the "Из меню" catch-all category)', () => {
    const cd = customData([{ name: 'Из меню', items: ['непонятный ингредиент'] }]);
    const queue = buildPutawayQueue(cd, { 'Из меню_0': true }, {});
    expect(queue).toEqual([]);
  });
```

with:

```js
  it('includes a bought item with no known zone as an orphan (zoneId: null), not dropped', () => {
    const cd = customData([{ name: 'Из меню', items: ['непонятный ингредиент'] }]);
    const queue = buildPutawayQueue(cd, { 'Из меню_0': true }, {});
    expect(queue).toEqual([
      { key: 'Из меню_0', category: 'Из меню', product: 'непонятный ингредиент', zoneId: null },
    ]);
  });

  it('resolves an orphan item once a family override is provided', () => {
    const cd = customData([{ name: 'Из меню', items: ['непонятный ингредиент'] }]);
    const queue = buildPutawayQueue(cd, { 'Из меню_0': true }, {}, { 'непонятный ингредиент': 'pantry' });
    expect(queue[0].zoneId).toBe('pantry');
  });
```

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `npx vitest run src/features/planner/putawayUtils.test.js`
Expected: FAIL — the renamed test now expects a non-empty array but the current implementation returns `[]`; the override test fails since `buildPutawayQueue` doesn't accept a 4th arg yet.

- [ ] **Step 3: Implement**

In `src/features/planner/putawayUtils.js`, replace `buildPutawayQueue` (lines 9-23) with:

```js
export function buildPutawayQueue(customData, bought, placed, overrides = {}) {
  const steps = customDataToSteps(customData);
  const queue = [];
  for (const step of steps) {
    const category = sName(step);
    (step.items ?? []).forEach((product, ii) => {
      const key = planKey(category, ii);
      if (!bought[key] || placed[key]) return;
      const zoneId = getZoneForProduct(category, product, overrides);
      queue.push({ key, category, product, zoneId });
    });
  }
  return queue;
}
```

(Only change: the `if (!zoneId) return;` line is removed and `overrides` is threaded through to `getZoneForProduct`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/planner/putawayUtils.test.js`
Expected: PASS.

- [ ] **Step 5: Update the two call sites to load and pass overrides**

In `src/features/home/HomeScreen.jsx`, the import at line 20 becomes:

```js
import { getPlannerShopBought, getPlannerShopPlan, getPlannerShopCustomData, getPlannerPutawayPlan, getPlannerCycleHistory, getPlannerProductZoneOverrides, pullPlannerKvFromServer } from "@/core/groupStore";
```

(`pullPlannerKvFromServer` isn't used until Task 4 — importing it now avoids a second edit to this line later.)

Replace the effect at lines 363-380:

```js
  useEffect(() => {
    if (!student) { setBoughtCount(0); setShoppingDone(false); setPutawayDone(false); return; }
    Promise.all([
      getPlannerShopPlan(student.id),
      getPlannerShopBought(student.id),
      getPlannerShopCustomData(student.id),
      getPlannerPutawayPlan(student.id),
      isPendingReceiptResolved(student.id),
      getResolvedZoneIds(student.id),
      getPlannerProductZoneOverrides(student.id),
    ]).then(([planned, bought, customData, putawayPlan, receiptResolved, resolvedZones, zoneOverrides]) => {
      setBoughtCount(Object.keys(bought ?? {}).length);
      setShoppingDone(isShoppingDone(planned, bought) && receiptResolved);
      const remainingQueue = customData ? buildPutawayQueue(customData, bought ?? {}, putawayPlan ?? {}, zoneOverrides ?? {}) : [];
      const requiredZones = getRequiredZones(putawayPlan ?? {});
      const zonesResolved = requiredZones.every((id) => resolvedZones.includes(id));
      setPutawayDone(Object.keys(bought ?? {}).length > 0 && remainingQueue.length === 0 && zonesResolved);
    });
  }, [student?.id]);
```

In `src/features/planner/PlannerPutawayScreen.jsx`, the import at line 3 becomes:

```js
import { getPlannerShopCustomData, getPlannerShopBought, getPlannerPutawayPlan, savePlannerPutawayPlan, getPlannerProductZoneOverrides } from '@/core/groupStore';
```

Replace the load effect at lines 52-73:

```js
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [customData, bought, plan, zoneOverrides] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopBought(studentId),
        getPlannerPutawayPlan(studentId),
        getPlannerProductZoneOverrides(studentId),
      ]);
      if (cancelled) return;
      const safePlan = plan ?? {};
      const builtQueue = customData ? buildPutawayQueue(customData, bought ?? {}, safePlan, zoneOverrides ?? {}) : [];
      setQueue(builtQueue);
      setPutawayPlan(safePlan);
      setDoneCount(Object.keys(safePlan).length);
      setTotalCount(Object.keys(safePlan).length + builtQueue.length);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [studentId]);
```

(This task only threads `zoneOverrides` through the initial load so the queue is correct from the start — Task 8/9 add the `overrides` React state used for *live* edits within the screen.)

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open the app, pick a student with an existing shopping plan that includes at least one item from a category with no default zone (e.g. add a custom category via Список покупок's "+ Добавить категорию" and mark one of its items bought in "В магазине"). Confirm the Раскладка hub card no longer silently shows "done" — it's fine that the screen itself has no orphan-handling UI yet (Task 9 adds that); this step is only confirming the item isn't silently dropped from `totalCount`.

- [ ] **Step 7: Commit**

```bash
git add src/features/planner/putawayUtils.js src/features/planner/putawayUtils.test.js src/features/home/HomeScreen.jsx src/features/planner/PlannerPutawayScreen.jsx
git commit -m "feat(putaway): include zoneless items in the queue instead of dropping them"
```

---

### Task 3: New KV storage — zone customizations & product zone overrides

**Files:**
- Modify: `src/core/groupStore.js`

**Interfaces:**
- Produces: `getPlannerZoneCustomizations(studentId)` → `Promise<{ renamed: object, added: array }>` (defaults to `{ renamed: {}, added: [] }`).
- Produces: `savePlannerZoneCustomizations(studentId, customizations)` → `Promise<void>`, persists locally and pushes to server.
- Produces: `getPlannerProductZoneOverrides(studentId)` → `Promise<object>` (defaults to `{}`).
- Produces: `savePlannerProductZoneOverrides(studentId, overrides)` → `Promise<void>`, persists locally and pushes to server.

- [ ] **Step 1: Implement**

In `src/core/groupStore.js`, add after the `savePlannerCycleHistory` function (after line 316, before the `// ─── Safe code` comment on line 318):

```js
// ─── Planner zone customizations (Раскладка: family-renamed/added zones) ──

const plannerZoneCustomizationsKey = (sid) => `planner_zone_customizations_${sid}`;

export async function getPlannerZoneCustomizations(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerZoneCustomizationsKey(studentId))) ?? { renamed: {}, added: [] };
}

export async function savePlannerZoneCustomizations(studentId, customizations) {
  const db = await getDb();
  const key = plannerZoneCustomizationsKey(studentId);
  await kv.set(db, key, customizations);
  pushOp("kv.upsert", { key, value: customizations }).catch(() => {});
}

// ─── Planner product zone overrides (family fix for one product's zone) ───

const plannerProductZoneOverridesKey = (sid) => `planner_product_zone_overrides_${sid}`;

export async function getPlannerProductZoneOverrides(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerProductZoneOverridesKey(studentId))) ?? {};
}

export async function savePlannerProductZoneOverrides(studentId, overrides) {
  const db = await getDb();
  const key = plannerProductZoneOverridesKey(studentId);
  await kv.set(db, key, overrides);
  pushOp("kv.upsert", { key, value: overrides }).catch(() => {});
}
```

- [ ] **Step 2: Manual verification**

Run: `npx vitest run` (full suite) to confirm nothing else broke from the addition.
Expected: all existing tests still PASS (no tests reference these new functions yet).

- [ ] **Step 3: Commit**

```bash
git add src/core/groupStore.js
git commit -m "feat(planner): add zone customizations and product zone override KV storage"
```

---

### Task 4: Sync the whole Planner shopping/putaway module

**Files:**
- Modify: `src/core/groupStore.js`
- Modify: `src/features/home/HomeScreen.jsx`

**Interfaces:**
- Produces: `pullPlannerKvFromServer()` → `Promise<void>`, same shape as the existing `pullRecipeKvFromServer()` (silently no-ops offline/unauthenticated).
- Consumes (from Task 2's HomeScreen edit): the `pullPlannerKvFromServer` import already added to `HomeScreen.jsx`'s groupStore import line.

- [ ] **Step 1: Add `pushOp` to every existing Planner shopping save function**

In `src/core/groupStore.js`, these nine functions currently call `kv.set` with no `pushOp`. Change each to match the pattern already used by `saveRecipeSettings` (lines 22-26).

Replace lines 207-210:
```js
export async function savePlannerShopPlan(studentId, plan) {
  const db = await getDb();
  const key = plannerShopPlanKey(studentId);
  await kv.set(db, key, plan);
  pushOp("kv.upsert", { key, value: plan }).catch(() => {});
}
```

Replace lines 217-220:
```js
export async function savePlannerShopCustomData(studentId, data) {
  const db = await getDb();
  const key = plannerShopCustomKey(studentId);
  await kv.set(db, key, data);
  pushOp("kv.upsert", { key, value: data }).catch(() => {});
}
```

Replace lines 233-236:
```js
export async function savePlannerShopBought(studentId, bought) {
  const db = await getDb();
  const key = plannerShopBoughtKey(studentId);
  await kv.set(db, key, bought);
  pushOp("kv.upsert", { key, value: bought }).catch(() => {});
}
```

Replace lines 249-252:
```js
export async function savePlannerPutawayPlan(studentId, plan) {
  const db = await getDb();
  const key = plannerPutawayPlanKey(studentId);
  await kv.set(db, key, plan);
  pushOp("kv.upsert", { key, value: plan }).catch(() => {});
}
```

Replace lines 267-270:
```js
export async function savePlannerShopMenuKeys(studentId, keys) {
  const db = await getDb();
  const key = plannerShopMenuKeysKey(studentId);
  await kv.set(db, key, keys);
  pushOp("kv.upsert", { key, value: keys }).catch(() => {});
}
```

Replace lines 280-283:
```js
export async function savePlannerShopStores(studentId, stores) {
  const db = await getDb();
  const key = plannerShopStoresKey(studentId);
  await kv.set(db, key, stores);
  pushOp("kv.upsert", { key, value: stores }).catch(() => {});
}
```

Replace lines 290-293:
```js
export async function savePlannerShopHistory(studentId, history) {
  const db = await getDb();
  const key = plannerShopHistoryKey(studentId);
  await kv.set(db, key, history);
  pushOp("kv.upsert", { key, value: history }).catch(() => {});
}
```

Replace lines 303-306:
```js
export async function savePlannerCycleTrips(studentId, trips) {
  const db = await getDb();
  const key = plannerCycleTripsKey(studentId);
  await kv.set(db, key, trips);
  pushOp("kv.upsert", { key, value: trips }).catch(() => {});
}
```

Replace lines 313-316:
```js
export async function savePlannerCycleHistory(studentId, history) {
  const db = await getDb();
  const key = plannerCycleHistoryKey(studentId);
  await kv.set(db, key, history);
  pushOp("kv.upsert", { key, value: history }).catch(() => {});
}
```

- [ ] **Step 2: Add `pullPlannerKvFromServer`**

In `src/core/groupStore.js`, add after `pullRecipeKvFromServer` (after line 381):

```js
const PLANNER_KV_PREFIX = "planner_";

export async function pullPlannerKvFromServer() {
  try {
    const { kv: items } = await api.get(`/account/kv?prefix=${encodeURIComponent(PLANNER_KV_PREFIX)}`);
    if (!Array.isArray(items) || !items.length) return;
    const db = await getDb();
    for (const { key, value } of items) {
      await kv.set(db, key, value);
    }
  } catch {
    // Offline или не авторизован — пропускаем тихо, как pullRecipeKvFromServer
  }
}
```

- [ ] **Step 2b: Verify the prefix also matches the two new Task 3 keys**

`planner_zone_customizations_${sid}` and `planner_product_zone_overrides_${sid}` both start with `planner_`, so no separate wiring is needed for them — confirm by reading the two key functions added in Task 3 and checking they both start with the literal string `planner_`.

- [ ] **Step 3: Call the pull before the Planner tab's first read**

In `src/features/home/HomeScreen.jsx`, replace the effect at lines 353-356:

```js
  useEffect(() => {
    if (!student) { setExistingPlan(null); return; }
    pullPlannerKvFromServer().then(() => loadPlan(student.id)).then(setExistingPlan);
  }, [student?.id]);
```

- [ ] **Step 4: Manual verification**

1. Run: `npm run dev`, log in, pick a student, open Список покупок, add a custom item, go back to Home.
2. Open the same account in a second browser (or an incognito window logged into the same account) and select the same student.
3. Confirm the custom item shows up in that second session's Список покупок without needing a manual refresh trigger beyond navigating into the Planner tab.
4. Check the Network tab: confirm a `GET /account/kv?prefix=planner_` request fires when the Planner tab mounts, and `POST` (or whatever `pushOp`'s underlying transport is — check `src/core/syncApi.js: flushQueue`) requests fire after each save.

- [ ] **Step 5: Commit**

```bash
git add src/core/groupStore.js src/features/home/HomeScreen.jsx
git commit -m "fix(planner): sync shopping/putaway module data across devices"
```

---

### Task 5: Shared `ZonePickerSheet` component

**Files:**
- Create: `src/features/planner/ZonePickerSheet.jsx`

**Interfaces:**
- Produces: `ZonePickerSheet({ zones, currentZoneId, title, onSelect, onClose })` — `zones: Array<{ id, label, icon }>`, `currentZoneId: string|null`, `title: string`, `onSelect: (zoneId: string) => void`, `onClose: () => void`. Renders as a `.portions-sheet` bottom sheet (same shell already used by `PlannerPutawayScreen.jsx`'s zone-photo editor).

- [ ] **Step 1: Implement**

Create `src/features/planner/ZonePickerSheet.jsx`:

```jsx
import './planner.css';

export default function ZonePickerSheet({ zones, currentZoneId = null, title, onSelect, onClose }) {
  return (
    <div className="portions-sheet-backdrop" onClick={onClose}>
      <div className="portions-sheet zone-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="portions-sheet__handle" />
        <div className="portions-sheet__title">{title}</div>
        <div className="zone-picker-list">
          {zones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              className={`zone-picker-item${zone.id === currentZoneId ? ' zone-picker-item--active' : ''}`}
              onClick={() => onSelect(zone.id)}
            >
              <span className="zone-picker-item__icon">{zone.icon}</span>
              <span className="zone-picker-item__label">{zone.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS**

In `src/features/planner/planner.css`, add after the `.portions-sheet__confirm` block (near line 487-503):

```css
.zone-picker-list {
  display: flex; flex-direction: column; gap: 4px;
  padding: 4px 4px 8px;
  max-height: 50vh; overflow-y: auto;
}
.zone-picker-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 12px;
  border: 1px solid transparent; background: none;
  font-size: 1rem; text-align: left; cursor: pointer;
}
.zone-picker-item--active {
  border-color: #2a8060; background: #eafaf3;
}
.zone-picker-item__icon { font-size: 1.4rem; }
.zone-picker-item__label { flex: 1; }
```

- [ ] **Step 3: Manual verification**

This component has no standalone screen yet — verified visually once Tasks 7/8 wire it in. Skip a standalone check here; confirm only that the file has no syntax errors:

Run: `npx vite build --mode development 2>&1 | head -50` (or `npm run build` if that's the project's build command) and confirm no error mentions `ZonePickerSheet.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/planner/ZonePickerSheet.jsx src/features/planner/planner.css
git commit -m "feat(planner): add shared ZonePickerSheet component"
```

---

### Task 6: Settings — «Зоны хранения» section

**Files:**
- Create: `src/features/settings/ZoneSettingsSection.jsx`
- Modify: `src/features/settings/SettingsScreen.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `getPlannerZoneCustomizations`/`savePlannerZoneCustomizations` (Task 3), `getEffectiveZones`/`ZONES` (Task 1).
- Produces: `ZoneSettingsSection()` (default export, no props — reads `activeStudentId` from `useAppStore` itself, same pattern every other Settings sub-section already uses implicitly via the parent).

- [ ] **Step 1: Implement**

Create `src/features/settings/ZoneSettingsSection.jsx`:

```jsx
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getPlannerZoneCustomizations, savePlannerZoneCustomizations } from "@/core/groupStore";
import { ZONES, getEffectiveZones } from "@/features/planner/putawayLocations";

const ADD_ZONE_ICONS = ['📦', '🧺', '🚪', '🛁', '🪣', '🧊', '🗄️', '🧴', '🍬', '🪟'];

export default function ZoneSettingsSection() {
  const studentId = useAppStore((s) => s.activeStudentId);
  const [customizations, setCustomizations] = useState({ renamed: {}, added: [] });
  const [loaded, setLoaded] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [editingVal, setEditingVal] = useState('');
  const [addingZone, setAddingZone] = useState(false);
  const [newZoneLabel, setNewZoneLabel] = useState('');
  const [newZoneIcon, setNewZoneIcon] = useState(ADD_ZONE_ICONS[0]);

  useEffect(() => {
    if (!studentId) { setLoaded(false); return; }
    let cancelled = false;
    getPlannerZoneCustomizations(studentId).then((data) => {
      if (!cancelled) { setCustomizations(data); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [studentId]);

  function persist(next) {
    setCustomizations(next);
    savePlannerZoneCustomizations(studentId, next).catch(() => {});
  }

  function saveRename() {
    const label = editingVal.trim();
    if (label) {
      persist({ ...customizations, renamed: { ...customizations.renamed, [editingZoneId]: label } });
    }
    setEditingZoneId(null);
  }

  function addZone() {
    const label = newZoneLabel.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    persist({ ...customizations, added: [...customizations.added, { id, label, icon: newZoneIcon }] });
    setAddingZone(false);
    setNewZoneLabel('');
    setNewZoneIcon(ADD_ZONE_ICONS[0]);
  }

  function removeZone(zoneId) {
    persist({ ...customizations, added: customizations.added.filter((z) => z.id !== zoneId) });
  }

  if (!studentId || !loaded) return null;

  const zones = getEffectiveZones(customizations);
  const baseIds = new Set(ZONES.map((z) => z.id));

  return (
    <div className="settings-section">
      <div className="settings-section-title">Зоны хранения</div>
      {zones.map((zone) => (
        <div key={zone.id} className="settings-row settings-row--zone">
          <span className="settings-zone-icon">{zone.icon}</span>
          {editingZoneId === zone.id ? (
            <input
              className="settings-zone-name-input"
              autoFocus
              value={editingVal}
              onChange={(e) => setEditingVal(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            />
          ) : (
            <span
              className="settings-row__label settings-zone-name"
              onClick={() => { setEditingZoneId(zone.id); setEditingVal(zone.label); }}
            >
              {zone.label}
            </span>
          )}
          {!baseIds.has(zone.id) && (
            <button className="settings-zone-del-btn" onClick={() => removeZone(zone.id)} aria-label="Удалить зону">×</button>
          )}
        </div>
      ))}

      {addingZone ? (
        <div className="settings-row settings-row--add-zone">
          <div className="settings-zone-icon-picker">
            {ADD_ZONE_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`settings-zone-icon-option${newZoneIcon === icon ? ' settings-zone-icon-option--active' : ''}`}
                onClick={() => setNewZoneIcon(icon)}
              >
                {icon}
              </button>
            ))}
          </div>
          <input
            className="settings-zone-name-input"
            autoFocus
            value={newZoneLabel}
            onChange={(e) => setNewZoneLabel(e.target.value)}
            placeholder="Название зоны"
            onKeyDown={(e) => e.key === 'Enter' && addZone()}
          />
          <button className="link-btn" onClick={addZone}>Добавить</button>
        </div>
      ) : (
        <div className="settings-row">
          <button className="link-btn" onClick={() => setAddingZone(true)}>+ Добавить зону</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into SettingsScreen**

In `src/features/settings/SettingsScreen.jsx`, add the import (near line 9):

```js
import ZoneSettingsSection from "./ZoneSettingsSection";
```

Add `<ZoneSettingsSection />` right after the "Управление" section's closing `</div>` (after line 156, before the outer `</div>` on line 158):

```jsx
        <ZoneSettingsSection />

      </div>
```

- [ ] **Step 3: Add CSS**

In `src/styles.css`, add after `.settings-row` (line 16207):

```css
.settings-row--zone { gap: 10px; }
.settings-zone-icon { font-size: 1.3rem; flex-shrink: 0; }
.settings-zone-name { flex: 1; cursor: pointer; }
.settings-zone-name-input {
  flex: 1; font-size: 1rem; border: none; border-bottom: 1.5px solid #2a8060;
  outline: none; background: transparent; min-width: 0;
}
.settings-zone-del-btn {
  background: none; border: 1px solid #f5c6c2; color: #c0392b;
  border-radius: 6px; width: 24px; height: 24px; cursor: pointer;
  font-size: 0.9rem; font-weight: 700; flex-shrink: 0;
}
.settings-row--add-zone { flex-direction: column; align-items: stretch; gap: 8px; }
.settings-zone-icon-picker { display: flex; flex-wrap: wrap; gap: 6px; }
.settings-zone-icon-option {
  width: 34px; height: 34px; border-radius: 8px; border: 1px solid #e0ddd6;
  background: #fff; font-size: 1.1rem; cursor: pointer;
}
.settings-zone-icon-option--active { border-color: #2a8060; background: #eafaf3; }
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open Настройки, confirm the new «Зоны хранения» section shows the 6 base zones. Rename one (tap its label, type a new value, tap elsewhere) and confirm it persists across a page reload. Add a custom zone with a chosen icon, confirm it appears at the bottom of the list and can be deleted (base zones must not show a delete button).

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/ZoneSettingsSection.jsx src/features/settings/SettingsScreen.jsx src/styles.css
git commit -m "feat(settings): add zone rename/add section"
```

---

### Task 7: Live zone fix in Список покупок's category editor

**Files:**
- Modify: `src/features/planner/PlannerShoppingScreen.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `getPlannerProductZoneOverrides`/`savePlannerProductZoneOverrides` (Task 3), `getPlannerZoneCustomizations` (Task 3), `getEffectiveZones`/`getZoneForProduct` (Task 1), `ZonePickerSheet` (Task 5).

- [ ] **Step 1: Load zones/overrides at the top level**

In `src/features/planner/PlannerShoppingScreen.jsx`, extend the groupStore import (lines 6-14) to add:

```js
  getPlannerProductZoneOverrides, savePlannerProductZoneOverrides, getPlannerZoneCustomizations,
```

Add a new import after the `plannerShoppingUtils.js` import (line 19):

```js
import { getEffectiveZones, ZONES } from './putawayLocations.js';
import ZonePickerSheet from './ZonePickerSheet.jsx';
```

In the main component, add new state after `const [showActionsSheet, setShowActionsSheet] = useState(false);` (line 955):

```js
  const [zoneOverrides, setZoneOverrides] = useState({});
  const [effectiveZones, setEffectiveZones] = useState(ZONES);
```

Add a new effect right after the existing store-loading effect (after line 973):

```js
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    Promise.all([
      getPlannerProductZoneOverrides(studentId),
      getPlannerZoneCustomizations(studentId),
    ]).then(([overridesData, customizations]) => {
      if (cancelled) return;
      setZoneOverrides(overridesData ?? {});
      setEffectiveZones(getEffectiveZones(customizations));
    });
    return () => { cancelled = true; };
  }, [studentId]);

  async function handleZoneOverrideChange(productName, zoneId) {
    const norm = productName.trim().toLowerCase();
    const next = { ...zoneOverrides, [norm]: zoneId };
    setZoneOverrides(next);
    await savePlannerProductZoneOverrides(studentId, next);
  }
```

- [ ] **Step 2: Pass the new props into `CategoryEditor`**

Replace the `CategoryEditor` invocation (lines 1263-1268):

```jsx
          <CategoryEditor
            category={cat}
            onSave={handleCategoryEditorSave}
            onDelete={() => handleDeleteCategory(editingCategoryId)}
            onBack={() => setEditingCategoryId(null)}
            zones={effectiveZones}
            zoneOverrides={zoneOverrides}
            onZoneOverrideChange={handleZoneOverrideChange}
          />
```

- [ ] **Step 3: Add `getZoneForProduct` import for `CategoryEditor`'s use**

Update the import added in Step 1 to:

```js
import { getEffectiveZones, getZoneForProduct, ZONES } from './putawayLocations.js';
```

- [ ] **Step 4: Add the zone chip inside `CategoryEditor`**

Change the `CategoryEditor` function signature (line 221):

```js
function CategoryEditor({ category, onSave, onDelete, onBack, zones, zoneOverrides, onZoneOverrideChange }) {
```

Add new local state right after `const [addingItemVal, setAddingItemVal] = useState('');` (line 229):

```js
  const [zonePickerFor, setZonePickerFor] = useState(null); // { sgIdx, itemIdx } | null
```

Replace the item `<li>` block (lines 372-393) — insert the zone chip between the name/input and the actions div:

```jsx
                <li key={itemIdx} className="cat-editor-item">
                  {editingItem?.sgIdx === sgIdx && editingItem?.itemIdx === itemIdx ? (
                    <input
                      className="cat-editor-item-input"
                      autoFocus
                      value={editingItem.val}
                      onChange={(e) => setEditingItem({ ...editingItem, val: e.target.value })}
                      onBlur={() => saveItemBlur(sgIdx, itemIdx)}
                      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                    />
                  ) : (
                    <span className="cat-editor-item-name" onClick={() => setEditingItem({ sgIdx, itemIdx, val: item })}>
                      {item}
                    </span>
                  )}
                  {(() => {
                    const zid = getZoneForProduct(cat.name, item, zoneOverrides);
                    const z = zones.find((zz) => zz.id === zid);
                    return (
                      <button
                        type="button"
                        className={`cat-editor-item-zone-chip${z ? '' : ' cat-editor-item-zone-chip--unset'}`}
                        onClick={() => setZonePickerFor({ sgIdx, itemIdx })}
                        aria-label="Место хранения"
                      >
                        {z ? z.icon : '❓'}
                      </button>
                    );
                  })()}
                  <div className="cat-editor-item-actions">
                    <button className="cat-editor-arrow-btn" onClick={() => moveItem(sgIdx, itemIdx, -1)} disabled={itemIdx === 0}><ArrowUpSmallIcon /></button>
                    <button className="cat-editor-arrow-btn" onClick={() => moveItem(sgIdx, itemIdx, 1)} disabled={itemIdx === sg.items.length - 1}><ArrowDownSmallIcon /></button>
                    <button className="cat-editor-item-del-btn" onClick={() => deleteItem(sgIdx, itemIdx)} aria-label="Удалить">×</button>
                  </div>
                </li>
```

Add the picker sheet render right before the `EmojiPicker` render at the end of `CategoryEditor` (before line 433's `{showEmojiFor !== null && (`):

```jsx
      {zonePickerFor && (() => {
        const sg = cat.subgroups[zonePickerFor.sgIdx];
        const productName = sg.items[zonePickerFor.itemIdx];
        return (
          <ZonePickerSheet
            zones={zones}
            currentZoneId={getZoneForProduct(cat.name, productName, zoneOverrides)}
            title={`Место для «${productName}»`}
            onSelect={(zoneId) => {
              onZoneOverrideChange(productName, zoneId);
              setZonePickerFor(null);
            }}
            onClose={() => setZonePickerFor(null)}
          />
        );
      })()}
```

- [ ] **Step 5: Add CSS**

In `src/styles.css`, add after `.cat-editor-item-actions` (line 20277):

```css
.cat-editor-item-zone-chip {
  flex-shrink: 0; width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid #e0ddd6; background: #fff; font-size: 0.95rem;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.cat-editor-item-zone-chip--unset { border-color: #f0c419; background: #fff9e6; }
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open Список покупок, enter edit mode (✏️), open any category, confirm each item shows a small zone-icon chip. Tap one, confirm the `ZonePickerSheet` opens with the current zone highlighted, pick a different zone, confirm the chip icon updates immediately. Reload the page and re-open the same category — confirm the override persisted (chip still shows the new icon). Add a brand-new item via "+ Добавить товар" in a category whose default zone is `null` (e.g. add a nonsense item under "Из меню" if that category exists, or create a new custom category) and confirm its chip shows the "❓ unset" style.

- [ ] **Step 7: Commit**

```bash
git add src/features/planner/PlannerShoppingScreen.jsx src/styles.css
git commit -m "feat(planner): let a family override a product's storage zone from the shopping list editor"
```

---

### Task 8: PIN-gated live zone fix in Раскладка

**Files:**
- Modify: `src/features/planner/PlannerPutawayScreen.jsx`
- Modify: `src/features/planner/planner.css`

**Interfaces:**
- Consumes: `ZonePickerSheet` (Task 5), `getEffectiveZones` (Task 1), `PinGateModal` (existing, `src/shared/components/PinGateModal.jsx`), `savePlannerProductZoneOverrides` (Task 3).
- Produces: local `overrides`/`effectiveZones` React state and a `saveZoneOverride(productName, zoneId)` helper that Task 9 (orphan items) also calls.

- [ ] **Step 1: Add imports**

In `src/features/planner/PlannerPutawayScreen.jsx`, replace the imports at lines 1-9:

```jsx
import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getDb, kv } from '@/core/db';
import { api } from '@/core/api';
import {
  getPlannerShopCustomData, getPlannerShopBought, getPlannerPutawayPlan, savePlannerPutawayPlan,
  getPlannerProductZoneOverrides, savePlannerProductZoneOverrides, getPlannerZoneCustomizations,
} from '@/core/groupStore';
import { buildPutawayQueue, getRequiredZones } from './putawayUtils.js';
import { ZONES, getEffectiveZones } from './putawayLocations.js';
import { savePendingZonePhoto, markPendingZoneSkipped, getResolvedZoneIds, getZoneReferencePhoto, saveZoneReferencePhoto } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
import ZonePickerSheet from './ZonePickerSheet.jsx';
import PinGateModal from '@/shared/components/PinGateModal';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import './planner.css';
```

- [ ] **Step 2: Add state and PIN/settings wiring**

Add after `const studentId = useAppStore((s) => s.activeStudentId);` (line 38):

```js
  const adultPinHash = useAppStore((s) => s.settings.adultPinHash);
  const patchSettings = useAppStore((s) => s.patchSettings);
```

Add after `const [editingZoneId, setEditingZoneId] = useState(null);` (line 50):

```js
  const [overrides, setOverrides] = useState({});
  const [effectiveZones, setEffectiveZones] = useState(ZONES);
  const [zoneFixGateOpen, setZoneFixGateOpen] = useState(false);
  const [zonePickerOpen, setZonePickerOpen] = useState(false);
```

- [ ] **Step 3: Load overrides/zones and expose them for `buildPutawayQueue`**

Replace the load effect (from Task 2, currently reading 4 values) to also load zone customizations and keep `overrides` in state:

```jsx
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [customData, bought, plan, zoneOverrides, zoneCustomizations] = await Promise.all([
        getPlannerShopCustomData(studentId),
        getPlannerShopBought(studentId),
        getPlannerPutawayPlan(studentId),
        getPlannerProductZoneOverrides(studentId),
        getPlannerZoneCustomizations(studentId),
      ]);
      if (cancelled) return;
      const safePlan = plan ?? {};
      const safeOverrides = zoneOverrides ?? {};
      const builtQueue = customData ? buildPutawayQueue(customData, bought ?? {}, safePlan, safeOverrides) : [];
      setQueue(builtQueue);
      setPutawayPlan(safePlan);
      setOverrides(safeOverrides);
      setEffectiveZones(getEffectiveZones(zoneCustomizations));
      setDoneCount(Object.keys(safePlan).length);
      setTotalCount(Object.keys(safePlan).length + builtQueue.length);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [studentId]);
```

- [ ] **Step 4: Add the override-save helper and PIN setup handler**

Add after the `handlePick` function (after line 105):

```js
  async function saveZoneOverride(productName, zoneId) {
    const norm = productName.trim().toLowerCase();
    const next = { ...overrides, [norm]: zoneId };
    setOverrides(next);
    await savePlannerProductZoneOverrides(studentId, next);
  }

  function handleZoneFixSelect(zoneId) {
    if (!current) return;
    saveZoneOverride(current.product, zoneId).catch(() => {});
    setQueue((q) => q.map((item, i) => (i === 0 ? { ...item, zoneId } : item)));
    setZonePickerOpen(false);
  }

  async function handleSetPin(hash) {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }
```

- [ ] **Step 5: Add the gear-fab and PIN gate + picker sheet**

Inside the `current` branch (the `) : (` at line 164, which opens the "there's a current item" view), add the gear button right after `<div className="putaway-body">` (line 165):

```jsx
        <div className="putaway-body">
          <button
            type="button"
            className="putaway-zone-fix-fab"
            onClick={() => setZoneFixGateOpen(true)}
            aria-label="Исправить место для товара"
          >
            ⚙️
          </button>

          <div className="putaway-progress">Продукт {doneCount + 1} из {totalCount}</div>
```

(Everything below `<div className="putaway-progress">` in that branch is unchanged.)

Add the PIN gate and picker sheet renders at the end of the component, right after the existing `{editingZoneId && (...)}` block (after line 231, before the closing `</div>` on line 232):

```jsx
      {zoneFixGateOpen && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={() => { setZoneFixGateOpen(false); setZonePickerOpen(true); }}
          onSetPin={handleSetPin}
          onCancel={() => setZoneFixGateOpen(false)}
        />
      )}
      {zonePickerOpen && current && (
        <ZonePickerSheet
          zones={effectiveZones}
          currentZoneId={current.zoneId}
          title={`Место для «${current.product}»`}
          onSelect={handleZoneFixSelect}
          onClose={() => setZonePickerOpen(false)}
        />
      )}
```

- [ ] **Step 6: Add CSS (safe-area aware)**

In `src/features/planner/planner.css`, add near the other `.putaway-*` rules:

```css
.putaway-zone-fix-fab {
  position: fixed;
  top: calc(12px + var(--app-safe-top, 0px));
  right: calc(12px + var(--app-safe-right, 0px));
  width: 40px; height: 40px; border-radius: 12px;
  border: 1px solid #d8cbc0; background: rgba(255, 255, 255, 0.94);
  font-size: 1.1rem; z-index: 300;
  box-shadow: 0 10px 24px rgba(71, 61, 48, 0.14);
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, get to Раскладка with at least one item in the queue. Confirm the gear icon appears in the top-right corner, respecting the safe area (test via the devtools snippet from `CLAUDE.md`'s iOS safe-area section — set `--app-safe-top`/`--app-safe-right` and confirm the fab moves down/left accordingly). Tap it, confirm the PIN gate appears (set a PIN if none exists yet), enter it, confirm the `ZonePickerSheet` opens with the current item's zone highlighted. Pick a different zone, confirm the on-screen 6-zone game area now expects that new zone as correct (tap it, confirm it registers as correct). Reload and confirm the override persisted (re-open Раскладка with a newly-bought instance of the same product, if feasible, or check via Список покупок's chip from Task 7 that the override is shared).

- [ ] **Step 8: Commit**

```bash
git add src/features/planner/PlannerPutawayScreen.jsx src/features/planner/planner.css
git commit -m "feat(putaway): add PIN-gated live zone fix for the current item"
```

---

### Task 9: Orphan-item flow ("нужна помощь взрослого")

**Files:**
- Modify: `src/features/planner/PlannerPutawayScreen.jsx`
- Modify: `src/features/planner/planner.css`

**Interfaces:**
- Consumes: everything from Task 8 (`zoneFixGateOpen`, `zonePickerOpen`, `handleZoneFixSelect`, `saveZoneOverride`).

- [ ] **Step 1: Branch the current-item view on `current.zoneId === null`**

In the `current` branch's body (added to in Task 8), replace the section from `<div className="putaway-card">` through the closing `</div>` of `.putaway-zones`/`.putaway-hint` (lines 168-207 in the original file) with a conditional:

```jsx
          {current.zoneId === null ? (
            <div className="putaway-orphan">
              <div className="putaway-card">
                <div className="putaway-card__icon">❓</div>
                <div className="putaway-card__name">{current.product}</div>
              </div>
              <div className="putaway-orphan__hint">Нужна помощь взрослого — выбери место для этого продукта</div>
              <button type="button" className="putaway-orphan__fix-btn" onClick={() => setZoneFixGateOpen(true)}>
                Выбрать место
              </button>
            </div>
          ) : (
            <>
              <div className="putaway-card">
                <ZonePhoto
                  studentId={studentId}
                  zoneId={current.zoneId}
                  version={zonePhotoVersions[current.zoneId] ?? 0}
                  className="putaway-card__photo"
                  fallback={<div className="putaway-card__icon">{ZONES.find((z) => z.id === current.zoneId)?.icon}</div>}
                />
                <div className="putaway-card__name">{current.product}</div>
              </div>

              <div className="putaway-zones">
                {effectiveZones.map((zone) => (
                  <button
                    key={zone.id}
                    className={`putaway-zone${wrongZoneId === zone.id ? ' putaway-zone--wrong' : ''}${wrongCount >= 2 && zone.id === current.zoneId ? ' putaway-zone--hint' : ''}`}
                    onClick={() => handlePick(zone.id)}
                  >
                    <span
                      className="putaway-zone__camera-badge"
                      onClick={(e) => { e.stopPropagation(); setEditingZoneId(zone.id); }}
                      aria-label={`Сфотографировать: ${zone.label}`}
                    >
                      📷
                    </span>
                    <ZonePhoto
                      studentId={studentId}
                      zoneId={zone.id}
                      version={zonePhotoVersions[zone.id] ?? 0}
                      className="putaway-zone__photo"
                      fallback={<span className="putaway-zone__icon">{zone.icon}</span>}
                    />
                    <span className="putaway-zone__label">{zone.label}</span>
                  </button>
                ))}
              </div>

              <div className="putaway-hint">
                {wrongCount >= 2 ? 'Вот сюда — попробуй эту зону' : wrongZoneId ? 'Не совсем — попробуй другое место' : ''}
              </div>
            </>
          )}
```

(Note: the zones grid now maps over `effectiveZones` instead of the imported `ZONES` constant, so family-added zones are selectable — `ZONES` is still used elsewhere in the file for the "photo which zones were used" flow, which is out of scope here and left as-is.)

- [ ] **Step 2: Add CSS**

In `src/features/planner/planner.css`, add near the other `.putaway-card`/`.putaway-zone` rules:

```css
.putaway-orphan { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px 16px; }
.putaway-orphan__hint { text-align: center; color: #6b5f52; font-size: 0.95rem; max-width: 280px; }
.putaway-orphan__fix-btn {
  padding: 12px 24px; border-radius: 14px; border: none;
  background: #2a8060; color: #fff; font-weight: 700; font-size: 1rem;
  cursor: pointer;
}
```

- [ ] **Step 3: Manual verification**

Get an item into the queue with no resolvable zone (e.g. bought item from a custom category with no default zone, and no existing override — see Task 2's manual verification setup). Confirm the orphan state renders ("❓" card + "Нужна помощь взрослого" + "Выбрать место" button) instead of the normal 6-zone game. Tap "Выбрать место", confirm the PIN gate appears, enter it, confirm the picker opens, pick a zone, confirm the screen immediately switches to the normal zone-picking game for that item with the newly-assigned zone as correct. Confirm subsequent bought instances of the same product (in a later trip) resolve directly without hitting the orphan state again.

- [ ] **Step 4: Commit**

```bash
git add src/features/planner/PlannerPutawayScreen.jsx src/features/planner/planner.css
git commit -m "feat(putaway): let an adult assign a zone to a product with no default"
```

---

### Task 10: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npx vitest run`
Expected: PASS — all suites, including `putawayLocations.test.js` and `putawayUtils.test.js` from Tasks 1-2.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds with no errors referencing any file touched in Tasks 1-9.

- [ ] **Step 3: End-to-end manual walkthrough**

Using `npm run dev`, as a single session:
1. Настройки → «Зоны хранения»: rename a base zone, add a custom zone.
2. Список покупок → edit mode: override one item's zone via its chip; add a new item to a category with no default zone and confirm it shows the "unset" chip; assign it a zone via the chip too.
3. Mark several items bought in «В магазине», including the ones just overridden.
4. Раскладка: confirm the overridden items expect their new zones (including the custom zone from step 1, if it was assigned); confirm the gear-fab + PIN flow works for a live fix; confirm any remaining zoneless item shows the orphan flow.
5. Reload the whole app (hard refresh) and confirm every override/rename/custom zone survived.
6. Repeat the two-session sync check from Task 4, Step 4, this time touching zone renames and product overrides specifically (not just a shopping-list item), confirming both propagate to the second session.

- [ ] **Step 4: Report results**

Summarize pass/fail for each of the above in the conversation — no commit for this task (verification only).
