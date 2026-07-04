# «Начинаем готовить» — design

## Context

The Planner hub (`PlannerTab` in `src/features/home/HomeScreen.jsx`) shows four stage cards — Рецепты, Меню, Покупки, Раскладка — each unlocking as the previous stage completes, with a `done` badge once its own condition is satisfied (Меню: every ingredient has a Дома/Купить decision — `isMenuFullyDecided`; Покупки: everything planned has been bought — `isShoppingDone`; Раскладка: everything bought has been placed — `buildPutawayQueue` returns empty).

This closes the loop: once the ingredients a recipe needs are actually available (whether because they were already home, or because they've been bought), the student is ready to cook. Today that readiness has no expression in the UI — cooking a recipe is only reachable by drilling into Рецепты/Меню and tapping a recipe's own 🍳 button, with no gate on whether its ingredients are actually on hand.

## Scope

In scope:
- A pure readiness check, `isReadyToCook`, combining the existing Меню-decided gate with a "nothing outstanding to buy" check.
- A CTA button on the Planner hub, below the four-card grid, enabled only when `isReadyToCook` is true.
- A "Что готовим?" bottom-sheet recipe picker (all of `plan.selectedRecipes`, unfiltered), reusing the existing single-recipe cook flow (`follow_instruction` session) once a recipe is tapped.

Out of scope:
- Раскладка does not factor into the cook gate (explicit decision — it's a parallel organizing skill, not a cooking prerequisite).
- No change to the existing per-recipe 🍳 button inside Рецепты/Меню — it keeps working exactly as today, ungated. This is an additional, gated entry point, not a replacement.
- No "recipe already cooked" tracking or menu mutation after cooking — tapping a recipe in the picker starts the same session flow that exists today; nothing new is recorded.
- No grouping/filtering of the picker by meal type — flat list of everything in the menu pool.

## Design

### Readiness check (`src/features/planner/plannerUtils.js`)

Two new pure functions, alongside the existing `isMenuFullyDecided`:

```js
export function needsShopping(plan, allRecipes) {
  const items = buildSelectedIngredientsSummary(plan, allRecipes);
  return items.some((item) => plan.ingredientDecisions[item.product.toLowerCase()] === 'buy');
}

export function isReadyToCook(plan, allRecipes, shoppingDone) {
  return isMenuFullyDecided(plan, allRecipes) && (!needsShopping(plan, allRecipes) || shoppingDone);
}
```

`isReadyToCook` is true when every ingredient has a decision, and either nothing was marked "Купить" (nothing to wait on) or everything that was marked "Купить" has since been bought (`shoppingDone`, already computed in `PlannerTab` for the Покупки badge).

### Hub CTA (`PlannerTab` in `HomeScreen.jsx`)

A single large button rendered below `.planner-hub__grid`, visible only when there's a menu (`hasSelection`):

- Enabled (`isReadyToCook` true): `🍳 Начинаем готовить`, gradient-filled, matches the visual weight of the app's other primary CTAs (`.recipe-detail-add` / `.shopping-push-btn` style).
- Disabled: greyed out, with a one-line hint underneath explaining why — `"Сначала реши «Дома» или «Купить» для каждого продукта"` if `!isMenuFullyDecided`, else `"Сначала докупи всё по списку"` if it needs shopping and isn't done.

Tapping it (when enabled) opens `CookPickerSheet`.

### `CookPickerSheet` (new file: `src/features/planner/CookPickerSheet.jsx`)

A bottom sheet, structurally reusing the existing `.portions-sheet-backdrop` / `.portions-sheet` / `.portions-sheet__handle` shell classes (already in `planner.css`, generic chrome — backdrop, rounded sheet, drag handle — not specific to the portions prompt that currently uses them).

Props: `recipes` (array, shaped like `allRecipes` entries: `{ topicId, text, ... }`), `onPick(recipe)`, `onClose`.

Content: title `"Что готовим?"`, then a flat scrollable list of every recipe in `recipes` — cover photo (`useTopicFile(topicId, text.photo)`, same pattern as `RecipeIngredients`) plus title, tap anywhere on the row to call `onPick(recipe)`. No grouping, no filtering, no empty-state handling needed (the CTA that opens this sheet is only enabled when `hasSelection` is true, so `recipes` is never empty here).

### Wiring in `PlannerTab`

```js
const [cookPickerOpen, setCookPickerOpen] = useState(false);
const setActiveTopicId = useAppStore((s) => s.setActiveTopicId);
const setActiveText = useAppStore((s) => s.setActiveText);
const setActiveModeId = useAppStore((s) => s.setActiveModeId);
const setSessionReturnScreen = useAppStore((s) => s.setSessionReturnScreen);

const readyToCook = hasSelection && isReadyToCook(existingPlan, allRecipes, shoppingDone);
const menuRecipes = existingPlan.selectedRecipes
  .map((id) => allRecipes.find((r) => r.text.id === id))
  .filter(Boolean);

function handlePickRecipe(recipe) {
  setCookPickerOpen(false);
  setActiveTopicId(recipe.topicId);
  setActiveText(recipe.text);
  setActiveModeId('follow_instruction');
  setSessionReturnScreen('home'); // lands back on the hub (Планировщик tab persists — homeActiveTab)
  setScreen('params');
}
```

This mirrors `PlannerMenuScreen.jsx`'s existing `handleCook` exactly, except `setSessionReturnScreen('home')` instead of `'planner_menu'`, since this entry point starts from the hub rather than from inside Меню.

## Testing

- Unit tests for `needsShopping`/`isReadyToCook` in `plannerUtils.test.js` (existing file), covering: all "Дома" → ready without shopping; some "Купить" + shopping not done → not ready; some "Купить" + shopping done → ready; no decisions at all → not ready.
- Manual verification via the `run` skill: build a menu, mark everything "Дома" → CTA enabled immediately, no Покупки/Раскладка detour needed. Mark something "Купить" → CTA disabled with the shopping hint, becomes enabled only once Покупки shows "Всё куплено". Tap the CTA, confirm the picker lists every selected recipe, tapping one starts the same `follow_instruction` session as the existing 🍳 button, and returns to the hub afterward.
