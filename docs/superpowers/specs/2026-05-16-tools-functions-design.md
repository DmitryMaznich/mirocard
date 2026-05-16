# Design: tools_functions — Режим «Функция инструмента»

**Дата:** 2026-05-16  
**Статус:** Approved  

---

## Контекст

Существующая тема `tools_basic` содержит 12 изолированных карточек инструментов (молоток, дрель, пила и т.д.) с режимами «назови» и «найди». Ребёнок может выучить названия, но не понимает, для чего нужен каждый инструмент. Это неполное усвоение темы с точки зрения логопедии.

Решение: новый универсальный рендерер `function_cards` с двумя режимами — **B** (инструмент → действие) и **D** (сцена «до/после» → выбери инструмент).

---

## Архитектура

### Новые файлы в проекте

```
src/topics/renderers/function_cards/
  engine.js        — генерация задач (choose_action + scene_function)
  index.jsx        — React-компонент для рендеринга обоих режимов

scripts/
  generate-tools-functions.mjs   — сборка ZIP с генерацией изображений

public/decks/
  tools_functions_v1.0.0.zip    — итоговый ZIP
```

**Обновляемые файлы:**
- `src/topics/renderers/engineRegistry.js` — регистрация нового рендерера
- `public/decks/catalog.json` — новая запись `tools_functions`

### Формат deck.json

```json
{
  "meta": {
    "id": "tools_functions",
    "version": "1.0.0",
    "renderer": "function_cards",
    "title": { "ru": "Инструменты — для чего нужны" }
  },
  "concepts": [
    {
      "id": "hammer",
      "label": "Молоток",
      "labelInstrumental": "молотком",
      "action": "забивают гвозди",
      "object": "гвоздь",
      "cards": [
        { "id": "hammer_tool",         "image": "media/hammer_tool.webp",         "type": "tool" },
        { "id": "hammer_scene_before", "image": "media/hammer_scene_before.webp", "type": "scene_before" },
        { "id": "hammer_scene_after",  "image": "media/hammer_scene_after.webp",  "type": "scene_after" }
      ]
    }
  ]
}
```

Отдельный `topic.json` не нужен — ZIP-деки хранят всё в `deck.json`. Поле `modes` добавляется туда же (как в `tools_basic`).

---

## Режим B — choose_action

**Логика:**
- Показывается изображение `type: "tool"` текущего концепта
- Вопрос: `"Что делают [labelInstrumental]?"`  (произносится вслух)
- 4 варианта ответа — текстовые метки `action` из случайной выборки концептов; правильный ответ — `action` текущего концепта
- После правильного выбора: вариант подсвечивается зелёным, озвучивается фраза `"[Label] [action]!"`
- После ошибки: вариант подсвечивается красным, попытка сохраняется

**Генерация задач (engine.js):**
```js
// Для каждого концепта — одна задача
// Дистракторы: 3 случайных action из остальных концептов
// Порядок опций перемешивается
```

**Изображения:** используются карточки `type: "tool"` — новые фото инструментов в том же стиле, что `tools_basic` (фотореализм, белый фон, square 1:1, `gemini-3.1-flash-image-preview`)

---

## Режим D — scene_function

**Логика:**
- Показывается изображение `type: "scene_before"` (сцена-задача)
- Картинка `type: "scene_after"` показывается рядом, размытая (blur)
- Вопрос: `"Какой инструмент нужен?"`
- 4 варианта — изображения `type: "tool"` (2×2 грид), 1 правильный + 3 дистрактора
- После правильного выбора: картинка «после» открывается (убирается blur), озвучивается фраза `"[Label] [action]!"`

**Генерация задач (engine.js):**
```js
// Для каждого концепта — одна задача
// Дистракторы: 3 случайных tool-изображения из оставшихся концептов
// Порядок 4 вариантов перемешивается
```

