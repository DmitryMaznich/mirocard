# Menu selection vs. distribution — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split "Рецепты" (pick what you like — a flat pool) from "Меню" (organize the pool into a day/meal schedule), remove напитки as a rigid 5th meal slot (it becomes a browsing-only tag), and add convenient "changed my mind" tools: full menu reset and in-place move of an existing placement.

**Architecture:** `Plan` gains a `selectedRecipes: string[]` pool, independent of `day.meals` placements. `plannerUtils.js` gains `selectRecipe`/`deselectRecipe`/`isRecipeSelected`/`resetPlan`, plus two `normalizePlan` migrations (backfill `selectedRecipes` from existing placements; fold legacy `напитки` placements into `перекус`). `PlannerMenuScreen.jsx`'s Рецепты cards become simple select/deselect toggles (no popover), and its Меню view gains an "Отобрано" pool section (with a "Распределить" action reusing the existing day/meal/portions sheet) and a per-chip "↻" move control that pre-fills the same sheet and replaces the placement on confirm. `HomeScreen.jsx`'s hub gates "Меню" on selection instead of placement.

**Tech Stack:** React 19, Zustand, Vite, Vitest, plain CSS.

## Global Constraints

- `MEAL_TYPES` (`src/features/planner/plannerUtils.js`) is exactly `['завтрак', 'обед', 'ужин', 'перекус']` — 4 entries, no напитки.
- `RECIPE_TAGS` is exactly `[...MEAL_TYPES, 'напитки']` — used only for the Рецепты browsing tabs, never as a `day.meals` key.
- `day.meals` keys are always one of the 4 `MEAL_TYPES` — never `напитки` — after `normalizePlan` runs.
- `Plan.selectedRecipes` is a plain array of recipe `textId` strings, no portions/scheduling info.
- Reset confirm copy is exactly: "Точно начать заново? Всё меню будет удалено." with "Да" / "Нет" buttons — matches the existing shopping-screen reset pattern (`src/features/planner/PlannerShoppingScreen.jsx`).
- Out of scope: `PlannerShoppingScreen.jsx`, `PlannerSummaryScreen.jsx`, shopping-list generation, drag-and-drop, per-selection default portions.

---

### Task 1: Data model — `plannerUtils.js` + tests

**Files:**
- Modify: `src/features/planner/plannerUtils.js` (full rewrite, 130 → ~165 lines)
- Modify: `src/features/planner/plannerUtils.test.js` (full rewrite)

**Interfaces:**
- Produces: `MEAL_TYPES` (4 entries), `RECIPE_TAGS` (5 entries), `selectRecipe(plan, textId)`, `deselectRecipe(plan, textId)`, `isRecipeSelected(plan, textId)`, `resetPlan(studentId)`. Unchanged signatures: `createPlan(studentId)` (now also sets `selectedRecipes: []`), `createDay`, `addDay`, `addRecipeToMeal`, `removeRecipeFromMeal`, `getPlanRecipes`, `findRecipePlacements`, `countPlanRecipes`, `normalizePlan` (now also backfills `selectedRecipes` and migrates legacy `напитки`).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/features/planner/plannerUtils.test.js` with:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: FAIL — `RECIPE_TAGS`, `isRecipeSelected`, `selectRecipe`, `deselectRecipe`, `resetPlan` are not exported yet, and the `MEAL_TYPES` assertion (4 entries) fails against the current 5-entry array.

- [ ] **Step 3: Rewrite `plannerUtils.js`**

Replace the full contents of `src/features/planner/plannerUtils.js` with:

```js
export const MEAL_TYPES = ['завтрак', 'обед', 'ужин', 'перекус'];
export const RECIPE_TAGS = [...MEAL_TYPES, 'напитки'];

