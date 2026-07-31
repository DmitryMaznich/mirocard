---
name: new-deck
description: Use when the user wants to create a new Mirocard flashcard deck. Starts a focused dialog to collect deck requirements, generates a spec.json, runs the full generation pipeline, and builds the final ZIP.
---

# New Deck — Mirocard Deck Creation

## What this skill does

Guides deck creation through focused questions, generates a complete `spec.json`, runs the Cardgen Studio pipeline, and produces a ready-to-import ZIP file.

## HARD RULE

Ask questions ONE AT A TIME. Do not combine questions. Do not proceed to generation until all answers are collected.

## The Questions (ask in this exact order)

1. **Тема** — что за колода, что должен узнавать ребёнок?
2. **Список понятий** — предложи список концептов исходя из темы (рекомендация: 10–20), дождись согласования с пользователем
3. **Количество вариаций** — сколько вариаций на каждое понятие? (по умолчанию: 5, минимум: 3)
4. **Визуальный стиль мастер-карточки** — один из трёх:
   - `illustration` — мягкая иллюстрация для детей
   - `photo` — фотореалистичный снимок
   - `cartoon` — яркий мультяшный стиль
5. **Язык лейблов** — на каком языке подписи на карточках? Карточки всегда одноязычные (один язык). По умолчанию: русский (ru).
6. **Базовый вопрос** — фраза, которая звучит при показе карточки в режиме «Вопрос».
   Примеры: "Что чувствует?", "Что делает?", "Что это?", "Кто это?"
   Предложи сам исходя из темы, дождись подтверждения.
7. **Слово-ответ** — префикс ответной фразы, который звучит перед названием понятия.
   Примеры: "Чувствует", "Делает", "Это", "Здесь"
   Предложи сам исходя из базового вопроса, дождись подтверждения.

Итоговое количество карточек = понятия × вариации. Сообщи пользователю перед генерацией.

---

## Оси вариаций (применяются по умолчанию в этом порядке)

Каждое понятие генерируется в N вариациях по следующим осям:

| # | Название | Описание | Всегда |
|---|---|---|---|
| 1 | **Мастер** | Объект/действие на нейтральном фоне, максимальный фокус, реалистично или в выбранном стиле | ✅ |
| 2 | **Контекст** | Тот же объект/действие в реальной жизненной ситуации или среде | ✅ |
| 3 | **Иллюстрация** | Рисованный или мультяшный стиль — мост к книгам и AAC-символам | ✅ |
| 4 | **С персонажем** | Животное или ребёнок взаимодействует с объектом или совершает действие | ✅ |
| 5 | **Силуэт / схема** | Чистый силуэт или схематичное изображение — переход к абстракции | Если применимо |

Если пользователь выбрал 4 вариации — пропускаем вариацию 5.
Если силуэт неприменим к конкретному понятию — заменяем на дополнительный контекст.

---

## Что беру из ответов (НЕ выводить автоматически)

- `questionKey` — из ответа на вопрос 6, фраза целиком (например `"Что чувствует?"`)
- `answerPrefix` — из ответа на вопрос 7, слово-префикс (например `"Чувствует"`)

Эти поля пишутся в корень spec.json и используются при озвучке режима «Вопрос».

---

## Что я вывожу автоматически (НЕ спрашивать)

- `deckId` — slugify из темы (латиница, нижнее подчёркивание)
- `version` — всегда `"1.0.0"`
- `sourceLanguage` — из ответа на вопрос 6
- `totalCards` — понятия × вариации
- `defaults.style` — из стиля мастер-карточки (вопрос 5):
  - illustration → `"flat vector illustration style inspired by modern children's educational books, bright but soft pastel color palette with clean saturated accents, thick consistent outlines, simple geometric shapes, no photorealistic shading, warm and friendly aesthetic, no cast shadows, no texture, no gradients on background, subject viewed from a clear recognizable angle side or 3/4 view, consistent line weight across the entire deck"`
  - photo → `"high-quality photorealistic educational flashcard photo, natural soft lighting, sharp focus on subject, shallow depth of field with clean blurred background, true-to-life colors, no filters, no illustration effects, realistic proportions and textures, subject clearly and fully visible, professional educational photography style, consistent lighting and color temperature across the entire deck"`
  - cartoon → `"bright vivid cartoon illustration style, bold thick black outlines, highly saturated cheerful colors, simple expressive shapes, flat coloring with minimal shading, playful and energetic aesthetic, large clear features easy to recognize at a glance, no photorealism, no fine detail, subject viewed from a clear recognizable angle, consistent cartoon style across the entire deck"`
