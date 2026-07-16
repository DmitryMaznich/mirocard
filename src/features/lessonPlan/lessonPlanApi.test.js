import { describe, it, expect } from 'vitest';
import {
  getPeriodPlans, savePeriodPlans, getActivePeriodPlan, startPeriodPlan,
  addPeriodItem, closePeriodPlan, addPeriodNote,
  getSessionPlans, saveSessionPlans, getActiveSessionPlan, getSessionsForPeriod,
  startSessionPlan, setSessionItemDone, closeSessionPlan,
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

describe('startSessionPlan', () => {
  it('builds items from period selections and adhoc texts', async () => {
    const studentId = 'lp-student-session-1';
    await startPeriodPlan(studentId, 7);
    const period = await addPeriodItem(studentId, { kind: 'freeform', text: 'Звук Р' });

    const plan = await startSessionPlan(studentId, {
      periodItemIds: [period.items[0].id],
      adhocTexts: ['Повторить стишок'],
      periodPlanId: period.id,
    });

    expect(plan.status).toBe('active');
    expect(plan.periodPlanId).toBe(period.id);
    expect(plan.items).toHaveLength(2);
    const periodItem = plan.items.find((i) => i.origin === 'period');
    expect(periodItem.text).toBe('Звук Р');
    expect(periodItem.periodItemId).toBe(period.items[0].id);
    expect(periodItem.done).toBe(false);
    const adhocItem = plan.items.find((i) => i.origin === 'adhoc');
    expect(adhocItem.text).toBe('Повторить стишок');
  });

  it('edits the existing active plan in place instead of creating a duplicate', async () => {
    const studentId = 'lp-student-session-2';
    await startPeriodPlan(studentId, 7);
    const period = await addPeriodItem(studentId, { kind: 'freeform', text: 'Звук Р' });
    const first = await startSessionPlan(studentId, {
      periodItemIds: [period.items[0].id], adhocTexts: [], periodPlanId: period.id,
    });

    const second = await startSessionPlan(studentId, {
      periodItemIds: [], adhocTexts: ['Новая задача'], periodPlanId: period.id,
    });

    expect(second.id).toBe(first.id);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].text).toBe('Новая задача');
    expect(await getSessionPlans(studentId)).toHaveLength(1);
  });

  it('preserves done state of a period item that stays checked across an edit', async () => {
    const studentId = 'lp-student-session-3';
    await startPeriodPlan(studentId, 7);
    const period = await addPeriodItem(studentId, { kind: 'freeform', text: 'Звук Р' });
    let plan = await startSessionPlan(studentId, {
      periodItemIds: [period.items[0].id], adhocTexts: [], periodPlanId: period.id,
    });
    await setSessionItemDone(studentId, plan.items[0].id, true);

    plan = await startSessionPlan(studentId, {
      periodItemIds: [period.items[0].id], adhocTexts: ['X'], periodPlanId: period.id,
    });

    const periodItem = plan.items.find((i) => i.origin === 'period');
    expect(periodItem.done).toBe(true);
  });
});

describe('setSessionItemDone', () => {
  it('marks a freeform item done without touching any period', async () => {
    const studentId = 'lp-student-done-1';
    const plan = await startSessionPlan(studentId, { adhocTexts: ['X'] });
    const updated = await setSessionItemDone(studentId, plan.items[0].id, true);
    expect(updated.items[0].done).toBe(true);
    expect(updated.items[0].doneAt).toEqual(expect.any(Number));
  });

  it('increments the linked period item progress count when a period-linked item is marked done', async () => {
    const studentId = 'lp-student-done-2';
    await startPeriodPlan(studentId, 7);
    const period = await addPeriodItem(studentId, { kind: 'freeform', text: 'Звук Р' });
    const plan = await startSessionPlan(studentId, {
      periodItemIds: [period.items[0].id], periodPlanId: period.id,
    });

    await setSessionItemDone(studentId, plan.items[0].id, true, 'хорошо получалось');

    const reloadedPeriod = await getActivePeriodPlan(studentId);
    const progress = reloadedPeriod.progress[period.items[0].id];
    expect(progress.count).toBe(1);
    expect(progress.notes).toEqual([{ text: 'хорошо получалось', at: expect.any(Number) }]);
  });

  it('decrements the period count when a done item is un-checked', async () => {
    const studentId = 'lp-student-done-3';
    await startPeriodPlan(studentId, 7);
    const period = await addPeriodItem(studentId, { kind: 'freeform', text: 'Звук Р' });
    const plan = await startSessionPlan(studentId, {
      periodItemIds: [period.items[0].id], periodPlanId: period.id,
    });
    await setSessionItemDone(studentId, plan.items[0].id, true);

    await setSessionItemDone(studentId, plan.items[0].id, false);

    const reloadedPeriod = await getActivePeriodPlan(studentId);
    expect(reloadedPeriod.progress[period.items[0].id].count).toBe(0);
  });
});

describe('closeSessionPlan / getSessionsForPeriod', () => {
  it('closes the active session plan and it shows up in the period timeline', async () => {
    const studentId = 'lp-student-timeline-1';
    await startPeriodPlan(studentId, 7);
    const period = await addPeriodItem(studentId, { kind: 'freeform', text: 'Звук Р' });
    await startSessionPlan(studentId, { periodItemIds: [period.items[0].id], periodPlanId: period.id });

    const closed = await closeSessionPlan(studentId);

    expect(closed.status).toBe('closed');
    expect(await getActiveSessionPlan(studentId)).toBeNull();
    const timeline = await getSessionsForPeriod(studentId, period.id);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].id).toBe(closed.id);
  });
});
