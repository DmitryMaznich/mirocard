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
  setMealAssignment,
  setSelectedPortions,
  resetPlan,
  normalizePlan,
  setIngredientDecision,
  setAllIngredientDecisions,
  resolveChosenPortions,
  buildSelectedIngredientsSummary,
  isMenuFullyDecided,
  needsShopping,
  isReadyToCook,
  isRecipeCookedThisCycle,
  needsMealMismatchWarning,
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

  it('drops the recipe\'s meal tag and chosen portions', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setMealAssignment(plan, 'soup_01', 'обед');
    plan = setSelectedPortions(plan, 'soup_01', 6);

    const updated = deselectRecipe(plan, 'soup_01');
    expect(updated.mealAssignments['soup_01']).toBeUndefined();
    expect(updated.selectedPortions['soup_01']).toBeUndefined();
  });

  it('leaves other recipes and their state untouched', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = selectRecipe(plan, 'salad_01');
    plan = setMealAssignment(plan, 'soup_01', 'обед');
    plan = setMealAssignment(plan, 'salad_01', 'ужин');

    const updated = deselectRecipe(plan, 'soup_01');
    expect(updated.selectedRecipes).toEqual(['salad_01']);
    expect(updated.mealAssignments['salad_01']).toBe('ужин');
  });

  it('is a no-op when the recipe was never selected', () => {
    const plan = createPlan('s1');
    const updated = deselectRecipe(plan, 'nonexistent');
    expect(updated.selectedRecipes).toEqual([]);
  });
});

