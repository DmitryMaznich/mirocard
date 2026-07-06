# Начало и конец цикла Планировщика Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Хаб Планировщика показывает прогресс готовки по выбранным рецептам и даёт единую кнопку «Начать новое меню», закрывающую текущий цикл (Меню → Покупки → В магазин → Раскладка → готовка) и запускающую новый с чистого листа.

**Architecture:** «Приготовлено» определяется без новых действий пользователя — по уже существующим завершённым занятиям (`sessions` в сторе) с режимом `follow_instruction` для текста рецепта, случившимся после создания текущего плана. Кнопка сброса переезжает из `PlannerMenuScreen.jsx` (где сейчас спрятана мелкой ссылкой) на хаб `HomeScreen.jsx`, становясь единственной точкой входа. Сброс дополнительно очищает несохранённые (pending) фото чека/зон раскладки — без этого они утекли бы в новый цикл.

**Tech Stack:** React 19, Zustand, Vite, Vitest + `fake-indexeddb` (уже настроено).

## Global Constraints

- «Приготовлено» — по завершённой сессии `modeId === 'follow_instruction'` для `textId` рецепта, с `completedAt >= plan.createdAt` (граница цикла). Никаких новых тапов/фото для этого шага.
- Кнопка сброса — ровно одна, на хабе. Старая ссылка «Начать меню заново» внутри Меню удаляется полностью.
- Сброс не требует, чтобы всё было приготовлено — подтверждение лишь предупреждает о прогрессе, не блокирует.
- Без истории циклов — чистый сброс, как и раньше (см. дизайн, раздел Scope).

---

### Task 1: `isRecipeCookedThisCycle` в `plannerUtils.js`

**Files:**
- Modify: `src/features/planner/plannerUtils.js`
- Test: `src/features/planner/plannerUtils.test.js`

**Interfaces:**
- Produces: `isRecipeCookedThisCycle(plan: Plan, recipe: { topicId, text: { id } }, sessions: SessionRecord[]) => boolean`. Используется в Task 5 (`HomeScreen.jsx`).

- [ ] **Step 1: Написать падающий тест**

Заменить импорт в `src/features/planner/plannerUtils.test.js` (строки 1-20):

```js
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
  buildSelectedIngredientsSummary,
  isMenuFullyDecided,
  needsShopping,
  isReadyToCook,
  isRecipeCookedThisCycle,
} from './plannerUtils.js';
```

Добавить в конец файла (после закрывающей `});` последнего `describe('normalizePlan', ...)` блока, строка 601):

```js

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
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: FAIL — `isRecipeCookedThisCycle is not a function`.

- [ ] **Step 3: Реализовать функцию**

В `src/features/planner/plannerUtils.js`, сразу после `isReadyToCook` (строки 158-162, перед комментарием `/** Upgrades a plan saved in an old format ... */` на строке 164), добавить:

```js

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
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/features/planner/plannerUtils.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/plannerUtils.js src/features/planner/plannerUtils.test.js
git commit -m "feat(planner): add isRecipeCookedThisCycle helper"
```

---

### Task 2: `topics.deleteFile` в `src/core/db.js`

**Files:**
- Modify: `src/core/db.js`
- Test: `src/core/db.test.js`

**Interfaces:**
- Produces: `topics.deleteFile(db, topicId, filename) => Promise<void>`. Используется в Task 3 (`plannerPhotos.js`).

- [ ] **Step 1: Написать падающий тест**

Добавить в `src/core/db.test.js`, в конец блока `describe('topics store', ...)` (после теста `deleteTopic removes all files for topic`, перед закрывающей `});` на строке 65):

```js

  it('deleteFile removes only the named file, keeping others in the same topic', async () => {
    const b = new Blob(['x']);
    await topics.saveFile(db, 'keep_some', 'a.webp', b);
    await topics.saveFile(db, 'keep_some', 'b.webp', b);
    await topics.deleteFile(db, 'keep_some', 'a.webp');
    expect(await topics.getFile(db, 'keep_some', 'a.webp')).toBeNull();
    expect(await topics.getFile(db, 'keep_some', 'b.webp')).toBeInstanceOf(Blob);
  });
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/core/db.test.js`
Expected: FAIL — `topics.deleteFile is not a function`.

- [ ] **Step 3: Реализовать `deleteFile`**

В `src/core/db.js`, внутри объекта `topics` (строки 62-97), добавить метод сразу после `deleteTopic` (перед закрывающей `};` объекта, строка 97):

```js

  deleteFile(db, topicId, filename) {
    return req2p(tx(db, "topics", "readwrite").delete(topicKey(topicId, filename)));
  },
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/core/db.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/db.js src/core/db.test.js
git commit -m "feat(db): add topics.deleteFile for single-file removal"
```

---

### Task 3: `clearPendingPhotos` в `plannerPhotos.js`

**Files:**
- Modify: `src/features/planner/plannerPhotos.js`
- Test: `src/features/planner/plannerPhotos.test.js`

**Interfaces:**
- Consumes: `topics.deleteFile` (Task 2), `getPendingZonePhotoIds` (уже существует в этом файле).
- Produces: `clearPendingPhotos(studentId) => Promise<void>`. Используется в Task 5 (`HomeScreen.jsx`).

- [ ] **Step 1: Написать падающий тест**

Добавить в конец `src/features/planner/plannerPhotos.test.js`:

```js