- `defaults.composition` — всегда: `"single centered subject, square 1:1 composition, clean light background, no text, no watermark, child-friendly, consistent style across the whole deck"`
- `card.subject` — **всегда на английском**, описание сцены для Gemini
- `card.prompt` — **всегда на английском**, полный промт = `style + ", " + subject + ", " + composition`
  - Для вариаций 3 (illustration) и 5 (silhouette) — стиль в промте перекрывается специфичным для оси
- `card.filename` — `{conceptId}_{variationIndex}.jpg`
- `card.answerKey` — равно `card.label[sourceLanguage]` (одинаково для всех вариаций одного понятия)
- `card.variationOf` — id концепта (например `apple`)
- `card.variationIndex` — номер вариации (1..N)
- `card.variationAxis` — название оси: `master` / `context` / `illustration` / `character` / `silhouette`
- `card.category` — из темы
- `card.tags` — из темы + тег оси (`variation_master`, `variation_context`, etc.)
- `card.semantic` — предлагаю схему группировок
- `modes` — массив полных объектов режимов (НЕ просто ID):
  - `cardType: "object"` (флешкарты) → использовать **Канонический набор флешкард-режимов** (см. раздел ниже). НЕ спрашивать у пользователя — заполнять автоматически.
  - `cardType: "procedural"` → режимы специфичны для колоды, прописываются вручную при генерации (см. раздел «Режимы процедурных колод»).

---

## Канонический набор флешкард-режимов

Для всех колод с `cardType: "object"` — копировать этот блок целиком в `modes[]` spec.json.

**Правило `question_answer`:** поля `ui.title` и `ui.instruction` заменить на значение `questionKey` из ответа пользователя (вопрос 6). Если `questionKey` не задан — режим `question_answer` не включать.

```json
[
  {
    "id": "intro",
    "type": "intro",
    "evaluation": "none",
    "ui": { "title": "Знакомство", "instruction": "Нажмите на карточку чтобы продолжить" },
    "methodology": {
      "text": "Пассивное знакомство с материалом. Ребёнок видит карточку и слышит название — без задания и оценки. Активирует пассивный словарь и снижает тревожность перед новой темой.",
      "tips": [
        "Называйте понятия вслух вместе с ребёнком",
        "Не торопите — пусть ребёнок рассматривает каждую карточку столько, сколько хочет",
        "Используйте в начале работы с новой темой или после перерыва"
      ],
      "duration": "2–4 минуты"
    }
  },
  {
    "id": "find_n",
    "type": "find_n",
    "evaluation": "auto",
    "ui": { "title": "Найди картинку", "instruction": "Нажми на нужную картинку" },
    "methodology": {
      "text": "Слово показывается вверху — ребёнок находит карточку среди 2, 4 или 6 вариантов. Чистое рецептивное задание: услышал слово — нашёл образ. Первый шаг от пассивного восприятия к активному ответу.",
      "tips": [
        "Начните с 2 вариантов — переходите к 4 и 6 по мере уверенности",
        "Убедитесь что дистракторы понятны ребёнку — иначе выбор неосознанный",
        "При ошибке назовите правильный вариант, не акцентируйте ошибку"
      ],
      "duration": "4–6 минут"
    },
    "params": {
      "optionCount":    { "type": "enum",   "label": { "ru": "Вариантов" },             "values": [2, 4, 6], "default": 4 },
      "repsPerConcept": { "type": "number", "label": { "ru": "Повторений на понятие" }, "default": 1, "min": 1, "max": 3 }
    }
  },
  {
    "id": "yes_no",
    "type": "yes_no",
    "evaluation": "auto",
    "ui": { "title": "Да / Нет", "instruction": "Правильное ли слово?" },
    "methodology": {
      "text": "Карточка показывается с подписью — иногда верной, иногда ложной. Ребёнок нажимает ДА или НЕТ. Требует уже сформированной связи слово↔образ: ребёнок не просто находит, а оценивает правильность.",
      "tips": [
        "Хвалите за ДА и за НЕТ одинаково — оба ответа равнозначны",
        "Если ребёнок часто нажимает ДА вслепую — сделайте паузу перед показом кнопок",
        "Используйте после «Найди картинку» — связь слово-образ уже должна быть сформирована"
      ],
      "duration": "3–5 минут"
    },
    "params": {
      "repsPerConcept": { "type": "number", "label": { "ru": "Повторений на понятие" }, "default": 1, "min": 1, "max": 5 }
    }
  },
  {
    "id": "choose_word_by_picture",
    "type": "choose_word_by_picture",
    "evaluation": "auto",
    "ui": { "title": "Выбери слово", "instruction": "Нажми на правильное слово" },
    "methodology": {
      "text": "Карточка показывается — ребёнок выбирает правильное слово из четырёх. Тренирует связь образа со словом в направлении образ→слово, готовит к чтению и называнию.",
      "tips": [
        "Следите: некоторые дети угадывают по длине слова, не читая",
        "Для неграмотных детей этот режим может быть преждевременным",
        "Переходите после уверенного прохождения «Найди картинку» и «Да / Нет»"
      ],
      "duration": "4–6 минут"
    },
    "params": {
      "repsPerConcept": { "type": "number", "label": { "ru": "Повторений на понятие" }, "default": 1, "min": 1, "max": 3 },
      "concepts":       { "type": "concept_selector" }
    }
  },
  {
    "id": "choose_all",
    "type": "choose_all",
    "evaluation": "auto",
    "ui": { "title": "Выбери все", "instruction": "Найди все подходящие карточки" },
    "methodology": {
      "text": "Называется целевая категория — ребёнок нажимает все подходящие карточки в сетке. Тренирует обобщение и категориальное мышление.",
      "tips": [
        "Перед началом убедитесь что ребёнок понимает задание — покажите пример",
        "Хвалите за каждое верное нажатие, а не только за итоговый результат",
        "Используйте после освоения режимов выбора"
      ],
      "duration": "5–8 минут"
    },
    "params": {
      "optionCount": { "type": "enum", "label": { "ru": "Карточек в сетке" }, "values": [2, 4, 6, 9], "default": 4 }
    }
  },
  {
    "id": "question_answer",
    "type": "question_answer",
    "evaluation": "none",
    "ui": { "title": "{{questionKey}}", "instruction": "{{questionKey}}" },
    "methodology": {
      "text": "Специалист задаёт вопрос к карточке — ребёнок отвечает устно. Оценка выставляется вручную. Самый сложный режим: требует активного называния без подсказок. Завершает педагогическую лестницу.",
      "tips": [
        "Задавайте вопрос всегда одинаково — это создаёт предсказуемость",
        "Подсказывайте первый звук если ребёнок молчит более 5 секунд",
        "Принимайте приближённые ответы — важно движение к слову"
      ],
      "duration": "5–7 минут"
    }
  }
]
```

