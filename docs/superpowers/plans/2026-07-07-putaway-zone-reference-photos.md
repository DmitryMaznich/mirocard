# Раскладка: реалистичные фото мест хранения — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic zone pictograms in Раскладка (Морозилка/Холодильник/etc.) with a real, once-configured photo of that family's actual storage spot, shown on both the zone tile and the product spotlight card, so the student recognizes it visually instead of decoding an abstract icon.

**Architecture:** A new, permanent (never auto-cleared) "zone reference photo" per `zoneId` per student, stored in the same IndexedDB topic the other planner photos already use (`plannerPhotos.js`), under a distinct filename prefix so it never collides with the existing per-trip putaway-confirmation photos. `PlannerPutawayScreen.jsx` gets a small reusable `ZonePhoto` subcomponent (loads its own blob → object URL, revokes on unmount/change — same pattern as `HomeScreen.jsx`'s `CycleHistoryPhotoThumb`) used both on the 6 zone tiles and on the product spotlight card, plus a small 📷 badge per tile that opens the existing `PhotoCaptureCard` in a sheet to set/replace that zone's photo.

**Tech Stack:** React 19 (hooks, no new deps), Vitest, existing `IndexedDB` `topics` store (`src/core/db.js`), existing `PhotoCaptureCard` component.

## Global Constraints

- New zone reference photos must never be cleared by `clearPendingPhotos` or `archiveCycle` — they persist across every cycle until explicitly retaken (confirmed design decision).
- No new settings screen — configuring/replacing a zone photo happens inline on the Раскладка screen via a small 📷 badge on each zone tile (confirmed design decision).
- The existing sorting-game mechanic (tap-to-place, wrong-tap shake, 2-strikes hint escalation) is unchanged code-wise — only what's displayed on the tiles/card changes.
- Product spotlight card and the matching zone tile must show the identical image (same lookup, same fallback), never two different assets for the same zone.

---

### Task 1: Zone reference photo storage (`plannerPhotos.js`)

**Files:**
- Modify: `src/features/planner/plannerPhotos.js:16-38` (insert new functions after `getPendingZonePhotoIds`, before `archiveTripPhotos`)
- Test: `src/features/planner/plannerPhotos.test.js`

**Interfaces:**
- Produces: `saveZoneReferencePhoto(studentId, zoneId, blob): Promise<void>`, `getZoneReferencePhoto(studentId, zoneId): Promise<Blob|null>` — consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/planner/plannerPhotos.test.js`, right after the closing `});` of the `describe('pending zone photos', ...)` block (after line 38):

```js
describe('zone reference photos', () => {
  it('returns null when nothing has been saved yet', async () => {
    expect(await getZoneReferencePhoto('student-zref-a', 'fridge')).toBeNull();
  });

  it('round-trips a saved photo', async () => {
    await saveZoneReferencePhoto('student-zref-b', 'freezer', fakeBlob('freezer-door'));
    const blob = await getZoneReferencePhoto('student-zref-b', 'freezer');
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe('freezer-door');
  });

  it('replacing a photo overwrites the previous one', async () => {
    await saveZoneReferencePhoto('student-zref-c', 'pantry', fakeBlob('old-pantry-photo'));
    await saveZoneReferencePhoto('student-zref-c', 'pantry', fakeBlob('new-pantry-photo'));
    const blob = await getZoneReferencePhoto('student-zref-c', 'pantry');
    expect(await blob.text()).toBe('new-pantry-photo');
  });

  it('is not touched by clearPendingPhotos', async () => {
    await saveZoneReferencePhoto('student-zref-d', 'fridge', fakeBlob('fridge-door'));
    await savePendingReceiptPhoto('student-zref-d', fakeBlob('some-receipt'));

    await clearPendingPhotos('student-zref-d');

    expect(await getPendingReceiptPhoto('student-zref-d')).toBeNull(); // pending state did get cleared
    const stillThere = await getZoneReferencePhoto('student-zref-d', 'fridge');
    expect(await stillThere.text()).toBe('fridge-door'); // reference photo survives
  });
});
```

Also update the import at the top of the test file (line 2-7) to include the two new functions:

```js
import {
  savePendingReceiptPhoto, getPendingReceiptPhoto,
  savePendingZonePhoto, getPendingZonePhoto, getPendingZonePhotoIds,
  archiveTripPhotos, getTripReceiptPhoto, getTripZonePhoto,
  resizeToBlob,
  saveZoneReferencePhoto, getZoneReferencePhoto,
  clearPendingPhotos,
} from './plannerPhotos.js';
```

(This also lets you delete the redundant `import { clearPendingPhotos } from './plannerPhotos.js';` currently sitting on its own at line 105 — fold it into this one top import instead.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/planner/plannerPhotos.test.js`
Expected: FAIL — `saveZoneReferencePhoto is not a function` / `getZoneReferencePhoto is not a function`.