import { clearPendingPhotos } from './plannerPhotos.js';

describe('clearPendingPhotos', () => {
  it('removes pending receipt and zone photos but keeps archived trip photos', async () => {
    await savePendingReceiptPhoto('student-g', fakeBlob('pending-receipt'));
    await savePendingZonePhoto('student-g', 'fridge', fakeBlob('pending-fridge'));
    await archiveTripPhotos('student-g', 555); // archives a copy under receipt_555.jpg / putaway_555_fridge.jpg

    await clearPendingPhotos('student-g');

    expect(await getPendingReceiptPhoto('student-g')).toBeNull();
    expect(await getPendingZonePhotoIds('student-g')).toEqual([]);
    expect(await getTripReceiptPhoto('student-g', 555)).toBeInstanceOf(Blob);
    expect(await getTripZonePhoto('student-g', 555, 'fridge')).toBeInstanceOf(Blob);
  });

  it('does nothing when there is nothing pending', async () => {
    await clearPendingPhotos('student-h');
    expect(await getPendingReceiptPhoto('student-h')).toBeNull();
  });
});
```

(`archiveTripPhotos`, `getTripReceiptPhoto`, `getTripZonePhoto`, `fakeBlob` already imported/defined earlier in this test file — no new imports needed besides `clearPendingPhotos`.)

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/planner/plannerPhotos.test.js`
Expected: FAIL — `clearPendingPhotos is not a function`.

- [ ] **Step 3: Реализовать `clearPendingPhotos`**

В `src/features/planner/plannerPhotos.js`, добавить в конец файла:

```js

export async function clearPendingPhotos(studentId) {
  const db = await getDb();
  await topics.deleteFile(db, photoTopic(studentId), 'pending_receipt.jpg');
  const zoneIds = await getPendingZonePhotoIds(studentId);
  for (const zoneId of zoneIds) {
    await topics.deleteFile(db, photoTopic(studentId), `pending_putaway_${zoneId}.jpg`);
  }
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx vitest run src/features/planner/plannerPhotos.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/plannerPhotos.js src/features/planner/plannerPhotos.test.js
git commit -m "feat(planner): add clearPendingPhotos for cycle reset"
```

---

### Task 4: Галочка «приготовлено» в `CookPickerSheet`

**Files:**
- Modify: `src/features/planner/CookPickerSheet.jsx`
- Modify: `src/features/planner/planner.css` (append)

**Interfaces:**
- Consumes: новый проп `cookedTextIds: Set<string>` (опциональный — `undefined` трактуется как «ничего не приготовлено»). Передаётся из Task 5.

- [ ] **Step 1: Обновить `CookPickerSheet.jsx`**

Заменить весь файл `src/features/planner/CookPickerSheet.jsx`:

```jsx
import { useTopicFile } from '@/shared/hooks/useTopicFile';
import { getTopicTitle } from '@/shared/utils/format';
import './planner.css';

function CookPickerPhoto({ topicId, imagePath }) {
  const url = useTopicFile(topicId, imagePath);
  if (!url) return <div className="cook-picker-item__photo cook-picker-item__photo--empty" />;
  return <img className="cook-picker-item__photo" src={url} alt="" />;
}

export default function CookPickerSheet({ recipes, cookedTextIds, onPick, onClose }) {
  return (
    <div className="portions-sheet-backdrop" onClick={onClose}>
      <div className="portions-sheet cook-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="portions-sheet__handle" />
        <h2 className="portions-sheet__title">Что готовим?</h2>
        <ul className="cook-picker-list">
          {recipes.map((recipe) => {
            const isCooked = cookedTextIds?.has(recipe.text.id);
            return (
              <li key={recipe.text.id}>
                <button
                  type="button"
                  className={`cook-picker-item${isCooked ? ' cook-picker-item--done' : ''}`}
                  onClick={() => onPick(recipe)}
                >
                  <CookPickerPhoto topicId={recipe.topicId} imagePath={recipe.text.photo} />
                  <span className="cook-picker-item__name">{getTopicTitle(recipe.text.title)}</span>
                  {isCooked && <span className="cook-picker-item__check">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="portions-sheet__cancel" onClick={onClose}>
          Отменить
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Добавить CSS**

Добавить в `src/features/planner/planner.css` сразу после блока `.cook-picker-item__name` (строки 1646-1650, перед комментарием `/* ── Planner hub: Начинаем готовить CTA ── */` на строке 1652):

```css

.cook-picker-item--done {
  border-color: #4a9b8f;
  background: rgba(74, 155, 143, 0.08);
}

