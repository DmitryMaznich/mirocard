# Recipe architecture simplification — design

## Context

The recipe library (27 files in `content/recipes/*.txt`) was originally built as an independent reading topic — a card deck like any other (poems, vocabulary, math). It was later adopted by the Planner (`src/features/planner/`) as its source of cookable recipes, ingredients, and shopping-list data. That dual heritage is now the pain point:

- **Delivery mechanism**: recipes are packaged into a ZIP (`public/decks/reading_dad_texts_v{X}.zip`) by a manually-run script (`scripts/update-recipes-deck.mjs`), which requires hand-bumping a version number and ZIP filename inside the script, plus a `catalog.json` update — the same ceremony needed for any other deck (Стихи, Эмоции), even though recipes are edited far more often and have no need for user-facing versioning or install/update UI.
- **Portions data model**: three overlapping header fields (`# portions:`, `# max_portions:`, `# fixed_portions:`) where `fixed_portions` always duplicates `portions` numerically (verified across all 7 files that use it) and `max_portions` is a per-recipe cap that in practice only ever takes values between 4 and 8 — added purely as an input-sanity guard against a child mistyping a portions count, not because individual dishes have genuinely different scaling ceilings.
- **Dual entry points**: recipes are reachable both directly (Home → topic catalog → "Чтение. Готовим еду" → pick a text → read it, independent of any meal plan) and through the Planner (Меню → pick a recipe → cook it, same reading-by-steps engine underneath). This is being consolidated to Planner-only.

This spec covers restructuring recipe content delivery and the portions data model. It does not touch the reading/`follow_instruction` session engine's internals (scaling logic, step display, TTS) — that machinery is shared with other reading topics (poems, short stories) and stays as-is.

## Decisions made with the user

- Recipes are fully removed from the ZIP/catalog packaging mechanism — no more manually-bumped ZIP version, no `catalog.json` entry, no user-facing install step.
- Recipes become Planner-only. The standalone "Чтение. Готовим еду" catalog topic is removed from the catalog and from Home's topic picker; there is no direct path to a recipe outside the Planner's Меню.
- Portions collapse to two recipe types: `per_portion` (scalable, default) and `fixed` (locked batch, e.g. soup/kompot at 4–6 servings, no stepper). No per-recipe `max_portions` — one global stepper ceiling for all `per_portion` recipes.
- The global portions ceiling exists only as an anti-mistake guard (a child could type "444" into a stepper), not a cooking-physics constraint — a single constant is enough.
- Rollback must be possible: old ZIPs are not deleted from the deployed server until the new scheme is confirmed working; the change is a normal set of git commits, revertible like any other.

## Architecture

### Content delivery

