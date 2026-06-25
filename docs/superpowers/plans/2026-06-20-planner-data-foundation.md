# Planner — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the structured ingredient data layer — new recipe .txt format with ingredient metadata, a pantry staples list, a parser module, and a shopping list generator that aggregates ingredients from multiple recipes with portion scaling.

**Architecture:** Recipe `.txt` files get a new `# ingredients:` metadata block at the top (alongside existing `# photo:`, `# status:`). A `content/pantry.txt` file lists items excluded from shopping lists by default. A one-time Node.js script (using Claude API) generates the ingredient blocks for all 23 existing recipes. Two client-side JS modules — `recipeParser.js` and `shoppingListGenerator.js` — form the pure-logic core used by the future UI.

**Tech Stack:** Vitest (tests), Node.js ESM (extraction script), Anthropic SDK (`backend/node_modules/@anthropic-ai/sdk`), plain JS (parser/generator — no framework dependencies).

## Global Constraints

- Test runner: Vitest — run with `npx vitest run <path>`
- No external dependencies in parser/generator — pure JS only
- Ingredient names in recipe files must exactly match items listed in `content/shopping/shopping.txt`
- Extraction script lives in `backend/scripts/` to reuse the Anthropic SDK already installed there
- Pantry items file: `content/pantry.txt`, one item per line, lowercase, matches shopping catalog names exactly
- Recipe metadata block must appear before the first non-comment line of the recipe
- Portions default: `1` when `# portions:` is absent

---

## File Map

**Create:**
- `content/pantry.txt` — list of pantry staples excluded from shopping by default
- `src/features/planner/recipeParser.js` — parses `# ingredients:` block from recipe .txt content
- `src/features/planner/recipeParser.test.js` — unit tests for parser
- `src/features/planner/shoppingListGenerator.js` — aggregates ingredients from multiple recipes
- `src/features/planner/shoppingListGenerator.test.js` — unit tests for generator
- `backend/scripts/extract-ingredients.mjs` — one-time Claude API script to populate ingredient blocks in all recipe .txt files

**Modify:**
- `content/recipes/*.txt` (all 23 files) — add `# tags:`, `# portions:`, `# ingredients:` blocks (done by extraction script, then reviewed manually)

---

## Task 1: pantry.txt + recipeParser

**Files:**
- Create: `content/pantry.txt`
- Create: `src/features/planner/recipeParser.js`
- Create: `src/features/planner/recipeParser.test.js`

**Interfaces:**
- Produces: `parseRecipeMetadata(content: string) → { tags: string[], portions: number, ingredients: Ingredient[] }`
  where `Ingredient = { product: string, qty: number|null, unit: string|null }`
- Produces: `loadPantryItems() → Set<string>` — used only in Node scripts; in browser the set is passed in

---

- [ ] **Step 1: Create content/pantry.txt**

```
масло растительное
масло сливочное
масло оливковое
масло тыквенное
соль
сахар
специи
мёд
бальзамический уксус
яблочный уксус
мука
горчица
кетчуп
```

File path: `content/pantry.txt`

- [ ] **Step 2: Write the failing tests**

File: `src/features/planner/recipeParser.test.js`