**Иконки для флешкард-режимов** — добавить в `modeIconPrompts` spec.json:

```json
"modeIconPrompts": {
  "intro":                  "a single large educational flashcard displayed centered on white background, simple flat icon style, child-friendly, square 1:1 composition, no text",
  "question_answer":        "a speech bubble with a question mark above a flashcard, simple flat icon style, child-friendly, square 1:1 composition, no text",
  "yes_no":                 "two round buttons, one green YES and one red NO, side by side on white background, simple flat icon, child-friendly, square 1:1 composition",
  "find_n":                 "a word label at the top with a 2x2 grid of small flashcards below, one card highlighted with a glow, flat educational icon style, child-friendly, square 1:1 composition",
  "choose_word_by_picture": "a large flashcard image with four word options below it, one option highlighted, flat educational icon, child-friendly, square 1:1 composition",
  "choose_all":             "a 3x3 grid of small cards with three cards marked with a checkmark, flat educational icon, child-friendly, square 1:1 composition"
}
```

---

## Режимы процедурных колод

Для `cardType: "procedural"` режимы прописываются вручную при каждой генерации — каждая такая колода уникальна.

Каждый режим должен содержать:

```json
{
  "id": "уникальный_id",
  "type": "уникальный_id",
  "evaluation": "auto",
  "ui": {
    "title": "Название для пользователя",
    "instruction": "Что делать ребёнку"
  },
  "methodology": {
    "text": "Описание для педагога — что тренирует режим",
    "tips": ["Совет 1", "Совет 2"],
    "duration": "X–Y минут"
  }
}
```

`modeIconPrompts` для каждого режима формируется описанием того, как выглядит режим визуально, например:

```json
"modeIconPrompts": {
  "compare_visual": "two groups of colorful dots side by side, left group has more dots than right, flat educational icon, child-friendly, white background, square 1:1 composition",
  "compare_numbers": "two large numbers side by side with an arrow pointing to the bigger one, flat icon style, child-friendly, white background, square 1:1 composition"
}
```

---

## Правила генерации промтов по осям

Для каждого концепта `subject` (базовое описание на EN) строится так:

