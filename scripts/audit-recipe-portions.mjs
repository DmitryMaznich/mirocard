#!/usr/bin/env node
/**
 * Mechanical audit of every recipe's ingredient quantities:
 *
 * 1. Discrete/countable units (шт, зуб, пачка, банка, упаковка, пучок,
 *    веточка, горсть) — checks whether the quantity divides evenly by
 *    the recipe's base portions. This is a hard mathematical guarantee:
 *    if qty is a multiple of basePortions, it renders as a whole number
 *    at ANY integer portion selection (1..N), not just the base case.
 *    fixed_portions recipes are exempt — their scale is always 1.
 *
 * 2. Weight/volume units (гр, мл, ст.л, ч.л, стакан) — reports the
 *    per-portion amount so it can be sanity-checked against real
 *    reference values by a human (or a follow-up research pass), instead
 *    of relying on gut-feel review that has repeatedly missed things.
 *
 * Usage: node scripts/audit-recipe-portions.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RECIPES_DIR = 'content/recipes';
const DISCRETE_UNITS = new Set(['шт', 'зуб', 'пачка', 'банка', 'упаковка', 'пучок', 'веточка', 'горсть']);

function parseRecipe(raw) {
  let portions = 1;
  let fixedPortions = null;
  const ingredients = [];
  let inIngredients = false;

  for (const line of raw.split('\n')) {
    if (!line.startsWith('#')) { inIngredients = false; continue; }
    const afterHash = line.slice(1);
    if (inIngredients) {
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        if (parts[0]) {
          ingredients.push({
            product: parts[0],
            qty: parts[1] ? parseFloat(parts[1]) : null,
            unit: parts[2] || null,
          });
        }
        continue;
      }
      inIngredients = false;
    }
    const kv = afterHash.trim();
    if (kv.startsWith('fixed_portions:')) fixedPortions = parseInt(kv.slice('fixed_portions:'.length).trim(), 10) || null;
    else if (kv.startsWith('portions:')) portions = parseInt(kv.slice('portions:'.length).trim(), 10) || 1;
    else if (kv === 'ingredients:') inIngredients = true;
  }
  return { portions, fixedPortions, ingredients };
}

const files = readdirSync(RECIPES_DIR).filter((f) => f.endsWith('.txt')).sort();
let violations = 0;

console.log('=== Делимость штучных ингредиентов на базовые порции ===\n');

for (const file of files) {
  const raw = readFileSync(join(RECIPES_DIR, file), 'utf-8');
  const { portions, fixedPortions, ingredients } = parseRecipe(raw);
  if (fixedPortions) continue; // scale is always 1, никогда не масштабируется

  for (const ing of ingredients) {
    if (ing.qty == null || !ing.unit || !DISCRETE_UNITS.has(ing.unit)) continue;
    const isWhole = Number.isInteger(ing.qty);
    const divides = isWhole && ing.qty % portions === 0;
    if (!divides) {
      violations++;
      console.log(`❌ ${file}: ${ing.product} = ${ing.qty} ${ing.unit} (база ${portions}) → ${ing.qty}/${portions} = ${(ing.qty / portions).toFixed(3)}, не целое при масштабировании`);
    }
  }
}

console.log(violations === 0 ? '\nНарушений делимости не найдено.' : `\nВсего нарушений: ${violations}`);

console.log('\n=== Весовые/объёмные ингредиенты — граммы/мл на порцию (для сверки вручную) ===\n');

const GRAMS_PER_UNIT = {
  стакан: 200, 'ст.л': 15, 'ч.л': 5, горсть: 90,
};

for (const file of files) {
  const raw = readFileSync(join(RECIPES_DIR, file), 'utf-8');
  const { portions, fixedPortions, ingredients } = parseRecipe(raw);
  const base = fixedPortions || portions || 1;
  const rows = [];
  for (const ing of ingredients) {
    if (ing.qty == null) continue;
    let grams = null;
    if (ing.unit === 'гр' || ing.unit === 'мл') grams = ing.qty;
    else if (ing.unit && GRAMS_PER_UNIT[ing.unit]) grams = ing.qty * GRAMS_PER_UNIT[ing.unit];
    if (grams == null) continue;
    rows.push(`${ing.product}: ${(grams / base).toFixed(0)} г(мл)/чел (всего ${grams} на ${base})`);
  }
  if (rows.length) {
    console.log(`--- ${file} (база ${base}) ---`);
    rows.forEach((r) => console.log('  ' + r));
  }
}
