# Фото-подтверждение похода в магазин и раскладки — design

## Context

Планировщик учит ребёнка с РАС самостоятельности через последовательность: Меню → Что купить? → В магазин → Раскладка → Начать готовить. Сегодня «В магазин» (`ShopView` в `PlannerShoppingScreen.jsx`) и «Раскладка» (`PlannerPutawayScreen.jsx`) считаются пройденными по чисто цифровому критерию (все товары отмечены «взял», очередь раскладки пуста) — без какого-либо физического подтверждения, которое взрослый мог бы увидеть, не находясь рядом.

Цель: ребёнок фотографирует чек после похода в магазин и по одному фото на каждую использованную зону хранения после раскладки. Оба шага становятся обязательными (блокируют переход дальше), фото хранятся локально и просматриваются в уже существующей «Истории» списков покупок.

Существующие точки опоры:
- `resizeToDataUrl` (`StudentEditScreen.jsx:26`) — единственный в проекте пример съёмки+сжатия фото (аватары), но квадратная обрезка и `capture="user"` (фронтальная камера) ему не подходят.
- `topics.saveFile/getFile/listFiles` (`src/core/db.js:62-85`) — Blob-хранилище в IndexedDB, ключ `${topicId}/${filename}`, сегодня используется для медиа тем. Подходит для фото лучше, чем `kv` (JSON), так как хранит бинарник без base64-раздувания.
- `PlannerPutawayScreen.jsx`, `putawayUtils.js`, `putawayLocations.js` — существующая механика «Раскладка» (`ZONES`, `buildPutawayQueue`, `getZoneForProduct`).
- `PlannerShoppingScreen.jsx`'s `ShopView` (allDone-блок, строки ~791-806) и `handleNewListAfterShop` (строка ~1129) — точка, где список покупок архивируется в `plannerShopHistory` и текущая сессия (`planned`/`bought`/`putawayPlan`) сбрасывается.
- `isShoppingDone(planned, bought)` (`plannerShoppingUtils.js:109`) и `putawayDone`-вычисление в `HomeScreen.jsx:233-246` — текущие, чисто цифровые критерии готовности этапов.

**Важное ограничение, подтверждённое в обсуждении:** весь Планировщик (`planner_*` ключи в `groupStore.js`) сегодня не синхронизируется между устройствами — работает только через `kv` (локальная IndexedDB), в отличие от узкого списка `RECIPE_KV_PREFIXES`, который синхронизируется через account. Разделение на приложение ребёнка и приложение родителя/логопеда с реальной синхронизацией между устройствами — осознанно вынесено за рамки этого спека (см. Scope).

## Scope

В рамках:
- Обязательное фото чека на экране «Всё куплено!» (`ShopView`).
- Обязательное фото на каждую использованную зону хранения на экране «Всё разложено!» (`PlannerPutawayScreen`).
- Сжатие/оптимизация снимков перед сохранением (даун-скейл + JPEG).
- Локальное хранение снимков в IndexedDB (`topics`-стор), без сервера.
- Показ миниатюр чека/зон в существующей «Истории» (`HistoryView`) с открытием на весь экран по тапу.
- Ужесточение критериев `shoppingDone`/`putawayDone` — оба теперь требуют фото, а не только цифрового прогресса.

Вне рамок (явные упрощения v1, не строим сейчас):
- Синхронизация фото/состояния Планировщика между устройствами. Родитель смотрит там же, где ребёнок всё делал.
- Серверный бэкап фото. Риск потери при сбросе устройства — уже существующий для всего Планировщика, не специфичный для фото.
- Лимит хранения / фоновая чистка старых фото. Retention — бессрочный.
- Редактирование/удаление отдельных фото или записей истории задним числом.
- Разбор HEIC-файлов из галереи «на лету» сверх встроенной поддержки браузера — если декодирование падает, сохраняем исходный файл без сжатия (см. Design).

## Design

### Хранилище снимков

