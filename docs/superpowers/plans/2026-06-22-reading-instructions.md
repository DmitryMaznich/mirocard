# Reading Instructions Topic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить тему «Чтение. Инструкции» — пул из 47 предложений-инструкций, каждый день случайно выбирается 10 по детерминированному seed от даты.

**Architecture:** Новый `kind: "sentence_pool"` в данных, новый `case "daily_sentences"` в `engine.js` возвращает стандартный `read_text` task с 10 строками. Рендерер `ReadTextTask` (layout `line`) уже работает без изменений.

**Tech Stack:** JavaScript ES modules, Vitest, JSZip (уже в зависимостях)

## Global Constraints

- Рендерер: `reading` (существующий, не менять)
- `index.jsx` не трогать — `ReadTextTask` с `layout: "line"` уже обрабатывает тип `read_text`
- `engineRegistry.js` не трогать — `reading` уже зарегистрирован
- `ModePickerScreen.jsx` не трогать — `filterReadingModes` пропускает неизвестные mode.id без изменений
- Тест-раннер: Vitest, команда: `npx vitest run <path>`
- Генератор запускается как: `node scripts/generate-reading-instructions.mjs`
- ZIP кладётся в `public/decks/reading_dad_instructions_v1.0.0.zip`
- Одна pre-existing ошибка в `engine.test.js` (assemble_text test ожидает 1, получает 2) — не трогать, она была до нас

---

## File Map

| Файл | Действие |
|---|---|
| `src/topics/renderers/reading/engine.js` | Modify: добавить `seededShuffle`, `buildDailySentencesTasks`, `case "daily_sentences"`, переименовать `_sessionParams` → `sessionParams` |
| `src/topics/renderers/reading/engine.test.js` | Modify: добавить describe-блок `daily_sentences mode` (6 тестов) |
| `scripts/generate-reading-instructions.mjs` | Create: генератор ZIP |
| `public/decks/reading_dad_instructions_v1.0.0.zip` | Output: результат запуска генератора |

---

## Task 1: Engine — daily_sentences mode (TDD)

**Files:**
- Modify: `src/topics/renderers/reading/engine.test.js`
- Modify: `src/topics/renderers/reading/engine.js`

**Interfaces:**
- Consumes: `generateTasks(mode, topicRecord, textId, sessionParams)` из `engine.js`
- Produces: `generateTasks({ type: "daily_sentences" }, topic, "pool", { today: "YYYY-MM-DD" })` → `[{ type: "read_text", textId, text: { ...poolText, lines: [10 items] } }]`

- [ ] **Step 1: Написать failing тесты**

Добавить в конец `src/topics/renderers/reading/engine.test.js`:

```js
describe("daily_sentences mode", () => {
  const POOL_TOPIC = {
    meta: { id: "reading_test", renderer: "reading" },
    texts: [
      {
        id: "pool",
        kind: "sentence_pool",
        dailySize: 10,
        lines: Array.from({ length: 20 }, (_, i) => ({
          id: `s${i + 1}`,
          text: `Инструкция ${i + 1}.`,
        })),
      },
    ],
  };

  it("returns exactly dailySize lines", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text.lines).toHaveLength(10);
  });

  it("task type is read_text", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    expect(tasks[0].type).toBe("read_text");
  });

  it("all selected lines come from the original pool", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    const poolIds = new Set(POOL_TOPIC.texts[0].lines.map((l) => l.id));
    for (const line of tasks[0].text.lines) {
      expect(poolIds.has(line.id)).toBe(true);
    }
  });

  it("no duplicate lines in selection", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    const ids = tasks[0].text.lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("same date produces the same selection", () => {
    const tasks1 = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    const tasks2 = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    expect(tasks1[0].text.lines.map((l) => l.id)).toEqual(
      tasks2[0].text.lines.map((l) => l.id)
    );
  });

  it("different dates produce different selections", () => {
    const tasks1 = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    const tasks2 = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-02" });
    expect(tasks1[0].text.lines.map((l) => l.id)).not.toEqual(
      tasks2[0].text.lines.map((l) => l.id)
    );
  });

  it("returns empty array for non-sentence_pool kind", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, TOPIC, "dad_best", { today: "2024-01-01" });
    expect(tasks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться что они падают**

```
npx vitest run src/topics/renderers/reading/engine.test.js --reporter=verbose
```

Ожидаемый результат: 7 новых тестов FAIL с "is not a function" или подобным. Pre-existing ошибка (assemble_text) тоже присутствует — норма.

- [ ] **Step 3: Реализовать в engine.js**

**3a.** Переименовать параметр в сигнатуре `generateTasks` (строка 69):

```js
// было:
export function generateTasks(mode, topicRecord, textId, _sessionParams = null, textOverride = null) {
// стало:
export function generateTasks(mode, topicRecord, textId, sessionParams = null, textOverride = null) {
```

**3b.** Добавить две функции перед `generateTasks` (после `buildShoppingListTask`):

```js
function seededShuffle(arr, seedStr) {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) {
    s = (Math.imul(31, s) + seedStr.charCodeAt(i)) | 0;
  }
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDailySentencesTasks(text, today = null) {
  const dailySize = text.dailySize ?? 10;
  const date = today ?? new Date().toISOString().slice(0, 10);
  const seed = `${text.id}_${date}`;
  const shuffled = seededShuffle(text.lines ?? [], seed);
  return [{
    type: "read_text",
    textId: text.id,
    text: { ...text, lines: shuffled.slice(0, dailySize) },
  }];
}
```

**3c.** Добавить case в switch внутри `generateTasks`, после `case "shopping_list"` и перед `default`:

```js
    case "daily_sentences":
      return text.kind === "sentence_pool"
        ? buildDailySentencesTasks(text, sessionParams?.today ?? null)
        : [];
```

- [ ] **Step 4: Запустить тесты — убедиться что новые проходят**

```
npx vitest run src/topics/renderers/reading/engine.test.js --reporter=verbose
```

Ожидаемый результат: 7 новых тестов PASS. Pre-existing ошибка (assemble_text) остаётся — это норма, не трогать.

- [ ] **Step 5: Commit**

```
git add src/topics/renderers/reading/engine.js src/topics/renderers/reading/engine.test.js
git commit -m "feat(reading): add daily_sentences mode with seeded daily pool selection"
```

---

## Task 2: Generator script и ZIP

**Files:**
- Create: `scripts/generate-reading-instructions.mjs`
- Output: `public/decks/reading_dad_instructions_v1.0.0.zip`

**Interfaces:**
- Consumes: `jszip` (уже в package.json)
- Produces: ZIP с `topic.json`, `media/avatar.svg`, загружаемый как обычная тема

- [ ] **Step 1: Создать скрипт `scripts/generate-reading-instructions.mjs`**

```js
import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <circle cx="120" cy="120" r="116" fill="#eef4ff" stroke="#c4d8f8" stroke-width="3"/>
  <!-- Head -->
  <circle cx="120" cy="66" r="22" fill="#f5c896"/>
  <!-- Body -->
  <rect x="106" y="90" width="28" height="50" rx="8" fill="#4a7fd4"/>
  <!-- Right arm raised -->
  <line x1="106" y1="100" x2="72" y2="64" stroke="#f5c896" stroke-width="14" stroke-linecap="round"/>
  <!-- Left arm down -->
  <line x1="134" y1="100" x2="156" y2="136" stroke="#f5c896" stroke-width="14" stroke-linecap="round"/>
  <!-- Legs -->
  <line x1="114" y1="140" x2="102" y2="190" stroke="#2d5ca8" stroke-width="14" stroke-linecap="round"/>
  <line x1="126" y1="140" x2="138" y2="190" stroke="#2d5ca8" stroke-width="14" stroke-linecap="round"/>
  <!-- Raised hand -->
  <circle cx="68" cy="60" r="10" fill="#f5c896"/>
</svg>`;

const SENTENCES = [
  "Подними правую руку вверх.",
  "Подними левую руку вверх.",
  "Хлопни в ладоши два раза.",
  "Хлопни в ладоши три раза.",
  "Топни правой ногой два раза.",
  "Топни левой ногой три раза.",
  "Дотронься правой рукой до левого уха.",
  "Дотронься левой рукой до правого плеча.",
  "Положи обе руки на колени.",
  "Скрести руки на груди.",
  "Потяни обе руки вверх и потянись.",
  "Кивни головой три раза.",
  "Покачай головой: нет-нет-нет.",
  "Закрой глаза и посчитай до трёх.",
  "Встань, хлопни один раз и сядь.",
  "Возьми карандаш и нарисуй круг.",
  "Возьми синий карандаш и нарисуй квадрат.",
  "Возьми красный карандаш и нарисуй треугольник.",
  "Возьми ручку и напиши заглавную букву А.",
  "Возьми ручку и напиши своё имя.",
  "Нарисуй солнце.",
  "Нарисуй домик.",
  "Нарисуй смайлик.",
  "Положи карандаш справа от тетради.",
  "Положи карандаш слева от книги.",
  "Открой тетрадь на первой странице.",
  "Закрой тетрадь и положи её на стол.",
  "Возьми два карандаша и покажи их.",
  "Поставь точку в середине листа.",
  "Скажи своё имя громко.",
  "Скажи своё имя тихо.",
  "Назови три цвета.",
  "Назови три животных.",
  "Назови три предмета в комнате.",
  "Скажи «Я умею читать» громко.",
  "Скажи что ты ел на завтрак.",
  "Спой одну строчку любой песни.",
  "Скажи «мама» три раза.",
  "Скажи «до свидания» и помаши рукой.",
  "Сядь ровно и положи руки на стол.",
  "Встань прямо и опусти руки вниз.",
  "Повернись на стуле направо.",
  "Повернись на стуле налево.",
  "Наклони голову вправо, потом влево.",
  "Закрой рот и подержи так три секунды.",
  "Сожми руки в кулаки и медленно разожми.",
  "Посмотри в окно и скажи что видишь.",
];

const manifest = {
  meta: {
    id: "reading_dad_instructions",
    version: "1.0.0",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
    avatar: "media/avatar.svg",
    title: { ru: "Чтение. Инструкции", en: "Reading: Instructions" },
    description: {
      ru: "Читаем предложение и выполняем задание.",
      en: "Read the sentence and follow the instruction.",
    },
    about: {
      ru: [
        "Тема предназначена для работы логопеда с ребёнком.",
        "Каждый день — новый набор из 10 предложений.",
        "Ребёнок читает предложение, отвечает на вопрос «что ты должен сделать?» и выполняет действие.",
      ],
      en: ["Designed for therapist-led sessions."],
    },
    conceptCount: 10,
    sessionConfig: { maxSize: 10 },
  },
  modes: [
    {
      id: "daily_sentences",
      type: "daily_sentences",
      ui: {
        title: { ru: "Читаем и выполняем", en: "Read and do" },
        instruction: { ru: "Прочитай предложение и выполни задание", en: "Read and follow the instruction" },
      },
    },
  ],
  cards: [],
  texts: [
    {
      id: "pool",
      kind: "sentence_pool",
      dailySize: 10,
      title: { ru: "Ежедневные инструкции", en: "Daily Instructions" },
      lines: SENTENCES.map((text, i) => ({ id: `s${i + 1}`, text })),
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/avatar.svg", avatarSvg);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_instructions_v1.0.0.zip", buffer);
console.log(`✓ reading_dad_instructions_v1.0.0.zip written (${buffer.length} bytes, ${SENTENCES.length} sentences)`);
```

- [ ] **Step 2: Запустить генератор**

```
node scripts/generate-reading-instructions.mjs
```

Ожидаемый результат:
```
✓ reading_dad_instructions_v1.0.0.zip written (XXXX bytes, 47 sentences)
```

- [ ] **Step 3: Проверить что ZIP создан**

```
ls -la public/decks/reading_dad_instructions_v1.0.0.zip
```

Ожидаемый результат: файл существует, размер > 5000 байт.

- [ ] **Step 4: Commit**

```
git add scripts/generate-reading-instructions.mjs public/decks/reading_dad_instructions_v1.0.0.zip
git commit -m "feat: add reading_dad_instructions topic — 47-sentence daily pool"
```

---

## Self-Review

**Spec coverage:**
- ✓ Пул 47 предложений — Task 2, SENTENCES массив
- ✓ Детерминированная выборка по дате — Task 1, seededShuffle + buildDailySentencesTasks
- ✓ dailySize: 10 — Task 1 engine + Task 2 manifest
- ✓ Тип задания read_text (существующий рендерер) — Task 1, buildDailySentencesTasks возвращает type: "read_text"
- ✓ Один режим daily_sentences в modes[] — Task 2, manifest.modes
- ✓ Тесты детерминизма — Task 1, Step 1
- ✓ No изменений в index.jsx / engineRegistry.js / ModePickerScreen.jsx — подтверждено анализом

**Placeholder scan:** Нет TBD/TODO.

**Type consistency:** `type: "daily_sentences"` используется в mode.type (topic.json) и в case в engine.js — совпадает. `kind: "sentence_pool"` в texts совпадает с проверкой в buildDailySentencesTasks.
