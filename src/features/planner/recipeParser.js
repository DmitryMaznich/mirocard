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
 *   # options:
 *   #   topping | мёд | 1 | ч.л
 *   #   topping | ягоды | 1 | горсть
 *
 * options is an optional set of choice groups (e.g. a topping the child
 * picks) — each line is `groupId | product | qty | unit`. A chosen
 * product's qty/unit feeds the shopping list exactly like a regular
 * ingredient, scaled the same way; an unchosen one contributes nothing.
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

// Parses one qty-column value from an ingredient/option line. Supports:
//   "3"            → { qty: 3, key: null, additiveStep: null }
//   "1+0.5"        → { qty: 1, key: null, additiveStep: 0.5 } (unkeyed additive — rare, but valid)
//   "oil:1+0.5"    → { qty: 1, key: "oil", additiveStep: 0.5 }
//   "oil:1"        → { qty: 1, key: "oil", additiveStep: null }
//   "" / undefined → { qty: null, key: null, additiveStep: null }
// Mirrors the {key:base+step|...} step-text syntax in parseRecipeTxt.js so a
// recipe's shopping-list quantity always matches what the step actually says
// to use — see docs/superpowers/specs/2026-07-18-recipe-portion-scaling-design.md.
function parseQtyField(raw) {
  if (!raw) return { qty: null, key: null, additiveStep: null };
  const keyMatch = raw.match(/^([a-zA-Z]\w*):(.+)$/);
  const key = keyMatch ? keyMatch[1] : null;
  const rest = keyMatch ? keyMatch[2] : raw;
  const stepMatch = rest.match(/^(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)$/);
  if (stepMatch) {
    return { qty: parseFloat(stepMatch[1]) || null, key, additiveStep: parseFloat(stepMatch[2]) || null };
  }
  return { qty: parseFloat(rest) || null, key, additiveStep: null };
}

// Scales one ingredient's qty for a chosen portions factor — additive
// ingredients (additiveStep set) grow by a flat step per extra portion
// instead of re-multiplying, matching applyAdditiveScaling in
// parseRecipeTxt.js. Shared by buildSelectedIngredientsSummary
// (plannerUtils.js) and generateShoppingList (shoppingListGenerator.js) so
// both screens agree with what a recipe's steps actually say to use.
export function scalePortionQty(qty, additiveStep, scale) {
  if (qty == null) return null;
  return additiveStep != null ? qty + additiveStep * (scale - 1) : qty * scale;
}

export function parseRecipeMetadata(content) {
  const lines = content.split('\n');
  const tags = [];
  let photo = null;
  let portions = 1;
  let isFixedType = false;
  let status = 'draft';
  const ingredients = [];
  const options = {};
  let inIngredients = false;
  let inOptions = false;

  for (const line of lines) {
    if (!line.startsWith('#')) {
      inIngredients = false;
      inOptions = false;
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
          const { qty, key, additiveStep } = parseQtyField(parts[1]);
          ingredients.push({
            product,
            qty,
            unit: parts[2] || null,
            ...(key != null ? { key } : {}),
            ...(additiveStep != null ? { additiveStep } : {}),
          });
        }
        continue;
      }
      inIngredients = false;
    }

    if (inOptions) {
      // Option lines: "#   groupId | product | qty | unit"
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const [groupId, product] = parts;
        if (groupId && product) {
          if (!options[groupId]) options[groupId] = [];
          const { qty, key, additiveStep } = parseQtyField(parts[2]);
          options[groupId].push({
            product,
            qty,
            unit: parts[3] || null,
            ...(key != null ? { key } : {}),
            ...(additiveStep != null ? { additiveStep } : {}),
          });
        }
        continue;
      }
      inOptions = false;
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
    } else if (kv === 'options:') {
      inOptions = true;
    }
  }

  return {
    photo,
    tags,
    portions,
    fixedPortions: isFixedType ? portions : null,
    options,
    status,
    ingredients,
  };
}
