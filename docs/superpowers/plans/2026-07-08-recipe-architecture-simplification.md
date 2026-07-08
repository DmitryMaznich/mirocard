# Recipe Architecture Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the recipe library (`content/recipes/*.txt`) from the ZIP/catalog deck-packaging pipeline, make it Planner-only (no standalone catalog topic), and collapse the three-field portions model (`portions`/`max_portions`/`fixed_portions`) into two clean recipe types (`per_portion` / `fixed`).

**Architecture:** Recipe `.txt` files stay in `content/recipes/*.txt` in the same header+steps format, but are embedded into the JS bundle at build time via `import.meta.glob` instead of being manually zipped. At app boot, an in-memory record shaped exactly like an installed topic (`meta.renderer: 'reading'`, `texts: [...]`) is synthesized from these bundled files and merged into the app's existing `BUILTIN_TOPICS` list (the same mechanism already used for the `streak_tracker` topic) — no ZIP, no catalog entry, no install step. It is marked `meta.hidden: true` so it never appears in any topic picker; the only entry point is the Planner's Меню. Recipe photos/illustrations move from `content/media/` to `public/recipe-media/media/` as plain static files (not Vite-processed assets — this app builds as a single-file bundle via `vite-plugin-singlefile`, so binary images must stay outside Vite's asset pipeline to avoid being base64-inlined into the bundle).

**Tech Stack:** React + Vite 8 (`vite-plugin-singlefile`), Vitest, IndexedDB (via `src/core/db.js`/`topics`/`kv` helpers), Node.js one-off migration script.

## Global Constraints

- Full design context: `docs/superpowers/specs/2026-07-08-recipe-architecture-simplification-design.md`.
- Do not delete the already-deployed `public/decks/reading_dad_texts_v*.zip` files from the repo in this plan — only stop referencing them (catalog.json entry removed, build script deleted). Physical deletion is a separate later cleanup once the new scheme is confirmed stable in production.
- Do not touch the reading/`follow_instruction` engine's internals (step display, `{N|...}` scaling math, TTS) — only how it's fed content.
- Do not touch `src/features/planner/plannerUtils.js` or its tests — `resolveChosenPortions`/`buildSelectedIngredientsSummary` already operate purely on `fixedPortions`/`portions`, unaffected by this refactor.
- The recipe topic keeps the exact id `reading_dad_texts` throughout, so existing session history (`topicId`-keyed) keeps resolving correctly — never rename this id.
- Global portions ceiling for scalable recipes is the constant `8`, defined once in code (`GLOBAL_MAX_PORTIONS` in `recipeParser.js`) — never per-recipe.

---

### Task 1: `recipeParser.js` — `type` field, `photo` field, `GLOBAL_MAX_PORTIONS`

**Files:**
- Modify: `src/features/planner/recipeParser.js`
- Test: `src/features/planner/recipeParser.test.js`

**Interfaces:**
- Produces: `parseRecipeMetadata(content)` now returns `{ photo, tags, portions, fixedPortions, status, ingredients }` (drops `maxPortions`; `fixedPortions` is now derived from a `# type: fixed` header line instead of a separate `# fixed_portions: N` line, but keeps the same "number or null" shape all existing callers already expect). Also exports `GLOBAL_MAX_PORTIONS = 8`.

- [ ] **Step 1: Write the failing tests**

Open `src/features/planner/recipeParser.test.js` and replace the `max_portions`/`fixed_portions` test block (currently lines 28–52) with:

```js
  it('extracts photo filename', () => {
    const { photo } = parseRecipeMetadata('# photo: soup.webp\nТест\n');
    expect(photo).toBe('soup.webp');
  });

  it('defaults photo to null when absent', () => {
    const { photo } = parseRecipeMetadata('# portions: 2\nТест\n');
    expect(photo).toBeNull();
  });

  it('derives fixedPortions from type: fixed, using portions as the count', () => {
    const content = '# portions: 6\n# type: fixed\nТест\n';
    const { fixedPortions } = parseRecipeMetadata(content);
    expect(fixedPortions).toBe(6);
  });

  it('defaults fixedPortions to null when type is absent', () => {
    const { fixedPortions } = parseRecipeMetadata('# portions: 2\nТест\n');
    expect(fixedPortions).toBeNull();
  });

  it('defaults fixedPortions to null when type is not "fixed"', () => {
    const { fixedPortions } = parseRecipeMetadata('# portions: 2\n# type: per_portion\nТест\n');
    expect(fixedPortions).toBeNull();
  });

  it('derives fixedPortions correctly when type: fixed appears before portions:', () => {
    const content = '# type: fixed\n# portions: 4\nТест\n';
    const { fixedPortions } = parseRecipeMetadata(content);
    expect(fixedPortions).toBe(4);
  });

  it('exports a single global portions ceiling constant', () => {
    expect(GLOBAL_MAX_PORTIONS).toBe(8);
  });
```

Also update the import at the top of the test file:

```js
import { describe, it, expect } from 'vitest';
import { parseRecipeMetadata, GLOBAL_MAX_PORTIONS } from './recipeParser.js';
```

And in the `'parses full realistic header'` test near the bottom, replace:

```js
    const content = [
      '# photo: scramble_sausage.webp',
      '# status: final',
      '# tags: завтрак',
      '# portions: 2',
      '# ingredients:',
```

(unchanged) but replace the assertion `expect(result.maxPortions).toBe(4);` with:

```js
    expect(result.photo).toBe('scramble_sausage.webp');
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/features/planner/recipeParser.test.js`
Expected: FAIL — `photo`/`GLOBAL_MAX_PORTIONS` are undefined, `type:`-derived `fixedPortions` tests fail because the parser doesn't understand `# type:` yet.

- [ ] **Step 3: Rewrite `parseRecipeMetadata` and add `GLOBAL_MAX_PORTIONS`**

Replace the full contents of `src/features/planner/recipeParser.js` with:

```js
/**
 * Parses the metadata header of a Mirocard recipe .txt file.
 *
 * Expected header format (all lines start with #):
 *   # photo: filename.webp
 *   # status: final
 *   # tags: завтрак, обед
 *   # portions: 4
 *   # type: fixed
 *   # ingredients:
 *   #   продукт | количество | единица
 *   #   соль | |
 *
 * type: fixed marks a recipe cooked as one inherent batch (e.g. a pot of
 * soup) — its # portions: count is fixed, not a user choice, and ingredient
 * quantities can't be scaled below it. Absent (or any other value) means
 * the recipe scales per portion, up to GLOBAL_MAX_PORTIONS.
 *
 * status is 'final' or 'draft' — anything else (including missing) is
 * treated as 'draft', so an unmarked recipe is flagged rather than
 * silently assumed ready.
 *
 * Ingredient block ends at the first # line that is NOT indented,
 * or at the first non-# line.
 */

// Single global stepper ceiling for every scalable recipe (type absent) —
// a guard against a mistyped portions count, not a per-dish cooking
// constraint. See docs/superpowers/specs/2026-07-08-recipe-architecture-simplification-design.md.
export const GLOBAL_MAX_PORTIONS = 8;

export function parseRecipeMetadata(content) {
  const lines = content.split('\n');
  const tags = [];
  let photo = null;
  let portions = 1;
  let isFixedType = false;
  let status = 'draft';
  const ingredients = [];
  let inIngredients = false;

  for (const line of lines) {
    if (!line.startsWith('#')) {
      inIngredients = false;
      continue;
    }

    const afterHash = line.slice(1); // everything after the leading #

    if (inIngredients) {
      // Ingredient lines are indented with 2+ spaces: "#   product | qty | unit"
      // Metadata keys use a single space: "# status: final" — not ingredients
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const product = parts[0];
        if (product) {
          ingredients.push({
            product,
            qty: parts[1] ? parseFloat(parts[1]) || null : null,
            unit: parts[2] || null,
          });
        }
        continue;
      }
      inIngredients = false;
    }

    const kv = afterHash.trim();
    if (kv.startsWith('photo:')) {
      photo = kv.slice(6).trim() || null;
    } else if (kv.startsWith('tags:')) {
      const raw = kv.slice(5).trim();
      tags.push(...raw.split(',').map((t) => t.trim()).filter(Boolean));
    } else if (kv.startsWith('type:')) {
      isFixedType = kv.slice(5).trim() === 'fixed';
    } else if (kv.startsWith('portions:')) {
      portions = parseInt(kv.slice(9).trim(), 10) || 1;
    } else if (kv.startsWith('status:')) {
      status = kv.slice(7).trim() === 'final' ? 'final' : 'draft';
    } else if (kv === 'ingredients:') {
      inIngredients = true;
    }
  }

  return {
    photo,
    tags,
    portions,
    fixedPortions: isFixedType ? portions : null,
    status,
    ingredients,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/planner/recipeParser.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/recipeParser.js src/features/planner/recipeParser.test.js
git commit -m "feat(recipes): collapse portions model to type field + global max"
```

---

### Task 2: Migrate all 27 recipe `.txt` headers

**Files:**
- Modify: all 27 files in `content/recipes/*.txt`

**Interfaces:**
- Consumes: `parseRecipeMetadata` from Task 1 (understands `# type: fixed`, ignores unrecognized `# max_portions:`/`# fixed_portions:` lines harmlessly).
- Produces: no `# max_portions:` or `# fixed_portions:` lines remain anywhere in `content/recipes/`; exactly 7 files contain `# type: fixed`.

- [ ] **Step 1: Write and run a one-off migration script**

Create a temporary file (not committed) at the scratchpad path and run it once:

```js
// scratch: migrate-recipe-headers.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FIXED_FILES = [
  'coffee_chemex.txt', 'kompot.txt', 'lemonade.txt', 'kotlety.txt',
  'pasta_meat.txt', 'soup.txt', 'stuffed_eggs.txt',
];
const PER_PORTION_FILES = [
  'breakfast_champion.txt', 'cocoa.txt', 'chicken_wings.txt', 'chicken_potato_oven.txt',
  'buckwheat.txt', 'fried_eggs.txt', 'chicken.txt', 'fried_potatoes.txt',
  'cicchetti.txt', 'kislo_zelje.txt', 'mashed_potatoes.txt', 'oatmeal.txt',
  'mushroom_soup.txt', 'omelet.txt', 'pasta.txt', 'ravioli.txt',
  'scramble_sausage.txt', 'salad.txt', 'risotto_shrimp.txt', 'tea.txt',
];

const DIR = 'content/recipes';

for (const name of FIXED_FILES) {
  const path = `${DIR}/${name}`;
  let text = readFileSync(path, 'utf-8');
  text = text.replace(/^# fixed_portions:.*\n/m, '# type: fixed\n');
  text = text.replace(/^# max_portions:.*\n/m, '');
  writeFileSync(path, text);
  console.log(`fixed: ${name}`);
}

for (const name of PER_PORTION_FILES) {
  const path = `${DIR}/${name}`;
  let text = readFileSync(path, 'utf-8');
  text = text.replace(/^# max_portions:.*\n/m, '');
  writeFileSync(path, text);
  console.log(`per_portion: ${name}`);
}

console.log(`Done: ${FIXED_FILES.length + PER_PORTION_FILES.length} files migrated.`);
```

Run it from the repo root: `node <path-to-scratch-file>/migrate-recipe-headers.mjs`
Expected output: 27 lines logging each migrated file, ending with `Done: 27 files migrated.`

- [ ] **Step 2: Verify no old fields remain and exactly 7 files use type: fixed**

Run: `grep -rn "max_portions\|fixed_portions" content/recipes/ || echo "CLEAN"`
Expected: `CLEAN` (no matches).

Run: `grep -rl "# type: fixed" content/recipes/ | wc -l`
Expected: `7`

- [ ] **Step 3: Spot-check one file from each group**

Run: `sed -n '1,6p' content/recipes/soup.txt`
Expected:
```
# photo: soup.webp
# type: fixed
# status: final
# tags: обед, ужин
# portions: 6
# ingredients:
```

Run: `sed -n '1,4p' content/recipes/breakfast_champion.txt`
Expected:
```
# photo: breakfast_champion.webp
# status: draft
# tags: завтрак
# portions: 4
```
(no `type:` line, no `max_portions:` line)

- [ ] **Step 4: Delete the scratch migration script**

It was written outside the repo (scratchpad), so no cleanup commit is needed. If it was accidentally written inside the repo, delete it now and confirm `git status --short` shows no stray file.

- [ ] **Step 5: Commit the migrated recipe files**

```bash
git add content/recipes/
git commit -m "content(recipes): migrate portions headers to type: fixed / per_portion"
```

---

### Task 3: Update `parseRecipeMetadata` consumers (drop per-recipe `maxPortions`)

**Files:**
- Modify: `src/features/planner/plannerApi.js:74-87` (`loadAllRecipes`)
- Modify: `src/features/planner/PlannerMenuScreen.jsx` (imports, `PortionsPromptSheet`, `MealSlotSection`)
- Modify: `src/features/session/ParamsScreen.jsx` (imports, `RecipeStartParams`)

**Interfaces:**
- Consumes: `GLOBAL_MAX_PORTIONS` from `src/features/planner/recipeParser.js` (Task 1).
- Produces: no code anywhere reads `recipe.maxPortions` or `activeText.maxPortions` any more — every portions stepper upper bound comes from the imported constant.

- [ ] **Step 1: Update `plannerApi.js`'s `loadAllRecipes`**

In `src/features/planner/plannerApi.js`, find (around line 82-83):

```js
      const { tags, ingredients, portions, fixedPortions, maxPortions, status } = parseRecipeMetadata(content);
      all.push({ topicId: record.meta.id, text, tags, ingredients, portions, fixedPortions, maxPortions, status });
```

Replace with:

```js
      const { tags, ingredients, portions, fixedPortions, status } = parseRecipeMetadata(content);
      all.push({ topicId: record.meta.id, text, tags, ingredients, portions, fixedPortions, status });
```

- [ ] **Step 2: Update `PlannerMenuScreen.jsx` imports**

Find the import block at the top (around line 6-14) and add a new import line right after the `plannerUtils.js` import:

```js
import {
  createPlan, isRecipeSelected, selectRecipe, deselectRecipe,
  setMealAssignment, setSelectedPortions, resolveChosenPortions,
  setIngredientDecision, buildSelectedIngredientsSummary, isMenuFullyDecided,
  needsMealMismatchWarning,
  MEAL_TYPES, RECIPE_TAGS,
} from './plannerUtils.js';
import { GLOBAL_MAX_PORTIONS } from './recipeParser.js';
import { loadPlan, savePlan, sendPlanToStudent, loadAllRecipes, PANTRY_ITEMS } from './plannerApi.js';
```

- [ ] **Step 3: Update `PortionsPromptSheet`**

Find (around line 182-184):

```js
function PortionsPromptSheet({ recipe, onConfirm, onClose }) {
  const { maxPortions } = recipe;
  // Always starts at 1, regardless of the recipe's own base "portions"
```

Replace with:

```js
function PortionsPromptSheet({ recipe, onConfirm, onClose }) {
  // Always starts at 1, regardless of the recipe's own base "portions"
```

Then find the two stepper bound usages (around lines 207-208):

```js
            disabled={portions >= maxPortions}
            onClick={() => setPortions((p) => Math.min(maxPortions, p + 1))}
```

Replace with:

```js
            disabled={portions >= GLOBAL_MAX_PORTIONS}
            onClick={() => setPortions((p) => Math.min(GLOBAL_MAX_PORTIONS, p + 1))}
```

- [ ] **Step 4: Update `MealSlotSection`**

Find (around line 323):

```js
            const { fixedPortions, portions: basePortions, maxPortions } = recipe;
```

Replace with:

```js
            const { fixedPortions, portions: basePortions } = recipe;
```

Then find the stepper bound usage (around line 346-347):

```js
                        disabled={chosenPortions >= maxPortions}
                        onClick={() => onSetPortions(textId, Math.min(maxPortions, chosenPortions + 1))}
```

Replace with:

```js
                        disabled={chosenPortions >= GLOBAL_MAX_PORTIONS}
                        onClick={() => onSetPortions(textId, Math.min(GLOBAL_MAX_PORTIONS, chosenPortions + 1))}
```

- [ ] **Step 5: Update `ParamsScreen.jsx`**

Add an import near the top (after the `InstructionParamsContent` import, around line 19):

```js
import InstructionParamsContent from "@/features/reading/InstructionParamsContent";
import { GLOBAL_MAX_PORTIONS } from "@/features/planner/recipeParser.js";
```

Find (around line 25-31):

```js
function RecipeStartParams({ topicId, activeText, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const { markSessionStart } = useTimer();
  const fixedPortions = activeText.fixedPortions ?? null;
  const basePortions = activeText.portions ?? 1;
  const maxPortions = activeText.maxPortions ?? 4;
  const [portions, setPortions] = useState(basePortions);
```

Replace with:

```js
function RecipeStartParams({ topicId, activeText, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const { markSessionStart } = useTimer();
  const fixedPortions = activeText.fixedPortions ?? null;
  const basePortions = activeText.portions ?? 1;
  const maxPortions = GLOBAL_MAX_PORTIONS;
  const [portions, setPortions] = useState(basePortions);
```

(Only the `maxPortions` line changes — everything downstream in this component already reads the local `maxPortions` variable, so no further edits are needed in this file.)

- [ ] **Step 6: Run the full test suite to check nothing broke**

Run: `npx vitest run`
Expected: PASS. `plannerUtils.test.js` is untouched and unaffected (it only ever used `fixedPortions`, never `maxPortions`).

- [ ] **Step 7: Commit**

```bash
git add src/features/planner/plannerApi.js src/features/planner/PlannerMenuScreen.jsx src/features/session/ParamsScreen.jsx
git commit -m "refactor(recipes): replace per-recipe maxPortions with GLOBAL_MAX_PORTIONS"
```

---

### Task 4: Move recipe media to `public/recipe-media/`

**Files:**
- Move: `content/media/` → `public/recipe-media/media/` (git mv, ~76 files)
- Modify: `scripts/generate-recipe-photos.mjs:20`

**Interfaces:**
- Produces: every recipe photo/illustration/inline-step-image file now lives at `public/recipe-media/media/<filename>`, served at the plain URL `/recipe-media/media/<filename>` (public/ assets are copied as-is by Vite, never processed/inlined).

- [ ] **Step 1: Verify the source directory and move it**

Run: `ls content/media | wc -l` — expect `76`.

Run:
```bash
mkdir -p public/recipe-media
git mv content/media public/recipe-media/media
```

- [ ] **Step 2: Verify the move**

Run: `ls public/recipe-media/media | wc -l` — expect `76`.
Run: `ls content/media 2>&1` — expect an error (directory no longer exists).

- [ ] **Step 3: Update the photo-generation authoring tool's output path**

In `scripts/generate-recipe-photos.mjs`, find (line 20):

```js
const MEDIA_DIR = path.join(ROOT, "content/media");
```

Replace with:

```js
const MEDIA_DIR = path.join(ROOT, "public/recipe-media/media");
```

- [ ] **Step 4: Confirm the dev server serves a moved file**

Run: `npm run dev &` (or use whatever the project's existing dev-server task is), then once it's up:
Run: `curl -sI http://localhost:5173/recipe-media/media/soup.webp | head -1`
Expected: `HTTP/1.1 200 OK` (adjust the port to whatever the dev server printed).
Stop the dev server afterward.

- [ ] **Step 5: Commit**

```bash
git add -A content/media public/recipe-media scripts/generate-recipe-photos.mjs
git commit -m "chore(recipes): move recipe media from content/media to public/recipe-media"
```

---

### Task 5: `builtinRecipesTopic.js` — synthesize the recipe topic from bundled files

**Files:**
- Create: `src/topics/builtinRecipesTopic.js`
- Test: `src/topics/builtinRecipesTopic.test.js`

**Interfaces:**
- Produces:
  - `RECIPES_TOPIC_ID = 'reading_dad_texts'` (string constant)
  - `RECIPES_MEDIA_BASE_URL = '/recipe-media/'` (string constant)
  - `buildRecipesTopicRecord()` → an object shaped like an installed topic record: `{ meta: { id, renderer: 'reading', version, title, builtin: true, hidden: true }, modes: [], cards: [], texts: [...], installedAt: 'builtin' }`. Each `texts[]` entry: `{ id, kind: 'instruction', title: {ru, en}, photo?, image, portions, fixedPortions?, status, file, stepCount }`.
  - `getBuiltinRecipeRawText(filePath)` → returns the raw `.txt` content for a `file` value like `recipes/soup.txt`, or `null` if not found.

- [ ] **Step 1: Write the failing test**

Create `src/topics/builtinRecipesTopic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildRecipesTopicRecord, getBuiltinRecipeRawText, RECIPES_TOPIC_ID } from './builtinRecipesTopic.js';

describe('buildRecipesTopicRecord', () => {
  const record = buildRecipesTopicRecord();

  it('uses the reading_dad_texts id and reading renderer', () => {
    expect(record.meta.id).toBe(RECIPES_TOPIC_ID);
    expect(record.meta.renderer).toBe('reading');
  });

  it('is marked builtin and hidden', () => {
    expect(record.meta.builtin).toBe(true);
    expect(record.meta.hidden).toBe(true);
  });

  it('produces exactly 27 instruction texts', () => {
    expect(record.texts).toHaveLength(27);
    expect(record.texts.every((t) => t.kind === 'instruction')).toBe(true);
  });

  it('gives each text entry a title, file, and stepCount', () => {
    const soup = record.texts.find((t) => t.file === 'recipes/soup.txt');
    expect(soup).toBeDefined();
    expect(soup.title.ru).toBe('Куриный суп с вермишелью');
    expect(soup.stepCount).toBeGreaterThan(0);
  });

  it('marks a fixed-type recipe with fixedPortions equal to its portions', () => {
    const soup = record.texts.find((t) => t.file === 'recipes/soup.txt');
    expect(soup.portions).toBe(6);
    expect(soup.fixedPortions).toBe(6);
  });

  it('leaves fixedPortions unset for a per_portion recipe', () => {
    const omelet = record.texts.find((t) => t.file === 'recipes/omelet.txt');
    expect(omelet.fixedPortions).toBeUndefined();
  });

  it('gives every text entry a media/ prefixed photo and image path', () => {
    for (const text of record.texts) {
      expect(text.photo).toMatch(/^media\//);
      expect(text.image).toMatch(/^media\/.*\.svg$/);
    }
  });
});

describe('getBuiltinRecipeRawText', () => {
  it('returns the raw txt content for a known file path', () => {
    const content = getBuiltinRecipeRawText('recipes/soup.txt');
    expect(content).toContain('Куриный суп с вермишелью');
  });

  it('returns null for an unknown file path', () => {
    expect(getBuiltinRecipeRawText('recipes/does_not_exist.txt')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/topics/builtinRecipesTopic.test.js`
Expected: FAIL — module `./builtinRecipesTopic.js` does not exist yet.

- [ ] **Step 3: Create `src/topics/builtinRecipesTopic.js`**

```js
// Synthesizes an in-memory "installed topic" record for the recipe library
// directly from content/recipes/*.txt, bundled at build time — no ZIP, no
// catalog entry, no install step. See docs/superpowers/specs/
// 2026-07-08-recipe-architecture-simplification-design.md.

const rawRecipeFiles = import.meta.glob('../../content/recipes/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
});

export const RECIPES_TOPIC_ID = 'reading_dad_texts';
export const RECIPES_MEDIA_BASE_URL = '/recipe-media/';

function countSteps(txt) {
  return txt.split('\n').filter((l) => /^\d+\./.test(l)).length;
}

function extractTitle(txt) {
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    return line;
  }
  return '';
}

function parseHeaderField(txt, prefix) {
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('#')) continue;
    const kv = line.slice(1).trim();
    if (kv.startsWith(prefix)) return kv.slice(prefix.length).trim();
  }
  return null;
}

function buildTextEntry(id, content) {
  const photo = parseHeaderField(content, 'photo:');
  const status = parseHeaderField(content, 'status:') === 'final' ? 'final' : 'draft';
  const type = parseHeaderField(content, 'type:');
  const portionsRaw = parseHeaderField(content, 'portions:');
  const portions = portionsRaw ? (parseInt(portionsRaw, 10) || 1) : 1;
  const fixedPortions = type === 'fixed' ? portions : null;
  const title = extractTitle(content);

  return {
    id: `${id}_instruction`,
    kind: 'instruction',
    title: { ru: title, en: title },
    ...(photo ? { photo: `media/${photo}` } : {}),
    image: `media/${id}.svg`,
    portions,
    ...(fixedPortions ? { fixedPortions } : {}),
    status,
    file: `recipes/${id}.txt`,
    stepCount: countSteps(content),
  };
}

const rawTextByFile = new Map();
const textEntries = [];

for (const [globPath, content] of Object.entries(rawRecipeFiles)) {
  const id = globPath.split('/').pop().replace(/\.txt$/, '');
  const file = `recipes/${id}.txt`;
  rawTextByFile.set(file, content);
  textEntries.push(buildTextEntry(id, content));
}

textEntries.sort((a, b) => a.file.localeCompare(b.file));

export function buildRecipesTopicRecord() {
  return {
    meta: {
      id: RECIPES_TOPIC_ID,
      renderer: 'reading',
      version: '1.0.0',
      title: { ru: 'Готовим еду', en: 'Cooking' },
      builtin: true,
      hidden: true,
    },
    modes: [],
    cards: [],
    texts: textEntries,
    installedAt: 'builtin',
  };
}

export function getBuiltinRecipeRawText(filePath) {
  return rawTextByFile.get(filePath) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/topics/builtinRecipesTopic.test.js`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/topics/builtinRecipesTopic.js src/topics/builtinRecipesTopic.test.js
git commit -m "feat(recipes): synthesize the recipe topic from bundled files at build time"
```

---

### Task 6: Wire the synthetic topic in, bypass IndexedDB for its files

**No separate migration/cleanup step for already-installed users:** `src/core/bootstrap.js:162-165`, `src/core/store.js:90-96`, and `src/StudentApp.jsx:128-131` already merge `topicRecords` as `[...BUILTIN_TOPICS, ...installedRecords.filter(r => !BUILTIN_TOPIC_IDS.has(r.meta.id))]` — any installed/raw record whose id collides with a `BUILTIN_TOPICS` id is already dropped. Once `reading_dad_texts` joins `BUILTIN_TOPICS` in this task, that existing filter automatically hides any stale ZIP-installed copy a user already has in IndexedDB, with zero new code. The stale copy's IndexedDB storage is simply orphaned (harmless, reclaimed only if someone later adds a cleanup pass) — not a correctness issue, out of scope here.

**Files:**
- Modify: `src/topics/builtinTopics.js`
- Modify: `src/shared/hooks/useTopicFile.js`
- Modify: `src/core/groupStore.js:61-67` (`getRawRecipeTxt`)

**Interfaces:**
- Consumes: `buildRecipesTopicRecord`, `RECIPES_TOPIC_ID`, `RECIPES_MEDIA_BASE_URL`, `getBuiltinRecipeRawText` from Task 5.
- Produces: `BUILTIN_TOPICS` (still exported the same way) now includes the recipes record; any `useTopicFile(RECIPES_TOPIC_ID, path)` call resolves synchronously to a static URL; `getRawRecipeTxt(RECIPES_TOPIC_ID, file)` returns bundled raw text instead of hitting IndexedDB.

- [ ] **Step 1: Add the recipes record to `BUILTIN_TOPICS`**

In `src/topics/builtinTopics.js`, add an import at the top and append to the array:

```js
import { buildRecipesTopicRecord } from "./builtinRecipesTopic.js";

export const BUILTIN_TOPICS = [
  {
    meta: {
      id: "streak_tracker",
      renderer: "streak_tracker",
      version: "1.0.0",
      title: { ru: "5 из 5" },
      avatar: "media/avatar_streak_tracker.svg",
      builtin: true,
      about: {
        description: "Универсальный трекер серии ответов. Подходит для любого занятия — специалист отмечает результат вручную.",
        goals: [
          "Поощрить серию правильных ответов подряд.",
          "Дать ребёнку ощущение прогресса через нарастающую серию звёзд.",
        ],
        finalGoal: "Ребёнок получает приз после 5 верных ответов подряд без единой ошибки.",
        flow: [
          "Задавайте задание устно, жестами или на реальном материале.",
          "Нажимайте ✓ если ответ верный, ✗ если ошибка — серия обнуляется.",
        ],
      },
    },
    modes: [
      {
        id: "streak",
        type: "streak",
        evaluation: "instant",
        ui: {
          title: { ru: "5 из 5" },
          instruction: { ru: "Отмечайте ответы ребёнка" },
          icon: "media/avatar_streak_tracker.svg",
        },
      },
    ],
    cards: [{ id: "streak_task", conceptId: "streak_task", primary: true }],
    installedAt: "builtin",
  },
  buildRecipesTopicRecord(),
];

export const BUILTIN_TOPIC_IDS = new Set(BUILTIN_TOPICS.map((t) => t.meta.id));

export const FIRST_PARTY_DECK_IDS = new Set([]);
```

(Only the import line and the appended `buildRecipesTopicRecord()` entry are new — the `streak_tracker` object is unchanged, reproduced here so the whole file's final state is unambiguous.)

- [ ] **Step 2: Patch `useTopicFile.js` to bypass IndexedDB for the recipes topic**

Replace the full contents of `src/shared/hooks/useTopicFile.js` with:

```js
import { useState, useEffect } from "react";
import { getDb, topics } from "@/core/db";
import { RECIPES_TOPIC_ID, RECIPES_MEDIA_BASE_URL } from "@/topics/builtinRecipesTopic";

export function useTopicFile(topicId, filePath) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!topicId || !filePath) {
      setUrl(null);
      return;
    }

    if (topicId === RECIPES_TOPIC_ID) {
      setUrl(`${RECIPES_MEDIA_BASE_URL}${filePath}`);
      return;
    }

    let objectUrl = null;
    getDb()
      .then((db) => topics.getFile(db, topicId, filePath))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [topicId, filePath]);

  return url;
}
```

- [ ] **Step 3: Patch `getRawRecipeTxt` in `groupStore.js`**

In `src/core/groupStore.js`, add an import near the top (alongside the existing imports) and update the function (currently lines 61-67):

```js
import { RECIPES_TOPIC_ID, getBuiltinRecipeRawText } from "@/topics/builtinRecipesTopic";
```

```js
/** Load raw recipe .txt — from the bundled recipe library, or from ZIP store (topics IndexedDB) for any other reading topic. */
export async function getRawRecipeTxt(topicId, filePath) {
  if (topicId === RECIPES_TOPIC_ID) {
    return getBuiltinRecipeRawText(filePath);
  }
  const db = await getDb();
  const blob = await topics.getFile(db, topicId, filePath);
  if (!blob) return null;
  return blob.text();
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Manual check — recipe photo resolves via the dev server**

Start the dev server, sign in as an existing account (or local mode), open Планировщик → Меню → any meal slot → "+ Добавить рецепт", and confirm recipe photos render (not broken images) in the picker grid. Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add src/topics/builtinTopics.js src/shared/hooks/useTopicFile.js src/core/groupStore.js
git commit -m "feat(recipes): wire builtin recipes topic into topicRecords, bypass IndexedDB for its files"
```

---

### Task 7: Hide from every topic picker, remove the catalog entry, delete the old build scripts

**Files:**
- Modify: `src/features/topics/TopicLibraryScreen.jsx:220-222`
- Modify: `src/features/topics/TopicCatalogScreen.jsx:16-40` (`CATALOG_CATEGORIES`)
- Modify: `public/decks/catalog.json`
- Delete: `scripts/update-recipes-deck.mjs`
- Delete: `scripts/generate-reading-dad-texts.mjs`

**Interfaces:**
- Consumes: `meta.hidden` flag on the recipes topic record (Task 5/6).
- Produces: the recipes topic never appears in `TopicLibraryScreen`'s list or `TopicCatalogScreen`'s catalog; `catalog.json` no longer lists `reading_dad_texts`.

- [ ] **Step 1: Filter hidden topics out of `TopicLibraryScreen`**

In `src/features/topics/TopicLibraryScreen.jsx`, find (around lines 220-222):

```js
  const visibleRecords = account
    ? topicRecords.filter((r) => r.meta.builtin || ownedNonPendingIds.has(r.meta.id))
    : topicRecords;
```

Replace with:

```js
  const visibleRecords = (account
    ? topicRecords.filter((r) => r.meta.builtin || ownedNonPendingIds.has(r.meta.id))
    : topicRecords
  ).filter((r) => !r.meta.hidden);
```

- [ ] **Step 2: Remove the catalog category entry**

In `src/features/topics/TopicCatalogScreen.jsx`, find (around line 20):

```js
  reading_dad_poems:        "Чтение",
  reading_dad_instructions: "Чтение",
  reading_dad_texts:        "Чтение",
  sentence_puzzle:          "Чтение",
```

Replace with:

```js
  reading_dad_poems:        "Чтение",
  reading_dad_instructions: "Чтение",
  sentence_puzzle:          "Чтение",
```

- [ ] **Step 3: Remove the `catalog.json` entry**

In `public/decks/catalog.json`, find the `reading_dad_texts` deck object (currently lines 33-47):

```json
    {
      "id": "reading_dad_texts",
      "version": "1.135.0",
      "title": {
        "ru": "Чтение. Готовим еду",
        "en": "Reading: Cooking"
      },
      "description": {
        "ru": "Пошаговые инструкции для самостоятельных действий.",
        "en": "Step-by-step instructions for independent tasks."
      },
      "url": "./decks/reading_dad_texts_v1.135.0.zip",
      "status": "release",
      "access": "free"
    },
```

Delete this entire object (including its trailing comma), so the `reading_short_stories` entry's closing `},` is immediately followed by the `emotions_v2` object. Verify the file is still valid JSON after the edit.

- [ ] **Step 4: Delete the old build scripts**

```bash
git rm scripts/update-recipes-deck.mjs scripts/generate-reading-dad-texts.mjs
```

- [ ] **Step 5: Verify `catalog.json` is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/decks/catalog.json', 'utf-8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Manual check — recipes topic is gone from every picker**

Start the dev server. Confirm:
- Home → "Темы" (TopicLibraryScreen) does **not** list "Готовим еду" or "Чтение. Готовим еду" anywhere.
- The topic catalog (install-new-topic screen) does **not** offer "Чтение. Готовим еду" under "Чтение".
- Планировщик → Меню still works end-to-end: pick a recipe for a meal slot, open "Что готовим?", start cooking a recipe (portions stepper appears/hides correctly for `fixed` vs `per_portion` recipes), confirm the recipe's step-by-step reading session displays its header illustration and photos correctly.
Stop the dev server afterward.

- [ ] **Step 8: Commit**

```bash
git add -u src/features/topics/TopicLibraryScreen.jsx src/features/topics/TopicCatalogScreen.jsx public/decks/catalog.json
git commit -m "chore(recipes): remove reading_dad_texts from every topic picker and the catalog"
```

---

### Task 8: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite one more time**

Run: `npx vitest run`
Expected: PASS, zero regressions.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`
Expected: build succeeds with no errors. Confirm `dist/recipe-media/media/` exists and contains the ~76 moved files (proving `public/` assets, including the recipe media, were copied as plain files rather than inlined by `vite-plugin-singlefile`).

