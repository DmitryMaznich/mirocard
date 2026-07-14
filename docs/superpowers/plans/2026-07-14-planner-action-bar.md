# Planner Action Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Planner hub's disappearing action dock with a persistent, always-visible 5-button navigation bar (Рецепты · Продукты · ГОТОВИМ (circular) · Заново · История) that never scrolls out of view.

**Architecture:** A new presentational component `PlannerActionBar` (all state/handlers passed in as props, no store access of its own) replaces the JSX currently inline in `PlannerTab` (`src/features/home/HomeScreen.jsx`). It mounts in normal document flow right after the hub's card grid, with `position: sticky; bottom: 0` so it rests near the grid when content is short and pins to the viewport bottom once the user scrolls past it. Two of the five buttons need small new entry points into existing screens (`PlannerShoppingScreen.jsx` gets a direct "land in the category editor" mode; the recipe catalog reuses the existing `CookPickerSheet` component with the full recipe list instead of just the current menu).

**Tech Stack:** React 19 (JSX, function components, hooks), Zustand store (`useAppStore`), plain CSS (no CSS-in-JS, no Tailwind) in `src/features/planner/planner.css`.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-14-planner-action-bar-design.md` — every task implements a piece of it; do not deviate from the button set, order, or behavior without checking there first.
- No horizontal scroll on the bar at any width ≥ 320px — use `clamp()` for all bar-internal sizing, never fixed px that could overflow.
- This codebase has **no component-level test harness** (no `@testing-library/*` installed, no JSX render tests anywhere in `src/`). Existing `*.test.js` files only cover pure logic/store/API modules via `vitest`. Do **not** invent component tests for this feature. Verify UI changes by running `npm run dev` and checking in a browser (Playwright headed mode, per project convention — do not use headless). Only add a `vitest` test if a task introduces new pure/branching logic worth unit-testing in isolation (none of the tasks below do — everything is prop wiring, JSX, and CSS).
- Run `npm run lint` after every task that touches `.jsx`/`.js` files — it must pass with no new warnings/errors before committing.
- iOS safe-area rule (`CLAUDE.md`): any new `position: fixed/sticky/absolute` rule with an offset must be checked against `--app-safe-top/bottom/left/right`. This plan's new sticky bar does **not** touch the physical screen edge (`.home-tabbar` sits below it, outside the scrolling container, and already reserves `--app-safe-bottom`) — Task 4 verifies this explicitly using the documented `app-ios-standalone` class trick rather than just asserting it.
- Colors/sizes below are exact — copy them verbatim, don't approximate.

---

### Task 1: Create the `PlannerActionBar` component and its CSS

**Files:**
- Create: `src/features/planner/PlannerActionBar.jsx`
- Modify: `src/features/planner/planner.css:1852-1952` (replace the old action-dock block wholesale with the new bar's styles)

**Interfaces:**
- Produces: `export default function PlannerActionBar({ hasSelection, readyToCook, cookedCount, totalCount, recipesLoaded, hint, onOpenCatalog, onEditProducts, onCook, onRestart, onHistory })` — a pure presentational component, no store/hooks beyond what's needed for rendering.
- Consumes: `RefreshIcon` from `@/shared/components/ArrowIcons` (existing, already exported, default `size=18`, `viewBox 0 0 18 18`).

- [ ] **Step 1: Write `src/features/planner/PlannerActionBar.jsx`**

```jsx
import { RefreshIcon } from '@/shared/components/ArrowIcons';

function BookIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M4 5.5c2-1 5-1 7 0 2-1 5-1 7 0v11c-2-1-5-1-7 0-2-1-5-1-7 0V5.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 5.5V16.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BasketIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M4.5 8.5h13l-1.3 8.2a1.6 1.6 0 0 1-1.6 1.3H7.4a1.6 1.6 0 0 1-1.6-1.3L4.5 8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 8.5V6.8A4 4 0 0 1 11 3a4 4 0 0 1 4 3.8v1.7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 6.5V11l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CookArrowIcon() {
  return (
    <svg className="planner-navbar__cook-icon" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PlannerActionBar({
  hasSelection,
  readyToCook,
  cookedCount,
  totalCount,
  recipesLoaded,
  hint,
  onOpenCatalog,
  onEditProducts,
  onCook,
  onRestart,
  onHistory,
}) {
  const showCookBadge = hasSelection && cookedCount > 0 && cookedCount < totalCount;

  return (
    <div className="planner-navbar">
      <div className="planner-navbar-bar">
        <button type="button" className="planner-navbar__item" onClick={onOpenCatalog} disabled={!recipesLoaded}>
          <BookIcon />
          <span>Рецепты</span>
        </button>
        <button type="button" className="planner-navbar__item" onClick={onEditProducts}>
          <BasketIcon />
          <span>Продукты</span>
        </button>
        <div className="planner-navbar__cook-slot" />
        <button type="button" className="planner-navbar__item" onClick={onRestart} disabled={!hasSelection}>
          <RefreshIcon />
          <span>Заново</span>
        </button>
        <button type="button" className="planner-navbar__item" onClick={onHistory}>
          <ClockIcon />
          <span>История</span>
        </button>
        <button type="button" className="planner-navbar__cook" onClick={onCook} disabled={!readyToCook}>
          <span className="planner-navbar__cook-label">ГОТОВИМ</span>
          <CookArrowIcon />
          {showCookBadge && (
            <span className="planner-navbar__cook-badge">{cookedCount}/{totalCount}</span>
          )}
        </button>
      </div>
      {hint && <div className="planner-navbar-hint">{hint}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Replace `planner.css:1852-1952`**

Delete the entire block from the `/* ── Planner hub: bottom action bar ─...` comment (line 1852) through `.planner-history-btn:active { ... }` (line 1952) — this removes `.planner-action-dock*`, `.planner-cycle-actions`, `.planner-history-btn*`, `.planner-cook-hint`. Replace it with:

```css
/* ── Planner hub: persistent action bar ──────────────────────────────
   Anchored right after .planner-hub__grid (not pushed to the bottom via
   margin-top:auto like the old dock) — margin-top ≈ half the bar's own
   height, so it sits close to the last card ("Раскладка") when content is
   short. position:sticky + bottom:0 pins it to the bottom of the nearest
   scrolling ancestor (.home-tab-content) once content overflows and the
   user scrolls — it never requires scrolling further to find it. Doesn't
   touch the physical screen edge (.home-tabbar sits below, outside the
   scroll area, and already reserves --app-safe-bottom), so no safe-area
   padding here. Sizes use clamp() so nothing needs horizontal scroll from
   320px phones up. */