export function createPlan(studentId) {
  return {
    id: crypto.randomUUID(),
    studentId,
    status: 'draft',
    selectedRecipes: [],
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
    // напитки is no longer a valid day.meals key (it's a browsing-only tag,
    // see RECIPE_TAGS) — fold any legacy entries into перекус, the
    // least-wrong default for a drink with no real meal assignment.
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

  return { ...plan, days, selectedRecipes };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full existing planner test suite to check for regressions**

Run: `npx vitest run src/features/planner`
Expected: PASS (`shoppingListGenerator.test.js`, `recipeParser.test.js` unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/plannerUtils.js src/features/planner/plannerUtils.test.js
git commit -m "feat(planner): split recipe selection from day/meal placement in the data model"
```

---

### Task 2: `PlannerMenuScreen.jsx` — selection-only Рецепты, Меню pool/move/reset

**Files:**
- Modify: `src/features/planner/PlannerMenuScreen.jsx` (full rewrite)
- Modify: `src/features/planner/planner.css` (remove card-popover styles, adjust add-sheet grid, add pool/move/reset styles)

**Interfaces:**
- Consumes from Task 1: `MEAL_TYPES`, `RECIPE_TAGS`, `createPlan`, `addDay`, `addRecipeToMeal`, `removeRecipeFromMeal`, `findRecipePlacements`, `isRecipeSelected`, `selectRecipe`, `deselectRecipe`, `resetPlan` — all from `./plannerUtils.js`.
- Produces: no new exports (default export `PlannerMenuScreen` unchanged). Internal `RecipeBrowser` prop renamed `planRecipeCount` → `selectedCount` (Task 4 does not touch this file, so this rename is self-contained).

- [ ] **Step 1: Rewrite `PlannerMenuScreen.jsx`**

Replace the full contents of `src/features/planner/PlannerMenuScreen.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getTopicTitle } from '@/shared/utils/format';
import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { getRawRecipeTxt } from '@/core/groupStore';
import { parseRecipeMetadata } from './recipeParser.js';
import { BackArrowIcon } from '@/shared/components/ArrowIcons';
import {
  createPlan, addDay, addRecipeToMeal, removeRecipeFromMeal,
  findRecipePlacements, isRecipeSelected, selectRecipe, deselectRecipe, resetPlan,
  MEAL_TYPES, RECIPE_TAGS,
} from './plannerUtils.js';
import { loadPlan, savePlan, PANTRY_ITEMS } from './plannerApi.js';
import './planner.css';

const MEAL_ICONS = { завтрак: '🌅', обед: '☀️', ужин: '🌙', перекус: '🍎', напитки: '🥤' };

function pluralizePortions(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'порция';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'порции';
  return 'порций';
}

function keyIngredients(ingredients) {
  return ingredients
    .filter((i) => i.product && !PANTRY_ITEMS.has(i.product))
    .slice(0, 3)
    .map((i) => i.product)
    .join(', ');
}

// ─── Recipe ingredients (what you need, no step-by-step) ─────────────────────

function RecipeIngredients({ recipe, plan, onOpenAddSheet, onBack }) {
  const { topicId, text, ingredients, portions, fixedPortions } = recipe;
  const coverUrl = useTopicFile(topicId, text.photo);
  const placements = findRecipePlacements(plan, text.id);
  const selected = isRecipeSelected(plan, text.id);
  const basePortions = fixedPortions || portions || 1;

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">{getTopicTitle(text.title)}</h1>
      </div>

      <div className="recipe-detail-body">
        {coverUrl && <img src={coverUrl} alt="" className="recipe-detail-cover" />}
        {placements.length > 0 ? (
          <div className="recipe-detail-placements">
            <span className="recipe-detail-placements__label">Уже в меню</span>
            {placements.map((p, i) => (
              <span key={i} className="recipe-detail-placements__chip">
                {MEAL_ICONS[p.mealType]} День {p.dayIndex + 1} · {p.mealType}
                {p.portions > 1 ? ` ×${p.portions}` : ''}
              </span>
            ))}
          </div>
        ) : selected ? (
          <div className="recipe-detail-placements">
            <span className="recipe-detail-placements__hint">Отобрано, пока без дня</span>
          </div>
        ) : null}
        <div className="recipe-ingredients">
          <span className="recipe-ingredients__meta">
            {fixedPortions ? '🔒 готовится сразу на ' : 'На '}
            {basePortions} {pluralizePortions(basePortions)}
          </span>
          <ul className="recipe-ingredients__list">
            {ingredients.map((ing, i) => (
              <li key={i} className="recipe-ingredients__item">
                <span className="recipe-ingredients__product">{ing.product}</span>
                <span className="recipe-ingredients__qty">
                  {ing.qty != null ? `${ing.qty} ${ing.unit ?? ''}`.trim() : 'по вкусу'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="planner-footer">
        <button className="recipe-detail-add" onClick={onOpenAddSheet}>
          + Добавить в меню
        </button>
      </div>
    </div>
  );
}

// ─── Recipe card (tap to view, or select for the menu pool) ──────────────────

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4.5 3.2v9.6c0 .7.76 1.13 1.36.76l7.5-4.8a.9.9 0 0 0 0-1.52l-7.5-4.8c-.6-.37-1.36.06-1.36.76Z" fill="currentColor" />
    </svg>
  );
}

function RecipeCard({ recipe, selected, onView, onCook, onToggleSelect }) {
  const { topicId, text, ingredients } = recipe;
  const photoUrl = useTopicFile(topicId, text.photo);

  return (
    <div className="recipe-gallery-card">
      <button className="recipe-gallery-card__view" onClick={onView}>
        <span className="recipe-gallery-card__photo-btn">
          {photoUrl
            ? <img src={photoUrl} alt="" className="recipe-gallery-card__photo" />
            : <span className="recipe-gallery-card__photo-placeholder" />
          }
          {selected && <span className="recipe-gallery-card__badge">✓</span>}
        </span>
        <span className="recipe-gallery-card__info">
          <span className="recipe-gallery-card__title">{getTopicTitle(text.title)}</span>
          <span className="recipe-gallery-card__ingr">{keyIngredients(ingredients)}</span>
        </span>
      </button>

      <div className="recipe-gallery-card__add-row">
        <button
          type="button"
          className="recipe-gallery-card__cook-btn"
          onClick={() => onCook(recipe)}
          aria-label="Готовить по шагам"
        >
          <PlayIcon />
        </button>
        <button
          type="button"
          className={`recipe-gallery-card__add-btn${selected ? ' recipe-gallery-card__add-btn--active' : ''}`}
          onClick={() => onToggleSelect(recipe)}
        >
          {selected ? '✓ В меню' : '+ Добавить'}
        </button>
      </div>
    </div>
  );
}

// ─── Recipe browser (category tabs + grid) ───────────────────────────────────

const TAB_ALL = 'all';

function RecipeBrowser({ plan, allRecipes, loading, selectedCount, onView, onCook, onOpenPlan, onBack, onToggleSelect }) {
  const [mealType, setMealType] = useState(TAB_ALL);
  const filtered = mealType === TAB_ALL ? allRecipes : allRecipes.filter((r) => r.tags.includes(mealType));

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">Рецепты</h1>
        <button className="planner-plan-pill" onClick={onOpenPlan}>
          Меню{selectedCount > 0 ? ` · ${selectedCount}` : ''}
        </button>
      </div>

      <div className="gallery-meal-tabs">
        <button
          className={`gallery-meal-tab${mealType === TAB_ALL ? ' gallery-meal-tab--active' : ''}`}
          onClick={() => setMealType(TAB_ALL)}
        >
          Все
        </button>
        {RECIPE_TAGS.map((mt) => (
          <button
            key={mt}
            className={`gallery-meal-tab${mealType === mt ? ' gallery-meal-tab--active' : ''}`}
            onClick={() => setMealType(mt)}
          >
            {MEAL_ICONS[mt]} {mt}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="planner-loading">Загружаем рецепты…</div>
      ) : filtered.length === 0 ? (
        <div className="gallery-empty">
          {mealType === TAB_ALL ? 'Рецептов пока нет' : `Нет рецептов для «${mealType}»`}
        </div>
      ) : (
        <div className="recipe-gallery-grid">
          {filtered.map((recipe) => (
            <RecipeCard
              key={`${recipe.topicId}_${recipe.text.id}`}
              recipe={recipe}
              selected={isRecipeSelected(plan, recipe.text.id)}
              onView={() => onView(recipe)}
              onCook={onCook}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add-to-plan sheet (distribute a pool recipe, or move a placement) ───────

function AddToPlanSheet({ recipe, plan, initialDayIndex = 0, initialMealType = null, initialPortions = null, onAddDay, onConfirm, onClose }) {
  const { fixedPortions } = recipe;
  const [dayIndex, setDayIndex] = useState(initialDayIndex);
  const [mealType, setMealType] = useState(initialMealType);
  const [portions, setPortions] = useState(initialPortions ?? (fixedPortions || recipe.portions || 1));

  function handleAddDay() {
    const newIndex = plan.days.length;
    onAddDay();
    setDayIndex(newIndex);
  }

  return (
    <div className="add-sheet-backdrop" onClick={onClose}>
      <div className="add-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="add-sheet__handle" />
        <h2 className="add-sheet__title">{getTopicTitle(recipe.text.title)}</h2>

        <div className="add-sheet__section">
          <span className="add-sheet__label">День</span>
          <div className="add-sheet__chips">
            {plan.days.map((day) => (
              <button
                key={day.dayIndex}
                type="button"
                className={`add-sheet__chip${dayIndex === day.dayIndex ? ' add-sheet__chip--active' : ''}`}
                onClick={() => setDayIndex(day.dayIndex)}
              >
                День {day.dayIndex + 1}
              </button>
            ))}
            {plan.days.length < 7 && (
              <button type="button" className="add-sheet__chip add-sheet__chip--add" onClick={handleAddDay}>
                + День
              </button>
            )}
          </div>
        </div>

        <div className="add-sheet__section">
          <span className="add-sheet__label">Приём пищи</span>
          <div className="add-sheet__meals">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt}
                type="button"
                className={`add-sheet__meal${mealType === mt ? ' add-sheet__meal--active' : ''}`}
                onClick={() => setMealType(mt)}
              >
                <span className="add-sheet__meal-icon">{MEAL_ICONS[mt]}</span>
                <span className="add-sheet__meal-label">{mt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="add-sheet__section add-sheet__section--row">
          <span className="add-sheet__label">Порций</span>
          {fixedPortions ? (
            <span className="add-sheet__fixed">🔒 всегда {fixedPortions} — блюдо готовится целиком</span>
          ) : (
            <div className="add-sheet__stepper">
              <button type="button" onClick={() => setPortions((p) => Math.max(1, p - 1))} aria-label="Меньше порций">−</button>
              <span className="add-sheet__stepper-value">{portions}</span>
              <button type="button" onClick={() => setPortions((p) => p + 1)} aria-label="Больше порций">+</button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="add-sheet__confirm"
          disabled={mealType === null}
          onClick={() => onConfirm(dayIndex, mealType, portions)}
        >
          Добавить в меню
        </button>
      </div>
    </div>
  );
}

// ─── Selected pool (Отобрано) ─────────────────────────────────────────────────

function SelectedPool({ plan, allRecipes, onDistribute, onDeselect, onViewRecipe }) {
  if (plan.selectedRecipes.length === 0) return null;

  return (
    <div className="menu-pool">
      <h2 className="menu-pool__title">Отобрано</h2>
      <div className="menu-pool__list">
        {plan.selectedRecipes.map((textId) => {
          const recipe = allRecipes.find((r) => r.text.id === textId);
          if (!recipe) return null;
          const placements = findRecipePlacements(plan, textId);
          return (
            <div key={textId} className="menu-pool__row">
              <button className="menu-pool__name" onClick={() => onViewRecipe(recipe)}>
                <span className="menu-pool__title-text">{getTopicTitle(recipe.text.title)}</span>
                <span className="menu-pool__ingr">{keyIngredients(recipe.ingredients)}</span>
              </button>
              {placements.length > 0 && (
                <span className="menu-pool__badge">×{placements.length}</span>
              )}
              <button type="button" className="menu-pool__distribute" onClick={() => onDistribute(recipe)}>
                Распределить
              </button>
              <button type="button" className="menu-pool__remove" onClick={() => onDeselect(textId)}>
                Убрать
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Plan view (day-by-day review) ───────────────────────────────────────────

function PlanDayCard({ day, allRecipes, onRemove, onViewRecipe, onCook, onMove }) {
  function getRecipeObj(textId) {
    return allRecipes.find((r) => r.text.id === textId) ?? null;
  }

  const filledMeals = MEAL_TYPES.filter((mt) => (day.meals[mt] ?? []).length > 0);

  return (
    <div className="planner-day-card">
      <div className="planner-day-title">День {day.dayIndex + 1}</div>
      {filledMeals.length === 0 ? (
        <div className="planner-day-card__empty">Пока пусто</div>
      ) : (
        filledMeals.map((mealType) => (
          <div key={mealType} className="planner-meal-section">
            <div className="planner-meal-header">
              <span className="planner-meal-type">{MEAL_ICONS[mealType]} {mealType}</span>
            </div>
            <div className="planner-recipe-chips">
              {day.meals[mealType].map(({ textId, portions }) => {
                const r = getRecipeObj(textId);
                const title = r ? getTopicTitle(r.text.title) : textId;
                return (
                  <span key={textId} className="planner-recipe-chip">
                    {r && (
                      <button
                        className="planner-recipe-chip__cook"
                        onClick={() => onCook(r)}
                        aria-label="Готовить по шагам"
                      >
                        <PlayIcon />
                      </button>
                    )}
                    <button
                      className="planner-recipe-chip__name"
                      onClick={() => r && onViewRecipe(r)}
                      disabled={!r}
                    >
                      {title}{portions > 1 ? ` ×${portions}` : ''}
                    </button>
                    {r && (
                      <button
                        className="planner-recipe-chip__move"
                        onClick={() => onMove(r, day.dayIndex, mealType, portions)}
                        aria-label="Перенести на другой день или приём пищи"
                      >
                        ↻
                      </button>
                    )}
                    <button
                      className="planner-recipe-chip__remove"
                      onClick={() => onRemove(day.dayIndex, mealType, textId)}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PlanView({ plan, allRecipes, onAddDay, onRemove, onViewRecipe, onCook, onMove, onDistribute, onDeselect, onReset, onBack }) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="screen planner-screen">
      <div className="planner-header">
        <button className="planner-header__back" onClick={onBack}><BackArrowIcon size={22} /></button>
        <h1 className="planner-header__title">Меню</h1>
      </div>

      <div className="planner-body">
        <SelectedPool
          plan={plan}
          allRecipes={allRecipes}
          onDistribute={onDistribute}
          onDeselect={onDeselect}
          onViewRecipe={onViewRecipe}
        />
        {plan.days.map((day) => (
          <PlanDayCard
            key={day.dayIndex}
            day={day}
            allRecipes={allRecipes}
            onRemove={onRemove}
            onViewRecipe={onViewRecipe}
            onCook={onCook}
            onMove={onMove}
          />
        ))}
        {plan.days.length < 7 && (
          <button className="planner-add-day" onClick={onAddDay}>
            + Добавить день
          </button>
        )}
        <button type="button" className="menu-reset-link" onClick={() => setConfirmReset(true)}>
          Начать меню заново
        </button>
      </div>

      {confirmReset && (
        <div className="menu-reset-bar">
          <span className="menu-reset-bar__text">Точно начать заново? Всё меню будет удалено.</span>
          <div className="menu-reset-bar__actions">
            <button type="button" className="menu-reset-bar__cancel" onClick={() => setConfirmReset(false)}>Нет</button>
            <button type="button" className="menu-reset-bar__ok" onClick={() => { setConfirmReset(false); onReset(); }}>Да</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PlannerMenuScreen ────────────────────────────────────────────────────────

export default function PlannerMenuScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const setActiveTopicId = useAppStore((s) => s.setActiveTopicId);
  const setActiveText = useAppStore((s) => s.setActiveText);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);
  const setSessionReturnScreen = useAppStore((s) => s.setSessionReturnScreen);
  const plannerInitialView = useAppStore((s) => s.plannerInitialView);
  const setPlannerInitialView = useAppStore((s) => s.setPlannerInitialView);

  const [plan, setPlan] = useState(null);
  const [allRecipes, setAllRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // view: 'recipes' | 'plan' | 'detail'
  const [view, setView] = useState(() => plannerInitialView ?? 'recipes');
  const [detailRecipe, setDetailRecipe] = useState(null);
  const [detailPrev, setDetailPrev] = useState('recipes');
  // Shared by three entry points: the detail screen's "+ Добавить в меню",
  // Меню's "Распределить" (adds a placement), and "↻" move (replaces one
  // placement) — moveFrom distinguishes add vs. replace on confirm.
  const [addSheet, setAddSheet] = useState(null); // { recipe, moveFrom: {dayIndex, mealType, portions} | null } | null

  // Consume the hub's requested initial view once, so a later visit
  // (without the hub setting it again) defaults back to 'recipes'.
  useEffect(() => {
    if (plannerInitialView) setPlannerInitialView(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved plan
  useEffect(() => {
    if (!activeStudentId) return;
    loadPlan(activeStudentId).then((saved) => {
      setPlan(saved ?? createPlan(activeStudentId));
    });
  }, [activeStudentId]);

  // Persist on every change (skips the initial null -> plan transition's redundant write only in that it's harmless either way)
  useEffect(() => {
    if (plan) savePlan(plan);
  }, [plan]);

  // Load all recipes with metadata once
  useEffect(() => {
    if (!topicRecords.length) return;
    let cancelled = false;
    async function load() {
      setLoadingRecipes(true);
      const all = [];
      for (const record of topicRecords) {
        if (record.meta?.renderer !== 'reading') continue;
        for (const text of record.texts ?? []) {
          if (text.kind !== 'instruction' || !text.file) continue;
          const content = await getRawRecipeTxt(record.meta.id, text.file);
          if (!content) continue;
          const { tags, ingredients, portions, fixedPortions } = parseRecipeMetadata(content);
          all.push({ topicId: record.meta.id, text, tags, ingredients, portions, fixedPortions });
        }
      }
      if (!cancelled) { setAllRecipes(all); setLoadingRecipes(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [topicRecords]);

  function openDetail(recipe, from) {
    setDetailRecipe(recipe);
    setDetailPrev(from);
    setView('detail');
  }

  function openAddSheet(recipe, moveFrom = null) {
    setAddSheet({ recipe, moveFrom });
  }

  function handleConfirmAddSheet(dayIndex, mealType, portions) {
    const { recipe, moveFrom } = addSheet;
    setPlan((p) => {
      let next = selectRecipe(p, recipe.text.id);
      if (moveFrom) {
        next = removeRecipeFromMeal(next, moveFrom.dayIndex, moveFrom.mealType, recipe.text.id);
      }
      return addRecipeToMeal(next, dayIndex, mealType, recipe.text.id, portions);
    });
    setAddSheet(null);
  }

  function handleToggleSelect(recipe) {
    setPlan((p) =>
      isRecipeSelected(p, recipe.text.id)
        ? deselectRecipe(p, recipe.text.id)
        : selectRecipe(p, recipe.text.id)
    );
  }

  function handleCook(recipe) {
    setActiveTopicId(recipe.topicId);
    setActiveText(recipe.text);
    setActiveModeId('follow_instruction');
    setSessionReturnScreen('planner_menu');
    setScreen('params');
  }

  if (!plan) return <div className="screen screen-center">Загрузка…</div>;

  let content;
  if (view === 'detail' && detailRecipe) {
    content = (
      <RecipeIngredients
        recipe={detailRecipe}
        plan={plan}
        onOpenAddSheet={() => openAddSheet(detailRecipe)}
        onBack={() => setView(detailPrev)}
      />
    );
  } else if (view === 'plan') {
    content = (
      <PlanView
        plan={plan}
        allRecipes={allRecipes}
        onAddDay={() => setPlan((p) => addDay(p))}
        onRemove={(dayIndex, mealType, textId) =>
          setPlan((p) => removeRecipeFromMeal(p, dayIndex, mealType, textId))
        }
        onViewRecipe={(recipe) => openDetail(recipe, 'plan')}
        onCook={handleCook}
        onMove={(recipe, dayIndex, mealType, portions) =>
          openAddSheet(recipe, { dayIndex, mealType, portions })
        }
        onDistribute={(recipe) => openAddSheet(recipe)}
        onDeselect={(textId) => setPlan((p) => deselectRecipe(p, textId))}
        onReset={() => setPlan(resetPlan(activeStudentId))}
        onBack={() => setView('recipes')}
      />
    );
  } else {
    content = (
      <RecipeBrowser
        plan={plan}
        allRecipes={allRecipes}
        loading={loadingRecipes}
        selectedCount={plan.selectedRecipes.length}
        onView={(recipe) => openDetail(recipe, 'recipes')}
        onCook={handleCook}
        onOpenPlan={() => setView('plan')}
        onBack={() => setScreen('home')}
        onToggleSelect={handleToggleSelect}
      />
    );
  }

  return (
    <>
      {content}
      {addSheet && (
        <AddToPlanSheet
          recipe={addSheet.recipe}
          plan={plan}
          initialDayIndex={addSheet.moveFrom?.dayIndex ?? 0}
          initialMealType={addSheet.moveFrom?.mealType ?? null}
          initialPortions={addSheet.moveFrom?.portions ?? null}
          onAddDay={() => setPlan((p) => addDay(p))}
          onConfirm={handleConfirmAddSheet}
          onClose={() => setAddSheet(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Remove the dead card-popover CSS**

In `src/features/planner/planner.css`, delete this entire block (it was the day/portions popover on the Рецепты card, now replaced by a plain select/deselect toggle — nothing references `.card-popover*` anymore):

```css
.card-popover-backdrop {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 5;
}

/* Absolutely positioned so it overlays rather than growing the card —
   opening it must never change the card's height, or its row sibling
   (which doesn't stretch, see .recipe-gallery-grid) ends up mismatched. */
.card-popover {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 100%;
  margin-top: 6px;
  z-index: 6;
  padding: 10px;
  border-radius: 12px;
  background: #f4eee3;
  border: 1px solid #e7dccf;
  box-shadow: 0 10px 24px rgba(71, 61, 48, 0.18);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-popover__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-popover__label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #7a8c88;
}

.card-popover__fixed {
  font-size: 12px;
  font-weight: 700;
  color: #7d8f8a;
}

.card-popover__stepper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-popover__stepper button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid #4a9b8f;
  background: #fff;
  color: #2f5b57;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
}

.card-popover__stepper span {
  font-size: 13px;
  font-weight: 800;
  color: #263131;
  min-width: 14px;
  text-align: center;
}

.card-popover__days {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-popover__day {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1.5px solid #e0d4c3;
  background: #fff;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 700;
  color: #263131;
  cursor: pointer;
}

.card-popover__day:has(input:checked) {
  border-color: #4a9b8f;
  background: rgba(74, 155, 143, 0.14);
  color: #2f5b57;
}

.card-popover__day input {
  width: 13px;
  height: 13px;
  accent-color: #4a9b8f;
  margin: 0;
}

.card-popover__day--add {
  border-style: dashed;
  color: #4a9b8f;
}
```

Leave the surrounding `.recipe-gallery-card__add-btn` / `--active` rules and the section comment above them (`/* ── Cook + quick-add row, and its popover ─────────────────────── */`) in place — only this popover block is dead code now.

- [ ] **Step 3: Fix the meal-picker grid for 4 meal types**

In `planner.css`, find:

```css
.add-sheet__meals {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
```

Replace with:

```css
.add-sheet__meals {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
```

(`MEAL_TYPES` is now 4 entries — 5 columns would leave a trailing gap.)

- [ ] **Step 4: Add the chip "↻ move" button style**

In `planner.css`, immediately after the `.planner-recipe-chip__remove` block (right before the `/* ── Add day button ─────────────────────────────────────────── */` comment), insert:

```css
.planner-recipe-chip__move {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  font-size: 13px;
  line-height: 1;
  color: #4a9b8f;
  flex-shrink: 0;
}
```

- [ ] **Step 5: Add the detail-screen "selected, no placement yet" hint style**

In `planner.css`, immediately after the `.recipe-detail-placements__chip` block, insert:

```css
.recipe-detail-placements__hint {
  font-size: 12px;
  font-weight: 600;
  color: #a8978a;
  font-style: italic;
}
```

- [ ] **Step 6: Add the "Отобрано" pool and "Начать меню заново" styles**

In `planner.css`, immediately after the `.planner-add-day:hover` block (end of the "Add day button" section, before the "Recipe gallery (grid)" comment), insert:

```css
/* ── Selected pool (Отобрано) ──────────────────────────────────── */
.menu-pool {
  background: rgba(250, 247, 242, 0.96);
  border: 1px solid #e7dccf;
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 4px 14px rgba(71, 61, 48, 0.05);
}

.menu-pool__title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #2f5b57;
}

.menu-pool__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-pool__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 0;
  border-top: 1px solid #e7dccf;
}

.menu-pool__row:first-child {
  border-top: none;
  padding-top: 0;
}

.menu-pool__name {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.menu-pool__title-text {
  font-size: 14px;
  font-weight: 700;
  color: #263131;
}

.menu-pool__ingr {
  font-size: 11px;
  color: #7d8f8a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-pool__badge {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: #2f5b57;
  background: rgba(74, 155, 143, 0.1);
  border-radius: 999px;
  padding: 3px 8px;
}

.menu-pool__distribute {
  flex-shrink: 0;
  border: 1.5px solid #4a9b8f;
  border-radius: 10px;
  background: none;
  color: #2f5b57;
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  padding: 6px 10px;
  cursor: pointer;
}

.menu-pool__remove {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 2px;
  font-size: 12px;
  color: #a8978a;
  font-family: inherit;
}

/* ── Menu reset (start over) ───────────────────────────────────── */
.menu-reset-link {
  background: none;
  border: none;
  padding: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #a8978a;
  text-decoration: underline;
  text-decoration-style: dotted;
  cursor: pointer;
  font-family: inherit;
  align-self: center;
}

.menu-reset-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: #fff5f5;
  border-top: 1px solid #fdd;
  flex-shrink: 0;
}

.menu-reset-bar__text {
  font-size: 13px;
  font-weight: 600;
  color: #c0392b;
}

.menu-reset-bar__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.menu-reset-bar__cancel {
  background: none;
  border: 1.5px solid #ccc;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #555;
  cursor: pointer;
  font-family: inherit;
}

.menu-reset-bar__ok {
  background: #e53935;
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
}
```

- [ ] **Step 7: Lint, build, and run the planner test suite**

Run: `npm run lint`
Expected: no errors (no unused imports/vars — `countPlanRecipes` is no longer imported in this file; `keyIngredients` factors out the ingredient-preview logic previously duplicated inline in `RecipeCard`).

Run: `npm run build`
Expected: succeeds.

Run: `npx vitest run src/features/planner`
Expected: PASS (Task 1's tests still cover `plannerUtils.js`; this file has no dedicated unit tests — visual verification is Task 4).

- [ ] **Step 8: Commit**

```bash
git add src/features/planner/PlannerMenuScreen.jsx src/features/planner/planner.css
git commit -m "feat(planner): make Рецепты pure selection, add distribute/move/reset to Меню"
```

---

### Task 3: Hub updates — `HomeScreen.jsx`

**Files:**
- Modify: `src/features/home/HomeScreen.jsx:242-278`

**Interfaces:**
- Consumes: `countPlanRecipes` (unchanged import, still used for the placement-based gate on "Меню"'s value line and "Покупки"'s gate), `existingPlan.selectedRecipes` (plain array field, always present after `loadPlan`'s `normalizePlan` pass — see Task 1).

- [ ] **Step 1: Update the hub's gating and copy**

In `src/features/home/HomeScreen.jsx`, find (inside `PlannerTab`, lines 242–278):

```jsx
  const hasRecipes = !!existingPlan && countPlanRecipes(existingPlan) > 0;
  const dayCount = hasRecipes ? existingPlan.days.length : 0;
  const recipeCount = hasRecipes ? countPlanRecipes(existingPlan) : 0;

  return (
    <div className="planner-hub">
      <div className="planner-hub__grid">
        <HubCard
          state={hasRecipes ? 'done' : 'active'}
          icon="🍽️"
          title="Рецепты"
          value={hasRecipes ? `${dayCount} дн. · ${recipeCount} рец.` : 'Смотри рецепты и добавляй в меню'}
          onClick={() => setScreen('planner_menu')}
        >
          {hasRecipes && <DayStrip days={existingPlan.days} />}
        </HubCard>

        <HubCard
          state={hasRecipes ? 'active' : 'locked'}
          icon="📋"
          title="Меню"
          value={hasRecipes ? 'Открой и отредактируй' : 'Сначала рецепты'}
          onClick={() => {
            setPlannerInitialView('plan');
            setScreen('planner_menu');
          }}
          disabled={!hasRecipes}
        />

        <HubCard
          state={hasRecipes ? 'active' : 'locked'}
          icon="🛒"
          title="Покупки"
          value={hasRecipes ? 'Список готов' : 'Сначала меню'}
          onClick={() => setScreen('planner_summary')}
          disabled={!hasRecipes}
        />
```

Replace with:

```jsx
  const hasSelection = !!existingPlan && existingPlan.selectedRecipes.length > 0;
  const hasRecipes = !!existingPlan && countPlanRecipes(existingPlan) > 0;
  const dayCount = hasRecipes ? existingPlan.days.length : 0;
  const recipeCount = hasRecipes ? countPlanRecipes(existingPlan) : 0;
  const selectedCount = hasSelection ? existingPlan.selectedRecipes.length : 0;

  return (
    <div className="planner-hub">
      <div className="planner-hub__grid">
        <HubCard
          state={hasSelection ? 'done' : 'active'}
          icon="🍽️"
          title="Рецепты"
          value={hasSelection ? `${selectedCount} отобрано` : 'Смотри рецепты и добавляй в меню'}
          onClick={() => setScreen('planner_menu')}
        >
          {hasRecipes && <DayStrip days={existingPlan.days} />}
        </HubCard>

        <HubCard
          state={hasSelection ? 'active' : 'locked'}
          icon="📋"
          title="Меню"
          value={hasRecipes ? `${dayCount} дн. · ${recipeCount} рец.` : hasSelection ? 'Пока пусто' : 'Сначала рецепты'}
          onClick={() => {
            setPlannerInitialView('plan');
            setScreen('planner_menu');
          }}
          disabled={!hasSelection}
        />

        <HubCard
          state={hasRecipes ? 'active' : 'locked'}
          icon="🛒"
          title="Покупки"
          value={hasRecipes ? 'Список готов' : 'Сначала меню'}
          onClick={() => setScreen('planner_summary')}
          disabled={!hasRecipes}
        />
```

The "Раскладка" `HubCard` below (unconditionally locked) is untouched.

- [ ] **Step 2: Lint and build**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/features/home/HomeScreen.jsx
git commit -m "feat(planner): gate the Меню hub card on recipe selection, not placement"
```

---

### Task 4: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background)

- [ ] **Step 2: Verify Рецепты is selection-only**

Using a headless-browser session (or the running dev server) as an existing student with recipes available:
1. Open a student → Планировщик tab → "Рецепты" hub card.
2. Confirm the tab bar shows 5 tabs: Все, завтрак, обед, ужин, перекус, напитки.
3. Tap "+ Добавить" on a card with no day/meal picker appearing — the button should immediately flip to "✓ В меню" and a ✓ badge should appear on the photo. No popover, no day checkboxes, no portions stepper.
4. Tap the same button again — it reverts to "+ Добавить", badge disappears.
5. Re-select 2–3 recipes (including one tagged напитки). Confirm the header pill reads "Меню · N" matching the count.

- [ ] **Step 3: Verify Меню — distribute, move, reset**

1. From the "Меню" pill, open the Меню screen. Confirm an "Отобрано" section lists the selected recipes with an ingredient preview, a "Распределить" button, and a "Убрать" button (no placement badge yet, since nothing is scheduled).
2. Tap "Распределить" on the напитки recipe → the day/meal/portions sheet opens with day chip 1 pre-selected but no meal type pre-selected (confirm is disabled until a meal is picked, matching existing sheet behavior) → pick "завтрак" → confirm. Back in Меню, the "Отобрано" row for that recipe should now show a "×1" badge, and a "День 1" section with "🌅 завтрак" should list it.
3. Tap "Распределить" on the same drink again → pick "День 1" + "ужин" → confirm. The "Отобрано" badge should become "×2", and both a завтрак and ужин section should list the drink on День 1 — proving the same recipe can be scheduled into two different meals.
4. In "По дням", find a placed recipe's chip and tap "↻". Confirm the sheet opens pre-filled with that placement's current day/meal/portions (not blank defaults). Change the meal type and confirm — verify the old placement is gone and only the new one exists (chip count in that meal section decreases by one, the new section gains one — not both).
5. Tap "Убрать" on a recipe still in "Отобрано" — verify it disappears from "Отобрано" and every "По дням" section it was placed in.
6. Tap "Начать меню заново" — verify the inline confirm bar appears with the exact copy "Точно начать заново? Всё меню будет удалено." and Да/Нет buttons. Tap "Нет" — bar closes, nothing changes. Tap the link again, then "Да" — verify "Отобрано" and all day sections are empty (a single empty День 1 remains).

- [ ] **Step 4: Verify the detail screen's direct-add path**

1. From Рецепты, tap a recipe's photo/title (not the toggle) to open its ingredients detail screen.
2. Confirm the "Уже в меню" chip list is absent and instead shows nothing extra if the recipe was never selected — then tap "+ Добавить в меню", pick a day/meal, confirm.
3. Go back — reopen the same recipe's detail screen. Confirm "Уже в меню" now lists the placement, and the recipe's Рецепты-grid toggle also shows "✓ В меню" (proving the detail-screen sheet path also marks it selected).
4. Pick a still-selected recipe with zero placements (e.g. tap its Рецепты toggle to select without distributing) and open its detail screen — confirm it shows the "Отобрано, пока без дня" hint instead of an empty/missing state.

- [ ] **Step 5: Verify the hub**

1. With a fresh student (no plan) or after resetting: confirm "Меню" hub card is locked ("Сначала рецепты") and "Рецепты" reads its empty-state copy.
2. Select one recipe (no placement yet): confirm "Рецепты" card flips to done-state and reads "1 отобрано"; "Меню" card unlocks and reads "Пока пусто".
3. Distribute that recipe to a day/meal: confirm "Меню" card's value line switches to the "{N} дн. · {N} рец." placement format.
4. Confirm "Покупки" stays locked until at least one placement exists (selection alone should not unlock it).

- [ ] **Step 6: Screenshot proof**

Capture before/after screenshots of the Рецепты grid (toggle states) and the Меню screen ("Отобрано" section + a day card with a "↻" button visible) into the scratchpad directory, per this session's established verification pattern.

- [ ] **Step 7: Full test suite + deploy**

Run: `npx vitest run`
Expected: PASS.

Run: `npm run build`
Expected: succeeds.

Then follow the project's standard deploy flow (`git status --short`, commit any remaining changes, `npm run deploy:prod`, `npm run deploy:verify`) per `CLAUDE.md`.
