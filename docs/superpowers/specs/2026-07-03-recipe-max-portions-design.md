# Recipe max_portions — design

## Context

This is sub-project C of a larger recipe-content initiative agreed with the user across prior conversation turns (tracked in this Claude Code session's project memory — not a repo file). The other sub-projects — ingredient unit conventions (A), shopping-list unit conversion (B), and a `new-recipe` authoring skill (D) — are tracked separately and out of scope here.

Today, the portions stepper that appears when starting to cook a recipe (`RecipeStartParams` in `src/features/session/ParamsScreen.jsx`) is capped at a hardcoded `20`, with no per-dish reasoning — 20 servings of fried eggs in one pan makes no sense, and the cap doesn't distinguish a single-serving skillet dish from a stockpot soup. Meanwhile the Planner's own portions stepper (`AddToPlanSheet` in `src/features/planner/PlannerMenuScreen.jsx`) has **no upper bound at all**.

Investigating the fix surfaced a deeper inconsistency: the two steppers don't even agree on what the number *means*. The Planner's stepper is an absolute serving count (starts at the recipe's own declared `# portions:`, e.g. "4"). The cook-start screen's stepper is a multiplier of whatever the recipe already assumes (starts at "1" meaning "as written", "2" doubles it) — but it's labeled identically ("Порций") with no indication it's a multiplier, so a user very reasonably reads both screens as meaning the same thing when they don't. This spec fixes both problems together: it unifies the semantics to a single absolute-serving-count model, and introduces a per-recipe `max_portions` field so the cap reflects each dish's real cooking constraints instead of one arbitrary global number.

## Data model

Two new pieces of per-recipe metadata need to reach the client, through the two existing parsers of the `# key: value` recipe header format:

- `src/features/planner/recipeParser.js` (`parseRecipeMetadata`) — parses the raw `.txt` live, at runtime, for the Planner's own use (Рецепты cards, ingredients list, shopping list generation).
- `scripts/update-recipes-deck.mjs` (`extractMeta`) — a manually-run build script that bakes recipe metadata into the deployed topic manifest (`topic.json`), which is what supplies `activeText.fixedPortions` etc. to `ParamsScreen.jsx` and the reading renderer for the normal topic-content pipeline.

Both need the same two additions:

1. **`# portions:` (base serving count) must reach the manifest.** It's already parsed by `recipeParser.js`, but `update-recipes-deck.mjs` currently doesn't extract it at all, so `activeText.portions` doesn't exist today. Add it to `extractMeta`, defaulting to `1` like the live parser, and always include it in each text's manifest entry (not conditionally — every recipe needs a known base, unlike `fixedPortions`/`status` which are meaningfully absent).

2. **`# max_portions: N`** — a new header key, parsed the same way as `fixed_portions` (integer, optional). Included in the manifest only when present (matching the existing `fixedPortions`/`status` conditional-inclusion pattern); consumers apply the default (`?? 4`) at the read site rather than baking a default into the manifest.

`recipeParser.js`'s `parseRecipeMetadata` return value gains `maxPortions` (default `4` when absent or non-numeric), mirroring how `fixedPortions` already defaults to `null`. `PlannerMenuScreen.jsx`'s recipe-loading effect adds `maxPortions` to the object it builds per recipe (alongside the `status` it already added), so `AddToPlanSheet` can read `recipe.maxPortions`.

`update-recipes-deck.mjs` also gains a build-time sanity check: if a recipe's `max_portions` (or the default `4`, when absent) is less than its own `portions` base, log a warning — that combination locks the stepper at a single unusable value (min=max=base) and almost certainly means the recipe needs an explicit `max_portions` raised above its base.

## Unifying portions semantics

**The absolute serving count is the one number that exists everywhere:** in the recipe's own `# portions:`, in what the Planner's `AddToPlanSheet` stepper shows and stores per placement, in what `RecipeStartParams`'s stepper will now show, and in what gets persisted via `saveRecipeSettings`/`getRecipeSettings`. Nothing in this chain is a multiplier.

The *only* place a multiplier still exists is deep inside `InstructionTask` (`src/topics/renderers/reading/index.jsx`), because that's the one place that actually needs it — `applyPortions` scales `{N|...}` templates in step text, and those templates are authored assuming the recipe's own base amount. `InstructionTask` computes the scaling factor itself, right before use, as `chosenAbsolute / basePortions`, where `basePortions = task.text?.portions ?? 1` and `chosenAbsolute = task.text?.fixedPortions ?? sessionPortionsOverride ?? settings.portions ?? basePortions`. The `fixedPortions` case is untouched — a fixed-portions recipe's steps never use scaling templates (confirmed: `soup.txt`'s vermicelli step hardcodes "6 столовых ложек" as plain text), so passing its absolute value straight through as before doesn't change behavior. The `basePortions` fallback (replacing today's bare `?? 1`) matters for the edge case of a session with no override and nothing ever saved — it now defaults to "as authored" instead of a generic "1", which was silently wrong for any recipe whose base isn't 1.

