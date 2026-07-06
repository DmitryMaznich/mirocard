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
