import { getDb, kv } from '@/core/db';
import { pushOp, flushQueue } from '@/core/syncApi';
import { api } from '@/core/api';
import { createPeriodPlan, buildCarriedPeriod, createPlanItem, createSessionPlan } from './lessonPlanUtils.js';

const periodsKey  = (studentId) => `lessonplan_periods_${studentId}`;
const sessionsKey = (studentId) => `lessonplan_sessions_${studentId}`;

// ─── Period plans ────────────────────────────────────────────────────────────

export async function getPeriodPlans(studentId) {
  const db = await getDb();
  return (await kv.get(db, periodsKey(studentId))) ?? [];
}

export async function savePeriodPlans(studentId, periods) {
  const db = await getDb();
  const key = periodsKey(studentId);
  await kv.set(db, key, periods);
  pushOp('kv.upsert', { key, value: periods }).catch(() => {});
}

export async function getActivePeriodPlan(studentId) {
  const periods = await getPeriodPlans(studentId);
  return periods.find((p) => p.status === 'active') ?? null;
}

export async function startPeriodPlan(studentId, durationDays) {
  const periods = await getPeriodPlans(studentId);
  const existing = periods.find((p) => p.status === 'active');
  if (existing) return existing;
  const period = createPeriodPlan(studentId, durationDays);
  await savePeriodPlans(studentId, [...periods, period]);
  return period;
}

export async function addPeriodItem(studentId, itemInput) {
  const periods = await getPeriodPlans(studentId);
  const idx = periods.findIndex((p) => p.status === 'active');
  if (idx === -1) throw new Error('No active period plan for ' + studentId);
  const item = createPlanItem(itemInput);
  const period = periods[idx];
  const updated = {
    ...period,
    items: [...period.items, item],
    progress: { ...period.progress, [item.id]: { count: 0, notes: [] } },
  };
  const next = [...periods];
  next[idx] = updated;
  await savePeriodPlans(studentId, next);
  return updated;
}

export async function closePeriodPlan(studentId, carryItemIds) {
  const periods = await getPeriodPlans(studentId);
  const idx = periods.findIndex((p) => p.status === 'active');
  if (idx === -1) return null;
  const closed = { ...periods[idx], status: 'closed', closedAt: Date.now() };
  const carried = buildCarriedPeriod(closed, carryItemIds);
  const next = [...periods];
  next[idx] = closed;
  next.push(carried);
  await savePeriodPlans(studentId, next);
  return carried;
}

export async function addPeriodNote(studentId, itemId, noteText) {
  const periods = await getPeriodPlans(studentId);
  const idx = periods.findIndex((p) => p.status === 'active');
  if (idx === -1) return;
  const period = periods[idx];
  const entry = period.progress[itemId] ?? { count: 0, notes: [] };
  const updated = {
    ...period,
    progress: {
      ...period.progress,
      [itemId]: { ...entry, notes: [...entry.notes, { text: noteText, at: Date.now() }] },
    },
  };
  const next = [...periods];
  next[idx] = updated;
  await savePeriodPlans(studentId, next);
}
