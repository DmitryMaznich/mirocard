export const MEAL_TYPES = ['завтрак', 'обед', 'ужин', 'перекус'];

export function createPlan(studentId, portionMultiplier = 1) {
  return {
    id: crypto.randomUUID(),
    studentId,
    portionMultiplier,
    status: 'draft',
    days: [createDay(0)],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createDay(dayIndex) {
  return {
    dayIndex,
    meals: { завтрак: [], обед: [], ужин: [], перекус: [] },
  };
}

export function addDay(plan) {
  return {
    ...plan,
    days: [...plan.days, createDay(plan.days.length)],
    updatedAt: new Date().toISOString(),
  };
}

export function addRecipeToMeal(plan, dayIndex, mealType, textId) {
  return {
    ...plan,
    days: plan.days.map((day) => {
      if (day.dayIndex !== dayIndex) return day;
      const existing = day.meals[mealType] ?? [];
      if (existing.includes(textId)) return day;
      return { ...day, meals: { ...day.meals, [mealType]: [...existing, textId] } };
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
          [mealType]: (day.meals[mealType] ?? []).filter((id) => id !== textId),
        },
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function getPlanRecipes(plan) {
  const seen = new Set();
  const result = [];
  for (const day of plan.days) {
    for (const textIds of Object.values(day.meals)) {
      for (const textId of textIds) {
        if (!seen.has(textId)) {
          seen.add(textId);
          result.push({ textId, portionMultiplier: plan.portionMultiplier });
        }
      }
    }
  }
  return result;
}

export function countPlanRecipes(plan) {
  const seen = new Set();
  for (const day of plan.days) {
    for (const textIds of Object.values(day.meals)) {
      textIds.forEach((id) => seen.add(id));
    }
  }
  return seen.size;
}
