# «Начинаем готовить» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Начинаем готовить" CTA to the Planner hub that unlocks once every menu ingredient is accounted for (decided Дома/Купить, and anything marked Купить has actually been bought), opening a "Что готовим?" recipe picker that starts the existing single-recipe cook session.

**Architecture:** A pure readiness check (`isReadyToCook`, built from the existing `isMenuFullyDecided` gate plus a new `needsShopping` check) drives a CTA button rendered below the Planner hub's four-card grid. Tapping it opens a new bottom-sheet component (`CookPickerSheet`) listing the menu's selected recipes; picking one reuses the exact store-setter sequence the existing per-recipe 🍳 button already uses to start a `follow_instruction` session.

**Tech Stack:** React 19 (function components + hooks), Zustand (`useAppStore`), Vitest for unit tests.

## Global Constraints

- Раскладка does **not** factor into the cook-readiness gate — it's a parallel organizing skill, not a cooking prerequisite (explicit decision, see spec).
- The existing per-recipe 🍳 button inside Рецепты/Меню is untouched and stays ungated — this CTA is an additional, gated entry point, not a replacement.
- The picker lists `plan.selectedRecipes` flat, unfiltered — no meal-type grouping, no empty-state handling (the CTA that opens it is only enabled when the menu is non-empty).
- No "recipe already cooked" tracking or menu mutation after cooking is introduced by this plan.
- Full spec: `docs/superpowers/specs/2026-07-04-planner-start-cooking-design.md`.

---

## Task 1: Cook-readiness pure functions

**Files:**
- Modify: `src/features/planner/plannerUtils.js:142` (insert after the existing `isMenuFullyDecided`)
- Modify: `src/features/planner/plannerUtils.test.js` (add imports + new test blocks)

**Interfaces:**
- Consumes: `buildSelectedIngredientsSummary(plan, allRecipes)` and `isMenuFullyDecided(plan, allRecipes)` — both already exist in `plannerUtils.js`.
- Produces:
  - `export function needsShopping(plan, allRecipes): boolean` — true if at least one selected-recipe ingredient is decided `'buy'`.
  - `export function isReadyToCook(plan, allRecipes, shoppingDone): boolean` — used by Task 3's hub CTA.

- [ ] **Step 1: Write the failing tests**

In `src/features/planner/plannerUtils.test.js`, change the import block from:

```js
import {
  MEAL_TYPES,
  RECIPE_TAGS,
  createPlan,
  getPlanRecipes,
  countPlanRecipes,
  isRecipeSelected,
  selectRecipe,
  deselectRecipe,
  setMealAssignment,
  setSelectedPortions,
  resetPlan,
  normalizePlan,
  setIngredientDecision,
  buildSelectedIngredientsSummary,
} from './plannerUtils.js';
```

to:

```js
import {
  MEAL_TYPES,
  RECIPE_TAGS,
  createPlan,
  getPlanRecipes,
  countPlanRecipes,
  isRecipeSelected,
  selectRecipe,
  deselectRecipe,
  setMealAssignment,
  setSelectedPortions,
  resetPlan,
  normalizePlan,
  setIngredientDecision,
  buildSelectedIngredientsSummary,
  isMenuFullyDecided,
  needsShopping,
  isReadyToCook,
} from './plannerUtils.js';
```

