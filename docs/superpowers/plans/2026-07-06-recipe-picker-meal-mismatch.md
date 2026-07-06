# Предупреждение о несоответствии приёма пищи Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** При попытке назначить рецепт на приём пищи, для которого он не помечен (кроме тега «напитки»), показывать подтверждение вместо молчаливого назначения — как при выборе через несовпадающую вкладку пикера, так и при переносе рецепта с другого приёма.

**Architecture:** Чистая функция-проверка в `plannerUtils.js`. `PlannerMenuScreen.jsx`'s `handleToggleSelect` становится тонким гейтом перед существующей логикой назначения (переименованной в `applyToggleSelect`); при несоответствии показывается новый модальный компонент `MealMismatchConfirm`, использующий уже существующие sheet-классы (`portions-sheet*`) и кнопки подтверждения (`menu-reset-bar__cancel/ok`).

**Tech Stack:** React 19, Vitest.

## Global Constraints

- Тег «напитки» полностью исключает рецепт из проверки, независимо от целевого приёма пищи.
- Снятие выбора (клик по рецепту, уже стоящему именно в целевом приёме) — без проверки.
- Перенос рецепта с другого приёма — та же проверка, что и первичный выбор (это НЕ считается снятием).
- Никакого «не спрашивать больше» — предупреждение показывается каждый раз при несоответствии.

---

### Task 1: `needsMealMismatchWarning` в `plannerUtils.js`

**Files:**
- Modify: `src/features/planner/plannerUtils.js`
- Test: `src/features/planner/plannerUtils.test.js`

**Interfaces:**
- Produces: `needsMealMismatchWarning(recipe: { tags: string[] }, mealType: string) => boolean`. Используется в Task 2 (`PlannerMenuScreen.jsx`).

- [ ] **Step 1: Написать падающий тест**

Добавить `needsMealMismatchWarning` в импорт (строка 19, после `isReadyToCook`) в `src/features/planner/plannerUtils.test.js`:

```js
  isReadyToCook,
  isRecipeCookedThisCycle,
  needsMealMismatchWarning,
} from './plannerUtils.js';
```

Добавить в конец файла (после последнего `describe('isRecipeCookedThisCycle', ...)` блока):

```js

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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: FAIL — `needsMealMismatchWarning is not a function`.

- [ ] **Step 3: Реализовать функцию**

В `src/features/planner/plannerUtils.js`, сразу после `isRecipeCookedThisCycle` (заканчивается на строке 176, перед докстрингом `/** Upgrades a plan saved in an old format ... */`), добавить:

```js

// "напитки" is a browsing-only catalog tag (see RECIPE_TAGS), not a
// meal-type indicator — a drink recipe is never flagged as mismatched
// for any slot.
export function needsMealMismatchWarning(recipe, mealType) {
  if (recipe.tags.includes('напитки')) return false;
  return !recipe.tags.includes(mealType);
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/plannerUtils.js src/features/planner/plannerUtils.test.js
git commit -m "feat(planner): add needsMealMismatchWarning helper"
```

---

### Task 2: Подтверждение в `PlannerMenuScreen.jsx`

**Files:**
- Modify: `src/features/planner/PlannerMenuScreen.jsx`
- Modify: `src/features/planner/planner.css` (append)

**Interfaces:**
- Consumes: `needsMealMismatchWarning` (Task 1).

- [ ] **Step 1: Импортировать `needsMealMismatchWarning`**

Заменить импорт (строки 6-11):

```js
import {
  createPlan, isRecipeSelected, selectRecipe, deselectRecipe,
  setMealAssignment, setSelectedPortions,
  setIngredientDecision, buildSelectedIngredientsSummary, isMenuFullyDecided,
  MEAL_TYPES, RECIPE_TAGS,
} from './plannerUtils.js';
```

на:

```js
import {
  createPlan, isRecipeSelected, selectRecipe, deselectRecipe,
  setMealAssignment, setSelectedPortions,
  setIngredientDecision, buildSelectedIngredientsSummary, isMenuFullyDecided,
  needsMealMismatchWarning,
  MEAL_TYPES, RECIPE_TAGS,
} from './plannerUtils.js';
```

- [ ] **Step 2: Добавить `MealMismatchConfirm`, сразу после `PortionsPromptSheet`**

`PortionsPromptSheet` заканчивается строкой 195 (`}`), перед комментарием `// ─── Recipe picker ... ───` (строка 197). Добавить между ними:

```jsx

function MealMismatchConfirm({ recipe, mealType, onConfirm, onCancel }) {
  const others = recipe.tags.filter((t) => t !== 'напитки' && MEAL_TYPES.includes(t));
  const text = others.length > 0
    ? `Этот рецепт обычно готовят на ${others.join(' или ')}. Всё равно добавить на ${mealType}?`
    : `Этот рецепт не подходит для приёма «${mealType}». Всё равно добавить?`;
  return (
    <div className="portions-sheet-backdrop" onClick={onCancel}>
      <div className="portions-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="portions-sheet__handle" />
        <h2 className="portions-sheet__title">{getTopicTitle(recipe.text.title)}</h2>
        <p className="meal-mismatch-text">{text}</p>
        <div className="meal-mismatch-actions">
          <button type="button" className="menu-reset-bar__cancel" onClick={onCancel}>Нет</button>
          <button type="button" className="menu-reset-bar__ok" onClick={onConfirm}>Да</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Добавить состояние `mismatchConfirm`**

Заменить (строки 481-485):

```js
  // Recipe (+ the meal slot it's being added for) currently awaiting a
  // portions choice before it's added — set only when adding (never when
  // removing) and only for recipes where portions is an actual choice (not
  // fixed_portions).
  const [portionsPrompt, setPortionsPrompt] = useState(null);
```

на:

```js
  // Recipe (+ the meal slot it's being added for) currently awaiting a
  // portions choice before it's added — set only when adding (never when
  // removing) and only for recipes where portions is an actual choice (not
  // fixed_portions).
  const [portionsPrompt, setPortionsPrompt] = useState(null);
  // Recipe (+ target meal slot) awaiting confirmation because its tags
  // don't cover that meal type — set right before what would otherwise be
  // an immediate assignment (select or reassign from another slot).
  const [mismatchConfirm, setMismatchConfirm] = useState(null);
```

- [ ] **Step 4: Переименовать `handleToggleSelect` в `applyToggleSelect`, добавить гейт и подтверждение**

Заменить (строки 525-548):

```js
  // Removing needs no prompt. Adding a fixed_portions recipe has nothing to
  // choose (the batch size is inherent to the dish), so it's added
  // immediately too. Everything else asks for portions first, so the count
  // is always something the user actually chose — never a silent default
  // that happens to equal the recipe's own base serving size.
  //
  // A recipe already selected for a *different* meal type re-assigns
  // (moves) instead of being removed — this is how the picker's "already:
  // X" badge becomes an actual reassignment when tapped from another slot.
  function handleToggleSelect(recipe, mealType) {
    if (isRecipeSelected(plan, recipe.text.id)) {
      if (mealType && plan.mealAssignments[recipe.text.id] !== mealType) {
        setPlan((p) => setMealAssignment(p, recipe.text.id, mealType));
        return;
      }
      setPlan((p) => deselectRecipe(p, recipe.text.id));
      return;
    }
    if (recipe.fixedPortions) {
      setPlan((p) => setMealAssignment(selectRecipe(p, recipe.text.id), recipe.text.id, mealType));
      return;
    }
    setPortionsPrompt({ recipe, mealType });
  }
```

на:

```js
  // Removing needs no prompt. Adding a fixed_portions recipe has nothing to
  // choose (the batch size is inherent to the dish), so it's added
  // immediately too. Everything else asks for portions first, so the count
  // is always something the user actually chose — never a silent default
  // that happens to equal the recipe's own base serving size.
  //
  // A recipe already selected for a *different* meal type re-assigns
  // (moves) instead of being removed — this is how the picker's "already:
  // X" badge becomes an actual reassignment when tapped from another slot.
  function applyToggleSelect(recipe, mealType) {
    if (isRecipeSelected(plan, recipe.text.id)) {
      if (mealType && plan.mealAssignments[recipe.text.id] !== mealType) {
        setPlan((p) => setMealAssignment(p, recipe.text.id, mealType));
        return;
      }
      setPlan((p) => deselectRecipe(p, recipe.text.id));
      return;
    }
    if (recipe.fixedPortions) {
      setPlan((p) => setMealAssignment(selectRecipe(p, recipe.text.id), recipe.text.id, mealType));
      return;
    }
    setPortionsPrompt({ recipe, mealType });
  }

  // Gate in front of applyToggleSelect: everything that would result in the
  // recipe becoming assigned to mealType (first pick, reassignment from
  // another slot) is checked against its tags first. Only removing a recipe
  // already sitting in this exact slot skips the check.
  function handleToggleSelect(recipe, mealType) {
    const isDeselecting =
      isRecipeSelected(plan, recipe.text.id) &&
      plan.mealAssignments[recipe.text.id] === mealType;
    if (!isDeselecting && needsMealMismatchWarning(recipe, mealType)) {
      setMismatchConfirm({ recipe, mealType });
      return;
    }
    applyToggleSelect(recipe, mealType);
  }

  function confirmMealMismatch() {
    const { recipe, mealType } = mismatchConfirm;
    setMismatchConfirm(null);
    applyToggleSelect(recipe, mealType);
  }