Recipe `.txt` files (and their `# tags/photo/portions/type/ingredients` header) stay in `content/recipes/*.txt`, in the same header + numbered-steps format used today. Instead of being zipped by a manually-run script, they are embedded into the JS bundle at build time via Vite's `import.meta.glob('/content/recipes/*.txt', { eager: true, as: 'raw' })`. Editing a recipe becomes: edit the `.txt` file, run the normal deploy — no script, no version, no catalog edit.

Recipe photos (`content/media/*.webp`, currently copied into the ZIP by the build script) move to a plain static path served like any other app asset (e.g. `public/recipes/media/`), referenced by direct URL. They no longer go through the ZIP-install → IndexedDB blob → `useTopicFile` blob-URL pipeline that other topics use.

### The reading engine still sees a "topic"

`follow_instruction` mode, per-step `{N|...}` quantity scaling (`InstructionTask`), and session-history tracking (`topicId`/`textId`/`modeId`) are shared infrastructure used by every reading topic (poems, short stories, recipes). Rebuilding that machinery for recipes alone is out of scope and unnecessary risk.

Instead, at app boot the app synthesizes an in-memory record shaped exactly like an installed topic record (`meta.id: 'reading_dad_texts'`, `meta.renderer: 'reading'`, `texts: [...]`) directly from the bundled recipe files — not from a downloaded/installed ZIP. This record is injected into the same `topicRecords` collection the rest of the app already reads (`loadAllRecipes()` in `plannerApi.js` and the reading renderer keep working unmodified against it), but:

- It is excluded from `TopicCatalogScreen`'s catalog listing and from Home's topic picker (no visible entry, no install/claim UI).
- It carries no "installed via ZIP" provenance — no claim/access (free/paid) logic applies, since it's not a product, it's a Planner implementation detail.
- Its `texts[].photo` / `texts[].image` paths point at the new static `public/recipes/media/` URLs; the reading renderer's file-loading hook is adjusted so this one synthetic topic bypasses the IndexedDB blob lookup and resolves straight to that URL (other topics are untouched).

### Portions data model

Recipe header keeps `# tags:`, `# photo:`, `# status:`, `# ingredients:` unchanged. Replaces:

- `# portions: N` — stays, single source of truth for the serving count (base for scalable recipes, fixed batch size for fixed recipes).
- `# fixed_portions: N` and `# max_portions: N` — removed. A new optional `# type: fixed` marks a recipe as a locked batch (stepper hidden, ingredients used as authored). Absence of `# type:` means `per_portion` (default): stepper scales from 1 to a single global constant (`GLOBAL_MAX_PORTIONS = 8`, defined once in code, not per recipe).

`recipeParser.js`'s `parseRecipeMetadata` return value changes from `{ fixedPortions, maxPortions }` to a single `type: 'per_portion' | 'fixed'` (or an equivalent `isFixed` boolean — exact shape decided during implementation), plus the exported `GLOBAL_MAX_PORTIONS` constant used everywhere a stepper bound is needed (`AddToPlanSheet` in `PlannerMenuScreen.jsx`, and the reading renderer's own portions-resolution logic).

### Content migration (27 files)

- 7 files currently using `# fixed_portions: N` (`soup.txt`, `kompot.txt`, `lemonade.txt`, `kotlety.txt`, `stuffed_eggs.txt`, `pasta_meat.txt`, `coffee_chemex.txt`) — replace the `fixed_portions:` line with `# type: fixed`, drop any `max_portions:` line, keep `portions: N` unchanged.
- The other 20 files — drop the `# max_portions: N` line entirely; no `type:` line needed (defaults to `per_portion`).

### What gets deleted

- `scripts/update-recipes-deck.mjs` (the ZIP-build pipeline).
- `scripts/generate-reading-dad-texts.mjs` (already-dead legacy script that built the original v1.14.0 ZIP — confirmed unreferenced elsewhere).
- The `reading_dad_texts` entry in `public/decks/catalog.json`.
- The `reading_dad_texts` entry in `CATALOG_CATEGORIES` (`src/features/topics/TopicCatalogScreen.jsx`).
- The already-deployed `public/decks/reading_dad_texts_v*.zip` files are **not** deleted from the production server in this change — only stop being referenced. Physical deletion happens later, once the new scheme is confirmed working in production, as a separate cleanup step.

### Existing installed users

Users who already "installed" the old ZIP-based `reading_dad_texts` topic have it sitting in IndexedDB. On first load after the update:

- The synthetic record keeps the same `topicId` (`reading_dad_texts`) so existing session history (`isRecipeCookedThisCycle`, "Было занятие" badges) keeps resolving correctly by `topicId`/`textId`.
- The old installed-via-ZIP copy of this specific topic is removed from the local install index (`installedTopicIds` / IndexedDB `topics` store) on boot, so `loadAllRecipes()` doesn't see two conflicting copies of the same topic when scanning `topicRecords`.
- No other installed topic's data is touched by this cleanup — it targets only the `reading_dad_texts` id.

### Rollback

Every change here is an ordinary git commit (content file edits, script deletion, `catalog.json`/`TopicCatalogScreen.jsx` edits). Reverting the commit(s) and redeploying fully restores the old ZIP-based pipeline, since the old ZIPs remain physically present in the repo and on the server until a later, separate cleanup. The only non-code state is the local per-user cleanup of the old installed IndexedDB copy — this is additive/idempotent (safe to run again) and doesn't delete any other user data, so it does not block a rollback.

## Testing

- `recipeParser.test.js` — replace `fixedPortions`/`maxPortions` test cases with `type`/`GLOBAL_MAX_PORTIONS` equivalents.
- `plannerUtils.test.js` — update fixtures that reference the old `fixedPortions`/`maxPortions` shape.
- Manual verification via dev server: portions stepper caps at the global max for a `per_portion` recipe, a `fixed` recipe shows the locked "готовим N" with no stepper, a recipe is cookable end-to-end from Меню with correct photo display, the recipe topic no longer appears in Home's topic picker or the catalog, and an existing session history entry for a previously-cooked recipe still shows "Было занятие".

## Out of scope

- Any change to the reading/`follow_instruction` engine's internals (step display, `{N|...}` scaling math, TTS).
- The client-side "user-created recipes" mechanism (`getUserRecipes`/`createUserRecipe` in `groupStore.js`) — unrelated parallel feature, untouched.
- Physically deleting the old deployed ZIP files from the production server (separate follow-up cleanup once the new scheme is confirmed stable).
