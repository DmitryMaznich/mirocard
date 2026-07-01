# Planner Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc `plan-card` + single CTA button in the planner tab's landing view with three `JourneyStep` rows (Меню / Список покупок / Раскладка) that visually match the recently redesigned session tab, and gate each step correctly.

**Architecture:** Pure JSX/CSS change inside `PlannerTab` (defined in `src/features/home/HomeScreen.jsx`), reusing the existing `JourneyStep` component already used by `SessionTab` in the same file. No new files, screens, routes, or data model changes. Dead CSS for the removed `plan-card` markup is deleted from `planner.css`.

**Tech Stack:** React (JSX), Vite, vanilla CSS (no CSS modules/Tailwind), Zustand store (`useAppStore`), Vitest (not used in this plan — see Global Constraints).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-01-planner-hub-design.md` — read it before starting if any task feels ambiguous.
- `PlannerTab` stays a tab inside `HomeScreen` — no `setScreen('planner_hub')`, no new route.
- Reuse `JourneyStep` (`src/features/home/HomeScreen.jsx:116-134`) exactly as it exists today — do not add new props to it.
- Do not touch `PlannerMenuScreen.jsx`, `PlannerShoppingScreen.jsx`, `PlannerSummaryScreen.jsx`, `plannerUtils.js`, `plannerApi.js`, or `MEAL_TYPES`. The plan data model and the meal-slot-first recipe flow are unchanged in this plan.
- Copy is in Russian, matching the rest of the planner UI (see spec for exact strings).
- This codebase has only 2 `*.test.jsx` files total (both for hooks, not for rendering/container components) — there is no established convention for testing presentational container components like `PlannerTab`. Per the spec's own Testing section, verification for this plan is: lint, build, and manual browser check (per `CLAUDE.md`'s "test the golden path in a browser before reporting UI work complete" rule) — not new Vitest component tests. Do not introduce a new test file for this.

---

### Task 1: Rewrite `PlannerTab` to render the three journey steps

**Files:**
- Modify: `src/features/home/HomeScreen.jsx:204-246` (the `PlannerTab` function body only)

**Interfaces:**
- Consumes: `JourneyStep` (same file, `HomeScreen.jsx:116-134`) — props `{ state: "active"|"done"|"disabled", number: string, label: string, value: string, onClick?: () => void, avatar?: ReactNode }`. `JourneyStep` already renders a `<button>` with `disabled={state === "disabled"}`, so passing `onClick` unconditionally is safe even when `state` is `"disabled"`.
- Consumes: `countPlanRecipes(plan)` from `./plannerUtils.js` (already imported at `HomeScreen.jsx:12`) — returns a `number`.
- Consumes: `loadPlan(studentId)` from `./plannerApi.js` (already imported at `HomeScreen.jsx:11`) — returns `Promise<Plan|null>` where `Plan = { days: Array<{ dayIndex: number, meals: Record<string, string[]> }>, ... }`.
- Consumes: `Button` (already imported at `HomeScreen.jsx:3`) — used only in the "no student" empty state, unchanged from today.
- Produces: `PlannerTab` keeps its existing call signature `<PlannerTab student={student} setScreen={setScreen} />` (called at `HomeScreen.jsx:459`) — no changes needed at the call site.

- [ ] **Step 1: Replace the `PlannerTab` function body**

Replace the entire current `PlannerTab` function (`HomeScreen.jsx:204-246`) with:

```jsx
function PlannerTab({ student, setScreen }) {
  const [existingPlan, setExistingPlan] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!student) { setExistingPlan(null); return; }
    loadPlan(student.id).then(setExistingPlan);
  }, [student?.id]);

  if (!student) {
    return (
      <div className="home-tab-empty">
        <p>Выбери ученика выше</p>
        <Button onClick={() => setScreen("students")}>Выбрать ученика</Button>
      </div>
    );
  }

  if (existingPlan === undefined) {
    return (
      <div className="home-planner-tab">
        <div className="home-tab-loading">Загрузка…</div>
      </div>
    );
  }

  const hasRecipes = !!existingPlan && countPlanRecipes(existingPlan) > 0;

  const menuState = hasRecipes ? "done" : "active";
  const menuValue = hasRecipes
    ? `${existingPlan.days.length} дн. · ${countPlanRecipes(existingPlan)} рец.`
    : "Собери меню из рецептов";

  const shoppingState = hasRecipes ? "active" : "disabled";
  const shoppingValue = hasRecipes
    ? "Список готов — открой и отметь"
    : "Сначала выбери рецепты";

  return (
    <div className="home-planner-tab">
      <div className="journey-steps">
        <JourneyStep
          state={menuState}
          number="1"
          label="Меню"
          value={menuValue}
          onClick={() => setScreen('planner_menu')}
        />
        <JourneyStep
          state={shoppingState}
          number="2"
          label="Список покупок"
          value={shoppingValue}
          onClick={() => setScreen('planner_summary')}
        />
        <JourneyStep
          state="disabled"
          number="3"
          label="Раскладка"
          value="Появится, когда список покупок будет закрыт"
        />
      </div>
    </div>
  );
}
```

No new imports are needed — `useState`, `useEffect`, `Button`, `loadPlan`, `countPlanRecipes` are all already imported at the top of `HomeScreen.jsx`, and `JourneyStep` is defined earlier in the same file.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors or warnings attributed to `src/features/home/HomeScreen.jsx`. (Pre-existing warnings elsewhere in the repo, if any, are not in scope.)

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: build succeeds with no errors (confirms no JSX syntax mistakes, no undefined identifiers).

- [ ] **Step 4: Commit**

```bash
git add src/features/home/HomeScreen.jsx
git commit -m "feat(planner): redesign planner tab as three journey steps"
```

---

### Task 2: Remove dead `plan-card` CSS

**Files:**
- Modify: `src/features/planner/planner.css:727-753` (delete the `.plan-card`, `.plan-card__label`, `.plan-card__meta`, `.plan-card__actions` rules)

**Interfaces:**
- None — this is CSS cleanup only, with no JS/JSX interface surface. Task 1 already removed the only JSX that referenced these class names.

- [ ] **Step 1: Delete the dead CSS block**

In `src/features/planner/planner.css`, delete lines 727-753 (the exact block below):

```css
.plan-card {
  background: var(--color-surface, #fff);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plan-card__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary, #888);
}

.plan-card__meta {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text, #222);
}

.plan-card__actions {
  margin-top: 4px;
}
```

Leave the surrounding `.home-tab-empty`, `.home-tab-loading`, and `.home-planner-tab` rules untouched — they're still used by the rewritten `PlannerTab`.

- [ ] **Step 2: Verify no remaining references**

Run: `grep -rn "plan-card" src`
Expected: no matches (confirms the class names aren't referenced anywhere else in the codebase before deleting them was safe — this was already verified during spec review, this step re-confirms after the edit).

- [ ] **Step 3: Commit**

```bash
git add src/features/planner/planner.css
git commit -m "chore(planner): remove dead plan-card CSS"
```

---

### Task 3: Manual browser verification

**Files:** none (verification only, no code changes)

**Interfaces:** none

- [ ] **Step 1: Start the dev server and open the app**

Use the `run` skill (or `npm run dev` directly) to start the app and open it in a browser.

- [ ] **Step 2: Verify the "no student selected" state**

With no active student, open the "Планировщик" tab. Expected: unchanged empty state — "Выбери ученика выше" text and a "Выбрать ученика" button, no journey steps shown.

- [ ] **Step 3: Verify the "student with no plan" state**

Select (or create) a student with no saved plan. Open the "Планировщик" tab. Expected:
- Step 1 "Меню": teal-highlighted `active` styling, value "Собери меню из рецептов".
- Step 2 "Список покупок": greyed-out `disabled` styling, value "Сначала выбери рецепты", not clickable.
- Step 3 "Раскладка": greyed-out `disabled` styling, value "Появится, когда список покупок будет закрыт", not clickable.

- [ ] **Step 4: Verify the "student with a plan" state**

Using the same student, tap step 1 to open the meal-plan builder (`PlannerMenuScreen`), add at least one recipe to any meal slot, then navigate back to the "Планировщик" tab. Expected:
- Step 1 "Меню": `done` styling (✓ icon instead of "1"), value shows `"{N} дн. · {M} рец."` matching the actual day/recipe counts.
- Step 2 "Список покупок": teal-highlighted `active` styling, value "Список готов — открой и отметь", clickable.
- Step 3 "Раскладка": still `disabled`, unchanged.

- [ ] **Step 5: Verify navigation targets**

Tap step 1 → confirm it opens `PlannerMenuScreen` (title "Меню для {student}"). Go back, tap step 2 → confirm it opens `PlannerSummaryScreen` (the plan-days summary with the "Список покупок →" button). Confirm step 3 does nothing when tapped.

- [ ] **Step 6: Visual consistency check**

Switch to the "Занятие" tab and compare its journey steps side-by-side (spacing, border radius, teal accent, typography) against the new planner steps. Expected: visually consistent — same component, same CSS, no divergence.

- [ ] **Step 7: Report results**

Summarize pass/fail for steps 2-6 back to the user. If anything fails, fix it in Task 1 or 2 before considering this plan complete (do not skip ahead).
