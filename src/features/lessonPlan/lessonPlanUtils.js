export function createPlanItem(input) {
  const { kind, topicId, mode, label, text } = input;
  return {
    id: crypto.randomUUID(),
    kind,
    ...(kind === 'topic' ? { topicId, mode, label } : { text }),
    createdAt: Date.now(),
  };
}

export function createPeriodPlan(studentId, durationDays) {
  return {
    id: crypto.randomUUID(),
    studentId,
    startedAt: Date.now(),
    durationDays,
    status: 'active',
    closedAt: null,
    carriedFromPeriodId: null,
    items: [],
    progress: {},
  };
}

export function isPeriodExpired(period, now = Date.now()) {
  return now > period.startedAt + period.durationDays * 86400000;
}

export function countTouchedGoals(period) {
  const total = period.items.length;
  const touched = period.items.filter((item) => (period.progress[item.id]?.count ?? 0) > 0).length;
  return { touched, total };
}

export function itemsForCarryOver(period) {
  return period.items
    .filter((item) => (period.progress[item.id]?.count ?? 0) === 0)
    .map((item) => item.id);
}

export function buildCarriedPeriod(period, carriedItemIds) {
  const carriedSet = new Set(carriedItemIds);
  const items = period.items
    .filter((item) => carriedSet.has(item.id))
    .map((item) => ({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
  return {
    id: crypto.randomUUID(),
    studentId: period.studentId,
    startedAt: Date.now(),
    durationDays: period.durationDays,
    status: 'active',
    closedAt: null,
    carriedFromPeriodId: period.id,
    items,
    progress: {},
  };
}

export function createSessionPlan(studentId, periodPlanId = null) {
  return {
    id: crypto.randomUUID(),
    studentId,
    periodPlanId,
    createdAt: Date.now(),
    closedAt: null,
    status: 'active',
    items: [],
  };
}

export function sessionOccasionSummary(sessionPlan) {
  const total = sessionPlan.items.length;
  const done = sessionPlan.items.filter((item) => item.done).length;
  return { done, total };
}