.planner-navbar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin: clamp(22px, 8vh, 34px) -14px 0;
  overflow: visible;
}

.planner-navbar-bar {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(250, 247, 242, 0.97);
  backdrop-filter: blur(12px);
  border-top: 1px solid #e7dccf;
  padding: 8px 6px 12px;
}

.planner-navbar__item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  border: none;
  background: none;
  color: #a8978a;
  font-family: inherit;
  font-size: clamp(8px, 2.4vw, 9px);
  font-weight: 700;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 12px;
}

.planner-navbar__item svg {
  width: clamp(20px, 6.5vw, 26px);
  height: clamp(20px, 6.5vw, 26px);
  flex-shrink: 0;
}

.planner-navbar__item span {
  line-height: 1;
  white-space: nowrap;
}

.planner-navbar__item:active {
  background: rgba(203, 185, 163, 0.15);
}

.planner-navbar__item:disabled {
  color: #d3c7b8;
  cursor: default;
}

.planner-navbar__item:disabled:active {
  background: none;
}

.planner-navbar__cook-slot {
  flex: 1.3;
}

.planner-navbar__cook {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: clamp(56px, 17vw, 64px);
  height: clamp(56px, 17vw, 64px);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-family: inherit;
  color: #fff;
  background: linear-gradient(150deg, #5cb0a3, #276b62);
  box-shadow: 0 4px 14px rgba(39, 107, 98, 0.4), 0 0 0 4px #faf7f2, 0 0 0 5px #d8cbb6;
}

.planner-navbar__cook:disabled {
  background: #ede5d8;
  box-shadow: 0 0 0 4px #faf7f2, 0 0 0 5px #e7dccf;
  color: #a8978a;
  cursor: default;
}

.planner-navbar__cook-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: clamp(8px, 2.4vw, 9px);
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}

