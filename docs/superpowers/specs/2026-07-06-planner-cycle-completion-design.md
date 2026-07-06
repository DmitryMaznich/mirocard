# Начало и конец цикла Планировщика — design

## Context

Планировщик сегодня проводит ребёнка по цепочке Меню → Что купить? → В магазин → Раскладка → готовка, с гейтами на каждом шаге (см. `docs/superpowers/specs/2026-07-06-planner-shopping-photos-design.md` — фото-подтверждение чека/раскладки). Проблема, поднятая пользователем: у этой цепочки нет ощутимого конца. После готовки хаб выглядит ровно так же, как и в середине цикла — нет ни прогресса по тому, что уже приготовлено, ни кнопки «мы всё сделали». Единственный способ начать заново — маленькая текстовая ссылка «Начать меню заново» внутри самого экрана Меню (`PlannerMenuScreen.jsx:429-431`), с общей формулировкой «всё меню будет удалено», без учёта того, готовилось ли что-то вообще.

Существующие точки опоры:
- `sessions` (`useAppStore`) — плоский список завершённых занятий `{ studentId, topicId, textId, modeId, completedAt, ... }` (`src/features/session/sessionEngine.js:118-136`), пишется **только** при полном завершении занятия (`useSessionEngine.js` останавливает запись, если `sessionState.status !== "completed"`). Готовка рецепта в этом приложении — это и есть занятие с режимом `follow_instruction` по тексту этого рецепта, значит завершённая сессия с этим textId = рецепт приготовлен.
- `resetPlan(studentId)` / `resetShoppingData(studentId)` (`plannerUtils.js:76`, `plannerApi.js`) — уже существующий сброс меню и данных покупок/раскладки, сейчас вызывается из `PlannerMenuScreen.jsx:620-623`.
- `plannerPhotos.js` (`savePendingReceiptPhoto`/`getPendingReceiptPhoto`/`savePendingZonePhoto`/`getPendingZonePhotoIds`) — pending-фото чека/зон, живут в `topics`-сторе `planner_photos_${studentId}` под фиксированными именами, переживают между экранами до архивации в Историю.
- `CookPickerSheet.jsx` — список рецептов для готовки, сейчас без какой-либо отметки «уже готовилось».
- `PlannerTab` (`HomeScreen.jsx:199-362`) — хаб с сеткой из 4 `HubCard` + отдельная кнопка `🍳 Начинаем готовить`.

## Scope

В рамках:
- Функция `isRecipeCookedThisCycle` — определяет «приготовлено» по факту завершённой сессии `follow_instruction` для этого рецепта, случившейся после `plan.createdAt` (границы текущего цикла).
- Прогресс готовки на хабе (`{N} из {M} приготовлено`) и отметка ✓ в `CookPickerSheet` для уже приготовленных рецептов.
- Единая кнопка «Начать новое меню» на хабе Планировщика, с адаптивным подтверждением в зависимости от прогресса готовки.
- Удаление старой ссылки «Начать меню заново» из `PlannerMenuScreen.jsx` — одна точка входа вместо двух.
- Очистка pending-фото чека/зон при сбросе цикла (`clearPendingPhotos`), чтобы они не «утекали» в следующий цикл.
- Новая примитивная операция `topics.deleteFile(db, topicId, filename)` в `src/core/db.js` — точечное удаление одного файла (не всей темы), нужна именно для точечной очистки pending-файлов без потери архивных фото из Истории.

Вне рамок (явные упрощения v1):
- Никакой истории циклов (какие меню были раньше, что из них готовилось) — просто чистый сброс, как и раньше. Может стать отдельной задачей позже.
- Не меняется модель «несколько рецептов на один и тот же приём пищи» — цикл остаётся такой, какой пользователь сам его собрал (день, неделя — не важно), критерий конца один: явное нажатие «Начать новое меню».
- Не вводится обязательность приготовить всё перед сбросом — решение всегда за человеком (административный контроль, не техническое ограничение).

## Design

### `isRecipeCookedThisCycle` (`plannerUtils.js`)

```js
export function isRecipeCookedThisCycle(plan, recipe, sessions) {
  return sessions.some((s) =>
    s.studentId === plan.studentId &&
    s.topicId === recipe.topicId &&
    s.textId === recipe.text.id &&
    s.modeId === 'follow_instruction' &&
    s.completedAt >= plan.createdAt
  );
}
```

Чистая функция, без побочных эффектов — принимает уже загруженный `sessions` (он и так уже есть в сторе, `HomeScreen.jsx:485`, просто не был прокинут в `PlannerTab`).

### Прогресс готовки на хабе