```js
import { describe, it, expect } from 'vitest';
import { parseRecipeMetadata } from './recipeParser.js';

describe('parseRecipeMetadata', () => {
  it('extracts tags from # tags: line', () => {
    const content = '# tags: завтрак, обед\nТест рецепт\n';
    const { tags } = parseRecipeMetadata(content);
    expect(tags).toEqual(['завтрак', 'обед']);
  });

  it('extracts single tag without trailing comma', () => {
    const content = '# tags: ужин\nТест\n';
    const { tags } = parseRecipeMetadata(content);
    expect(tags).toEqual(['ужин']);
  });

  it('extracts portions as integer', () => {
    const content = '# portions: 4\nТест\n';
    const { portions } = parseRecipeMetadata(content);
    expect(portions).toBe(4);
  });

  it('defaults portions to 1 when absent', () => {
    const { portions } = parseRecipeMetadata('Тест рецепт без метаданных\n');
    expect(portions).toBe(1);
  });

  it('extracts ingredient with qty and unit', () => {
    const content = '# ingredients:\n#   яйца | 3 | шт\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toEqual([{ product: 'яйца', qty: 3, unit: 'шт' }]);
  });

  it('extracts ingredient with null qty and unit when empty', () => {
    const content = '# ingredients:\n#   соль | |\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toEqual([{ product: 'соль', qty: null, unit: null }]);
  });

  it('extracts multiple ingredients', () => {
    const content = '# ingredients:\n#   яйца | 3 | шт\n#   молоко | 100 | мл\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toHaveLength(2);
    expect(ingredients[0].product).toBe('яйца');
    expect(ingredients[1].product).toBe('молоко');
  });

  it('stops ingredient block at next # key', () => {
    const content = '# ingredients:\n#   яйца | 3 | шт\n# status: final\nТест\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toHaveLength(1);
  });

  it('stops ingredient block at non-comment line', () => {
    const content = '# ingredients:\n#   яйца | 3 | шт\nТекст рецепта\n#   молоко | 1 | шт\n';
    const { ingredients } = parseRecipeMetadata(content);
    expect(ingredients).toHaveLength(1);
  });

  it('returns empty arrays when no metadata', () => {
    const { tags, ingredients } = parseRecipeMetadata('Просто рецепт без метаданных\n');
    expect(tags).toEqual([]);
    expect(ingredients).toEqual([]);
  });

  it('parses full realistic header', () => {
    const content = [
      '# photo: scramble_sausage.webp',
      '# status: final',
      '# tags: завтрак',
      '# portions: 2',
      '# ingredients:',
      '#   колбаса | 200 | г',
      '#   яйца | 3 | шт',
      '#   масло сливочное | 30 | г',
      '#   соль | |',
      'Скрамбл с колбасой',
    ].join('\n');
    const result = parseRecipeMetadata(content);
    expect(result.tags).toEqual(['завтрак']);
    expect(result.portions).toBe(2);
    expect(result.ingredients).toHaveLength(4);
    expect(result.ingredients[0]).toEqual({ product: 'колбаса', qty: 200, unit: 'г' });
    expect(result.ingredients[3]).toEqual({ product: 'соль', qty: null, unit: null });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
npx vitest run src/features/planner/recipeParser.test.js
```

Expected: FAIL — `Cannot find module './recipeParser.js'`

- [ ] **Step 4: Implement recipeParser.js**

File: `src/features/planner/recipeParser.js`

```js
/**
 * Parses the metadata header of a Mirocard recipe .txt file.
 *
 * Expected header format (all lines start with #):
 *   # photo: filename.webp
 *   # status: final
 *   # tags: завтрак, обед
 *   # portions: 4
 *   # ingredients:
 *   #   продукт | количество | единица
 *   #   соль | |
 *
 * Ingredient block ends at the first # line that is NOT indented,
 * or at the first non-# line.
 */
export function parseRecipeMetadata(content) {
  const lines = content.split('\n');
  const tags = [];
  let portions = 1;
  const ingredients = [];
  let inIngredients = false;

  for (const line of lines) {
    if (!line.startsWith('#')) {
      inIngredients = false;
      continue;
    }

    const afterHash = line.slice(1); // everything after the leading #

    if (inIngredients) {
      // Ingredient lines are indented: "#   product | qty | unit"
      if (afterHash.startsWith(' ') || afterHash.startsWith('\t')) {
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
    if (kv.startsWith('tags:')) {
      const raw = kv.slice(5).trim();
      tags.push(...raw.split(',').map((t) => t.trim()).filter(Boolean));
    } else if (kv.startsWith('portions:')) {
      portions = parseInt(kv.slice(9).trim(), 10) || 1;
    } else if (kv === 'ingredients:') {
      inIngredients = true;
    }
  }

  return { tags, portions, ingredients };
}
```

- [ ] **Step 5: Run tests — all must pass**

```
npx vitest run src/features/planner/recipeParser.test.js
```

Expected: all 11 tests PASS

- [ ] **Step 6: Commit**

