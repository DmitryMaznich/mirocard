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
 * Sets which single meal type a recipe is tagged for ("when to eat it") —
 * tapping the already-active meal type clears it back to none. Only one
 * meal type can be assigned per recipe at a time. Purely informational:
 * it never affects ingredient or shopping-list quantities, which are
 * driven solely by selectedPortions and ingredientDecisions (see
 * buildSelectedIngredientsSummary).
 */
export function setMealAssignment(plan, textId, mealType) {
  const current = plan.mealAssignments[textId] ?? null;
  const next = { ...plan.mealAssignments };
  if (current === mealType) delete next[textId];
  else next[textId] = mealType;
  return {
    ...plan,
    mealAssignments: next,
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

// Gate for Меню -> Покупки (and the hub's "done" badge on Меню): every
// ingredient across the selected recipes must have an explicit Дома/Купить
// decision, and there must be at least one ingredient to decide on.
export function isMenuFullyDecided(plan, allRecipes) {
  const items = buildSelectedIngredientsSummary(plan, allRecipes);
  return items.length > 0 && items.every(
    (item) => !!plan.ingredientDecisions[item.product.toLowerCase()]
  );
}

/**
 * Upgrades a plan saved in an old format so old saved plans keep loading
 * correctly:
 * - a legacy day/meal-placement plan (plan.days) is folded into the flat
 *   model: each recipe gets at most one meal-type tag (last placement seen
 *   wins if it was placed under more than one meal type), and its portions
 *   become that recipe's selectedPortions (also last placement wins).
 * - a legacy напитки meal slot (no longer a valid meal type — it's a
 *   browsing-only tag, see RECIPE_TAGS) is folded into перекус, the
 *   least-wrong default for a drink with no real meal assignment.
 * - a legacy multi-select mealAssignments array (briefly the shape before
 *   this became single-select) collapses to its last entry.
 * - a missing selectedRecipes pool is backfilled from whatever recipes had
 *   placements, so an in-progress menu doesn't lose its pool view.
 */
export function getPlanRecipes(plan) {
  return plan?.selectedRecipes ?? [];
}

export function countPlanRecipes(plan) {
  return (plan?.selectedRecipes ?? []).length;
}

function collapseMealAssignments(raw) {
  const collapsed = {};
  for (const [textId, value] of Object.entries(raw ?? {})) {
    collapsed[textId] = Array.isArray(value) ? (value[value.length - 1] ?? null) : value;
  }
  return collapsed;
}

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
          mealAssignments[entry.textId] = normalizedType;
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
    mealAssignments: collapseMealAssignments(plan.mealAssignments),
    selectedPortions: plan.selectedPortions ?? {},
    ingredientDecisions: plan.ingredientDecisions ?? {},
  };
}