`PlannerTab` (`HomeScreen.jsx`) считает:
```js
const cookedCount = menuRecipes.filter((r) => isRecipeCookedThisCycle(existingPlan, r, sessions)).length;
```
Подпись кнопки готовки:
```js
menuRecipes.length === 0 ? '🍳 Начинаем готовить'
  : cookedCount === 0     ? '🍳 Начинаем готовить'
  : `🍳 Готовка: ${cookedCount} из ${menuRecipes.length} приготовлено`
```
Кнопка остаётся кликабельной независимо от прогресса — открывает тот же `CookPickerSheet`, чтобы можно было приготовить оставшееся или переготовить уже сделанное.

### `CookPickerSheet` — отметка приготовленного

Новый проп `cookedTextIds: Set<string>`. Каждый `<li>` получает класс-модификатор (`cook-picker-item--done`) и галочку рядом с названием, если `cookedTextIds.has(recipe.text.id)`. Не блокирует повторный выбор — просто визуальная подсказка «это уже готовили».

### «Начать новое меню» — единая точка входа

Новая кнопка на хабе, под CTA готовки:
```jsx
{hasSelection && (
  <>
    <button type="button" className="planner-new-menu-btn" onClick={() => setConfirmNewMenu(true)}>
      🏁 Начать новое меню
    </button>
    {confirmNewMenu && (
      <div className="menu-reset-bar">
        <span className="menu-reset-bar__text">
          {cookedCount < menuRecipes.length
            ? `Готово только ${cookedCount} из ${menuRecipes.length} блюд. Всё равно начать новое меню?`
            : 'Начать новое меню? Текущее будет закрыто.'}
        </span>
        <div className="menu-reset-bar__actions">
          <button type="button" className="menu-reset-bar__cancel" onClick={() => setConfirmNewMenu(false)}>Нет</button>
          <button type="button" className="menu-reset-bar__ok" onClick={handleStartNewMenu}>Да</button>
        </div>
      </div>
    )}
  </>
)}
```
`handleStartNewMenu`:
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
`resetPlan` строит новый пустой план один раз (`fresh`), и он же и сохраняется, и кладётся в локальный `existingPlan` — так хаб сразу отрисовывается в состоянии «меню не выбрано», без повторного похода в IndexedDB за тем же результатом.

`PlannerMenuScreen.jsx:429-431` (ссылка «Начать меню заново») и связанный `confirmReset`-бар (строки 460-468) удаляются вместе с `onReset`-пропом — сброс теперь только с хаба.

### Очистка pending-фото при сбросе цикла

Новая функция в `plannerPhotos.js`:
```js
export async function clearPendingPhotos(studentId) {
  const db = await getDb();
  await topics.deleteFile(db, photoTopic(studentId), 'pending_receipt.jpg');
  const zoneIds = await getPendingZonePhotoIds(studentId);
  for (const zoneId of zoneIds) {
    await topics.deleteFile(db, photoTopic(studentId), `pending_putaway_${zoneId}.jpg`);
  }
}
```
Требует новую примитивную операцию в `src/core/db.js` (`topics`-объект сейчас имеет только `saveFile`/`getFile`/`listFiles`/`deleteTopic` — последний удаляет **всю** тему, что стёрло бы и архивные `receipt_${tripId}.jpg`/`putaway_${tripId}_${zoneId}.jpg`, используемые Историей покупок):
```js
deleteFile(db, topicId, filename) {
  return req2p(tx(db, "topics", "readwrite").delete(topicKey(topicId, filename)));
},
```

Без этой очистки: если чек/зоны сфотографированы в старом цикле, но список покупок этого цикла ни разу не был закрыт через «Начать новый список» (`handleNewListAfterShop`, который сам архивирует и не трогает pending после), новый цикл после «Начать новое меню» унаследует их — хаб покажет «Всё куплено»/«Всё разложено» для похода, которого не было.

## Testing

- Юнит-тесты (`plannerUtils.test.js`): `isRecipeCookedThisCycle` — засчитывает сессию после `createdAt`, не засчитывает сессию до `createdAt` (сессия из прошлого цикла), не засчитывает сессию с другим `textId`/`modeId`.
- Юнит-тесты (`plannerPhotos.test.js`): `clearPendingPhotos` удаляет `pending_receipt.jpg` и все `pending_putaway_*.jpg`, но не трогает архивные `receipt_${tripId}.jpg`/`putaway_${tripId}_${zoneId}.jpg` для того же студента.
- Ручная проверка в браузере (`run`-скилл): приготовить один рецепт из нескольких → хаб показывает «Готовка: 1 из N»; в `CookPickerSheet` у приготовленного рецепта появляется галочка; нажатие «Начать новое меню» до готовки всего показывает предупреждающий текст с текущим счётом; после сброса — Меню пустое, хаб в состоянии «Что будем готовить?», Покупки/В магазин/Раскладка снова заблокированы, и захожд в «В магазине» **не** показывает уже пройденный гейт чека (фото действительно очищено, не унаследовано).
