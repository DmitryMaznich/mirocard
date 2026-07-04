# Меню as the Planner's entry point — design

## Context

The Planner hub currently has four stages — Рецепты, Меню, Покупки, Раскладка — where Рецепты (browse everything, add to a pool) and Меню (organize the pool: assign each recipe to a meal type via a segmented control, set portions, decide Дома/Купить per ingredient) are two separate top-level entry points backed by the same screen (`PlannerMenuScreen.jsx`, defaulting to its `'recipes'` or `'plan'` view depending on which hub card was tapped).

After discussion with the therapist consulting on the product, the decision is to invert this: **Меню becomes the single entry point**, structured around the question a parent actually asks a child — "what do you want for breakfast / lunch / dinner / snack?" — with recipe browsing demoted to a per-meal picker reached from inside that question, not a free-standing first step.

## Scope

In scope:
- Remove the "Рецепты" hub card; the Planner hub goes from 4 cards to 3 (Меню, Покупки, Раскладка).
- Restructure `PlannerMenuScreen.jsx`'s landing view into one scrollable page: four meal-slot sections (Завтрак, Обед, Ужин, Перекус — all four treated as equal, no special-casing of Перекус), each listing its currently-assigned recipes and a "+ Добавить рецепт" action, followed by the existing Ingredients (Дома/Купить) section, reset link, minimized send-to-student link, and the "Список покупок" CTA — all unchanged from today.
- Turn today's `RecipeBrowser` into a per-slot picker: opened from a specific meal slot's "+ Добавить рецепт", defaulting to that meal's tag filter with an "Все" override, same grid/card UI as today.
- Adding a recipe from a slot's picker auto-assigns it to that meal type immediately — no separate tagging step.
- A recipe already assigned to a *different* meal type, when shown in another slot's picker, displays a small "already: {meal}" badge; tapping it there re-assigns it to the current slot (this is the only reassignment mechanism — no separate drag/edit UI).
- Remove the "Меню · N" jump-pill from the picker (it existed to jump from browsing to the pool view; the pool view no longer exists as a separate destination — the picker's back arrow returns to the one Меню page).

Out of scope:
- No changes to `plan.selectedRecipes`, `plan.mealAssignments`, `plan.selectedPortions`, `plan.ingredientDecisions` — the data model is unchanged, this is a UI/navigation restructuring only.
- No changes to Покупки, Раскладка, or the hub's "Начинаем готовить" CTA and cook-picker sheet.
- No per-day scheduling (still no concept of "which day" a meal-type slot applies to — unchanged from today).
- Напитки stays a browsing-only tag, not a fifth slot — unchanged.

## Design

### Hub (`HomeScreen.jsx`)

`PlannerTab`'s grid drops the "Рецепты" `HubCard` entirely. Меню's card is always `active` (or `done` once `isMenuFullyDecided`, same badge logic as today) — never `locked`, since it's now the first step with nothing to gate on. Its `onClick` goes straight to `planner_menu` (no more `setPlannerInitialView` split between `'recipes'` and `'plan'`, since there's only one landing view now). Покупки/Раскладка keep their existing gating (`hasSelection` / `boughtCount`), unaffected.

### `PlannerMenuScreen.jsx` — the one landing view

Replaces the current `'recipes' | 'plan' | 'detail'` three-view split with `'menu' | 'picker' | 'detail'`:

- **`'menu'`** (new default, replacing `'plan'` as landing view): renders four `MealSlotSection` blocks (Завтрак/Обед/Ужин/Перекус, in that order) followed by the existing `MenuIngredientsSummary`, reset link, send-link, and shopping CTA — everything below the slots is exactly today's `PlanView` content, just without the `SelectedPool` component (superseded by the four slot sections) and without the portions/meal-reassignment segmented control (superseded by add-from-slot + the "already: X" re-tap).

- **`MealSlotSection`** (new component): given a `mealType`, filters `plan.selectedRecipes` down to the ones whose `mealAssignments[textId] === mealType`, renders each as a row (title, portions stepper — reusing the exact stepper markup `SelectedPool` has today — remove button), and a "+ Добавить рецепт" button that opens `'picker'` with that `mealType` pre-selected as the active tag filter.

- **`'picker'`** (renamed/repurposed `RecipeBrowser`): same grid, same meal-tag tabs, but:
  - opened with a specific `mealType` active by default (falls back to "Все" only if the caller doesn't specify one, though in practice it's always opened from a slot now).
  - the "Меню · N" pill is removed; the header's back arrow returns to `'menu'`.
  - a recipe card shows its normal selected/unselected state when its `mealAssignments` entry equals the picker's *current* meal type; when it's assigned to a *different* meal type, it shows a small badge (e.g. "уже: Ужин") instead of the plain "add" affordance — tapping it in this state calls `setMealAssignment(plan, textId, currentMealType)` (a re-tag, not a fresh select — `selectRecipe` is a no-op if already selected, so the same handler function works for both "add new" and "move from another slot").

- **`'detail'`** (`RecipeIngredients`): unchanged, reachable from a slot row's title (view) or from a picker card (view).

### Auto-assignment on add

Today, adding a recipe (`handleToggleSelect`) only calls `selectRecipe`/opens the portions prompt; meal assignment happens later via `SelectedPool`'s segmented control. The new picker's add action instead calls `selectRecipe` (or, for a fixed-portions recipe, skips the portions prompt exactly as today) **and** `setMealAssignment(plan, textId, activeMealType)` together, using the picker's currently-active tag as the target meal — so the two actions the user takes today (select, then tag) collapse into the one tap the picker already offers.

## Testing

- Manual verification via the `run` skill: from the hub, confirm only 3 cards show and Меню is immediately tappable with no prior menu. Open Меню, tap "+ Добавить рецепт" under Завтрак — confirm the picker opens with the Завтрак tab active. Add a recipe — confirm it appears under Завтрак back on the main Меню page, with no extra tagging step. Open the Обед picker and tap that same recipe (it should show its "уже: Завтрак" badge) — confirm it moves to Обед and disappears from Завтрак. Confirm portions stepper, remove, ingredients section, reset, and the shopping CTA gate all still work exactly as before.
- No new pure-logic module is introduced (the underlying `plannerUtils.js` functions — `selectRecipe`, `setMealAssignment`, `deselectRecipe`, `setSelectedPortions` — are reused unchanged), so no new unit tests are needed beyond what already covers them; this is a screen-component restructuring, verified manually per this codebase's existing convention.
