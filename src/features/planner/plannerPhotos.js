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

// Marks the receipt step as explicitly skipped ("Без чека") — a distinct
// marker file, not a fake photo, so archiveTripPhotos' hasReceipt keeps
// honestly reflecting whether a real photo exists. Everything that gates
// on "is the receipt step resolved" (В магазине's own screen, the hub's
// shoppingDone) must check isPendingReceiptResolved, not this file alone.
export async function markPendingReceiptSkipped(studentId) {
  const db = await getDb();
  await topics.saveFile(db, photoTopic(studentId), 'pending_receipt.skipped', new Blob([]));
}

export async function isPendingReceiptResolved(studentId) {
  const db = await getDb();
  const photo = await topics.getFile(db, photoTopic(studentId), 'pending_receipt.jpg');
  if (photo) return true;
  return !!(await topics.getFile(db, photoTopic(studentId), 'pending_receipt.skipped'));
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
      .filter((f) => f.startsWith(prefix) && f.endsWith('.jpg'))
      .map((f) => f.slice(prefix.length, -'.jpg'.length))
  );
  return ZONES.map((z) => z.id).filter((id) => ids.has(id));
}

// Marks one zone's placement-confirmation photo as explicitly skipped — same
// marker-file approach as markPendingReceiptSkipped, for the same reason.
export async function markPendingZoneSkipped(studentId, zoneId) {
  const db = await getDb();
  await topics.saveFile(db, photoTopic(studentId), `pending_putaway_${zoneId}.skipped`, new Blob([]));
}

// Zones that no longer need a placement-confirmation photo — either a real
// one was taken (getPendingZonePhotoIds) or the step was explicitly skipped.
// Use this (not getPendingZonePhotoIds) anywhere the question is "is this
// zone resolved" rather than "does a real photo exist for this zone" —
// archiveTripPhotos deliberately keeps using getPendingZonePhotoIds directly
// since it only ever archives real photos.
export async function getResolvedZoneIds(studentId) {
  const db = await getDb();
  const photographed = await getPendingZonePhotoIds(studentId);
  const files = await topics.listFiles(db, photoTopic(studentId));
  const prefix = 'pending_putaway_';
  const suffix = '.skipped';
  const skipped = files
    .filter((f) => f.startsWith(prefix) && f.endsWith(suffix))
    .map((f) => f.slice(prefix.length, -suffix.length));
  return ZONES.map((z) => z.id).filter((id) => photographed.includes(id) || skipped.includes(id));
}

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

export async function clearPendingPhotos(studentId) {
  const db = await getDb();
  await topics.deleteFile(db, photoTopic(studentId), 'pending_receipt.jpg');
  await topics.deleteFile(db, photoTopic(studentId), 'pending_receipt.skipped');
  const zoneIds = await getResolvedZoneIds(studentId);
  for (const zoneId of zoneIds) {
    await topics.deleteFile(db, photoTopic(studentId), `pending_putaway_${zoneId}.jpg`);
    await topics.deleteFile(db, photoTopic(studentId), `pending_putaway_${zoneId}.skipped`);
  }
}
