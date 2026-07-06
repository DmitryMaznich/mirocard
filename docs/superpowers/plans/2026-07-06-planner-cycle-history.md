# История цикла Планировщика Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одна запись Истории = один закрытый цикл Планировщика (рецепты+статус готовки, все походы в магазин с чеками, объединённые по зоне фото раскладки), с точкой входа на хабе — компактная кнопка «🕐 История» рядом с «🏁 Начать новое меню» в один ряд, вместо спрятанной иконки в Покупках. Заодно чинится потеря фото при закрытии цикла через хаб.

**Architecture:** Новое хранилище (`planner_cycle_trips_*` — незакрытые походы текущего цикла, `planner_cycle_history_*` — закрытые циклы) и две функции в `plannerApi.js` (`archiveShoppingTrip` — архивирует один поход в накопитель; `archiveCycle` — доархивирует текущий поход, если есть, и строит финальную запись). Старое `planner_shop_history_*` / `HistoryView` в Покупках удаляются целиком, заменяются новой шторкой на хабе.

**Tech Stack:** React 19, Zustand, Vitest + `fake-indexeddb`.

## Global Constraints

- Один поход («Начать новый список» в Покупках) — не отдельная запись, а элемент накопителя текущего цикла.
- Закрытие цикла («Начать новое меню» на хабе) сначала доархивирует любой незакрытый поход, потом строит одну запись со всеми походами цикла.
- Фото зоны раскладки, встречавшееся в нескольких походах цикла — в записи остаётся только из последнего похода.
- Лимит хранимых закрытых циклов — 5 (как и был лимит для старой истории).
- Без миграции старых записей `planner_shop_history_*` — они просто перестают быть видны.

---

### Task 1: Функции архивации в `plannerApi.js`

**Files:**
- Modify: `src/core/groupStore.js`
- Modify: `src/features/planner/plannerApi.js`
- Test: `src/features/planner/plannerApi.test.js`

**Interfaces:**
- Produces:
  - `archiveShoppingTrip(studentId, store) => Promise<Trip|null>` — `Trip = { tripId, date, store, count, hasReceipt, zonePhotos }`. Используется в Task 2 (`PlannerShoppingScreen.jsx`) и внутри `archiveCycle`.
  - `formatCycleDateRange(start: Date, end: Date) => string`.
  - `archiveCycle(studentId, plan, menuRecipes, cookedTextIds) => Promise<CycleEntry|null>` — `CycleEntry = { id, dateRange, recipes: {textId, title, cooked}[], trips: Trip[], zonePhotos: {zoneId, tripId}[] }`. Используется в Task 3 (`HomeScreen.jsx`).

- [ ] **Step 1: Добавить хранилище в `groupStore.js`**

Добавить в `src/core/groupStore.js` сразу после `savePlannerShopHistory` (после строки `export async function savePlannerShopHistory(studentId, history) { ... }`, перед `const RECIPE_KV_PREFIXES = ...`):

```js

const plannerCycleTripsKey   = (sid) => `planner_cycle_trips_${sid}`;
const plannerCycleHistoryKey = (sid) => `planner_cycle_history_${sid}`;

export async function getPlannerCycleTrips(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerCycleTripsKey(studentId))) ?? [];
}

export async function savePlannerCycleTrips(studentId, trips) {
  const db = await getDb();
  await kv.set(db, plannerCycleTripsKey(studentId), trips);
}

export async function getPlannerCycleHistory(studentId) {
  const db = await getDb();
  return (await kv.get(db, plannerCycleHistoryKey(studentId))) ?? [];
}

export async function savePlannerCycleHistory(studentId, history) {
  const db = await getDb();
  await kv.set(db, plannerCycleHistoryKey(studentId), history);
}
```

- [ ] **Step 2: Написать падающие тесты**

Создать `src/features/planner/plannerApi.test.js` с добавленным содержимым (дописать в конец существующего файла, импорты объединить с уже существующими):

Заменить текущий блок импортов (строки 1-9):

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
```

на:

```js
import { describe, it, expect } from 'vitest';
import { resetShoppingData, archiveShoppingTrip, archiveCycle, formatCycleDateRange } from './plannerApi.js';
import {
  savePlannerShopCustomData, getPlannerShopCustomData,
  savePlannerShopPlan, getPlannerShopPlan,
  savePlannerShopBought, getPlannerShopBought,
  savePlannerPutawayPlan, getPlannerPutawayPlan,
  savePlannerShopMenuKeys, getPlannerShopMenuKeys,
  savePlannerShopStores,
  getPlannerCycleTrips, getPlannerCycleHistory,
} from '@/core/groupStore';
import { savePendingZonePhoto } from './plannerPhotos.js';

