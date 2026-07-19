import { parseRecipeMetadata, scalePortionQty } from './recipeParser.js';
import { toCanonicalQty } from './shoppingUnitConversions.js';

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

    for (const { product, qty, unit, additiveStep, coverDivisor } of ingredients) {
      const key = product.toLowerCase();
      const scaledQty = scalePortionQty(qty, additiveStep, scale, coverDivisor);
      const canonical = toCanonicalQty(product, scaledQty, unit);

      if (map.has(key)) {
        const existing = map.get(key);
        if (existing.qty != null && canonical.qty != null) {
          existing.qty += canonical.qty;
        } else {
          existing.qty = null;
        }
        if (!existing.recipeIds.includes(textId)) {
          existing.recipeIds.push(textId);
        }
      } else {
        map.set(key, {
          product,
          qty: canonical.qty,
          unit: canonical.unit,
          include: !pantryItems.has(key),
          recipeIds: [textId],
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Overrides each item's `include` flag with an explicit per-product decision
 * made in Меню ('have' → excluded from the shopping list regardless of
 * pantry status, 'buy' → included regardless). Items with no decision
 * (neutral) keep whatever generateShoppingList already decided.
 *
 * @param {Array<{product: string, include: boolean}>} items
 * @param {Object<string, 'have'|'buy'>} ingredientDecisions
 */
export function applyIngredientDecisions(items, ingredientDecisions = {}) {
  return items.map((item) => {
    const decision = ingredientDecisions[item.product.toLowerCase()];
    if (decision === 'have') return { ...item, include: false };
    if (decision === 'buy') return { ...item, include: true };
    return item;
  });
}
