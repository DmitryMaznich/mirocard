import { describe, it, expect } from 'vitest';
import {
  MEAL_TYPES,
  RECIPE_TAGS,
  createPlan,
  createDay,
  addDay,
  addRecipeToMeal,
  removeRecipeFromMeal,
  getPlanRecipes,
  countPlanRecipes,
  findRecipePlacements,
  isRecipeSelected,
  selectRecipe,
  deselectRecipe,
  resetPlan,
  normalizePlan,
} from './plannerUtils.js';

describe('MEAL_TYPES', () => {
  it('contains the four schedulable meal types', () => {
    expect(MEAL_TYPES).toEqual(['завтрак', 'обед', 'ужин', 'перекус']);
  });
});

describe('RECIPE_TAGS', () => {
  it('extends MEAL_TYPES with напитки as a browsing-only tag', () => {
    expect(RECIPE_TAGS).toEqual(['завтрак', 'обед', 'ужин', 'перекус', 'напитки']);
  });
});

describe('createPlan', () => {
  it('creates a plan with one day and correct defaults', () => {
    const plan = createPlan('student1');
    expect(plan.studentId).toBe('student1');
    expect(plan.status).toBe('draft');
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].dayIndex).toBe(0);
    expect(typeof plan.id).toBe('string');
    expect(plan.id.length).toBeGreaterThan(0);
  });

  it('starts all meals empty', () => {
    const plan = createPlan('s1');
    for (const type of MEAL_TYPES) {
      expect(plan.days[0].meals[type]).toEqual([]);
    }
  });

  it('starts with an empty selectedRecipes pool', () => {
    const plan = createPlan('s1');
    expect(plan.selectedRecipes).toEqual([]);
  });
});

describe('createDay', () => {
  it('creates a day with the given dayIndex and all empty meals', () => {
    const day = createDay(3);
    expect(day.dayIndex).toBe(3);
    for (const type of MEAL_TYPES) {
      expect(day.meals[type]).toEqual([]);
    }
  });
});

describe('addDay', () => {
  it('appends a day with dayIndex equal to the current length', () => {
    const plan = createPlan('s1');
    const updated = addDay(plan);
    expect(updated.days).toHaveLength(2);
    expect(updated.days[1].dayIndex).toBe(1);
  });

  it('does not mutate the original plan', () => {
    const plan = createPlan('s1');
    addDay(plan);
    expect(plan.days).toHaveLength(1);
  });

  it('updatedAt is a valid ISO string', () => {
    const plan = createPlan('s1');
    const updated = addDay(plan);
    expect(() => new Date(updated.updatedAt)).not.toThrow();
  });
});

describe('addRecipeToMeal', () => {
  it('adds recipe to the correct meal on the correct day with its portions', () => {
    const plan = createPlan('s1');
    const updated = addRecipeToMeal(plan, 0, 'обед', 'soup_01', 2);
    expect(updated.days[0].meals['обед']).toEqual([{ textId: 'soup_01', portions: 2 }]);
  });

  it('defaults portions to 1 when not given', () => {
    const plan = createPlan('s1');
    const updated = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
    expect(updated.days[0].meals['обед']).toEqual([{ textId: 'soup_01', portions: 1 }]);
  });

  it('updates portions in place when the same recipe is re-added to the same slot', () => {
    const plan = createPlan('s1');
    const p1 = addRecipeToMeal(plan, 0, 'обед', 'soup_01', 2);
    const p2 = addRecipeToMeal(p1, 0, 'обед', 'soup_01', 4);
    expect(p2.days[0].meals['обед']).toEqual([{ textId: 'soup_01', portions: 4 }]);
  });

  it('does not affect other meal types on the same day', () => {
    const plan = createPlan('s1');
    const updated = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
    expect(updated.days[0].meals['завтрак']).toEqual([]);
  });

  it('does not affect other days', () => {
    const plan = addDay(createPlan('s1'));
    const updated = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
    expect(updated.days[1].meals['обед']).toEqual([]);
  });

  it('does not mutate the original plan', () => {
    const plan = createPlan('s1');
    addRecipeToMeal(plan, 0, 'обед', 'soup_01');
    expect(plan.days[0].meals['обед']).toEqual([]);
  });
});