function fakeBlob(content) {
  return new Blob([content], { type: 'image/jpeg' });
}
```

Добавить в конец файла:

```js

describe('formatCycleDateRange', () => {
  it('shows a single date when start and end are the same day', () => {
    const d = new Date('2026-07-05T12:00:00.000Z');
    expect(formatCycleDateRange(d, d)).toBe('5 июля');
  });

  it('shows a range when start and end are different days', () => {
    const start = new Date('2026-07-05T12:00:00.000Z');
    const end = new Date('2026-07-08T12:00:00.000Z');
    expect(formatCycleDateRange(start, end)).toBe('5 июля — 8 июля');
  });
});

describe('archiveShoppingTrip', () => {
  it('returns null and archives nothing when the shopping plan is empty', async () => {
    const studentId = 'test-student-trip-1';
    const result = await archiveShoppingTrip(studentId, 'Пятёрочка');
    expect(result).toBeNull();
    expect(await getPlannerCycleTrips(studentId)).toEqual([]);
  });

  it('appends a trip built from the current plan, without clearing it', async () => {
    const studentId = 'test-student-trip-2';
    await savePlannerShopPlan(studentId, { 'Овощи_0': true, 'Овощи_1': true });
    const trip = await archiveShoppingTrip(studentId, 'Ашан');
    expect(trip).toMatchObject({ store: 'Ашан', count: 2, hasReceipt: false, zonePhotos: [] });
    const trips = await getPlannerCycleTrips(studentId);
    expect(trips).toHaveLength(1);
    expect(trips[0]).toEqual(trip);
    expect(await getPlannerShopPlan(studentId)).toEqual({ 'Овощи_0': true, 'Овощи_1': true }); // not cleared here
  });

  it('accumulates multiple trips across calls instead of overwriting', async () => {
    const studentId = 'test-student-trip-3';
    await savePlannerShopPlan(studentId, { 'Овощи_0': true });
    await archiveShoppingTrip(studentId, 'Пятёрочка');
    await savePlannerShopPlan(studentId, { 'Молочные продукты_0': true });
    await archiveShoppingTrip(studentId, 'Ашан');
    const trips = await getPlannerCycleTrips(studentId);
    expect(trips).toHaveLength(2);
    expect(trips.map((t) => t.store)).toEqual(['Пятёрочка', 'Ашан']);
  });
});

describe('archiveCycle', () => {
  it('returns null and archives nothing for a cycle with no trips and no recipes', async () => {
    const studentId = 'test-student-cycle-1';
    const plan = { createdAt: new Date().toISOString() };
    const result = await archiveCycle(studentId, plan, [], new Set());
    expect(result).toBeNull();
    expect(await getPlannerCycleHistory(studentId)).toEqual([]);
  });

  it('archives the still-open trip before building the entry, then clears the accumulator', async () => {
    const studentId = 'test-student-cycle-2';
    await savePlannerShopPlan(studentId, { 'Овощи_0': true });
    await savePlannerShopStores(studentId, { current: 'Пятёрочка', list: [] });
    const plan = { createdAt: new Date().toISOString() };
    const recipe = { text: { id: 'soup_01', title: { ru: 'Суп' } } };

    const entry = await archiveCycle(studentId, plan, [recipe], new Set(['soup_01']));

    expect(entry.trips).toHaveLength(1);
    expect(entry.trips[0].store).toBe('Пятёрочка');
    expect(entry.recipes).toEqual([{ textId: 'soup_01', title: { ru: 'Суп' }, cooked: true }]);
    expect(await getPlannerCycleTrips(studentId)).toEqual([]);
    expect(await getPlannerCycleHistory(studentId)).toEqual([entry]);
  });

  it('merges zone photos across trips, keeping the latest trip per zone', async () => {
    const studentId = 'test-student-cycle-3';
    const plan = { createdAt: new Date().toISOString() };

    await savePlannerShopPlan(studentId, { 'Овощи_0': true });
    await savePendingZonePhoto(studentId, 'fridge', fakeBlob('trip1-fridge'));
    await archiveShoppingTrip(studentId, 'Пятёрочка');

    await savePlannerShopPlan(studentId, { 'Молочные продукты_0': true });
    await savePendingZonePhoto(studentId, 'fridge', fakeBlob('trip2-fridge'));
    await savePendingZonePhoto(studentId, 'freezer', fakeBlob('trip2-freezer'));
    await archiveShoppingTrip(studentId, 'Ашан');

    const entry = await archiveCycle(studentId, plan, [], new Set());

    const fridgeEntry = entry.zonePhotos.find((z) => z.zoneId === 'fridge');
    expect(fridgeEntry.tripId).toBe(entry.trips[1].tripId);
    expect(entry.zonePhotos.find((z) => z.zoneId === 'freezer').tripId).toBe(entry.trips[1].tripId);
  });
});
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `npx vitest run src/features/planner/plannerApi.test.js`
Expected: FAIL — `archiveShoppingTrip is not a function` (и аналогично для остальных новых импортов).

