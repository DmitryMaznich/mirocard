export const MEAL_TYPES = ['завтрак', 'обед', 'ужин', 'перекус', 'напитки'];

export function createPlan(studentId) {
  return {
    id: crypto.randomUUID(),
    studentId,
    status: 'draft',
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

/**
 * Upgrades a plan saved in the old format (day.meals[type] as an array of
 * bare recipe-text-id strings) to the current format (array of
 * {textId, portions} objects), so old saved plans keep loading correctly.
 */
export function normalizePlan(plan) {
  if (!plan) return plan;
  const legacyMultiplier = plan.portionMultiplier ?? 1;
  return {
    ...plan,
    days: plan.days.map((day) => {
      const meals = {};
      for (const type of MEAL_TYPES) {
        const raw = day.meals[type] ?? [];
        meals[type] = raw.map((entry) =>
          typeof entry === 'string' ? { textId: entry, portions: legacyMultiplier } : entry
        );
      }
      return { ...day, meals };
    }),
  };
}
