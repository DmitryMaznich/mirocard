import { describe, it, expect } from 'vitest';
import {
  MEAL_TYPES,
  RECIPE_TAGS,
  createPlan,
  getPlanRecipes,
  countPlanRecipes,
  isRecipeSelected,
  selectRecipe,
  deselectRecipe,
  toggleMealAssignment,
  setSelectedPortions,
  resetPlan,
  normalizePlan,
  setIngredientDecision,
  buildSelectedIngredientsSummary,
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
  it('creates a plan with correct defaults', () => {
    const plan = createPlan('student1');
    expect(plan.studentId).toBe('student1');
    expect(plan.status).toBe('draft');
    expect(typeof plan.id).toBe('string');
    expect(plan.id.length).toBeGreaterThan(0);
  });

  it('starts with an empty selectedRecipes pool', () => {
    const plan = createPlan('s1');
    expect(plan.selectedRecipes).toEqual([]);
  });

  it('starts with no meal assignments or chosen portions', () => {
    const plan = createPlan('s1');
    expect(plan.mealAssignments).toEqual({});
    expect(plan.selectedPortions).toEqual({});
  });

  it('starts with no ingredient decisions', () => {
    const plan = createPlan('s1');
    expect(plan.ingredientDecisions).toEqual({});
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

  it('drops the recipe\'s meal tags and chosen portions', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = toggleMealAssignment(plan, 'soup_01', 'обед');
    plan = setSelectedPortions(plan, 'soup_01', 6);

    const updated = deselectRecipe(plan, 'soup_01');
    expect(updated.mealAssignments['soup_01']).toBeUndefined();
    expect(updated.selectedPortions['soup_01']).toBeUndefined();
  });

  it('leaves other recipes and their state untouched', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = selectRecipe(plan, 'salad_01');
    plan = toggleMealAssignment(plan, 'soup_01', 'обед');
    plan = toggleMealAssignment(plan, 'salad_01', 'ужин');

    const updated = deselectRecipe(plan, 'soup_01');
    expect(updated.selectedRecipes).toEqual(['salad_01']);
    expect(updated.mealAssignments['salad_01']).toEqual(['ужин']);
  });

  it('is a no-op when the recipe was never selected', () => {
    const plan = createPlan('s1');
    const updated = deselectRecipe(plan, 'nonexistent');
    expect(updated.selectedRecipes).toEqual([]);
  });
});

describe('toggleMealAssignment', () => {
  it('adds a meal tag when not present', () => {
    const plan = toggleMealAssignment(createPlan('s1'), 'soup_01', 'обед');
    expect(plan.mealAssignments['soup_01']).toEqual(['обед']);
  });

  it('removes a meal tag when already present (toggle off)', () => {
    let plan = toggleMealAssignment(createPlan('s1'), 'soup_01', 'обед');
    plan = toggleMealAssignment(plan, 'soup_01', 'обед');
    expect(plan.mealAssignments['soup_01']).toEqual([]);
  });

  it('supports multiple meal tags on the same recipe', () => {
    let plan = toggleMealAssignment(createPlan('s1'), 'soup_01', 'обед');
    plan = toggleMealAssignment(plan, 'soup_01', 'ужин');
    expect(plan.mealAssignments['soup_01']).toEqual(['обед', 'ужин']);
  });

  it('does not affect other recipes\' tags', () => {
    let plan = toggleMealAssignment(createPlan('s1'), 'soup_01', 'обед');
    plan = toggleMealAssignment(plan, 'salad_01', 'ужин');
    expect(plan.mealAssignments['soup_01']).toEqual(['обед']);
    expect(plan.mealAssignments['salad_01']).toEqual(['ужин']);
  });

  it('does not mutate the original plan', () => {
    const plan = createPlan('s1');
    toggleMealAssignment(plan, 'soup_01', 'обед');
    expect(plan.mealAssignments).toEqual({});
  });
});