- [ ] **Step 4: Реализовать функции**

В `src/features/planner/plannerApi.js` заменить блок импортов (строки 1-10):

```js
import { getDb, kv } from '@/core/db';
import { pushOp } from '@/core/syncApi';
import { api } from '@/core/api';
import {
  getRawRecipeTxt,
  savePlannerShopCustomData, savePlannerShopPlan, savePlannerShopBought,
  savePlannerPutawayPlan, savePlannerShopMenuKeys,
} from '@/core/groupStore';
import { normalizePlan } from './plannerUtils.js';
import { parseRecipeMetadata } from './recipeParser.js';
```

на:

```js
import { getDb, kv } from '@/core/db';
import { pushOp } from '@/core/syncApi';
import { api } from '@/core/api';
import {
  getRawRecipeTxt,
  savePlannerShopCustomData, savePlannerShopPlan, savePlannerShopBought,
  savePlannerPutawayPlan, savePlannerShopMenuKeys,
  getPlannerShopPlan, getPlannerShopStores,
  getPlannerCycleTrips, savePlannerCycleTrips,
  getPlannerCycleHistory, savePlannerCycleHistory,
} from '@/core/groupStore';
import { normalizePlan } from './plannerUtils.js';
import { parseRecipeMetadata } from './recipeParser.js';
import { archiveTripPhotos } from './plannerPhotos.js';

const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatHistoryDate(d) {
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]} • ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateOnly(d) {
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

export function formatCycleDateRange(start, end) {
  const startStr = formatDateOnly(start);
  const endStr = formatDateOnly(end);
  return startStr === endStr ? startStr : `${startStr} — ${endStr}`;
}
```

Добавить в конец `src/features/planner/plannerApi.js`:

```js

// Archives one shopping trip (receipt + zone photos) into this cycle's
// not-yet-closed trip accumulator — called by "Начать новый список"
// (Покупки), which may run several times within the same cycle if more
// than one trip to the store is needed. Does NOT touch planned/bought/
// putawayPlan — the caller resets those separately, same as before.
export async function archiveShoppingTrip(studentId, store) {
  const planned = await getPlannerShopPlan(studentId);
  if (!planned || Object.keys(planned).length === 0) return null;
  const now = new Date();
  const tripId = now.getTime();
  const { hasReceipt, zonePhotos } = await archiveTripPhotos(studentId, tripId);
  const trip = {
    tripId,
    date: formatHistoryDate(now),
    store: store ?? null,
    count: Object.keys(planned).length,
    hasReceipt,
    zonePhotos,
  };
  const trips = await getPlannerCycleTrips(studentId);
  const nextTrips = [...trips, trip];
  await savePlannerCycleTrips(studentId, nextTrips);
  return trip;
}

// Closes the whole cycle — called by "Начать новое меню" (hub), before its
// own reset. Archives any still-open trip first (the child may have gone
// straight here without ever clicking "Начать новый список"), then builds
// one entry covering every trip of this cycle plus which recipes were
// cooked. Zone photos are merged by zone across all trips — if the same
// zone was photographed more than once, only the latest trip's photo is
// kept in the entry.
export async function archiveCycle(studentId, plan, menuRecipes, cookedTextIds) {
  const stores = await getPlannerShopStores(studentId);
  await archiveShoppingTrip(studentId, stores?.current);

  const trips = await getPlannerCycleTrips(studentId);
  if (trips.length === 0 && menuRecipes.length === 0) return null;

  const zoneMap = new Map();
  for (const trip of trips) {
    for (const zoneId of trip.zonePhotos) zoneMap.set(zoneId, trip.tripId);
  }

  const now = new Date();
  const entry = {
    id: now.getTime(),
    dateRange: formatCycleDateRange(new Date(plan.createdAt), now),
    recipes: menuRecipes.map((r) => ({
      textId: r.text.id,
      title: r.text.title,
      cooked: cookedTextIds.has(r.text.id),
    })),
    trips,
    zonePhotos: Array.from(zoneMap, ([zoneId, tripId]) => ({ zoneId, tripId })),
  };

  const history = await getPlannerCycleHistory(studentId);
  await savePlannerCycleHistory(studentId, [entry, ...history].slice(0, 5));
  await savePlannerCycleTrips(studentId, []);
  return entry;
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `npx vitest run src/features/planner/plannerApi.test.js`
Expected: PASS (9 tests: 1 existing `resetShoppingData` + 2 `formatCycleDateRange` + 3 `archiveShoppingTrip` + 3 `archiveCycle`).

- [ ] **Step 6: Commit**

```bash
git add src/core/groupStore.js src/features/planner/plannerApi.js src/features/planner/plannerApi.test.js
git commit -m "feat(planner): add cycle-level shopping trip/history archiving"
```

---

### Task 2: Убрать старую Историю из `PlannerShoppingScreen.jsx`

**Files:**
- Modify: `src/features/planner/PlannerShoppingScreen.jsx`

**Interfaces:**
- Consumes: `archiveShoppingTrip` (Task 1).

- [ ] **Step 1: Обновить импорты**

Заменить:

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
import { getPlanRecipes, buildSelectedIngredientsSummary } from './plannerUtils.js';
import { parseRecipeMetadata } from './recipeParser.js';
import { generateShoppingList, applyIngredientDecisions } from './shoppingListGenerator.js';
import { buildPlannerShoppingData, customDataToSteps, syncDecisionsIntoShoppingData } from './plannerShoppingUtils.js';
import { getPendingReceiptPhoto, savePendingReceiptPhoto, archiveTripPhotos, getTripReceiptPhoto, getTripZonePhoto } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
import { ZONES } from './putawayLocations.js';
```

