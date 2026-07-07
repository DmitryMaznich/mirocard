import { describe, it, expect } from 'vitest';
import {
  savePendingReceiptPhoto, getPendingReceiptPhoto,
  savePendingZonePhoto, getPendingZonePhoto, getPendingZonePhotoIds,
  archiveTripPhotos, getTripReceiptPhoto, getTripZonePhoto,
  resizeToBlob,
  saveZoneReferencePhoto, getZoneReferencePhoto,
  clearPendingPhotos,
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

describe('clearPendingPhotos', () => {
  it('removes pending receipt and zone photos but keeps archived trip photos', async () => {
    await savePendingReceiptPhoto('student-g', fakeBlob('pending-receipt'));
    await savePendingZonePhoto('student-g', 'fridge', fakeBlob('pending-fridge'));
    await archiveTripPhotos('student-g', 555); // archives a copy under receipt_555.jpg / putaway_555_fridge.jpg

    await clearPendingPhotos('student-g');

    expect(await getPendingReceiptPhoto('student-g')).toBeNull();
    expect(await getPendingZonePhotoIds('student-g')).toEqual([]);
    expect(await getTripReceiptPhoto('student-g', 555)).toBeInstanceOf(Blob);
    expect(await getTripZonePhoto('student-g', 555, 'fridge')).toBeInstanceOf(Blob);
  });

  it('does nothing when there is nothing pending', async () => {
    await clearPendingPhotos('student-h');
    expect(await getPendingReceiptPhoto('student-h')).toBeNull();
  });
});