describe('setSelectedPortions', () => {
  it('sets the chosen portions for a recipe', () => {
    const plan = setSelectedPortions(createPlan('s1'), 'soup_01', 6);
    expect(plan.selectedPortions['soup_01']).toBe(6);
  });

  it('overwrites a previous value', () => {
    let plan = setSelectedPortions(createPlan('s1'), 'soup_01', 6);
    plan = setSelectedPortions(plan, 'soup_01', 2);
    expect(plan.selectedPortions['soup_01']).toBe(2);
  });

  it('does not affect other recipes\' portions', () => {
    let plan = setSelectedPortions(createPlan('s1'), 'soup_01', 6);
    plan = setSelectedPortions(plan, 'salad_01', 3);
    expect(plan.selectedPortions).toEqual({ soup_01: 6, salad_01: 3 });
  });

  it('does not mutate the original plan', () => {
    const plan = createPlan('s1');
    setSelectedPortions(plan, 'soup_01', 6);
    expect(plan.selectedPortions).toEqual({});
  });
});

describe('setIngredientDecision', () => {
  it('sets a decision for a product, keyed lowercase', () => {
    const plan = setIngredientDecision(createPlan('s1'), 'Картошка', 'have');
    expect(plan.ingredientDecisions).toEqual({ 'картошка': 'have' });
  });

  it('overwrites an existing decision for the same product', () => {
    let plan = setIngredientDecision(createPlan('s1'), 'картошка', 'have');
    plan = setIngredientDecision(plan, 'картошка', 'buy');
    expect(plan.ingredientDecisions).toEqual({ 'картошка': 'buy' });
  });

  it('clears the decision (back to neutral) when passed null', () => {
    let plan = setIngredientDecision(createPlan('s1'), 'картошка', 'have');
    plan = setIngredientDecision(plan, 'картошка', null);
    expect(plan.ingredientDecisions).toEqual({});
  });

  it('does not affect decisions for other products', () => {
    let plan = setIngredientDecision(createPlan('s1'), 'картошка', 'have');
    plan = setIngredientDecision(plan, 'лук', 'buy');
    expect(plan.ingredientDecisions).toEqual({ 'картошка': 'have', 'лук': 'buy' });
  });

  it('does not mutate the original plan', () => {
    const plan = createPlan('s1');
    setIngredientDecision(plan, 'картошка', 'have');
    expect(plan.ingredientDecisions).toEqual({});
  });
});

describe('buildSelectedIngredientsSummary', () => {
  const soup = {
    text: { id: 'soup_01' },
    portions: 4,
    fixedPortions: null,
    ingredients: [
      { product: 'картошка', qty: 4, unit: 'шт' },
      { product: 'соль', qty: null, unit: null },
    ],
  };
  const kompot = {
    text: { id: 'kompot_01' },
    portions: 2,
    fixedPortions: null,
    ingredients: [
      { product: 'ягоды', qty: 1, unit: 'стакан' },
    ],
  };

  it('uses the recipe\'s own base portions when the stepper was never touched', () => {
    const plan = selectRecipe(createPlan('s1'), 'soup_01');
    const summary = buildSelectedIngredientsSummary(plan, [soup]);
    expect(summary).toContainEqual({ product: 'картошка', qty: 4, unit: 'шт' });
    expect(summary).toContainEqual({ product: 'соль', qty: null, unit: null });
  });

  it('scales by selectedPortions when explicitly chosen', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setSelectedPortions(plan, 'soup_01', 8); // double the base of 4
    const summary = buildSelectedIngredientsSummary(plan, [soup]);
    expect(summary).toContainEqual({ product: 'картошка', qty: 8, unit: 'шт' });
  });

  it('is independent of how many meal types the recipe is tagged for', () => {
    let plan = selectRecipe(createPlan('s1'), 'kompot_01');
    plan = setSelectedPortions(plan, 'kompot_01', 4); // double the base of 2
    plan = toggleMealAssignment(plan, 'kompot_01', 'завтрак');
    plan = toggleMealAssignment(plan, 'kompot_01', 'перекус');
    const summary = buildSelectedIngredientsSummary(plan, [kompot]);
    // Tagged for two meals, but the batch is still just one — 4 portions,
    // not 8 — because meal tags never affect quantities.
    expect(summary).toContainEqual({ product: 'ягоды', qty: 2, unit: 'стакан' });
  });

  it('contributes even when the recipe has no meal tags at all', () => {
    const plan = selectRecipe(createPlan('s1'), 'kompot_01');
    const summary = buildSelectedIngredientsSummary(plan, [kompot]);
    expect(summary).toContainEqual({ product: 'ягоды', qty: 1, unit: 'стакан' });
  });

  it('merges the same ingredient across different selected recipes', () => {
    const potatoDish = {
      text: { id: 'potato_01' },
      portions: 2,
      fixedPortions: null,
      ingredients: [{ product: 'картошка', qty: 2, unit: 'шт' }],
    };
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = selectRecipe(plan, 'potato_01');
    const summary = buildSelectedIngredientsSummary(plan, [soup, potatoDish]);
    expect(summary).toContainEqual({ product: 'картошка', qty: 6, unit: 'шт' });
  });

  it('skips a selected recipe missing from allRecipes without crashing', () => {
    const plan = selectRecipe(createPlan('s1'), 'unknown_recipe');
    expect(() => buildSelectedIngredientsSummary(plan, [soup])).not.toThrow();
    expect(buildSelectedIngredientsSummary(plan, [soup])).toEqual([]);
  });

  it('returns an empty array for an empty pool', () => {
    expect(buildSelectedIngredientsSummary(createPlan('s1'), [soup])).toEqual([]);
  });
});