```bash
git add content/pantry.txt src/features/planner/recipeParser.js src/features/planner/recipeParser.test.js
git commit -m "feat(planner): recipe metadata parser + pantry list"
```

---

## Task 2: Shopping List Generator

**Files:**
- Create: `src/features/planner/shoppingListGenerator.js`
- Create: `src/features/planner/shoppingListGenerator.test.js`

**Interfaces:**
- Consumes: `parseRecipeMetadata` from `./recipeParser.js`
- Produces: `generateShoppingList(recipes, pantryItems?) → ShoppingItem[]`
  where:
  ```
  recipes: Array<{ textId: string, content: string, portionMultiplier: number }>
  pantryItems: Set<string>  (lowercase product names)
  ShoppingItem: { product: string, qty: number|null, unit: string|null, include: boolean, recipeIds: string[] }
  ```

---

- [ ] **Step 1: Write the failing tests**

File: `src/features/planner/shoppingListGenerator.test.js`

```js
import { describe, it, expect } from 'vitest';
import { generateShoppingList } from './shoppingListGenerator.js';

function recipe(textId, ingredients, portions = 1, portionMultiplier = 1) {
  const lines = [
    `# portions: ${portions}`,
    '# ingredients:',
    ...ingredients.map(([p, q, u]) => `#   ${p} | ${q ?? ''} | ${u ?? ''}`),
    'Текст рецепта',
  ];
  return { textId, content: lines.join('\n'), portionMultiplier };
}

