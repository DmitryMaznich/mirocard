# Lesson Plan (План занятия) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parent-facing "План занятия" section (period backlog → per-occasion checklist, with a floating in-session reminder panel and history/recap), and rename the existing meal/shopping "Планировщик" tab to free up that word.

**Architecture:** A new self-contained feature directory `src/features/lessonPlan/` holding a pure data-model layer (`lessonPlanUtils.js`), an IndexedDB-backed persistence layer mirroring `plannerApi.js` (`lessonPlanApi.js`, KV keys prefixed `lessonplan_`), a React context + floating overlay mirroring `TimerContext`/`GlobalTimer` (`LessonPlanContext.jsx` + `LessonPlanPanel.jsx`), and a set of screens/sheets (hub tab, period backlog, session builder, carry-over, history). A new store field (`activeLessonPlanItemId`) tracks quick-started sessions through to auto-completion, mirroring the existing `sessionReturnScreen` "read once, then clear" pattern.

**Tech Stack:** React (function components, no TypeScript), Zustand (`useAppStore`), IndexedDB via `@/core/db` (`getDb`/`kv`), sync via `@/core/syncApi` (`pushOp`/`flushQueue`), Vitest + `fake-indexeddb` for data-layer unit tests (already wired via `src/test-setup.js`).

## Global Constraints