describe('getPlanRecipes', () => {
  it('returns the selected recipe pool', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = selectRecipe(plan, 'salad_01');
    expect(getPlanRecipes(plan)).toEqual(['soup_01', 'salad_01']);
  });

  it('returns an empty array for a plan with no recipes', () => {
    expect(getPlanRecipes(createPlan('s1'))).toEqual([]);
  });
});

describe('countPlanRecipes', () => {
  it('counts the selected recipe pool', () => {
    let plan = selectRecipe(createPlan('s1'), 'a');
    plan = selectRecipe(plan, 'b');
    expect(countPlanRecipes(plan)).toBe(2);
  });

  it('returns 0 for an empty plan', () => {
    expect(countPlanRecipes(createPlan('s1'))).toBe(0);
  });
});

describe('resetPlan', () => {
  it('returns a fresh plan for the same student', () => {
    const fresh = resetPlan('student1');
    expect(fresh.studentId).toBe('student1');
    expect(fresh.selectedRecipes).toEqual([]);
  });

  it('does not mutate or depend on any existing in-progress plan', () => {
    let plan = selectRecipe(createPlan('student1'), 'soup_01');
    plan = toggleMealAssignment(plan, 'soup_01', 'обед');
    const fresh = resetPlan('student1');
    expect(fresh.selectedRecipes).toEqual([]);
    expect(fresh.mealAssignments).toEqual({});
    expect(plan.selectedRecipes).toEqual(['soup_01']);
  });
});