Новый модуль `src/features/planner/plannerPhotos.js`, поверх `topics.saveFile/getFile/listFiles` (`src/core/db.js`). Псевдо-topicId на ученика: `planner_photos_${studentId}`.

Пока сессия покупок/раскладки не заархивирована в историю, фото живут под фиксированными «pending»-именами (перезаписываются каждый поход — не растут):
- `pending_receipt.jpg`
- `pending_putaway_${zoneId}.jpg` (по одному на зону, максимум 6 — размер `ZONES`)

При архивации (`handleNewListAfterShop`, см. ниже) снимки копируются под постоянные, привязанные к записи истории имена:
- `receipt_${tripId}.jpg`
- `putaway_${tripId}_${zoneId}.jpg`

где `tripId = entry.id` (уже существующий `now.getTime()` из `handleNewListAfterShop`). Копирование, а не переименование — `topics` не имеет операции удаления одного файла, только `deleteTopic` (всю тему целиком); оставшиеся `pending_*`-файлы просто перезаписываются в следующем походе, лишнего роста нет (ключевое пространство фиксировано: 1 + 6 = 7 файлов на ученика).

```js
// src/features/planner/plannerPhotos.js
import { getDb, topics } from '@/core/db';
import { ZONES } from './putawayLocations.js';

const photoTopic = (studentId) => `planner_photos_${studentId}`;

export async function savePendingReceiptPhoto(studentId, blob) {
  const db = await getDb();
  await topics.saveFile(db, photoTopic(studentId), 'pending_receipt.jpg', blob);
}

export async function getPendingReceiptPhoto(studentId) {
  const db = await getDb();
  return topics.getFile(db, photoTopic(studentId), 'pending_receipt.jpg');
}

export async function savePendingZonePhoto(studentId, zoneId, blob) {
  const db = await getDb();
  await topics.saveFile(db, photoTopic(studentId), `pending_putaway_${zoneId}.jpg`, blob);
}

export async function getPendingZonePhoto(studentId, zoneId) {
  const db = await getDb();
  return topics.getFile(db, photoTopic(studentId), `pending_putaway_${zoneId}.jpg`);
}

// Zones (from ZONES) that already have a pending putaway photo this session.
export async function getPendingZonePhotoIds(studentId) {
  const db = await getDb();
  const files = await topics.listFiles(db, photoTopic(studentId));
  const ids = new Set(
    files
      .filter((f) => f.startsWith('pending_putaway_'))
      .map((f) => f.slice('pending_putaway_'.length, -'.jpg'.length))
  );
  return ZONES.map((z) => z.id).filter((id) => ids.has(id));
}

// Copies this session's pending photos into permanent, trip-scoped files.
// Called once, from handleNewListAfterShop, right before the pending files
// would otherwise be silently reused by the next trip.
export async function archiveTripPhotos(studentId, tripId) {
  const db = await getDb();
  const receipt = await topics.getFile(db, photoTopic(studentId), 'pending_receipt.jpg');
  if (receipt) await topics.saveFile(db, photoTopic(studentId), `receipt_${tripId}.jpg`, receipt);

  const zoneIds = await getPendingZonePhotoIds(studentId);
  for (const zoneId of zoneIds) {
    const blob = await topics.getFile(db, photoTopic(studentId), `pending_putaway_${zoneId}.jpg`);
    if (blob) await topics.saveFile(db, photoTopic(studentId), `putaway_${tripId}_${zoneId}.jpg`, blob);
  }

  return { hasReceipt: !!receipt, zonePhotos: zoneIds };
}

export async function getTripReceiptPhoto(studentId, tripId) {
  const db = await getDb();
  return topics.getFile(db, photoTopic(studentId), `receipt_${tripId}.jpg`);
}

export async function getTripZonePhoto(studentId, tripId, zoneId) {
  const db = await getDb();
  return topics.getFile(db, photoTopic(studentId), `putaway_${tripId}_${zoneId}.jpg`);
}
```