`RecipeStartParams` needs almost no logic change, because `startSession()`'s `finalPortions = fixedPortions || portions` formula is already exactly right — only what `portions` *means* changes: its `useState` now initializes from `activeText.portions ?? 1` instead of a hardcoded `1`, and its stepper bounds change from `[1, 20]` to `[1, activeText.maxPortions ?? 4]`. `getRecipeSettings`/`saveRecipeSettings` code is untouched; only the meaning of the number stored in its `portions` field shifts (multiplier → absolute), consistent with everything above.

`AddToPlanSheet`'s stepper already works in absolute terms and needs no semantic change — just its missing upper bound added: `Math.min(recipe.maxPortions ?? 4, p + 1)`.

## Scope: mechanism only, not the full content pass

This sub-project ships the mechanism and proves it end-to-end on two recipes; assigning `max_portions` across all 27 recipes by dish category is sub-project A's job, done in the same pass as the other ingredient-content edits.

- **`mushroom_soup.txt`** (`# portions: 4`, cooked in a large pot) gets `# max_portions: 8` — a worked example of the "batch dish, higher ceiling" category.
- **`coffee_chemex.txt`** (`# portions: 1`, a weight-calibrated pour-over brew) does **not** get `max_portions: 1` — that would just be a permanently disabled stepper, a worse UX than the existing pattern for this exact situation. It becomes `# fixed_portions: 1` instead, same treatment as `soup.txt`/`kompot.txt`/`kotlety.txt` — the stepper disappears entirely, showing "готовим 1" like the other fixed-batch dishes. While editing this file's header, also fix an unrelated pre-existing typo directly adjacent to the change: `# tags: напиток, завтрак` → `# tags: напитки, завтрак` (singular `напиток` never matches the `напитки` tab filter used everywhere else — see `RECIPE_TAGS` in `plannerUtils.js` — so this recipe was silently invisible under that tab).

## Testing

- `recipeParser.test.js` gains tests for `maxPortions`: explicit value, default `4` when absent, non-numeric value falls back to `4`.
- `update-recipes-deck.mjs` is a manually-run script with no test suite (consistent with the rest of that script) — verified by running it and inspecting the produced manifest for `mushroom_soup`/`coffee_chemex`.
- No dedicated component tests exist for `ParamsScreen.jsx`/`PlannerMenuScreen.jsx`/`reading/index.jsx` (consistent with the rest of the codebase) — verified manually via the dev server: confirm the cook-start stepper for a `max_portions: 8` recipe starts at its base and stops at 8, confirm `AddToPlanSheet`'s stepper for the same recipe also stops at 8, confirm a `fixed_portions` recipe (old or newly-converted) shows the locked "готовим N" label with no stepper, and confirm the actual scaled instruction text reads correctly at a non-default portion count (e.g. picking 8 servings of a 4-base recipe doubles a `{N|...}` template in a step).

## Out of scope

- Assigning `max_portions` to the other 25 recipes (sub-project A).
- The shopping-list unit-conversion work (sub-project B) and the `new-recipe` skill (sub-project D).
- `InstructionParamsContent.jsx` (used only for `kind === "shopping_list"` texts) — untouched, this spec only concerns `kind === "instruction"` recipes.
