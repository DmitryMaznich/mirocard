# История цикла Планировщика — design

## Context

Сейчас фото чека и раскладки (см. `docs/superpowers/specs/2026-07-06-planner-shopping-photos-design.md`) архивируются только когда в Покупках нажимают «Начать новый список» (`PlannerShoppingScreen.jsx`'s `handleNewListAfterShop`) — это единственное место, которое строит запись `История списков` (`planner_shop_history_{sid}`) и вызывает `archiveTripPhotos`.

После добавления кнопки «Начать новое меню» на хабе (`docs/superpowers/specs/2026-07-06-planner-cycle-completion-design.md`) выяснилось два несвязанных изначально, но взаимоусиливающих пробела:

1. **Баг**: `handleStartNewMenu` (`HomeScreen.jsx`) вызывает `clearPendingPhotos` напрямую, минуя архивацию — чек и фото зон, снятые за цикл, удаляются без следа, если цикл завершают этой (новой, естественной) кнопкой, а не через Покупки.
2. **Концептуальный пробел**: «История списков» физически живёт в Покупках и устроена «один поход — одна запись». Обсуждение с пользователем показало, что нужная модель шире: «один цикл (Меню → … → Начать новое меню) — одна запись», включающая не только покупки, но и что было приготовлено.

## Scope

В рамках:
- Новая модель истории: одна запись = один закрытый цикл. Поход в магазин (`Начать новый список`) — событие *внутри* цикла, не создаёт отдельную запись сам по себе, а накапливается до закрытия цикла.
- Запись цикла содержит: список выбранных рецептов с отметкой «приготовлен/нет» (уже вычисляется на хабе через `isRecipeCookedThisCycle`), список походов в магазин этого цикла (дата, магазин, кол-во товаров, фото чека), и фото зон раскладки, объединённые по зоне за весь цикл (если зону фотографировали в разных походах — остаётся последнее фото).
- Перенос точки входа «История» с Покупок на хаб Планировщика — компактная кнопка рядом с «Начать новое меню» в одном ряду (не полноширинная), а не в хедере Покупок.
- Новое хранилище `planner_cycle_trips_{sid}` (незакрытые походы текущего цикла) и `planner_cycle_history_{sid}` (закрытые циклы). Старое `planner_shop_history_{sid}` не читается и не пишется — старые записи просто перестают быть видны (без миграции, разово).

Вне рамок:
- Импорт/конвертация старых записей `planner_shop_history_*` в новый формат.
- Изменение того, что происходит ВНУТРИ похода (гейты на фото чека/раскладки) — это уже реализовано и не меняется.
- Ограничение числа походов внутри одного цикла или числа хранимых закрытых циклов (по аналогии со старым лимитом в 5 — тот же лимит переносится на новую историю без изменений).

## Design

### Хранилище

`src/core/groupStore.js`, новые пары get/save (тот же паттерн, что и остальные `planner_*` ключи):

```js
const plannerCycleTripsKey   = (sid) => `planner_cycle_trips_${sid}`;
const plannerCycleHistoryKey = (sid) => `planner_cycle_history_${sid}`;

export async function getPlannerCycleTrips(studentId) { … }   // -> Trip[] | []
export async function savePlannerCycleTrips(studentId, trips) { … }
export async function getPlannerCycleHistory(studentId) { … } // -> CycleEntry[] | []
export async function savePlannerCycleHistory(studentId, history) { … }
```

Типы:
```
Trip = { tripId: number, date: string, store: string|null, count: number, hasReceipt: boolean, zonePhotos: string[] }
CycleEntry = {
  id: number,               // now.getTime() в момент закрытия цикла
  dateRange: string,        // "5 июля" или "5 июля — 8 июля"
  recipes: { textId: string, title: {ru: string, en?: string}, cooked: boolean }[], // title — тот же сырой объект, что и recipe.text.title везде в проекте; рендерится через getTopicTitle(...) в шторке, не строка
  trips: Trip[],
  zonePhotos: { zoneId: string, tripId: number }[], // объединено по зоне, последний поход побеждает
}
```

### Архивация похода (внутри цикла) — `archiveShoppingTrip`

Новая функция в `plannerApi.js`, заменяет ту часть `handleNewListAfterShop`, которая сейчас строит запись истории напрямую:

```js
export async function archiveShoppingTrip(studentId, store) {
  const planned = await getPlannerShopPlan(studentId);
  if (Object.keys(planned).length === 0) return null; // нечего архивировать
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
```

`formatHistoryDate`/`RU_MONTHS` переезжают из `PlannerShoppingScreen.jsx` в `plannerApi.js` (используются и там, и в новой `archiveShoppingTrip`/`archiveCycle`); `PlannerShoppingScreen.jsx` импортирует их обратно для `formatTodayRu` (экран печати), который их тоже использует.

`handleNewListAfterShop` (`PlannerShoppingScreen.jsx`) меняется на: `await archiveShoppingTrip(studentId, stores?.current)`, затем — без изменений — сброс `planned/bought/putawayPlan/menuKeys` (customData и magazin остаются, как и сейчас, для следующего похода этого же цикла). Локальный `history`/`HistoryView` в этом экране убираются целиком (см. ниже).

### Закрытие цикла — `archiveCycle`

Новая функция в `plannerApi.js`, вызывается из `handleStartNewMenu` (`HomeScreen.jsx`) **до** `resetPlan`/`resetShoppingData`/`clearPendingPhotos`:

```js
export async function archiveCycle(studentId, plan, menuRecipes, cookedTextIds) {
  // Доархивировать текущий незакрытый поход, если он есть
  const stores = await getPlannerShopStores(studentId);
  await archiveShoppingTrip(studentId, stores?.current);

  const trips = await getPlannerCycleTrips(studentId);
  if (trips.length === 0 && menuRecipes.length === 0) return; // пустой цикл — архивировать нечего

  const zoneMap = new Map(); // zoneId -> tripId, последний поход побеждает
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
}
```

`formatCycleDateRange(start, end)` — новая маленькая функция рядом с `formatHistoryDate`: та же дата → один день, разные → `"{start} — {end}"` (без времени, только `{день} {месяц}`).

`handleStartNewMenu` (`HomeScreen.jsx`) вызывает `await archiveCycle(student.id, existingPlan, menuRecipes, cookedTextIds)` первой строкой, до всего остального.

### UI: кнопки на хабе

Текущая полноширинная `.planner-new-menu-btn` заменяется рядом из двух кнопок:

```jsx
<div className="planner-cycle-actions">
  <button type="button" className="planner-history-btn" onClick={() => setHistoryOpen(true)}>
    🕐 История
  </button>
  <button type="button" className="planner-new-menu-btn" onClick={() => setConfirmNewMenu(true)}>
    🏁 Начать новое меню
  </button>
</div>
```
`.planner-cycle-actions` — `display:flex; gap:8px`; `.planner-history-btn` — компактная (по содержимому, не растягивается — `flex-shrink:0`), `.planner-new-menu-btn` — `flex:1` (занимает остальное). Подтверждение сброса (`menu-reset-bar`) остаётся как есть, просто теперь отображается под этим рядом.

### UI: экран/шторка Истории

Новый компонент `CycleHistorySheet` (тот же паттерн `portions-sheet-backdrop`/`portions-sheet`, что и другие шторки в Планировщике), рендерится в `HomeScreen.jsx` рядом с `CookPickerSheet` при `historyOpen`:

```
5 июля — 8 июля
🍽️ Готовили: Курица ✓, Овсянка ✓, Суп ✗
🛒 Походы в магазин (2):
  • 5 июля, Пятёрочка  [🧾 чек]
  • 7 июля, Ашан       [🧾 чек]
📦 Разложено: [❄️] [🧊] [🌾]
```
Тап по 🧾 у похода открывает чек этого похода на весь экран (`getTripReceiptPhoto(studentId, tripId)`); тап по значку зоны — фото этой зоны из соответствующего похода (`getTripZonePhoto(studentId, tripId, zoneId)`, `tripId` берётся из `entry.zonePhotos`). Пустая история — то же сообщение «История пока пуста».

### Удаляется из `PlannerShoppingScreen.jsx`

- `HistoryView`, `HistoryPhotoThumb`, состояние `history`, кнопка 🕐 в хедере, `view === 'history'` ветка.
- Импорты `getPlannerShopHistory`/`savePlannerShopHistory` (заменяются на новые из `plannerApi.js`, используемые только через `archiveShoppingTrip`).

## Testing

- Юнит-тесты (`plannerApi.test.js` или новый файл): `archiveShoppingTrip` — архивирует непустой план в `planner_cycle_trips`, возвращает `null` и ничего не пишет для пустого плана; несколько вызовов подряд накапливают походы, не перезаписывая предыдущие.
- `archiveCycle` — доархивирует незакрытый поход перед сборкой записи; объединяет фото зон по зоне (последний поход побеждает при совпадении); пустой цикл (нет походов и нет рецептов) не создаёт запись; ограничение в 5 записей истории.
- `formatCycleDateRange` — один день → одна дата, разные дни → диапазон.
- Ручная проверка в браузере: пройти цикл с двумя походами в магазин (два разных `Начать новый список`) и раскладкой между ними → «Начать новое меню» → открыть Историю на хабе → запись показывает оба похода с чеками и объединённые зоны; повторно нажать «Начать новое меню» на пустом цикле (без похода в магазин, например если меню полностью «дома») не создаёт запись, но и не падает.
