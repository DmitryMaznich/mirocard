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
