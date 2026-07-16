import { describe, it, expect } from 'vitest';
import {
  createPlanItem, createPeriodPlan, isPeriodExpired, countTouchedGoals,
  itemsForCarryOver, buildCarriedPeriod, createSessionPlan, sessionOccasionSummary,
} from './lessonPlanUtils.js';

describe('createPlanItem', () => {
  it('builds a topic item with an id and createdAt', () => {
    const item = createPlanItem({ kind: 'topic', topicId: 't1', mode: 'words', label: 'Звук Р · слова' });
    expect(item.kind).toBe('topic');
    expect(item.topicId).toBe('t1');
    expect(item.mode).toBe('words');
    expect(item.label).toBe('Звук Р · слова');
    expect(typeof item.id).toBe('string');
    expect(typeof item.createdAt).toBe('number');
  });

  it('builds a freeform item with text', () => {
    const item = createPlanItem({ kind: 'freeform', text: 'Порисовать на артикуляцию' });
    expect(item.kind).toBe('freeform');
    expect(item.text).toBe('Порисовать на артикуляцию');
    expect(item.topicId).toBeUndefined();
  });
});

describe('createPeriodPlan', () => {
  it('creates an active, empty period with the given duration', () => {
    const period = createPeriodPlan('s1', 7);
    expect(period.studentId).toBe('s1');
    expect(period.durationDays).toBe(7);
    expect(period.status).toBe('active');
    expect(period.closedAt).toBeNull();
    expect(period.carriedFromPeriodId).toBeNull();
    expect(period.items).toEqual([]);
    expect(period.progress).toEqual({});
  });
});

describe('isPeriodExpired', () => {
  it('is false before the duration elapses', () => {
    const period = createPeriodPlan('s1', 7);
    expect(isPeriodExpired(period, period.startedAt + 3 * 86400000)).toBe(false);
  });

  it('is true once the duration has elapsed', () => {
    const period = createPeriodPlan('s1', 7);
    expect(isPeriodExpired(period, period.startedAt + 8 * 86400000)).toBe(true);
  });
});

describe('countTouchedGoals', () => {
  it('counts items with a non-zero progress count as touched', () => {
    const period = createPeriodPlan('s1', 7);
    const a = createPlanItem({ kind: 'freeform', text: 'A' });
    const b = createPlanItem({ kind: 'freeform', text: 'B' });
    period.items = [a, b];
    period.progress = { [a.id]: { count: 2, notes: [] }, [b.id]: { count: 0, notes: [] } };
    expect(countTouchedGoals(period)).toEqual({ touched: 1, total: 2 });
  });
});

describe('itemsForCarryOver', () => {
  it('returns ids of items with zero progress count', () => {
    const period = createPeriodPlan('s1', 7);
    const a = createPlanItem({ kind: 'freeform', text: 'A' });
    const b = createPlanItem({ kind: 'freeform', text: 'B' });
    period.items = [a, b];
    period.progress = { [a.id]: { count: 4, notes: [] }, [b.id]: { count: 0, notes: [] } };
    expect(itemsForCarryOver(period)).toEqual([b.id]);
  });

  it('treats items with no progress entry at all as zero-count', () => {
    const period = createPeriodPlan('s1', 7);
    const a = createPlanItem({ kind: 'freeform', text: 'A' });
    period.items = [a];
    period.progress = {};
    expect(itemsForCarryOver(period)).toEqual([a.id]);
  });
});

describe('buildCarriedPeriod', () => {
  it('carries only the selected items, with fresh ids and reset progress', () => {
    const period = createPeriodPlan('s1', 7);
    const a = createPlanItem({ kind: 'freeform', text: 'A' });
    const b = createPlanItem({ kind: 'freeform', text: 'B' });
    period.items = [a, b];
    period.progress = { [a.id]: { count: 4, notes: [] }, [b.id]: { count: 0, notes: [] } };

    const carried = buildCarriedPeriod(period, [b.id]);

    expect(carried.items).toHaveLength(1);
    expect(carried.items[0].text).toBe('B');
    expect(carried.items[0].id).not.toBe(b.id);
    expect(carried.status).toBe('active');
    expect(carried.carriedFromPeriodId).toBe(period.id);
    expect(carried.durationDays).toBe(7);
    expect(carried.progress).toEqual({});
  });
});

describe('createSessionPlan', () => {
  it('creates an active, empty session plan', () => {
    const plan = createSessionPlan('s1', 'p1');
    expect(plan.studentId).toBe('s1');
    expect(plan.periodPlanId).toBe('p1');
    expect(plan.status).toBe('active');
    expect(plan.closedAt).toBeNull();
    expect(plan.items).toEqual([]);
  });

  it('defaults periodPlanId to null', () => {
    const plan = createSessionPlan('s1');
    expect(plan.periodPlanId).toBeNull();
  });
});

describe('sessionOccasionSummary', () => {
  it('counts done vs total items', () => {
    const plan = createSessionPlan('s1');
    plan.items = [{ done: true }, { done: false }, { done: true }];
    expect(sessionOccasionSummary(plan)).toEqual({ done: 2, total: 3 });
  });
});