- [ ] **Step 3: Implement the functions**

In `src/features/planner/plannerPhotos.js`, insert right after the `getPendingZonePhotoIds` function (after line 38, before the `// Copies this session's pending photos...` comment):

```js
// Permanent "what does this zone actually look like" reference photo —
// unrelated to the pending_putaway_* files above (those are per-trip
// proof-of-placement and get archived/cleared every cycle). This one is
// set once by an adult and reused forever until explicitly retaken.
export async function saveZoneReferencePhoto(studentId, zoneId, blob) {
  const db = await getDb();
  await topics.saveFile(db, photoTopic(studentId), `zone_reference_${zoneId}.jpg`, blob);
}

export async function getZoneReferencePhoto(studentId, zoneId) {
  const db = await getDb();
  return topics.getFile(db, photoTopic(studentId), `zone_reference_${zoneId}.jpg`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/planner/plannerPhotos.test.js`
Expected: PASS (all tests in the file, including the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/plannerPhotos.js src/features/planner/plannerPhotos.test.js
git commit -m "feat(planner): add persistent zone reference photo storage"
```

---

### Task 2: Drop the now-superseded `categoryIcon` field

**Files:**
- Modify: `src/features/planner/putawayUtils.js`
- Test: `src/features/planner/putawayUtils.test.js:17-23`

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildPutawayQueue(...)` items no longer have a `categoryIcon` field — Task 3's `PlannerPutawayScreen.jsx` must not read `current.categoryIcon` after this task (it will read `current.zoneId` through `ZonePhoto` instead).

- [ ] **Step 1: Update the test to drop the field first (TDD red)**

In `src/features/planner/putawayUtils.test.js`, change the first test (lines 17-23) from:

```js
  it('includes a bought item that has a known zone', () => {
    const cd = customData([{ name: 'Молочные продукты', items: ['молоко'] }]);
    const queue = buildPutawayQueue(cd, { 'Молочные продукты_0': true }, {});
    expect(queue).toEqual([
      { key: 'Молочные продукты_0', category: 'Молочные продукты', product: 'молоко', zoneId: 'fridge', categoryIcon: '🥛' },
    ]);
  });
```

to:

```js
  it('includes a bought item that has a known zone', () => {
    const cd = customData([{ name: 'Молочные продукты', items: ['молоко'] }]);
    const queue = buildPutawayQueue(cd, { 'Молочные продукты_0': true }, {});
    expect(queue).toEqual([
      { key: 'Молочные продукты_0', category: 'Молочные продукты', product: 'молоко', zoneId: 'fridge' },
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/planner/putawayUtils.test.js`
Expected: FAIL on the first test — actual object still has `categoryIcon: '🥛'`, expected doesn't.

- [ ] **Step 3: Remove the field from the implementation**

In `src/features/planner/putawayUtils.js`, change:

```js
import { customDataToSteps, CATEGORY_ICONS } from './plannerShoppingUtils.js';
import { getZoneForProduct, ZONES } from './putawayLocations.js';
```

to:

```js
import { customDataToSteps } from './plannerShoppingUtils.js';
import { getZoneForProduct, ZONES } from './putawayLocations.js';
```

and change:

```js
      const zoneId = getZoneForProduct(category, product);
      if (!zoneId) return;
      queue.push({ key, category, product, zoneId, categoryIcon: CATEGORY_ICONS[category] ?? '📦' });
```

to:

```js
      const zoneId = getZoneForProduct(category, product);
      if (!zoneId) return;
      queue.push({ key, category, product, zoneId });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/planner/putawayUtils.test.js`
Expected: PASS (all tests, including the ones that never referenced `categoryIcon`).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/putawayUtils.js src/features/planner/putawayUtils.test.js
git commit -m "refactor(planner): drop unused categoryIcon from putaway queue items"
```

---

### Task 3: Show zone photos in `PlannerPutawayScreen.jsx`

**Files:**
- Modify: `src/features/planner/PlannerPutawayScreen.jsx` (whole file rewritten below in pieces)
- Modify: `src/features/planner/planner.css:1455-1518` (add photo/badge/sheet styles)

**Interfaces:**
- Consumes: `saveZoneReferencePhoto`, `getZoneReferencePhoto` (Task 1); `buildPutawayQueue` items without `categoryIcon` (Task 2); existing `PhotoCaptureCard` (`onConfirm(blob)` prop contract, unchanged).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Add the `ZonePhoto` subcomponent and its imports**

In `src/features/planner/PlannerPutawayScreen.jsx`, change the top imports from:

```js
import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getPlannerShopCustomData, getPlannerShopBought, getPlannerPutawayPlan, savePlannerPutawayPlan } from '@/core/groupStore';
import { buildPutawayQueue, getRequiredZones } from './putawayUtils.js';
import { ZONES } from './putawayLocations.js';
import { getPendingZonePhotoIds, savePendingZonePhoto } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import './planner.css';

