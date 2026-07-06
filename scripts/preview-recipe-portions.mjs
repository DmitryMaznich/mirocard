#!/usr/bin/env node
/**
 * Shows exactly what a recipe's steps render as at different portion
 * counts — the same applyPortions()/stepPortionsMultiplier() math the
 * app uses, run from the command line against the raw .txt file.
 *
 * Editing recipes as plain text hides this: a template like
 * {1|стакан|стакана|стаканов} doesn't reveal that at portions=1 for a
 * 4-portion base recipe it renders as "половину стакана" (rounded up to
 * the nearest half-unit), not "0.25 стакана". This script removes the
 * guesswork.
 *
 * Usage:
 *   node scripts/preview-recipe-portions.mjs content/recipes/buckwheat.txt
 *   node scripts/preview-recipe-portions.mjs content/recipes/buckwheat.txt 1 2 3
 */
import { readFileSync } from 'node:fs';
import {
  parseRecipeTxt,
  applyPortions,
  applyFireEmoji,
} from '../src/topics/renderers/reading/parseRecipeTxt.js';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/preview-recipe-portions.mjs <recipe.txt> [portions...]');
  process.exit(1);
}

function parseHeader(raw) {
  let portions = 1;
  let fixedPortions = null;
  let maxPortions = 4;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('#')) break;
    const kv = line.slice(1).trim();
    if (kv.startsWith('fixed_portions:')) fixedPortions = parseInt(kv.slice('fixed_portions:'.length).trim(), 10) || null;
    else if (kv.startsWith('max_portions:')) maxPortions = parseInt(kv.slice('max_portions:'.length).trim(), 10) || 4;
    else if (kv.startsWith('portions:')) portions = parseInt(kv.slice('portions:'.length).trim(), 10) || 1;
  }
  return { portions, fixedPortions, maxPortions };
}

// Same ratio the reading engine uses (src/topics/renderers/reading/index.jsx),
// factored out into parseRecipeTxt.js as stepPortionsMultiplier — duplicated
// here only because that export lives behind the app's own module graph;
// kept identical on purpose.
function stepPortionsMultiplier(basePortions, fixedPortions, chosenPortions) {
  const base = basePortions || 1;
  const chosen = fixedPortions ?? chosenPortions ?? base;
  return chosen / base;
}

const raw = readFileSync(filePath, 'utf-8');
const { portions: basePortions, fixedPortions, maxPortions } = parseHeader(raw);
const steps = parseRecipeTxt(raw).filter((s) => s.type === 'action' || s.type === 'checklist');

const requested = process.argv.slice(3).map(Number).filter((n) => Number.isFinite(n) && n > 0);
const portionsToShow = requested.length
  ? requested
  : fixedPortions
    ? [fixedPortions]
    : Array.from({ length: Math.min(maxPortions, 8) }, (_, i) => i + 1);

console.log(`База: ${basePortions} порций${fixedPortions ? ` (fixed_portions: ${fixedPortions}, степпер скрыт в UI)` : ''}, max_portions: ${maxPortions}`);

for (const chosen of portionsToShow) {
  const multiplier = stepPortionsMultiplier(basePortions, fixedPortions, chosen);
  console.log(`\n=== ${chosen} порций (множитель ${multiplier}) ===`);
  for (const step of steps) {
    if (step.type === 'checklist') {
      console.log(applyFireEmoji(applyPortions(step.text, multiplier)));
      for (const item of step.items ?? []) {
        console.log('  - ' + applyFireEmoji(applyPortions(item, multiplier)));
      }
    } else {
      const rendered = applyFireEmoji(applyPortions(step.text, multiplier));
      if (rendered !== step.text) console.log(rendered);
    }
  }
}
