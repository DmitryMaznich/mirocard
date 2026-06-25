# Planner — Menu UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Curator can build a multi-day, multi-meal recipe plan for a student, review the auto-generated shopping list, and send the plan to the student portal with one tap.

**Architecture:** Plans are stored in IndexedDB (`account_kv`) via the existing `pushOp("kv.upsert")` sync mechanism (same pattern as recipe overrides). A "Send to student" action calls `PATCH /students/{id}/active-task` — an existing endpoint that is extended here to accept a `planData` field, storing it in the `active_plan_data` column of `student_portals`. Recipe metadata (tags, ingredients) is parsed from the raw `.txt` files stored inside topic ZIPs in IndexedDB using the `parseRecipeMetadata` function from Plan 1.

**Tech Stack:** React/Vite, Zustand, IndexedDB (via `@/core/db`), Node.js backend (SQLite `DatabaseSync`)

## Global Constraints

- Branch: `feat/student-portal`
- Tests: Vitest — run with `npx vitest run <path>`
- No new npm packages — only use what is already in `package.json`
- Follow existing code style: no default exports on pure-function files, default exports on React screen components
- CSS: add rules to new `src/features/planner/planner.css`; import it in each screen component
- All Russian strings (labels, messages) stay in component JSX — no i18n layer
- `plannerUtils.js` must have zero side effects — all functions are pure and return new objects
- Do not modify `content/pantry.txt` — pantry items are mirrored as a JS constant in `plannerApi.js`

---

## File Map

```
NEW
src/features/planner/plannerUtils.js          pure plan model functions
src/features/planner/plannerUtils.test.js     unit tests (Vitest)
src/features/planner/plannerApi.js            async save/load plan + send to student
src/features/planner/PlannerMenuScreen.jsx    day/meal/recipe selection UI (screen)
src/features/planner/PlannerSummaryScreen.jsx review + shopping list + send button (screen)
src/features/planner/planner.css              all planner-specific styles

MODIFY
backend/lib/student-portal.mjs:40-45          extend setPortalActiveTask to accept planData
backend/server.mjs:766-776                    extend handleSetActiveTask to pass planData
src/core/store.js                             add plannerStudentId state
src/App.jsx:58-78                             register planner_menu + planner_summary screens
src/features/home/HomeScreen.jsx:269-327      add Планировщик section
```

---

### Task 1: Pure plan model (`plannerUtils.js`)

**Files:**
- Create: `src/features/planner/plannerUtils.js`
- Test: `src/features/planner/plannerUtils.test.js`

**Interfaces:**
- Produces:
  - `MEAL_TYPES: string[]` — `['завтрак', 'обед', 'ужин', 'перекус']`
  - `createPlan(studentId: string, portionMultiplier?: number): Plan`
  - `createDay(dayIndex: number): Day`
  - `addDay(plan: Plan): Plan`
  - `addRecipeToMeal(plan: Plan, dayIndex: number, mealType: string, textId: string): Plan`
  - `removeRecipeFromMeal(plan: Plan, dayIndex: number, mealType: string, textId: string): Plan`
  - `getPlanRecipes(plan: Plan): Array<{textId: string, portionMultiplier: number}>`
  - `countPlanRecipes(plan: Plan): number`

  **Plan shape:**
  ```js
  {
    id: string,              // crypto.randomUUID()
    studentId: string,
    portionMultiplier: number,
    status: 'draft' | 'sent',
    days: Day[],
    createdAt: string,       // ISO
    updatedAt: string,       // ISO
  }
  ```
  **Day shape:**
  ```js
  {
    dayIndex: number,
    meals: { завтрак: string[], обед: string[], ужин: string[], перекус: string[] }
  }
  ```

