import { describe, it, expect } from 'vitest';
import {
  MEAL_TYPES,
  createPlan,
  createDay,
  addDay,
  addRecipeToMeal,
  removeRecipeFromMeal,
  getPlanRecipes,
  countPlanRecipes,
} from './plannerUtils.js';

describe('MEAL_TYPES', () => {
  it('contains all four meal types', () => {
    expect(MEAL_TYPES).toEqual(['завтрак', 'обед', 'ужин', 'перекус']);
  });
});

describe('createPlan', () => {
  it('creates a plan with one day and correct defaults', () => {
    const plan = createPlan('student1', 2);
    expect(plan.studentId).toBe('student1');
    expect(plan.portionMultiplier).toBe(2);
    expect(plan.status).toBe('draft');
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].dayIndex).toBe(0);
    expect(typeof plan.id).toBe('string');
    expect(plan.id.length).toBeGreaterThan(0);
  });

  it('defaults portionMultiplier to 1', () => {
    const plan = createPlan('s1');
    expect(plan.portionMultiplier).toBe(1);
  });

  it('starts all meals empty', () => {
    const plan = createPlan('s1');
    for (const type of MEAL_TYPES) {
      expect(plan.days[0].meals[type]).toEqual([]);
    }
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
  it('adds recipe to the correct meal on the correct day', () => {
    const plan = createPlan('s1');
    const updated = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
    expect(updated.days[0].meals['обед']).toContain('soup_01');
  });

  it('does not add a recipe that is already present', () => {
    const plan = createPlan('s1');
    const p1 = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
    const p2 = addRecipeToMeal(p1, 0, 'обед', 'soup_01');
    expect(p2.days[0].meals['обед']).toHaveLength(1);
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
    const p1 = addRecipeToMeal(plan, 0, 'ужин', 'chicken_01');
    const p2 = addRecipeToMeal(p1, 0, 'ужин', 'salad_01');
    const p3 = removeRecipeFromMeal(p2, 0, 'ужин', 'chicken_01');
    expect(p3.days[0].meals['ужин']).toEqual(['salad_01']);
  });

  it('is a no-op when recipe is not present', () => {
    const plan = createPlan('s1');
    const updated = removeRecipeFromMeal(plan, 0, 'обед', 'nonexistent');
    expect(updated.days[0].meals['обед']).toEqual([]);
  });
});

describe('getPlanRecipes', () => {
  it('returns all unique recipes with portionMultiplier', () => {
    const plan = createPlan('s1', 3);
    const p1 = addRecipeToMeal(plan, 0, 'завтрак', 'oatmeal_01');
    const p2 = addRecipeToMeal(p1, 0, 'обед', 'soup_01');
    const recipes = getPlanRecipes(p2);
    expect(recipes).toHaveLength(2);
    expect(recipes[0]).toEqual({ textId: 'oatmeal_01', portionMultiplier: 3 });
    expect(recipes[1]).toEqual({ textId: 'soup_01', portionMultiplier: 3 });
  });

  it('deduplicates the same recipe across multiple days', () => {
    const plan = createPlan('s1');
    const p1 = addRecipeToMeal(plan, 0, 'обед', 'soup_01');
    const p2 = addRecipeToMeal(addDay(p1), 1, 'обед', 'soup_01');
    expect(getPlanRecipes(p2)).toHaveLength(1);
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
