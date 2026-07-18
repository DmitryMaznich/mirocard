import { scalePortionQty } from './recipeParser.js';

export const MEAL_TYPES = ['завтрак', 'обед', 'ужин', 'перекус'];
export const RECIPE_TAGS = [...MEAL_TYPES, 'напитки'];
export const MEAL_ICONS = { завтрак: '🌅', обед: '☀️', ужин: '🌙', перекус: '🍎', напитки: '🥤' };

export function pluralizePortions(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'порция';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'порции';
  return 'порций';
}

// Case form for "на N ..." phrasing ("на" + accusative) — differs from
// pluralizePortions only at n=1 ("на 1 порцию", not the bare nominative
// "порция" a standalone count like a stepper value would use). The 2-4
// and 5+ forms are already identical to their accusative-plural spelling,
// so they're reused as-is. Reading this correctly matters here specifically
// — the app teaches children with ASD to read, and a grammatically wrong
// label undermines that.
export function pluralizePortionsAccusative(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'порцию';
  return pluralizePortions(n);
}

export function createPlan(studentId) {
  return {
    id: crypto.randomUUID(),
    studentId,
    status: 'draft',
    selectedRecipes: [],
    mealAssignments: {},
    selectedPortions: {},
    selectedOptions: {},
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
  const selectedOptions = { ...(plan.selectedOptions ?? {}) };
  delete selectedOptions[textId];
  return {
    ...plan,
    selectedRecipes: plan.selectedRecipes.filter((id) => id !== textId),
    mealAssignments,
    selectedPortions,
    selectedOptions,
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

/**
 * Sets which choices are picked within one option group of a recipe (e.g.
 * textId's "topping" group -> ['мёд', 'ягоды']) — an empty array means
 * none chosen. Feeds buildSelectedIngredientsSummary the same way
 * selectedPortions feeds ingredient scaling.
 */
export function setSelectedOptions(plan, textId, groupId, choices) {
  const forRecipe = { ...(plan.selectedOptions?.[textId] ?? {}), [groupId]: choices };
  return {
    ...plan,
    selectedOptions: { ...(plan.selectedOptions ?? {}), [textId]: forRecipe },
    updatedAt: new Date().toISOString(),
  };
}

/** Choices currently picked for one recipe's option group — [] if none. */
export function getSelectedOptions(plan, textId, groupId) {
  return plan.selectedOptions?.[textId]?.[groupId] ?? [];
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
 * Bulk version of setIngredientDecision — applies the same decision to
 * every product key at once, for the "Всё есть дома" / "Всё купить"
 * toggle above the ingredients list.
 */
export function setAllIngredientDecisions(plan, productKeys, decision) {
  const next = { ...(plan.ingredientDecisions ?? {}) };
  for (const productKey of productKeys) {
    const key = productKey.toLowerCase();
    if (decision) next[key] = decision;
    else delete next[key];
  }
  return { ...plan, ingredientDecisions: next, updatedAt: new Date().toISOString() };
}

/**
 * Portion multiplier actually in effect for one recipe within a plan.
 * fixed_portions recipes never scale (always their own fixed batch,
 * stepper hidden in the UI) — otherwise whatever the student picked in
 * the Меню stepper (plan.selectedPortions[textId]), falling back to the
 * recipe's own base portions when never touched.
 *
 * @param {{text: {id: string}, portions: number, fixedPortions: number|null}} recipe
 * @param {object} plan
 * @returns {{basePortions: number, chosenPortions: number, scale: number}}
 */
export function resolveChosenPortions(recipe, plan) {
  const basePortions = recipe.portions || 1;
  const chosenPortions = recipe.fixedPortions || plan.selectedPortions[recipe.text.id] || basePortions;
  return { basePortions, chosenPortions, scale: chosenPortions / basePortions };
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

    const { scale } = resolveChosenPortions(recipe, plan);

    for (const ing of recipe.ingredients) {
      const key = ing.product.toLowerCase();
      const scaledQty = scalePortionQty(ing.qty, ing.additiveStep, scale);
      if (map.has(key)) {
        const existing = map.get(key);
        if (existing.qty != null && scaledQty != null) existing.qty += scaledQty;
        else existing.qty = null;
      } else {
        map.set(key, { product: ing.product, qty: scaledQty, unit: ing.unit });
      }
    }

    // Only the chosen options actually need buying — an unpicked topping
    // contributes nothing (see setSelectedOptions/getSelectedOptions).
    for (const [groupId, choicesAvailable] of Object.entries(recipe.options ?? {})) {
      const chosen = new Set(getSelectedOptions(plan, textId, groupId));
      for (const opt of choicesAvailable) {
        if (!chosen.has(opt.product)) continue;
        const key = opt.product.toLowerCase();
        const scaledQty = scalePortionQty(opt.qty, opt.additiveStep, scale);
        if (map.has(key)) {
          const existing = map.get(key);
          if (existing.qty != null && scaledQty != null) existing.qty += scaledQty;
          else existing.qty = null;
        } else {
          map.set(key, { product: opt.product, qty: scaledQty, unit: opt.unit });
        }
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

// Anything left to buy? True if at least one selected-recipe ingredient is
// decided "buy" (regardless of whether it's actually been bought yet —
// that's isReadyToCook's job, via the shoppingDone flag from Покупки).
export function needsShopping(plan, allRecipes) {
  const items = buildSelectedIngredientsSummary(plan, allRecipes);
  return items.some((item) => plan.ingredientDecisions[item.product.toLowerCase()] === 'buy');
}

// Gate for the hub's "Начинаем готовить" CTA. Раскладка is now a required
// step in the shop -> put away -> cook sequence (revising the earlier
// "parallel skill, not a prerequisite" decision) — but only when a trip to
// the store was ever needed in the first place, so a menu that's fully
// home-stocked isn't stuck waiting on a putaway step that could never
// happen.
export function isReadyToCook(plan, allRecipes, shoppingDone, putawayDone) {
  if (!isMenuFullyDecided(plan, allRecipes)) return false;
  if (!needsShopping(plan, allRecipes)) return true;
  return shoppingDone && putawayDone;
}

// Cooking a recipe in this app *is* completing a follow_instruction session
// for its text — no separate "mark as cooked" tap needed. completedAt is
// compared against plan.createdAt so a session from a previous cycle
// (before this recipe was re-selected) doesn't count as done this time.
export function isRecipeCookedThisCycle(plan, recipe, sessions) {
  return sessions.some((s) =>
    s.studentId === plan.studentId &&
    s.topicId === recipe.topicId &&
    s.textId === recipe.text.id &&
    s.modeId === 'follow_instruction' &&
    s.completedAt >= plan.createdAt
  );
}

// "напитки" is a browsing-only catalog tag (see RECIPE_TAGS), not a
// meal-type indicator — a drink recipe is never flagged as mismatched
// for any slot.
export function needsMealMismatchWarning(recipe, mealType) {
  if (recipe.tags.includes('напитки')) return false;
  return !recipe.tags.includes(mealType);
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

// A recipe only counts as "in the menu" when it has a valid meal-type
// assignment — that's the same condition MealSlotSection uses to decide
// whether to render it. Without this, a recipe selected but never assigned
// (only possible via plans saved before meal assignment became mandatory
// at add-time) would be invisible in every meal slot yet still count toward
// buildSelectedIngredientsSummary/isMenuFullyDecided, showing ingredients
// for a menu that looks empty.
function pruneUnassigned(selectedRecipes, mealAssignments) {
  return (selectedRecipes ?? []).filter((textId) => MEAL_TYPES.includes(mealAssignments[textId]));
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

    const selectedRecipes = pruneUnassigned(plan.selectedRecipes ?? Object.keys(mealAssignments), mealAssignments);
    const { days, portionMultiplier, ...rest } = plan;

    return {
      ...rest,
      selectedRecipes,
      mealAssignments,
      selectedPortions,
      selectedOptions: plan.selectedOptions ?? {},
      ingredientDecisions: plan.ingredientDecisions ?? {},
    };
  }

  const mealAssignments = collapseMealAssignments(plan.mealAssignments);

  return {
    ...plan,
    selectedRecipes: pruneUnassigned(plan.selectedRecipes, mealAssignments),
    mealAssignments,
    selectedPortions: plan.selectedPortions ?? {},
    selectedOptions: plan.selectedOptions ?? {},
    ingredientDecisions: plan.ingredientDecisions ?? {},
  };
}