describe('removeRecipeFromMeal', () => {
  it('removes the specified recipe', () => {
    const plan = createPlan('s1');
    const p1 = addRecipeToMeal(plan, 0, 'ужин', 'chicken_01');
    const p2 = removeRecipeFromMeal(p1, 0, 'ужин', 'chicken_01');
    expect(p2.days[0].meals['ужин']).toHaveLength(0);
  });

  it('keeps other recipes in the same meal', () => {
    const plan = createPlan('s1');
    const p1 = addRecipeToMeal(plan, 0, 'ужин', 'chicken_01', 2);
    const p2 = addRecipeToMeal(p1, 0, 'ужин', 'salad_01', 1);
    const p3 = removeRecipeFromMeal(p2, 0, 'ужин', 'chicken_01');
    expect(p3.days[0].meals['ужин']).toEqual([{ textId: 'salad_01', portions: 1 }]);
  });

  it('is a no-op when recipe is not present', () => {
    const plan = createPlan('s1');
    const updated = removeRecipeFromMeal(plan, 0, 'обед', 'nonexistent');
    expect(updated.days[0].meals['обед']).toEqual([]);
  });
});

describe('getPlanRecipes', () => {
  it('returns one entry per placement with its own portions', () => {
    const plan = createPlan('s1');
    const p1 = addRecipeToMeal(plan, 0, 'завтрак', 'oatmeal_01', 2);
    const p2 = addRecipeToMeal(p1, 0, 'обед', 'soup_01', 3);
    const recipes = getPlanRecipes(p2);
    expect(recipes).toHaveLength(2);
    expect(recipes).toContainEqual({ textId: 'oatmeal_01', portionMultiplier: 2 });
    expect(recipes).toContainEqual({ textId: 'soup_01', portionMultiplier: 3 });
  });

  it('does not deduplicate the same recipe placed on multiple days — each keeps its own portions', () => {
    const plan = createPlan('s1');
    const p1 = addRecipeToMeal(plan, 0, 'обед', 'soup_01', 2);
    const p2 = addRecipeToMeal(addDay(p1), 1, 'обед', 'soup_01', 5);
    const recipes = getPlanRecipes(p2);
    expect(recipes).toHaveLength(2);
    expect(recipes).toContainEqual({ textId: 'soup_01', portionMultiplier: 2 });
    expect(recipes).toContainEqual({ textId: 'soup_01', portionMultiplier: 5 });
  });

  it('returns empty array for a plan with no recipes', () => {
    expect(getPlanRecipes(createPlan('s1'))).toEqual([]);
  });
});

describe('countPlanRecipes', () => {
  it('counts unique recipes across all days and meals', () => {
    const plan = createPlan('s1');
    const p1 = addRecipeToMeal(plan, 0, 'завтрак', 'a');
    const p2 = addRecipeToMeal(p1, 0, 'обед', 'b');
    const p3 = addRecipeToMeal(addDay(p2), 1, 'ужин', 'a'); // duplicate
    expect(countPlanRecipes(p3)).toBe(2);
  });

  it('returns 0 for an empty plan', () => {
    expect(countPlanRecipes(createPlan('s1'))).toBe(0);
  });
});

describe('findRecipePlacements', () => {
  it('finds every day/meal slot a recipe is placed in', () => {
    const plan = createPlan('s1');
    const p1 = addRecipeToMeal(plan, 0, 'завтрак', 'soup_01', 2);
    const p2 = addRecipeToMeal(addDay(p1), 1, 'ужин', 'soup_01', 5);
    const placements = findRecipePlacements(p2, 'soup_01');
    expect(placements).toHaveLength(2);
    expect(placements).toContainEqual({ dayIndex: 0, mealType: 'завтрак', portions: 2 });
    expect(placements).toContainEqual({ dayIndex: 1, mealType: 'ужин', portions: 5 });
  });

  it('returns an empty array when the recipe is not placed anywhere', () => {
    expect(findRecipePlacements(createPlan('s1'), 'nope')).toEqual([]);
  });
});

describe('isRecipeSelected', () => {
  it('returns false for a recipe not in the pool', () => {
    const plan = createPlan('s1');
    expect(isRecipeSelected(plan, 'soup_01')).toBe(false);
  });

  it('returns true once the recipe has been selected', () => {
    const plan = selectRecipe(createPlan('s1'), 'soup_01');
    expect(isRecipeSelected(plan, 'soup_01')).toBe(true);
  });
});

describe('selectRecipe', () => {
  it('adds the recipe to selectedRecipes', () => {
    const plan = selectRecipe(createPlan('s1'), 'soup_01');
    expect(plan.selectedRecipes).toEqual(['soup_01']);
  });

  it('is idempotent when the recipe is already selected', () => {
    const plan = selectRecipe(createPlan('s1'), 'soup_01');
    const again = selectRecipe(plan, 'soup_01');
    expect(again.selectedRecipes).toEqual(['soup_01']);
  });

  it('does not mutate the original plan', () => {
    const plan = createPlan('s1');
    selectRecipe(plan, 'soup_01');
    expect(plan.selectedRecipes).toEqual([]);
  });
});