describe('setMealAssignment', () => {
  it('sets a meal tag when not present', () => {
    const plan = setMealAssignment(createPlan('s1'), 'soup_01', 'обед');
    expect(plan.mealAssignments['soup_01']).toBe('обед');
  });

  it('clears the meal tag when tapping the already-active one (toggle off)', () => {
    let plan = setMealAssignment(createPlan('s1'), 'soup_01', 'обед');
    plan = setMealAssignment(plan, 'soup_01', 'обед');
    expect(plan.mealAssignments['soup_01']).toBeUndefined();
  });

  it('replaces the previous meal tag — only one is possible at a time', () => {
    let plan = setMealAssignment(createPlan('s1'), 'soup_01', 'обед');
    plan = setMealAssignment(plan, 'soup_01', 'ужин');
    expect(plan.mealAssignments['soup_01']).toBe('ужин');
  });

  it('does not affect other recipes\' tags', () => {
    let plan = setMealAssignment(createPlan('s1'), 'soup_01', 'обед');
    plan = setMealAssignment(plan, 'salad_01', 'ужин');
    expect(plan.mealAssignments['soup_01']).toBe('обед');
    expect(plan.mealAssignments['salad_01']).toBe('ужин');
  });

  it('does not mutate the original plan', () => {
    const plan = createPlan('s1');
    setMealAssignment(plan, 'soup_01', 'обед');
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

describe('setAllIngredientDecisions', () => {
  it('sets the same decision for every product key at once', () => {
    const plan = setAllIngredientDecisions(createPlan('s1'), ['Картошка', 'лук', 'Соль'], 'have');
    expect(plan.ingredientDecisions).toEqual({ 'картошка': 'have', 'лук': 'have', 'соль': 'have' });
  });

  it('overwrites existing per-product decisions', () => {
    let plan = setIngredientDecision(createPlan('s1'), 'картошка', 'buy');
    plan = setAllIngredientDecisions(plan, ['картошка', 'лук'], 'have');
    expect(plan.ingredientDecisions).toEqual({ 'картошка': 'have', 'лук': 'have' });
  });

  it('clears all listed decisions when passed null', () => {
    let plan = setAllIngredientDecisions(createPlan('s1'), ['картошка', 'лук'], 'have');
    plan = setAllIngredientDecisions(plan, ['картошка', 'лук'], null);
    expect(plan.ingredientDecisions).toEqual({});
  });

  it('does not affect a product outside the given list', () => {
    let plan = setIngredientDecision(createPlan('s1'), 'соль', 'buy');
    plan = setAllIngredientDecisions(plan, ['картошка', 'лук'], 'have');
    expect(plan.ingredientDecisions).toEqual({ 'соль': 'buy', 'картошка': 'have', 'лук': 'have' });
  });

  it('does not mutate the original plan', () => {
    const plan = createPlan('s1');
    setAllIngredientDecisions(plan, ['картошка'], 'have');
    expect(plan.ingredientDecisions).toEqual({});
  });
});

describe('resolveChosenPortions', () => {
  const soup = { text: { id: 'soup_01' }, portions: 4, fixedPortions: null };
  const stew = { text: { id: 'stew_01' }, portions: 6, fixedPortions: 6 };

  it('falls back to the recipe\'s base portions when the stepper was never touched', () => {
    const plan = selectRecipe(createPlan('s1'), 'soup_01');
    expect(resolveChosenPortions(soup, plan)).toEqual({ basePortions: 4, chosenPortions: 4, scale: 1 });
  });

  it('uses selectedPortions when explicitly chosen (regression: recipe detail screen used to ignore this entirely)', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setSelectedPortions(plan, 'soup_01', 1);
    expect(resolveChosenPortions(soup, plan)).toEqual({ basePortions: 4, chosenPortions: 1, scale: 0.25 });
  });

  it('fixedPortions always wins, ignoring any selectedPortions override', () => {
    let plan = selectRecipe(createPlan('s1'), 'stew_01');
    plan = setSelectedPortions(plan, 'stew_01', 20);
    expect(resolveChosenPortions(stew, plan)).toEqual({ basePortions: 6, chosenPortions: 6, scale: 1 });
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

  it('is independent of which meal type the recipe is tagged for', () => {
    let plan = selectRecipe(createPlan('s1'), 'kompot_01');
    plan = setSelectedPortions(plan, 'kompot_01', 4); // double the base of 2
    plan = setMealAssignment(plan, 'kompot_01', 'завтрак');
    const summary = buildSelectedIngredientsSummary(plan, [kompot]);
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

  it('scales an additive-keyed ingredient by a flat step per extra portion, not proportionally', () => {
    const chicken = {
      text: { id: 'chicken_01' },
      portions: 1,
      fixedPortions: null,
      ingredients: [{ product: 'масло растительное', qty: 1, unit: 'ст.л', key: 'oil', additiveStep: 0.5 }],
    };
    let plan = selectRecipe(createPlan('s1'), 'chicken_01');
    plan = setSelectedPortions(plan, 'chicken_01', 4); // additive: 1 + 0.5*(4-1) = 2.5, not proportional 1*4=4
    const summary = buildSelectedIngredientsSummary(plan, [chicken]);
    expect(summary).toContainEqual({ product: 'масло растительное', qty: 2.5, unit: 'ст.л' });
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

describe('isMenuFullyDecided', () => {
  const soup = {
    text: { id: 'soup_01' },
    portions: 4,
    fixedPortions: null,
    ingredients: [
      { product: 'картошка', qty: 4, unit: 'шт' },
      { product: 'соль', qty: null, unit: null },
    ],
  };

  it('is false with no recipes selected', () => {
    expect(isMenuFullyDecided(createPlan('s1'), [soup])).toBe(false);
  });

  it('is false when some ingredients have no decision', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    expect(isMenuFullyDecided(plan, [soup])).toBe(false);
  });

  it('is true when every ingredient has a decision', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'buy');
    expect(isMenuFullyDecided(plan, [soup])).toBe(true);
  });
});

describe('needsShopping', () => {
  const soup = {
    text: { id: 'soup_01' },
    portions: 4,
    fixedPortions: null,
    ingredients: [
      { product: 'картошка', qty: 4, unit: 'шт' },
      { product: 'соль', qty: null, unit: null },
    ],
  };

  it('is false when everything is decided "have"', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'have');
    expect(needsShopping(plan, [soup])).toBe(false);
  });

  it('is true when at least one ingredient is decided "buy"', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'buy');
    expect(needsShopping(plan, [soup])).toBe(true);
  });

  it('is false with no ingredients at all', () => {
    expect(needsShopping(createPlan('s1'), [soup])).toBe(false);
  });
});

describe('isReadyToCook', () => {
  const soup = {
    text: { id: 'soup_01' },
    portions: 4,
    fixedPortions: null,
    ingredients: [
      { product: 'картошка', qty: 4, unit: 'шт' },
      { product: 'соль', qty: null, unit: null },
    ],
  };

  it('is true when everything is decided "have" (no shopping needed), regardless of putawayDone', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'have');
    expect(isReadyToCook(plan, [soup], false, false)).toBe(true);
  });

  it('is false when something needs buying and shopping is not done', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'buy');
    expect(isReadyToCook(plan, [soup], false, false)).toBe(false);
  });

  it('is false when shopping is done but putaway is not — putaway is now a required step, not a parallel one', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'buy');
    expect(isReadyToCook(plan, [soup], true, false)).toBe(false);
  });

  it('is true when something needed buying, shopping is done, and putaway is done', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = setIngredientDecision(plan, 'картошка', 'have');
    plan = setIngredientDecision(plan, 'соль', 'buy');
    expect(isReadyToCook(plan, [soup], true, true)).toBe(true);
  });

  it('is false when not every ingredient has a decision yet, even if shoppingDone/putawayDone are true', () => {
    const plan = selectRecipe(createPlan('s1'), 'soup_01');
    expect(isReadyToCook(plan, [soup], true, true)).toBe(false);
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
    plan = setMealAssignment(plan, 'soup_01', 'обед');
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
    plan = setMealAssignment(plan, 'soup_01', 'обед');
    plan = setSelectedPortions(plan, 'soup_01', 6);
    const normalized = normalizePlan(plan);
    expect(normalized.selectedRecipes).toEqual(['soup_01']);
    expect(normalized.mealAssignments).toEqual({ soup_01: 'обед' });
    expect(normalized.selectedPortions).toEqual({ soup_01: 6 });
  });

  it('collapses a legacy multi-select mealAssignments array to its last entry', () => {
    const plan = {
      id: 'p1',
      studentId: 's1',
      status: 'draft',
      selectedRecipes: ['soup_01'],
      mealAssignments: { soup_01: ['завтрак', 'перекус'] },
      selectedPortions: {},
    };
    const normalized = normalizePlan(plan);
    expect(normalized.mealAssignments).toEqual({ soup_01: 'перекус' });
  });

  it('drops a selected recipe with no meal assignment (selectedRecipes must exactly match what the menu displays)', () => {
    let plan = selectRecipe(createPlan('s1'), 'soup_01');
    plan = selectRecipe(plan, 'salad_01');
    plan = setMealAssignment(plan, 'salad_01', 'ужин');
    // soup_01 was selected but never assigned a meal — this can only happen
    // via plans persisted before meal assignment became mandatory at
    // add-time; normalizePlan must self-heal it on every load.
    const normalized = normalizePlan(plan);
    expect(normalized.selectedRecipes).toEqual(['salad_01']);
  });

  it('drops a selected recipe whose meal assignment is not a valid meal type', () => {
    const plan = {
      id: 'p1',
      studentId: 's1',
      status: 'draft',
      selectedRecipes: ['soup_01'],
      mealAssignments: { soup_01: 'напитки' },
      selectedPortions: {},
    };
    const normalized = normalizePlan(plan);
    expect(normalized.selectedRecipes).toEqual([]);
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
      expect(normalized.mealAssignments['oatmeal_01']).toBe('завтрак');
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
      expect(normalized.mealAssignments['oatmeal_01']).toBe('завтрак');
      expect(normalized.selectedPortions['oatmeal_01']).toBe(3);
    });

    it('keeps only the last-placed meal type when the same recipe was placed under multiple days/meals', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
        days: [
          { dayIndex: 0, meals: { завтрак: [{ textId: 'soup_01', portions: 2 }], обед: [], ужин: [], перекус: [] } },
          { dayIndex: 1, meals: { завтрак: [], обед: [], ужин: [{ textId: 'soup_01', portions: 5 }], перекус: [] } },
        ],
      };
      const normalized = normalizePlan(legacy);
      // Last placement seen wins for both the meal type and the portions.
      expect(normalized.mealAssignments['soup_01']).toBe('ужин');
      expect(normalized.selectedPortions['soup_01']).toBe(5);
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
      expect(normalized.mealAssignments['apple_01']).toBe('перекус');
      expect(normalized.mealAssignments['kompot_01']).toBe('перекус');
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

    it('drops unplaced pool members from selectedRecipes (a recipe with no meal assignment is not part of the menu)', () => {
      const legacy = {
        id: 'p1',
        studentId: 's1',
        status: 'draft',
        selectedRecipes: ['oatmeal_01', 'unplaced_01'],
        days: [{ dayIndex: 0, meals: { завтрак: [{ textId: 'oatmeal_01', portions: 1 }], обед: [], ужин: [], перекус: [] } }],
      };
      const normalized = normalizePlan(legacy);
      expect(normalized.selectedRecipes).toEqual(['oatmeal_01']);
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

describe('isRecipeCookedThisCycle', () => {
  const plan = { studentId: 's1', createdAt: '2026-07-01T00:00:00.000Z' };
  const recipe = { topicId: 'reading_dad_texts', text: { id: 'soup_01' } };

  it('is true when a matching session completed after the plan was created', () => {
    const sessions = [{
      studentId: 's1', topicId: 'reading_dad_texts', textId: 'soup_01',
      modeId: 'follow_instruction', completedAt: '2026-07-02T00:00:00.000Z',
    }];
    expect(isRecipeCookedThisCycle(plan, recipe, sessions)).toBe(true);
  });

  it('is false when the only matching session completed before the plan was created', () => {
    const sessions = [{
      studentId: 's1', topicId: 'reading_dad_texts', textId: 'soup_01',
      modeId: 'follow_instruction', completedAt: '2026-06-30T00:00:00.000Z',
    }];
    expect(isRecipeCookedThisCycle(plan, recipe, sessions)).toBe(false);
  });

  it('is false for a session with a different textId', () => {
    const sessions = [{
      studentId: 's1', topicId: 'reading_dad_texts', textId: 'salad_01',
      modeId: 'follow_instruction', completedAt: '2026-07-02T00:00:00.000Z',
    }];
    expect(isRecipeCookedThisCycle(plan, recipe, sessions)).toBe(false);
  });

  it('is false for a session with a different modeId', () => {
    const sessions = [{
      studentId: 's1', topicId: 'reading_dad_texts', textId: 'soup_01',
      modeId: 'quiz', completedAt: '2026-07-02T00:00:00.000Z',
    }];
    expect(isRecipeCookedThisCycle(plan, recipe, sessions)).toBe(false);
  });

  it('is false when sessions is empty', () => {
    expect(isRecipeCookedThisCycle(plan, recipe, [])).toBe(false);
  });
});

describe('needsMealMismatchWarning', () => {
  it('is true when the recipe is not tagged for the target meal type', () => {
    const recipe = { tags: ['обед', 'ужин'] };
    expect(needsMealMismatchWarning(recipe, 'завтрак')).toBe(true);
  });

  it('is false when the recipe is tagged for the target meal type', () => {
    const recipe = { tags: ['обед', 'ужин'] };
    expect(needsMealMismatchWarning(recipe, 'обед')).toBe(false);
  });

  it('is false for a напитки-tagged recipe regardless of the target meal type', () => {
    const recipe = { tags: ['напитки', 'завтрак'] };
    expect(needsMealMismatchWarning(recipe, 'обед')).toBe(false);
    expect(needsMealMismatchWarning(recipe, 'ужин')).toBe(false);
  });

  it('is true for a recipe with no meal-type tags at all (defensive case)', () => {
    const recipe = { tags: [] };
    expect(needsMealMismatchWarning(recipe, 'завтрак')).toBe(true);
  });
});
