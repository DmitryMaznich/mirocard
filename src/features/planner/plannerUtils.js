export const MEAL_TYPES = ['завтрак', 'обед', 'ужин', 'перекус'];
export const RECIPE_TAGS = [...MEAL_TYPES, 'напитки'];

export function createPlan(studentId) {
  return {
    id: crypto.randomUUID(),
    studentId,
    status: 'draft',
    selectedRecipes: [],
    mealAssignments: {},
    selectedPortions: {},
    ingredientDecisions: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function isRecipeSelected(plan, textId) {
  return plan.selectedRecipes.includes(textId);
}

export function selectRecipe(plan, textId) {
  if (plan.selectedRecipes.includes(textId)) return plan;
  return {
    ...plan,
    selectedRecipes: [...plan.selectedRecipes, textId],
    updatedAt: new Date().toISOString(),
  };
}

// Cascades: also drops the recipe's meal tags and chosen portions, so
// re-selecting it later starts clean instead of resurrecting stale state.
export function deselectRecipe(plan, textId) {
  const mealAssignments = { ...plan.mealAssignments };
  delete mealAssignments[textId];
  const selectedPortions = { ...plan.selectedPortions };
  delete selectedPortions[textId];
  return {
    ...plan,
    selectedRecipes: plan.selectedRecipes.filter((id) => id !== textId),
    mealAssignments,
    selectedPortions,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Toggles whether a recipe is tagged for a given meal type. Meal tags are
 * purely informational ("when to eat it") — they never affect ingredient
 * or shopping-list quantities, which are driven solely by selectedPortions
 * and ingredientDecisions (see buildSelectedIngredientsSummary).
 */
export function toggleMealAssignment(plan, textId, mealType) {
  const current = plan.mealAssignments[textId] ?? [];
  const next = current.includes(mealType)
    ? current.filter((mt) => mt !== mealType)
    : [...current, mealType];
  return {
    ...plan,
    mealAssignments: { ...plan.mealAssignments, [textId]: next },
    updatedAt: new Date().toISOString(),
  };
}

/** Sets how many portions of a recipe to cook/buy this cycle. */
export function setSelectedPortions(plan, textId, portions) {
  return {
    ...plan,
    selectedPortions: { ...plan.selectedPortions, [textId]: portions },
    updatedAt: new Date().toISOString(),
  };
}

export function resetPlan(studentId) {
  return createPlan(studentId);
}

/**
 * Sets (or clears, when decision is null) a per-product shopping decision:
 * 'have' ("есть дома") or 'buy' ("надо купить"). Keyed by lowercase product
 * name to match the aggregation key used everywhere else (shoppingListGenerator,
 * buildSelectedIngredientsSummary), so a decision made here carries over to
 * the Покупки screen regardless of which recipe(s) the product came from.
 */
export function setIngredientDecision(plan, productKey, decision) {
  const key = productKey.toLowerCase();
  const next = { ...(plan.ingredientDecisions ?? {}) };
  if (decision) next[key] = decision;
  else delete next[key];
  return { ...plan, ingredientDecisions: next, updatedAt: new Date().toISOString() };
}

/**
 * Aggregates ingredients across every recipe in the selection pool
 * (plan.selectedRecipes). Each recipe contributes exactly once, scaled to
 * its own chosen portions (plan.selectedPortions[textId], defaulting to the
 * recipe's base/fixed portions when never touched) — independent of which
 * meal types (if any) it's tagged for, since those are purely a "when to
 * eat it" label with no bearing on quantities.
 *
 * @param {object} plan
 * @param {Array<{text: {id: string}, portions: number, fixedPortions: number|null, ingredients: Array}>} allRecipes
 * @returns {Array<{product: string, qty: number|null, unit: string|null}>}
 */
export function buildSelectedIngredientsSummary(plan, allRecipes) {
  const map = new Map();

  for (const textId of plan.selectedRecipes) {
    const recipe = allRecipes.find((r) => r.text.id === textId);
    if (!recipe) continue;

    const basePortions = recipe.portions || 1;
    const chosenPortions = recipe.fixedPortions || plan.selectedPortions[textId] || basePortions;
    const scale = chosenPortions / basePortions;

    for (const ing of recipe.ingredients) {
      const key = ing.product.toLowerCase();
      const scaledQty = ing.qty != null ? ing.qty * scale : null;
      if (map.has(key)) {
        const existing = map.get(key);
        if (existing.qty != null && scaledQty != null) existing.qty += scaledQty;
        else existing.qty = null;
      } else {
        map.set(key, { product: ing.product, qty: scaledQty, unit: ing.unit });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Upgrades a plan saved in an old format so old saved plans keep loading
 * correctly:
 * - a legacy day/meal-placement plan (plan.days) is folded into the flat
 *   model: every placement's meal type becomes a mealAssignments tag
 *   (deduplicated per recipe — the day it was on doesn't survive), and its
 *   portions become that recipe's selectedPortions (last placement seen
 *   wins if a recipe was placed more than once with different amounts).
 * - a legacy напитки meal slot (no longer a valid meal type — it's a
 *   browsing-only tag, see RECIPE_TAGS) is folded into перекус, the
 *   least-wrong default for a drink with no real meal assignment.
 * - a missing selectedRecipes pool is backfilled from whatever recipes had
 *   placements, so an in-progress menu doesn't lose its pool view.
 */
export function normalizePlan(plan) {
  if (!plan) return plan;

  if (plan.days) {
    const legacyMultiplier = plan.portionMultiplier ?? 1;
    const mealAssignments = {};
    const selectedPortions = {};

    for (const day of plan.days) {
      for (const [mealType, rawEntries] of Object.entries(day.meals ?? {})) {
        const normalizedType = mealType === 'напитки' ? 'перекус' : mealType;
        if (!MEAL_TYPES.includes(normalizedType)) continue;
        for (const rawEntry of rawEntries ?? []) {
          const entry = typeof rawEntry === 'string'
            ? { textId: rawEntry, portions: legacyMultiplier }
            : rawEntry;
          const tags = mealAssignments[entry.textId] ?? [];
          if (!tags.includes(normalizedType)) {
            mealAssignments[entry.textId] = [...tags, normalizedType];
          }
          if (entry.portions != null) selectedPortions[entry.textId] = entry.portions;
        }
      }
    }

    const selectedRecipes = plan.selectedRecipes ?? Object.keys(mealAssignments);
    const { days, portionMultiplier, ...rest } = plan;

    return {
      ...rest,
      selectedRecipes,
      mealAssignments,
      selectedPortions,
      ingredientDecisions: plan.ingredientDecisions ?? {},
    };
  }

  return {
    ...plan,
    mealAssignments: plan.mealAssignments ?? {},
    selectedPortions: plan.selectedPortions ?? {},
    ingredientDecisions: plan.ingredientDecisions ?? {},
  };
}
