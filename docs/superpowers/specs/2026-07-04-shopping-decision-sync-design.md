# Покупки: sync Меню decisions into an existing shopping list — design

## Context

Reported symptom: after deciding ingredients as "Купить" in Меню, they don't reliably show up in Покупки — the shopping list looks like it's carrying over stale selections from earlier sessions, disconnected from the current menu.

## Root cause (confirmed via reproduction test, not committed)

`PlannerShoppingScreen.jsx`'s `loadAndApply` has two paths:
- **First-ever generation** (`!savedCustom`): builds the shopping list from scratch via `buildPlannerShoppingData`, which fuzzy-matches every recipe ingredient against `shopping.txt`'s master category list (exact → substring → word-overlap), and dumps anything unmatched into a catch-all "Из меню" category. This works correctly.
- **Every subsequent visit** (`savedCustom` exists — the common case, since a list persists once generated): only calls `applyDecisionsToPlanned(steps, planned, ingredientDecisions)`, which checks/unchecks items by **exact** normalized-string match against whatever is already sitting in the persisted category structure. It never adds anything new. A decision made for an ingredient that isn't an exact-string match to something already in the list — most commonly because the list was generated before that recipe was added to the menu — is silently dropped: not checked, not added to "Из меню", nothing.

Reproduced with a scratch Vitest file (not committed): a `'buy'` decision for a product with no match anywhere in an already-built `customData` produces an unchanged `planned` map — confirming the drop.

The store list (Меркатор/Спар/Лидл/Хофер + current selection) is a separate, intentionally session-independent setting and is unaffected by this bug — confirmed with the user, out of scope here.

## Scope

In scope:
- Replace `applyDecisionsToPlanned` with `syncDecisionsIntoShoppingData`, which can also **add** a newly-decided-to-buy ingredient to the list (via the same fuzzy-match cascade as first generation, falling back to the "Из меню" catch-all) and **remove** a catch-all item whose decision reverts to "Дома".
- Extract the fuzzy-match cascade (currently duplicated logic) into a shared `findFuzzyMatch` helper, used by both `buildPlannerShoppingData` (first generation) and the new sync function — a small, targeted DRY cleanup in the file this fix already touches.
- Wire the new function into `PlannerShoppingScreen.jsx`'s `loadAndApply`, which now also needs `allRecipes` (via the existing `loadAllRecipes`) to compute properly-cased, portion-scaled ingredient items (`buildSelectedIngredientsSummary`) — `ingredientDecisions` alone only has lowercase keys, not display-ready product names or quantities.

Out of scope:
- The store list (Меркатор/Спар/Лидл/Хофер) — confirmed intentional, unrelated.
- Manually adding non-recipe items (napkins, household chemicals, table fruit) via the category editor (✏️) — already works today via `CategoryEditor`/`handleAddCategory`, untouched by this fix.
- Fixing the general index-based `planKey(category, itemIndex)` fragility (reordering or deleting an item shifts every later index in that category, silently misaligning `planned`/`bought`/putaway state for items after it) — this is a pre-existing characteristic already present in the shipped `CategoryEditor`'s manual item deletion (`deleteItem` splices with no reindex fixup anywhere). This fix's own "Из меню" removal uses the same splice approach for consistency, accepting the same limitation rather than solving a much larger architectural problem in a bug-fix pass.

## Design

### `findFuzzyMatch(lookup, prodNorm)` (extracted, `plannerShoppingUtils.js`)

The three-tier cascade already used by `buildPlannerShoppingData` (exact → substring → word-overlap, on items with length > 3 for the last tier), extracted so both the first-generation path and the new sync function share one implementation instead of two copies drifting apart.

### `syncDecisionsIntoShoppingData(customData, planned, ingredientItems, ingredientDecisions)`

```
for each item in ingredientItems (from buildSelectedIngredientsSummary):
  decision = ingredientDecisions[item.product.toLowerCase()]
  if no decision: skip

  match = findFuzzyMatch(current customData's flat item lookup, item.product normalized)

  if match found:
    if decision === 'buy': check it (unless already checked — preserves an existing note)
    if decision === 'have':
      if match is in the "Из меню" category: remove the item from that category entirely, uncheck it
      else: just uncheck it (permanent list fixture, stays in place)
  else if decision === 'buy':
    append a new item to "Из меню" (creating that category if it doesn't exist yet),
    labeled the same way first-generation does ("{product} {qty}{unit}" when qty is known),
    and check it
  # else if decision === 'have' with no match: nothing to do, it never existed
```

Returns `{ customData, planned }` — both are needed because this function can now mutate the category structure, not just the planned/checked map.

### Wiring (`PlannerShoppingScreen.jsx`)

In `loadAndApply`'s `!forceRegen` branch, the `Promise.all` gains `loadAllRecipes(topicRecords)` alongside the existing `getPlannerShopCustomData`/`getPlannerShopPlan`/`getPlannerShopBought`/`loadPlan(studentId)`. When `savedCustom` exists:

```js
const ingredientItems = currentPlan ? buildSelectedIngredientsSummary(currentPlan, allRecipes) : [];
const { customData: syncedCustomData, planned: mergedPlanned } = currentPlan
  ? syncDecisionsIntoShoppingData(savedCustom, savedPlan ?? {}, ingredientItems, currentPlan.ingredientDecisions ?? {})
  : { customData: savedCustom, planned: savedPlan ?? {} };
```

`steps`/`icons`/`customData` state are set from `syncedCustomData` (not the raw `savedCustom`). Both `syncedCustomData` and `mergedPlanned` are persisted (`savePlannerShopCustomData`/`savePlannerShopPlan`) only if they actually changed from what was loaded — same "only write if different" guard the code already has for `mergedPlanned`.

## Testing

- Unit tests for `syncDecisionsIntoShoppingData` in a new `plannerShoppingUtils.test.js` (this file currently has no tests): a decided-"buy" ingredient with no existing match gets added to "Из меню" and checked; a second sync with the same decision doesn't duplicate it; a decided-"buy" ingredient matching an existing category item gets checked without adding anything; a "Из меню" item whose decision flips to "have" is removed entirely; a normal category item whose decision flips to "have" is just unchecked, not removed; an item with no decision is left untouched.
- Unit test confirming `findFuzzyMatch` behaves identically whether called from `buildPlannerShoppingData` or `syncDecisionsIntoShoppingData` (same three-tier cascade).
- Manual verification via the `run` skill: build a menu, decide some ingredients "Купить", open Покупки (first generation — confirm as today), go back to Меню, add another recipe, decide its ingredients, reopen Покупки — confirm the new ingredient now appears (checked, in the right category or in "Из меню"), without losing any manual edits/notes/bought-progress from before. Flip a "Из меню" item's decision back to "Дома" in Меню, reopen Покупки, confirm it's gone from the list.
