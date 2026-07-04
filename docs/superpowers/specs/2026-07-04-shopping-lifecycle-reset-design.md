# Покупки lifecycle: menu-managed reconciliation + comprehensive reset — design

## Context

The previous fix (`syncDecisionsIntoShoppingData`, shipped this session) stops Покупки from silently dropping newly-decided "Купить" ingredients. Two related gaps remain, both about the *lifecycle* of the shopping list relative to Меню:

1. **No comprehensive reset.** Starting a brand-new menu ("Начать меню заново" in Меню) only resets the menu plan itself (`resetPlan`). It leaves Покупки's `customData`/`planned`/`bought` and Раскладка's `putawayPlan` untouched — the old shopping list, from the old menu, just sits there. Meanwhile Покупки already has its own separate, narrower resets ("Пересоставить из рецептов", "Начать новый список") that don't touch the menu at all. There's no single "start everything over" operation.

2. **No teardown when a recipe leaves the menu.** `syncDecisionsIntoShoppingData` only ever looks at the *current* menu's ingredients (`buildSelectedIngredientsSummary(plan, allRecipes)`). If a recipe is removed (or swapped for another) and no other selected recipe needs that ingredient anymore, the ingredient simply stops appearing in that computation — the sync loop never revisits it, so its checked state in Покупки never gets cleared. It sits there forever, checked, even though the menu no longer calls for it.

Fixing (2) requires telling apart two kinds of checked items in Покупки, which look identical today: items checked *because Меню decided "Купить"* for them, versus items the child checked manually and independently (napkins, extra snacks — anything not tied to a recipe). Only the first kind should ever be touched by reconciliation.

## Scope

In scope:
- A persisted "menu-managed keys" set, updated on every Покупки sync, that lets reconciliation tell menu-driven checks apart from manual ones.
- Reconciliation: when a previously-menu-managed key is no longer needed (ingredient dropped out of the menu, or its decision reverted), it's cleaned up the same way an explicit "Дома" decision already is (uncheck a normal item, remove a "Из меню" item) — without touching manually-checked items.
- A shared `resetShoppingData(studentId)` used by both Меню's "Начать меню заново" (new) and Покупки's "Пересоставить из рецептов" (replacing its current inline reset code) — clearing `customData`/`planned`/`bought`/`putawayPlan`/the new menu-keys set together.
- Consistent handling of the menu-keys set everywhare `planned`/`bought` already get reset today ("Начать новый список" after a completed trip, "Очистить весь список").