```

- [ ] **Step 5: Рендерить `MealMismatchConfirm`**

Заменить финальный `return` компонента (строки 614-625):

```jsx
  return (
    <>
      {content}
      {portionsPrompt && (
        <PortionsPromptSheet
          recipe={portionsPrompt.recipe}
          onConfirm={handleConfirmPortions}
          onClose={() => setPortionsPrompt(null)}
        />
      )}
    </>
  );
}
```

на:

```jsx
  return (
    <>
      {content}
      {portionsPrompt && (
        <PortionsPromptSheet
          recipe={portionsPrompt.recipe}
          onConfirm={handleConfirmPortions}
          onClose={() => setPortionsPrompt(null)}
        />
      )}
      {mismatchConfirm && (
        <MealMismatchConfirm
          recipe={mismatchConfirm.recipe}
          mealType={mismatchConfirm.mealType}
          onConfirm={confirmMealMismatch}
          onCancel={() => setMismatchConfirm(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 6: Добавить CSS**

Добавить в `src/features/planner/planner.css` сразу после `.portions-sheet__confirm` (заканчивается строкой 451, перед комментарием `/* ── Ingredients summary ... ── */`):

```css

.meal-mismatch-text {
  margin: 0;
  font-size: 14px;
  color: #5a5044;
  text-align: center;
  line-height: 1.4;
}

.meal-mismatch-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.meal-mismatch-actions .menu-reset-bar__cancel,
.meal-mismatch-actions .menu-reset-bar__ok {
  flex: 1;
  text-align: center;
}
```

- [ ] **Step 7: Запустить lint**

Run: `npx eslint src/features/planner/PlannerMenuScreen.jsx`
Expected: без новых ошибок (не должно быть `no-unused-vars` — `needsMealMismatchWarning` используется, `handleToggleSelect`/`applyToggleSelect` оба используются).

- [ ] **Step 8: Commit**

```bash
git add src/features/planner/PlannerMenuScreen.jsx src/features/planner/planner.css
git commit -m "feat(planner): warn before assigning a recipe to a mismatched meal slot"
```

---

### Task 3: Ручная проверка и регрессия

**Files:** (без изменений кода — только верификация)

- [ ] **Step 1: Запустить тесты**

Run: `npx vitest run src/features/planner src/features/home src/core`
Expected: все проходят (0 failures), включая новые тесты `needsMealMismatchWarning`.

- [ ] **Step 2: Ручная проверка в браузере (`run`-скилл)**

1. Открыть Меню, нажать «Добавить» на слоте «Завтрак» — открывается пикер с заголовком «🌅 Завтрак».
2. Переключиться на вкладку «Обед», выбрать рецепт с тегами `обед, ужин` (например, курицу — `chicken.txt`) — должно появиться подтверждение «Этот рецепт обычно готовят на обед или ужин. Всё равно добавить на завтрак?».
3. Нажать «Нет» — подтверждение закрывается, рецепт НЕ добавлен (пикер остаётся открытым).
4. Повторить выбор того же рецепта, нажать «Да» — рецепт добавляется на завтрак, подтверждение закрывается, экран Меню показывает рецепт в слоте «Завтрак».
5. Открыть пикер для «Обед», выбрать рецепт с тегом `напитки` (например, какао) — добавляется сразу, без подтверждения.
6. Открыть пикер для «Обед», выбрать рецепт с тегом только `завтрак` (например, овсянку — `oatmeal.txt`, `tags: завтрак`) — подтверждение, нажать «Да» (овсянка теперь на «Обед»). Затем открыть пикер для «Ужин» и там же выбрать ту же овсянку (она уже выбрана на «Обед», значит это перенос, не первичный выбор) — должно снова появиться подтверждение, так как «ужин» тоже не входит в её теги; подтвердить — овсянка переезжает на «Ужин», в «Обед» её больше нет.
7. Убедиться, что клик по рецепту, уже стоящему именно в открытом сейчас слоте (снятие выбора), происходит без единого вопроса.

Expected: все пункты подтверждаются, консоль браузера без ошибок.

- [ ] **Step 3: Финальный commit (если понадобились правки)**

Если Step 1-2 потребовали правок — закоммитить отдельно (`fix(planner): ...`). Если правок не было — шаг пропускается.

## Self-Review Notes

- **Spec coverage:** триггер по тегам против целевого слота (Task 1, Task 2 Step 4), исключение «напитки» (Task 1), UI подтверждения в стиле существующих sheet-компонентов (Task 2 Step 2, 6), перенос между приёмами тоже проверяется (Task 2 Step 4, явно протестировано в Task 3 Step 2.6), снятие выбора без проверки (Task 2 Step 4 `isDeselecting`).
- **Type consistency:** `needsMealMismatchWarning(recipe, mealType)` используется с одинаковой сигнатурой в Task 1 (тест) и Task 2 (`handleToggleSelect`). `mismatchConfirm` — `{ recipe, mealType } | null`, одинаково в состоянии и в `MealMismatchConfirm`'s пропсах.