на:

```js
import {
  getRawRecipeTxt,
  getPlannerShopPlan, savePlannerShopPlan,
  getPlannerShopCustomData, savePlannerShopCustomData,
  getPlannerShopStores, savePlannerShopStores,
  getPlannerShopBought, savePlannerShopBought,
  getPlannerShopMenuKeys, savePlannerShopMenuKeys,
  savePlannerPutawayPlan,
} from '@/core/groupStore';
import { loadPlan, loadAllRecipes, resetShoppingData, archiveShoppingTrip, PANTRY_ITEMS } from './plannerApi.js';
import { getPlanRecipes, buildSelectedIngredientsSummary } from './plannerUtils.js';
import { parseRecipeMetadata } from './recipeParser.js';
import { generateShoppingList, applyIngredientDecisions } from './shoppingListGenerator.js';
import { buildPlannerShoppingData, customDataToSteps, syncDecisionsIntoShoppingData } from './plannerShoppingUtils.js';
import { getPendingReceiptPhoto, savePendingReceiptPhoto } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
```

(`getPlannerShopHistory`/`savePlannerShopHistory`/`archiveTripPhotos`/`getTripReceiptPhoto`/`getTripZonePhoto`/`ZONES` becomes unused in this file — removed.)

- [ ] **Step 2: Убрать `pluralItems`, `HistoryPhotoThumb`, `HistoryView`**

Удалить функцию `pluralItems` целиком (строки 50-57):

```js
function pluralItems(n) {
  const abs = Math.abs(n) % 100;
  const m = abs % 10;
  if (abs >= 11 && abs <= 19) return 'товаров';
  if (m === 1) return 'товар';
  if (m >= 2 && m <= 4) return 'товара';
  return 'товаров';
}
```

Удалить `HistoryPhotoThumb` и `HistoryView` целиком (от `function HistoryPhotoThumb({ studentId, tripId, zoneId, icon, onOpen }) {` до закрывающей `}` в конце `HistoryView`, включая обе функции — оставить комментарий `// ── Preview / print view ── ` на месте, он относится к следующему блоку).

- [ ] **Step 3: Обновить состояние — убрать `history`**

Заменить:

```js
  const [customData, setCustomData] = useState(null);
  const [history, setHistory] = useState([]);
  const [editMode, setEditMode] = useState(false);
```

на:

```js
  const [customData, setCustomData] = useState(null);
  const [editMode, setEditMode] = useState(false);
```

Заменить:

```js
    getPlannerShopHistory(studentId).then(setHistory).catch(() => {});
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps
```

на:

```js
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: `handleNewListAfterShop` — использовать `archiveShoppingTrip`**

Заменить:

```js
  async function handleNewListAfterShop() {
    if (Object.keys(planned).length > 0) {
      const now = new Date();
      const id = now.getTime();
      const { hasReceipt, zonePhotos } = await archiveTripPhotos(studentId, id);
      const entry = {
        id,
        date: formatHistoryDate(now),
        store: stores?.current ?? null,
        plan: { ...planned },
        count: Object.keys(planned).length,
        hasReceipt,
        zonePhotos,
      };
      try {
        const hist = await getPlannerShopHistory(studentId);
        const nextHist = [entry, ...hist].slice(0, 5);
        await savePlannerShopHistory(studentId, nextHist);
        setHistory(nextHist);
      } catch {}
    }
    await savePlannerShopPlan(studentId, {});
    await savePlannerShopBought(studentId, {});
    await savePlannerPutawayPlan(studentId, {});
    await savePlannerShopMenuKeys(studentId, []);
    setPlanned({});
    setBought({});
    setModeView('plan');
    setView('grid');
  }

  function handleRestoreHistory(entryPlan) {
    setPlanned(entryPlan);
    setBought({});
    savePlannerShopPlan(studentId, entryPlan).catch(() => {});
    savePlannerShopBought(studentId, {}).catch(() => {});
    savePlannerPutawayPlan(studentId, {}).catch(() => {});
    setView('grid');
  }