Out of scope:
- The store list and shopping history — confirmed intentionally untouched by any of these resets.
- Pruning stale entries out of `plan.ingredientDecisions` when a recipe is deselected — not needed for correctness (the menu-keys reconciliation only ever looks at *currently* selected recipes' ingredients, so a stale decision for a since-removed recipe's ingredient is simply never consulted again; it's also arguably correct to keep it, since a decision is per-product and should carry over if that product reappears in a later recipe).

## Design

### Menu-managed keys (`plannerShopMenuKeys`)

New KV pair in `groupStore.js`, following the existing `plannerShopBoughtKey` pattern exactly: `getPlannerShopMenuKeys(studentId)` / `savePlannerShopMenuKeys(studentId, keys)`, storing a plain array of `planKey` strings.

### `syncDecisionsIntoShoppingData` — new signature

```
syncDecisionsIntoShoppingData(customData, planned, menuKeys, ingredientItems, ingredientDecisions)
  → { customData, planned, menuKeys }
```

Unchanged from before: for each ingredient with a decision, find-or-add its item and check/uncheck/remove it. **New:** every time a "buy" decision successfully checks an item (whether newly added to "Из меню" or already in the list), its key is added to a fresh `nextMenuKeys` set being built during this pass.

**After** processing every ingredient, reconcile against the *previous* `menuKeys` (passed in): any key that was menu-managed last time but isn't in `nextMenuKeys` this time is no longer wanted by the menu — remove it from "Из меню" (if that's where it lives) or just uncheck it (if it's a permanent category item), exactly like an explicit "Дома" decision would. Keys never added to `menuKeys` (manually checked items) are never touched by this pass, since reconciliation only iterates the *old* `menuKeys` set.

If several "Из меню" items need removing in the same reconciliation pass, they're removed in descending index order first, so removing one doesn't shift the array index of another one still pending removal in the same pass (a real correctness bug the naive one-at-a-time version would have — different from, and not to be confused with, the already-accepted general index-fragility limitation of manual single-item edits elsewhere).

### `resetShoppingData(studentId)` (new, in `plannerApi.js`)

```js
export async function resetShoppingData(studentId) {
  await savePlannerShopCustomData(studentId, null);
  await savePlannerShopPlan(studentId, {});
  await savePlannerShopBought(studentId, {});
  await savePlannerPutawayPlan(studentId, {});
  await savePlannerShopMenuKeys(studentId, []);
}
```

Called from two places:
- **`PlannerMenuScreen.jsx`'s "Начать меню заново"** (currently just `setPlan(resetPlan(activeStudentId))`) — now also calls `resetShoppingData(activeStudentId)`, so a brand-new menu also means a brand-new (empty, to-be-regenerated) shopping list and put-away state.
- **`PlannerShoppingScreen.jsx`'s `handleRegenerate`** ("Пересоставить из рецептов") — replaces its current four inline reset calls with this one shared function (DRY; behavior unchanged, since it was already doing exactly this except for the new menu-keys reset it was missing).

History (🕒, last 5 completed trips) and the store list are untouched by `resetShoppingData` — confirmed intentional.

### Seeding and carrying `menuKeys` through the rest of the lifecycle

- **First-ever generation** (`loadAndApply`'s fresh-generation branch, calling `buildPlannerShoppingData`): the returned `plan`'s keys are exactly what got checked because of decisions — persist them as the initial `menuKeys` via `savePlannerShopMenuKeys(studentId, Object.keys(newPlan))`.
- **Every subsequent load** (`loadAndApply`'s `!forceRegen` branch): load the persisted `menuKeys` alongside everything else, pass it into `syncDecisionsIntoShoppingData`, persist the returned `menuKeys` if it changed (same "only write if different" guard already used for `planned`/`customData`).
- **"Начать новый список" (`handleNewListAfterShop`)**: already resets `planned`/`bought`/`putawayPlan` to start a fresh trip against the *same* menu — also resets `menuKeys` to `[]`, so the next Покупки load re-derives it cleanly from the current menu instead of comparing against a stale set.
- **"Очистить весь список" (`clearAllChecks`)**: same reasoning — resets `menuKeys` to `[]` alongside `planned`/`bought`/`putawayPlan`.

## Testing

- Unit tests for the reconciliation behavior in `syncDecisionsIntoShoppingData` (extending the existing `plannerShoppingUtils.test.js`): a menu-managed key that's no longer needed gets unchecked (normal category) or removed (Из меню); a manually-checked key never in `menuKeys` survives a sync pass untouched even when its ingredient isn't in the menu at all; removing two "Из меню" items in the same pass doesn't corrupt either one's identity (verified by checking the *labels* that remain, not just the count).
- Unit test for `resetShoppingData` (in a new or existing `plannerApi.test.js`) confirming it calls all five saves with the expected reset values.
- Manual verification via the `run` skill:
  1. Build a menu, decide ingredients, open Покупки (first generation) — confirm the hub-card/UI as before.
  2. Go back to Меню, remove one recipe whose ingredients aren't used by any other selected recipe, reopen Покупки — confirm those ingredients are now gone from the list (unchecked if a permanent category item, fully removed if they'd landed in "Из меню").
  3. Manually check an unrelated item in Покупки (e.g. add "Салфетки" via the editor and check it), then repeat step 2's recipe removal — confirm the manually-checked item is untouched.
  4. In Меню, tap "Начать меню заново" — confirm Покупки and Раскладка are both back to their empty/locked starting state, and history (🕒) still has the earlier entries if any exist.