Then append, right after the `describe('buildSelectedIngredientsSummary', ...)` block (after its closing `});`, which currently ends the file's ingredient-summary section just before `describe('getPlanRecipes', ...)`):

```js
describe('isMenuFullyDecided', () => {
  const soup = {
    text: { id: 'soup_01' },
    portions: 4,
    fixedPortions: null,
    ingredients: [
      { product: 'картошка', qty: 4, unit: 'шт' },
      { product: 'соль', qty: null, unit: null },
    ],
  };

  it('is false with no recipes selected', () => {
    expect(isMenuFullyDecided(createPlan('s1'), [soup])).toBe(false);
  });

  it('is false when some ingredients have no decision', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    expect(isMenuFullyDecided(plan, [soup])).toBe(false);
  });

  it('is true when every ingredient has a decision', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'buy');
    expect(isMenuFullyDecided(plan, [soup])).toBe(true);
  });
});

describe('needsShopping', () => {
  const soup = {
    text: { id: 'soup_01' },
    portions: 4,
    fixedPortions: null,
    ingredients: [
      { product: 'картошка', qty: 4, unit: 'шт' },
      { product: 'соль', qty: null, unit: null },
    ],
  };

  it('is false when everything is decided "have"', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'have');
    expect(needsShopping(plan, [soup])).toBe(false);
  });

  it('is true when at least one ingredient is decided "buy"', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'buy');
    expect(needsShopping(plan, [soup])).toBe(true);
  });

  it('is false with no ingredients at all', () => {
    expect(needsShopping(createPlan('s1'), [soup])).toBe(false);
  });
});

describe('isReadyToCook', () => {
  const soup = {
    text: { id: 'soup_01' },
    portions: 4,
    fixedPortions: null,
    ingredients: [
      { product: 'картошка', qty: 4, unit: 'шт' },
      { product: 'соль', qty: null, unit: null },
    ],
  };

  it('is true when everything is decided "have" (no shopping needed)', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'have');
    expect(isReadyToCook(plan, [soup], false)).toBe(true);
  });

  it('is false when something needs buying and shopping is not done', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'buy');
    expect(isReadyToCook(plan, [soup], false)).toBe(false);
  });

  it('is true when something needed buying but shopping is done', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'buy');
    expect(isReadyToCook(plan, [soup], true)).toBe(true);
  });

  it('is false when not every ingredient has a decision yet, even if shoppingDone is true', () => {
    const plan = selectRecipe(createPlan('s1'), 'soup_01');
    expect(isReadyToCook(plan, [soup], true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: FAIL — `needsShopping` and `isReadyToCook` are not exported yet (the `isMenuFullyDecided` tests pass already, since that function already exists).

- [ ] **Step 3: Implement the two new functions**

In `src/features/planner/plannerUtils.js`, immediately after the existing `isMenuFullyDecided` function (currently ending at line 142 with its closing `}`), add:

```js
// Anything left to buy? True if at least one selected-recipe ingredient is
// decided "buy" (regardless of whether it's actually been bought yet —
// that's isReadyToCook's job, via the shoppingDone flag from Покупки).
export function needsShopping(plan, allRecipes) {
  const items = buildSelectedIngredientsSummary(plan, allRecipes);
  return items.some((item) => plan.ingredientDecisions[item.product.toLowerCase()] === 'buy');
}