| Ось | subject | style override |
|---|---|---|
| master | `"[object], isolated, plain white or softly blurred background, maximum focus on subject"` | стиль из вопроса 5 |
| context | `"[object] in a real-life everyday situation, natural environment, child-friendly scene"` | стиль из вопроса 5 |
| illustration | `"[object], hand-drawn children's book illustration style"` | `"soft watercolor children's book illustration, gentle outlines, warm pastel colors, simple and clear"` |
| character | `"a friendly cartoon animal or child [using/holding/doing action with] [object], playful scene"` | стиль из вопроса 5 |
| silhouette | `"clean black silhouette of [object] on white background, simple recognizable shape, no details"` | `"flat black silhouette icon, minimal, clean white background, no gradients, no texture"` |

`prompt` = `style + ", " + subject + ", " + composition`

---

## Структура карточки с вариациями

```json
{
  "id": "apple_1",
  "variationOf": "apple",
  "variationIndex": 1,
  "variationAxis": "master",
  "label": { "ru": "яблоко" },
  "subject": "a red apple, isolated, plain white background, maximum focus on subject",
  "prompt": "high-quality photorealistic educational flashcard photo, ..., a red apple, isolated, plain white background, maximum focus on subject, single centered subject, square 1:1 composition, clean light background, no text, no watermark, child-friendly, consistent style across the whole deck",
  "filename": "apple_1.jpg",
  "category": "food",
  "tags": ["food", "fruit", "variation_master"],
  "answerKey": "яблоко",
  "semantic": {
    "group1": "food",
    "group2": "fruit",
    "group3": "natural"
  },
  "notes": ""
}
```

---

## Output format (spec.json)

```json
{
  "deckId": "fruits_basic",
  "sourceLanguage": "ru",
  "version": "1.0.0",
  "title": { "ru": "Фрукты" },
  "annotation": { "ru": "Карточки фруктов с 5 вариациями каждого понятия для развития генерализации." },
  "about": {
    "text": "Краткое описание темы для педагога — что ребёнок изучает, на каком этапе применять.",
    "tips": ["Рекомендация 1", "Рекомендация 2"]
  },
  "questionKey": "Что это?",
  "answerPrefix": "Это",
  "modes": [
    "... скопировать ПОЛНОСТЬЮ из раздела «Канонический набор флешкард-режимов» ...",
    "... заменить {{questionKey}} на реальное значение questionKey во всех вхождениях ..."
  ],
  "variationAxes": ["master", "context", "illustration", "character", "silhouette"],
  "variationsPerConcept": 5,
  "conceptCount": 6,
  "semanticSchema": {
    "group1": "category",
    "group2": "type",
    "group3": "origin"
  },
  "defaults": {
    "style": "...",
    "composition": "single centered subject, square 1:1 composition, clean light background, no text, no watermark, child-friendly, consistent style across the whole deck"
  },
  "avatarPrompt": "a colorful educational icon representing [topic theme], clean white background, single centered subject, square 1:1 composition, child-friendly illustration style, bold and recognizable at small size, no text, no watermark",
  "modeIconPrompts": {
    "... скопировать из раздела «Канонический набор флешкард-режимов» ..."
  },
  "cards": [
    {
      "id": "apple_1",
      "variationOf": "apple",
      "variationIndex": 1,
      "variationAxis": "master",
      "label": { "ru": "яблоко" },
      "subject": "a red apple, isolated, plain white background, maximum focus on subject",
      "prompt": "...",
      "filename": "apple_1.jpg",
      "category": "food",
      "tags": ["food", "fruit", "variation_master"],
      "answerKey": "яблоко",
      "semantic": { "group1": "food", "group2": "fruit", "group3": "natural" },
      "notes": ""
    }
  ]
}
```

---

## Pipeline execution

> **Note:** This pipeline depends on the `cardgen-studio` tooling, which lives in a
> separate project (`c:/Users/dmazn/Projects/Mirocard/cardgen-studio`), not in this
> repository. When running from a cloud/remote checkout of Mirocard2, only that
> project is unavailable — Steps 1–8 below cannot run there. Use this skill in that
> context for the questions/spec-generation part, and run the pipeline steps from a
> local session that has access to `Mirocard/cardgen-studio`.

After generating the spec, execute these steps IN ORDER using Bash tool:

### Step 1: Write spec to inbox

Write the generated JSON to:
`c:/Users/dmazn/Projects/Mirocard/cardgen-studio/inbox/<deckId>.json`

### Step 2: Import

```bash
cd c:/Users/dmazn/Projects/Mirocard
node cardgen-studio/scripts/cardgen-cli.mjs import-latest
```

