---
name: recipe-step-illustration
description: Тег [file.webp] в рецепте прикрепляет изображение к предыдущему шагу как иллюстрацию, а не создаёт отдельный шаг навигации
metadata:
  type: project
---

# Иллюстрация к шагу рецепта

## Контекст

В рецептах используется синтаксис `[file.webp]` для изображений. Сейчас `parseRecipeTxt` создаёт из этого тега **отдельный шаг** типа `image`, пользователь должен перелистнуть до него как до обычного шага.

Нужно: тег `[file.webp]` должен прикреплять изображение к **предыдущему шагу** как иллюстрацию, показываемую рядом с текстом шага.

Пример — lemonade.txt:
```
Лимонад           ← heading шаг
[lemonade.webp]   ← прикрепляется к шагу "Лимонад" как step.image
1. Вымыть руки... ← следующий шаг, без изображения
```

## Парсер — `parseRecipeTxt.js`

**Текущее поведение:** при `[file.webp]` → `flush()` (сохранить текущий шаг) + создать `{ type: "image", file }`.

**Новое поведение:**
- Если `current` существует → `current.image = imgMatch[1]`, **без** flush, **без** нового шага.
- Если `current === null` (тег стоит до любого шага) → оставить старое поведение: flush + standalone image step (edge-case fallback).

Результат: шаг получает поле `image`:
```js
{ id: "h1", type: "heading", text: "Лимонад", image: "lemonade.webp" }
```

## Рендерер — `InstructionTask` в `index.jsx`

### 1. Загрузка URL изображения

Было:
```js
const imageUrl = useTopicFile(topicId, step?.type === "image" ? `media/${step.file}` : null);
```

Стало:
```js
const imageUrl = useTopicFile(topicId, step?.image ? `media/${step.image}` : null);
```

Шаги типа `image` (старый формат, может присутствовать в IndexedDB) по-прежнему рендерятся как раньше — backward compat сохраняется.

### 2. Отображение иллюстрации

В JSX блока шага, после текста и до чеклиста/буллетов:
```jsx
{step.image && imageUrl && (
  <img src={imageUrl} alt="" className="instruction-step-illustration" />
)}
```

## Стили — `styles.css`

Новый класс `.instruction-step-illustration`:
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

Не fullscreen, компактно, центрировано.

## Файлы для изменения

1. `src/topics/renderers/reading/parseRecipeTxt.js` — логика парсера (блок imgMatch)
2. `src/topics/renderers/reading/index.jsx` — imageUrl + JSX иллюстрации
3. `src/styles.css` — класс `.instruction-step-illustration`