// Gate for the hub's "Начинаем готовить" CTA. Раскладка does not factor in
// here on purpose — it's a parallel organizing skill, not a cooking
// prerequisite (see docs/superpowers/specs/2026-07-04-planner-start-cooking-design.md).
export function isReadyToCook(plan, allRecipes, shoppingDone) {
  return isMenuFullyDecided(plan, allRecipes) && (!needsShopping(plan, allRecipes) || shoppingDone);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: PASS (all tests in the file, including the new `isMenuFullyDecided`/`needsShopping`/`isReadyToCook` blocks — 13 new tests)

- [ ] **Step 5: Run the full test suite to make sure nothing else broke**

Run: `npx vitest run src/features/planner`
Expected: all planner test files still pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/plannerUtils.js src/features/planner/plannerUtils.test.js
git commit -m "feat(planner): add needsShopping/isReadyToCook cook-readiness gate"
```

---

## Task 2: `CookPickerSheet` component

**Files:**
- Create: `src/features/planner/CookPickerSheet.jsx`
- Modify: `src/features/planner/planner.css` (append new classes)

**Interfaces:**
- Consumes: `useTopicFile` (`@/shared/hooks/useTopicFile`), `getTopicTitle` (`@/shared/utils/format`) — both already used elsewhere in this codebase for recipe covers/titles (e.g. `RecipeIngredients` in `PlannerMenuScreen.jsx`).
- Produces: default export `CookPickerSheet({ recipes, onPick, onClose })`, where `recipes` is an array shaped like `loadAllRecipes()`'s entries (`{ topicId, text: { id, title, photo }, ... }`). Consumed by Task 3's `PlannerTab`.

- [ ] **Step 1: Create `CookPickerSheet.jsx`**

Create `src/features/planner/CookPickerSheet.jsx`:

```jsx
import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { getTopicTitle } from '@/shared/utils/format';
import './planner.css';

function CookPickerPhoto({ topicId, imagePath }) {
  const url = useTopicFile(topicId, imagePath);
  if (!url) return <div className="cook-picker-item__photo cook-picker-item__photo--empty" />;
  return <img className="cook-picker-item__photo" src={url} alt="" />;
}

export default function CookPickerSheet({ recipes, onPick, onClose }) {
  return (
    <div className="portions-sheet-backdrop" onClick={onClose}>
      <div className="portions-sheet cook-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="portions-sheet__handle" />
        <h2 className="portions-sheet__title">Что готовим?</h2>
        <ul className="cook-picker-list">
          {recipes.map((recipe) => (
            <li key={recipe.text.id}>
              <button type="button" className="cook-picker-item" onClick={() => onPick(recipe)}>
                <CookPickerPhoto topicId={recipe.topicId} imagePath={recipe.text.photo} />
                <span className="cook-picker-item__name">{getTopicTitle(recipe.text.title)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="portions-sheet__cancel" onClick={onClose}>
          Отменить
        </button>
      </div>
    </div>
  );
}
```

(This reuses the existing `.portions-sheet-backdrop` / `.portions-sheet` / `.portions-sheet__handle` / `.portions-sheet__title` / `.portions-sheet__cancel` classes already in `planner.css` — generic bottom-sheet chrome, not specific to the portions prompt that currently uses them.)

- [ ] **Step 2: Add the picker-specific CSS**

Append to the end of `src/features/planner/planner.css`:

```css
/* ── Cook picker sheet ("Что готовим?") ────────────────────────── */
.cook-picker-sheet {
  max-height: 70vh;
}

.cook-picker-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  max-height: 50vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cook-picker-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid #e7dccf;
  background: rgba(250, 247, 242, 0.96);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.cook-picker-item__photo {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}

.cook-picker-item__photo--empty {
  background: #ede5d8;
}

.cook-picker-item__name {
  font-size: 15px;
  font-weight: 700;
  color: #263131;
}
```

- [ ] **Step 3: Run lint on the new file**

Run: `npx eslint src/features/planner/CookPickerSheet.jsx`
Expected: no errors (this is a brand-new file with no pre-existing issues to inherit).

- [ ] **Step 4: Commit**

```bash
git add src/features/planner/CookPickerSheet.jsx src/features/planner/planner.css
git commit -m "feat(planner): add CookPickerSheet component for Начинаем готовить"
```

---

## Task 3: Wire the CTA and sheet into the Planner hub

**Files:**
- Modify: `src/features/home/HomeScreen.jsx`
- Modify: `src/features/planner/planner.css` (append CTA/hint styles)

**Interfaces:**
- Consumes: `isReadyToCook(plan, allRecipes, shoppingDone)` and `needsShopping` unused directly here (only `isReadyToCook`/`isMenuFullyDecided` are needed for the hint branching) from Task 1; `CookPickerSheet` default export from Task 2.
- Produces: nothing new — this is the final integration task.

- [ ] **Step 1: Import `isReadyToCook` and `CookPickerSheet`**

In `src/features/home/HomeScreen.jsx`, change:

```js
import { isMenuFullyDecided } from "@/features/planner/plannerUtils";
```

to:

```js
import { isMenuFullyDecided, isReadyToCook } from "@/features/planner/plannerUtils";
import CookPickerSheet from "@/features/planner/CookPickerSheet";
```

- [ ] **Step 2: Add cook-flow state and store setters to `PlannerTab`**

In `src/features/home/HomeScreen.jsx`, change:

```jsx
function PlannerTab({ student, setScreen }) {
  const setPlannerInitialView = useAppStore((s) => s.setPlannerInitialView);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const [existingPlan, setExistingPlan] = useState(undefined); // undefined = loading
  const [allRecipes, setAllRecipes] = useState([]);
  const [boughtCount, setBoughtCount] = useState(0);
  const [shoppingDone, setShoppingDone] = useState(false);
  const [putawayDone, setPutawayDone] = useState(false);
```

to:

```jsx
function PlannerTab({ student, setScreen }) {
  const setPlannerInitialView = useAppStore((s) => s.setPlannerInitialView);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const setActiveTopicId = useAppStore((s) => s.setActiveTopicId);
  const setActiveText = useAppStore((s) => s.setActiveText);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);
  const setSessionReturnScreen = useAppStore((s) => s.setSessionReturnScreen);
  const [existingPlan, setExistingPlan] = useState(undefined); // undefined = loading
  const [allRecipes, setAllRecipes] = useState([]);
  const [boughtCount, setBoughtCount] = useState(0);
  const [shoppingDone, setShoppingDone] = useState(false);
  const [putawayDone, setPutawayDone] = useState(false);
  const [cookPickerOpen, setCookPickerOpen] = useState(false);
```

- [ ] **Step 3: Compute readiness and add the cook handler**

Change:

```jsx
  const menuDone = hasSelection && allRecipes.length > 0 && isMenuFullyDecided(existingPlan, allRecipes);

  return (
```

to:

```jsx
  const menuDone = hasSelection && allRecipes.length > 0 && isMenuFullyDecided(existingPlan, allRecipes);
  const readyToCook = hasSelection && allRecipes.length > 0 && isReadyToCook(existingPlan, allRecipes, shoppingDone);
  const menuRecipes = hasSelection
    ? existingPlan.selectedRecipes.map((id) => allRecipes.find((r) => r.text.id === id)).filter(Boolean)
    : [];

  function handlePickRecipe(recipe) {
    setCookPickerOpen(false);
    setActiveTopicId(recipe.topicId);
    setActiveText(recipe.text);
    setActiveModeId('follow_instruction');
    setSessionReturnScreen('home');
    setScreen('params');
  }

  return (
```

- [ ] **Step 4: Render the CTA, hint, and sheet**

Change:

```jsx
        <HubCard
          state={boughtCount === 0 ? 'locked' : putawayDone ? 'done' : 'active'}
          icon="📦"
          title="Раскладка"
          value={boughtCount === 0 ? 'После покупок' : putawayDone ? 'Всё разложено' : `${boughtCount} товаров готово к раскладке`}
          onClick={() => setScreen('planner_putaway')}
          disabled={boughtCount === 0}
        />
      </div>
    </div>
  );
}
```

to:

```jsx
        <HubCard
          state={boughtCount === 0 ? 'locked' : putawayDone ? 'done' : 'active'}
          icon="📦"
          title="Раскладка"
          value={boughtCount === 0 ? 'После покупок' : putawayDone ? 'Всё разложено' : `${boughtCount} товаров готово к раскладке`}
          onClick={() => setScreen('planner_putaway')}
          disabled={boughtCount === 0}
        />
      </div>

      {hasSelection && (
        <>
          <button
            type="button"
            className="planner-cook-cta"
            disabled={!readyToCook}
            onClick={() => setCookPickerOpen(true)}
          >
            🍳 Начинаем готовить
          </button>
          {!readyToCook && (
            <div className="planner-cook-hint">
              {!menuDone
                ? 'Сначала реши «Дома» или «Купить» для каждого продукта'
                : 'Сначала докупи всё по списку'}
            </div>
          )}
        </>
      )}

      {cookPickerOpen && (
        <CookPickerSheet
          recipes={menuRecipes}
          onPick={handlePickRecipe}
          onClose={() => setCookPickerOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add the CTA/hint CSS**

Append to the end of `src/features/planner/planner.css`:

```css
/* ── Planner hub: Начинаем готовить CTA ────────────────────────── */
.planner-cook-cta {
  width: 100%;
  margin-top: 16px;
  padding: 16px;
  border-radius: 16px;
  border: none;
  background: linear-gradient(150deg, #5cb0a3, #276b62);
  box-shadow: 0 8px 20px rgba(39, 107, 98, 0.3);
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
}

.planner-cook-cta:disabled {
  background: #ede5d8;
  box-shadow: none;
  color: #a8978a;
  cursor: default;
}

.planner-cook-hint {
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  color: #a8978a;
}
```

Note: `.planner-hub` (the outer wrapper) already lays out its children in normal document flow (it is not `display: flex`), so the CTA button and hint, placed as siblings after `.planner-hub__grid`, stack below the grid without any further layout changes.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run src/features/planner`
Expected: all planner tests still pass (no new pure-logic module changed by this task beyond what Task 1 already covers).

- [ ] **Step 7: Run lint**

Run: `npx eslint src/features/home/HomeScreen.jsx src/features/planner/CookPickerSheet.jsx`
Expected: only the pre-existing `HomeScreen.jsx` issues already known before this plan (`isChatPractice` unused var, the `loadPlan`/Promise.all `set-state-in-effect` errors on the existing `useEffect`s, a few `exhaustive-deps` warnings) — no new errors introduced by this task's changes.

- [ ] **Step 8: Manual verification**

Using the `run` skill:
1. With a menu where every ingredient is marked "Дома": the CTA is enabled immediately (no need to visit Покупки or Раскладка). Tapping it opens "Что готовим?" listing every selected recipe with cover photo and title.
2. Tap a recipe in the picker: it closes, and the app starts the same cooking session (`follow_instruction`) that the existing 🍳 button in Рецепты/Меню starts for that recipe.
3. Finish or back out of that session: lands back on the hub, on the Планировщик tab (not reset to Занятие).
4. With a menu where at least one ingredient is marked "Купить" and Покупки isn't finished: CTA is disabled, hint reads "Сначала докупи всё по списку". Mark every planned item bought in В магазине (Покупки shows "Всё куплено") — CTA becomes enabled without needing Раскладка to be touched.
5. With a menu where some ingredient has no Дома/Купить decision yet: CTA is disabled, hint reads "Сначала реши «Дома» или «Купить» для каждого продукта".
6. With no recipes in the menu (`hasSelection` false): neither the CTA nor the hint renders at all.

- [ ] **Step 9: Commit**

```bash
git add src/features/home/HomeScreen.jsx src/features/planner/planner.css
git commit -m "feat(planner): add Начинаем готовить CTA to the Planner hub"
```