describe('normalizePlan', () => {
  it('returns null/undefined as-is', () => {
    expect(normalizePlan(null)).toBeNull();
  });

  it('backfills mealAssignments/selectedPortions/ingredientDecisions to empty objects when absent', () => {
    const bare = { id: 'p1', studentId: 's1', status: 'draft', selectedRecipes: [] };
    const normalized = normalizePlan(bare);
    expect(normalized.mealAssignments).toEqual({});
    expect(normalized.selectedPortions).toEqual({});
    expect(normalized.ingredientDecisions).toEqual({});
  });

  it('leaves an already-normalized plan\'s fields untouched', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = toggleMealAssignment(plan, 'soup_01', 'обед');
    plan = setSelectedPortions(plan, 'soup_01', 6);
    const normalized = normalizePlan(plan);
    expect(normalized.selectedRecipes).toEqual(['soup_01']);
    expect(normalized.mealAssignments).toEqual({ soup_01: ['обед'] });
    expect(normalized.selectedPortions).toEqual({ soup_01: 6 });
  });

  describe('legacy (day-based) plan migration', () => {
    it('folds a placement into a mealAssignments tag and its portions into selectedPortions', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
        days: [{ dayIndex: 0, meals: { завтрак: [{ textId: 'oatmeal_01', portions: 3 }], обед: [], ужин: [], перекус: [] } }],
      };
      const normalized = normalizePlan(legacy);
      expect(normalized.days).toBeUndefined();
      expect(normalized.mealAssignments['oatmeal_01']).toEqual(['завтрак']);
      expect(normalized.selectedPortions['oatmeal_01']).toBe(3);
    });

    it('upgrades legacy string-array meal entries using portionMultiplier as the fallback portions', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        portionMultiplier: 3,
        status: 'draft',
        days: [{ dayIndex: 0, meals: { завтрак: ['oatmeal_01'], обед: [], ужин: [], перекус: [] } }],
      };
      const normalized = normalizePlan(legacy);
      expect(normalized.mealAssignments['oatmeal_01']).toEqual(['завтрак']);
      expect(normalized.selectedPortions['oatmeal_01']).toBe(3);
    });

    it('dedupes the same meal type across multiple days into one tag', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
        days: [
          { dayIndex: 0, meals: { завтрак: [], обед: [{ textId: 'soup_01', portions: 2 }], ужин: [], перекус: [] } },
          { dayIndex: 1, meals: { завтрак: [], обед: [{ textId: 'soup_01', portions: 5 }], ужин: [], перекус: [] } },
        ],
      };
      const normalized = normalizePlan(legacy);
      expect(normalized.mealAssignments['soup_01']).toEqual(['обед']);
      // Last placement seen wins for the carried-forward portions.
      expect(normalized.selectedPortions['soup_01']).toBe(5);
    });

    it('collects distinct meal types placed on different days for the same recipe', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
        days: [
          { dayIndex: 0, meals: { завтрак: [{ textId: 'soup_01', portions: 2 }], обед: [], ужин: [], перекус: [] } },
          { dayIndex: 1, meals: { завтрак: [], обед: [], ужин: [{ textId: 'soup_01', portions: 2 }], перекус: [] } },
        ],
      };
      const normalized = normalizePlan(legacy);
      expect(normalized.mealAssignments['soup_01']).toEqual(['завтрак', 'ужин']);
    });

    it('migrates a legacy напитки slot into перекус', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
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
      expect(normalized.mealAssignments['apple_01']).toEqual(['перекус']);
      expect(normalized.mealAssignments['kompot_01']).toEqual(['перекус']);
    });

    it('backfills selectedRecipes from existing placements when absent', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
        days: [
          { dayIndex: 0, meals: { завтрак: [{ textId: 'oatmeal_01', portions: 1 }], обед: [], ужин: [], перекус: [] } },
          { dayIndex: 1, meals: { завтрак: [], обед: [{ textId: 'oatmeal_01', portions: 2 }], ужин: [], перекус: [] } },
        ],
      };
      const normalized = normalizePlan(legacy);
      expect(normalized.selectedRecipes).toEqual(['oatmeal_01']);
    });

    it('leaves an existing selectedRecipes array untouched (keeps unplaced pool members)', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
        selectedRecipes: ['oatmeal_01', 'unplaced_01'],
        days: [{ dayIndex: 0, meals: { завтрак: [{ textId: 'oatmeal_01', portions: 1 }], обед: [], ужин: [], перекус: [] } }],
      };
      const normalized = normalizePlan(legacy);
      expect(normalized.selectedRecipes).toEqual(['oatmeal_01', 'unplaced_01']);
    });

    it('backfills ingredientDecisions to an empty object when absent', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
        days: [{ dayIndex: 0, meals: { завтрак: [], обед: [], ужин: [], перекус: [] } }],
      };
      const normalized = normalizePlan(legacy);
      expect(normalized.ingredientDecisions).toEqual({});
    });

    it('leaves existing ingredientDecisions untouched', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
        ingredientDecisions: { 'картошка': 'buy' },
        days: [{ dayIndex: 0, meals: { завтрак: [], обед: [], ужин: [], перекус: [] } }],
      };
      const normalized = normalizePlan(legacy);
      expect(normalized.ingredientDecisions).toEqual({ 'картошка': 'buy' });
    });
  });
});
