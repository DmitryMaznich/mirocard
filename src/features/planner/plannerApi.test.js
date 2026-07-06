import { describe, it, expect } from 'vitest';
import { resetShoppingData, archiveShoppingTrip, archiveCycle, formatCycleDateRange } from './plannerApi.js';
import {
  savePlannerShopCustomData, getPlannerShopCustomData,
  savePlannerShopPlan, getPlannerShopPlan,
  savePlannerShopBought, getPlannerShopBought,
  savePlannerPutawayPlan, getPlannerPutawayPlan,
  savePlannerShopMenuKeys, getPlannerShopMenuKeys,
  savePlannerShopStores,
  getPlannerCycleTrips, getPlannerCycleHistory,
} from '@/core/groupStore';
import { savePendingZonePhoto } from './plannerPhotos.js';

function fakeBlob(content) {
  return new Blob([content], { type: 'image/jpeg' });
}

describe('resetShoppingData', () => {
  it('clears customData, planned, bought, putaway plan, and menu keys', async () => {
    const studentId = 'test-student-reset-1';
    await savePlannerShopCustomData(studentId, { categories: [{ id: 'x', name: 'X', icon: '📦', subgroups: [] }] });
    await savePlannerShopPlan(studentId, { 'X_0': true });
    await savePlannerShopBought(studentId, { 'X_0': true });
    await savePlannerPutawayPlan(studentId, { 'X_0': 'fridge' });
    await savePlannerShopMenuKeys(studentId, ['X_0']);

    await resetShoppingData(studentId);

    expect(await getPlannerShopCustomData(studentId)).toBeNull();
    expect(await getPlannerShopPlan(studentId)).toEqual({});
    expect(await getPlannerShopBought(studentId)).toEqual({});
    expect(await getPlannerPutawayPlan(studentId)).toEqual({});
    expect(await getPlannerShopMenuKeys(studentId)).toEqual([]);
  });
});

describe('formatCycleDateRange', () => {
  it('shows a single date when start and end are the same day', () => {
    const d = new Date('2026-07-05T12:00:00.000Z');
    expect(formatCycleDateRange(d, d)).toBe('5 июля');
  });

  it('shows a range when start and end are different days', () => {
    const start = new Date('2026-07-05T12:00:00.000Z');
    const end = new Date('2026-07-08T12:00:00.000Z');
    expect(formatCycleDateRange(start, end)).toBe('5 июля — 8 июля');
  });
});

describe('archiveShoppingTrip', () => {
  it('returns null and archives nothing when the shopping plan is empty', async () => {
    const studentId = 'test-student-trip-1';
    const result = await archiveShoppingTrip(studentId, 'Пятёрочка');
    expect(result).toBeNull();
    expect(await getPlannerCycleTrips(studentId)).toEqual([]);
  });

  it('appends a trip built from the current plan, without clearing it', async () => {
    const studentId = 'test-student-trip-2';
    await savePlannerShopPlan(studentId, { 'Овощи_0': true, 'Овощи_1': true });
    const trip = await archiveShoppingTrip(studentId, 'Ашан');
    expect(trip).toMatchObject({ store: 'Ашан', count: 2, hasReceipt: false, zonePhotos: [] });
    const trips = await getPlannerCycleTrips(studentId);
    expect(trips).toHaveLength(1);
    expect(trips[0]).toEqual(trip);
    expect(await getPlannerShopPlan(studentId)).toEqual({ 'Овощи_0': true, 'Овощи_1': true }); // not cleared here
  });

  it('accumulates multiple trips across calls instead of overwriting', async () => {
    const studentId = 'test-student-trip-3';
    await savePlannerShopPlan(studentId, { 'Овощи_0': true });
    await archiveShoppingTrip(studentId, 'Пятёрочка');
    await savePlannerShopPlan(studentId, { 'Молочные продукты_0': true });
    await archiveShoppingTrip(studentId, 'Ашан');
    const trips = await getPlannerCycleTrips(studentId);
    expect(trips).toHaveLength(2);
    expect(trips.map((t) => t.store)).toEqual(['Пятёрочка', 'Ашан']);
  });
});

describe('archiveCycle', () => {
  it('returns null and archives nothing for a cycle with no trips and no recipes', async () => {
    const studentId = 'test-student-cycle-1';
    const plan = { createdAt: new Date().toISOString() };
    const result = await archiveCycle(studentId, plan, [], new Set());
    expect(result).toBeNull();
    expect(await getPlannerCycleHistory(studentId)).toEqual([]);
  });

  it('archives the still-open trip before building the entry, then clears the accumulator', async () => {
    const studentId = 'test-student-cycle-2';
    await savePlannerShopPlan(studentId, { 'Овощи_0': true });
    await savePlannerShopStores(studentId, { current: 'Пятёрочка', list: [] });
    const plan = { createdAt: new Date().toISOString() };
    const recipe = { text: { id: 'soup_01', title: { ru: 'Суп' } } };

    const entry = await archiveCycle(studentId, plan, [recipe], new Set(['soup_01']));

    expect(entry.trips).toHaveLength(1);
    expect(entry.trips[0].store).toBe('Пятёрочка');
    expect(entry.recipes).toEqual([{ textId: 'soup_01', title: { ru: 'Суп' }, cooked: true }]);
    expect(await getPlannerCycleTrips(studentId)).toEqual([]);
    expect(await getPlannerCycleHistory(studentId)).toEqual([entry]);
  });

  it('merges zone photos across trips, keeping the latest trip per zone', async () => {
    const studentId = 'test-student-cycle-3';
    const plan = { createdAt: new Date().toISOString() };

    await savePlannerShopPlan(studentId, { 'Овощи_0': true });
    await savePendingZonePhoto(studentId, 'fridge', fakeBlob('trip1-fridge'));
    await archiveShoppingTrip(studentId, 'Пятёрочка');

    await savePlannerShopPlan(studentId, { 'Молочные продукты_0': true });
    await savePendingZonePhoto(studentId, 'fridge', fakeBlob('trip2-fridge'));
    await savePendingZonePhoto(studentId, 'freezer', fakeBlob('trip2-freezer'));
    await archiveShoppingTrip(studentId, 'Ашан');
    // Real callers always clear planned right after archiving a trip (see
    // handleNewListAfterShop) — without this, archiveCycle below would find
    // the same still-non-empty plan and archive a spurious third trip.
    await savePlannerShopPlan(studentId, {});

    const entry = await archiveCycle(studentId, plan, [], new Set());

    const fridgeEntry = entry.zonePhotos.find((z) => z.zoneId === 'fridge');
    expect(fridgeEntry.tripId).toBe(entry.trips[1].tripId);
    expect(entry.zonePhotos.find((z) => z.zoneId === 'freezer').tripId).toBe(entry.trips[1].tripId);
  });
});