**Требования к изображениям сцен:**
- Стиль: photorealistic educational scene, natural soft lighting, clean background, no text, child-friendly — **идентично** стилю `tools_basic`
- Модель: `gemini-3.1-flash-image-preview`, aspect ratio 4:3 (сцена шире, чем квадрат)
- `scene_before`: объект(ы) крупным планом, задача очевидна визуально
- `scene_after`: тот же объект после применения инструмента, результат очевиден

---

## Данные — 12 инструментов

| id | label | labelInstrumental | action | object | Сцена до | Сцена после |
|----|-------|-------------------|--------|--------|----------|-------------|
| hammer | Молоток | молотком | забивают гвозди | гвоздь | гвоздь лежит рядом с доской | гвоздь забит в доску |
| screwdriver | Отвёртка | отвёрткой | закручивают шурупы | шуруп | шуруп рядом с деревянной доской | шуруп закручен в доску |
| drill | Дрель | дрелью | сверлят отверстия | отверстие | деревянная доска без отверстия | доска с просверленным отверстием |
| handsaw | Пила | пилой | пилят доску | доска | целая деревянная доска | доска разрезана на две части |
| wrench | Гаечный ключ | гаечным ключом | закручивают гайки | гайка | болт с незакрученной гайкой | гайка закручена на болте |
| pliers | Пассатижи | пассатижами | сгибают проволоку | проволока | прямая проволока | проволока согнута в форму |
| wire_cutters | Кусачки | кусачками | режут проволоку | проволока | длинная проволока | проволока обрезана |
| tape_measure | Рулетка | рулеткой | измеряют длину | доска | доска без разметки | доска с отметкой длины |
| paintbrush | Кисточка | кисточкой | красят поверхность | краска | серая стена без краски | стена окрашена |
| spatula | Шпатель | шпателем | наносят шпаклёвку | шпаклёвка | стена с трещиной | стена ровно зашпаклёвана |
| drill_bit | Сверло | сверлом | сверлят дерево | дерево | деревянный брус без отверстия | брус с просверленным отверстием |
| ruler | Линейка | линейкой | чертят ровные линии | линия | чистый лист бумаги | лист с ровной линией |

---

## Промпты для изображений

### Tool images (36 вариантов = 3 на инструмент)
```
high-quality photorealistic educational flashcard photo, natural soft lighting, 
sharp focus on subject, shallow depth of field with clean blurred background, 
true-to-life colors, no filters, realistic proportions and textures, 
professional educational photography style, child-friendly, 
consistent style across the whole deck,
a [tool_name], isolated, plain white background, square 1:1 composition, 
no text, no watermark
```

### Scene images (12×2 = 24 сцены)
```
high-quality photorealistic educational scene photo, natural soft lighting, 
sharp focus, true-to-life colors, no filters, professional educational photography style, 
child-friendly, clean light background,
[scene_description], no text, no watermark, 4:3 composition
```

---

## Скрипт генерации (generate-tools-functions.mjs)

Аналогичен `generate-comparison.mjs`. Шаги:
1. Определить концепты из таблицы выше (hardcoded)
2. Сгенерировать tool images (3 вариации на инструмент = 36 изображений)
3. Сгенерировать scene_before + scene_after (12×2 = 24 изображения)
4. Сгенерировать аудио для всех `action`-фраз (12 фраз × 2 формата)
5. Собрать `deck.json` (включает meta + modes + concepts)
6. Упаковать в ZIP → `public/decks/tools_functions_v1.0.0.zip`
7. Обновить `public/decks/catalog.json`

**Итого изображений:** 36 tool + 24 scene = **60 изображений**

---

## Регистрация рендерера

В `engineRegistry.js` добавить:
```js
import functionCardsEngine from './function_cards/engine.js';
// ...
function_cards: functionCardsEngine,
```

---

## Объём работ

| Компонент | Размер |
|-----------|--------|
| `engine.js` | ~80 строк |
| `index.jsx` | ~150 строк |
| `generate-tools-functions.mjs` | ~200 строк |
| Изображений | 60 |
| Аудио | 24 файла: 12 вопросов «Что делают [X]?» + 12 ответов «[Label] [action]!» |

Всё в рамках одного PR.