.cook-picker-item__check {
  margin-left: auto;
  color: #2f5b57;
  font-size: 18px;
  font-weight: 800;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/planner/CookPickerSheet.jsx src/features/planner/planner.css
git commit -m "feat(planner): mark already-cooked recipes in CookPickerSheet"
```

(Ручная проверка в браузере — вместе с Task 5, так как `cookedTextIds` реально приходит только оттуда.)

---

### Task 5: Прогресс готовки и «Начать новое меню» на хабе

**Files:**
- Modify: `src/features/home/HomeScreen.jsx`
- Modify: `src/features/planner/planner.css` (append)

**Interfaces:**
- Consumes: `isRecipeCookedThisCycle` (Task 1), `clearPendingPhotos` (Task 3), `cookedTextIds` prop of `CookPickerSheet` (Task 4).

- [ ] **Step 1: Обновить импорты**

В `src/features/home/HomeScreen.jsx` заменить блок импортов (текущие строки 12-17):

```js
import { loadPlan, loadAllRecipes } from "@/features/planner/plannerApi";
import { isMenuFullyDecided, isReadyToCook, needsShopping } from "@/features/planner/plannerUtils";
import { isShoppingDone } from "@/features/planner/plannerShoppingUtils";
import { buildPutawayQueue, getRequiredZones } from "@/features/planner/putawayUtils";
import { getPendingReceiptPhoto, getPendingZonePhotoIds } from "@/features/planner/plannerPhotos";
import CookPickerSheet from "@/features/planner/CookPickerSheet";
```

на:

```js
import { loadPlan, loadAllRecipes, savePlan, resetShoppingData } from "@/features/planner/plannerApi";
import { isMenuFullyDecided, isReadyToCook, needsShopping, resetPlan, isRecipeCookedThisCycle } from "@/features/planner/plannerUtils";
import { isShoppingDone } from "@/features/planner/plannerShoppingUtils";
import { buildPutawayQueue, getRequiredZones } from "@/features/planner/putawayUtils";
import { getPendingReceiptPhoto, getPendingZonePhotoIds, clearPendingPhotos } from "@/features/planner/plannerPhotos";
import CookPickerSheet from "@/features/planner/CookPickerSheet";
```

- [ ] **Step 2: Добавить состояние и `sessions` в `PlannerTab`**

Заменить:

```js
  const setPlannerShoppingInitialMode = useAppStore((s) => s.setPlannerShoppingInitialMode);
  const [existingPlan, setExistingPlan] = useState(undefined); // undefined = loading
  const [allRecipes, setAllRecipes] = useState([]);
  const [boughtCount, setBoughtCount] = useState(0);
  const [shoppingDone, setShoppingDone] = useState(false);
  const [putawayDone, setPutawayDone] = useState(false);
  const [cookPickerOpen, setCookPickerOpen] = useState(false);
```

на:

```js
  const setPlannerShoppingInitialMode = useAppStore((s) => s.setPlannerShoppingInitialMode);
  const sessions = useAppStore((s) => s.sessions);
  const [existingPlan, setExistingPlan] = useState(undefined); // undefined = loading
  const [allRecipes, setAllRecipes] = useState([]);
  const [boughtCount, setBoughtCount] = useState(0);
  const [shoppingDone, setShoppingDone] = useState(false);
  const [putawayDone, setPutawayDone] = useState(false);
  const [cookPickerOpen, setCookPickerOpen] = useState(false);
  const [confirmNewMenu, setConfirmNewMenu] = useState(false);
```

- [ ] **Step 3: Посчитать `cookedTextIds` рядом с `menuRecipes`**

Заменить:

```js
  const menuRecipes = hasSelection
    ? existingPlan.selectedRecipes.map((id) => allRecipes.find((r) => r.text.id === id)).filter(Boolean)
    : [];
```

на:

```js
  const menuRecipes = hasSelection
    ? existingPlan.selectedRecipes.map((id) => allRecipes.find((r) => r.text.id === id)).filter(Boolean)
    : [];
  const cookedTextIds = new Set(
    menuRecipes.filter((r) => isRecipeCookedThisCycle(existingPlan, r, sessions)).map((r) => r.text.id)
  );
```

- [ ] **Step 4: Добавить `handleStartNewMenu`**

Сразу после функции `handleGoShopping` (текущие строки 281-284):

```js
  function handleGoShopping() {
    setPlannerShoppingInitialMode('shop');
    setScreen('planner_shopping');
  }
```

добавить:

```js

  async function handleStartNewMenu() {
    setConfirmNewMenu(false);
    const fresh = resetPlan(student.id);
    await savePlan(fresh);
    await resetShoppingData(student.id);
    await clearPendingPhotos(student.id);
    setExistingPlan(fresh);
  }
```

- [ ] **Step 5: Обновить CTA и добавить кнопку «Начать новое меню»**

Заменить блок (текущие строки 331-359):

```jsx
      {hasSelection && (
        <>
          <button
            type="button"
            className="planner-cook-cta"
            disabled={!readyToCook}
            onClick={() => setCookPickerOpen(true)}
          >
            🍳 Начинаем готовить
          </button>
          {!readyToCook && (
            <div className="planner-cook-hint">
              {!menuDone
                ? 'Сначала реши «Дома» или «Купить» для каждого продукта'
                : !shoppingDone
                  ? 'Сначала докупи всё по списку'
                  : 'Сначала разложи продукты'}
            </div>
          )}
        </>
      )}

      {cookPickerOpen && (
        <CookPickerSheet
          recipes={menuRecipes}
          onPick={handlePickRecipe}
          onClose={() => setCookPickerOpen(false)}
        />
      )}
```

на:

```jsx
      {hasSelection && (
        <>
          <button
            type="button"
            className="planner-cook-cta"
            disabled={!readyToCook}
            onClick={() => setCookPickerOpen(true)}
          >
            {cookedTextIds.size === 0
              ? '🍳 Начинаем готовить'
              : `🍳 Готовка: ${cookedTextIds.size} из ${menuRecipes.length} приготовлено`}
          </button>
          {!readyToCook && (
            <div className="planner-cook-hint">
              {!menuDone
                ? 'Сначала реши «Дома» или «Купить» для каждого продукта'
                : !shoppingDone
                  ? 'Сначала докупи всё по списку'
                  : 'Сначала разложи продукты'}
            </div>
          )}
          <button type="button" className="planner-new-menu-btn" onClick={() => setConfirmNewMenu(true)}>
            🏁 Начать новое меню
          </button>
          {confirmNewMenu && (
            <div className="menu-reset-bar">
              <span className="menu-reset-bar__text">
                {cookedTextIds.size < menuRecipes.length
                  ? `Готово только ${cookedTextIds.size} из ${menuRecipes.length} блюд. Всё равно начать новое меню?`
                  : 'Начать новое меню? Текущее будет закрыто.'}
              </span>
              <div className="menu-reset-bar__actions">
                <button type="button" className="menu-reset-bar__cancel" onClick={() => setConfirmNewMenu(false)}>Нет</button>
                <button type="button" className="menu-reset-bar__ok" onClick={handleStartNewMenu}>Да</button>
              </div>
            </div>
          )}
        </>
      )}

      {cookPickerOpen && (
        <CookPickerSheet
          recipes={menuRecipes}
          cookedTextIds={cookedTextIds}
          onPick={handlePickRecipe}
          onClose={() => setCookPickerOpen(false)}
        />
      )}
```

- [ ] **Step 6: Добавить CSS для `.planner-new-menu-btn`**

Добавить в `src/features/planner/planner.css` сразу после блока `.planner-cook-hint` (строки 1675-1680, перед комментарием `/* ── Menu slot "add recipe" button ── */`):

```css

.planner-new-menu-btn {
  width: 100%;
  margin-top: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1.5px solid #cbb9a3;
  background: none;
  color: #6b5c48;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}

.planner-new-menu-btn:active {
  background: rgba(203, 185, 163, 0.15);
}
```

- [ ] **Step 7: Ручная проверка в браузере (`run`-скилл)**

Собрать меню из 2+ рецептов на разные приёмы пищи (или переиспользовать имеющегося тестового ученика), пройти Покупки/В магазин/Раскладку с фото до состояния `readyToCook`. Затем:
1. Приготовить один рецепт до конца занятия (`follow_instruction`) — вернуться на хаб, убедиться, что кнопка готовки показывает `🍳 Готовка: 1 из N приготовлено`.
2. Открыть `CookPickerSheet` — у приготовленного рецепта галочка ✓ и выделенная рамка, у остальных — нет.
3. Нажать «🏁 Начать новое меню» — подтверждение показывает `Готово только 1 из N блюд. Всё равно начать новое меню?`.
4. Нажать «Да» — Меню становится пустым (`Что будем готовить?`), хаб возвращается к состоянию без выбора, Покупки/В магазин/Раскладка снова заблокированы.
5. Зайти в «В магазине» для нового (пустого) цикла — экран съёмки чека не должен появляться сразу как «уже пройденный» (потому что `getPendingReceiptPhoto` теперь пуст) — фактически список пуст, так что сначала нужно отметить хоть один товар «взял», прежде чем гейт вообще станет актуальным; главное — по завершении нового похода гейт запросит новое фото, а не покажет старое как готовое с первого шага.

Expected: все пункты подтверждаются, консоль браузера без ошибок.

- [ ] **Step 8: Commit**

```bash
git add src/features/home/HomeScreen.jsx src/features/planner/planner.css
git commit -m "feat(planner): add cooking progress and Начать новое меню on the hub"
```

---

### Task 6: Убрать старую ссылку сброса из `PlannerMenuScreen.jsx`

**Files:**
- Modify: `src/features/planner/PlannerMenuScreen.jsx`
- Modify: `src/features/planner/planner.css` (remove dead rule)

**Interfaces:**
- Consumes: ничего нового — только убирает теперь дублирующий путь сброса (единственная точка входа — хаб, Task 5).

- [ ] **Step 1: Убрать неиспользуемые импорты**

Заменить:

```js
import {
  createPlan, isRecipeSelected, selectRecipe, deselectRecipe, resetPlan,
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
  MEAL_TYPES, RECIPE_TAGS,
} from './plannerUtils.js';
```

И заменить:

```js
import { loadPlan, savePlan, sendPlanToStudent, loadAllRecipes, resetShoppingData, PANTRY_ITEMS } from './plannerApi.js';
```

на:

```js
import { loadPlan, savePlan, sendPlanToStudent, loadAllRecipes, PANTRY_ITEMS } from './plannerApi.js';
```

- [ ] **Step 2: Убрать `onReset` из сигнатуры и состояние `confirmReset`**

Заменить:

```js
function MenuLandingView({ plan, allRecipes, onSetPortions, onDeselect, onViewRecipe, onOpenPicker, onSetIngredientDecision, onReset, onBack, onGoShopping, onSendToStudent }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [sending, setSending] = useState(false);
```

на:

```js
function MenuLandingView({ plan, allRecipes, onSetPortions, onDeselect, onViewRecipe, onOpenPicker, onSetIngredientDecision, onBack, onGoShopping, onSendToStudent }) {
  const [sending, setSending] = useState(false);
```

- [ ] **Step 3: Убрать ссылку «Начать меню заново» и confirm-бар**

Заменить:

```jsx
        <button type="button" className="menu-reset-link" onClick={() => setConfirmReset(true)}>
          Начать меню заново
        </button>
        {sendError && <div className="menu-send-error">{sendError}</div>}
```

на:

```jsx
        {sendError && <div className="menu-send-error">{sendError}</div>}
```

И убрать блок (в конце `MenuLandingView`, перед закрывающим `</div>` компонента):

```jsx
      {confirmReset && (
        <div className="menu-reset-bar">
          <span className="menu-reset-bar__text">Точно начать заново? Всё меню будет удалено.</span>
          <div className="menu-reset-bar__actions">
            <button type="button" className="menu-reset-bar__cancel" onClick={() => setConfirmReset(false)}>Нет</button>
            <button type="button" className="menu-reset-bar__ok" onClick={() => { setConfirmReset(false); onReset(); }}>Да</button>
          </div>
        </div>
      )}
```

(просто удалить этот блок целиком — ничего не остаётся на его месте).

- [ ] **Step 4: Убрать `onReset` из вызова `<MenuLandingView>`**

Заменить:

```jsx
        onSetIngredientDecision={(product, decision) =>
          setPlan((p) => setIngredientDecision(p, product, decision))
        }
        onReset={() => {
          setPlan(resetPlan(activeStudentId));
          resetShoppingData(activeStudentId).catch(() => {});
        }}
        onBack={() => setScreen('home')}
```

на:

```jsx
        onSetIngredientDecision={(product, decision) =>
          setPlan((p) => setIngredientDecision(p, product, decision))
        }
        onBack={() => setScreen('home')}
```

- [ ] **Step 5: Убрать неиспользуемый CSS-класс**

Удалить из `src/features/planner/planner.css` блок (строки 551-564):

```css
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
```

(`.menu-reset-bar*` классы НЕ трогать — они переиспользуются на хабе, см. Task 5.)

- [ ] **Step 6: Запустить lint**

Run: `npx eslint src/features/planner/PlannerMenuScreen.jsx`
Expected: без ошибок (в частности, без `no-unused-vars` на `resetPlan`/`resetShoppingData`).

- [ ] **Step 7: Ручная проверка в браузере**

Открыть экран Меню — убедиться, что ссылки «Начать меню заново» больше нет, а весь остальной функционал экрана (слоты приёмов пищи, ингредиенты, отправка ученику, переход в Покупки) работает как прежде.

- [ ] **Step 8: Commit**

```bash
git add src/features/planner/PlannerMenuScreen.jsx src/features/planner/planner.css
git commit -m "refactor(planner): remove menu-local reset link, hub is the single entry point"
```

---

### Task 7: Полный сквозной прогон (регрессия)

**Files:** (без изменений кода — только верификация)

- [ ] **Step 1: Запустить весь Vitest-набор**

Run: `npx vitest run src`
Expected: все тесты в `src/` проходят (0 failures) — включая новые `isRecipeCookedThisCycle`, `topics.deleteFile`, `clearPendingPhotos`.

- [ ] **Step 2: Запустить lint**

Run: `npm run lint`
Expected: без новых ошибок в изменённых файлах (`plannerUtils.js`, `db.js`, `plannerPhotos.js`, `CookPickerSheet.jsx`, `HomeScreen.jsx`, `PlannerMenuScreen.jsx`, `planner.css`).

- [ ] **Step 3: Сквозной ручной прогон в браузере**

Полный цикл с нуля: Меню (2+ рецепта на разные приёмы пищи) → Покупки → В магазин (фото чека) → Раскладка (фото зон) → хаб показывает кнопку готовки и «Начать новое меню» → приготовить один из нескольких рецептов → хаб отражает `N из M` → «Начать новое меню» с предупреждением о неполном прогрессе → подтвердить → всё пусто, цикл начат заново, старая ссылка сброса в Меню отсутствует.

Expected: ни один шаг не даёт ошибок в консоли браузера, поведение соответствует пунктам 7.1-7.4 дизайна.

- [ ] **Step 4: Финальный commit (если понадобились правки)**

Если Step 1-3 потребовали правок — закоммитить отдельно (`fix(planner): ...`). Если правок не было — шаг пропускается.

## Self-Review Notes

- **Spec coverage:** прогресс готовки (Task 1, 4, 5), единая точка входа для сброса (Task 5, 6), очистка pending-фото (Task 2, 3), отсутствие истории циклов (сознательно не реализовано нигде — соответствует Scope дизайна).
- **Type consistency:** `isRecipeCookedThisCycle(plan, recipe, sessions)` используется с одинаковой сигнатурой в Task 1 (тест) и Task 5 (`HomeScreen.jsx`). `clearPendingPhotos(studentId)` — одинаково в Task 3 (тест) и Task 5. `cookedTextIds` как `Set<string>` — одинаково в Task 4 (`CookPickerSheet`) и Task 5 (вычисление и проп).
