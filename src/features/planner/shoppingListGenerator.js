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
