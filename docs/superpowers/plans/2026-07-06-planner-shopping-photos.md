# Фото-подтверждение похода в магазин и раскладки — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ребёнок обязан сфотографировать чек после «В магазин» и по фото на каждую использованную зону после «Раскладки»; фото хранятся локально и видны в существующей «Истории» списков покупок.

**Architecture:** Новый Blob-стор поверх существующего `topics.saveFile/getFile/listFiles` (`src/core/db.js`) хранит фото под "pending"-именами во время активной сессии и копирует их под именами, привязанными к записи истории, при архивации списка. Новый переиспользуемый React-компонент `PhotoCaptureCard` встраивается как гейт в `ShopView` (`PlannerShoppingScreen.jsx`) и `PlannerPutawayScreen.jsx`. Критерии готовности в хабе (`HomeScreen.jsx`) ужесточаются — требуют не только цифрового прогресса, но и наличия фото.

**Tech Stack:** React 19, Vite, Vitest + `fake-indexeddb` (уже настроено в `src/test-setup.js`), нативные `createImageBitmap`/`OffscreenCanvas`/IndexedDB browser API, без новых npm-зависимостей.

## Global Constraints

- Никакой синхронизации с бэкендом — все фото живут только в локальной IndexedDB (см. дизайн, раздел Scope: "вне рамок").
- Ровно 1 фото чека на поход; по 1 фото на каждую **реально использованную** (не все 6) зону раскладки.
- Чек: `maxDim=1800, quality=0.82`. Зона: `maxDim=1280, quality=0.75`. Без апскейла, без квадратной обрезки, без ошибки при недекодируемом файле (сохранить как есть).
- Порядок зон при съёмке — как в `ZONES` (детерминированный), не порядок появления в очереди раскладки.
- Retention фото — бессрочный, без фоновой чистки.

---

### Task 1: `getRequiredZones` в `putawayUtils.js`

**Files:**
- Modify: `src/features/planner/putawayUtils.js`
- Test: `src/features/planner/putawayUtils.test.js`

**Interfaces:**
- Produces: `getRequiredZones(putawayPlan: { [key: string]: zoneId }) => zoneId[]` — уникальные zone id, встретившиеся в значениях `putawayPlan`, в порядке `ZONES`. Используется в Task 5 (гейт в `PlannerPutawayScreen`) и Task 7 (гейтинг в `HomeScreen`).

- [ ] **Step 1: Написать падающий тест**

Открыть `src/features/planner/putawayUtils.test.js`, добавить в конец файла (после последнего `describe`):

```js
import { getRequiredZones } from './putawayUtils.js';

describe('getRequiredZones', () => {
  it('returns unique zone ids from putawayPlan values, ordered as in ZONES', () => {
    const plan = { 'Молочные продукты_0': 'fridge', 'Заморозка_0': 'freezer', 'Овощи_0': 'fridge' };
    expect(getRequiredZones(plan)).toEqual(['freezer', 'fridge']);
  });

  it('returns an empty array for an empty putawayPlan', () => {
    expect(getRequiredZones({})).toEqual([]);
  });

  it('treats a missing putawayPlan as empty', () => {
    expect(getRequiredZones(undefined)).toEqual([]);
  });
});
```

