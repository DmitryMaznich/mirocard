# Recipe Step Illustration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Тег `[file.webp]` в рецепте прикрепляет изображение к предыдущему шагу как `step.image`, вместо создания отдельного шага навигации.

**Architecture:** Изменяется парсер (`parseRecipeTxt.js`) — `[file.webp]` теперь мутирует `current.image` вместо создания нового шага. Рендерер `InstructionTask` (`index.jsx`) загружает `step.image` и показывает иллюстрацию после текста шага. Добавляется CSS-класс в `styles.css`.

**Tech Stack:** JavaScript (ES modules), React JSX, CSS

---

### Task 1: Изменить парсер — прикреплять изображение к предыдущему шагу

**Files:**
- Modify: `src/topics/renderers/reading/parseRecipeTxt.js:27-33`

- [ ] **Step 1: Заменить блок обработки imgMatch**

Найди в `parseRecipeTxt.js` блок (строки 27–33):

```js
    const imgMatch = line.match(/^\[([^\]]+\.\w+)\]$/);
    if (imgMatch) {
      flush();
      stepNum++;
      current = { id: `s${stepNum}`, type: "image", file: imgMatch[1] };
      continue;
    }
```

Замени на:

```js
    const imgMatch = line.match(/^\[([^\]]+\.\w+)\]$/);
    if (imgMatch) {
      if (current) {
        current.image = imgMatch[1];
      } else {
        flush();
        stepNum++;
        current = { id: `s${stepNum}`, type: "image", file: imgMatch[1] };
      }
      continue;
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/reading/parseRecipeTxt.js
git commit -m "feat(reading): attach [file.webp] tag as step.image instead of standalone step"
```

---

### Task 2: Изменить рендерер — показывать иллюстрацию рядом с шагом

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx:373` (строка `const imageUrl`)
- Modify: `src/topics/renderers/reading/index.jsx:488-504` (блок рендера шага)

- [ ] **Step 1: Изменить загрузку imageUrl**

Найди в `InstructionTask` (в `index.jsx`):

```js
  const imageUrl = useTopicFile(topicId, step?.type === "image" ? `media/${step.file}` : null);
```

Замени на:

```js
  const imageUrl = useTopicFile(
    topicId,
    step?.image ? `media/${step.image}` :
    step?.type === "image" ? `media/${step.file}` :
    null
  );
```

Так старые шаги `type: "image"` (из IndexedDB, используют `step.file`) продолжают загружать картинку.

- [ ] **Step 2: Добавить иллюстрацию в JSX шага**

Найди в JSX `InstructionTask` блок рендера текста шага (внутри `<div className="instruction-step">`):

```jsx
            {step.type === "checklist" && (
              <ul className="instruction-checklist">
```

Вставь ДО этого блока:

```jsx
            {step.image && imageUrl && (
              <img src={imageUrl} alt="" className="instruction-step-illustration" />
            )}
```

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/reading/index.jsx
git commit -m "feat(reading): show step.image as illustration below step text"
```

---

### Task 3: Добавить CSS-класс для иллюстрации

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Добавить стиль**

В конец блока стилей `InstructionTask` (ищи `.instruction-step-img` или `.instruction-checklist`) добавь:

```css
.instruction-step-illustration {
  display: block;
  max-width: 100%;
  max-height: 220px;
  object-fit: contain;
  border-radius: 12px;
  margin: 12px auto 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "style(reading): add instruction-step-illustration class"
```

---

### Task 4: Проверить и задеплоить

- [ ] **Step 1: Запустить dev-сервер**

```bash
npm run dev
```

- [ ] **Step 2: Открыть рецепт Лимонад и проверить**

- Открыть тему «Инструкции - рецепты» → Лимонад → Начать занятие
- Первый шаг — «Лимонад» (heading): должна отображаться картинка `lemonade.webp` под заголовком
- Второй шаг — «Вымыть руки...»: картинки нет
- Счётчик шагов корректный (нет лишнего image-шага)

- [ ] **Step 3: Задеплоить**

```bash
npm run deploy:prod
npm run deploy:verify
```