.planner-navbar__cook-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, 6px);
  width: 15px;
  height: 15px;
}

.planner-navbar__cook-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #e8503a;
  color: #fff;
  font-size: 8px;
  font-weight: 800;
  line-height: 1;
  padding: 3px 5px;
  border-radius: 999px;
  box-shadow: 0 0 0 2px #faf7f2;
}

.planner-navbar-hint {
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  color: #a8978a;
}
```

Leave everything before line 1852 and everything from `.cycle-history-sheet` onward (previously line 1954) untouched.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors or new warnings from `PlannerActionBar.jsx` (unused-vars, missing-key, etc.).

- [ ] **Step 4: Commit**

```bash
git add src/features/planner/PlannerActionBar.jsx src/features/planner/planner.css
git commit -m "feat(planner): add PlannerActionBar component and styles"
```

---

### Task 2: `PlannerShoppingScreen` — direct entry into the category editor

**Files:**
- Modify: `src/features/planner/PlannerShoppingScreen.jsx:994-1010`

**Interfaces:**
- Consumes: existing store fields `plannerShoppingInitialMode` (string|null) and `setPlannerShoppingInitialMode` (already read at lines 970-971 of this file).
- Produces: when `plannerShoppingInitialMode === 'edit'` at mount time, the screen lands on `modeView: 'plan'` with `editMode: true` already set — i.e. the "Редактор категорий" view, skipping the normal shopping list.

- [ ] **Step 1: Modify the boot effect**

Current code (`PlannerShoppingScreen.jsx:994-1010`):

```jsx
  useEffect(() => {
    if (!studentId) return;
    // Normally lands directly on the catalog — the store picker is optional
    // and reachable any time via the 🏪 chip, never a mandatory gate. The
    // hub's "В магазин" card asks for the in-store checklist instead by
    // setting plannerShoppingInitialMode before navigating here; consumed
    // once, then cleared, so a later visit defaults back to the catalog.
    const initialMode = plannerShoppingInitialMode === 'shop' ? 'shop' : 'plan';
    if (plannerShoppingInitialMode) setPlannerShoppingInitialMode(null);
    getPlannerShopStores(studentId).then((saved) => {
      setStores(saved ?? { current: null, list: [...DEFAULT_STORES] });
      setModeView(initialMode);
    }).catch(() => {
      setStores({ current: null, list: [...DEFAULT_STORES] });
      setModeView(initialMode);
    });
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps
```

Replace with:

```jsx
  useEffect(() => {
    if (!studentId) return;
    // Normally lands directly on the catalog — the store picker is optional
    // and reachable any time via the 🏪 chip, never a mandatory gate. The
    // hub's "В магазин" card asks for the in-store checklist instead, and
    // the hub's "Продукты" bar button asks to land straight in the category
    // editor, by setting plannerShoppingInitialMode before navigating here;
    // consumed once, then cleared, so a later visit defaults back to the
    // catalog.
    const initialMode = plannerShoppingInitialMode === 'shop' ? 'shop' : 'plan';
    const shouldOpenEditor = plannerShoppingInitialMode === 'edit';
    if (plannerShoppingInitialMode) setPlannerShoppingInitialMode(null);
    getPlannerShopStores(studentId).then((saved) => {
      setStores(saved ?? { current: null, list: [...DEFAULT_STORES] });
      setModeView(initialMode);
      if (shouldOpenEditor) setEditMode(true);
    }).catch(() => {
      setStores({ current: null, list: [...DEFAULT_STORES] });
      setModeView(initialMode);
      if (shouldOpenEditor) setEditMode(true);
    });
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: passes, no new warnings.

- [ ] **Step 3: Commit**

```bash
git add src/features/planner/PlannerShoppingScreen.jsx
git commit -m "feat(planner): support landing directly in the category editor"
```

Note: this change has no caller yet — nothing sets `plannerShoppingInitialMode` to `'edit'` until Task 3. It will be exercised end-to-end in Task 4's manual verification.

---

### Task 3: Wire `PlannerActionBar` into `PlannerTab`, remove the old dock

**Files:**
- Modify: `src/features/home/HomeScreen.jsx:1-21` (imports)
- Modify: `src/features/home/HomeScreen.jsx:357-590` (`PlannerTab` component: state, handlers, JSX)

**Interfaces:**
- Consumes: `PlannerActionBar` from Task 1 (`@/features/planner/PlannerActionBar`), `Modal` from `@/shared/components/Modal` (existing, props `title`, `onClose`, `actions`, `children`), `Button` (already imported, `variant="secondary"|"danger"`), `setPlannerShoppingInitialMode('edit')` from Task 2.
- Produces: no new exports — this is the integration point.

- [ ] **Step 1: Add imports**

In `HomeScreen.jsx`, after the existing `import CookPickerSheet from "@/features/planner/CookPickerSheet";` (line 19), add:

```jsx
import PlannerActionBar from "@/features/planner/PlannerActionBar";
import Modal from "@/shared/components/Modal";
```

- [ ] **Step 2: Add `catalogPickerOpen` state**

In `PlannerTab`, right after the existing `const [cookPickerOpen, setCookPickerOpen] = useState(false);` (line 370), add:

```jsx
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
```

- [ ] **Step 3: Rename and extend `handlePickRecipe`**

Current code (`HomeScreen.jsx:438-445`):

```jsx
  function handlePickRecipe(recipe) {
    setCookPickerOpen(false);
    setActiveTopicId(recipe.topicId);
    setActiveText(recipe.text);
    setActiveModeId('follow_instruction');
    setSessionReturnScreen('home');
    setScreen('params');
  }
```

Replace with:

```jsx
  function pickRecipeAndCook(recipe) {
    setCookPickerOpen(false);
    setCatalogPickerOpen(false);
    setActiveTopicId(recipe.topicId);
    setActiveText(recipe.text);
    setActiveModeId('follow_instruction');
    setSessionReturnScreen('home');
    setScreen('params');
  }
```

- [ ] **Step 4: Add `handleEditProducts`**

Right after the existing `handleGoShopping` function (`HomeScreen.jsx:447-450`):

```jsx
  function handleGoShopping() {
    setPlannerShoppingInitialMode('shop');
    setScreen('planner_shopping');
  }
```

add:

```jsx

  function handleEditProducts() {
    setPlannerShoppingInitialMode('edit');
    setScreen('planner_shopping');
  }
```

- [ ] **Step 5: Replace the old dock JSX with `PlannerActionBar` + `Modal`**

Current code (`HomeScreen.jsx:512-571`) — the block starting `{hasSelection ? (` and ending right before `{cookPickerOpen && (`:

```jsx
      {hasSelection ? (
        <>
          <div className="planner-action-dock">
            <button
              type="button"
              className="planner-action-dock__cook"
              disabled={!readyToCook}
              onClick={() => setCookPickerOpen(true)}
            >
              {cookedTextIds.size === 0
                ? '🍲 Начинаем готовить'
                : `🍲 Готовка: ${cookedTextIds.size} из ${menuRecipes.length} приготовлено`}
            </button>
            <button
              type="button"
              className="planner-action-dock__icon"
              onClick={handleOpenHistory}
            >
              <span className="planner-action-dock__icon-glyph">🕐</span>
              <span>История</span>
            </button>
            <button
              type="button"
              className="planner-action-dock__icon"
              onClick={() => setConfirmNewMenu(true)}
            >
              <span className="planner-action-dock__icon-glyph">🏁</span>
              <span>Новое меню</span>
            </button>
          </div>
          {!readyToCook && (
            <div className="planner-cook-hint">
              {!menuDone
                ? 'Сначала реши «Дома» или «Купить» для каждого продукта'
                : !shoppingDone
                  ? 'Сначала докупи всё по списку'
                  : 'Сначала разложи продукты'}
            </div>
          )}
        </>
      ) : (
        <div className="planner-cycle-actions">
          <button type="button" className="planner-history-btn" onClick={handleOpenHistory}>
            🕐 История
          </button>
        </div>
      )}
      {hasSelection && confirmNewMenu && (
        <div className="menu-reset-bar">
          <span className="menu-reset-bar__text">
            {cookedTextIds.size < menuRecipes.length
              ? `Готово только ${cookedTextIds.size} из ${menuRecipes.length} блюд. Всё равно начать новое меню?`
              : 'Начать новое меню? Текущее будет закрыто.'}
          </span>
          <div className="menu-reset-bar__actions">
            <button type="button" className="menu-reset-bar__cancel" onClick={() => setConfirmNewMenu(false)}>Нет</button>
            <button type="button" className="menu-reset-bar__ok" onClick={handleStartNewMenu}>Да</button>
          </div>
        </div>
      )}
```

Replace with:

```jsx
      <PlannerActionBar
        hasSelection={hasSelection}
        readyToCook={readyToCook}
        cookedCount={cookedTextIds.size}
        totalCount={menuRecipes.length}
        recipesLoaded={allRecipes.length > 0}
        hint={
          hasSelection && !readyToCook
            ? (!menuDone
                ? 'Сначала реши «Дома» или «Купить» для каждого продукта'
                : !shoppingDone
                  ? 'Сначала докупи всё по списку'
                  : 'Сначала разложи продукты')
            : null
        }
        onOpenCatalog={() => setCatalogPickerOpen(true)}
        onEditProducts={handleEditProducts}
        onCook={() => setCookPickerOpen(true)}
        onRestart={() => setConfirmNewMenu(true)}
        onHistory={handleOpenHistory}
      />
      {confirmNewMenu && (
        <Modal
          title="Начать новое меню?"
          onClose={() => setConfirmNewMenu(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setConfirmNewMenu(false)}>Нет</Button>
              <Button variant="danger" onClick={handleStartNewMenu}>Заново</Button>
            </>
          }
        >
          {cookedTextIds.size < menuRecipes.length
            ? `Готово только ${cookedTextIds.size} из ${menuRecipes.length} блюд. Всё равно начать новое меню?`
            : 'Начать новое меню? Текущее будет закрыто.'}
        </Modal>
      )}
```

- [ ] **Step 6: Update the `CookPickerSheet` rendering block**

Current code (`HomeScreen.jsx:573-587`):

```jsx
      {cookPickerOpen && (
        <CookPickerSheet
          recipes={menuRecipes}
          cookedTextIds={cookedTextIds}
          onPick={handlePickRecipe}
          onClose={() => setCookPickerOpen(false)}
        />
      )}
      {historyOpen && (
        <CycleHistorySheet
          studentId={student.id}
          history={cycleHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}
```

Replace with:

```jsx
      {cookPickerOpen && (
        <CookPickerSheet
          recipes={menuRecipes}
          cookedTextIds={cookedTextIds}
          onPick={pickRecipeAndCook}
          onClose={() => setCookPickerOpen(false)}
        />
      )}
      {catalogPickerOpen && (
        <CookPickerSheet
          recipes={allRecipes}
          onPick={pickRecipeAndCook}
          onClose={() => setCatalogPickerOpen(false)}
        />
      )}
      {historyOpen && (
        <CycleHistorySheet
          studentId={student.id}
          history={cycleHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}
```

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: passes. In particular, no `no-unused-vars` for `handlePickRecipe` (renamed, so it should be gone entirely — confirm no leftover references) and no missing-import errors for `Modal`/`PlannerActionBar`.

Run: `grep -rn "handlePickRecipe" src/features/home/HomeScreen.jsx`
Expected: no output (fully renamed).

- [ ] **Step 8: Commit**

```bash
git add src/features/home/HomeScreen.jsx
git commit -m "feat(planner): wire persistent action bar into the planner hub"
```

---

### Task 4: Manual end-to-end verification

**Files:** none (no code changes — this task only verifies Tasks 1-3).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite starts without errors, serves on `http://localhost:8080` (or the configured port).

- [ ] **Step 2: Open the app and reach the Planner hub**

Open the dev URL in a browser (Playwright **headed**, not headless — screenshots alone aren't a substitute for watching it live). Select/create a student with planner access enabled, open the "Планировщик" tab on the home screen.

Expected: the new bar (Рецепты · Продукты · [ГОТОВИМ circle] · Заново · История) is visible immediately below the 4 hub cards, with a visible gap above it (not flush against "Раскладка"). No horizontal scrollbar on the bar at the default window width.

- [ ] **Step 3: Empty-menu state**

With no recipes selected yet (fresh student / after "Заново"):

Expected: "Рецепты", "Продукты", "История" are enabled; "ГОТОВИМ" and "Заново" are visually disabled (muted colors, no press feedback) and not clickable. No hint text below the bar.

- [ ] **Step 4: "Рецепты" — cook from catalog without touching the menu**

Click "Рецепты".

Expected: a bottom sheet titled "Что готовим?" opens listing **all** recipes (not just menu ones — compare count against what "Меню" → "+" on a slot shows under "Все"). Click any recipe.

Expected: navigates straight into the cooking/reading session for that recipe. Go back to the home screen afterward and re-open "Планировщик".

Expected: the recipe was **not** added to the menu — the hub's "Меню" card still shows the same selection count as before this step.

- [ ] **Step 5: "Продукты" — direct entry into the category editor**

From the Planner hub, click "Продукты".

Expected: navigates to the shopping screen and lands **directly** on "Редактор категорий" (pencil-mode header, "✓ Готово" button visible) — not on the normal shopping list/catalog view. Tap "✓ Готово" and navigate back to the hub; re-click "Продукты" again to confirm it re-opens the editor each time (not just once).

- [ ] **Step 6: Select recipes, verify "ГОТОВИМ" progress badge**

Go to "Меню", add 2-3 recipes to different meal slots so shopping/putaway can be completed (or use existing test data if the shopping/putaway steps are already satisfied). Return to the hub.

Expected: "Заново" becomes enabled. Once shopping+putaway are done, "ГОТОВИМ" becomes enabled (not muted). Click it — the `CookPickerSheet` opens with only the menu's recipes (not the full catalog). Cook one of several recipes (pick it, then return to the hub without cooking all of them).

Expected: a small numeric badge (e.g. "1/3") appears on the corner of the circular "ГОТОВИМ" button. Cook the remaining recipes.

Expected: once `cookedCount === totalCount`, the badge disappears (matches `showCookBadge` condition — only shows for partial progress).

- [ ] **Step 7: "Заново" confirmation modal**

With at least one recipe selected, click "Заново".

Expected: a centered modal dialog appears (not an inline bar) titled "Начать новое меню?" with "Нет"/"Заново" buttons and the correct warning text (mentions how many of N dishes are cooked if not all are done). Click "Нет" — modal closes, nothing changes. Click "Заново" again, then confirm.

Expected: cycle is archived, menu resets, hub cards return to their empty state, bar's "ГОТОВИМ"/"Заново" become disabled again.

- [ ] **Step 8: "История"**

Click "История" (both before and after archiving a cycle in Step 7).

Expected: opens the existing `CycleHistorySheet`, listing archived cycles, unchanged from current behavior.

- [ ] **Step 9: Sticky behavior on tall content**

Shrink the browser window height (or use Playwright's viewport resize) until the hub cards + bar no longer fit on screen. Scroll the Planner tab's content down.

Expected: the bar detaches from its resting spot under "Раскладка" and sticks to the bottom of the visible area as you scroll — it's never necessary to scroll further to find it, and the `.home-tabbar` (Занятие/Планировщик/Инструкции) below it stays put at the true bottom of the screen the whole time.

- [ ] **Step 10: Responsive width check (320px and 390px)**

Using Playwright, set the viewport to `375x812` then `320x568` (iPhone SE width).

Expected: at both widths, the bar shows no horizontal scrollbar, all 5 items remain visible and readable, and the circular "ГОТОВИМ" button stays centered on the bar's own horizontal midline (not just visually "near the top").

- [ ] **Step 11: iOS safe-area sanity check (per `CLAUDE.md`)**

In the browser devtools console, run:

```js
document.documentElement.classList.add('app-ios-standalone');
document.documentElement.style.setProperty('--app-safe-top', '59px');
document.documentElement.style.setProperty('--app-safe-bottom', '34px');
```

then reload the Planner hub view (state doesn't persist across reload, but the CSS class/vars do since they're set via devtools before reload — re-run the two `style.setProperty` calls after reload if needed) and screenshot it.

Expected: `.home-tabbar` gets extra bottom padding (as it already does today — no regression), and the new `.planner-navbar` bar is **not** pushed or squeezed by the safe-area — it sits above the tab bar exactly as at Step 2, confirming it doesn't need its own `--app-safe-bottom` padding (matches the "Global Constraints" reasoning above).

- [ ] **Step 12: Regression check on the rest of the hub**

Confirm the 4 hub cards ("Меню", "Что купить?", "В магазин", "Раскладка") still behave exactly as before this feature (same locked/active/done states, same navigation) — this feature should not have touched their logic.

- [ ] **Step 13: Final commit (if Step 9-11 revealed CSS tweaks)**

If any step above required a CSS fix, amend it into a new commit (do not silently leave the working tree dirty):

```bash
git add src/features/planner/planner.css
git commit -m "fix(planner): adjust action bar per manual verification"
```

If no fixes were needed, this step is a no-op — do not create an empty commit.

## Self-Review Notes

- **Spec coverage:** button set/order (Task 1), sticky positioning + no-horizontal-scroll + gap-after-grid (Task 1 CSS + Task 4 Step 9-10), disabled states (Task 1 props + Task 4 Step 3/6), progress badge (Task 1 + Task 4 Step 6), Modal-based "Заново" confirm (Task 3 Step 5 + Task 4 Step 7), "Рецепты" catalog entry (Task 3 Step 3/6 + Task 4 Step 4), "Продукты" editor entry (Task 2 + Task 3 Step 4 + Task 4 Step 5), old dock/CSS removal (Task 1 Step 2, Task 3 Step 5), safe-area exemption (Task 4 Step 11) — all covered.
- **Placeholder scan:** none found — every step has complete code or a concrete manual-check script.
- **Type/name consistency:** `pickRecipeAndCook` used identically in Task 3 Steps 3 and 6; `handleEditProducts` used identically in Task 3 Steps 4 and 5; `PlannerActionBar` prop names match 1:1 between Task 1's definition and Task 3 Step 5's usage (`hasSelection`, `readyToCook`, `cookedCount`, `totalCount`, `recipesLoaded`, `hint`, `onOpenCatalog`, `onEditProducts`, `onCook`, `onRestart`, `onHistory`).
