#!/usr/bin/env node
/**
 * One-time script: uses Claude API to add structured ingredient metadata
 * to all recipe .txt files in content/recipes/.
 *
 * Run from the backend/ directory:
 *   cd backend && node scripts/extract-ingredients.mjs
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

Pantry staples (these are usually already at home, note them but still include in the output):
${pantryItems.join(', ')}

Rules:
1. Product names MUST match items from the shopping catalog exactly (same spelling, same case)
2. If an ingredient is not in the catalog, use the closest matching catalog item
3. Quantities: use the number mentioned in the "Подготовить продукты" section; leave empty if not specified
4. Units: шт, г, кг, мл, л, ст.л, ч.л, пуч, зуб — or leave empty
5. Tags: one or more of [завтрак, обед, ужин, перекус] based on the dish type
6. Portions: estimate based on typical serving size for the recipe (usually 2-4)

Output ONLY the metadata block, no explanations, no extra text. Exact format:
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

const files = readdirSync(RECIPES_DIR).filter(f => f.endsWith('.txt')).sort();
console.log(`Processing ${files.length} recipe files...\n`);

for (const file of files) {
  const filePath = path.join(RECIPES_DIR, file);
  const content = readFileSync(filePath, 'utf8');

  if (alreadyHasIngredients(content)) {
    console.log(`  SKIP  ${file} (already has ingredients block)`);
    continue;
  }

  process.stdout.write(`  → ${file} ... `);
  try {
    const metadata = await extractMetadata(content);
    const updated = injectMetadata(content, metadata);
    writeFileSync(filePath, updated, 'utf8');
    console.log('✓');
  } catch (err) {
    console.log(`✗ ${err.message}`);
  }

  // Avoid rate limits
  await new Promise(r => setTimeout(r, 1000));
}

console.log('\nDone. Review changes with: git diff content/recipes/');
