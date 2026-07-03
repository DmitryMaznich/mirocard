/**
 * Parses the metadata header of a Mirocard recipe .txt file.
 *
 * Expected header format (all lines start with #):
 *   # photo: filename.webp
 *   # status: final
 *   # tags: завтрак, обед
 *   # portions: 4
 *   # fixed_portions: 4
 *   # ingredients:
 *   #   продукт | количество | единица
 *   #   соль | |
 *
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
 *
 * Ingredient block ends at the first # line that is NOT indented,
 * or at the first non-# line.
 */
export function parseRecipeMetadata(content) {
  const lines = content.split('\n');
  const tags = [];
  let portions = 1;
  let fixedPortions = null;
  let maxPortions = 4;
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