(Добавить `getRequiredZones` к существующему `import { buildPutawayQueue } from './putawayUtils.js';` наверху файла — заменить на `import { buildPutawayQueue, getRequiredZones } from './putawayUtils.js';`.)

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/planner/putawayUtils.test.js`
Expected: FAIL — `getRequiredZones is not a function` (или ReferenceError/undefined).

- [ ] **Step 3: Реализовать `getRequiredZones`**

В `src/features/planner/putawayUtils.js` заменить строку `import { getZoneForProduct } from './putawayLocations.js';` на:

```js
import { getZoneForProduct, ZONES } from './putawayLocations.js';
```

Добавить в конец файла:

```js
// Unique zone ids that actually occur in this session's putawayPlan, in the
// same deterministic order as ZONES — used to drive both the putaway-photo
// gate (PlannerPutawayScreen) and the hub's putawayDone check (HomeScreen).
export function getRequiredZones(putawayPlan) {
  const used = new Set(Object.values(putawayPlan ?? {}));
  return ZONES.map((z) => z.id).filter((id) => used.has(id));
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/features/planner/putawayUtils.test.js`
Expected: PASS (8 tests: 5 existing `buildPutawayQueue` + 3 new `getRequiredZones`).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/putawayUtils.js src/features/planner/putawayUtils.test.js
git commit -m "feat(planner): add getRequiredZones helper for putaway photo gating"
```

---

### Task 2: Photo storage layer — `plannerPhotos.js`

**Files:**
- Create: `src/features/planner/plannerPhotos.js`
- Test: `src/features/planner/plannerPhotos.test.js`

**Interfaces:**
- Consumes: `getDb, topics` from `@/core/db` (`topics.saveFile(db, topicId, filename, blob)`, `topics.getFile(db, topicId, filename) => Blob|null`, `topics.listFiles(db, topicId) => string[]`); `ZONES` from `./putawayLocations.js`.
- Produces:
  - `savePendingReceiptPhoto(studentId, blob) => Promise<void>`
  - `getPendingReceiptPhoto(studentId) => Promise<Blob|null>`
  - `savePendingZonePhoto(studentId, zoneId, blob) => Promise<void>`
  - `getPendingZonePhoto(studentId, zoneId) => Promise<Blob|null>`
  - `getPendingZonePhotoIds(studentId) => Promise<zoneId[]>` (ordered as `ZONES`) — consumed by Task 5 and Task 7.
  - `archiveTripPhotos(studentId, tripId) => Promise<{ hasReceipt: boolean, zonePhotos: zoneId[] }>` — consumed by Task 6.
  - `getTripReceiptPhoto(studentId, tripId) => Promise<Blob|null>`, `getTripZonePhoto(studentId, tripId, zoneId) => Promise<Blob|null>` — consumed by Task 6.

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/planner/plannerPhotos.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  savePendingReceiptPhoto, getPendingReceiptPhoto,
  savePendingZonePhoto, getPendingZonePhoto, getPendingZonePhotoIds,
  archiveTripPhotos, getTripReceiptPhoto, getTripZonePhoto,
} from './plannerPhotos.js';

function fakeBlob(content) {
  return new Blob([content], { type: 'image/jpeg' });
}

describe('pending receipt photo', () => {
  it('returns null when nothing has been saved yet', async () => {
    expect(await getPendingReceiptPhoto('student-a')).toBeNull();
  });

  it('round-trips a saved blob', async () => {
    await savePendingReceiptPhoto('student-b', fakeBlob('receipt-1'));
    const blob = await getPendingReceiptPhoto('student-b');
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe('receipt-1');
  });
});

describe('pending zone photos', () => {
  it('returns an empty array when nothing has been saved', async () => {
    expect(await getPendingZonePhotoIds('student-c')).toEqual([]);
  });

  it('round-trips a saved zone photo and lists it in ZONES order', async () => {
    await savePendingZonePhoto('student-d', 'pantry', fakeBlob('pantry-photo'));
    await savePendingZonePhoto('student-d', 'freezer', fakeBlob('freezer-photo'));
    expect(await getPendingZonePhotoIds('student-d')).toEqual(['freezer', 'pantry']);
    const blob = await getPendingZonePhoto('student-d', 'freezer');
    expect(await blob.text()).toBe('freezer-photo');
  });
});