describe('deselectRecipe', () => {
  it('removes the recipe from selectedRecipes', () => {
    const plan = selectRecipe(createPlan('s1'), 'soup_01');
    const updated = deselectRecipe(plan, 'soup_01');
    expect(updated.selectedRecipes).toEqual([]);
  });

  it('cascades: removes every placement of that recipe from every day', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = addRecipeToMeal(plan, 0, 'обед', 'soup_01', 2);
    plan = addDay(plan);
    plan = addRecipeToMeal(plan, 1, 'ужин', 'soup_01', 1);

    const updated = deselectRecipe(plan, 'soup_01');
    expect(findRecipePlacements(updated, 'soup_01')).toEqual([]);
  });

  it('leaves other recipes and their placements untouched', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = selectRecipe(plan, 'salad_01');
    plan = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
    plan = addRecipeToMeal(plan, 0, 'обед', 'salad_01');

    const updated = deselectRecipe(plan, 'soup_01');
    expect(updated.selectedRecipes).toEqual(['salad_01']);
    expect(updated.days[0].meals['обед']).toEqual([{ textId: 'salad_01', portions: 1 }]);
  });

  it('is a no-op when the recipe was never selected', () => {
    const plan = createPlan('s1');
    const updated = deselectRecipe(plan, 'nonexistent');
    expect(updated.selectedRecipes).toEqual([]);
  });
});

describe('resetPlan', () => {
  it('returns a fresh plan for the same student', () => {
    const fresh = resetPlan('student1');
    expect(fresh.studentId).toBe('student1');
    expect(fresh.selectedRecipes).toEqual([]);
    expect(fresh.days).toHaveLength(1);
  });

  it('is independent of any prior in-progress plan', () => {
    let plan = selectRecipe(createPlan('student1'), 'soup_01');
    plan = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
    const fresh = resetPlan('student1');
    expect(fresh.selectedRecipes).toEqual([]);
    expect(fresh.days[0].meals['обед']).toEqual([]);
  });
});

describe('normalizePlan', () => {
  it('upgrades legacy string-array meals to {textId, portions} objects', () => {
    const legacy = {
      id: 'p1',
      studentId: 's1',
      portionMultiplier: 3,
      status: 'draft',
      days: [{ dayIndex: 0, meals: { завтрак: ['oatmeal_01'], обед: [], ужин: [], перекус: [] } }],
    };
    const normalized = normalizePlan(legacy);
    expect(normalized.days[0].meals['завтрак']).toEqual([{ textId: 'oatmeal_01', portions: 3 }]);
  });

  it('migrates a legacy напитки slot into перекус and drops the напитки key', () => {
    const legacy = {
      id: 'p1',
      studentId: 's1',
      days: [{
        dayIndex: 0,
        meals: {
          завтрак: [], обед: [], ужин: [],
          перекус: [{ textId: 'apple_01', portions: 1 }],
          напитки: [{ textId: 'kompot_01', portions: 2 }],
        },
      }],
    };
    const normalized = normalizePlan(legacy);
    expect(normalized.days[0].meals['перекус']).toEqual([
      { textId: 'apple_01', portions: 1 },
      { textId: 'kompot_01', portions: 2 },
    ]);
    expect(normalized.days[0].meals['напитки']).toBeUndefined();
  });

  it('backfills selectedRecipes from existing placements when absent', () => {
    const legacy = {
      id: 'p1',
      studentId: 's1',
      days: [
        { dayIndex: 0, meals: { завтрак: [{ textId: 'oatmeal_01', portions: 1 }], обед: [], ужин: [], перекус: [] } },
        { dayIndex: 1, meals: { завтрак: [], обед: [{ textId: 'oatmeal_01', portions: 2 }], ужин: [], перекус: [] } },
      ],
    };
    const normalized = normalizePlan(legacy);
    expect(normalized.selectedRecipes).toEqual(['oatmeal_01']);
  });

  it('leaves an existing selectedRecipes array untouched', () => {
    const plan = selectRecipe(createPlan('s1'), 'soup_01');
    const normalized = normalizePlan(plan);
    expect(normalized.selectedRecipes).toEqual(['soup_01']);
  });

  it('leaves already-normalized plans unchanged', () => {
    const plan = addRecipeToMeal(createPlan('s1'), 0, 'обед', 'soup_01', 2);
    const normalized = normalizePlan(plan);
    expect(normalized.days[0].meals['обед']).toEqual([{ textId: 'soup_01', portions: 2 }]);
  });

  it('returns null/undefined as-is', () => {
    expect(normalizePlan(null)).toBeNull();
  });
});
