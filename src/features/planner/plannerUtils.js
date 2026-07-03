export const MEAL_TYPES = ['завтрак', 'обед', 'ужин', 'перекус'];
export const RECIPE_TAGS = [...MEAL_TYPES, 'напитки'];

export function createPlan(studentId) {
  return {
    id: crypto.randomUUID(),
    studentId,
    status: 'draft',
    selectedRecipes: [],
    ingredientDecisions: {},
    days: [createDay(0)],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createDay(dayIndex) {
  const meals = {};
  for (const type of MEAL_TYPES) meals[type] = [];
  return { dayIndex, meals };
}

export function addDay(plan) {
  return {
    ...plan,
    days: [...plan.days, createDay(plan.days.length)],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Places a recipe into a day/meal slot with a given portion count. If the
 * recipe is already in that exact slot, its portion count is updated
 * in place rather than creating a duplicate entry.
 */
export function addRecipeToMeal(plan, dayIndex, mealType, textId, portions = 1) {
  return {
    ...plan,
    days: plan.days.map((day) => {
      if (day.dayIndex !== dayIndex) return day;
      const existing = day.meals[mealType] ?? [];
      const alreadyPlaced = existing.some((entry) => entry.textId === textId);
      const nextEntries = alreadyPlaced
        ? existing.map((entry) => (entry.textId === textId ? { textId, portions } : entry))
        : [...existing, { textId, portions }];
      return { ...day, meals: { ...day.meals, [mealType]: nextEntries } };
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function removeRecipeFromMeal(plan, dayIndex, mealType, textId) {
  return {
    ...plan,
    days: plan.days.map((day) => {
      if (day.dayIndex !== dayIndex) return day;
      return {
        ...day,
        meals: {
          ...day.meals,
          [mealType]: (day.meals[mealType] ?? []).filter((entry) => entry.textId !== textId),
        },
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * One entry per day/meal placement (not deduplicated by recipe) — each
 * placement carries its own portion count, so a recipe used twice with
 * different portions contributes two correctly-scaled shopping list lines.
 */
export function getPlanRecipes(plan) {
  const result = [];
  for (const day of plan.days) {
    for (const entries of Object.values(day.meals)) {
      for (const entry of entries) {
        result.push({ textId: entry.textId, portionMultiplier: entry.portions });
      }
    }
  }
  return result;
}

/** All day/meal slots a given recipe is currently placed in, with its portions in each. */
export function findRecipePlacements(plan, textId) {
  const placements = [];
  for (const day of plan.days) {
    for (const [mealType, entries] of Object.entries(day.meals)) {
      for (const entry of entries) {
        if (entry.textId === textId) {
          placements.push({ dayIndex: day.dayIndex, mealType, portions: entry.portions });
        }
      }
    }
  }
  return placements;
}

export function countPlanRecipes(plan) {
  const seen = new Set();
  for (const day of plan.days) {
    for (const entries of Object.values(day.meals)) {
      entries.forEach((entry) => seen.add(entry.textId));
    }
  }
  return seen.size;
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

// Cascades: strips every placement of textId from every day, via the same
// removeRecipeFromMeal used everywhere else, so there's one code path for
// "a recipe leaves the schedule".
export function deselectRecipe(plan, textId) {
  let next = { ...plan, selectedRecipes: plan.selectedRecipes.filter((id) => id !== textId) };
  for (const day of plan.days) {
    for (const mealType of MEAL_TYPES) {
      next = removeRecipeFromMeal(next, day.dayIndex, mealType, textId);
    }
  }
  return next;
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
 * (plan.selectedRecipes), not just ones already placed on a day/meal — a
 * recipe with no placement yet still contributes one batch at its own base
 * portions, so the summary reflects "everything I want to cook", matching
 * the pool's own meaning. A recipe placed on multiple days/meals contributes
 * once per placement, scaled to that placement's own portions (same
 * aggregation shape as shoppingListGenerator.generateShoppingList).
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
    const placements = findRecipePlacements(plan, textId);
    const portionsList = placements.length > 0
      ? placements.map((p) => p.portions)
      : [recipe.fixedPortions || recipe.portions || 1];

    for (const chosenPortions of portionsList) {
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
  }

  return Array.from(map.values());
}

/**
 * Upgrades a plan saved in an old format so old saved plans keep loading
 * correctly:
 * - day.meals[type] entries that are bare strings become {textId, portions}.
 * - a legacy напитки slot (no longer a valid day.meals key — it's a
 *   browsing-only tag, see RECIPE_TAGS) is folded into перекус, the
 *   least-wrong default for a drink with no real meal assignment.
 * - a missing selectedRecipes pool is backfilled from existing placements,
 *   so an in-progress menu doesn't lose its pool view.
 */
export function normalizePlan(plan) {
  if (!plan) return plan;
  const legacyMultiplier = plan.portionMultiplier ?? 1;

  const days = plan.days.map((day) => {
    const meals = {};
    for (const type of MEAL_TYPES) {
      const raw = day.meals[type] ?? [];
      meals[type] = raw.map((entry) =>
        typeof entry === 'string' ? { textId: entry, portions: legacyMultiplier } : entry
      );
    }
    const legacyDrinks = day.meals['напитки'];
    if (Array.isArray(legacyDrinks) && legacyDrinks.length > 0) {
      const normalizedDrinks = legacyDrinks.map((entry) =>
        typeof entry === 'string' ? { textId: entry, portions: legacyMultiplier } : entry
      );
      meals['перекус'] = [...meals['перекус'], ...normalizedDrinks];
    }
    return { ...day, meals };
  });

  let selectedRecipes = plan.selectedRecipes;
  if (!selectedRecipes) {
    const seen = new Set();
    for (const day of days) {
      for (const entries of Object.values(day.meals)) {
        entries.forEach((entry) => seen.add(entry.textId));
      }
    }
    selectedRecipes = [...seen];
  }

  const ingredientDecisions = plan.ingredientDecisions ?? {};

  return { ...plan, days, selectedRecipes, ingredientDecisions };
}