### Step 3: Render all cards

```bash
node cardgen-studio/scripts/cardgen-cli.mjs render <deckId>
```

This renders ALL cards in one pass (no queue step needed).
Wait for completion. Report: how many cards rendered, any errors.

### Step 4: Review — launch HTML browser

```bash
node cardgen-studio/scripts/cardgen-cli.mjs review <deckId>
```

Tell the user:
> "Открой http://localhost:4567 — кликни на плохие карточки, нажми «Переделать отмеченные». Когда закроешь браузер — скажи мне."

Wait for the user to confirm they are done with review. Do NOT proceed until they say so.

### Step 5: Critique Loop (repeat until user approves all)

After the review server closes, read `cards.json` and find **rejected cards** — those where `status === "pending"` AND `image` is not null (they had a generated image but were reset).

```bash
# read cards.json
node -e "
const d = JSON.parse(require('fs').readFileSync('cardgen-studio/projects/<deckId>/cards.json','utf8'));
const rejected = d.cards.filter(c => c.status === 'pending' && c.image);
console.log(JSON.stringify(rejected.map(c => ({id:c.id, label:c.label, axis:c.variationAxis, notes:c.notes})), null, 2));
"
```

**If no rejected cards** → proceed to Step 6 (build ZIP).

**If there are rejected cards:**

For EACH rejected card, ask ONE question (HARD RULE — one at a time):
> "Что не так с **[label]** (ось **[axis]**)?"
> Текущий промт: `[первые 120 символов промта]`

Wait for the user's answer. Examples of answers:
- "лицо не видно, слишком тёмный фон"
- "не похоже на ребёнка, выглядит взросло"
- "действие непонятно, покажи крупнее"

After collecting feedback for ALL rejected cards:

1. **Save notes** — write the user's answer into `card.notes` in `cards.json`
2. **Update prompt** — append a negative constraint based on the critique:
   - "тёмный фон" → add `", bright white background, no dark shadows"`
   - "не похоже на ребёнка" → add `", clearly a young child, child proportions"`
   - "действие непонятно" → add `", action clearly visible, dynamic pose, full body shown"`
   - Generic: add the critique as `", NOT: [issue]"` at the end of the prompt
3. **Re-render rejected cards only:**

```bash
node cardgen-studio/scripts/cardgen-cli.mjs render <deckId>
```

(Only pending cards are rendered — already-done cards are skipped automatically.)

4. **Return to Step 4** — open review again for the re-rendered cards.

Repeat this loop until the user confirms everything is OK.

### Step 6: Generate Audio

```bash
node cardgen-studio/scripts/cardgen-cli.mjs audio <deckId>
```

This generates `audio/<conceptId>.mp3` for each concept (one file per concept, shared across all variations).

После этого — если в колоде заданы `questionKey` и `answerPrefix` — генерируем фразовые файлы:

```bash
node cardgen-studio/scripts/generate-audio.mjs <deckId> --extra-phrases
```

Создаёт:
- `audio/question.mp3` — фраза `questionKey` (например «Что чувствует?»)
- `audio/answer_<conceptId>.mp3` — фраза `answerPrefix + " " + label` (например «Чувствует радость»)

Report: how many audio files generated, any errors.

### Step 7: Generate Icons

```bash
node cardgen-studio/scripts/cardgen-cli.mjs generate-icons <deckId>
```

This generates:
- `generated/__avatar.webp` — topic avatar (shown in topic library)
- `generated/icons/<modeId>.webp` — one icon per mode (shown in mode picker)

Prompts come from `avatarPrompt` and `modeIconPrompts` in `cards.json`.

Icons are idempotent — already-generated files are skipped. To regenerate, delete the file and re-run.

Report: how many icons generated, any errors.

### Step 8: Build ZIP

```bash
node cardgen-studio/scripts/cardgen-cli.mjs build <deckId>
```

The build script automatically includes any generated icons in the ZIP and sets:
- `meta.avatar = "media/avatar.webp"` if `__avatar.webp` exists
- `mode.ui.icon = "media/icons/<modeId>.webp"` for each mode that has an icon

Report the ZIP path: `cardgen-studio/projects/<deckId>/build/<deckId>_v1.0.0.zip`

---

## Error handling

- If render fails for some cards: report which cards failed, ask if user wants to re-render or skip
- If build fails: read the error message and report what's missing
- If silhouette axis doesn't make sense for a concept (e.g. abstract actions): replace with an additional context variation and note it
- If the review server port 4567 is already in use: tell the user to close the previous review window first