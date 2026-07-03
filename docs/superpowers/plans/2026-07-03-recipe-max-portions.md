# Recipe max_portions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 20-portion cap (and the Planner's *missing* cap) with a per-recipe `max_portions` limit, and unify the two different "portions" semantics (absolute serving count vs. hidden multiplier) that currently coexist in the codebase into one.

**Architecture:** A new `# max_portions: N` header key is parsed by both existing recipe-metadata parsers (`recipeParser.js` for the Planner's live re-parsing, `update-recipes-deck.mjs` for the deployed topic manifest). Both portions steppers (`RecipeStartParams` in `ParamsScreen.jsx`, `AddToPlanSheet` in `PlannerMenuScreen.jsx`) read the same field and clamp to it. The cook-start screen's stepper switches from a "1x/2x/3x..." multiplier to the same absolute-serving-count semantics the Planner already uses; the only place a multiplier still exists is deep inside `InstructionTask` (`reading/index.jsx`), computed once, immediately before scaling step text.

**Tech Stack:** React 19, Zustand, Vite, Vitest, a standalone Node build script (JSZip).

## Global Constraints

- New header key: `# max_portions: N` — parsed like the existing `# fixed_portions: N`. Default when absent: **4**.
- `fixed_portions` recipes are unaffected — their stepper is already hidden and stays hidden; `max_portions` is meaningless for them.
- The absolute serving count (matching the recipe's own `# portions:`) is the single semantic used everywhere except one internal calculation inside `InstructionTask` — never introduce a second "multiplier" concept anywhere else.
- Running `scripts/update-recipes-deck.mjs` for real overwrites `public/decks/catalog.json` and writes a new deck ZIP unconditionally — never run it against the real repo paths except in the final, explicitly-confirmed release task.

---

### Task 1: `recipeParser.js` — parse `max_portions`

**Files:**
- Modify: `src/features/planner/recipeParser.js`
- Modify: `src/features/planner/recipeParser.test.js`

**Interfaces:**
- Produces: `parseRecipeMetadata(content)` now also returns `maxPortions: number` (default `4` when the header key is absent or non-numeric).

- [ ] **Step 1: Write the failing tests**

Add to `src/features/planner/recipeParser.test.js`, right after the existing `fixedPortions` tests (after the `it('defaults fixedPortions to null when absent', ...)` block, before the ingredient tests):

```js
  it('extracts max_portions as integer', () => {
    const { maxPortions } = parseRecipeMetadata('# max_portions: 8\nТест\n');
    expect(maxPortions).toBe(8);
  });

  it('defaults maxPortions to 4 when absent', () => {
    const { maxPortions } = parseRecipeMetadata('# portions: 4\nТест\n');
    expect(maxPortions).toBe(4);
  });

  it('defaults maxPortions to 4 when the value is not a number', () => {
    const { maxPortions } = parseRecipeMetadata('# max_portions: many\nТест\n');
    expect(maxPortions).toBe(4);
  });
```

Also update the `'parses full realistic header'` test's assertions to check `maxPortions` defaults correctly when the sample header doesn't set it — add this line right after the existing `expect(result.status).toBe('final');` line:

```js
    expect(result.maxPortions).toBe(4);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/planner/recipeParser.test.js`
Expected: FAIL — `maxPortions` is `undefined`, not `8`/`4`.

- [ ] **Step 3: Implement `maxPortions` parsing**

In `src/features/planner/recipeParser.js`, replace:

```js
export function parseRecipeMetadata(content) {
  const lines = content.split('\n');
  const tags = [];
  let portions = 1;
  let fixedPortions = null;
  let status = 'draft';
  const ingredients = [];
  let inIngredients = false;
```

with:

```js
export function parseRecipeMetadata(content) {
  const lines = content.split('\n');
  const tags = [];
  let portions = 1;
  let fixedPortions = null;
  let maxPortions = 4;
  let status = 'draft';
  const ingredients = [];
  let inIngredients = false;
```

Then replace:

```js
    const kv = afterHash.trim();
    if (kv.startsWith('tags:')) {
      const raw = kv.slice(5).trim();
      tags.push(...raw.split(',').map((t) => t.trim()).filter(Boolean));
    } else if (kv.startsWith('fixed_portions:')) {
      fixedPortions = parseInt(kv.slice(15).trim(), 10) || null;
    } else if (kv.startsWith('portions:')) {
      portions = parseInt(kv.slice(9).trim(), 10) || 1;
    } else if (kv.startsWith('status:')) {
      status = kv.slice(7).trim() === 'final' ? 'final' : 'draft';
    } else if (kv === 'ingredients:') {
      inIngredients = true;
    }
  }

  return { tags, portions, fixedPortions, status, ingredients };
}
```

with:

```js
    const kv = afterHash.trim();
    if (kv.startsWith('tags:')) {
      const raw = kv.slice(5).trim();
      tags.push(...raw.split(',').map((t) => t.trim()).filter(Boolean));
    } else if (kv.startsWith('fixed_portions:')) {
      fixedPortions = parseInt(kv.slice(15).trim(), 10) || null;
    } else if (kv.startsWith('max_portions:')) {
      maxPortions = parseInt(kv.slice(13).trim(), 10) || 4;
    } else if (kv.startsWith('portions:')) {
      portions = parseInt(kv.slice(9).trim(), 10) || 1;
    } else if (kv.startsWith('status:')) {
      status = kv.slice(7).trim() === 'final' ? 'final' : 'draft';
    } else if (kv === 'ingredients:') {
      inIngredients = true;
    }
  }

  return { tags, portions, fixedPortions, maxPortions, status, ingredients };
}
```

Also update the file's header doc comment — replace:

```js
 * fixed_portions marks recipes that are cooked as one inherent batch
 * (e.g. a pot of soup) — ingredient quantities can't be scaled below it.
 *
 * status is 'final' or 'draft' — anything else (including missing) is
 * treated as 'draft', so an unmarked recipe is flagged rather than
 * silently assumed ready.
```

with:

```js
 * fixed_portions marks recipes that are cooked as one inherent batch
 * (e.g. a pot of soup) — ingredient quantities can't be scaled below it.
 *
 * max_portions caps how far the portions stepper can go for this dish
 * (e.g. a single-pan dish shouldn't scale to 20 servings). Defaults to 4
 * when absent.
 *
 * status is 'final' or 'draft' — anything else (including missing) is
 * treated as 'draft', so an unmarked recipe is flagged rather than
 * silently assumed ready.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/planner/recipeParser.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/recipeParser.js src/features/planner/recipeParser.test.js
git commit -m "feat(planner): parse per-recipe max_portions, default 4"
```

---

### Task 2: Content edits — `mushroom_soup.txt`, `coffee_chemex.txt`

**Files:**
- Modify: `content/recipes/mushroom_soup.txt`
- Modify: `content/recipes/coffee_chemex.txt`

**Interfaces:** none (content-only; proves the parsing built in Task 1 and Task 3 against two real recipes).

- [ ] **Step 1: Add `max_portions` to `mushroom_soup.txt`**

Current header:

```
# photo: mushroom_soup.webp
# status: draft
# tags: обед, ужин
# portions: 4
# ingredients:
```

Replace with:

```
# photo: mushroom_soup.webp
# status: draft
# tags: обед, ужин
# portions: 4
# max_portions: 8
# ingredients:
```

- [ ] **Step 2: Convert `coffee_chemex.txt` to `fixed_portions` and fix the tags typo**

Current header:

```
# photo: coffee_chemex.webp
# status: draft
# tags: напиток, завтрак
# portions: 1
# ingredients:
```

Replace with:

```
# photo: coffee_chemex.webp
# status: draft
# tags: напитки, завтрак
# portions: 1
# fixed_portions: 1
# ingredients:
```

(`напиток` → `напитки` fixes a pre-existing typo — the singular form never matched the `напитки` tab filter used everywhere else in the Рецепты browser, so this recipe was invisible under that tab.)

- [ ] **Step 3: Verify with the Planner's live parser**

Run:

```bash
node -e "
const { parseRecipeMetadata } = await import('./src/features/planner/recipeParser.js');
const fs = require('fs');
console.log('mushroom_soup:', JSON.stringify(parseRecipeMetadata(fs.readFileSync('content/recipes/mushroom_soup.txt', 'utf-8'))).slice(0, 200));
console.log('coffee_chemex:', JSON.stringify(parseRecipeMetadata(fs.readFileSync('content/recipes/coffee_chemex.txt', 'utf-8'))).slice(0, 200));
" --input-type=module
```

Expected output includes `"maxPortions":8` for mushroom_soup and `"fixedPortions":1,"maxPortions":4,"tags":["напитки","завтрак"]` for coffee_chemex.

- [ ] **Step 4: Commit**

```bash
git add content/recipes/mushroom_soup.txt content/recipes/coffee_chemex.txt
git commit -m "content(recipes): add max_portions to mushroom_soup, lock coffee_chemex to 1 portion"
```

---

### Task 3: `scripts/update-recipes-deck.mjs` — bake `portions`/`max_portions` into the manifest

**Files:**
- Modify: `scripts/update-recipes-deck.mjs`

**Interfaces:**
- Produces: each entry in the built `topic.json`'s `texts` array now always has a numeric `portions` field, and a `maxPortions` field when the recipe's header sets one (same conditional-inclusion pattern as `fixedPortions`/`status`).

**⚠️ Do not run this script against the real repo in this task.** It unconditionally overwrites `public/decks/catalog.json` and writes a new deck ZIP under `public/decks/`. Verification here uses a throwaway copy of just the parsing logic — the real run happens in Task 8, deliberately, after bumping version constants.

- [ ] **Step 1: Update `KNOWN_META_PREFIXES` and `extractMeta`**

In `scripts/update-recipes-deck.mjs`, replace:

```js
const KNOWN_META_PREFIXES = ["en:", "photo:", "fixed_portions:", "status:", "tags:", "portions:", "ingredients:"];

function extractMeta(txt) {
  const lines = txt.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  let ru = "", en = "", photo = "", fixedPortions = null, status = null;
  for (const line of lines) {
    if (line.startsWith("# en:"))                 { en            = line.slice(5).trim(); }
    else if (line.startsWith("# photo:"))          { photo         = line.slice(8).trim(); }
    else if (line.startsWith("# fixed_portions:")) { fixedPortions = parseInt(line.slice(17).trim()) || null; }
    else if (line.startsWith("# status:"))         { status        = line.slice(9).trim(); }
    else if (!line.startsWith("#") && !line.startsWith("[") && !ru) { ru = line; }
  }
  return { ru, en: en || ru, photo, fixedPortions, status };
}
```

with:

```js
const KNOWN_META_PREFIXES = ["en:", "photo:", "fixed_portions:", "max_portions:", "status:", "tags:", "portions:", "ingredients:"];

function extractMeta(txt) {
  const lines = txt.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  let ru = "", en = "", photo = "", portions = 1, fixedPortions = null, maxPortions = null, status = null;
  for (const line of lines) {
    if (line.startsWith("# en:"))                 { en            = line.slice(5).trim(); }
    else if (line.startsWith("# photo:"))          { photo         = line.slice(8).trim(); }
    else if (line.startsWith("# fixed_portions:")) { fixedPortions = parseInt(line.slice(17).trim()) || null; }
    else if (line.startsWith("# max_portions:"))   { maxPortions   = parseInt(line.slice(15).trim()) || null; }
    else if (line.startsWith("# portions:"))       { portions      = parseInt(line.slice(11).trim()) || 1; }
    else if (line.startsWith("# status:"))         { status        = line.slice(9).trim(); }
    else if (!line.startsWith("#") && !line.startsWith("[") && !ru) { ru = line; }
  }
  return { ru, en: en || ru, photo, portions, fixedPortions, maxPortions, status };
}
```

- [ ] **Step 2: Update the manifest-building loop**

Replace:

```js
  const { ru, en, photo, fixedPortions, status } = extractMeta(content);
  const title = { ru, en: en || ru };
  const hasSvg = existsSync(`${MEDIA_DIR}/${id}.svg`) || !!oldZip.file(`media/${id}.svg`);
```

with:

```js
  const { ru, en, photo, portions, fixedPortions, maxPortions, status } = extractMeta(content);
  const title = { ru, en: en || ru };
  const hasSvg = existsSync(`${MEDIA_DIR}/${id}.svg`) || !!oldZip.file(`media/${id}.svg`);

  const effectiveMax = maxPortions ?? 4;
  if (!fixedPortions && effectiveMax < portions) {
    console.warn(`⚠️  ${id}: max_portions (${effectiveMax}) < portions (${portions}) — stepper would be locked at one value. Add "# max_portions: N" above ${portions} in ${id}.txt.`);
  }
```

Then replace:

```js
  textsManifest.push({
    id: `${id}_instruction`,
    kind: "instruction",
    title,
    ...(hasSvg         ? { image: `media/${id}.svg` } : {}),
    ...(photoPath      ? { photo: photoPath }          : {}),
    ...(fixedPortions  ? { fixedPortions }              : {}),
    ...(status         ? { status }                     : {}),
    file: `recipes/${id}.txt`,
    stepCount: steps,
  });
```

with:

```js
  textsManifest.push({
    id: `${id}_instruction`,
    kind: "instruction",
    title,
    ...(hasSvg         ? { image: `media/${id}.svg` } : {}),
    ...(photoPath      ? { photo: photoPath }          : {}),
    portions,
    ...(fixedPortions  ? { fixedPortions }              : {}),
    ...(maxPortions    ? { maxPortions }                : {}),
    ...(status         ? { status }                     : {}),
    file: `recipes/${id}.txt`,
    stepCount: steps,
  });
```

- [ ] **Step 3: Verify the parsing logic in isolation (no real script run)**

Create a throwaway verification file at
`C:\Users\dmazn\AppData\Local\Temp\claude\c--Users-dmazn-Projects-Mirocard2\292c5921-2c4e-4d72-9d8b-faa9a0ba1494\scratchpad\verify-extractMeta.mjs`:

```js
import { readFileSync } from "node:fs";

// Copied from the updated extractMeta in scripts/update-recipes-deck.mjs —
// verifying the parsing logic without touching public/decks/*.
function extractMeta(txt) {
  const lines = txt.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  let ru = "", en = "", photo = "", portions = 1, fixedPortions = null, maxPortions = null, status = null;
  for (const line of lines) {
    if (line.startsWith("# en:"))                 { en            = line.slice(5).trim(); }
    else if (line.startsWith("# photo:"))          { photo         = line.slice(8).trim(); }
    else if (line.startsWith("# fixed_portions:")) { fixedPortions = parseInt(line.slice(17).trim()) || null; }
    else if (line.startsWith("# max_portions:"))   { maxPortions   = parseInt(line.slice(15).trim()) || null; }
    else if (line.startsWith("# portions:"))       { portions      = parseInt(line.slice(11).trim()) || 1; }
    else if (line.startsWith("# status:"))         { status        = line.slice(9).trim(); }
    else if (!line.startsWith("#") && !line.startsWith("[") && !ru) { ru = line; }
  }
  return { ru, en: en || ru, photo, portions, fixedPortions, maxPortions, status };
}

for (const id of ["mushroom_soup", "coffee_chemex", "soup", "fried_eggs"]) {
  const content = readFileSync(`content/recipes/${id}.txt`, "utf-8");
  console.log(id, extractMeta(content));
}
```

Run: `cd "C:\Users\dmazn\Projects\Mirocard2" && node "C:\Users\dmazn\AppData\Local\Temp\claude\c--Users-dmazn-Projects-Mirocard2\292c5921-2c4e-4d72-9d8b-faa9a0ba1494\scratchpad\verify-extractMeta.mjs"`

Expected:
- `mushroom_soup` → `portions: 4, fixedPortions: null, maxPortions: 8`
- `coffee_chemex` → `portions: 1, fixedPortions: 1, maxPortions: null`
- `soup` → `portions: 6, fixedPortions: 6, maxPortions: null` (untouched fixed-portions recipe, unaffected)
- `fried_eggs` → `portions: 1, fixedPortions: null, maxPortions: null` (untouched recipe with no explicit max — `effectiveMax` will default to 4 downstream, no warning since `4 >= 1`)

- [ ] **Step 4: Commit**

```bash
git add scripts/update-recipes-deck.mjs
git commit -m "feat(recipes): bake portions/max_portions into the deck manifest, warn if max < base"
```

---

### Task 4: `ParamsScreen.jsx` — unify `RecipeStartParams` to absolute portions

**Files:**
- Modify: `src/features/session/ParamsScreen.jsx:26-86`

**Interfaces:**
- Consumes: `activeText.portions` (base serving count, now always present per Task 3), `activeText.maxPortions` (present only when the recipe sets it, per Task 3's conditional-inclusion pattern — read with `?? 4`).
- No change to `RecipeStartParams`'s own props or its caller.

- [ ] **Step 1: Update the component**

Replace:

```jsx
function RecipeStartParams({ topicId, activeText, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const { markSessionStart } = useTimer();
  const fixedPortions = activeText.fixedPortions ?? null;
  const [portions, setPortions] = useState(1);

  useEffect(() => {
    let cancelled = false;
    getRecipeSettings(topicId).then((s) => { if (!cancelled) setPortions(s.portions ?? 1); }).catch(() => {});
    return () => { cancelled = true; };
  }, [topicId]);

  function startSession() {
    const finalPortions = fixedPortions || portions;
    setSessionPortionsOverride(finalPortions);
    saveRecipeSettings(topicId, { portions: finalPortions }).catch(() => {});
    markSessionStart();
    setScreen("session");
  }
```

with:

```jsx
function RecipeStartParams({ topicId, activeText, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const { markSessionStart } = useTimer();
  const fixedPortions = activeText.fixedPortions ?? null;
  const basePortions = activeText.portions ?? 1;
  const maxPortions = activeText.maxPortions ?? 4;
  const [portions, setPortions] = useState(basePortions);

  useEffect(() => {
    let cancelled = false;
    getRecipeSettings(topicId).then((s) => { if (!cancelled) setPortions(s.portions ?? basePortions); }).catch(() => {});
    return () => { cancelled = true; };
  }, [topicId, basePortions]);

  function startSession() {
    const finalPortions = fixedPortions || portions;
    setSessionPortionsOverride(finalPortions);
    saveRecipeSettings(topicId, { portions: finalPortions }).catch(() => {});
    markSessionStart();
    setScreen("session");
  }
```

(`startSession()`'s formula is unchanged — only what `portions` *means* changes, from "multiplier defaulting to 1" to "absolute serving count defaulting to the recipe's own base".)

- [ ] **Step 2: Update the stepper's bounds**

Replace:

```jsx
            {fixedPortions
              ? <span className="all-texts-portions-fixed">готовим {fixedPortions}</span>
              : <div className="all-texts-portions">
                  <button className="all-texts-portions-btn" onClick={() => setPortions((p) => Math.max(1, p - 1))} disabled={portions <= 1}>−</button>
                  <span className="all-texts-portions-value">{portions}</span>
                  <button className="all-texts-portions-btn" onClick={() => setPortions((p) => Math.min(20, p + 1))} disabled={portions >= 20}>+</button>
                </div>
            }
```

with:

```jsx
            {fixedPortions
              ? <span className="all-texts-portions-fixed">готовим {fixedPortions}</span>
              : <div className="all-texts-portions">
                  <button className="all-texts-portions-btn" onClick={() => setPortions((p) => Math.max(1, p - 1))} disabled={portions <= 1}>−</button>
                  <span className="all-texts-portions-value">{portions}</span>
                  <button className="all-texts-portions-btn" onClick={() => setPortions((p) => Math.min(maxPortions, p + 1))} disabled={portions >= maxPortions}>+</button>
                </div>
            }
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint -- src/features/session/ParamsScreen.jsx` (or `npx eslint src/features/session/ParamsScreen.jsx`)
Expected: no new errors (the `useEffect` dependency array now correctly lists `basePortions`, so no missing-dependency warning).

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/features/session/ParamsScreen.jsx
git commit -m "feat(session): cook-start portions stepper uses absolute servings + per-recipe cap"
```

---

### Task 5: `reading/index.jsx` — compute the scaling factor from absolute portions

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx:433`

**Interfaces:**
- Consumes: `task.text?.portions` (base serving count, now always present per Task 3), `task.text?.fixedPortions`, `sessionPortionsOverride` and `settings.portions` (both now absolute serving counts per Task 4, no longer multipliers).
- Produces: the component's own `portions` state remains the scaling **factor** consumed by `applyPortions()` — its meaning is unchanged from the reader's perspective (still "1 = as authored"), only how it's computed changes.

- [ ] **Step 1: Update the factor computation**

Replace:

```js
      setPortions(task.text?.fixedPortions ?? sessionPortionsOverride ?? settings.portions ?? 1);
```

with:

```js
      const basePortions = task.text?.portions ?? 1;
      const chosenAbsolute = task.text?.fixedPortions ?? sessionPortionsOverride ?? settings.portions ?? basePortions;
      setPortions(task.text?.fixedPortions ? chosenAbsolute : chosenAbsolute / basePortions);
```

(For `fixed_portions` recipes, `chosenAbsolute` is passed straight through exactly as before — their step text never uses the `{N|...}` scaling templates, so this is behavior-neutral for them. For everything else, the factor is now correctly `chosen / base` instead of treating the chosen absolute count as if it were already a multiplier.)

- [ ] **Step 2: Lint and build**

Run: `npx eslint src/topics/renderers/reading/index.jsx`
Expected: no new errors introduced by this change (pre-existing unrelated warnings/errors in this file are out of scope — see Global Constraints of the earlier menu-selection plan for context on those).

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/reading/index.jsx
git commit -m "fix(reading): derive instruction-text scaling factor from absolute portions"
```

---

### Task 6: `PlannerMenuScreen.jsx` — cap `AddToPlanSheet`'s stepper

**Files:**
- Modify: `src/features/planner/PlannerMenuScreen.jsx`

**Interfaces:**
- Consumes: `parseRecipeMetadata(content).maxPortions` (from Task 1, always a number, default 4).
- Produces: the recipe objects built in the loading effect now carry `maxPortions`, consumed by `AddToPlanSheet`.

- [ ] **Step 1: Add `maxPortions` to the loaded recipe object**

Replace:

```js
          const { tags, ingredients, portions, fixedPortions, status } = parseRecipeMetadata(content);
          all.push({ topicId: record.meta.id, text, tags, ingredients, portions, fixedPortions, status });
```

with:

```js
          const { tags, ingredients, portions, fixedPortions, maxPortions, status } = parseRecipeMetadata(content);
          all.push({ topicId: record.meta.id, text, tags, ingredients, portions, fixedPortions, maxPortions, status });
```

- [ ] **Step 2: Read `maxPortions` in `AddToPlanSheet` and cap the stepper**

Replace:

```js
function AddToPlanSheet({ recipe, plan, initialDayIndex = 0, initialMealType = null, initialPortions = null, onAddDay, onConfirm, onClose }) {
  const { fixedPortions } = recipe;
```

with:

```js
function AddToPlanSheet({ recipe, plan, initialDayIndex = 0, initialMealType = null, initialPortions = null, onAddDay, onConfirm, onClose }) {
  const { fixedPortions, maxPortions } = recipe;
```

Then replace:

```jsx
              <button type="button" onClick={() => setPortions((p) => p + 1)} aria-label="Больше порций">+</button>
```

with:

```jsx
              <button type="button" onClick={() => setPortions((p) => Math.min(maxPortions, p + 1))} aria-label="Больше порций">+</button>
```

- [ ] **Step 3: Lint and build**

Run: `npx eslint src/features/planner/PlannerMenuScreen.jsx`
Expected: no errors.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Run the planner test suite**

Run: `npx vitest run src/features/planner`
Expected: PASS (this task doesn't touch `plannerUtils.js` or its tests — this run just confirms nothing else in the directory broke).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/PlannerMenuScreen.jsx
git commit -m "feat(planner): cap AddToPlanSheet's portions stepper at the recipe's max_portions"
```

---

### Task 7: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background), confirm `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/` returns `200`.

- [ ] **Step 2: Temporarily expose the store and DB helpers for seeding**

This verification needs to inject synthetic recipes without a real content-pack download. Add a temporary dev-only hook to `src/main.jsx` — find:

```js
window.__Mirocard = { React, ReactDOM, jsxRuntime };
```

and change it to:

```js
window.__Mirocard = { React, ReactDOM, jsxRuntime };
if (import.meta.env.DEV) {
  const { useAppStore } = await import("./core/store.js");
  const { getDb, topics } = await import("./core/db.js");
  window.__store = useAppStore;
  window.__db = { getDb, topics };
}
```

This is temporary — it must be reverted in Step 6, never committed.

- [ ] **Step 3: Write and run the seeding + verification script**

Create `C:\Users\dmazn\AppData\Local\Temp\claude\c--Users-dmazn-Projects-Mirocard2\292c5921-2c4e-4d72-9d8b-faa9a0ba1494\scratchpad\verify-max-portions.mjs`:

```js
import pkg from 'file:///C:/Users/dmazn/AppData/Roaming/npm/node_modules/playwright/index.js';
const { chromium } = pkg;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (err) => console.log('PAGE ERROR:', String(err)));

await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
await page.waitForSelector('text=Без аккаунта', { timeout: 15000 }).catch(() => {});
if (await page.locator('text=Без аккаунта').count() > 0) {
  await page.click('text=Без аккаунта');
  await page.waitForTimeout(1000);
}
await page.click('text=Выбрать ученика');
await page.waitForTimeout(500);
if (await page.locator('text=ТестПорции').count() === 0) {
  await page.click('text=Добавить ученика');
  await page.waitForTimeout(500);
  await page.fill('input[placeholder="Имя ученика"]', 'ТестПорции');
  await page.click('text=Сохранить');
  await page.waitForTimeout(1000);
}
await page.click('text=ТестПорции');
await page.waitForTimeout(1000);

await page.evaluate(() => {
  const s = window.__store;
  const account = s.getState().account ?? { email: 'local', displayName: 'Локальный режим' };
  s.getState().setAccount({ ...account, featureFlags: ['planner'] });
});

// Seed three recipes: scaling (4 base / 8 max), fixed (locked), default (no max_portions).
await page.evaluate(async () => {
  const { getDb, topics } = window.__db;
  const db = await getDb();
  const topicId = 'test_portions';
  const scaleTxt = `# portions: 4\n# max_portions: 8\n# tags: обед\n# ingredients:\n#   вода | 2 | стакана\nМасштабируемый рецепт\n\n1. Добавить {2|стакан|стакана|стаканов} воды.\n`;
  const fixedTxt = `# portions: 1\n# fixed_portions: 1\n# tags: обед\n# ingredients:\n#   соль | |\nФиксированный рецепт\n\n1. Готово.\n`;
  const defaultTxt = `# portions: 1\n# tags: обед\n# ingredients:\n#   соль | |\nРецепт без max_portions\n\n1. Готово.\n`;
  await topics.saveFile(db, topicId, 'scale.txt', new Blob([scaleTxt], { type: 'text/plain' }));
  await topics.saveFile(db, topicId, 'fixed.txt', new Blob([fixedTxt], { type: 'text/plain' }));
  await topics.saveFile(db, topicId, 'default.txt', new Blob([defaultTxt], { type: 'text/plain' }));
  const record = {
    meta: { id: topicId, renderer: 'reading', title: { ru: 'Тест порций' } },
    texts: [
      { id: 'scale_test', kind: 'instruction', file: 'scale.txt', title: { ru: 'Масштабируемый рецепт' }, photo: null, portions: 4, maxPortions: 8 },
      { id: 'fixed_test', kind: 'instruction', file: 'fixed.txt', title: { ru: 'Фиксированный рецепт' }, photo: null, portions: 1, fixedPortions: 1 },
      { id: 'default_test', kind: 'instruction', file: 'default.txt', title: { ru: 'Рецепт без max_portions' }, photo: null, portions: 1 },
    ],
    modes: [
      { id: 'follow_instruction', type: 'follow_instruction', evaluation: 'none', ui: { title: 'Показать инструкцию' } },
    ],
  };
  window.__store.getState().upsertTopicRecord(record);
});
await page.waitForTimeout(500);

await page.click('text=Планировщик');
await page.waitForTimeout(500);
await page.click('text=Рецепты');
await page.waitForTimeout(1000);

// ── scale_test: cook-start screen starts at base (4), caps at max (8) ──────
await page.locator('.recipe-gallery-card', { hasText: 'Масштабируемый рецепт' }).locator('.recipe-gallery-card__cook-btn').click();
await page.waitForTimeout(800);
console.log('scale_test initial portions (expect 4):', await page.locator('.all-texts-portions-value').innerText());
for (let i = 0; i < 6; i++) await page.locator('.all-texts-portions-btn', { hasText: '+' }).click();
console.log('scale_test after 6x tapping + (expect 8, capped):', await page.locator('.all-texts-portions-value').innerText());
console.log('+ button disabled at cap:', await page.locator('.all-texts-portions-btn', { hasText: '+' }).isDisabled());

// Now start cooking at 8 (2x the base of 4) — step text should double "2 стакана" to "4 стакана", not "16".
await page.locator('.params-start-phone .btn-primary, .params-info-start .btn-primary').first().click();
await page.waitForTimeout(800);
console.log('Instruction step text (expect "4 стакана", NOT "16"):', await page.locator('.instruction-step-text').innerText());
await page.locator('.instruction-close-btn').click();
await page.waitForTimeout(500);

await page.click('text=Планировщик');
await page.waitForTimeout(500);
await page.click('text=Рецепты');
await page.waitForTimeout(1000);

// ── fixed_test: no stepper on the cook-start screen ─────────────────────────
await page.locator('.recipe-gallery-card', { hasText: 'Фиксированный рецепт' }).locator('.recipe-gallery-card__cook-btn').click();
await page.waitForTimeout(800);
console.log('fixed_test shows locked label (expect "готовим 1"):', await page.locator('.all-texts-portions-fixed').innerText().catch(() => 'MISSING'));
console.log('fixed_test stepper count (expect 0):', await page.locator('.all-texts-portions').count());

await browser.close();
```

Run: `cd "C:\Users\dmazn\Projects\Mirocard2" && node "C:\Users\dmazn\AppData\Local\Temp\claude\c--Users-dmazn-Projects-Mirocard2\292c5921-2c4e-4d72-9d8b-faa9a0ba1494\scratchpad\verify-max-portions.mjs"`

Expected output:
```
scale_test initial portions (expect 4): 4
scale_test after 6x tapping + (expect 8, capped): 8
+ button disabled at cap: true
Instruction step text (expect "4 стакана", NOT "16"): Добавить 4 стакана воды.
fixed_test shows locked label (expect "готовим 1"): готовим 1
fixed_test stepper count (expect 0): 0
```

- [ ] **Step 4: Verify `AddToPlanSheet`'s cap matches**

Extend the same session (or a fresh script reusing the setup above): select `scale_test` in Рецепты (`+ Добавить`), open Меню, tap "Распределить" on it. Confirm `.add-sheet__stepper` starts at **4** and tapping `+` (`.add-sheet__stepper button` with text `+`) six times stops the displayed value (`.add-sheet__stepper-value`) at **8** — matching Step 3's cap exactly.

- [ ] **Step 5: Revert the temporary dev hook**

Undo Step 2's change to `src/main.jsx`. Confirm `git diff src/main.jsx` is empty.

- [ ] **Step 6: Full test suite**

Run: `npx vitest run src` (this project has an unrelated stray gitignored directory, `__codex_deploy_*`/`.codex-deploy-*`, that pollutes an unscoped `npx vitest run` — scoping to `src` avoids it, or use `--exclude "**/__codex_deploy_*/**" --exclude "**/.codex-deploy-*/**"` if it still gets picked up).
Expected: no new failures introduced by this plan's changes (pre-existing unrelated failures in `backend/tests`, `format.test.js`, `column_addition/engine.test.js` are not this plan's concern).

Run: `npm run build`
Expected: succeeds.

---

### Task 8: Ship the updated recipes deck (explicit release — requires confirmation)

**Files:**
- Modify: `scripts/update-recipes-deck.mjs:4-6` (version constants only, temporarily, for this run)

**⚠️ This task publishes new recipe content to production.** Confirm with the user before running the deploy step. This is the first time `update-recipes-deck.mjs` actually runs against the real repo in this plan — everything before this point only edited code and content files.

- [ ] **Step 1: Confirm the current live version**

Run: `grep -A2 '"id": "reading_dad_texts"' public/decks/catalog.json`
Expected: shows the currently-live version (e.g. `"version": "1.132.0"`) — this becomes `OLD_ZIP`/`OLD_VERSION` for this run. Confirm `public/decks/reading_dad_texts_v<that version>.zip` exists.

- [ ] **Step 2: Bump the version constants**

In `scripts/update-recipes-deck.mjs`, update the top three constants to point `OLD_ZIP` at the currently-live version confirmed in Step 1, and `NEW_ZIP`/`NEW_VERSION` at the next patch version:

```js
const OLD_ZIP = "public/decks/reading_dad_texts_v<CURRENT_LIVE_VERSION>.zip";
const NEW_ZIP = "public/decks/reading_dad_texts_v<CURRENT_LIVE_VERSION + 0.1.0>.zip";
const NEW_VERSION = "<CURRENT_LIVE_VERSION + 0.1.0>";
```

(Fill in the exact version numbers found in Step 1 — never reuse or overwrite the currently-live version's URL, per this project's topic-versioning rule.)

- [ ] **Step 3: Run the real build**

Run: `node scripts/update-recipes-deck.mjs`
Expected: logs each recipe processed, no `⚠️` warning lines (would indicate a `max_portions < portions` mismatch needing a fix first), ends with `Создан: public/decks/reading_dad_texts_v<NEW_VERSION>.zip (27 рецептов)` and `Обновлён catalog.json`.

- [ ] **Step 4: Inspect the produced manifest**

Run:
```bash
node -e "
const JSZip = require('jszip');
const fs = require('fs');
JSZip.loadAsync(fs.readFileSync('public/decks/reading_dad_texts_v<NEW_VERSION>.zip'))
  .then(z => z.file('topic.json').async('string'))
  .then(s => {
    const t = JSON.parse(s);
    const soup = t.texts.find(x => x.id === 'mushroom_soup_instruction');
    const coffee = t.texts.find(x => x.id === 'coffee_chemex_instruction');
    console.log('mushroom_soup:', soup.portions, soup.maxPortions, soup.fixedPortions);
    console.log('coffee_chemex:', coffee.portions, coffee.maxPortions, coffee.fixedPortions);
  });
"
```
Expected: `mushroom_soup: 4 8 undefined` and `coffee_chemex: 1 undefined 1`.

- [ ] **Step 5: Commit the version bump and manifest changes**

```bash
git add scripts/update-recipes-deck.mjs public/decks/catalog.json public/decks/reading_dad_texts_v<NEW_VERSION>.zip
git commit -m "content: release recipes deck v<NEW_VERSION> with max_portions"
```

- [ ] **Step 6: Deploy**

Follow this project's standard deploy flow (`git status --short`, `npm run deploy:prod`, `npm run deploy:verify`) per `CLAUDE.md` — the new deck ZIP and catalog.json are static assets served from `public/decks/`, picked up by the same frontend deploy.