```

на:

```js
  async function handleNewListAfterShop() {
    await archiveShoppingTrip(studentId, stores?.current);
    await savePlannerShopPlan(studentId, {});
    await savePlannerShopBought(studentId, {});
    await savePlannerPutawayPlan(studentId, {});
    await savePlannerShopMenuKeys(studentId, []);
    setPlanned({});
    setBought({});
    setModeView('plan');
    setView('grid');
  }
```

(`handleRestoreHistory` удалён целиком — был нужен только кнопке «Открыть» в старой `HistoryView`.)

- [ ] **Step 5: Убрать «История» из хедера и рендера**

Заменить:

```js
  const headerTitle =
    typeof view === 'number' ? null :
    view === 'history' ? 'История списков' :
    view === 'preview' ? 'Список покупок' :
    editMode ? 'Редактор категорий' :
    'Список покупок';

  // The grid's own action icons (store/history/print/clear/edit/regenerate)
  // live in the same header row as the back arrow and title, rather than a
  // second header-styled row underneath — a "Список покупок" nav header immediately
  // followed by another header-styled row read as one screen with two title
  // bars stacked.
  const showGridActions = typeof view !== 'number' && view !== 'history' && view !== 'preview';
```

на:

```js
  const headerTitle =
    typeof view === 'number' ? null :
    view === 'preview' ? 'Список покупок' :
    editMode ? 'Редактор категорий' :
    'Список покупок';

  // The grid's own action icons (store/print/clear/edit/regenerate) live in
  // the same header row as the back arrow and title, rather than a second
  // header-styled row underneath — a "Список покупок" nav header immediately
  // followed by another header-styled row read as one screen with two title
  // bars stacked.
  const showGridActions = typeof view !== 'number' && view !== 'preview';