### Сжатие снимка (`resizeToBlob`)

Новый helper рядом в `plannerPhotos.js`. В отличие от `resizeToDataUrl` (квадратная обрезка под аватар), здесь — contain-fit без обрезки и без апскейла, результат `Blob` (не dataURL — избегаем лишнего base64-круга перед `topics.saveFile`):

```js
export async function resizeToBlob(file, maxDim, quality) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // не смогли декодировать (напр. HEIC вне Safari) — сохраняем как есть
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
```

Параметры по месту вызова: чек — `maxDim=1800, quality=0.82` (нужна читаемость мелкого текста); фото зоны — `maxDim=1280, quality=0.75`. Ожидаемый размер: чек ≈150–350 КБ, зона ≈80–200 КБ; один поход (1 чек + до 6 зон) ≈0.3–1.5 МБ.

### UI-компонент съёмки (переиспользуемый)

Один общий компонент `PhotoCaptureCard` (в `plannerPhotos` UI-файле рядом, например `PlannerPhotoCapture.jsx`) для обоих мест использования — большая кнопка с камерой + запасная кнопка «Выбрать из галереи», такой же двух-input паттерн, что и в `StudentEditScreen.jsx`, но с задней камерой:

```jsx
<input type="file" accept="image/*" capture="environment" ... />
<input type="file" accept="image/*" ... />
```

После выбора файла — превью на весь доступный блок с кнопкой «Переснять» (тап по превью или отдельная кнопка) и кнопкой «Готово». «Готово» вызывает `resizeToBlob` → `savePendingReceiptPhoto`/`savePendingZonePhoto` → колбэк родителя, что фото принято. Переснять — до подтверждения «Готово» можно сколько угодно раз, само превью просто заменяется.

### Гейт «Всё куплено!» (`ShopView`)

Сейчас `allDone`-блок (`PlannerShoppingScreen.jsx:791-806`) сразу показывает 3 кнопки. Меняется на:

1. При входе в `allDone`-состояние компонент проверяет `getPendingReceiptPhoto(studentId)`.
2. Нет фото → показывается `PhotoCaptureCard` с подписью «Сфотографируй чек» вместо трёх кнопок.
3. Есть фото (после «Готово», либо уже было при повторном заходе на экран) → показывается текущий celebration-блок как есть (три кнопки: «К списку», «Начать новый список», «📦 Разложить продукты»).

### Гейт «Всё разложено!» (`PlannerPutawayScreen`)

Сейчас при пустой очереди (`!current`) сразу показывается celebration. Меняется на:

1. Вычисляется `requiredZones = [...new Set(Object.values(putawayPlan))]` — зоны, которые реально встретились в этой сессии раскладки.
2. Вычисляется `photographedZones = await getPendingZonePhotoIds(studentId)`.
3. Пока `photographedZones` не покрывает все `requiredZones` — показывается по одной карточке зоны за раз (тот же визуальный язык, что и текущая карточка продукта: иконка зоны + подпись + `PhotoCaptureCard` + точки прогресса `photographedZones.length / requiredZones.length`).
4. Когда все нужные зоны сфотографированы — показывается существующий celebration-блок («Всё разложено!»).

Порядок зон — как в `ZONES` (детерминированный), не по порядку появления в очереди.

### Ужесточение критериев готовности

`isShoppingDone(planned, bought)` (`plannerShoppingUtils.js:109`) остаётся чистой функцией без изменений (используется в тестах и в паре мест). Требование фото добавляется на уровне вызывающего кода как отдельное И:

- `HomeScreen.jsx:233-246`: `shoppingDone = isShoppingDone(planned, bought) && !!(await getPendingReceiptPhoto(student.id))`.
- `putawayDone` там же: помимо `remainingQueue.length === 0`, дополнительно требует, что `getPendingZonePhotoIds(studentId)` покрывает все зоны из `putawayPlan` (используя тот же `requiredZones`-расчёт, что и в UI гейта).