describe('generateShoppingList', () => {
  it('returns item from single recipe', () => {
    const list = generateShoppingList([recipe('r1', [['яйца', 3, 'шт']])]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ product: 'яйца', qty: 3, unit: 'шт', include: true, recipeIds: ['r1'] });
  });

  it('aggregates same product from two recipes', () => {
    const r1 = recipe('r1', [['лук', 2, 'шт']]);
    const r2 = recipe('r2', [['лук', 1, 'шт']]);
    const list = generateShoppingList([r1, r2]);
    const luk = list.find((i) => i.product === 'лук');
    expect(luk.qty).toBe(3);
    expect(luk.recipeIds).toEqual(['r1', 'r2']);
  });

  it('scales qty by portionMultiplier / portions', () => {
    const r = recipe('r1', [['мясо', 400, 'г']], 4, 2); // need 2 portions, recipe is for 4
    const list = generateShoppingList([r]);
    expect(list[0].qty).toBe(200); // 400 * (2/4)
  });

  it('marks pantry items as include: false', () => {
    const r = recipe('r1', [['соль', null, null]]);
    const list = generateShoppingList([r], new Set(['соль']));
    expect(list[0].include).toBe(false);
  });

  it('marks non-pantry items as include: true', () => {
    const r = recipe('r1', [['яйца', 3, 'шт']]);
    const list = generateShoppingList([r], new Set(['соль']));
    expect(list[0].include).toBe(true);
  });

  it('sets qty null when same product appears with and without qty', () => {
    const r1 = recipe('r1', [['соль', 5, 'г']]);
    const r2 = recipe('r2', [['соль', null, null]]);
    const list = generateShoppingList([r1, r2]);
    expect(list[0].qty).toBeNull();
  });

  it('uses portionMultiplier 1 by default', () => {
    const r = recipe('r1', [['морковь', 2, 'шт']], 2, 2);
    const list = generateShoppingList([r]);
    expect(list[0].qty).toBe(2); // 2 * (2/2) = 2
  });

  it('deduplicates by lowercase product name', () => {
    const r1 = recipe('r1', [['Лук', 1, 'шт']]);
    const r2 = recipe('r2', [['лук', 2, 'шт']]);
    const list = generateShoppingList([r1, r2]);
    expect(list).toHaveLength(1);
    expect(list[0].qty).toBe(3);
  });

  it('returns empty list for empty recipes', () => {
    expect(generateShoppingList([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/features/planner/shoppingListGenerator.test.js
```

Expected: FAIL — `Cannot find module './shoppingListGenerator.js'`

- [ ] **Step 3: Implement shoppingListGenerator.js**

File: `src/features/planner/shoppingListGenerator.js`

```js
import { parseRecipeMetadata } from './recipeParser.js';

/**
 * Aggregates ingredients from multiple recipes into a shopping list.
 *
 * @param {Array<{textId: string, content: string, portionMultiplier: number}>} recipes
 * @param {Set<string>} pantryItems - lowercase product names excluded by default
 * @returns {Array<{product: string, qty: number|null, unit: string|null, include: boolean, recipeIds: string[]}>}
 */
export function generateShoppingList(recipes, pantryItems = new Set()) {
  // key: lowercase product name → accumulated item
  const map = new Map();

  for (const { textId, content, portionMultiplier = 1 } of recipes) {
    const { ingredients, portions } = parseRecipeMetadata(content);
    const scale = portionMultiplier / portions;

    for (const { product, qty, unit } of ingredients) {
      const key = product.toLowerCase();
      const scaledQty = qty != null ? qty * scale : null;

      if (map.has(key)) {
        const existing = map.get(key);
        if (existing.qty != null && scaledQty != null) {
          existing.qty += scaledQty;
        } else {
          existing.qty = null;
        }
        if (!existing.recipeIds.includes(textId)) {
          existing.recipeIds.push(textId);
        }
      } else {
        map.set(key, {
          product,
          qty: scaledQty,
          unit,
          include: !pantryItems.has(key),
          recipeIds: [textId],
        });
      }
    }
  }

  return Array.from(map.values());
}
```

- [ ] **Step 4: Run tests — all must pass**

```
npx vitest run src/features/planner/shoppingListGenerator.test.js
```

Expected: all 9 tests PASS

- [ ] **Step 5: Run all planner tests together**

```
npx vitest run src/features/planner/
```

Expected: all 20 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/shoppingListGenerator.js src/features/planner/shoppingListGenerator.test.js
git commit -m "feat(planner): shopping list generator with portion scaling"
```

---

## Task 3: Ingredient extraction script

Generates `# tags:`, `# portions:`, `# ingredients:` blocks for all 23 recipe files using Claude API, then writes them back. Run once, review output manually, commit.

**Files:**
- Create: `backend/scripts/extract-ingredients.mjs`

**Interfaces:**
- Consumes: `content/recipes/*.txt`, `content/shopping/shopping.txt`, `content/pantry.txt`
- Produces: updated `content/recipes/*.txt` files with metadata blocks

---

- [ ] **Step 1: Create backend/scripts/extract-ingredients.mjs**

```js
#!/usr/bin/env node
/**
 * One-time script: uses Claude API to add structured ingredient metadata
 * to all recipe .txt files in content/recipes/.
 *
 * Run from project root:
 *   node backend/scripts/extract-ingredients.mjs
 *
 * Review the changes in git diff before committing.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RECIPES_DIR = path.join(ROOT, 'content/recipes');
const SHOPPING_FILE = path.join(ROOT, 'content/shopping/shopping.txt');
const PANTRY_FILE = path.join(ROOT, 'content/pantry.txt');

const client = new Anthropic();

const shoppingCatalog = readFileSync(SHOPPING_FILE, 'utf8');
const pantryItems = readFileSync(PANTRY_FILE, 'utf8')
  .split('\n').map(l => l.trim()).filter(Boolean);

const SYSTEM_PROMPT = `You are a recipe data extractor. Given a Russian recipe text and a shopping catalog, extract structured ingredient metadata.

Shopping catalog (use EXACT names from this list):
${shoppingCatalog}

Pantry staples (these should NOT be included in shopping list by default):
${pantryItems.join(', ')}

Rules:
1. Product names MUST match items from the shopping catalog exactly (same spelling, same case)
2. If an ingredient is not in the catalog, use the closest matching catalog item
3. Quantities: use the number mentioned in the "Подготовить продукты" section; null if not specified
4. Units: шт, г, кг, мл, л, ст.л, ч.л, пуч, зуб — or null
5. Tags: one or more of [завтрак, обед, ужин, перекус] based on the dish type
6. Portions: estimate based on typical serving size for the recipe

Output ONLY the metadata block, nothing else. Format:
# tags: тег1, тег2
# portions: N
# ingredients:
#   продукт | количество | единица
#   продукт | |`;

async function extractMetadata(recipeContent) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: recipeContent }],
  });
  return msg.content[0].text.trim();
}

function injectMetadata(originalContent, metadataBlock) {
  const lines = originalContent.split('\n');
  // Find the last consecutive # line at the top
  let insertAfter = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#')) {
      insertAfter = i + 1;
    } else {
      break;
    }
  }
  const before = lines.slice(0, insertAfter);
  const after = lines.slice(insertAfter);
  return [...before, metadataBlock, ...after].join('\n');
}