describe('archiveTripPhotos', () => {
  it('copies pending photos into trip-scoped files and reports what it found', async () => {
    await savePendingReceiptPhoto('student-e', fakeBlob('the-receipt'));
    await savePendingZonePhoto('student-e', 'fridge', fakeBlob('the-fridge'));

    const result = await archiveTripPhotos('student-e', 12345);

    expect(result).toEqual({ hasReceipt: true, zonePhotos: ['fridge'] });
    expect(await (await getTripReceiptPhoto('student-e', 12345)).text()).toBe('the-receipt');
    expect(await (await getTripZonePhoto('student-e', 12345, 'fridge')).text()).toBe('the-fridge');
  });

  it('reports no receipt/zones when nothing was pending', async () => {
    const result = await archiveTripPhotos('student-f', 99999);
    expect(result).toEqual({ hasReceipt: false, zonePhotos: [] });
    expect(await getTripReceiptPhoto('student-f', 99999)).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/planner/plannerPhotos.test.js`
Expected: FAIL — не может импортировать `plannerPhotos.js` (файла ещё нет).

- [ ] **Step 3: Реализовать хранилище**

Создать `src/features/planner/plannerPhotos.js`:

```js
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

// Zones (from ZONES, in that order) that already have a pending putaway
// photo saved for this student's current, not-yet-archived session.
export async function getPendingZonePhotoIds(studentId) {
  const db = await getDb();
  const files = await topics.listFiles(db, photoTopic(studentId));
  const prefix = 'pending_putaway_';
  const ids = new Set(
    files
      .filter((f) => f.startsWith(prefix))
      .map((f) => f.slice(prefix.length, -'.jpg'.length))
  );
  return ZONES.map((z) => z.id).filter((id) => ids.has(id));
}

// Copies this session's pending photos into permanent, trip-scoped files.
// Called once from handleNewListAfterShop, right before the pending files
// would otherwise be silently reused (overwritten) by the next trip.
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

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/features/planner/plannerPhotos.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/plannerPhotos.js src/features/planner/plannerPhotos.test.js
git commit -m "feat(planner): add IndexedDB blob storage for receipt/putaway photos"
```

---

### Task 3: `resizeToBlob` — сжатие снимка

**Files:**
- Modify: `src/features/planner/plannerPhotos.js`
- Test: `src/features/planner/plannerPhotos.test.js`

**Interfaces:**
- Consumes: browser `createImageBitmap`, `OffscreenCanvas` (mocked in tests — jsdom does not implement either).
- Produces: `resizeToBlob(file: Blob, maxDim: number, quality: number) => Promise<Blob>` — consumed by Task 4 (`PhotoCaptureCard.jsx`).

- [ ] **Step 1: Написать падающие тесты**

Добавить в конец `src/features/planner/plannerPhotos.test.js`:

```js
import { resizeToBlob } from './plannerPhotos.js';

describe('resizeToBlob', () => {
  it('downscales an image larger than maxDim, preserving aspect ratio', async () => {
    let drawnArgs = null;
    global.createImageBitmap = async () => ({ width: 4000, height: 2000 });
    global.OffscreenCanvas = class {
      constructor(w, h) { this.width = w; this.height = h; }
      getContext() {
        return { drawImage: (...args) => { drawnArgs = args; } };
      }
      async convertToBlob({ type, quality }) {
        return new Blob([`resized:${this.width}x${this.height}:${type}:${quality}`]);
      }
    };

    const result = await resizeToBlob(new Blob(['orig']), 1000, 0.8);

    expect(await result.text()).toBe('resized:1000x500:image/jpeg:0.8');
    expect(drawnArgs[1]).toBe(0);
    expect(drawnArgs[2]).toBe(0);
    expect(drawnArgs[3]).toBe(1000);
    expect(drawnArgs[4]).toBe(500);
  });

  it('does not upscale an image smaller than maxDim', async () => {
    global.createImageBitmap = async () => ({ width: 300, height: 200 });
    global.OffscreenCanvas = class {
      constructor(w, h) { this.width = w; this.height = h; }
      getContext() { return { drawImage: () => {} }; }
      async convertToBlob() { return new Blob([`resized:${this.width}x${this.height}`]); }
    };

    const result = await resizeToBlob(new Blob(['orig']), 1000, 0.8);

    expect(await result.text()).toBe('resized:300x200');
  });

  it('falls back to the original file when decoding fails', async () => {
    global.createImageBitmap = async () => { throw new Error('unsupported format'); };
    const original = new Blob(['undecoded-original']);

    const result = await resizeToBlob(original, 1000, 0.8);

    expect(result).toBe(original);
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/planner/plannerPhotos.test.js`
Expected: FAIL — `resizeToBlob is not a function`.

- [ ] **Step 3: Реализовать `resizeToBlob`**

Добавить в конец `src/features/planner/plannerPhotos.js`:

```js
// Contain-fit downscale (no crop, no upscale) — used for receipts (need
// legible text, so a larger maxDim/quality) and zone photos (smaller is
// fine, they just need to show that products are put away). Returns a
// Blob directly (not a dataURL) so it can go straight into topics.saveFile.
export async function resizeToBlob(file, maxDim, quality) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // undecodable (e.g. HEIC outside Safari) — store as-is rather than lose the photo
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/features/planner/plannerPhotos.test.js`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/plannerPhotos.js src/features/planner/plannerPhotos.test.js
git commit -m "feat(planner): add resizeToBlob for receipt/zone photo compression"
```

---

### Task 4: `PhotoCaptureCard` + гейт «Всё куплено!» в `ShopView`

**Files:**
- Create: `src/features/planner/PhotoCaptureCard.jsx`
- Modify: `src/features/planner/planner.css` (append)
- Modify: `src/features/planner/PlannerShoppingScreen.jsx`

**Interfaces:**
- Consumes: `resizeToBlob` (Task 3), `getPendingReceiptPhoto`/`savePendingReceiptPhoto` (Task 2).
- Produces: `<PhotoCaptureCard title quality maxDim hint onConfirm={(blob) => void}>` — reused as-is in Task 5.

- [ ] **Step 1: Создать `PhotoCaptureCard.jsx`**

Создать `src/features/planner/PhotoCaptureCard.jsx`:

```jsx
import { useState, useRef } from 'react';
import { resizeToBlob } from './plannerPhotos.js';

export default function PhotoCaptureCard({ title, hint, maxDim, quality, onConfirm }) {
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    const resized = await resizeToBlob(file, maxDim, quality);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(resized);
    setPreviewUrl(URL.createObjectURL(resized));
    setBusy(false);
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
  }

  function confirm() {
    if (blob) onConfirm(blob);
  }

  return (
    <div className="photo-capture">
      <div className="photo-capture__title">{title}</div>
      {previewUrl ? (
        <>
          <img src={previewUrl} className="photo-capture__preview" onClick={retake} alt="" />
          <div className="photo-capture__actions">
            <button type="button" className="photo-capture__retake" onClick={retake}>Переснять</button>
            <button type="button" className="photo-capture__confirm" onClick={confirm}>Готово</button>
          </div>
        </>
      ) : (
        <>
          <div className="photo-capture__btns">
            <button type="button" className="photo-capture__btn" onClick={() => cameraRef.current?.click()} disabled={busy}>
              {busy ? '…' : '📷 Камера'}
            </button>
            <button type="button" className="photo-capture__btn photo-capture__btn--alt" onClick={() => galleryRef.current?.click()} disabled={busy}>
              🖼 Галерея
            </button>
          </div>
          {hint && <div className="photo-capture__hint">{hint}</div>}
        </>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}
```

- [ ] **Step 2: Добавить CSS**

Добавить в конец `src/features/planner/planner.css`:

```css
/* ── Photo capture (receipt / putaway zone confirmation) ────────────────── */

.photo-capture {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.photo-capture__title {
  font-size: 18px;
  font-weight: 700;
  text-align: center;
}

.photo-capture__hint {
  font-size: 14px;
  color: #8a7f6f;
  text-align: center;
}

.photo-capture__btns {
  display: flex;
  gap: 10px;
}

.photo-capture__btn {
  all: unset;
  cursor: pointer;
  padding: 14px 20px;
  border-radius: 14px;
  background: #4caf90;
  color: #fff;
  font-weight: 600;
  font-size: 15px;
  text-align: center;
}

.photo-capture__btn--alt {
  background: #efe7da;
  color: #5a5044;
}

.photo-capture__preview {
  max-width: 100%;
  max-height: 320px;
  border-radius: 14px;
  object-fit: contain;
  border: 1px solid #e7dccf;
}

.photo-capture__actions {
  display: flex;
  gap: 10px;
}

.photo-capture__retake, .photo-capture__confirm {
  all: unset;
  cursor: pointer;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
}

.photo-capture__retake {
  background: #efe7da;
  color: #5a5044;
}

.photo-capture__confirm {
  background: #4caf90;
  color: #fff;
}

/* ── Photo viewer (fullscreen) ───────────────────────────────────────────── */

.photo-viewer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.photo-viewer-img {
  max-width: 92vw;
  max-height: 92vh;
  object-fit: contain;
  border-radius: 8px;
}

/* ── History photo thumbnails ────────────────────────────────────────────── */

.shop-history-photos {
  display: flex;
  gap: 8px;
  margin: 8px 0;
  flex-wrap: wrap;
}

.shop-history-photo {
  all: unset;
  cursor: pointer;
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e7dccf;
}

.shop-history-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.shop-history-photo__badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  padding: 0 2px;
}
```

- [ ] **Step 3: Подключить гейт в `ShopView`**

В `src/features/planner/PlannerShoppingScreen.jsx`:

Добавить импорты (после существующего `import { buildPlannerShoppingData, customDataToSteps, syncDecisionsIntoShoppingData } from './plannerShoppingUtils.js';`):

```js
import { getPendingReceiptPhoto, savePendingReceiptPhoto } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
```

Изменить сигнатуру `ShopView` (было `function ShopView({ steps, icons, planned, store, bought, onToggleBought, onNewList, onBackToPlan, onPutaway }) {`):

```js
function ShopView({ steps, icons, planned, store, bought, onToggleBought, onNewList, onBackToPlan, onPutaway, studentId }) {
```

Сразу после строки `const allDone = total > 0 && totalDone === total;` добавить:

```js
  const [hasReceipt, setHasReceipt] = useState(null); // null = checking, false = missing, true = present

  useEffect(() => {
    if (!allDone) { setHasReceipt(null); return; }
    let cancelled = false;
    getPendingReceiptPhoto(studentId).then((blob) => { if (!cancelled) setHasReceipt(!!blob); });
    return () => { cancelled = true; };
  }, [allDone, studentId]);
```

(`useState`/`useEffect` уже импортированы в этом файле из `'react'`.)

Заменить блок `if (allDone) return ( ... );` (текущий, строки ~791-806) на:

```js
  if (allDone) {
    if (hasReceipt === null) return (
      <div className="shopping-body shop-center">Загрузка…</div>
    );

    if (!hasReceipt) return (
      <div className="shopping-body shop-center">
        <PhotoCaptureCard
          title="Сфотографируй чек"
          hint="Это подтвердит, что покупки сделаны"
          maxDim={1800}
          quality={0.82}
          onConfirm={async (blob) => {
            await savePendingReceiptPhoto(studentId, blob);
            setHasReceipt(true);
          }}
        />
      </div>
    );

    return (
      <div className="shopping-body shop-center">
        <div className="shop-state">
          <div className="shop-state__icon">🎉</div>
          <div className="shop-state__title">Всё куплено!</div>
          <div className="shop-state__hint">{total} продуктов{store ? ` • ${store}` : ''}</div>
          <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onBackToPlan}>
            <BackArrowIcon size={16} /> К списку
          </button>
          <button className="shopping-view-btn" style={{ marginTop: 8, background: '#4caf90' }} onClick={onNewList}>
            Начать новый список
          </button>
          <button className="shopping-view-btn" style={{ marginTop: 8 }} onClick={onPutaway}>📦 Разложить продукты</button>
        </div>
      </div>
    );
  }
```

Найти рендер `<ShopView ...>` (в блоке `if (modeView === 'shop')`) и добавить проп `studentId`:

```jsx
        <ShopView
          steps={steps} icons={icons} planned={planned} store={stores.current}
          bought={bought} onToggleBought={toggleBought}
          onNewList={handleNewListAfterShop}
          onBackToPlan={() => setModeView('plan')}
          onPutaway={() => setScreen('planner_putaway')}
          studentId={studentId}
        />
```

- [ ] **Step 4: Ручная проверка в браузере**

Использовать `run`-скилл (dev-сервер уже должен быть поднят на `npm run dev`, драйвер Playwright — как в предыдущих сессиях этого проекта):
1. Дойти до Планировщика, собрать меню с ≥1 рецептом (если нет), открыть Покупки → отметить пару товаров → В магазине.
2. Отметить все товары как «взял» — должен появиться экран «Сфотографируй чек» вместо трёх кнопок celebration.
3. Через `page.setInputFiles` на скрытом `input[type=file]` (тот, что без `capture` — обычный «Галерея») подставить любой валидный JPEG-файл.
4. Убедиться, что появляется превью с кнопками «Переснять»/«Готово»; после «Готово» — обычный celebration с тремя кнопками.
5. Вернуться в Покупки и снова зайти в «В магазине» — экран съёмки не должен появиться повторно (фото уже сохранено).

Expected: все пункты подтверждаются, консоль без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/PhotoCaptureCard.jsx src/features/planner/planner.css src/features/planner/PlannerShoppingScreen.jsx
git commit -m "feat(planner): require a receipt photo before leaving В магазине"
```

---

### Task 5: Гейт «Всё разложено!» в `PlannerPutawayScreen`

**Files:**
- Modify: `src/features/planner/PlannerPutawayScreen.jsx`

**Interfaces:**
- Consumes: `getRequiredZones` (Task 1), `getPendingZonePhotoIds`/`savePendingZonePhoto` (Task 2), `PhotoCaptureCard` (Task 4), `ZONES` (`./putawayLocations.js`, already imported in this file).

- [ ] **Step 1: Добавить импорты и состояние**

В `src/features/planner/PlannerPutawayScreen.jsx`, заменить:

```js
import { buildPutawayQueue } from './putawayUtils.js';
```

на:

```js
import { buildPutawayQueue, getRequiredZones } from './putawayUtils.js';
import { getPendingZonePhotoIds, savePendingZonePhoto } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
```

После строки `const [wrongZoneId, setWrongZoneId] = useState(null);` добавить:

```js
  const [photographedZones, setPhotographedZones] = useState([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
```

- [ ] **Step 2: Загрузить сфотографированные зоны, когда очередь опустела**

После существующего `useEffect` (тот, что грузит `queue`/`putawayPlan` на маунте — заканчивается `}, [studentId]);`) добавить новый:

```js
  useEffect(() => {
    if (loading || queue.length > 0 || !studentId) return;
    let cancelled = false;
    getPendingZonePhotoIds(studentId).then((ids) => {
      if (!cancelled) { setPhotographedZones(ids); setZonesLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [loading, queue.length, studentId]);
```

- [ ] **Step 3: Вычислить недостающую зону**

Сразу после строки `const current = queue[0];` добавить:

```js
  const requiredZones = getRequiredZones(putawayPlan);
  const missingZones = requiredZones.filter((id) => !photographedZones.includes(id));
  const zoneToShoot = missingZones[0] ?? null;
  const zoneMeta = zoneToShoot ? ZONES.find((z) => z.id === zoneToShoot) : null;
```

- [ ] **Step 4: Вставить гейт перед celebration**

Заменить блок:

```jsx
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
```

на:

```jsx
      {!current ? (
        totalCount === 0 ? (
          <div className="putaway-empty">Пока нечего раскладывать — сначала отметь купленные продукты в «В магазине».</div>
        ) : !zonesLoaded ? (
          <div className="putaway-body screen-center">Загрузка…</div>
        ) : zoneToShoot ? (
          <div className="putaway-body">
            <div className="putaway-progress">Фото {photographedZones.length + 1} из {requiredZones.length}</div>
            <PhotoCaptureCard
              title={`Сфотографируй: ${zoneMeta.label}`}
              hint="Покажи, что продукты разложены по местам"
              maxDim={1280}
              quality={0.75}
              onConfirm={async (blob) => {
                await savePendingZonePhoto(studentId, zoneToShoot, blob);
                setPhotographedZones((prev) => [...prev, zoneToShoot]);
              }}
            />
            <div className="putaway-dots">
              {requiredZones.map((id) => (
                <span key={id} className={`putaway-dot${photographedZones.includes(id) ? ' putaway-dot--done' : ''}`} />
              ))}
            </div>
          </div>
        ) : (
          <div className="putaway-complete">
            <div className="putaway-complete__icon">🎉</div>
            <div className="putaway-complete__title">Всё разложено!</div>
            <div className="putaway-complete__hint">{totalCount} продуктов на своих местах</div>
          </div>
        )
      ) : (
```

- [ ] **Step 5: Ручная проверка в браузере**

Продолжая с точки, где Task 4 остановился (чек уже сфотографирован):
1. Открыть «📦 Разложить продукты», пройти все товары до конца очереди.
2. Вместо celebration должна появиться карточка «Сфотографируй: <зона>» с точками прогресса — ровно по одной на каждую зону, реально встретившуюся в этой раскладке (не 6 всегда).
3. Подставить файл через `setInputFiles`, подтвердить «Готово» — точка заполняется, карточка переходит к следующей недостающей зоне.
4. После последней зоны — обычный «Всё разложено!».
5. Выйти на хаб и снова зайти в «Раскладку» — фото не запрашиваются повторно.

Expected: все пункты подтверждаются, консоль без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/PlannerPutawayScreen.jsx
git commit -m "feat(planner): require a photo per used zone before finishing putaway"
```

---

### Task 6: Архивация фото + миниатюры в «Истории»

**Files:**
- Modify: `src/features/planner/PlannerShoppingScreen.jsx`

**Interfaces:**
- Consumes: `archiveTripPhotos`, `getTripReceiptPhoto`, `getTripZonePhoto` (Task 2); `ZONES` (`./putawayLocations.js`).

- [ ] **Step 1: Архивировать фото в `handleNewListAfterShop`**

Добавить импорт (рядом с импортом `PhotoCaptureCard`/`plannerPhotos` из Task 4):

```js
import { getPendingReceiptPhoto, savePendingReceiptPhoto, archiveTripPhotos, getTripReceiptPhoto, getTripZonePhoto } from './plannerPhotos.js';
```

(Заменяет более узкий импорт из Task 4, шаг 3 — тот же файл, объединяются в один.)

Заменить `handleNewListAfterShop` (текущий, строки ~1129-1154):

```js
  async function handleNewListAfterShop() {
    if (Object.keys(planned).length > 0) {
      const now = new Date();
      const entry = {
        id: now.getTime(),
        date: formatHistoryDate(now),
        store: stores?.current ?? null,
        plan: { ...planned },
        count: Object.keys(planned).length,
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
```

на:

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
```

- [ ] **Step 2: Импортировать `ZONES` для иконок**

Добавить импорт (рядом с остальными относительными импортами наверху файла):

```js
import { ZONES } from './putawayLocations.js';
```

- [ ] **Step 3: Добавить `HistoryPhotoThumb` и обновить `HistoryView`**

Заменить текущий блок `HistoryView` (строки ~682-701):

```jsx
function HistoryView({ history, onRestore }) {
  return (
    <div className="shopping-body">
      <div className="shop-history-list">
        {history.length === 0 ? (
          <div className="shop-history-empty">История пока пуста</div>
        ) : history.map((entry) => (
          <div key={entry.id} className="shop-history-entry">
            <div className="shop-history-meta">
              <span className="shop-history-date">{entry.date}</span>
              {entry.store && <span className="shop-history-store">{entry.store}</span>}
              <span className="shop-history-count">{entry.count} {pluralItems(entry.count)}</span>
            </div>
            <button className="shop-history-restore" onClick={() => onRestore(entry.plan)}>Открыть</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

на:

```jsx
function HistoryPhotoThumb({ studentId, tripId, zoneId, icon, onOpen }) {
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

function HistoryView({ history, onRestore, studentId }) {
  const [viewerUrl, setViewerUrl] = useState(null);
  return (
    <div className="shopping-body">
      <div className="shop-history-list">
        {history.length === 0 ? (
          <div className="shop-history-empty">История пока пуста</div>
        ) : history.map((entry) => (
          <div key={entry.id} className="shop-history-entry">
            <div className="shop-history-meta">
              <span className="shop-history-date">{entry.date}</span>
              {entry.store && <span className="shop-history-store">{entry.store}</span>}
              <span className="shop-history-count">{entry.count} {pluralItems(entry.count)}</span>
            </div>
            {(entry.hasReceipt || entry.zonePhotos?.length > 0) && (
              <div className="shop-history-photos">
                {entry.hasReceipt && (
                  <HistoryPhotoThumb studentId={studentId} tripId={entry.id} zoneId={null} icon="🧾" onOpen={setViewerUrl} />
                )}
                {(entry.zonePhotos ?? []).map((zoneId) => (
                  <HistoryPhotoThumb
                    key={zoneId}
                    studentId={studentId}
                    tripId={entry.id}
                    zoneId={zoneId}
                    icon={ZONES.find((z) => z.id === zoneId)?.icon}
                    onOpen={setViewerUrl}
                  />
                ))}
              </div>
            )}
            <button className="shop-history-restore" onClick={() => onRestore(entry.plan)}>Открыть</button>
          </div>
        ))}
      </div>
      {viewerUrl && (
        <div className="photo-viewer-overlay" onClick={() => setViewerUrl(null)}>
          <img src={viewerUrl} className="photo-viewer-img" alt="" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Передать `studentId` в `HistoryView`**

Найти `<HistoryView history={history} onRestore={handleRestoreHistory} />` и заменить на:

```jsx
        <HistoryView history={history} onRestore={handleRestoreHistory} studentId={studentId} />
```

- [ ] **Step 5: Ручная проверка в браузере**

1. Пройти полный цикл (чек + зоны сфотографированы, см. Task 4/5), затем на celebration «Всё куплено!» нажать «Начать новый список».
2. Открыть Покупки → История — новая запись должна показывать миниатюру чека (🧾) и миниатюры сфотографированных зон.
3. Тап по миниатюре открывает фото на весь экран; тап/клик по фону закрывает.
4. Запись, созданная до этой фичи (без `hasReceipt`/`zonePhotos`, если такая есть в тестовых данных) не показывает ряд миниатюр вообще.

Expected: все пункты подтверждаются.

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/PlannerShoppingScreen.jsx
git commit -m "feat(planner): archive trip photos into history, show thumbnails"
```

---

### Task 7: Гейтинг в хабе (`HomeScreen.jsx`)

**Files:**
- Modify: `src/features/home/HomeScreen.jsx`

**Interfaces:**
- Consumes: `getPendingReceiptPhoto`, `getPendingZonePhotoIds` (Task 2, `@/features/planner/plannerPhotos`); `getRequiredZones` (Task 1, `@/features/planner/putawayUtils`).

- [ ] **Step 1: Добавить импорты**

В `src/features/home/HomeScreen.jsx`, после строки:

```js
import { buildPutawayQueue } from "@/features/planner/putawayUtils";
```

заменить на:

```js
import { buildPutawayQueue, getRequiredZones } from "@/features/planner/putawayUtils";
import { getPendingReceiptPhoto, getPendingZonePhotoIds } from "@/features/planner/plannerPhotos";
```

- [ ] **Step 2: Обновить эффект вычисления `shoppingDone`/`putawayDone`**

Заменить текущий эффект (строки ~233-246):

```js
  useEffect(() => {
    if (!student) { setBoughtCount(0); setShoppingDone(false); setPutawayDone(false); return; }
    Promise.all([
      getPlannerShopPlan(student.id),
      getPlannerShopBought(student.id),
      getPlannerShopCustomData(student.id),
      getPlannerPutawayPlan(student.id),
    ]).then(([planned, bought, customData, putawayPlan]) => {
      setBoughtCount(Object.keys(bought ?? {}).length);
      setShoppingDone(isShoppingDone(planned, bought));
      const remainingQueue = customData ? buildPutawayQueue(customData, bought ?? {}, putawayPlan ?? {}) : [];
      setPutawayDone(Object.keys(bought ?? {}).length > 0 && remainingQueue.length === 0);
    });
  }, [student?.id]);
```

на:

```js
  useEffect(() => {
    if (!student) { setBoughtCount(0); setShoppingDone(false); setPutawayDone(false); return; }
    Promise.all([
      getPlannerShopPlan(student.id),
      getPlannerShopBought(student.id),
      getPlannerShopCustomData(student.id),
      getPlannerPutawayPlan(student.id),
      getPendingReceiptPhoto(student.id),
      getPendingZonePhotoIds(student.id),
    ]).then(([planned, bought, customData, putawayPlan, receiptPhoto, photographedZones]) => {
      setBoughtCount(Object.keys(bought ?? {}).length);
      setShoppingDone(isShoppingDone(planned, bought) && !!receiptPhoto);
      const remainingQueue = customData ? buildPutawayQueue(customData, bought ?? {}, putawayPlan ?? {}) : [];
      const requiredZones = getRequiredZones(putawayPlan ?? {});
      const zonesPhotographed = requiredZones.every((id) => photographedZones.includes(id));
      setPutawayDone(Object.keys(bought ?? {}).length > 0 && remainingQueue.length === 0 && zonesPhotographed);
    });
  }, [student?.id]);
```

- [ ] **Step 3: Ручная проверка в браузере**

1. Отметить все товары «взял» в «В магазине», но не фотографировать чек — вернуться на хаб. Карточка «В магазин» не должна показывать «Всё куплено» (должна оставаться `active`/«Список готов»), карточка «Раскладка» — оставаться `locked`.
2. Сфотографировать чек, вернуться на хаб — «В магазин» становится `done`, «Раскладка» разблокируется.
3. Пройти раскладку, но сфотографировать не все зоны, вернуться на хаб — «Раскладка» не становится `done`.
4. Сфотографировать оставшиеся зоны — «Раскладка» становится `done`, «Начать готовить» разблокируется (если остальные условия меню/покупок выполнены).

Expected: все пункты подтверждаются.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/HomeScreen.jsx
git commit -m "feat(planner): gate hub shoppingDone/putawayDone on photo confirmation"
```

---

### Task 8: Полный сквозной прогон (регрессия)

**Files:** (без изменений кода — только верификация)

- [ ] **Step 1: Запустить весь Vitest-набор**

Run: `npx vitest run`
Expected: все тесты проходят (включая `plannerUtils.test.js`, `plannerApi.test.js`, `putawayUtils.test.js`, `plannerPhotos.test.js` и весь остальной существующий набор) — 0 failures.

- [ ] **Step 2: Запустить lint**

Run: `npm run lint`
Expected: без новых ошибок в изменённых/новых файлах (`plannerPhotos.js`, `PhotoCaptureCard.jsx`, `PlannerShoppingScreen.jsx`, `PlannerPutawayScreen.jsx`, `putawayUtils.js`, `HomeScreen.jsx`).

- [ ] **Step 3: Сквозной ручной прогон в браузере (`run`-скилл)**

С нуля (свежий профиль браузера или очищенный студент): Меню (выбрать ≥1 рецепт на приём пищи) → Что купить? (отметить товары из ≥2 разных категорий, чтобы задействовать ≥2 зоны раскладки) → В магазин (отметить всё «взял» → сфотографировать чек) → Раскладка (разложить все товары → сфотографировать каждую задействованную зону) → хаб показывает «Начать готовить» разблокированным (если остальные условия готовности выполнены) → Покупки → История показывает новую запись с миниатюрами чека и зон → тап по миниатюре открывает полноэкранный просмотр.

Expected: ни один шаг не пропускает обязательное фото; в консоли браузера нет ошибок (`pageerror`/`console.error`) на всём протяжении сценария.

- [ ] **Step 4: Финальный commit (если что-то поправлено на этом шаге)**

Если Step 1-3 потребовали правок — закоммитить их отдельным коммитом с понятным сообщением (`fix(planner): ...`). Если правок не было — этот шаг пропускается.

---

## Self-Review Notes

- **Spec coverage:** все разделы дизайна (хранилище, сжатие, гейт чека, гейт зон, ужесточение `shoppingDone`/`putawayDone`, архивация в историю, миниатюры/просмотр, явные границы scope — без синка/бэкапа/чистки) покрыты Task 1–7; Task 8 — сквозная регрессия.
- **Type consistency:** `getRequiredZones(putawayPlan) => zoneId[]` (Task 1) используется с одинаковой сигнатурой в Task 5 (`getRequiredZones(putawayPlan)`) и Task 7 (`getRequiredZones(putawayPlan ?? {})`). `PhotoCaptureCard`'s `onConfirm(blob)` — единственная точка входа, используется одинаково в Task 4 (чек) и Task 5 (зона). `archiveTripPhotos` возвращает `{ hasReceipt, zonePhotos }` — то же имя полей используется в `entry` (Task 6) и в тесте (Task 2).