```

Заменить:

```jsx
              <button className="shop-store-chip" onClick={() => setModeView('storePicker')} aria-label="Сменить магазин">{stores.current || '🏪'}</button>
              {history.length > 0 && (
                <button className="shopping-clear-btn" onClick={() => setView('history')} aria-label="История">🕐</button>
              )}
              {total > 0 && (
```

на:

```jsx
              <button className="shop-store-chip" onClick={() => setModeView('storePicker')} aria-label="Сменить магазин">{stores.current || '🏪'}</button>
              {total > 0 && (
```

Заменить:

```jsx
      {typeof view === 'number' ? (
        <PlanDetail
          steps={steps} icons={icons} planned={planned}
          idx={view}
          onToggle={toggleItem}
          onNote={saveNote}
          onNext={() => setView(view + 1)}
        />
      ) : view === 'history' ? (
        <HistoryView history={history} onRestore={handleRestoreHistory} studentId={studentId} />
      ) : view === 'preview' ? (
```

на:

```jsx
      {typeof view === 'number' ? (
        <PlanDetail
          steps={steps} icons={icons} planned={planned}
          idx={view}
          onToggle={toggleItem}
          onNote={saveNote}
          onNext={() => setView(view + 1)}
        />
      ) : view === 'preview' ? (
```

- [ ] **Step 6: Упростить `handleBack`**

Заменить:

```js
  function handleBack() {
    if (editMode && editingCategoryId !== null) { setEditingCategoryId(null); return; }
    if (editMode) { setEditMode(false); return; }
    if (typeof view === 'number' || view === 'history' || view === 'preview') { setView('grid'); return; }
    setScreen('planner_menu');
  }
```

на:

```js
  function handleBack() {
    if (editMode && editingCategoryId !== null) { setEditingCategoryId(null); return; }
    if (editMode) { setEditMode(false); return; }
    if (typeof view === 'number' || view === 'preview') { setView('grid'); return; }
    setScreen('planner_menu');
  }
```

- [ ] **Step 7: Запустить lint**

Run: `npx eslint src/features/planner/PlannerShoppingScreen.jsx`
Expected: без ошибок (никаких `no-unused-vars` на удалённых импортах/функциях).

- [ ] **Step 8: Ручная проверка в браузере**

Пройти поход в магазин (фото чека) → «Начать новый список» — экран Покупок не должен показывать иконку/кнопку «История» вообще (перепроверить, что хедер содержит только 🏪/🖨/🗑/✏️/⟳). Убедиться, что сам поход всё ещё корректно фотографируется и сбрасывается.

Expected: без ошибок в консоли, поведение похода не изменилось, Истории в Покупках больше нет.

- [ ] **Step 9: Commit**

```bash
git add src/features/planner/PlannerShoppingScreen.jsx
git commit -m "refactor(planner): remove per-trip history from Покупки, use cycle archiving"
```

---

### Task 3: Кнопки и шторка Истории на хабе

**Files:**
- Modify: `src/features/home/HomeScreen.jsx`
- Modify: `src/features/planner/planner.css`

**Interfaces:**
- Consumes: `archiveCycle` (Task 1), `getPlannerCycleHistory` (Task 1, `@/core/groupStore`).

- [ ] **Step 1: Обновить импорты**

Заменить:

```js
import { loadPlan, loadAllRecipes, savePlan, resetShoppingData } from "@/features/planner/plannerApi";
import { isMenuFullyDecided, isReadyToCook, needsShopping, resetPlan, isRecipeCookedThisCycle } from "@/features/planner/plannerUtils";
import { isShoppingDone } from "@/features/planner/plannerShoppingUtils";
import { buildPutawayQueue, getRequiredZones } from "@/features/planner/putawayUtils";
import { getPendingReceiptPhoto, getPendingZonePhotoIds, clearPendingPhotos } from "@/features/planner/plannerPhotos";
import CookPickerSheet from "@/features/planner/CookPickerSheet";
import { getPlannerShopBought, getPlannerShopPlan, getPlannerShopCustomData, getPlannerPutawayPlan } from "@/core/groupStore";
```

на:

```js
import { loadPlan, loadAllRecipes, savePlan, resetShoppingData, archiveCycle } from "@/features/planner/plannerApi";
import { isMenuFullyDecided, isReadyToCook, needsShopping, resetPlan, isRecipeCookedThisCycle } from "@/features/planner/plannerUtils";
import { isShoppingDone } from "@/features/planner/plannerShoppingUtils";
import { buildPutawayQueue, getRequiredZones } from "@/features/planner/putawayUtils";
import { getPendingReceiptPhoto, getPendingZonePhotoIds, clearPendingPhotos, getTripReceiptPhoto, getTripZonePhoto } from "@/features/planner/plannerPhotos";
import { ZONES } from "@/features/planner/putawayLocations";
import CookPickerSheet from "@/features/planner/CookPickerSheet";
import { getPlannerShopBought, getPlannerShopPlan, getPlannerShopCustomData, getPlannerPutawayPlan, getPlannerCycleHistory } from "@/core/groupStore";
```

- [ ] **Step 2: Добавить `pluralItems`, `CycleHistoryPhotoThumb`, `CycleHistorySheet`**

Добавить сразу перед `function PlannerTab({ student, setScreen }) {` (т.е. перед строкой 199):

```jsx
function pluralItems(n) {
  const abs = Math.abs(n) % 100;
  const m = abs % 10;
  if (abs >= 11 && abs <= 19) return 'товаров';
  if (m === 1) return 'товар';
  if (m >= 2 && m <= 4) return 'товара';
  return 'товаров';
}

function CycleHistoryPhotoThumb({ studentId, tripId, zoneId, icon, onOpen }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    const loader = zoneId
      ? getTripZonePhoto(studentId, tripId, zoneId)
      : getTripReceiptPhoto(studentId, tripId);
    loader.then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [studentId, tripId, zoneId]);

  if (!url) return null;
  return (
    <button type="button" className="shop-history-photo" onClick={() => onOpen(url)}>
      <img src={url} alt="" />
      {icon && <span className="shop-history-photo__badge">{icon}</span>}
    </button>
  );
}

function CycleHistorySheet({ studentId, history, onClose }) {
  const [viewerUrl, setViewerUrl] = useState(null);
  return (
    <>
      <div className="portions-sheet-backdrop" onClick={onClose}>
        <div className="portions-sheet cycle-history-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="portions-sheet__handle" />
          <h2 className="portions-sheet__title">История</h2>
          <div className="shop-history-list">
            {history.length === 0 ? (
              <div className="shop-history-empty">История пока пуста</div>
            ) : history.map((entry) => (
              <div key={entry.id} className="shop-history-entry">
                <div className="shop-history-meta">
                  <span className="shop-history-date">{entry.dateRange}</span>
                </div>
                {entry.recipes.length > 0 && (
                  <div className="cycle-history-recipes">
                    🍽️ Готовили: {entry.recipes.map((r) => `${getTopicTitle(r.title)} ${r.cooked ? '✓' : '✗'}`).join(', ')}
                  </div>
                )}
                {entry.trips.length > 0 && (
                  <div className="cycle-history-trips">
                    <div className="cycle-history-trips__label">🛒 Походы в магазин ({entry.trips.length}):</div>
                    {entry.trips.map((trip) => (
                      <div key={trip.tripId} className="cycle-history-trip">
                        <span className="cycle-history-trip__meta">
                          {trip.date}{trip.store ? `, ${trip.store}` : ''} • {trip.count} {pluralItems(trip.count)}
                        </span>
                        {trip.hasReceipt && (
                          <CycleHistoryPhotoThumb studentId={studentId} tripId={trip.tripId} zoneId={null} icon="🧾" onOpen={setViewerUrl} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {entry.zonePhotos.length > 0 && (
                  <div className="shop-history-photos">
                    {entry.zonePhotos.map(({ zoneId, tripId }) => (
                      <CycleHistoryPhotoThumb
                        key={zoneId}
                        studentId={studentId}
                        tripId={tripId}
                        zoneId={zoneId}
                        icon={ZONES.find((z) => z.id === zoneId)?.icon}
                        onOpen={setViewerUrl}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="portions-sheet__cancel" onClick={onClose}>Закрыть</button>
        </div>
      </div>
      {viewerUrl && (
        <div className="photo-viewer-overlay" onClick={() => setViewerUrl(null)}>
          <img src={viewerUrl} className="photo-viewer-img" alt="" />
        </div>
      )}
    </>
  );
}

```

- [ ] **Step 3: Добавить состояние истории**

Заменить:

```js
  const [cookPickerOpen, setCookPickerOpen] = useState(false);
  const [confirmNewMenu, setConfirmNewMenu] = useState(false);
```

на:

```js
  const [cookPickerOpen, setCookPickerOpen] = useState(false);
  const [confirmNewMenu, setConfirmNewMenu] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cycleHistory, setCycleHistory] = useState([]);
```

- [ ] **Step 4: `handleStartNewMenu` — архивировать перед сбросом; добавить `handleOpenHistory`**

Заменить:

```js
  async function handleStartNewMenu() {
    setConfirmNewMenu(false);
    const fresh = resetPlan(student.id);
    await savePlan(fresh);
    await resetShoppingData(student.id);
    await clearPendingPhotos(student.id);
    setExistingPlan(fresh);
  }
```

на:

```js
  async function handleStartNewMenu() {
    setConfirmNewMenu(false);
    await archiveCycle(student.id, existingPlan, menuRecipes, cookedTextIds);
    const fresh = resetPlan(student.id);
    await savePlan(fresh);
    await resetShoppingData(student.id);
    await clearPendingPhotos(student.id);
    setExistingPlan(fresh);
  }

  function handleOpenHistory() {
    getPlannerCycleHistory(student.id).then(setCycleHistory);
    setHistoryOpen(true);
  }
```

- [ ] **Step 5: Заменить кнопку «Начать новое меню» на ряд из двух кнопок**

Заменить:

```jsx
          <button type="button" className="planner-new-menu-btn" onClick={() => setConfirmNewMenu(true)}>
            🏁 Начать новое меню
          </button>
          {confirmNewMenu && (
```

на:

```jsx
          <div className="planner-cycle-actions">
            <button type="button" className="planner-history-btn" onClick={handleOpenHistory}>
              🕐 История
            </button>
            <button type="button" className="planner-new-menu-btn" onClick={() => setConfirmNewMenu(true)}>
              🏁 Начать новое меню
            </button>
          </div>
          {confirmNewMenu && (
```

- [ ] **Step 6: Рендерить `CycleHistorySheet`**

Заменить:

```jsx
      {cookPickerOpen && (
        <CookPickerSheet
          recipes={menuRecipes}
          cookedTextIds={cookedTextIds}
          onPick={handlePickRecipe}
          onClose={() => setCookPickerOpen(false)}
        />
      )}
    </div>
  );
}
```

на:

```jsx
      {cookPickerOpen && (
        <CookPickerSheet
          recipes={menuRecipes}
          cookedTextIds={cookedTextIds}
          onPick={handlePickRecipe}
          onClose={() => setCookPickerOpen(false)}
        />
      )}
      {historyOpen && (
        <CycleHistorySheet
          studentId={student.id}
          history={cycleHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Обновить CSS**

Заменить (текущий полноширинный вариант):

```css
.planner-new-menu-btn {
  width: 100%;
  margin-top: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1.5px solid #cbb9a3;
  background: none;
  color: #6b5c48;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}

.planner-new-menu-btn:active {
  background: rgba(203, 185, 163, 0.15);
}
```

на:

```css
.planner-cycle-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.planner-history-btn {
  flex-shrink: 0;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1.5px solid #cbb9a3;
  background: none;
  color: #6b5c48;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.planner-history-btn:active {
  background: rgba(203, 185, 163, 0.15);
}

.planner-new-menu-btn {
  flex: 1;
  padding: 12px;
  border-radius: 14px;
  border: 1.5px solid #cbb9a3;
  background: none;
  color: #6b5c48;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}

.planner-new-menu-btn:active {
  background: rgba(203, 185, 163, 0.15);
}

.cycle-history-sheet {
  max-height: 80vh;
  overflow-y: auto;
}

.cycle-history-recipes {
  font-size: 13px;
  color: #5a5044;
  align-self: flex-start;
}

.cycle-history-trips {
  align-self: flex-start;
  width: 100%;
}

.cycle-history-trips__label {
  font-size: 12px;
  font-weight: 700;
  color: #7d8f8a;
  margin-bottom: 4px;
}

.cycle-history-trip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.cycle-history-trip__meta {
  font-size: 13px;
  color: #5a5044;
  flex: 1;
}
```

- [ ] **Step 8: Запустить lint**

Run: `npx eslint src/features/home/HomeScreen.jsx`
Expected: без новых ошибок (пре-существующие `isChatPractice`/`set-state-in-effect` — не в счёт, см. предыдущие прогоны этой сессии).

- [ ] **Step 9: Ручная проверка в браузере (`run`-скилл)**

Пройти цикл с двумя походами в магазин (два разных вызова «Начать новый список» между которыми меняется решение хотя бы одного продукта, либо просто дважды пересобрать список) и раскладкой между ними, приготовить хотя бы один рецепт. На хабе:
1. Убедиться, что вместо одной широкой кнопки — два в ряд: «🕐 История» (по размеру содержимого) и «🏁 Начать новое меню» (остальная ширина).
2. Открыть «🕐 История» до закрытия цикла — пусто («История пока пуста»).
3. Нажать «🏁 Начать новое меню» → «Да».
4. Открыть «🕐 История» — появилась запись с диапазоном дат, списком рецептов (с ✓/✗), обоими походами (с чеками, если фотографировали) и объединёнными фото зон.
5. Тап по чеку/зоне открывает фото на весь экран.

Expected: всё воспроизводится без ошибок в консоли.

- [ ] **Step 10: Commit**

```bash
git add src/features/home/HomeScreen.jsx src/features/planner/planner.css
git commit -m "feat(planner): move История to the hub as a per-cycle record"
```

---

### Task 4: Полный сквозной прогон (регрессия)

**Files:** (без изменений кода — только верификация)

- [ ] **Step 1: Запустить тесты**

Run: `npx vitest run src/features/planner src/features/home src/core`
Expected: все проходят (0 failures), включая новые тесты `archiveShoppingTrip`/`archiveCycle`/`formatCycleDateRange`.

- [ ] **Step 2: Запустить lint**

Run: `npx eslint src/features/planner/plannerApi.js src/features/planner/PlannerShoppingScreen.jsx src/features/home/HomeScreen.jsx src/core/groupStore.js`
Expected: без новых ошибок (пре-существующая задолженность в `HomeScreen.jsx`/`plannerUtils.js`, если появится в выводе — не в счёт, подтверждена ранее в этой сессии).

- [ ] **Step 3: Сквозной ручной прогон**

Полный цикл: Меню → Покупки (первый список) → В магазин (чек) → Раскладка (фото зоны) → назад в Покупки → «Начать новый список» (второй список, для того же цикла) → В магазин (второй чек) → Раскладка (ещё зона) → приготовить один рецепт → хаб → «🕐 История» пуста → «🏁 Начать новое меню» → «Да» → «🕐 История» показывает одну запись с двумя походами и обеими зонами.

Expected: ни один шаг не даёт ошибок, поведение соответствует Testing-разделу дизайна.

- [ ] **Step 4: Финальный commit (если понадобились правки)**

Если Step 1-3 потребовали правок — закоммитить отдельно (`fix(planner): ...`). Если правок не было — шаг пропускается.

## Self-Review Notes

- **Spec coverage:** накопитель похода (Task 1 `archiveShoppingTrip`), закрытие цикла с доархивацией (Task 1 `archiveCycle`), объединение фото зон по последнему походу (Task 1, протестировано), перенос точки входа на хаб в виде компактной кнопки в ряд (Task 3), удаление старой Истории из Покупок (Task 2), отсутствие миграции старых записей (сознательно не реализовано нигде).
- **Type consistency:** `archiveShoppingTrip(studentId, store)` — одинаковая сигнатура в Task 1 (тест, реализация) и Task 2 (`handleNewListAfterShop`). `archiveCycle(studentId, plan, menuRecipes, cookedTextIds)` — одинаково в Task 1 и Task 3 (`handleStartNewMenu`). `CycleEntry.trips[].tripId`/`zonePhotos[].tripId` используются одинаково в `archiveCycle` и в `CycleHistoryPhotoThumb`'s пропсах.