export default function PlannerPutawayScreen() {
```

to:

```js
import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getPlannerShopCustomData, getPlannerShopBought, getPlannerPutawayPlan, savePlannerPutawayPlan } from '@/core/groupStore';
import { buildPutawayQueue, getRequiredZones } from './putawayUtils.js';
import { ZONES } from './putawayLocations.js';
import { getPendingZonePhotoIds, savePendingZonePhoto, getZoneReferencePhoto, saveZoneReferencePhoto } from './plannerPhotos.js';
import PhotoCaptureCard from './PhotoCaptureCard.jsx';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import './planner.css';

// Loads (and re-loads when `version` bumps) one zone's permanent reference
// photo. Same load-blob/create-object-URL/revoke-on-cleanup shape as
// HomeScreen.jsx's CycleHistoryPhotoThumb — kept local here since nothing
// outside this screen needs it.
function ZonePhoto({ studentId, zoneId, version, className, fallback }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    getZoneReferencePhoto(studentId, zoneId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [studentId, zoneId, version]);

  if (!url) return fallback;
  return <img src={url} className={className} alt="" />;
}

export default function PlannerPutawayScreen() {
```

- [ ] **Step 2: Add state for photo versions and the editing sheet**

Change:

```js
  const [photographedZones, setPhotographedZones] = useState([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
```

to:

```js
  const [photographedZones, setPhotographedZones] = useState([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [zonePhotoVersions, setZonePhotoVersions] = useState({});
  const [editingZoneId, setEditingZoneId] = useState(null);
```

`zonePhotoVersions` is `{ [zoneId]: number }` — bumping a zone's counter forces its `ZonePhoto` instances (tile + product card, wherever currently mounted) to re-fetch after a save, since `version` is in `ZonePhoto`'s effect dependency array.

- [ ] **Step 3: Add the save handler**

Right after the `handlePick` function (after line 78, before `if (loading) return ...`), add:

```js
  function handleZonePhotoConfirm(zoneId) {
    return async (blob) => {
      await saveZoneReferencePhoto(studentId, zoneId, blob);
      setZonePhotoVersions((prev) => ({ ...prev, [zoneId]: (prev[zoneId] ?? 0) + 1 }));
      setEditingZoneId(null);
    };
  }
```

- [ ] **Step 4: Show the photo (or fallback icon) on the product spotlight card**

Change:

```jsx
          <div className="putaway-card">
            <div className="putaway-card__icon">{current.categoryIcon}</div>
            <div className="putaway-card__name">{current.product}</div>
          </div>
```

to:

```jsx
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
```

- [ ] **Step 5: Show the photo (or fallback icon) and the 📷 badge on each zone tile**

Change:

```jsx
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
```

to:

```jsx
          <div className="putaway-zones">
            {ZONES.map((zone) => (
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
```

- [ ] **Step 6: Render the capture sheet when a zone is being edited**

The component currently ends with this exact sequence (the `)}` closes the big `{!current ? (...) : (...)}` conditional, the `</div>` closes `<div className="screen planner-screen">`):

```jsx
        </div>
      )}
    </div>
  );
}
```

Change it to insert the sheet between the `)}` and the closing `</div>`:

```jsx
        </div>
      )}

      {editingZoneId && (
        <div className="portions-sheet-backdrop" onClick={() => setEditingZoneId(null)}>
          <div className="portions-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="portions-sheet__handle" />
            <PhotoCaptureCard
              key={editingZoneId}
              title={`Сфотографируй: ${ZONES.find((z) => z.id === editingZoneId).label}`}
              hint="Так ученик быстрее узнает своё место"
              maxDim={1280}
              quality={0.75}
              onConfirm={handleZonePhotoConfirm(editingZoneId)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Add CSS for the photo, camera badge, and photo on the product card**

In `src/features/planner/planner.css`, right after the `.putaway-card__icon` rule (after line 1471, before `.putaway-card__name`), add:

```css
.putaway-card__photo {
  width: 100px;
  height: 100px;
  border-radius: 16px;
  object-fit: cover;
}
```

Right after `.putaway-zone` (after line 1502, before `.putaway-zone:active`), change `.putaway-zone` to add `position: relative`:

```css
.putaway-zone {
  position: relative;
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
```

Right after `.putaway-zone__icon` (after line 1510, before `.putaway-zone__label`), add:

```css
.putaway-zone__photo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
}

.putaway-zone__camera-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(38, 49, 49, 0.55);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
```

- [ ] **Step 8: Verify existing unit tests still pass**

Run: `npx vitest run src/features/planner`
Expected: PASS (no test directly renders `PlannerPutawayScreen.jsx` today, so this mainly guards `putawayUtils`/`plannerPhotos` from Tasks 1-2 regressing).

- [ ] **Step 9: Manual browser verification**

Using the `run` skill (Playwright driver already established in this project's scratchpad), seed a student with a bought item requiring a zone (e.g. молоко → fridge), open Раскладка:
1. Confirm the fridge tile shows the 🧊 emoji and the product card shows the same emoji (no photo configured yet) — no broken `<img>`, no console errors.
2. Tap the 📷 badge on the fridge tile, pick/take a photo, confirm — the tile immediately swaps to that photo; if the current product's `zoneId` is `fridge`, the product card shows the same photo too.
3. Correctly place the item (tap the fridge tile body, not the badge) — advances to next item as before.
4. Close the cycle ("Начать новое меню") and re-enter Раскладка with a new bought item that also needs `fridge` — the configured photo is still there (survives `archiveCycle`/`clearPendingPhotos`).
5. Tap the 📷 badge again on the same tile, take a different photo — it replaces the old one on the tile.

Expected: all steps behave as described, no errors in `CONSOLE_ERRORS` output.

- [ ] **Step 10: Commit**

```bash
git add src/features/planner/PlannerPutawayScreen.jsx src/features/planner/planner.css
git commit -m "feat(planner): show real zone photos on putaway tiles and product card"
```

---

## Self-Review Notes

- **Spec coverage:** persistent zone-photo storage independent of per-trip photos (Task 1), removal of the now-decorative `categoryIcon` (Task 2), zone tiles + product card showing the same photo with emoji fallback, inline 📷 capture/retake per tile, sorting-game mechanic untouched (Task 3). No settings screen, no delete-only-retake — matches the confirmed design decisions.
- **Type consistency:** `saveZoneReferencePhoto(studentId, zoneId, blob)` / `getZoneReferencePhoto(studentId, zoneId)` signatures match between Task 1 (impl + test) and Task 3 (`ZonePhoto`, `handleZonePhotoConfirm`). `ZonePhoto`'s props (`studentId, zoneId, version, className, fallback`) are used identically at both call sites in Task 3.
- **Ambiguity check:** the "same helper" mentioned in the spec for tile/product-card photo lookup is now the concrete `ZonePhoto` component, used identically (same `zoneId`, same `version` map) at both sites — guarantees they never show different images for the same zone.