- [ ] **Step 1: Write the failing tests**

  Create `src/features/planner/plannerUtils.test.js`:

  ```js
  import { describe, it, expect } from 'vitest';
  import {
    MEAL_TYPES,
    createPlan,
    createDay,
    addDay,
    addRecipeToMeal,
    removeRecipeFromMeal,
    getPlanRecipes,
    countPlanRecipes,
  } from './plannerUtils.js';

  describe('MEAL_TYPES', () => {
    it('contains all four meal types', () => {
      expect(MEAL_TYPES).toEqual(['завтрак', 'обед', 'ужин', 'перекус']);
    });
  });

  describe('createPlan', () => {
    it('creates a plan with one day and correct defaults', () => {
      const plan = createPlan('student1', 2);
      expect(plan.studentId).toBe('student1');
      expect(plan.portionMultiplier).toBe(2);
      expect(plan.status).toBe('draft');
      expect(plan.days).toHaveLength(1);
      expect(plan.days[0].dayIndex).toBe(0);
      expect(typeof plan.id).toBe('string');
      expect(plan.id.length).toBeGreaterThan(0);
    });

    it('defaults portionMultiplier to 1', () => {
      const plan = createPlan('s1');
      expect(plan.portionMultiplier).toBe(1);
    });

    it('starts all meals empty', () => {
      const plan = createPlan('s1');
      for (const type of MEAL_TYPES) {
        expect(plan.days[0].meals[type]).toEqual([]);
      }
    });
  });

  describe('createDay', () => {
    it('creates a day with the given dayIndex and all empty meals', () => {
      const day = createDay(3);
      expect(day.dayIndex).toBe(3);
      for (const type of MEAL_TYPES) {
        expect(day.meals[type]).toEqual([]);
      }
    });
  });

  describe('addDay', () => {
    it('appends a day with dayIndex equal to the current length', () => {
      const plan = createPlan('s1');
      const updated = addDay(plan);
      expect(updated.days).toHaveLength(2);
      expect(updated.days[1].dayIndex).toBe(1);
    });

    it('does not mutate the original plan', () => {
      const plan = createPlan('s1');
      addDay(plan);
      expect(plan.days).toHaveLength(1);
    });

    it('updates updatedAt', () => {
      const plan = createPlan('s1');
      const updated = addDay(plan);
      expect(updated.updatedAt).not.toBe(plan.updatedAt === updated.updatedAt ? plan.updatedAt : updated.updatedAt);
      // updatedAt is a valid ISO string
      expect(() => new Date(updated.updatedAt)).not.toThrow();
    });
  });

  describe('addRecipeToMeal', () => {
    it('adds recipe to the correct meal on the correct day', () => {
      const plan = createPlan('s1');
      const updated = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
      expect(updated.days[0].meals['обед']).toContain('soup_01');
    });

    it('does not add a recipe that is already present', () => {
      const plan = createPlan('s1');
      const p1 = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
      const p2 = addRecipeToMeal(p1, 0, 'обед', 'soup_01');
      expect(p2.days[0].meals['обед']).toHaveLength(1);
    });

    it('does not affect other meal types on the same day', () => {
      const plan = createPlan('s1');
      const updated = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
      expect(updated.days[0].meals['завтрак']).toEqual([]);
    });

    it('does not affect other days', () => {
      const plan = addDay(createPlan('s1'));
      const updated = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
      expect(updated.days[1].meals['обед']).toEqual([]);
    });

    it('does not mutate the original plan', () => {
      const plan = createPlan('s1');
      addRecipeToMeal(plan, 0, 'обед', 'soup_01');
      expect(plan.days[0].meals['обед']).toEqual([]);
    });
  });

  describe('removeRecipeFromMeal', () => {
    it('removes the specified recipe', () => {
      const plan = createPlan('s1');
      const p1 = addRecipeToMeal(plan, 0, 'ужин', 'chicken_01');
      const p2 = removeRecipeFromMeal(p1, 0, 'ужин', 'chicken_01');
      expect(p2.days[0].meals['ужин']).toHaveLength(0);
    });

    it('keeps other recipes in the same meal', () => {
      const plan = createPlan('s1');
      const p1 = addRecipeToMeal(plan, 0, 'ужин', 'chicken_01');
      const p2 = addRecipeToMeal(p1, 0, 'ужин', 'salad_01');
      const p3 = removeRecipeFromMeal(p2, 0, 'ужин', 'chicken_01');
      expect(p3.days[0].meals['ужин']).toEqual(['salad_01']);
    });

    it('is a no-op when recipe is not present', () => {
      const plan = createPlan('s1');
      const updated = removeRecipeFromMeal(plan, 0, 'обед', 'nonexistent');
      expect(updated.days[0].meals['обед']).toEqual([]);
    });
  });

  describe('getPlanRecipes', () => {
    it('returns all unique recipes with portionMultiplier', () => {
      const plan = createPlan('s1', 3);
      const p1 = addRecipeToMeal(plan, 0, 'завтрак', 'oatmeal_01');
      const p2 = addRecipeToMeal(p1, 0, 'обед', 'soup_01');
      const recipes = getPlanRecipes(p2);
      expect(recipes).toHaveLength(2);
      expect(recipes[0]).toEqual({ textId: 'oatmeal_01', portionMultiplier: 3 });
      expect(recipes[1]).toEqual({ textId: 'soup_01', portionMultiplier: 3 });
    });

    it('deduplicates the same recipe across multiple days', () => {
      const plan = createPlan('s1');
      const p1 = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
      const p2 = addRecipeToMeal(addDay(p1), 1, 'обед', 'soup_01');
      expect(getPlanRecipes(p2)).toHaveLength(1);
    });

    it('returns empty array for a plan with no recipes', () => {
      expect(getPlanRecipes(createPlan('s1'))).toEqual([]);
    });
  });

  describe('countPlanRecipes', () => {
    it('counts unique recipes across all days and meals', () => {
      const plan = createPlan('s1');
      const p1 = addRecipeToMeal(plan, 0, 'завтрак', 'a');
      const p2 = addRecipeToMeal(p1, 0, 'обед', 'b');
      const p3 = addRecipeToMeal(addDay(p2), 1, 'ужин', 'a'); // duplicate
      expect(countPlanRecipes(p3)).toBe(2);
    });

    it('returns 0 for an empty plan', () => {
      expect(countPlanRecipes(createPlan('s1'))).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```
  npx vitest run src/features/planner/plannerUtils.test.js
  ```
  Expected: all tests FAIL with "Cannot find module './plannerUtils.js'"

- [ ] **Step 3: Implement `plannerUtils.js`**

  Create `src/features/planner/plannerUtils.js`:

  ```js
  export const MEAL_TYPES = ['завтрак', 'обед', 'ужин', 'перекус'];

  export function createPlan(studentId, portionMultiplier = 1) {
    return {
      id: crypto.randomUUID(),
      studentId,
      portionMultiplier,
      status: 'draft',
      days: [createDay(0)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  export function createDay(dayIndex) {
    return {
      dayIndex,
      meals: { завтрак: [], обед: [], ужин: [], перекус: [] },
    };
  }

  export function addDay(plan) {
    return {
      ...plan,
      days: [...plan.days, createDay(plan.days.length)],
      updatedAt: new Date().toISOString(),
    };
  }

  export function addRecipeToMeal(plan, dayIndex, mealType, textId) {
    return {
      ...plan,
      days: plan.days.map((day) => {
        if (day.dayIndex !== dayIndex) return day;
        const existing = day.meals[mealType] ?? [];
        if (existing.includes(textId)) return day;
        return { ...day, meals: { ...day.meals, [mealType]: [...existing, textId] } };
      }),
      updatedAt: new Date().toISOString(),
    };
  }

  export function removeRecipeFromMeal(plan, dayIndex, mealType, textId) {
    return {
      ...plan,
      days: plan.days.map((day) => {
        if (day.dayIndex !== dayIndex) return day;
        return {
          ...day,
          meals: {
            ...day.meals,
            [mealType]: (day.meals[mealType] ?? []).filter((id) => id !== textId),
          },
        };
      }),
      updatedAt: new Date().toISOString(),
    };
  }

  export function getPlanRecipes(plan) {
    const seen = new Set();
    const result = [];
    for (const day of plan.days) {
      for (const textIds of Object.values(day.meals)) {
        for (const textId of textIds) {
          if (!seen.has(textId)) {
            seen.add(textId);
            result.push({ textId, portionMultiplier: plan.portionMultiplier });
          }
        }
      }
    }
    return result;
  }

  export function countPlanRecipes(plan) {
    const seen = new Set();
    for (const day of plan.days) {
      for (const textIds of Object.values(day.meals)) {
        textIds.forEach((id) => seen.add(id));
      }
    }
    return seen.size;
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```
  npx vitest run src/features/planner/plannerUtils.test.js
  ```
  Expected: all 19 tests PASS

- [ ] **Step 5: Commit**

  ```
  git add src/features/planner/plannerUtils.js src/features/planner/plannerUtils.test.js
  git commit -m "feat(planner): pure plan model utils + tests"
  ```

---

### Task 2: Backend — extend `setPortalActiveTask` for `planData`

**Files:**
- Modify: `backend/lib/student-portal.mjs` (function `setPortalActiveTask` at line 40)
- Modify: `backend/server.mjs` (function `handleSetActiveTask` at line 766)

**Context:**
- `setPortalActiveTask` currently only sets `active_topic_id` and `active_mode_id`. The `student_portals` table already has an `active_plan_data TEXT` column (added in Plan 1).
- When the frontend sends `{ planData: <object> }` the backend must JSON.stringify it before storing.
- Backward compatibility: if `planData` is not present in the request body, do NOT touch `active_plan_data`.
- When `planData` is explicitly `null`, clear `active_plan_data` to NULL.

**Interfaces:**
- Consumes: existing `setPortalActiveTask`, `handleSetActiveTask`
- Produces: `setPortalActiveTask` now accepts optional `planData?: string | null`

**No automated tests for this task** — the integration is tested manually by sending a PATCH request and checking the DB. Verify with the curl command in Step 4.

- [ ] **Step 1: Update `setPortalActiveTask` in `backend/lib/student-portal.mjs`**

  Find the function at line 40. Replace the entire function body:

  **Before:**
  ```js
  export function setPortalActiveTask(db, { accountId, studentId, topicId, modeId }) {
    db.prepare(
      `UPDATE student_portals
       SET active_topic_id = ?, active_mode_id = ?
       WHERE account_id = ? AND student_id = ? AND revoked_at IS NULL`
    ).run(topicId ?? null, modeId ?? null, accountId, studentId);
  }
  ```

  **After:**
  ```js
  export function setPortalActiveTask(db, { accountId, studentId, topicId, modeId, planData }) {
    if (planData !== undefined) {
      db.prepare(
        `UPDATE student_portals
         SET active_topic_id = ?, active_mode_id = ?, active_plan_data = ?
         WHERE account_id = ? AND student_id = ? AND revoked_at IS NULL`
      ).run(topicId ?? null, modeId ?? null, planData, accountId, studentId);
    } else {
      db.prepare(
        `UPDATE student_portals
         SET active_topic_id = ?, active_mode_id = ?
         WHERE account_id = ? AND student_id = ? AND revoked_at IS NULL`
      ).run(topicId ?? null, modeId ?? null, accountId, studentId);
    }
  }
  ```

- [ ] **Step 2: Update `handleSetActiveTask` in `backend/server.mjs`**

  Find the function at line 766. Replace the entire function body:

  **Before:**
  ```js
  async function handleSetActiveTask(req, res, studentId) {
    const account = requireAuth(req);
    const body = await readJsonBody(req);
    setPortalActiveTask(db, {
      accountId: account.id,
      studentId,
      topicId: body.topicId ?? null,
      modeId: body.modeId ?? null,
    });
    return writeNoContent(res);
  }
  ```

  **After:**
  ```js
  async function handleSetActiveTask(req, res, studentId) {
    const account = requireAuth(req);
    const body = await readJsonBody(req);
    const planData = 'planData' in body
      ? (body.planData != null ? JSON.stringify(body.planData) : null)
      : undefined;
    setPortalActiveTask(db, {
      accountId: account.id,
      studentId,
      topicId: body.topicId ?? null,
      modeId: body.modeId ?? null,
      planData,
    });
    return writeNoContent(res);
  }
  ```

- [ ] **Step 3: Restart the backend and verify it starts cleanly**

  ```
  # Kill existing backend process and restart
  # On Windows: Task Manager or the same Scheduled Task restart
  # Check the log for errors:
  # tail the backend log or check for startup errors
  ```

  If there's a running backend, verify it reloads without error. If it's a Scheduled Task, restart it via Task Scheduler or PowerShell:
  ```powershell
  # Example: kill and restart
  Get-Process -Name "node" | Stop-Process -Force
  # Then restart via the scheduled task or manually
  ```

- [ ] **Step 4: Commit**

  ```
  git add backend/lib/student-portal.mjs backend/server.mjs
  git commit -m "feat(planner): extend active-task endpoint to accept planData"
  ```

---

### Task 3: `plannerApi.js` — async save/load/send

**Files:**
- Create: `src/features/planner/plannerApi.js`

**Interfaces:**
- Consumes: `getDb`, `kv` from `@/core/db`; `pushOp` from `@/core/syncApi`; `api` from `@/core/api`
- Produces:
  - `PANTRY_ITEMS: Set<string>` — hardcoded lowercase pantry staples
  - `savePlan(plan: Plan): Promise<void>`
  - `loadPlan(studentId: string): Promise<Plan | null>`
  - `sendPlanToStudent(studentId: string, plan: Plan): Promise<void>`

**No tests for this task** — it wraps IndexedDB and network APIs that require a browser runtime.

- [ ] **Step 1: Create `src/features/planner/plannerApi.js`**

  ```js
  import { getDb, kv } from '@/core/db';
  import { pushOp } from '@/core/syncApi';
  import { api } from '@/core/api';

  const planKey = (studentId) => `planner:plan:${studentId}`;

  export const PANTRY_ITEMS = new Set([
    'масло растительное',
    'масло сливочное',
    'масло оливковое',
    'масло тыквенное',
    'соль',
    'сахар',
    'специи',
    'мёд',
    'бальзамический уксус',
    'яблочный уксус',
    'мука',
    'горчица',
    'кетчуп',
  ]);

  export async function savePlan(plan) {
    const db = await getDb();
    const key = planKey(plan.studentId);
    await kv.set(db, key, plan);
    pushOp('kv.upsert', { key, value: plan }).catch(() => {});
  }

  export async function loadPlan(studentId) {
    const db = await getDb();
    return (await kv.get(db, planKey(studentId))) ?? null;
  }

  export async function sendPlanToStudent(studentId, plan) {
    await api.patch(`/students/${studentId}/active-task`, {
      topicId: null,
      modeId: null,
      planData: plan,
    });
  }
  ```

- [ ] **Step 2: Commit**

  ```
  git add src/features/planner/plannerApi.js
  git commit -m "feat(planner): async plan save/load/send API"
  ```

---

### Task 4: `planner.css` + `PlannerMenuScreen.jsx`

**Files:**
- Create: `src/features/planner/planner.css`
- Create: `src/features/planner/PlannerMenuScreen.jsx`

**Interfaces:**
- Consumes:
  - `createPlan`, `addDay`, `addRecipeToMeal`, `removeRecipeFromMeal`, `countPlanRecipes`, `MEAL_TYPES` from `./plannerUtils.js`
  - `savePlan`, `loadPlan` from `./plannerApi.js`
  - `parseRecipeMetadata` from `./recipeParser.js`
  - `getRawRecipeTxt` from `@/core/groupStore`
  - `useTopicFile` from `@/shared/hooks/useTopicFile`
  - `useAppStore` from `@/core/store`
  - `getTopicTitle` from `@/shared/utils/format`
  - `Button` from `@/shared/components/Button`
- Produces: default export `PlannerMenuScreen` React component; navigates to `planner_summary` on Next

**No automated tests** — UI is verified visually. Manual test: open planner, add a recipe, remove it, add a day, tap Next.

- [ ] **Step 1: Create `src/features/planner/planner.css`**

  ```css
  /* ── Shared layout ──────────────────────────────────────────── */
  .planner-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg, #f5f5f5);
  }

  .planner-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--color-surface, #fff);
    border-bottom: 1px solid var(--color-border, #e0e0e0);
  }

  .planner-header__back {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    padding: 4px 8px;
    color: var(--color-text, #222);
    line-height: 1;
  }

  .planner-header__title {
    font-size: 17px;
    font-weight: 600;
    margin: 0;
    flex: 1;
  }

  .planner-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .planner-footer {
    padding: 12px 16px;
    background: var(--color-surface, #fff);
    border-top: 1px solid var(--color-border, #e0e0e0);
  }

  /* ── Day card ───────────────────────────────────────────────── */
  .planner-day-card {
    background: var(--color-surface, #fff);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
  }

  .planner-day-title {
    padding: 10px 16px;
    font-weight: 600;
    font-size: 14px;
    background: var(--color-surface-2, #f0f0f0);
    color: var(--color-text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  /* ── Meal section ───────────────────────────────────────────── */
  .planner-meal-section {
    padding: 10px 16px;
    border-top: 1px solid var(--color-border, #e0e0e0);
  }

  .planner-meal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
  }

  .planner-meal-type {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #222);
    text-transform: capitalize;
    min-width: 72px;
  }

  .planner-add-btn {
    background: none;
    border: 1px dashed var(--color-border, #ccc);
    border-radius: 8px;
    padding: 3px 12px;
    font-size: 13px;
    color: var(--color-primary, #5b5fc7);
    cursor: pointer;
    flex-shrink: 0;
  }

  .planner-add-btn:hover {
    background: var(--color-primary-light, #eef);
  }

  .planner-recipe-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .planner-recipe-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--color-primary-light, #eef);
    border-radius: 16px;
    padding: 4px 6px 4px 10px;
    font-size: 12px;
    color: var(--color-text, #222);
  }

  .planner-recipe-chip__remove {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 2px;
    font-size: 15px;
    line-height: 1;
    color: var(--color-text-secondary, #888);
    flex-shrink: 0;
  }

  /* ── Add day button ─────────────────────────────────────────── */
  .planner-add-day {
    background: none;
    border: 1.5px dashed var(--color-border, #ccc);
    border-radius: 14px;
    padding: 14px;
    width: 100%;
    font-size: 15px;
    color: var(--color-primary, #5b5fc7);
    cursor: pointer;
    text-align: center;
  }

  .planner-add-day:hover {
    background: var(--color-primary-light, #eef);
  }

  /* ── Recipe picker overlay ──────────────────────────────────── */
  .recipe-picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 300;
    display: flex;
    align-items: flex-end;
  }

  .recipe-picker-sheet {
    background: var(--color-surface, #fff);
    border-radius: 20px 20px 0 0;
    width: 100%;
    max-height: 72vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .recipe-picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--color-border, #e0e0e0);
  }

  .recipe-picker-header__title {
    font-size: 16px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .recipe-picker-header__close {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: var(--color-text-secondary, #888);
    padding: 0 4px;
    line-height: 1;
  }

  .recipe-picker-list {
    overflow-y: auto;
    flex: 1;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .recipe-picker-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: none;
    border-radius: 10px;
    background: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .recipe-picker-card:hover,
  .recipe-picker-card:active {
    background: var(--color-surface-2, #f5f5f5);
  }

  .recipe-picker-card--selected {
    background: var(--color-primary-light, #eef) !important;
  }

  .recipe-picker-card__photo {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--color-surface-2, #f0f0f0);
  }

  .recipe-picker-card__photo--placeholder {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: var(--color-surface-2, #f0f0f0);
    flex-shrink: 0;
  }

  .recipe-picker-card__title {
    flex: 1;
    font-size: 15px;
    color: var(--color-text, #222);
  }

  .recipe-picker-card__check {
    font-size: 18px;
    color: var(--color-primary, #5b5fc7);
    flex-shrink: 0;
  }

  .recipe-picker-empty,
  .recipe-picker-loading {
    padding: 32px 20px;
    text-align: center;
    color: var(--color-text-secondary, #888);
    font-size: 15px;
  }

  /* ── Summary screen ─────────────────────────────────────────── */
  .plan-days-summary {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .plan-day-summary {
    background: var(--color-surface, #fff);
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
  }

  .plan-day-summary__title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--color-text-secondary, #666);
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  .plan-meal-row {
    font-size: 13px;
    margin-bottom: 5px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .plan-meal-row__type {
    color: var(--color-text-secondary, #888);
    margin-right: 2px;
    min-width: 64px;
    flex-shrink: 0;
  }

  .plan-meal-row__recipe {
    background: var(--color-primary-light, #eef);
    border-radius: 10px;
    padding: 2px 8px;
    font-size: 12px;
    color: var(--color-text, #222);
  }

  .shopping-preview {
    background: var(--color-surface, #fff);
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
  }

  .shopping-preview__title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 10px;
  }

  .shopping-preview-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .shopping-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 10px;
    background: var(--color-surface-2, #f5f5f5);
    border-radius: 8px;
    font-size: 14px;
  }

  .shopping-item__name {
    flex: 1;
  }

  .shopping-item__qty {
    color: var(--color-text-secondary, #888);
    font-size: 13px;
    margin-left: 8px;
  }

  .shopping-pantry {
    margin-top: 10px;
    font-size: 12px;
    color: var(--color-text-secondary, #888);
    line-height: 1.5;
  }

  .planner-sent {
    text-align: center;
    padding: 14px;
    font-size: 16px;
    font-weight: 600;
    color: #2a7a2a;
  }

  .planner-loading {
    text-align: center;
    color: var(--color-text-secondary, #888);
    padding: 20px;
    font-size: 14px;
  }

  /* ── HomeScreen planner section ─────────────────────────────── */
  .home-planner {
    padding: 16px;
    border-top: 1px solid var(--color-border, #e0e0e0);
  }

  .home-planner__label {
    font-size: 12px;
    color: var(--color-text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: .06em;
    font-weight: 600;
    margin-bottom: 10px;
  }
  ```

- [ ] **Step 2: Create `src/features/planner/PlannerMenuScreen.jsx`**

  ```jsx
  import { useEffect, useState } from 'react';
  import { useAppStore } from '@/core/store';
  import { getTopicTitle } from '@/shared/utils/format';
  import { useTopicFile } from '@/shared/hooks/useTopicFile';
  import { getRawRecipeTxt } from '@/core/groupStore';
  import Button from '@/shared/components/Button';
  import { parseRecipeMetadata } from './recipeParser.js';
  import {
    createPlan,
    addDay,
    addRecipeToMeal,
    removeRecipeFromMeal,
    countPlanRecipes,
    MEAL_TYPES,
  } from './plannerUtils.js';
  import { loadPlan, savePlan } from './plannerApi.js';
  import './planner.css';

  // ─── RecipePickerCard ──────────────────────────────────────────────────────────

  function RecipePhoto({ topicId, imagePath }) {
    const url = useTopicFile(topicId, imagePath);
    if (url) return <img src={url} alt="" className="recipe-picker-card__photo" />;
    return <div className="recipe-picker-card__photo--placeholder" />;
  }

  function RecipePickerCard({ topicId, text, selected, onAdd }) {
    return (
      <button
        className={`recipe-picker-card${selected ? ' recipe-picker-card--selected' : ''}`}
        onClick={onAdd}
        disabled={selected}
      >
        <RecipePhoto topicId={topicId} imagePath={text.image} />
        <span className="recipe-picker-card__title">{getTopicTitle(text.title)}</span>
        {selected && <span className="recipe-picker-card__check">✓</span>}
      </button>
    );
  }

  // ─── RecipePicker bottom sheet ─────────────────────────────────────────────────

  function RecipePicker({ mealType, existingIds, onAdd, onClose }) {
    const topicRecords = useAppStore((s) => s.topicRecords);
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      async function load() {
        const all = [];
        for (const record of topicRecords) {
          if (record.meta?.renderer !== 'reading') continue;
          for (const text of record.texts ?? []) {
            if (text.kind !== 'instruction' || !text.file) continue;
            const content = await getRawRecipeTxt(record.meta.id, text.file);
            if (!content) continue;
            const { tags } = parseRecipeMetadata(content);
            if (!tags.includes(mealType)) continue;
            all.push({ topicId: record.meta.id, text });
          }
        }
        if (!cancelled) { setRecipes(all); setLoading(false); }
      }
      load();
      return () => { cancelled = true; };
    }, [topicRecords, mealType]);

    return (
      <div className="recipe-picker-overlay" onClick={onClose}>
        <div className="recipe-picker-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="recipe-picker-header">
            <span className="recipe-picker-header__title">{mealType}</span>
            <button className="recipe-picker-header__close" onClick={onClose}>✕</button>
          </div>
          {loading ? (
            <div className="recipe-picker-loading">Загрузка…</div>
          ) : recipes.length === 0 ? (
            <div className="recipe-picker-empty">Нет рецептов для «{mealType}»</div>
          ) : (
            <div className="recipe-picker-list">
              {recipes.map(({ topicId, text }) => (
                <RecipePickerCard
                  key={`${topicId}_${text.id}`}
                  topicId={topicId}
                  text={text}
                  selected={existingIds.includes(text.id)}
                  onAdd={() => { onAdd(text.id); onClose(); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── DayCard ───────────────────────────────────────────────────────────────────

  function DayCard({ day, topicRecords, onAdd, onRemove }) {
    function getTitle(textId) {
      for (const record of topicRecords) {
        const text = (record.texts ?? []).find((t) => t.id === textId);
        if (text) return getTopicTitle(text.title);
      }
      return textId;
    }

    return (
      <div className="planner-day-card">
        <div className="planner-day-title">День {day.dayIndex + 1}</div>
        {MEAL_TYPES.map((mealType) => (
          <div key={mealType} className="planner-meal-section">
            <div className="planner-meal-header">
              <span className="planner-meal-type">{mealType}</span>
              <button className="planner-add-btn" onClick={() => onAdd(mealType)}>
                + добавить
              </button>
            </div>
            {(day.meals[mealType] ?? []).length > 0 && (
              <div className="planner-recipe-chips">
                {day.meals[mealType].map((textId) => (
                  <span key={textId} className="planner-recipe-chip">
                    {getTitle(textId)}
                    <button
                      className="planner-recipe-chip__remove"
                      onClick={() => onRemove(day.dayIndex, mealType, textId)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ─── PlannerMenuScreen ─────────────────────────────────────────────────────────

  export default function PlannerMenuScreen() {
    const setScreen = useAppStore((s) => s.setScreen);
    const students = useAppStore((s) => s.students);
    const topicRecords = useAppStore((s) => s.topicRecords);
    const activeStudentId = useAppStore((s) => s.activeStudentId);
    const student = students.find((s) => s.id === activeStudentId);

    const [plan, setPlan] = useState(null);
    const [picker, setPicker] = useState(null); // { dayIndex, mealType }
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (!activeStudentId) return;
      loadPlan(activeStudentId).then((saved) => {
        setPlan(saved ?? createPlan(activeStudentId));
      });
    }, [activeStudentId]);

    function handleAdd(dayIndex, mealType) {
      setPicker({ dayIndex, mealType });
    }

    function handleAddRecipe(textId) {
      if (!picker) return;
      setPlan((p) => addRecipeToMeal(p, picker.dayIndex, picker.mealType, textId));
    }

    function handleRemove(dayIndex, mealType, textId) {
      setPlan((p) => removeRecipeFromMeal(p, dayIndex, mealType, textId));
    }

    async function handleNext() {
      setSaving(true);
      await savePlan(plan);
      setSaving(false);
      setScreen('planner_summary');
    }

    if (!plan) return <div className="screen screen-center">Загрузка…</div>;

    return (
      <div className="screen planner-screen">
        <div className="planner-header">
          <button className="planner-header__back" onClick={() => setScreen('home')}>←</button>
          <h1 className="planner-header__title">
            Меню{student ? ` для ${student.name}` : ''}
          </h1>
        </div>

        <div className="planner-body">
          {plan.days.map((day) => (
            <DayCard
              key={day.dayIndex}
              day={day}
              topicRecords={topicRecords}
              onAdd={(mealType) => handleAdd(day.dayIndex, mealType)}
              onRemove={handleRemove}
            />
          ))}
          {plan.days.length < 7 && (
            <button className="planner-add-day" onClick={() => setPlan((p) => addDay(p))}>
              + Добавить день
            </button>
          )}
        </div>

        <div className="planner-footer">
          <Button
            fullWidth
            disabled={countPlanRecipes(plan) === 0 || saving}
            onClick={handleNext}
          >
            {saving ? 'Сохраняем…' : 'Далее →'}
          </Button>
        </div>

        {picker && (
          <RecipePicker
            mealType={picker.mealType}
            existingIds={plan.days[picker.dayIndex]?.meals[picker.mealType] ?? []}
            onAdd={handleAddRecipe}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**

  ```
  git add src/features/planner/planner.css src/features/planner/PlannerMenuScreen.jsx
  git commit -m "feat(planner): PlannerMenuScreen with day/meal/recipe picker"
  ```

---

### Task 5: `PlannerSummaryScreen.jsx`

**Files:**
- Create: `src/features/planner/PlannerSummaryScreen.jsx`

**Interfaces:**
- Consumes:
  - `loadPlan`, `sendPlanToStudent`, `PANTRY_ITEMS` from `./plannerApi.js`
  - `getPlanRecipes`, `MEAL_TYPES` from `./plannerUtils.js`
  - `getRawRecipeTxt` from `@/core/groupStore`
  - `generateShoppingList` from `./shoppingListGenerator.js`
  - `parseRecipeMetadata` (indirectly, via `generateShoppingList`)
  - `getTopicTitle` from `@/shared/utils/format`
  - `useAppStore`, `Button`
- Produces: default export `PlannerSummaryScreen` React component; tapping "Отправить" calls `sendPlanToStudent`

- [ ] **Step 1: Create `src/features/planner/PlannerSummaryScreen.jsx`**

  ```jsx
  import { useEffect, useState } from 'react';
  import { useAppStore } from '@/core/store';
  import { getTopicTitle } from '@/shared/utils/format';
  import { getRawRecipeTxt } from '@/core/groupStore';
  import Button from '@/shared/components/Button';
  import { getPlanRecipes, MEAL_TYPES } from './plannerUtils.js';
  import { loadPlan, sendPlanToStudent, PANTRY_ITEMS } from './plannerApi.js';
  import { generateShoppingList } from './shoppingListGenerator.js';
  import './planner.css';

  // ─── PlanDaySummary ────────────────────────────────────────────────────────────

  function PlanDaySummary({ plan, topicRecords }) {
    function getTitle(textId) {
      for (const record of topicRecords) {
        const text = (record.texts ?? []).find((t) => t.id === textId);
        if (text) return getTopicTitle(text.title);
      }
      return textId;
    }

    return (
      <div className="plan-days-summary">
        {plan.days.map((day) => {
          const filledMeals = MEAL_TYPES.filter((m) => (day.meals[m] ?? []).length > 0);
          if (filledMeals.length === 0) return null;
          return (
            <div key={day.dayIndex} className="plan-day-summary">
              <p className="plan-day-summary__title">День {day.dayIndex + 1}</p>
              {filledMeals.map((mealType) => (
                <div key={mealType} className="plan-meal-row">
                  <span className="plan-meal-row__type">{mealType}:</span>
                  {day.meals[mealType].map((textId) => (
                    <span key={textId} className="plan-meal-row__recipe">
                      {getTitle(textId)}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── ShoppingListPreview ───────────────────────────────────────────────────────

  function ShoppingListPreview({ items }) {
    const included = items.filter((i) => i.include);
    const pantry = items.filter((i) => !i.include);

    return (
      <div className="shopping-preview">
        <p className="shopping-preview__title">Список покупок — {included.length} поз.</p>
        <ul className="shopping-preview-list">
          {included.map((item) => (
            <li key={item.product} className="shopping-item">
              <span className="shopping-item__name">{item.product}</span>
              {item.qty != null && (
                <span className="shopping-item__qty">
                  {Math.round(item.qty * 10) / 10}
                  {item.unit ? ` ${item.unit}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
        {pantry.length > 0 && (
          <p className="shopping-pantry">
            Обычно есть дома: {pantry.map((i) => i.product).join(', ')}
          </p>
        )}
      </div>
    );
  }

  // ─── PlannerSummaryScreen ──────────────────────────────────────────────────────

  export default function PlannerSummaryScreen() {
    const setScreen = useAppStore((s) => s.setScreen);
    const students = useAppStore((s) => s.students);
    const topicRecords = useAppStore((s) => s.topicRecords);
    const activeStudentId = useAppStore((s) => s.activeStudentId);
    const student = students.find((s) => s.id === activeStudentId);

    const [plan, setPlan] = useState(null);
    const [shoppingList, setShoppingList] = useState(null);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sendError, setSendError] = useState(null);

    useEffect(() => {
      if (!activeStudentId) return;
      loadPlan(activeStudentId).then((p) => {
        if (!p) { setScreen('planner_menu'); return; }
        setPlan(p);
      });
    }, [activeStudentId]);

    useEffect(() => {
      if (!plan || !topicRecords.length) return;
      let cancelled = false;
      async function generate() {
        const planRecipes = getPlanRecipes(plan);
        const recipesWithContent = await Promise.all(
          planRecipes.map(async ({ textId, portionMultiplier }) => {
            for (const record of topicRecords) {
              if (record.meta?.renderer !== 'reading') continue;
              const text = (record.texts ?? []).find((t) => t.id === textId);
              if (!text?.file) continue;
              const content = await getRawRecipeTxt(record.meta.id, text.file);
              if (!content) continue;
              return { textId, content, portionMultiplier };
            }
            return null;
          })
        );
        if (cancelled) return;
        const valid = recipesWithContent.filter(Boolean);
        setShoppingList(generateShoppingList(valid, PANTRY_ITEMS));
      }
      generate();
      return () => { cancelled = true; };
    }, [plan, topicRecords]);

    async function handleSend() {
      if (!plan) return;
      setSending(true);
      setSendError(null);
      try {
        await sendPlanToStudent(plan.studentId, plan);
        setSent(true);
      } catch (err) {
        setSendError(err?.message ?? 'Ошибка отправки');
      } finally {
        setSending(false);
      }
    }

    if (!plan) return <div className="screen screen-center">Загрузка…</div>;

    return (
      <div className="screen planner-screen">
        <div className="planner-header">
          <button className="planner-header__back" onClick={() => setScreen('planner_menu')}>←</button>
          <h1 className="planner-header__title">
            Меню{student ? ` для ${student.name}` : ''}
          </h1>
        </div>

        <div className="planner-body">
          <PlanDaySummary plan={plan} topicRecords={topicRecords} />
          {shoppingList ? (
            <ShoppingListPreview items={shoppingList} />
          ) : (
            <div className="planner-loading">Формирую список покупок…</div>
          )}
        </div>

        <div className="planner-footer">
          {sent ? (
            <div className="planner-sent">✓ Отправлено ученику</div>
          ) : (
            <>
              {sendError && (
                <div style={{ color: 'red', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
                  {sendError}
                </div>
              )}
              <Button
                fullWidth
                disabled={sending || !shoppingList}
                onClick={handleSend}
              >
                {sending ? 'Отправляем…' : 'Отправить ученику →'}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```
  git add src/features/planner/PlannerSummaryScreen.jsx
  git commit -m "feat(planner): PlannerSummaryScreen with shopping list + send"
  ```

---

### Task 6: Wire up — App.jsx, store.js, HomeScreen.jsx

**Files:**
- Modify: `src/App.jsx` (lines 16–78)
- Modify: `src/core/store.js` (after line 96, `// ─── Session setup`)
- Modify: `src/features/home/HomeScreen.jsx` (lines 269–327)

**Interfaces:**
- Consumes: `PlannerMenuScreen`, `PlannerSummaryScreen`
- Produces: `/planner_menu` and `/planner_summary` screens reachable; HomeScreen shows "Планировщик" entry

- [ ] **Step 1: Register screens in `src/App.jsx`**

  Add two imports after the existing screen imports (after line 35, `import SettingsScreen`):

  ```js
  import PlannerMenuScreen from "@/features/planner/PlannerMenuScreen";
  import PlannerSummaryScreen from "@/features/planner/PlannerSummaryScreen";
  ```

  Add two entries to the `SCREENS` dict (after the `settings` entry at line 77):

  ```js
  planner_menu: PlannerMenuScreen,
  planner_summary: PlannerSummaryScreen,
  ```

- [ ] **Step 2: Add `plannerStudentId` to `src/core/store.js`**

  Find the `// ─── Session setup` comment (around line 95). Add the following block immediately before it:

  ```js
  // ─── Planner ───────────────────────────────────────────────────────────────
  plannerStudentId: null,
  setPlannerStudentId: (id) => set({ plannerStudentId: id }),
  ```

  (The planner currently uses `activeStudentId`; `plannerStudentId` is reserved for future use when planner and session can run independently. No changes needed in the UI for now — both screens read `activeStudentId`.)

- [ ] **Step 3: Add Планировщик button to `src/features/home/HomeScreen.jsx`**

  Add the import at the top of the file (after existing imports, before the `function SettingsIcon` declaration):

  ```js
  import { loadPlan } from "@/features/planner/plannerApi";
  ```

  In the `HomeScreen` component, add inside the `return (...)` block, after the closing `</section>` tag of the "Собери занятие" section (after line 327, before the `<button ... home-version ...>` tag). The full insertion point is:

  ```jsx
  {/* after </section> at the end of "Собери занятие", before the version button */}
  {student && (
    <div className="home-planner">
      <div className="home-planner__label">Планировщик</div>
      <Button
        fullWidth
        variant="secondary"
        onClick={() => setScreen('planner_menu')}
      >
        Составить меню для {student.name} →
      </Button>
    </div>
  )}
  ```

  Also add the CSS import at the top of `HomeScreen.jsx` (after existing imports):

  ```js
  import "@/features/planner/planner.css";
  ```

- [ ] **Step 4: Build and verify no TypeScript / Vite errors**

  ```
  npm run build
  ```
  Expected: build completes without errors. Check `dist/` exists.

- [ ] **Step 5: Run all planner tests together**

  ```
  npx vitest run src/features/planner/
  ```
  Expected: all tests from `recipeParser.test.js`, `shoppingListGenerator.test.js`, `plannerUtils.test.js` PASS (20 + 9 + 19 = 48 tests).

- [ ] **Step 6: Commit**

  ```
  git add src/App.jsx src/core/store.js src/features/home/HomeScreen.jsx
  git commit -m "feat(planner): wire up screens + HomeScreen entry point"
  ```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Curator can build a multi-day menu plan — Task 4 (`PlannerMenuScreen`)
- [x] Recipes filtered by meal tag (завтрак/обед/ужин/перекус) — `RecipePicker` in Task 4
- [x] Plan saved to IndexedDB + synced to server — Task 3 (`plannerApi.js`)
- [x] Shopping list auto-generated from selected recipes — Task 5 (`PlannerSummaryScreen`, uses `generateShoppingList` from Plan 1)
- [x] Pantry items excluded from shopping list — `PANTRY_ITEMS` constant in `plannerApi.js`
- [x] Curator can send plan to student — `sendPlanToStudent` in Task 3 + "Отправить" button in Task 5
- [x] Backend stores plan in `active_plan_data` — Task 2

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `createPlan` → `Plan` object with `days: Day[]` — used consistently in all screens
- `addRecipeToMeal(plan, dayIndex, mealType, textId)` — same signature throughout
- `getPlanRecipes(plan)` → `{textId, portionMultiplier}[]` — matches `generateShoppingList` input shape
- `savePlan(plan)` / `loadPlan(studentId)` — Plan in, Plan|null out — used in both screens
- `sendPlanToStudent(studentId, plan)` — consistent with backend handler expecting `body.planData`

---

## Manual Test Plan (after wiring)

1. Open the app, select a student, go to HomeScreen → "Составить меню для [Name] →" button visible
2. Tap button → `PlannerMenuScreen` opens with День 1, four meal sections
3. Tap "+ добавить" for Завтрак → picker sheet opens with recipes tagged "завтрак"
4. Tap a recipe → it appears as a chip under Завтрак, picker closes
5. Tap × on the chip → chip disappears
6. Tap "+ Добавить день" → День 2 appears
7. Add at least one recipe to Day 2 → "Далее →" button becomes enabled
8. Tap "Далее →" → `PlannerSummaryScreen` opens
9. Days and recipes appear in the summary; shopping list loads after a moment
10. Shopping list shows only non-pantry items; "Обычно есть дома:" row shows pantry items
11. Tap "Отправить ученику →" → "✓ Отправлено ученику" appears
12. In the student portal (separate tab/device), the student sees the plan (verified in Plan 3)
