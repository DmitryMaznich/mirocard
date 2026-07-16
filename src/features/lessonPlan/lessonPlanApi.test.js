import { describe, it, expect } from 'vitest';
import {
  getPeriodPlans, savePeriodPlans, getActivePeriodPlan, startPeriodPlan,
  addPeriodItem, closePeriodPlan, addPeriodNote,
} from './lessonPlanApi.js';

describe('getPeriodPlans / getActivePeriodPlan', () => {
  it('returns an empty array and null when nothing is stored', async () => {
    expect(await getPeriodPlans('lp-student-empty')).toEqual([]);
    expect(await getActivePeriodPlan('lp-student-empty')).toBeNull();
  });
});

describe('startPeriodPlan', () => {
  it('creates a new active period and persists it', async () => {
    const studentId = 'lp-student-start-1';
    const period = await startPeriodPlan(studentId, 7);
    expect(period.status).toBe('active');
    expect(period.durationDays).toBe(7);
    expect(await getPeriodPlans(studentId)).toEqual([period]);
  });

  it('returns the existing active period instead of creating a duplicate', async () => {
    const studentId = 'lp-student-start-2';
    const first = await startPeriodPlan(studentId, 7);
    const second = await startPeriodPlan(studentId, 7);
    expect(second.id).toBe(first.id);
    expect(await getPeriodPlans(studentId)).toHaveLength(1);
  });
});

describe('addPeriodItem', () => {
  it('appends an item to the active period and initializes its progress', async () => {
    const studentId = 'lp-student-additem-1';
    await startPeriodPlan(studentId, 7);
    const updated = await addPeriodItem(studentId, { kind: 'freeform', text: 'Порисовать' });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].text).toBe('Порисовать');
    expect(updated.progress[updated.items[0].id]).toEqual({ count: 0, notes: [] });
  });

  it('throws when there is no active period', async () => {
    await expect(addPeriodItem('lp-student-additem-none', { kind: 'freeform', text: 'X' }))
      .rejects.toThrow();
  });
});

describe('addPeriodNote', () => {
  it('appends a timestamped note to the item progress', async () => {
    const studentId = 'lp-student-note-1';
    await startPeriodPlan(studentId, 7);
    const period = await addPeriodItem(studentId, { kind: 'freeform', text: 'X' });
    const itemId = period.items[0].id;
    await addPeriodNote(studentId, itemId, 'хорошо получалось');
    const reloaded = await getActivePeriodPlan(studentId);
    expect(reloaded.progress[itemId].notes).toEqual([
      { text: 'хорошо получалось', at: expect.any(Number) },
    ]);
  });
});

describe('closePeriodPlan', () => {
  it('closes the active period and starts a new one carrying only the given items', async () => {
    const studentId = 'lp-student-close-1';
    await startPeriodPlan(studentId, 7);
    let period = await addPeriodItem(studentId, { kind: 'freeform', text: 'Touched' });
    period = await addPeriodItem(studentId, { kind: 'freeform', text: 'Untouched' });
    const [touchedItem, untouchedItem] = period.items;

    // Simulate the touched item having progress via a direct save (session-plan
    // wiring that produces this is covered in Task 3's tests).
    const periods = await getPeriodPlans(studentId);
    periods[0].progress[touchedItem.id] = { count: 3, notes: [] };
    await savePeriodPlans(studentId, periods);

    const carried = await closePeriodPlan(studentId, [untouchedItem.id]);

    expect(carried.status).toBe('active');
    expect(carried.items).toHaveLength(1);
    expect(carried.items[0].text).toBe('Untouched');
    expect(carried.carriedFromPeriodId).toBe(period.id);

    const all = await getPeriodPlans(studentId);
    expect(all).toHaveLength(2);
    expect(all[0].status).toBe('closed');
    expect(all[0].closedAt).toEqual(expect.any(Number));
    expect(all[1].id).toBe(carried.id);
  });

  it('returns null when there is no active period to close', async () => {
    expect(await closePeriodPlan('lp-student-close-none', [])).toBeNull();
  });
});
