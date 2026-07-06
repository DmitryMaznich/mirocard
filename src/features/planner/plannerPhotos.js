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
  const zoneIds = await getPendingZonePhotoIds(studentId);
  for (const zoneId of zoneIds) {
    await topics.deleteFile(db, photoTopic(studentId), `pending_putaway_${zoneId}.jpg`);
  }
}