- No TypeScript, no new npm dependencies — plain JS/JSX matching the existing codebase style.
- Russian UI copy throughout (this is a Russian-language app for the user's own family).
- New KV keys use prefix `lessonplan_` (e.g. `lessonplan_periods_${studentId}`) — must never collide with the meal planner's `planner_`/`planner:` namespace.
- Any new fixed/sticky/absolute-positioned element that reaches a real screen edge must add `var(--app-safe-top/right/bottom/left, 0px)` to its offset, per the iOS safe-area rule in `c:\Users\dmazn\Projects\Mirocard2\CLAUDE.md`. Reusing `.screen-header`/`.icon-btn` (already safe-area-aware) satisfies this for the two new full screens; the floating panel (badge + bottom sheet) is new and must add the variables itself.
- `LessonPlanProvider` wraps only `<App />` in `src/main.jsx`, never `<StudentApp />` — the feature is parent-only and must never appear in the student-portal view.
- No component-level tests are added — this codebase has zero `.test.jsx` files for screens/components (confirmed: only data/logic modules like `plannerApi.js`, `plannerUtils.js` have `.test.js` siblings). UI tasks are verified manually via `npm run dev`, matching existing project convention; data-layer tasks (`lessonPlanUtils.js`, `lessonPlanApi.js`) get real Vitest unit tests via TDD, matching `plannerUtils.test.js`/`plannerApi.test.js`.
- Vitest is run with `npx vitest run <path>` (no `test` npm script exists in `package.json`).
- Commit messages follow this repo's convention: `feat(lesson_plan): <summary>` (see recent `git log`, e.g. `feat(column_addition): rework build_number as a coin-heap/tap-to-group mechanic`).
- Spec reference: `docs/superpowers/specs/2026-07-16-lesson-plan-design.md`.

---

### Task 1: Pure data-model helpers (`lessonPlanUtils.js`)

**Files:**
- Create: `src/features/lessonPlan/lessonPlanUtils.js`
- Test: `src/features/lessonPlan/lessonPlanUtils.test.js`

**Interfaces:**
- Produces (consumed by Tasks 2, 3, 9, 10, 13):
  - `createPlanItem(input: { kind: 'topic'|'freeform', topicId?, mode?, label?, text? }) → PlanItem` (adds `id`, `createdAt`)
  - `createPeriodPlan(studentId: string, durationDays: number) → LessonPeriodPlan`
  - `isPeriodExpired(period: LessonPeriodPlan, now?: number) → boolean`
  - `countTouchedGoals(period: LessonPeriodPlan) → { touched: number, total: number }`
  - `itemsForCarryOver(period: LessonPeriodPlan) → string[]` (item ids with `progress.count === 0`)
  - `buildCarriedPeriod(period: LessonPeriodPlan, carriedItemIds: string[]) → LessonPeriodPlan` (fresh ids, `status: 'active'`, `carriedFromPeriodId` set, `progress: {}`)
  - `createSessionPlan(studentId: string, periodPlanId?: string|null) → LessonSessionPlan`
  - `sessionOccasionSummary(sessionPlan: LessonSessionPlan) → { done: number, total: number }`

- [ ] **Step 1: Write the failing tests**

```js
// src/features/lessonPlan/lessonPlanUtils.test.js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/lessonPlan/lessonPlanUtils.test.js`
Expected: FAIL — `Failed to resolve import "./lessonPlanUtils.js"` (module doesn't exist yet).

- [ ] **Step 3: Implement `lessonPlanUtils.js`**

```js
// src/features/lessonPlan/lessonPlanUtils.js

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/lessonPlan/lessonPlanUtils.test.js`
Expected: PASS — all `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/features/lessonPlan/lessonPlanUtils.js src/features/lessonPlan/lessonPlanUtils.test.js
git commit -m "feat(lesson_plan): add pure data-model helpers"
```

---

### Task 2: Period-plan persistence (`lessonPlanApi.js`, part A)

**Files:**
- Create: `src/features/lessonPlan/lessonPlanApi.js`
- Test: `src/features/lessonPlan/lessonPlanApi.test.js`

**Interfaces:**
- Consumes: Task 1's `createPeriodPlan`, `createPlanItem`, `buildCarriedPeriod`.
- Produces (consumed by Tasks 3, 9, 10, 12, 13):
  - `getPeriodPlans(studentId: string) → Promise<LessonPeriodPlan[]>`
  - `savePeriodPlans(studentId: string, periods: LessonPeriodPlan[]) → Promise<void>`
  - `getActivePeriodPlan(studentId: string) → Promise<LessonPeriodPlan|null>`
  - `startPeriodPlan(studentId: string, durationDays: number) → Promise<LessonPeriodPlan>` (returns existing active one if present, never duplicates)
  - `addPeriodItem(studentId: string, itemInput: object) → Promise<LessonPeriodPlan>` (throws if no active period)
  - `closePeriodPlan(studentId: string, carryItemIds: string[]) → Promise<LessonPeriodPlan|null>` (returns the new carried-over active period)
  - `addPeriodNote(studentId: string, itemId: string, noteText: string) → Promise<void>`

- [ ] **Step 1: Write the failing tests**

```js
// src/features/lessonPlan/lessonPlanApi.test.js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/lessonPlan/lessonPlanApi.test.js`
Expected: FAIL — `Failed to resolve import "./lessonPlanApi.js"`.

- [ ] **Step 3: Implement the period-plan portion of `lessonPlanApi.js`**

```js
// src/features/lessonPlan/lessonPlanApi.js
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
```

(The `createSessionPlan` import and `sessionsKey` constant are unused until Task 3 — that's expected, they'll be consumed in the next task's additions to this same file.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/lessonPlan/lessonPlanApi.test.js`
Expected: PASS — all `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/features/lessonPlan/lessonPlanApi.js src/features/lessonPlan/lessonPlanApi.test.js
git commit -m "feat(lesson_plan): add period-plan persistence"
```

---

### Task 3: Session-plan persistence + server pull (`lessonPlanApi.js`, part B)

**Files:**
- Modify: `src/features/lessonPlan/lessonPlanApi.js` (append)
- Modify: `src/features/lessonPlan/lessonPlanApi.test.js` (append)

**Interfaces:**
- Consumes: Task 1's `createSessionPlan`; this task's own `getPeriodPlans`/`savePeriodPlans` (Task 2).
- Produces (consumed by Tasks 5, 11, 12, 13):
  - `getSessionPlans(studentId: string) → Promise<LessonSessionPlan[]>`
  - `saveSessionPlans(studentId: string, sessions: LessonSessionPlan[]) → Promise<void>`
  - `getActiveSessionPlan(studentId: string) → Promise<LessonSessionPlan|null>`
  - `getSessionsForPeriod(studentId: string, periodPlanId: string) → Promise<LessonSessionPlan[]>` (sorted oldest→newest)
  - `startSessionPlan(studentId: string, { periodItemIds?: string[], adhocTexts?: string[], periodPlanId?: string|null }) → Promise<LessonSessionPlan>` (creates, or edits in place if one is already active — preserves `done` state of period-linked items that remain checked)
  - `setSessionItemDone(studentId: string, itemId: string, done: boolean, note?: string|null) → Promise<LessonSessionPlan|null>` (also increments/decrements the linked period item's `progress.count`, appends `note` when provided)
  - `closeSessionPlan(studentId: string) → Promise<LessonSessionPlan|null>`
  - `pullLessonPlanKvFromServer() → Promise<void>`

- [ ] **Step 1: Write the failing tests (append to the existing test file)**

```js
// append to src/features/lessonPlan/lessonPlanApi.test.js
import {
  getSessionPlans, saveSessionPlans, getActiveSessionPlan, getSessionsForPeriod,
  startSessionPlan, setSessionItemDone, closeSessionPlan,
} from './lessonPlanApi.js';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/lessonPlan/lessonPlanApi.test.js`
Expected: FAIL — `startSessionPlan is not a function` (and similar) for the new tests; period-plan tests from Task 2 still pass.

- [ ] **Step 3: Append the session-plan portion to `lessonPlanApi.js`**

```js
// append to src/features/lessonPlan/lessonPlanApi.js

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/lessonPlan/lessonPlanApi.test.js`
Expected: PASS — all `describe` blocks green (period-plan tests from Task 2 plus these).

- [ ] **Step 5: Commit**

```bash
git add src/features/lessonPlan/lessonPlanApi.js src/features/lessonPlan/lessonPlanApi.test.js
git commit -m "feat(lesson_plan): add session-plan persistence and server sync"
```

---

### Task 4: Store field for quick-start tracking (`store.js`)

**Files:**
- Modify: `src/core/store.js:8-12` (insert after), `src/core/store.js:126-130` (comment rename)

**Interfaces:**
- Produces (consumed by Tasks 6, 8): `activeLessonPlanItemId: string|null`, `setActiveLessonPlanItemId(id: string|null) → void`

- [ ] **Step 1: Add the field**

In `src/core/store.js`, right after the existing `setSessionReturnScreen` line (line 12):

```js
  sessionReturnScreen: null,
  setSessionReturnScreen: (sessionReturnScreen) => set({ sessionReturnScreen }),
  // Which lesson-plan checklist item (see src/features/lessonPlan) launched
  // the session currently in progress, if it was started via "Играть это".
  // Read once when the session completes to auto-mark that item done, then
  // cleared — mirrors sessionReturnScreen's "read once, then null" pattern.
  activeLessonPlanItemId: null,
  setActiveLessonPlanItemId: (activeLessonPlanItemId) => set({ activeLessonPlanItemId }),
```

- [ ] **Step 2: Rename the stray "Планировщик" reference in the `homeActiveTab` comment**

Find (around line 126-130):
```js
  // Which Home tab ("session" | "planner") to land on. HomeScreen's own
  // tab state is local (resets on remount), so without this, navigating
  // back from a Planner screen (setScreen('home')) always dropped the
  // user onto "Занятие" instead of back onto "Планировщик".
  homeActiveTab: "session",
```
Replace with:
```js
  // Which Home tab ("session" | "planner" | "lesson_plan") to land on.
  // HomeScreen's own tab state is local (resets on remount), so without
  // this, navigating back from a sub-screen (setScreen('home')) always
  // dropped the user onto "Занятие" instead of back onto the tab they came
  // from (e.g. "Меню и магазин" or "План занятия").
  homeActiveTab: "session",
```

- [ ] **Step 3: Manually verify**

Run: `npx vitest run src/core/store.test.js`
Expected: PASS (existing store tests are unaffected by an additive field).

- [ ] **Step 4: Commit**

```bash
git add src/core/store.js
git commit -m "feat(lesson_plan): add activeLessonPlanItemId store field"
```

---

### Task 5: `LessonPlanContext.jsx` (provider)

**Files:**
- Create: `src/features/lessonPlan/LessonPlanContext.jsx`

**Interfaces:**
- Consumes: Task 3's `getActiveSessionPlan`, `setSessionItemDone`.
- Produces (consumed by Tasks 6, 7, 8, 12):
  - `LessonPlanProvider({ children })` — component
  - `useLessonPlan() → { activeSessionPlan: LessonSessionPlan|null, isOpen: boolean, setIsOpen: (v: boolean|((v:boolean)=>boolean)) => void, refresh: (studentId?: string) => Promise<void>, markItemDone: (itemId: string, done?: boolean, note?: string|null) => Promise<void> }`

- [ ] **Step 1: Implement the provider**

```jsx
// src/features/lessonPlan/LessonPlanContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getActiveSessionPlan, setSessionItemDone } from "./lessonPlanApi";

const LessonPlanContext = createContext(null);

export function LessonPlanProvider({ children }) {
  const [activeSessionPlan, setActiveSessionPlan] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const activeStudentId = useAppStore((s) => s.activeStudentId);

  const refresh = useCallback(async (studentId) => {
    const sid = studentId ?? activeStudentId;
    if (!sid) { setActiveSessionPlan(null); return; }
    const plan = await getActiveSessionPlan(sid);
    setActiveSessionPlan(plan);
  }, [activeStudentId]);

  useEffect(() => {
    if (!activeStudentId) { setActiveSessionPlan(null); setIsOpen(false); return; }
    refresh(activeStudentId);
  }, [activeStudentId, refresh]);

  const markItemDone = useCallback(async (itemId, done = true, note = null) => {
    if (!activeStudentId) return;
    const updated = await setSessionItemDone(activeStudentId, itemId, done, note);
    if (updated) setActiveSessionPlan(updated);
  }, [activeStudentId]);

  const value = { activeSessionPlan, isOpen, setIsOpen, refresh, markItemDone };
  return <LessonPlanContext.Provider value={value}>{children}</LessonPlanContext.Provider>;
}

export function useLessonPlan() {
  return useContext(LessonPlanContext);
}
```

- [ ] **Step 2: Manually verify**

This is a headless module with no visual output of its own — it's exercised through Task 7's mounting and Task 6/8's consumers. No standalone check beyond confirming the file has no syntax errors:

Run: `npx vite build --configLoader native 2>&1 | grep -i "LessonPlanContext" || echo "no errors referencing LessonPlanContext"`
Expected: `no errors referencing LessonPlanContext` (the file isn't imported anywhere yet, so the build should otherwise succeed unchanged; this just catches syntax typos).

- [ ] **Step 3: Commit**

```bash
git add src/features/lessonPlan/LessonPlanContext.jsx
git commit -m "feat(lesson_plan): add LessonPlanContext provider"
```

---

### Task 6: Floating panel (`LessonPlanPanel.jsx` + CSS)

**Files:**
- Modify: `src/StudentApp.jsx:72` (export `computeDefaultParams`)
- Create: `src/features/lessonPlan/LessonPlanPanel.jsx`
- Create: `src/features/lessonPlan/lessonPlan.css`

**Interfaces:**
- Consumes: Task 4's `setActiveLessonPlanItemId`; Task 5's `useLessonPlan`; `StudentApp.jsx`'s now-exported `computeDefaultParams(topicRecord, mode)`.
- Produces (consumed by Task 7): `LessonPlanPanel` default export component (no props — reads everything from `useLessonPlan()`/`useAppStore`).

- [ ] **Step 1: Export `computeDefaultParams` from `StudentApp.jsx`**

In `src/StudentApp.jsx:72`, change:
```js
function computeDefaultParams(topicRecord, mode) {
```
to:
```js
export function computeDefaultParams(topicRecord, mode) {
```

- [ ] **Step 2: Write the CSS**

```css
/* src/features/lessonPlan/lessonPlan.css */

.lesson-plan-badge {
  position: fixed;
  top: calc(12px + var(--app-safe-top, 0px));
  right: calc(12px + var(--app-safe-right, 0px));
  z-index: 250;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 20px;
  border: none;
  background: #1a1a1a;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}

.lesson-plan-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 250;
  max-height: 60vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 12px 16px calc(16px + var(--app-safe-bottom, 0px));
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
}

.lesson-plan-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}
.lesson-plan-sheet__header button {
  background: none;
  border: none;
  color: #888;
  font-size: 12px;
  cursor: pointer;
}

.lesson-plan-sheet__list { list-style: none; margin: 0; padding: 0; }
.lesson-plan-sheet__item { border-bottom: 1px solid #f0f0f0; padding: 8px 0; }
.lesson-plan-sheet__row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.lesson-plan-sheet__label { font-size: 14px; }
.lesson-plan-sheet__label--done { text-decoration: line-through; color: #aaa; }
.lesson-plan-sheet__play {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 10px;
  border: none;
  background: #1a73e8;
  color: #fff;
  cursor: pointer;
}
.lesson-plan-sheet__note-link {
  background: none; border: none; color: #1a73e8; font-size: 11px; padding: 2px 0; cursor: pointer;
}
.lesson-plan-sheet__note-row { display: flex; gap: 6px; margin-top: 4px; }
.lesson-plan-sheet__note-input {
  flex: 1; font-size: 12px; padding: 4px 8px; border-radius: 8px; border: 1px solid #ddd;
}
```

- [ ] **Step 3: Implement the panel**

```jsx
// src/features/lessonPlan/LessonPlanPanel.jsx
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { useLessonPlan } from "./LessonPlanContext";
import { computeDefaultParams } from "@/StudentApp";
import "./lessonPlan.css";

export default function LessonPlanPanel() {
  const lessonPlan = useLessonPlan();
  const topicRecords = useAppStore((s) => s.topicRecords);
  const [noteDraftItemId, setNoteDraftItemId] = useState(null);
  const [noteText, setNoteText] = useState("");

  const activeSessionPlan = lessonPlan?.activeSessionPlan ?? null;
  if (!activeSessionPlan) return null;

  const total = activeSessionPlan.items.length;
  const doneCount = activeSessionPlan.items.filter((item) => item.done).length;

  function handlePlayItem(item) {
    const store = useAppStore.getState();
    const topicRecord = store.topicRecords.find((r) => r.meta.id === item.topicId);
    if (!topicRecord) return; // topic removed since the item was added — no quick start
    const mode = topicRecord.modes?.find((m) => m.id === item.mode);
    const defaultParams = computeDefaultParams(topicRecord, mode);
    store.upsertStudentTopicLink(store.activeStudentId, item.topicId, { params: defaultParams });
    useAppStore.setState({
      activeStudentId: store.activeStudentId,
      activeTopicId: item.topicId,
      activeModeId: item.mode,
      activeTextId: null,
      activeText: null,
    });
    store.setActiveLessonPlanItemId(item.id);
    store.setScreen("session");
  }

  function submitNote(itemId) {
    const text = noteText.trim();
    if (text) lessonPlan.markItemDone(itemId, true, text);
    setNoteDraftItemId(null);
    setNoteText("");
  }

  return (
    <>
      <button className="lesson-plan-badge" onClick={() => lessonPlan.setIsOpen((v) => !v)}>
        📋 {doneCount}/{total}
      </button>
      {lessonPlan.isOpen && (
        <div className="lesson-plan-sheet">
          <div className="lesson-plan-sheet__header">
            <span>План занятия</span>
            <button onClick={() => lessonPlan.setIsOpen(false)}>свернуть ▾</button>
          </div>
          <ul className="lesson-plan-sheet__list">
            {activeSessionPlan.items.map((item) => (
              <li key={item.id} className="lesson-plan-sheet__item">
                <div className="lesson-plan-sheet__row">
                  <span className={`lesson-plan-sheet__label${item.done ? " lesson-plan-sheet__label--done" : ""}`}>
                    {item.label ?? item.text}
                  </span>
                  {item.done ? (
                    <span aria-hidden>✅</span>
                  ) : item.kind === "topic" && topicRecords.some((r) => r.meta.id === item.topicId) ? (
                    <button className="lesson-plan-sheet__play" onClick={() => handlePlayItem(item)}>
                      Играть это
                    </button>
                  ) : (
                    <input type="checkbox" onChange={() => lessonPlan.markItemDone(item.id, true)} />
                  )}
                </div>
                {item.done && item.origin === "period" && noteDraftItemId !== item.id && (
                  <button className="lesson-plan-sheet__note-link" onClick={() => setNoteDraftItemId(item.id)}>
                    + заметка
                  </button>
                )}
                {noteDraftItemId === item.id && (
                  <div className="lesson-plan-sheet__note-row">
                    <input
                      className="lesson-plan-sheet__note-input"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Например, «хорошо получалось»"
                    />
                    <button onClick={() => submitNote(item.id)}>✓</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Manually verify**

This component isn't mounted anywhere yet (that's Task 7), so verification here is a syntax/import check:

Run: `npx vite build --configLoader native`
Expected: build succeeds with no errors mentioning `LessonPlanPanel.jsx`, `StudentApp.jsx`, or `lessonPlan.css`.

- [ ] **Step 5: Commit**

```bash
git add src/StudentApp.jsx src/features/lessonPlan/LessonPlanPanel.jsx src/features/lessonPlan/lessonPlan.css
git commit -m "feat(lesson_plan): add floating checklist panel"
```

---

### Task 7: Mount the provider and panel (`main.jsx`, `App.jsx`)

**Files:**
- Modify: `src/main.jsx:9` (import), `src/main.jsx:135-143` (wrap `<App />`)
- Modify: `src/App.jsx:36-37` (import area), `src/App.jsx:284-289` (render)

**Interfaces:**
- Consumes: Task 5's `LessonPlanProvider`; Task 6's `LessonPlanPanel`.

- [ ] **Step 1: Wrap `<App />` with `LessonPlanProvider` in `main.jsx`**

Add the import after line 9:
```js
import { TimerProvider } from "./features/timer/TimerContext";
import { LessonPlanProvider } from "./features/lessonPlan/LessonPlanContext";
```

Change the render block (lines 135-143) from:
```jsx
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TimerProvider>
      {_portalToken
        ? <StudentApp token={_portalToken} isStandalone={_isStandalone} fromLink={Boolean(_urlPortalMatch) && !_isStandalone} />
        : <App />}
    </TimerProvider>
  </StrictMode>
);
```
to:
```jsx
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TimerProvider>
      {_portalToken
        ? <StudentApp token={_portalToken} isStandalone={_isStandalone} fromLink={Boolean(_urlPortalMatch) && !_isStandalone} />
        : <LessonPlanProvider><App /></LessonPlanProvider>}
    </TimerProvider>
  </StrictMode>
);
```

Note: `LessonPlanProvider` deliberately wraps only `<App />`, not `<StudentApp />` — the lesson-plan panel is parent-only and must never appear in the student-portal view (per Global Constraints).

- [ ] **Step 2: Render `LessonPlanPanel` in `App.jsx`**

Add the import after line 37 (`import { useTimer } from "@/features/timer/TimerContext";`):
```js
import LessonPlanPanel from "@/features/lessonPlan/LessonPlanPanel";
```

Change the render block (lines 284-289) from:
```jsx
  return (
    <>
      {timerEnabled && <GlobalTimer rewardVideos={rewardVideos} />}
      <ErrorBoundary key={screen}>
        <Screen />
      </ErrorBoundary>
```
to:
```jsx
  return (
    <>
      {timerEnabled && <GlobalTimer rewardVideos={rewardVideos} />}
      <LessonPlanPanel />
      <ErrorBoundary key={screen}>
        <Screen />
      </ErrorBoundary>
```

(`LessonPlanPanel` self-guards on `activeSessionPlan` being null, same as how `GlobalTimer` is gated by `timerEnabled` — no extra condition needed here.)

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open `http://localhost:8080/`, log in, confirm:
- The app boots with no console errors mentioning `LessonPlanProvider`, `LessonPlanPanel`, or `useLessonPlan`.
- No floating badge appears anywhere yet (expected — nothing has created a session plan yet; `getActiveSessionPlan` correctly resolves to `null` for every student).

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx src/App.jsx
git commit -m "feat(lesson_plan): mount LessonPlanProvider and floating panel"
```

---

### Task 8: Auto-check-off on session completion (`SessionScreen.jsx`)

**Files:**
- Modify: `src/features/session/SessionScreen.jsx:1-2` (imports), `:26-38` (selectors), `:89-99` (completion effect)

**Interfaces:**
- Consumes: Task 4's `activeLessonPlanItemId`/`setActiveLessonPlanItemId`; Task 5's `useLessonPlan`.

- [ ] **Step 1: Import `useLessonPlan`**

In `src/features/session/SessionScreen.jsx`, add after line 6 (`import { useSessionEngine } from "./useSessionEngine";`):
```js
import { useLessonPlan } from "@/features/lessonPlan/LessonPlanContext";
```

- [ ] **Step 2: Add the store selectors and context hook**

After line 28 (`const setSessionReturnScreen = useAppStore((s) => s.setSessionReturnScreen);`), add:
```js
  const activeLessonPlanItemId    = useAppStore((s) => s.activeLessonPlanItemId);
  const setActiveLessonPlanItemId = useAppStore((s) => s.setActiveLessonPlanItemId);
  const lessonPlan = useLessonPlan();
```

- [ ] **Step 3: Notify the lesson plan on completion**

Change the completion effect (lines 89-99) from:
```js
  useEffect(() => {
    if (!completedRecord) return;
    const skipSummary = topicRecord?.meta.renderer === "reading" && (mode?.type === "read_text" || mode?.type === "daily_sentences");
    const isInstruction = mode?.type === "follow_instruction" || mode?.type === "shopping_list" || mode?.type === "safe_code";
    if (isInstruction && sessionReturnScreen) {
      setScreen(sessionReturnScreen);
      setSessionReturnScreen(null);
      return;
    }
    setScreen(isInstruction ? "texts" : skipSummary ? "modes" : "summary");
  }, [completedRecord, mode?.type, setScreen, topicRecord?.meta.renderer, sessionReturnScreen, setSessionReturnScreen]);
```
to:
```js
  useEffect(() => {
    if (!completedRecord) return;
    if (activeLessonPlanItemId) {
      lessonPlan?.markItemDone(activeLessonPlanItemId, true);
      setActiveLessonPlanItemId(null);
    }
    const skipSummary = topicRecord?.meta.renderer === "reading" && (mode?.type === "read_text" || mode?.type === "daily_sentences");
    const isInstruction = mode?.type === "follow_instruction" || mode?.type === "shopping_list" || mode?.type === "safe_code";
    if (isInstruction && sessionReturnScreen) {
      setScreen(sessionReturnScreen);
      setSessionReturnScreen(null);
      return;
    }
    setScreen(isInstruction ? "texts" : skipSummary ? "modes" : "summary");
  }, [completedRecord, activeLessonPlanItemId, lessonPlan, setActiveLessonPlanItemId, mode?.type, setScreen, topicRecord?.meta.renderer, sessionReturnScreen, setSessionReturnScreen]);
```

- [ ] **Step 4: Manually verify**

This can't be fully exercised until Tasks 9-14 provide a way to actually build a checklist and quick-start an item — verification here is a syntax/regression check:

Run: `npm run dev`, log in, start any ordinary session (topic → mode → params → session) that does **not** go through the lesson plan at all, play a couple of cards, finish it. Confirm:
- The session still completes and navigates to `summary`/`modes` exactly as before (no `activeLessonPlanItemId` was set, so the new branch is a no-op).
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/session/SessionScreen.jsx
git commit -m "feat(lesson_plan): auto-check-off quick-started items on session completion"
```

---

### Task 9: Add-item sheet (`AddPlanItemSheet.jsx`)

**Files:**
- Create: `src/features/lessonPlan/AddPlanItemSheet.jsx`

**Interfaces:**
- Produces (consumed by Task 10): `AddPlanItemSheet({ onPick: (itemInput) => void, onClose: () => void })` — `itemInput` matches Task 1's `createPlanItem` input shape: `{ kind: 'topic', topicId, mode, label }` or `{ kind: 'freeform', text }`.

Scope note: the topic picker only lists topics that have `modes` (standard flashcard/exercise topics) — reading-type topics (recipes/instructions, identified by `textId` rather than `mode`) are out of scope for v1's topic-linked items, per the design spec's focus on speech-therapy exercises.

- [ ] **Step 1: Implement the sheet**

```jsx
// src/features/lessonPlan/AddPlanItemSheet.jsx
import { useState } from "react";
import { useAppStore } from "@/core/store";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { getTopicTitle } from "@/shared/utils/format";
import "./lessonPlan.css";

const TAB_TOPIC = "topic";
const TAB_FREEFORM = "freeform";

export default function AddPlanItemSheet({ onPick, onClose }) {
  const topicRecords = useAppStore((s) => s.topicRecords);
  const [tab, setTab] = useState(TAB_TOPIC);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [freeText, setFreeText] = useState("");

  const availableTopics = topicRecords.filter((r) => (r.modes?.length ?? 0) > 0);
  const selectedTopic = availableTopics.find((r) => r.meta.id === selectedTopicId) ?? null;

  function handlePickMode(mode) {
    onPick({
      kind: "topic",
      topicId: selectedTopic.meta.id,
      mode: mode.id,
      label: `${getTopicTitle(selectedTopic.meta.title)} · ${getTopicTitle(mode.ui?.title) || mode.id}`,
    });
  }

  function handleFreeformSubmit() {
    const text = freeText.trim();
    if (!text) return;
    onPick({ kind: "freeform", text });
  }

  return (
    <Modal title="Добавить цель" onClose={onClose}>
      <div className="lesson-plan-add-sheet__tabs">
        <button
          className={`lesson-plan-add-sheet__tab${tab === TAB_TOPIC ? " lesson-plan-add-sheet__tab--active" : ""}`}
          onClick={() => setTab(TAB_TOPIC)}
        >
          Тема из приложения
        </button>
        <button
          className={`lesson-plan-add-sheet__tab${tab === TAB_FREEFORM ? " lesson-plan-add-sheet__tab--active" : ""}`}
          onClick={() => setTab(TAB_FREEFORM)}
        >
          Своя задача
        </button>
      </div>

      {tab === TAB_TOPIC && !selectedTopic && (
        <ul className="lesson-plan-add-sheet__list">
          {availableTopics.map((r) => (
            <li key={r.meta.id}>
              <button onClick={() => setSelectedTopicId(r.meta.id)}>{getTopicTitle(r.meta.title)}</button>
            </li>
          ))}
        </ul>
      )}

      {tab === TAB_TOPIC && selectedTopic && (
        <ul className="lesson-plan-add-sheet__list">
          {selectedTopic.modes.map((mode) => (
            <li key={mode.id}>
              <button onClick={() => handlePickMode(mode)}>{getTopicTitle(mode.ui?.title) || mode.id}</button>
            </li>
          ))}
          <li><button onClick={() => setSelectedTopicId(null)}>← Другая тема</button></li>
        </ul>
      )}

      {tab === TAB_FREEFORM && (
        <div className="lesson-plan-add-sheet__freeform">
          <input
            className="lesson-plan-add-sheet__input"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Например, «повторить стишок»"
          />
          <Button onClick={handleFreeformSubmit} disabled={!freeText.trim()}>Добавить</Button>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Add the sheet's CSS**

Append to `src/features/lessonPlan/lessonPlan.css`:
```css
.lesson-plan-add-sheet__tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.lesson-plan-add-sheet__tab {
  flex: 1; padding: 8px; border-radius: 10px; border: 1px solid #ddd; background: #fff; font-size: 13px; cursor: pointer;
}
.lesson-plan-add-sheet__tab--active { background: #f0f6ff; border-color: #1a73e8; color: #1a73e8; font-weight: 600; }
.lesson-plan-add-sheet__list { list-style: none; margin: 0; padding: 0; }
.lesson-plan-add-sheet__list li { border-bottom: 1px solid #f0f0f0; }
.lesson-plan-add-sheet__list button {
  width: 100%; text-align: left; padding: 10px 4px; background: none; border: none; font-size: 14px; cursor: pointer;
}
.lesson-plan-add-sheet__freeform { display: flex; flex-direction: column; gap: 8px; }
.lesson-plan-add-sheet__input { padding: 8px 10px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; }
```

- [ ] **Step 3: Manually verify**

This component has no consumer yet — Task 10 wires it in. Verify it compiles:

Run: `npx vite build --configLoader native`
Expected: build succeeds, no errors referencing `AddPlanItemSheet.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/lessonPlan/AddPlanItemSheet.jsx src/features/lessonPlan/lessonPlan.css
git commit -m "feat(lesson_plan): add topic/freeform item picker sheet"
```

---

### Task 10: Period backlog screen + carry-over (`PeriodPlanScreen.jsx`, `PeriodCarryOverSheet.jsx`)

**Files:**
- Create: `src/features/lessonPlan/PeriodCarryOverSheet.jsx`
- Create: `src/features/lessonPlan/PeriodPlanScreen.jsx`
- Modify: `src/App.jsx` (import + `SCREENS` entry for `lesson_plan_period`)

**Interfaces:**
- Consumes: Task 1's `isPeriodExpired`, `itemsForCarryOver`; Task 2's `getActivePeriodPlan`, `startPeriodPlan`, `addPeriodItem`, `closePeriodPlan`; Task 9's `AddPlanItemSheet`.

- [ ] **Step 1: Implement `PeriodCarryOverSheet.jsx`**

```jsx
// src/features/lessonPlan/PeriodCarryOverSheet.jsx
import { useState } from "react";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { closePeriodPlan } from "./lessonPlanApi";
import { itemsForCarryOver } from "./lessonPlanUtils";

export default function PeriodCarryOverSheet({ studentId, period, onClose }) {
  const [checked, setChecked] = useState(() => new Set(itemsForCarryOver(period)));
  const [saving, setSaving] = useState(false);

  function toggle(itemId) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  async function handleConfirm() {
    setSaving(true);
    await closePeriodPlan(studentId, Array.from(checked));
    setSaving(false);
    onClose();
  }

  return (
    <Modal title="Период закончился" onClose={onClose}>
      <p>Что перенести в новый период?</p>
      <ul className="lesson-plan-add-sheet__list">
        {period.items.map((item) => (
          <li key={item.id}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0" }}>
              <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)} />
              <span style={{ flex: 1 }}>{item.label ?? item.text}</span>
              <span style={{ fontSize: 12, color: "#888" }}>сделано {period.progress[item.id]?.count ?? 0} раз</span>
            </label>
          </li>
        ))}
      </ul>
      <Button onClick={handleConfirm} disabled={saving}>
        Начать новый период ({period.durationDays} дней)
      </Button>
    </Modal>
  );
}
```

- [ ] **Step 2: Implement `PeriodPlanScreen.jsx`**

```jsx
// src/features/lessonPlan/PeriodPlanScreen.jsx
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getActivePeriodPlan, startPeriodPlan, addPeriodItem } from "./lessonPlanApi";
import { isPeriodExpired } from "./lessonPlanUtils";
import AddPlanItemSheet from "./AddPlanItemSheet";
import PeriodCarryOverSheet from "./PeriodCarryOverSheet";
import "./lessonPlan.css";

const DEFAULT_DURATION_DAYS = 7;

export default function PeriodPlanScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const [period, setPeriod] = useState(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [showCarryOver, setShowCarryOver] = useState(false);

  async function reload() {
    setPeriod(await getActivePeriodPlan(activeStudentId));
  }

  useEffect(() => { reload(); }, [activeStudentId]);

  async function handleStart() {
    setPeriod(await startPeriodPlan(activeStudentId, DEFAULT_DURATION_DAYS));
  }

  async function handleAddItem(itemInput) {
    setPeriod(await addPeriodItem(activeStudentId, itemInput));
    setShowAdd(false);
  }

  function handleClosed() {
    setShowCarryOver(false);
    reload();
  }

  if (period === undefined) return <div className="screen-center">Загрузка…</div>;

  return (
    <div className="screen lesson-plan-period-screen">
      <div className="screen-header">
        <button className="icon-btn" onClick={() => setScreen("home")} aria-label="Назад"><BackArrowIcon /></button>
        <div>План периода</div>
      </div>

      {!period ? (
        <div style={{ padding: 16 }}>
          <p>Периода пока нет — начните, чтобы вести бэклог целей.</p>
          <Button onClick={handleStart}>Начать период ({DEFAULT_DURATION_DAYS} дней)</Button>
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
            день {Math.min(Math.floor((Date.now() - period.startedAt) / 86400000) + 1, period.durationDays)} из {period.durationDays}
            {isPeriodExpired(period) && <span style={{ color: "#c00" }}> · период завершён</span>}
          </div>

          <ul className="lesson-plan-add-sheet__list">
            {period.items.map((item) => (
              <li key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
                <span>{item.label ?? item.text}</span>
                <span style={{ color: "#1a73e8", fontWeight: 600 }}>×{period.progress[item.id]?.count ?? 0}</span>
              </li>
            ))}
            {period.items.length === 0 && <li style={{ padding: "10px 0", color: "#888" }}>Пока нет целей</li>}
          </ul>

          <Button variant="secondary" onClick={() => setShowAdd(true)}>+ Добавить цель</Button>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button style={{ background: "none", border: "none", color: "#c00", fontSize: 13 }} onClick={() => setShowCarryOver(true)}>
              {isPeriodExpired(period) ? "Завершить период" : "Завершить период досрочно"}
            </button>
          </div>
        </div>
      )}

      {showAdd && <AddPlanItemSheet onPick={handleAddItem} onClose={() => setShowAdd(false)} />}
      {showCarryOver && period && (
        <PeriodCarryOverSheet studentId={activeStudentId} period={period} onClose={handleClosed} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Register the screen in `App.jsx`**

Add the import after line 43 (`import InstructionConstructorScreen from "@/features/instructions/InstructionConstructorScreen";`):
```js
import PeriodPlanScreen from "@/features/lessonPlan/PeriodPlanScreen";
```

Add to `SCREENS` (after `instruction_constructor: InstructionConstructorScreen,`):
```js
  lesson_plan_period: PeriodPlanScreen,
```

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, log in, pick a student. In the browser console run:
```js
window.__store.getState().setScreen('lesson_plan_period')
```
Confirm:
- With no period yet: "Периода пока нет" + "Начать период (7 дней)" button; clicking it shows an empty backlog with day 1/7.
- "+ Добавить цель" opens the sheet; adding a freeform item ("Порисовать") shows it in the list with `×0`.
- Adding a topic item shows the topic list, then that topic's modes; picking one adds it labeled `Тема · Режим`.
- "Завершить период досрочно" opens the carry-over sheet with all-zero items pre-checked; confirming starts a fresh period whose backlog contains only the checked items, each back at `×0`.

- [ ] **Step 5: Commit**

```bash
git add src/features/lessonPlan/PeriodPlanScreen.jsx src/features/lessonPlan/PeriodCarryOverSheet.jsx src/App.jsx
git commit -m "feat(lesson_plan): add period backlog screen and carry-over flow"
```

---

### Task 11: Session-plan builder sheet (`SessionPlanBuilderSheet.jsx`)

**Files:**
- Create: `src/features/lessonPlan/SessionPlanBuilderSheet.jsx`

**Interfaces:**
- Consumes: Task 3's `startSessionPlan`, `closeSessionPlan`.
- Produces (consumed by Task 12): `SessionPlanBuilderSheet({ studentId, periodPlan, existingSessionPlan, onClose })`

- [ ] **Step 1: Implement the sheet**

```jsx
// src/features/lessonPlan/SessionPlanBuilderSheet.jsx
import { useState } from "react";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { startSessionPlan, closeSessionPlan } from "./lessonPlanApi";

export default function SessionPlanBuilderSheet({ studentId, periodPlan, existingSessionPlan, onClose }) {
  const [checkedPeriodItems, setCheckedPeriodItems] = useState(() => {
    if (existingSessionPlan) {
      return new Set(
        existingSessionPlan.items.filter((i) => i.origin === "period").map((i) => i.periodItemId)
      );
    }
    return new Set((periodPlan?.items ?? []).map((i) => i.id));
  });
  const [adhocText, setAdhocText] = useState("");
  const [adhocItems, setAdhocItems] = useState(() =>
    existingSessionPlan ? existingSessionPlan.items.filter((i) => i.origin === "adhoc").map((i) => i.text) : []
  );
  const [saving, setSaving] = useState(false);

  function togglePeriodItem(itemId) {
    setCheckedPeriodItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  function addAdhoc() {
    const text = adhocText.trim();
    if (!text) return;
    setAdhocItems((prev) => [...prev, text]);
    setAdhocText("");
  }

  function removeAdhoc(index) {
    setAdhocItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStart() {
    setSaving(true);
    await startSessionPlan(studentId, {
      periodItemIds: Array.from(checkedPeriodItems),
      adhocTexts: adhocItems,
      periodPlanId: periodPlan?.id ?? null,
    });
    setSaving(false);
    onClose();
  }

  async function handleCloseExisting() {
    setSaving(true);
    await closeSessionPlan(studentId);
    setSaving(false);
    onClose();
  }

  const totalCount = checkedPeriodItems.size + adhocItems.length;

  return (
    <Modal title="Собрать план на сегодня" onClose={onClose}>
      {periodPlan && periodPlan.items.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", margin: "8px 0 6px" }}>
            Из плана периода
          </div>
          <ul className="lesson-plan-add-sheet__list">
            {periodPlan.items.map((item) => (
              <li key={item.id} style={{ padding: "6px 0" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={checkedPeriodItems.has(item.id)}
                    onChange={() => togglePeriodItem(item.id)}
                  />
                  <span>{item.label ?? item.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", margin: "12px 0 6px" }}>
        Разовое на сегодня
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="lesson-plan-add-sheet__input"
          style={{ flex: 1 }}
          value={adhocText}
          onChange={(e) => setAdhocText(e.target.value)}
          placeholder="Например, «повторить стишок»"
        />
        <Button variant="secondary" onClick={addAdhoc} disabled={!adhocText.trim()}>+</Button>
      </div>
      {adhocItems.length > 0 && (
        <ul className="lesson-plan-add-sheet__list">
          {adhocItems.map((text, i) => (
            <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>{text}</span>
              <button onClick={() => removeAdhoc(i)} aria-label="Удалить">×</button>
            </li>
          ))}
        </ul>
      )}

      <Button onClick={handleStart} disabled={saving || totalCount === 0}>
        {existingSessionPlan ? `Обновить план (${totalCount})` : `Начать занятие (${totalCount})`}
      </Button>
      {existingSessionPlan && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            style={{ background: "none", border: "none", color: "#c00", fontSize: 13 }}
            onClick={handleCloseExisting}
            disabled={saving}
          >
            Закрыть текущий чек-лист
          </button>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Manually verify**

No consumer yet (Task 12 wires it in). Verify it compiles:

Run: `npx vite build --configLoader native`
Expected: build succeeds, no errors referencing `SessionPlanBuilderSheet.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/lessonPlan/SessionPlanBuilderSheet.jsx
git commit -m "feat(lesson_plan): add session-plan builder sheet"
```

---

### Task 12: Hub tab (`LessonPlanTab.jsx`)

**Files:**
- Create: `src/features/lessonPlan/LessonPlanTab.jsx`

**Interfaces:**
- Consumes: Task 2's `getActivePeriodPlan`; Task 3's `getActiveSessionPlan` and `pullLessonPlanKvFromServer`; Task 1's `countTouchedGoals`, `sessionOccasionSummary`, `isPeriodExpired`; Task 5's `useLessonPlan`; Task 11's `SessionPlanBuilderSheet`.
- Produces (consumed by Task 14): `LessonPlanTab({ student, setScreen })` — same signature shape as the existing `PlannerTab`/`InstructionsTab`.

- [ ] **Step 1: Implement the hub**

```jsx
// src/features/lessonPlan/LessonPlanTab.jsx
import { useEffect, useState } from "react";
import { getActivePeriodPlan, getActiveSessionPlan, pullLessonPlanKvFromServer } from "./lessonPlanApi";
import { countTouchedGoals, isPeriodExpired, sessionOccasionSummary } from "./lessonPlanUtils";
import { useLessonPlan } from "./LessonPlanContext";
import SessionPlanBuilderSheet from "./SessionPlanBuilderSheet";
import "./lessonPlan.css";

export default function LessonPlanTab({ student, setScreen }) {
  const [periodPlan, setPeriodPlan] = useState(undefined);
  const [sessionPlan, setSessionPlan] = useState(undefined);
  const [showBuilder, setShowBuilder] = useState(false);
  const lessonPlan = useLessonPlan();

  async function reload() {
    if (!student) return;
    const [period, session] = await Promise.all([
      getActivePeriodPlan(student.id),
      getActiveSessionPlan(student.id),
    ]);
    setPeriodPlan(period);
    setSessionPlan(session);
  }

  useEffect(() => {
    if (!student) return;
    pullLessonPlanKvFromServer().then(reload);
  }, [student?.id]);

  function handleBuilderClose() {
    setShowBuilder(false);
    reload();
    lessonPlan?.refresh(student.id);
  }

  if (!student) {
    return <div className="home-tab-empty">Выбери ученика выше</div>;
  }
  if (periodPlan === undefined || sessionPlan === undefined) {
    return <div className="home-tab-empty">Загрузка…</div>;
  }

  const touched = periodPlan ? countTouchedGoals(periodPlan) : null;
  const sessionSummary = sessionPlan ? sessionOccasionSummary(sessionPlan) : null;

  return (
    <div className="lesson-plan-hub">
      <button className="lesson-plan-hub__card" onClick={() => setScreen("lesson_plan_period")}>
        <div className="lesson-plan-hub__label">Период</div>
        <div className="lesson-plan-hub__value">
          {periodPlan
            ? `${touched.touched} из ${touched.total} целей задето${isPeriodExpired(periodPlan) ? " · период завершён" : ""}`
            : "Пока нет активного периода"}
        </div>
      </button>

      <button className="lesson-plan-hub__card lesson-plan-hub__card--active" onClick={() => setShowBuilder(true)}>
        <div className="lesson-plan-hub__label">Занятие сегодня</div>
        <div className="lesson-plan-hub__value">
          {sessionPlan
            ? `${sessionSummary.done}/${sessionSummary.total} · продолжить`
            : "Собрать план на сегодня"}
        </div>
      </button>

      <button className="lesson-plan-hub__history-link" onClick={() => setScreen("lesson_plan_history")}>
        История →
      </button>

      {showBuilder && (
        <SessionPlanBuilderSheet
          studentId={student.id}
          periodPlan={periodPlan}
          existingSessionPlan={sessionPlan}
          onClose={handleBuilderClose}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the hub's CSS**

Append to `src/features/lessonPlan/lessonPlan.css`:
```css
.lesson-plan-hub { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.lesson-plan-hub__card {
  text-align: left; border: 1px solid #e0e0e0; border-radius: 12px; padding: 12px;
  background: #fff; cursor: pointer;
}
.lesson-plan-hub__card--active { border-color: #1a73e8; background: #f0f6ff; }
.lesson-plan-hub__label { font-size: 12px; color: #888; text-transform: uppercase; }
.lesson-plan-hub__value { font-size: 14px; font-weight: 600; margin-top: 4px; }
.lesson-plan-hub__history-link {
  text-align: center; background: none; border: none; color: #1a73e8; font-size: 13px; padding: 8px; cursor: pointer;
}
```

- [ ] **Step 3: Manually verify**

Not reachable from the tab bar yet (Task 14 wires that in). Verify it compiles:

Run: `npx vite build --configLoader native`
Expected: build succeeds, no errors referencing `LessonPlanTab.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/lessonPlan/LessonPlanTab.jsx src/features/lessonPlan/lessonPlan.css
git commit -m "feat(lesson_plan): add hub tab"
```

---

### Task 13: History screen (`LessonPlanHistoryScreen.jsx`)

**Files:**
- Create: `src/features/lessonPlan/LessonPlanHistoryScreen.jsx`
- Modify: `src/App.jsx` (import + `SCREENS` entry for `lesson_plan_history`)

**Interfaces:**
- Consumes: Task 2's `getPeriodPlans`; Task 3's `getSessionsForPeriod`; Task 1's `countTouchedGoals`, `sessionOccasionSummary`.

- [ ] **Step 1: Implement the screen**

```jsx
// src/features/lessonPlan/LessonPlanHistoryScreen.jsx
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { getPeriodPlans, getSessionsForPeriod } from "./lessonPlanApi";
import { countTouchedGoals, sessionOccasionSummary } from "./lessonPlanUtils";
import "./lessonPlan.css";

const RU_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

export default function LessonPlanHistoryScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const [periods, setPeriods] = useState(undefined);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!activeStudentId) return;
    getPeriodPlans(activeStudentId).then((list) => {
      setPeriods([...list].sort((a, b) => b.startedAt - a.startedAt));
    });
  }, [activeStudentId]);

  useEffect(() => {
    if (!selectedPeriodId) { setSessions([]); return; }
    getSessionsForPeriod(activeStudentId, selectedPeriodId).then(setSessions);
  }, [selectedPeriodId, activeStudentId]);

  if (periods === undefined) return <div className="screen-center">Загрузка…</div>;

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null;

  return (
    <div className="screen lesson-plan-history-screen">
      <div className="screen-header">
        <button
          className="icon-btn"
          onClick={() => (selectedPeriod ? setSelectedPeriodId(null) : setScreen("home"))}
          aria-label="Назад"
        >
          <BackArrowIcon />
        </button>
        <div>История</div>
      </div>

      {!selectedPeriod ? (
        <ul className="lesson-plan-add-sheet__list" style={{ padding: 16 }}>
          {periods.length === 0 && <li style={{ color: "#888" }}>Пока нет периодов</li>}
          {periods.map((period) => {
            const touched = countTouchedGoals(period);
            return (
              <li key={period.id}>
                <button
                  onClick={() => setSelectedPeriodId(period.id)}
                  style={{ width: "100%", textAlign: "left", padding: "10px 0", background: "none", border: "none" }}
                >
                  <div>{formatDate(period.startedAt)} — {formatDate(period.startedAt + period.durationDays * 86400000)}</div>
                  <div style={{ fontSize: 13, color: "#888" }}>
                    {touched.touched} из {touched.total} целей задето{period.status === "active" ? " · текущий" : ""}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Рекап по целям</div>
          <ul className="lesson-plan-add-sheet__list">
            {selectedPeriod.items.map((item) => {
              const progress = selectedPeriod.progress[item.id] ?? { count: 0, notes: [] };
              return (
                <li key={item.id} style={{ padding: "8px 0" }}>
                  <div>{item.label ?? item.text} <span style={{ color: "#1a73e8" }}>×{progress.count}</span></div>
                  {progress.notes.length > 0 && (
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {progress.notes.map((n, i) => <span key={i}>«{n.text}» </span>)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div style={{ fontWeight: 600, margin: "16px 0 8px" }}>Таймлайн занятий</div>
          <ul className="lesson-plan-add-sheet__list">
            {sessions.length === 0 && <li style={{ color: "#888" }}>Занятий пока не было</li>}
            {sessions.map((session) => {
              const summary = sessionOccasionSummary(session);
              return (
                <li key={session.id} style={{ padding: "6px 0", fontSize: 13 }}>
                  <b>{formatDate(session.createdAt)}</b> — {session.items.map((i) => i.label ?? i.text).join(", ")} ({summary.done}/{summary.total})
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Register the screen in `App.jsx`**

Add the import next to `PeriodPlanScreen`'s (from Task 10):
```js
import LessonPlanHistoryScreen from "@/features/lessonPlan/LessonPlanHistoryScreen";
```

Add to `SCREENS`, next to `lesson_plan_period`:
```js
  lesson_plan_period: PeriodPlanScreen,
  lesson_plan_history: LessonPlanHistoryScreen,
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, log in, pick a student, build up a period with an item and one session-plan occasion (via the console-driven flow from Task 10's verification plus the builder from Task 11/12 once Task 12 is reachable — if Task 14 hasn't landed yet, drive it via `window.__store.getState().setScreen('lesson_plan_history')` directly after seeding data through the API in the console). Confirm:
- The period list shows the period with a correct date range and "N из M целей задето".
- Opening it shows the recap (counts + notes) and a timeline entry per closed session-plan occasion, with the right date and item list.

- [ ] **Step 4: Commit**

```bash
git add src/features/lessonPlan/LessonPlanHistoryScreen.jsx src/App.jsx
git commit -m "feat(lesson_plan): add history screen with recap and timeline"
```

---

### Task 14: Wire the 4th tab into `HomeScreen.jsx` and rename the meal planner tab

**Files:**
- Modify: `src/features/home/HomeScreen.jsx:12` (import), `:99-118` (icon), `:120-153` (`HomeTabs`), `:743-744` (access flags), `:824-845` (tab-content render), `:849` (`HomeTabs` invocation)
- Modify: `src/core/groupStore.js:51-54` (stray comment)
- Modify: `src/shared/components/OptionsPicker.jsx:1-5` (stray comment)
- Modify: `src/shared/components/StoveHeatModal.jsx:1-16` (stray comment)

**Interfaces:**
- Consumes: Task 12's `LessonPlanTab`.

- [ ] **Step 1: Import `LessonPlanTab`**

In `src/features/home/HomeScreen.jsx`, add after line 25 (`import InstructionsTab from "@/features/instructions/InstructionsTab";`):
```js
import LessonPlanTab from "@/features/lessonPlan/LessonPlanTab";
```

- [ ] **Step 2: Add the tab icon**

After `InstructionsTabIcon` (line 118), add:
```jsx
function LessonPlanTabIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="4" y="3" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7.5 8h7M7.5 11.5h7M7.5 15h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Add the 4th tab to `HomeTabs`, rename the meal-planner tab**

Replace the `HomeTabs` function (lines 120-153) with:
```jsx
function HomeTabs({ active, onChange, showPlanner, showInstructions, showLessonPlan }) {
  return (
    <nav className="home-tabbar" role="tablist">
      <button
        role="tab"
        className={`home-tabbar__item${active === 'session' ? ' home-tabbar__item--active' : ''}`}
        onClick={() => onChange('session')}
      >
        <SessionTabIcon />
        <span>Занятие</span>
      </button>
      {showLessonPlan && (
        <button
          role="tab"
          className={`home-tabbar__item${active === 'lesson_plan' ? ' home-tabbar__item--active' : ''}`}
          onClick={() => onChange('lesson_plan')}
        >
          <LessonPlanTabIcon />
          <span>План занятия</span>
        </button>
      )}
      {showPlanner && (
        <button
          role="tab"
          className={`home-tabbar__item${active === 'planner' ? ' home-tabbar__item--active' : ''}`}
          onClick={() => onChange('planner')}
        >
          <PlannerTabIcon />
          <span>Меню и магазин</span>
        </button>
      )}
      {showInstructions && (
        <button
          role="tab"
          className={`home-tabbar__item${active === 'instructions' ? ' home-tabbar__item--active' : ''}`}
          onClick={() => onChange('instructions')}
        >
          <InstructionsTabIcon />
          <span>Инструкции</span>
        </button>
      )}
    </nav>
  );
}
```

- [ ] **Step 4: Add the access flag**

After line 744 (`const hasInstructionsAccess = ...`), add:
```js
  const hasLessonPlanAccess = Array.isArray(account?.featureFlags) && account.featureFlags.includes("lesson_plan");
```

- [ ] **Step 5: Render `LessonPlanTab` and pass the new flag**

Change the tab-content ternary (lines 824-828) from:
```jsx
          {activeTab === 'instructions' && hasInstructionsAccess ? (
            <InstructionsTab setScreen={setScreen} />
          ) : activeTab === 'planner' && hasPlannerAccess ? (
            <PlannerTab student={student} setScreen={setScreen} />
          ) : (
```
to:
```jsx
          {activeTab === 'instructions' && hasInstructionsAccess ? (
            <InstructionsTab setScreen={setScreen} />
          ) : activeTab === 'lesson_plan' && hasLessonPlanAccess ? (
            <LessonPlanTab student={student} setScreen={setScreen} />
          ) : activeTab === 'planner' && hasPlannerAccess ? (
            <PlannerTab student={student} setScreen={setScreen} />
          ) : (
```

Change the `HomeTabs` invocation (line 849) from:
```jsx
      <HomeTabs active={activeTab} onChange={changeTab} showPlanner={hasPlannerAccess} showInstructions={hasInstructionsAccess} />
```
to:
```jsx
      <HomeTabs active={activeTab} onChange={changeTab} showPlanner={hasPlannerAccess} showInstructions={hasInstructionsAccess} showLessonPlan={hasLessonPlanAccess} />
```

- [ ] **Step 6: Rename the remaining stray "Планировщик" code comments**

In `src/core/groupStore.js:30`, change:
```js
// Independent of the Планировщик plan's own selectedOptions (which drives the
```
to:
```js
// Independent of the meal planner's own selectedOptions (which drives the
```

In `src/shared/components/OptionsPicker.jsx:3`, change:
```js
 * shared between the Планировщик add-to-menu flow and the per-recipe
```
to:
```js
 * shared between the meal planner's add-to-menu flow and the per-recipe
```

In `src/shared/components/StoveHeatModal.jsx:15`, change:
```js
 * family's own dial number. Reused from both the Планировщик "Меню" screen
```
to:
```js
 * family's own dial number. Reused from both the meal planner's "Меню" screen
```

These are documentation-only comment edits with no behavioral effect.

- [ ] **Step 7: Add your own account's feature flag (local dev/production account)**

The tab is gated behind `account.featureFlags.includes("lesson_plan")`, matching how `"planner"` and `"instructions"` already work. Add `"lesson_plan"` to your account's `featureFlags` the same way those were provisioned (check how `"planner"`/`"instructions"` got onto your account — likely a direct DB/backend update, since there's no self-service UI for this in the codebase searched so far). This step has no code change; it's an account-data change needed before the tab becomes visible to you.

- [ ] **Step 8: Manually verify**

Run: `npm run dev`, log in with an account that has `"lesson_plan"` in `featureFlags` (Step 7), pick a student. Confirm:
- The tab bar now shows 4 tabs: Занятие, План занятия, Меню и магазин, Инструкции — in that order.
- The second tab's label is "План занятия"; the third tab's label is "Меню и магазин" (not "Планировщик" anywhere).
- Tapping "План занятия" shows the hub from Task 12; tapping its two cards navigates to the period screen and opens the session builder respectively; "История →" opens the history screen.
- Full end-to-end flow: start a period, add a topic-linked goal, build today's checklist including it, confirm the floating badge appears on both the topic-selection screen and (after "Играть это") on top of `SessionScreen`, finish that session, confirm the badge shows `1/1`, confirm the period's item counter incremented to `×1` back on the period screen.
- Switch to a student with no active session plan (or deselect) — confirm the floating badge disappears.
- Simulate iOS safe-area per `CLAUDE.md`'s verification snippet in devtools console:
  ```js
  document.documentElement.classList.add('app-ios-standalone');
  document.documentElement.style.setProperty('--app-safe-top', '59px');
  document.documentElement.style.setProperty('--app-safe-bottom', '34px');
  ```
  then confirm the floating badge (top-right) and expanded sheet (bottom) don't sit under the simulated notch/home-indicator.

- [ ] **Step 9: Commit**

```bash
git add src/features/home/HomeScreen.jsx src/core/groupStore.js src/shared/components/OptionsPicker.jsx src/shared/components/StoveHeatModal.jsx
git commit -m "feat(lesson_plan): wire 4th tab into HomeScreen, rename meal planner tab"
```
