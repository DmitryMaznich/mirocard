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

// ─── Session plans ───────────────────────────────────────────────────────────

export async function getSessionPlans(studentId) {
  const db = await getDb();
  return (await kv.get(db, sessionsKey(studentId))) ?? [];
}

export async function saveSessionPlans(studentId, sessions) {
  const db = await getDb();
  const key = sessionsKey(studentId);
  await kv.set(db, key, sessions);
  pushOp('kv.upsert', { key, value: sessions }).catch(() => {});
}

export async function getActiveSessionPlan(studentId) {
  const sessions = await getSessionPlans(studentId);
  return sessions.find((s) => s.status === 'active') ?? null;
}

export async function getSessionsForPeriod(studentId, periodPlanId) {
  const sessions = await getSessionPlans(studentId);
  return sessions
    .filter((s) => s.periodPlanId === periodPlanId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function startSessionPlan(studentId, { periodItemIds = [], adhocTexts = [], periodPlanId = null } = {}) {
  const sessions = await getSessionPlans(studentId);
  const periodPlan = periodPlanId
    ? (await getPeriodPlans(studentId)).find((p) => p.id === periodPlanId) ?? null
    : null;

  const existingIdx = sessions.findIndex((s) => s.status === 'active');
  const existing = existingIdx >= 0 ? sessions[existingIdx] : null;

  const periodItems = periodPlan
    ? periodItemIds.map((periodItemId) => {
        const source = periodPlan.items.find((i) => i.id === periodItemId);
        const prior = existing?.items.find((i) => i.origin === 'period' && i.periodItemId === periodItemId);
        return {
          ...source,
          id: prior?.id ?? crypto.randomUUID(),
          origin: 'period',
          periodItemId,
          done: prior?.done ?? false,
          doneAt: prior?.doneAt ?? null,
        };
      })
    : [];

  const adhocItems = adhocTexts.map((text) => ({
    id: crypto.randomUUID(),
    kind: 'freeform',
    text,
    createdAt: Date.now(),
    origin: 'adhoc',
    done: false,
    doneAt: null,
  }));

  const plan = existing
    ? { ...existing, periodPlanId, items: [...periodItems, ...adhocItems] }
    : { ...createSessionPlan(studentId, periodPlanId), items: [...periodItems, ...adhocItems] };

  const next = existingIdx >= 0
    ? sessions.map((s, i) => (i === existingIdx ? plan : s))
    : [...sessions, plan];

  await saveSessionPlans(studentId, next);
  return plan;
}

export async function setSessionItemDone(studentId, itemId, done, note = null) {
  const sessions = await getSessionPlans(studentId);
  const idx = sessions.findIndex((s) => s.status === 'active');
  if (idx === -1) return null;
  const session = sessions[idx];
  const itemIdx = session.items.findIndex((i) => i.id === itemId);
  if (itemIdx === -1) return session;
  const item = session.items[itemIdx];
  const updatedItems = [...session.items];
  updatedItems[itemIdx] = { ...item, done, doneAt: done ? Date.now() : null };
  const updatedSession = { ...session, items: updatedItems };
  const nextSessions = [...sessions];
  nextSessions[idx] = updatedSession;
  await saveSessionPlans(studentId, nextSessions);

  if (item.origin === 'period' && item.periodItemId) {
    const periods = await getPeriodPlans(studentId);
    const periodIdx = periods.findIndex((p) => p.id === session.periodPlanId);
    if (periodIdx >= 0) {
      const period = periods[periodIdx];
      const entry = period.progress[item.periodItemId] ?? { count: 0, notes: [] };
      const delta = done && !item.done ? 1 : (!done && item.done ? -1 : 0);
      const nextCount = Math.max(0, entry.count + delta);
      const nextNotes = note ? [...entry.notes, { text: note, at: Date.now() }] : entry.notes;
      const nextPeriods = [...periods];
      nextPeriods[periodIdx] = {
        ...period,
        progress: { ...period.progress, [item.periodItemId]: { count: nextCount, notes: nextNotes } },
      };
      await savePeriodPlans(studentId, nextPeriods);
    }
  }

  return updatedSession;
}

export async function closeSessionPlan(studentId) {
  const sessions = await getSessionPlans(studentId);
  const idx = sessions.findIndex((s) => s.status === 'active');
  if (idx === -1) return null;
  const closed = { ...sessions[idx], status: 'closed', closedAt: Date.now() };
  const next = [...sessions];
  next[idx] = closed;
  await saveSessionPlans(studentId, next);
  return closed;
}

// ─── Server sync ─────────────────────────────────────────────────────────────

const LESSONPLAN_KV_PREFIX = 'lessonplan_';

export async function pullLessonPlanKvFromServer() {
  // Flush first — a local write queued but not yet sent must reach the server
  // before we pull, or this pull would overwrite it with the stale server
  // value (same reasoning as pullPlannerKvFromServer/pullRecipeKvFromServer).
  await flushQueue().catch(() => {});
  try {
    const { kv: items } = await api.get(`/account/kv?prefix=${encodeURIComponent(LESSONPLAN_KV_PREFIX)}`);
    if (!Array.isArray(items) || !items.length) return;
    const db = await getDb();
    for (const { key, value } of items) {
      await kv.set(db, key, value);
    }
  } catch {
    // Offline or unauthenticated — silently skip, same as pullPlannerKvFromServer.
  }
}