- [ ] **Step 3: Full manual walkthrough on the built app**

Serve `dist/` locally (e.g. `npx serve dist` or the project's existing preview command) and, as an existing test account:

1. Планировщик → Меню → add a `per_portion` recipe (e.g. omelet) to a meal slot → confirm the portions prompt caps at 8 and floors at 1.
2. Add a `fixed` recipe (e.g. soup or kompot) to a meal slot → confirm no portions stepper is shown, just the locked "🔒 N" label.
3. Tap "Готовить по шагам" (▶) on any recipe → confirm the cook-start screen's portions stepper (for a `per_portion` recipe) also caps at 8, and a `fixed` recipe shows "готовим N" with no stepper.
4. Start cooking a recipe with a `{N|...}` quantity template in its steps (e.g. breakfast_champion) at a non-default portion count → confirm the quantity in the step text scales and pluralizes correctly.
5. Cook `coffee_chemex` (uses inline step photos like `chemex_s06.webp`) → confirm every inline step photo renders.
6. Re-open the Планировщик → confirm a previously-cooked recipe still shows "Было занятие" / the "✓" cooked badge (session history keyed by the unchanged `reading_dad_texts` topic id still resolves).
7. Home → "Темы" and the topic catalog → confirm "Готовим еду" / "Чтение. Готовим еду" appears in neither.

- [ ] **Step 4: Report results**

Summarize pass/fail for each of the 7 manual checks above. If anything fails, go back to the relevant task, fix, and re-run this task's steps before considering the plan complete.