Смысл: ребёнок больше не может выйти из режима бэк-кнопкой/сворачиванием, минуя фото, и получить в хабе «Всё куплено»/«Всё разложено» — цифровой прогресс без снимка хаб не засчитывает.

### Архивация: `handleNewListAfterShop`

При архивации в историю (`PlannerShoppingScreen.jsx:1129`) вызывается `archiveTripPhotos(studentId, entry.id)` **до** того, как `entry` добавляется в историю, и результат кладётся прямо в `entry`:

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
      zonePhotos, // string[] — zoneId, для которых есть фото
    };
    // ...остальное без изменений (getPlannerShopHistory/savePlannerShopHistory/slice(0,5))
  }
  // ...остальное без изменений (сброс planned/bought/putawayPlan/menuKeys)
}
```

Если ребёнок нажал «Начать новый список» до захода в «Раскладку» — `zonePhotos` в записи будет пустым массивом (раскладка ещё не выполнялась). Это не баг новой фичи: возможность обойти «Раскладку», уйдя в новый список раньше, существует и сегодня (хаб просто не даст готовить, пока `putawayDone` не станет true для актуальной сессии) — эта спека её не расширяет и не чинит.

### История — показ фото

Запись истории (`shop-history-entry` в `HistoryView`) получает под существующей строкой meta (дата/магазин/кол-во) горизонтальный ряд миниатюр: чек первым (если `entry.hasReceipt`), затем по одной миниатюре на каждый `entry.zonePhotos[i]` (иконка соответствующей зоны как подпись). Миниатюры загружаются по требованию через `getTripReceiptPhoto`/`getTripZonePhoto(studentId, entry.id, zoneId)` (создают `URL.createObjectURL` из `Blob`, освобождают при размонтировании).

Тап по миниатюре открывает простой полноэкранный просмотр (`<img>` на весь экран поверх текущего, крестик/тап для закрытия) — без новых зависимостей (не лайтбокс-библиотека).

Запись без единого фото (`hasReceipt: false, zonePhotos: []`, включая все записи, созданные до этой фичи — `hasReceipt`/`zonePhotos` там будут `undefined`) не показывает ряд миниатюр вообще — не плейсхолдер, просто отсутствующий блок.

`handleRestoreHistory` (кнопка «Открыть») не меняется — восстанавливает только `plan`, фото не трогает и не удаляет.

## Testing

Ручная проверка через `run`-скилл в браузере:
- На экране «Всё куплено!» без фото чека показывается `PhotoCaptureCard`, три обычные кнопки не видны.
- После съёмки/подтверждения чека — обычный celebration с тремя кнопками; повторный заход на экран (после «К списку» и назад) фото не запрашивает повторно (уже есть pending-фото).
- Хаб: `shoppingDone` не становится `true`, пока фото чека не сохранено, даже если все товары отмечены «взял».
- В «Раскладке»: после последнего товара показывается по одной карточке на каждую **реально использованную** зону (не все 6), с точками прогресса; после всех — обычное celebration «Всё разложено!».
- Хаб: `putawayDone` не становится `true`, пока не сфотографированы все использованные зоны, даже если очередь раскладки пуста.
- «Начать новый список» до захода в «Раскладку» создаёт запись истории с `zonePhotos: []`, но с `hasReceipt: true` — раскладка отдельно не блокируется этой фичей.
- «История»: новая запись показывает миниатюру чека и миниатюры сфотографированных зон; тап открывает полноэкранный просмотр; старые записи (без `hasReceipt`/`zonePhotos`) не показывают ряд миниатюр.
- Съёмка на симуляции маленького/большого файла: убедиться, что `resizeToBlob` не увеличивает уже маленькое фото и укладывается в ожидаемый размер (~150–350 КБ для чека, ~80–200 КБ для зоны) для типичного телефонного снимка.
