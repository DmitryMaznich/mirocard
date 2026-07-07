# Раскладка: реалистичные фото мест хранения — design

## Context

`PlannerPutawayScreen.jsx` (Раскладка) teaches sorting bought groceries into one of six storage zones (`ZONES` in `putawayLocations.js`: Морозилка, Холодильник, Шкаф, Место для овощей, Шкаф бытовой химии, Стол). Today every zone tile shows a generic emoji pictogram (❄️, 🧊, 🌾, 🥔, 🧹, 🍎), and the product spotlight card shows the **shopping category** icon (e.g. 🥛 for "Молочные продукты") as a purely decorative badge — the original design (`2026-07-04-planner-putaway-design.md`) explicitly scoped out per-family photos as a "candidate follow-up, not built here."

This spec is that follow-up. Goal: replace the generic zone pictograms with a real photo of what that specific family's storage spot actually looks like (their own freezer door, their own cupboard), so the student recognizes it visually instead of decoding an abstract icon — and show that same photo on the product card too, so the two match at a glance.

This is unrelated to the existing per-trip "confirm you put things away" zone photos (`savePendingZonePhoto`/`getPendingZonePhotoIds` in `plannerPhotos.js`, captured after the sorting game, cleared every new menu cycle). Those photos show *products placed inside* a zone as proof of completion for a specific trip. The new photos show *what the zone looks like from outside* (the freezer door, the cupboard), captured once and reused forever.

## Scope

In scope:
- A new, permanent-until-replaced "zone reference photo" per `zoneId` per student (`plannerPhotos.js`).
- `PlannerPutawayScreen.jsx`: zone tiles show the reference photo (fallback to the existing emoji icon when none is set yet); a small 📷 badge on each tile opens capture/retake; the product spotlight card shows the destination zone's reference photo instead of the shopping-category icon.
- Removing the now-unused `categoryIcon` field from `buildPutawayQueue` (`putawayUtils.js`) and its test coverage.

Out of scope:
- A dedicated settings screen for pre-configuring zone photos before the first ever putaway session — setup happens inline on the Раскладка screen itself, the first time each zone tile is seen.
- Deleting a configured zone photo (only retake/replace).
- Any change to the existing per-trip putaway-confirmation photos, their storage, or their History display.
- Any change to the sorting game's mistake/hint mechanic (wrong-tap shake, escalating hint after 2 wrong taps) — kept exactly as is. It becomes a lighter-weight interaction now that the answer is visually recognizable, but the underlying tap/feedback code is unchanged.

## Design

### Storage: `plannerPhotos.js`

New functions, independent of the existing `pending_putaway_*`/`putaway_<tripId>_*` file namespace:

```js
export async function saveZoneReferencePhoto(studentId, zoneId, blob) {
  const db = await getDb();
  await topics.saveFile(db, photoTopic(studentId), `zone_reference_${zoneId}.jpg`, blob);
}

export async function getZoneReferencePhoto(studentId, zoneId) {
  const db = await getDb();
  return topics.getFile(db, photoTopic(studentId), `zone_reference_${zoneId}.jpg`);
}
```

Same `photoTopic(studentId)` IndexedDB topic already used for every other planner photo, just a new filename prefix (`zone_reference_` vs. `pending_putaway_`/`putaway_`) so the two concepts never collide. Never cleared by `clearPendingPhotos` or `archiveCycle` — persists across every cycle until explicitly retaken.

### `PlannerPutawayScreen.jsx`

**Loading reference photos:** on mount (once `studentId` is known), fetch all 6 zones' reference photos in parallel via `Promise.all(ZONES.map(z => getZoneReferencePhoto(studentId, z.id)))`, converting each present blob to an object URL. State: `zonePhotoUrls` — `{ [zoneId]: url }`, missing entries mean "no photo yet, show emoji". Revoke object URLs on unmount (same pattern as `CycleHistoryPhotoThumb` in `HomeScreen.jsx`). While this fetch is in flight, tiles simply show the emoji fallback (no loading spinner) — it resolves almost instantly from IndexedDB and the flicker is not worth a loading state.

**Zone tile (`.putaway-zone` button, rendered during the sorting-game phase):**
- Background/icon area shows `zonePhotoUrls[zone.id]` as an `<img>` if present, else the current `zone.icon` emoji — same conditional the product card uses (see below), factored into one small helper so both stay in sync.
- A small `📷` badge in the tile's corner, `onClick` with `e.stopPropagation()` (so it never triggers `handlePick`), opens the capture sheet for that zone. Present on every tile regardless of whether a photo already exists (doubles as "retake").

**Capture sheet:** a small overlay (same `portions-sheet-backdrop`/`portions-sheet` shell already used elsewhere in Planner) hosting the existing `PhotoCaptureCard` component, title `` `Сфотографируй: ${zone.label}` ``. On confirm: `await saveZoneReferencePhoto(studentId, zoneId, blob)`, revoke the old object URL for that zone (if any), set the new one in `zonePhotoUrls`, close the sheet. No new photo-processing code — reuses `PhotoCaptureCard`'s existing `resizeToBlob` pipeline exactly as the other two photo features do.

**Product spotlight card:** replace `current.categoryIcon` with `zonePhotoUrls[current.zoneId]` (as an `<img>`) or `ZONES.find(z => z.id === current.zoneId).icon` as fallback — the same lookup/fallback helper as the tiles, so the product card and the correct tile always show the identical image.

**Sorting game mechanic:** unchanged. `handlePick`, the wrong-tap shake, and the 2-strikes hint escalation stay exactly as implemented today.

### `putawayUtils.js`

`buildPutawayQueue` drops the now-unused `categoryIcon: CATEGORY_ICONS[category] ?? '📦'` field from each queued item (nothing reads it once the spotlight card switches to the zone lookup). `CATEGORY_ICONS` import removed if this was its only use in the file.

## Testing

- `putawayUtils.test.js`: update any assertion on `categoryIcon` to reflect its removal.
- New `plannerPhotos.test.js` cases: `saveZoneReferencePhoto`/`getZoneReferencePhoto` round-trip; confirms `clearPendingPhotos`/`archiveCycle`-adjacent flows never touch `zone_reference_*` files (i.e. a saved reference photo survives a call to `clearPendingPhotos`).
- Manual verification via the `run` skill in the browser:
  1. First-ever putaway session, no zones configured yet — every tile and the product card show the plain emoji, no broken image, no console errors.
  2. Tap 📷 on one tile, take/pick a photo, confirm — that tile immediately shows the photo; the product card (if its `zoneId` matches) shows the same photo.
  3. Close the cycle ("Начать новое меню") and start a fresh one with new bought items requiring the same zone — the configured photo is still there (proves it's cycle-independent, unlike the per-trip confirmation photos).
  4. Tap 📷 again on an already-configured tile and take a different photo — it replaces the old one (old object URL revoked, no memory-leak console warnings).
