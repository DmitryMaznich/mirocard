# Предупреждение о несоответствии приёма пищи в RecipePicker — design

## Context

`RecipePicker` (`src/features/planner/PlannerMenuScreen.jsx:201-258`) открывается из конкретного слота Меню (`targetMealType`, например «завтрак») и показывает вкладки-фильтры по всем `RECIPE_TAGS` (`завтрак, обед, ужин, перекус, напитки`) для удобства просмотра каталога. Проблема: вкладки — это только фильтр отображения. Выбор рецепта (`onToggleSelect={() => onToggleSelect(recipe, targetMealType)}`, строка 250) всегда назначает рецепт на `targetMealType`, независимо от того, какая вкладка сейчас активна. Если открыть пикер для «завтрак», переключиться на вкладку «обед» и выбрать оттуда суп — суп молча добавится на завтрак, без единого сигнала.

Тот же путь молчаливого назначения используется и при переносе уже выбранного в другом приёме рецепта: `handleToggleSelect` (`PlannerMenuScreen.jsx:534-548`) реассайнит (не снимает) рецепт, если он выбран для *другого* приёма пищи (строки 535-539) — это тоже проходит без вопросов.

Родитель/логопед подтвердил: полностью запрещать несоответствие не нужно (гибкость уже заложена в теги — многие рецепты годятся на несколько приёмов), но полностью тихое несоответствие тоже не годится — стоит спрашивать подтверждение. Отдельно обсудили тег «напитки»: это ярлык для навигации по каталогу, не показатель принадлежности к приёму пищи (все 5 текущих рецептов-напитков дополнительно несут завтрак/перекус, но ни один — обед/ужин) — рецепты с этим тегом из проверки исключаются полностью.

## Scope

В рамках:
- Проверка при любом действии, которое ЗАВЕРШАЕТСЯ назначением рецепта на `targetMealType` (первичный выбор с порциями, первичный выбор с фиксированными порциями, перенос с другого приёма) — если `recipe.tags` не содержит `targetMealType` и не содержит `напитки`.
- Модальное подтверждение (Да/Нет) в стиле уже существующих sheet-компонентов (`PortionsPromptSheet`/`CookPickerSheet`), с текстом, перечисляющим приёмы пищи, для которых рецепт реально помечен.
- Снятие выбора (клик по уже стоящему в этом же приёме рецепту) — без проверки, как и сейчас.

Вне рамок:
- Изменение самой модели тегов или списка `RECIPE_TAGS`.
- Проверка при просмотре/готовке рецепта вне Меню (например, прямой переход в занятие) — это касается только назначения в Меню.
- Запоминание «не спрашивать больше» — предупреждение показывается каждый раз, когда есть несоответствие.

## Design

### Чистая функция проверки (`plannerUtils.js`)

```js
// "напитки" is a browsing-only catalog tag (see RECIPE_TAGS), not a meal-type
// indicator — a drink recipe is never flagged as mismatched for any slot.
export function needsMealMismatchWarning(recipe, mealType) {
  if (recipe.tags.includes('напитки')) return false;
  return !recipe.tags.includes(mealType);
}
```

### `handleToggleSelect` — гейт перед назначением, не внутри него

Текущая функция (`PlannerMenuScreen.jsx:534-548`) переименовывается в `applyToggleSelect` без изменения тела. `handleToggleSelect` становится тонкой обёрткой:

```js
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

`isDeselecting` — единственный случай, который не должен спрашивать: клик по рецепту, уже стоящему именно в этом слоте (снятие). Перенос с другого приёма (строки 536-539 внутри `applyToggleSelect`) — это НЕ `isDeselecting` (assignment ≠ mealType), поэтому проходит через проверку как обычное назначение.

Новое состояние в основном компоненте (рядом с `portionsPrompt`):
```js
const [mismatchConfirm, setMismatchConfirm] = useState(null); // { recipe, mealType } | null
```

### UI подтверждения

Новый компонент, использующий уже существующие sheet-классы (`portions-sheet-backdrop`/`portions-sheet`/`portions-sheet__handle`/`portions-sheet__title` — те же, что `PortionsPromptSheet`/`CookPickerSheet`) и уже существующие кнопки подтверждения (`menu-reset-bar__cancel`/`menu-reset-bar__ok`, которые остаются в `planner.css` после переезда «Начать новое меню» на хаб):

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

Рендерится как ещё один sibling рядом с `{portionsPrompt && <PortionsPromptSheet .../>}` в финальном `return` компонента (`PlannerMenuScreen.jsx:614-625`):
```jsx
{mismatchConfirm && (
  <MealMismatchConfirm
    recipe={mismatchConfirm.recipe}
    mealType={mismatchConfirm.mealType}
    onConfirm={confirmMealMismatch}
    onCancel={() => setMismatchConfirm(null)}
  />
)}
```
«Нет» просто закрывает подтверждение — рецепт не выбирается/не переносится, пикер остаётся открытым для другого выбора.

Две новые CSS-подсказки (`.meal-mismatch-text`, `.meal-mismatch-actions`) — простые: абзац текста + ряд из двух кнопок, без нового визуального языка.

### Пример конкретного случая

Рецепт `chicken.txt` (`tags: обед, ужин`), пикер открыт для «завтрак», выбрана вкладка «Обед» для просмотра, тап по курице:
`needsMealMismatchWarning` → `recipe.tags.includes('напитки')` false → `!recipe.tags.includes('завтрак')` true → предупреждение. Текст: «Этот рецепт обычно готовят на обед или ужин. Всё равно добавить на завтрак?»

Рецепт `cocoa.txt` (`tags: напитки, завтрак, перекус`), пикер открыт для «обед»: `recipe.tags.includes('напитки')` true → предупреждение не показывается, какао добавляется на обед без вопросов.

## Testing

- Юнит-тесты (`plannerUtils.test.js`): `needsMealMismatchWarning` — true когда тег отсутствует, false когда тег есть, false для рецепта с тегом «напитки» независимо от остальных тегов, false даже если совпадающего тега нет вовсе (напитки исключаются раньше проверки).
- Ручная проверка в браузере: открыть пикер для «завтрак», выбрать рецепт с `tags: обед, ужин` через вкладку «Обед» — подтверждение с верным текстом; «Нет» — рецепт не добавлен, пикер открыт; «Да» — рецепт добавлен на завтрак. Отдельно — перенос уже выбранного на «обед» рецепта в слот «завтрак» тем же путём. Отдельно — рецепт с тегом «напитки» добавляется в любой слот без подтверждения.
