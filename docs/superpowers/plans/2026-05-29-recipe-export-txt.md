# Recipe Export TXT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить кнопку «Скачать» рядом с «Редактировать» в строке «Инструкция» экрана настроек рецепта, которая скачивает сырой `.txt` рецепта.

**Architecture:** Изменяется один файл — `InstructionParamsContent.jsx`. Добавляется функция `handleDownload`, использующая Blob + временный `<a>` для скачивания. Новых состояний, новых файлов, новых зависимостей нет.

**Tech Stack:** React (JSX), Browser File API (Blob, URL.createObjectURL)

---

### Task 1: Добавить кнопку «Скачать» в InstructionParamsContent.jsx

**Files:**
- Modify: `src/features/reading/InstructionParamsContent.jsx:87-99` (функция после `saveRecipeEdit`) и строка «Инструкция» в JSX (~192-199)

- [ ] **Step 1: Добавить функцию `handleDownload` после `saveRecipeEdit`**

Открой [src/features/reading/InstructionParamsContent.jsx](src/features/reading/InstructionParamsContent.jsx).

Найди функцию `saveRecipeEdit` (строки 87-91). Сразу после неё вставь:

```js
  function handleDownload() {
    const filename = textTitle ? `${textTitle}.txt` : "recipe.txt";
    const blob = new Blob([rawRecipe], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
```

- [ ] **Step 2: Добавить кнопку «Скачать» в JSX рядом с «Редактировать»**

Найди блок строки «Инструкция» (примерно строки 191-199):

```jsx
          <div className="param-row">
            <div className="param-label">Инструкция</div>
            <button
              className="link-btn"
              onClick={() => { setRecipeEdit(rawRecipe); setEditingRecipe(true); }}
            >
              Редактировать
            </button>
          </div>
```

Замени на:

```jsx
          <div className="param-row">
            <div className="param-label">Инструкция</div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="link-btn"
                onClick={() => { setRecipeEdit(rawRecipe); setEditingRecipe(true); }}
              >
                Редактировать
              </button>
              <button
                className="link-btn"
                onClick={handleDownload}
                disabled={!rawRecipe}
              >
                Скачать
              </button>
            </div>
          </div>
```

- [ ] **Step 3: Проверить в браузере**

Запусти dev-сервер:
```bash
npm run dev
```

Открой любой рецепт → настройки → убедись, что:
- Рядом с «Редактировать» появилась кнопка «Скачать»
- При клике скачивается `.txt`-файл с именем рецепта
- Содержимое файла совпадает с тем, что в редакторе

- [ ] **Step 4: Commit**

```bash
git add src/features/reading/InstructionParamsContent.jsx
git commit -m "feat(reading): add download button for recipe txt in params screen"
```
