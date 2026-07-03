# Menu selection vs. distribution — design

## Context

Mirocard's Planner trains a core independent-living skill: feeding yourself (plus the sensory-integration value of actually cooking). The flow is Рецепты (browse/pick recipes) → Меню (organize into a schedule) → Покупки (shop) → Раскладка (put away) → back to Меню to cook.

Today, adding a recipe from the "Рецепты" grid *immediately* commits it to a specific day + meal slot — the card's "+ Добавить" popover asks for a day (via checkboxes) and, when a recipe has multiple meal-type tags, silently guesses the meal slot from whichever browsing tab is active (or the recipe's first tag, on the "Все" tab). This conflates two different ideas: "this dish suits breakfast" (a tag, can be plural) and "this specific instance goes on Wednesday's dinner" (a scheduling decision). The guessing is the concrete bug reported ("recipes automatically fall into breakfast/lunch/dinner"); the deeper issue is that recipe selection and schedule placement are being forced into a single action.

This spec splits them: **Рецепты is where you pick what you like** (a flat pool, no day/meal yet); **Меню is where you organize the pool into an actual week's schedule**, and is also where the student returns after shopping/put-away to start cooking.

## Data model

- `MEAL_TYPES` (`src/features/planner/plannerUtils.js`) drops from 5 to 4 entries: `['завтрак', 'обед', 'ужин', 'перекус']`. These remain the only valid `day.meals` keys and the only options in the day/meal picker.
- A new constant `RECIPE_TAGS = [...MEAL_TYPES, 'напитки']` is used wherever recipe tags are filtered/displayed for browsing (the "Рецепты" category tabs). "напитки" is a *suitability tag* only — a drink still gets scheduled into one of the 4 real meal slots, same as any dish; nothing stops it from being scheduled into two different meals on two different days.
- `Plan` gains `selectedRecipes: string[]` — an array of recipe text IDs the student has picked for this menu. No portions or scheduling info lives here; portions are decided per placement, same as today.
- `plannerUtils.js` gains:
  - `selectRecipe(plan, textId)` / `deselectRecipe(plan, textId)` — deselect also strips every placement of that recipe from every day (cascade), via the existing `removeRecipeFromMeal` per day/meal.
  - `isRecipeSelected(plan, textId)` — membership check.
  - `resetPlan(studentId)` — returns a fresh `createPlan(studentId)` (used by "Начать меню заново"; the caller just replaces the whole `plan` state with this).
- `normalizePlan` (already the home for legacy-format upgrades) gains two migration steps, applied on every load:
  1. If `selectedRecipes` is absent, backfill it with the deduplicated list of every `textId` currently present in any `day.meals` slot (via the existing `getPlanRecipes`/dedup logic) — so an existing in-progress menu doesn't lose its pool view.
  2. If any `day.meals` has a legacy `напитки` key with entries, move those entries into that day's `перекус` array (append, don't overwrite), then drop the `напитки` key. This is a one-time, best-effort migration — there's no way to know the student's actual intent, and "перекус" is the least-wrong default for a drink that had no real meal assignment.

## Рецепты screen

- The card's "+ Добавить" popover is deleted entirely. In its place: a single toggle button — "+ Добавить" when not selected, "✓ В меню" when selected. Tapping calls `selectRecipe`/`deselectRecipe`. No stepper, no day picker, no popover markup at this screen.
- The photo badge (currently placement count) becomes a simple presence checkmark/dot when selected — there's no longer a per-tab placement count to show here, since selection isn't tab-scoped.
- The header pill switches from counting placements to `plan.selectedRecipes.length`, e.g. "Меню · 4".
- The ▶ cook button is unchanged — cooking is independent of scheduling and stays available everywhere it already is.
- The "Уже в меню" chip list on the ingredients-detail screen changes meaning slightly: it still lists actual placements (day + meal + portions) if any exist. A recipe can now be selected with zero placements — in that case, instead of showing nothing, the screen shows a single small "Отобрано, пока без дня" hint so the state isn't silently indistinguishable from "not in the menu at all". The detail screen's own "+ Добавить в меню" button still opens the day/meal/portions sheet directly (unchanged) — viewing a recipe and wanting to schedule it immediately shouldn't require a detour through Меню first. Confirming that sheet calls `selectRecipe` first (if not already selected) and then adds the placement, so a recipe scheduled this way — without ever tapping the card's toggle — still shows up correctly in Меню's "Отобрано" pool afterward. The same applies to the card's popover-less "Готовить" (▶) path: cooking never implies selection, only explicit "+ Добавить" (card toggle) or confirming the day/meal/portions sheet does.

## Меню screen

Two sections, in this order:

**"Отобрано"** — one row per `selectedRecipes` entry: title, small ingredient preview (reuse the existing card info style), a placement-count badge if it's already scheduled somewhere ("×3"), a "Распределить" button, and a "Убрать" button.
- "Распределить" opens the existing day/meal/portions sheet (currently `AddToPlanSheet`, day chips + 4 meal icons + portions stepper) for that recipe. Confirming adds a new placement — the recipe stays in "Отобрано" afterward, so a drink can be distributed again to a different day/meal in the same session.
- "Убрать" calls `deselectRecipe` — removes from the pool and cascades placement removal, no separate confirmation (matches the existing lightweight remove-chip behavior elsewhere in the Planner).

**"По дням"** — unchanged day cards, except each recipe chip gains a fourth control, "↻" (move), between the name and the "×". Tapping it opens the same day/meal/portions sheet, pre-filled with that placement's current day/meal/portions instead of blank defaults. Confirming replaces that one placement (removes the old day+meal+textId entry, adds the new one) instead of adding an extra one — this is the "changed my mind" fast path the day-card chips didn't have before (previously: remove, then find the recipe again in Отобрано to re-add).

**"Начать меню заново"** — a text-link-style destructive action at the bottom of the screen. Tapping shows an inline confirm bar (matching the existing shopping-screen reset pattern: "Точно начать заново? Всё меню будет удалено." / Да / Нет) before calling `resetPlan` and replacing `plan` state.

## Hub

- "Рецепты" card's value line changes from `"{days} дн. · {count} рец."` to `"{selectedCount} отобрано"` (or the existing empty-state copy when `selectedCount === 0`).
- "Меню" card's gate changes from `hasRecipes` (placement-based) to `plan.selectedRecipes.length > 0` — otherwise a student could never reach Меню to create the first placement. Its value line stays placement-based (`"{days} дн. · {count} рец."` when placements exist, else "Пока пусто" or similar) since that reflects actual scheduling progress, distinct from the Рецепты card's selection count.
- "Покупки" card's gate is unchanged (`countPlanRecipes(plan) > 0`, i.e. real placements) — shopping still needs an actual schedule, not just a wishlist.

## Out of scope

- No changes to `PlannerShoppingScreen`, `PlannerSummaryScreen`, or shopping-list generation — both are driven by placements (`getPlanRecipes`), which are untouched.
- No drag-and-drop; "move" is done through the existing sheet component, pre-filled.
- No per-selection default portions field — portions are still purely a per-placement concept, asked fresh each time a recipe is distributed (defaulting to its `fixedPortions` or base `portions`, as today).