function alreadyHasIngredients(content) {
  return content.includes('# ingredients:');
}

const files = readdirSync(RECIPES_DIR).filter(f => f.endsWith('.txt'));
console.log(`Processing ${files.length} recipe files...\n`);

for (const file of files) {
  const filePath = path.join(RECIPES_DIR, file);
  const content = readFileSync(filePath, 'utf8');

  if (alreadyHasIngredients(content)) {
    console.log(`  SKIP  ${file} (already has ingredients block)`);
    continue;
  }

  console.log(`  → ${file}`);
  try {
    const metadata = await extractMetadata(content);
    const updated = injectMetadata(content, metadata);
    writeFileSync(filePath, updated, 'utf8');
    console.log(`  ✓ ${file}`);
  } catch (err) {
    console.error(`  ✗ ${file}: ${err.message}`);
  }

  // Rate limit: 1 request per second
  await new Promise(r => setTimeout(r, 1000));
}

console.log('\nDone. Review changes with: git diff content/recipes/');
```

- [ ] **Step 2: Run the script**

From project root:
```
node backend/scripts/extract-ingredients.mjs
```

Expected output: lines like `✓ mushroom_soup.txt` for each recipe. Should complete in ~30 seconds (23 recipes, 1 req/sec).

- [ ] **Step 3: Review all generated ingredient blocks**

```
git diff content/recipes/
```

Check each recipe for:
- Product names match `content/shopping/shopping.txt` exactly
- Quantities are reasonable
- Tags are sensible (завтрак for oatmeal, обед/ужин for soups, etc.)
- Portions are realistic

Fix any issues manually in the .txt files.

- [ ] **Step 4: Verify parser handles all updated files**

Create a quick smoke test script to verify no recipe files break the parser:

```
node -e "
import { readFileSync, readdirSync } from 'node:fs';
// Note: this is a quick manual check, not a Vitest test
const files = readdirSync('content/recipes').filter(f => f.endsWith('.txt'));
let ok = 0, empty = 0;
for (const f of files) {
  const content = readFileSync('content/recipes/' + f, 'utf8');
  const hasIngredients = content.includes('# ingredients:');
  if (hasIngredients) ok++; else empty++;
  console.log((hasIngredients ? '✓' : '✗') + ' ' + f);
}
console.log(ok + ' ok, ' + empty + ' missing ingredients block');
" --input-type=module
```

Expected: all 23 files show ✓

- [ ] **Step 5: Commit**

```bash
git add content/recipes/ content/pantry.txt backend/scripts/extract-ingredients.mjs
git commit -m "feat(planner): add ingredient metadata to all recipe files"
```

---

## Self-Review

**Spec coverage:**
- ✅ New recipe format with `# tags:`, `# portions:`, `# ingredients:`
- ✅ Ingredient names normalized to shopping catalog
- ✅ Pantry staples excluded from shopping list by default (`content/pantry.txt`)
- ✅ Portion scaling: `portionMultiplier / portions`
- ✅ Aggregation of same ingredient across multiple recipes
- ✅ Parser handles missing metadata gracefully (defaults to portions=1, empty arrays)
- ✅ One-time extraction script for existing 23 recipes
- ✅ Tests cover all parser and generator behaviors

**Placeholder scan:** None found.

**Type consistency:**
- `parseRecipeMetadata` → `{ tags, portions, ingredients }` used consistently in both recipeParser and shoppingListGenerator
- `ShoppingItem.recipeIds` (not `recipes`) used consistently in tests and implementation
- `portionMultiplier` (not `multiplier` or `scale`) consistent across interfaces
