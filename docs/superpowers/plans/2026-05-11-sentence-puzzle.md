# Sentence Puzzle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить новый рендерер `sentence_puzzle` — логопедический инструмент, где ребёнок собирает предложения из слов методом drag-and-drop, а логопед задаёт вопросы по результату.

**Architecture:** ZIP-модуль с `meta.renderer: "sentence_puzzle"` содержит только данные (слова). Код рендерера живёт в бандле приложения — два новых файла в `engineRegistry` и `registry`. Движок генерирует один task с полным набором слов из ZIP; рендерер сам управляет раундами (выбор N слов, сборка, экран вопросов, новый раунд) без вызова `onAdvance`. Сессия завершается только кнопкой ✕ в SessionScreen.

**Tech Stack:** React 19, @dnd-kit/core, @dnd-kit/utilities, Vite, Vitest

---

## File Map

**Create:**
- `src/topics/renderers/sentence_puzzle/engine.js` — генерирует один task со всеми словами из topic.cards
- `src/topics/renderers/sentence_puzzle/engine.test.js` — unit-тесты движка
- `src/topics/renderers/sentence_puzzle/index.jsx` — главный рендерер, управляет состоянием раунда
- `src/topics/renderers/sentence_puzzle/SentenceRow.jsx` — одна строка предложения с droppable-слотами
- `src/topics/renderers/sentence_puzzle/CardPool.jsx` — нижний пул draggable-карточек
- `src/topics/renderers/sentence_puzzle/QuestionsView.jsx` — экран вопросов после завершения сборки
- `src/topics/renderers/sentence_puzzle/sentence_puzzle.css` — все стили рендерера
- `tools/sentence_puzzle/topic.json` — источник ZIP: манифест с данными слов
- `tools/sentence_puzzle/media/avatar.svg` — источник ZIP: иконка темы
- `tools/sentence_puzzle/build.mjs` — скрипт сборки ZIP

**Modify:**
- `src/topics/renderers/engineRegistry.js` — регистрация движка sentence_puzzle
- `src/topics/renderers/registry.js` — регистрация рендерера SentencePuzzleRenderer

**No changes needed:** `topicLoader.js` уже корректно обрабатывает `meta.renderer: "sentence_puzzle"` через ветку `if (record.meta.renderer)` в `migrateRecord`.

---

## Task 1: Install @dnd-kit and register stubs

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/topics/renderers/engineRegistry.js`
- Modify: `src/topics/renderers/registry.js`
- Create: `src/topics/renderers/sentence_puzzle/engine.js` (stub)
- Create: `src/topics/renderers/sentence_puzzle/index.jsx` (stub)

- [ ] **Step 1: Install @dnd-kit packages**

```bash
cd c:\Users\dmazn\Projects\Mirocard2
npm install @dnd-kit/core @dnd-kit/utilities
```

Expected output: added 2 packages, no peer dep warnings.

- [ ] **Step 2: Create engine stub**

Create `src/topics/renderers/sentence_puzzle/engine.js`:
```js
export function generateTasks(_mode, _cards, _sessionSize, _sessionParams) {
  return [];
}
```

- [ ] **Step 3: Create renderer stub**

Create `src/topics/renderers/sentence_puzzle/index.jsx`:
```jsx
export default function SentencePuzzleRenderer() {
  return <div className="session-body">Sentence Puzzle — скоро</div>;
}
```

- [ ] **Step 4: Register engine**

Edit `src/topics/renderers/engineRegistry.js`:
```js
import { generateTasks as flashcardsEngine }          from "./flashcards/engine";
import { generateTasks as comparisonEngine }           from "./comparison/engine";
import { generateTasks as mathHousesEngine }           from "./math_houses/engine";
import { generateTasks as additionSubtractionEngine }  from "./addition_subtraction/engine";
import { generateTasks as readingEngine }              from "./reading/engine";
import { generateTasks as sentencePuzzleEngine }       from "./sentence_puzzle/engine";

export const ENGINE_REGISTRY = {
  flashcards:            flashcardsEngine,
  comparison:            comparisonEngine,
  math_houses:           mathHousesEngine,
  addition_subtraction:  additionSubtractionEngine,
  reading:               readingEngine,
  sentence_puzzle:       sentencePuzzleEngine,
};
```

- [ ] **Step 5: Register renderer**

Edit `src/topics/renderers/registry.js`:
```js
import FlashcardsRenderer          from "./renderers/flashcards/index.jsx";
import ComparisonRenderer          from "./renderers/comparison/index.jsx";
import MathHousesRenderer          from "./renderers/math_houses/index.jsx";
import AdditionSubtractionRenderer from "./renderers/addition_subtraction/index.jsx";
import ReadingRenderer             from "./renderers/reading/index.jsx";
import SentencePuzzleRenderer      from "./renderers/sentence_puzzle/index.jsx";

export const RENDERER_REGISTRY = {
  flashcards:            FlashcardsRenderer,
  comparison:            ComparisonRenderer,
  math_houses:           MathHousesRenderer,
  addition_subtraction:  AdditionSubtractionRenderer,
  reading:               ReadingRenderer,
  sentence_puzzle:       SentencePuzzleRenderer,
};
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: сервер стартует без ошибок компиляции.

- [ ] **Step 7: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/engine.js src/topics/renderers/sentence_puzzle/index.jsx src/topics/renderers/engineRegistry.js src/topics/renderers/registry.js package.json package-lock.json
git commit -m "feat(sentence_puzzle): register engine and renderer stubs, install @dnd-kit"
```

---

## Task 2: Engine + tests

**Files:**
- Create: `src/topics/renderers/sentence_puzzle/engine.js` (replace stub)
- Create: `src/topics/renderers/sentence_puzzle/engine.test.js`

**Contract:** `generateTasks(mode, cards, sessionSize, sessionParams)` вызывается из `useSessionEngine.js` как `generateTasks(mode, allCards, sessionSize, sessionParams)`. Возвращает массив из одного task со всеми словами, сгруппированными по типу.

- [ ] **Step 1: Write failing tests**

Create `src/topics/renderers/sentence_puzzle/engine.test.js`:
```js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  { id: "mom",    type: "subject",   label: "Мама",     emoji: "👩" },
  { id: "dad",    type: "subject",   label: "Папа",     emoji: "👨" },
  { id: "wash",   type: "verb",      label: "моет",     emoji: "🧼" },
  { id: "carry",  type: "verb",      label: "несёт",    emoji: "🤲" },
  { id: "red",    type: "adjective", label: "красную",  emoji: "🔴" },
  { id: "blue",   type: "adjective", label: "синюю",    emoji: "🔵" },
  { id: "cup",    type: "object",    label: "чашку",    nominative: "чашка", emoji: "☕" },
  { id: "car",    type: "object",    label: "машинку",  nominative: "машинка", emoji: "🚗" },
];

const MODE = { id: "sentence_puzzle", type: "sentence_puzzle" };

describe("generateTasks", () => {
  it("returns exactly one task", () => {
    const tasks = generateTasks(MODE, CARDS, 15, {});
    expect(tasks).toHaveLength(1);
  });

  it("task has type sentence_puzzle", () => {
    const [task] = generateTasks(MODE, CARDS, 15, {});
    expect(task.type).toBe("sentence_puzzle");
  });

  it("groups cards by type", () => {
    const [task] = generateTasks(MODE, CARDS, 15, {});
    expect(task.subjects).toHaveLength(2);
    expect(task.verbs).toHaveLength(2);
    expect(task.adjectives).toHaveLength(2);
    expect(task.objects).toHaveLength(2);
  });

  it("includes all cards of each type regardless of sessionParams", () => {
    const [task] = generateTasks(MODE, CARDS, 15, { level: 1, structure: "simple" });
    expect(task.subjects).toHaveLength(2);
    expect(task.verbs).toHaveLength(2);
  });

  it("handles missing cards of a type gracefully", () => {
    const noObjects = CARDS.filter((c) => c.type !== "object");
    const [task] = generateTasks(MODE, noObjects, 15, {});
    expect(task.objects).toHaveLength(0);
  });

  it("returns empty array when no cards provided", () => {
    const tasks = generateTasks(MODE, [], 15, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0].subjects).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/topics/renderers/sentence_puzzle/engine.test.js
```

Expected: FAIL — `generateTasks` returns empty array.

- [ ] **Step 3: Implement engine**

Replace `src/topics/renderers/sentence_puzzle/engine.js`:
```js
export function generateTasks(_mode, cards, _sessionSize, _sessionParams) {
  return [{
    type:       "sentence_puzzle",
    subjects:   cards.filter((c) => c.type === "subject"),
    verbs:      cards.filter((c) => c.type === "verb"),
    adjectives: cards.filter((c) => c.type === "adjective"),
    objects:    cards.filter((c) => c.type === "object"),
  }];
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/topics/renderers/sentence_puzzle/engine.test.js
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/engine.js src/topics/renderers/sentence_puzzle/engine.test.js
git commit -m "feat(sentence_puzzle): implement engine — groups cards by type into single task"
```

---

## Task 3: ZIP source files + build script

**Files:**
- Create: `tools/sentence_puzzle/topic.json`
- Create: `tools/sentence_puzzle/media/avatar.svg`
- Create: `tools/sentence_puzzle/build.mjs`

- [ ] **Step 1: Create topic.json**

Create `tools/sentence_puzzle/topic.json`:
```json
{
  "meta": {
    "id": "sentence_puzzle",
    "version": "1.0.0",
    "renderer": "sentence_puzzle",
    "title": "Пазл предложений"
  },
  "modes": [
    {
      "id": "sentence_puzzle",
      "type": "sentence_puzzle",
      "evaluation": "none",
      "ui": {
        "title": "Пазл предложений",
        "instruction": "Собери предложения из слов"
      },
      "params": {
        "level": {
          "type": "enum",
          "label": { "ru": "Сложность" },
          "values": [1, 2, 3],
          "labels": { "ru": { "1": "1 предложение", "2": "2 предложения", "3": "3 предложения" } },
          "default": 1
        },
        "structure": {
          "type": "enum",
          "label": { "ru": "Структура" },
          "values": ["simple", "full"],
          "labels": { "ru": { "simple": "Простая (кто + что делает)", "full": "Полная (кто + что делает + какую + что)" } },
          "default": "simple"
        }
      }
    }
  ],
  "cards": [
    { "id": "mom",     "type": "subject",   "label": "Мама",      "emoji": "👩" },
    { "id": "dad",     "type": "subject",   "label": "Папа",      "emoji": "👨" },
    { "id": "grandma", "type": "subject",   "label": "Бабушка",   "emoji": "👵" },
    { "id": "grandpa", "type": "subject",   "label": "Дедушка",   "emoji": "👴" },
    { "id": "boy",     "type": "subject",   "label": "Мальчик",   "emoji": "👦" },
    { "id": "girl",    "type": "subject",   "label": "Девочка",   "emoji": "👧" },

    { "id": "wash",    "type": "verb",      "label": "моет",      "emoji": "🧼" },
    { "id": "carry",   "type": "verb",      "label": "несёт",     "emoji": "🤲" },
    { "id": "search",  "type": "verb",      "label": "ищет",      "emoji": "🔍" },
    { "id": "take",    "type": "verb",      "label": "берёт",     "emoji": "✋" },
    { "id": "draw",    "type": "verb",      "label": "рисует",    "emoji": "✏️" },
    { "id": "read_v",  "type": "verb",      "label": "читает",    "emoji": "📖" },

    { "id": "red",     "type": "adjective", "label": "красную",   "emoji": "🔴" },
    { "id": "blue",    "type": "adjective", "label": "синюю",     "emoji": "🔵" },
    { "id": "big",     "type": "adjective", "label": "большую",   "emoji": "⬆️" },
    { "id": "small",   "type": "adjective", "label": "маленькую", "emoji": "⬇️" },
    { "id": "clean",   "type": "adjective", "label": "чистую",    "emoji": "✨" },
    { "id": "dirty",   "type": "adjective", "label": "грязную",   "emoji": "🟤" },

    { "id": "cup",     "type": "object", "label": "чашку",    "nominative": "чашка",   "emoji": "☕"  },
    { "id": "car",     "type": "object", "label": "машинку",  "nominative": "машинка", "emoji": "🚗"  },
    { "id": "book",    "type": "object", "label": "книгу",    "nominative": "книга",   "emoji": "📕"  },
    { "id": "spoon",   "type": "object", "label": "ложку",    "nominative": "ложка",   "emoji": "🥄"  },
    { "id": "plate",   "type": "object", "label": "тарелку",  "nominative": "тарелка", "emoji": "🍽️"  },
    { "id": "toy",     "type": "object", "label": "игрушку",  "nominative": "игрушка", "emoji": "🧸"  }
  ]
}
```

- [ ] **Step 2: Create avatar.svg**

Create `tools/sentence_puzzle/media/avatar.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <rect x="14" y="44" width="28" height="20" rx="8" fill="#4a90d9"/>
  <rect x="50" y="44" width="28" height="20" rx="8" fill="#4a9b8f"/>
  <rect x="86" y="44" width="28" height="20" rx="8" fill="#8b5cf6"/>
  <path d="M42 54h8M78 54h8" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>
  <rect x="14" y="72" width="28" height="20" rx="8" fill="#4a90d9" opacity="0.4"/>
  <rect x="50" y="72" width="28" height="20" rx="8" fill="#4a9b8f" opacity="0.4"/>
  <rect x="86" y="72" width="28" height="20" rx="8" fill="#8b5cf6" opacity="0.4"/>
</svg>
```

- [ ] **Step 3: Create build script**

Create `tools/sentence_puzzle/build.mjs`:
```js
import JSZip from "jszip";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

const topicJson = readFileSync(join(__dir, "topic.json"), "utf-8");
const avatarSvg = readFileSync(join(__dir, "media", "avatar.svg"));

const zip = new JSZip();
zip.file("topic.json", topicJson);
zip.file("media/avatar.svg", avatarSvg);

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = join(__dir, "sentence_puzzle.zip");
writeFileSync(outPath, buffer);
console.log("✓ Built:", outPath);
```

- [ ] **Step 4: Build the ZIP**

```bash
cd tools/sentence_puzzle
node build.mjs
```

Expected: `✓ Built: .../tools/sentence_puzzle/sentence_puzzle.zip`

- [ ] **Step 5: Verify ZIP imports into the app**

Запусти dev-сервер (`npm run dev`), открой приложение, импортируй `tools/sentence_puzzle/sentence_puzzle.zip` через интерфейс тем. Тема "Пазл предложений" должна появиться в списке. При запуске сессии должен рендериться стаб: "Sentence Puzzle — скоро".

- [ ] **Step 6: Commit**

```bash
cd c:\Users\dmazn\Projects\Mirocard2
git add tools/sentence_puzzle/
git commit -m "feat(sentence_puzzle): add ZIP source files and build script"
```

---

## Task 4: SentenceRow component

**Files:**
- Create: `src/topics/renderers/sentence_puzzle/SentenceRow.jsx`

Компонент отрисовывает одну строку предложения: N droppable-слотов с цветовым кодированием. Слот принимает карточку только своего типа (проверка на уровне DndContext в index.jsx).

- [ ] **Step 1: Create SentenceRow.jsx**

Create `src/topics/renderers/sentence_puzzle/SentenceRow.jsx`:
```jsx
import { useDroppable } from "@dnd-kit/core";

const SLOT_LABELS = {
  subject:   "КТО?",
  verb:      "ЧТО ДЕЛАЕТ?",
  adjective: "КАКУЮ?",
  object:    "ЧТО?",
};

export const SLOT_TYPES = {
  simple: ["subject", "verb"],
  full:   ["subject", "verb", "adjective", "object"],
};

function Slot({ rowIndex, slotType, card }) {
  const { isOver, setNodeRef } = useDroppable({
    id:   `${rowIndex}_${slotType}`,
    data: { rowIndex, slotType },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "sp-slot",
        `sp-slot--${slotType}`,
        card    ? "sp-slot--filled" : "",
        isOver  ? "sp-slot--over"   : "",
      ].join(" ")}
    >
      {card
        ? <><span className="sp-slot__emoji">{card.emoji}</span><span className="sp-slot__word">{card.label}</span></>
        : <span className="sp-slot__label">{SLOT_LABELS[slotType]}</span>
      }
    </div>
  );
}

export default function SentenceRow({ rowIndex, structure, placed }) {
  const slots = SLOT_TYPES[structure] ?? SLOT_TYPES.simple;

  return (
    <div className="sp-row">
      {slots.map((slotType, i) => (
        <div key={slotType} className="sp-row__cell">
          {i > 0 && <span className="sp-arrow" aria-hidden>→</span>}
          <Slot rowIndex={rowIndex} slotType={slotType} card={placed[slotType] ?? null} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/SentenceRow.jsx
git commit -m "feat(sentence_puzzle): add SentenceRow droppable component"
```

---

## Task 5: CardPool component

**Files:**
- Create: `src/topics/renderers/sentence_puzzle/CardPool.jsx`

Нижний пул — горизонтальный ряд перемешанных draggable-карточек. Карточка цветная по типу, содержит emoji + слово.

- [ ] **Step 1: Create CardPool.jsx**

Create `src/topics/renderers/sentence_puzzle/CardPool.jsx`:
```jsx
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

function DraggableCard({ card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   card.id,
    data: { card },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity:   isDragging ? 0.4 : 1,
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`sp-card sp-card--${card.type}`}
    >
      <span className="sp-card__emoji">{card.emoji}</span>
      <span className="sp-card__label">{card.label}</span>
    </div>
  );
}

export default function CardPool({ cards }) {
  return (
    <div className="sp-pool">
      {cards.map((card) => (
        <DraggableCard key={card.id} card={card} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/CardPool.jsx
git commit -m "feat(sentence_puzzle): add CardPool draggable component"
```

---

## Task 6: QuestionsView component

**Files:**
- Create: `src/topics/renderers/sentence_puzzle/QuestionsView.jsx`

Экран вопросов. Показывает собранные предложения и вопросы по ним. У каждого вопроса есть скрытый ответ — логопед нажимает чтобы раскрыть.

- [ ] **Step 1: Create QuestionsView.jsx**

Create `src/topics/renderers/sentence_puzzle/QuestionsView.jsx`:
```jsx
import { useState } from "react";
import { SLOT_TYPES } from "./SentenceRow";

function adjNominative(label) {
  if (!label) return "___";
  if (label.endsWith("юю")) return label.slice(0, -2) + "яя";
  if (label.endsWith("ую")) return label.slice(0, -2) + "ая";
  return label;
}

function buildSentence(placed, structure) {
  return SLOT_TYPES[structure]
    .map((t) => placed[t]?.label ?? "___")
    .join(" ") + ".";
}

function buildQuestions(placed, structure) {
  const subj   = placed.subject?.label?.toLowerCase()  ?? "___";
  const verb   = placed.verb?.label                    ?? "___";
  const objAcc = placed.object?.label                  ?? "___";
  const objNom = placed.object?.nominative             ?? "___";
  const adjNom = adjNominative(placed.adjective?.label);

  if (structure === "simple") {
    return [
      { q: `Кто ${verb}?`,                answer: placed.subject?.label ?? "___" },
      { q: `Что делает ${subj}?`,         answer: verb },
    ];
  }

  return [
    { q: `Кто ${verb} ${objAcc}?`,        answer: placed.subject?.label ?? "___" },
    { q: `Что делает ${subj}?`,           answer: verb },
    { q: `Что ${subj} ${verb}?`,          answer: objAcc },
    { q: `Какая ${objNom}?`,              answer: adjNom },
  ];
}

function QuestionItem({ item, index }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="sp-q-item">
      <span className="sp-q-num">{index + 1}.</span>
      <div className="sp-q-body">
        <span className="sp-q-text">{item.q}</span>
        {revealed
          ? <span className="sp-q-answer">{item.answer}</span>
          : <button className="sp-q-reveal-btn" onClick={() => setRevealed(true)}>показать ответ</button>
        }
      </div>
    </div>
  );
}

function SentenceBlock({ placed, structure, blockIndex }) {
  const sentence  = buildSentence(placed, structure);
  const questions = buildQuestions(placed, structure);

  return (
    <div className="sp-sentence-block">
      <p className="sp-sentence-text">
        <span className="sp-sentence-num">{blockIndex + 1}.</span> {sentence}
      </p>
      <div className="sp-q-list">
        {questions.map((item, i) => (
          <QuestionItem key={i} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}

export default function QuestionsView({ rows, structure, onNewRound, onBack }) {
  return (
    <div className="sp-questions-screen">
      <div className="sp-questions-body">
        {rows.map((placed, i) => (
          <SentenceBlock key={i} placed={placed} structure={structure} blockIndex={i} />
        ))}
      </div>
      <div className="sp-questions-actions">
        <button className="sp-btn sp-btn--secondary" onClick={onBack}>← Назад к пазлу</button>
        <button className="sp-btn sp-btn--primary"   onClick={onNewRound}>Новое задание →</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/QuestionsView.jsx
git commit -m "feat(sentence_puzzle): add QuestionsView with answer reveal"
```

---

## Task 7: Main renderer index.jsx

**Files:**
- Create: `src/topics/renderers/sentence_puzzle/index.jsx` (replace stub)

Главный компонент. Управляет состоянием раунда: выбирает N слов из task по `sessionParams`, распределяет по строкам, обрабатывает drag-and-drop, переключает фазы building/questions.

- [ ] **Step 1: Replace renderer stub**

Replace `src/topics/renderers/sentence_puzzle/index.jsx`:
```jsx
import { useState }                                           from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { shuffle }     from "@/shared/utils/shuffle";
import SentenceRow, { SLOT_TYPES } from "./SentenceRow";
import CardPool        from "./CardPool";
import QuestionsView   from "./QuestionsView";
import "./sentence_puzzle.css";

function pickN(arr, n) {
  return shuffle([...arr]).slice(0, Math.min(n, arr.length));
}

function buildRound(task, sessionParams) {
  const level     = Number(sessionParams?.level)     || 1;
  const structure = sessionParams?.structure         || "simple";
  const slotTypes = SLOT_TYPES[structure] ?? SLOT_TYPES.simple;

  const subjects   = pickN(task.subjects,   level);
  const verbs      = pickN(task.verbs,      level);
  const adjectives = structure === "full" ? pickN(task.adjectives, level) : [];
  const objects    = structure === "full" ? pickN(task.objects,    level) : [];

  const pool = shuffle([...subjects, ...verbs, ...adjectives, ...objects]);
  const emptyRow = () => Object.fromEntries(slotTypes.map((t) => [t, null]));
  const rows = Array.from({ length: level }, emptyRow);

  return { pool, rows, structure, slotTypes, level };
}

export default function SentencePuzzleRenderer({ task, sessionParams }) {
  const [round,      setRound]      = useState(() => buildRound(task, sessionParams));
  const [phase,      setPhase]      = useState("building");
  const [activeCard, setActiveCard] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const isComplete = round.rows.every((placed) =>
    round.slotTypes.every((t) => placed[t] !== null)
  );

  function handleDragStart({ active }) {
    const card = active.data.current?.card ?? null;
    setActiveCard(card);
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null);
    if (!over) return;

    const card = active.data.current?.card;
    if (!card) return;

    const { rowIndex, slotType } = over.data.current ?? {};
    if (rowIndex === undefined || !slotType) return;
    if (card.type !== slotType) return;

    setRound((prev) => {
      if (prev.rows[rowIndex]?.[slotType] !== null) return prev; // slot already filled
      const newRows = prev.rows.map((row, i) =>
        i === rowIndex ? { ...row, [slotType]: card } : row
      );
      const newPool = prev.pool.filter((c) => c.id !== card.id);
      return { ...prev, rows: newRows, pool: newPool };
    });
  }

  function startNewRound() {
    setRound(buildRound(task, sessionParams));
    setPhase("building");
  }

  if (phase === "questions") {
    return (
      <QuestionsView
        rows={round.rows}
        structure={round.structure}
        onNewRound={startNewRound}
        onBack={() => setPhase("building")}
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="sp-screen">
        <div className="sp-rows-area">
          {round.rows.map((placed, rowIndex) => (
            <SentenceRow
              key={rowIndex}
              rowIndex={rowIndex}
              structure={round.structure}
              placed={placed}
            />
          ))}
        </div>

        <CardPool cards={round.pool} />

        {isComplete && (
          <div className="sp-complete-bar">
            <button className="sp-btn sp-btn--primary" onClick={() => setPhase("questions")}>
              Вопросы →
            </button>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <div className={`sp-card sp-card--${activeCard.type} sp-card--overlay`}>
            <span className="sp-card__emoji">{activeCard.emoji}</span>
            <span className="sp-card__label">{activeCard.label}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Verify no compile errors**

```bash
npm run dev
```

Expected: компиляция без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/index.jsx
git commit -m "feat(sentence_puzzle): implement main renderer with DnD, round management, phase switching"
```

---

## Task 8: CSS styles

**Files:**
- Create: `src/topics/renderers/sentence_puzzle/sentence_puzzle.css`

Планшетный интерфейс. Цветовое кодирование типов: subject=синий, verb=зелёный, adjective=оранжевый, object=фиолетовый. Без избыточных анимаций.

- [ ] **Step 1: Create sentence_puzzle.css**

Create `src/topics/renderers/sentence_puzzle/sentence_puzzle.css`:
```css
/* ── Layout ── */
.sp-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 16px;
  box-sizing: border-box;
  background: #f8f9fa;
}

.sp-rows-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

/* ── Row ── */
.sp-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border-radius: 16px;
  padding: 10px 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}

.sp-row__cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sp-arrow {
  font-size: 18px;
  color: #9ca3af;
  user-select: none;
}

/* ── Slot ── */
.sp-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  min-height: 64px;
  border-radius: 12px;
  border: 2px dashed;
  padding: 6px 10px;
  transition: background 0.15s, transform 0.1s;
  cursor: default;
}

.sp-slot--subject   { border-color: #4a90d9; color: #1a5ca8; }
.sp-slot--verb      { border-color: #4a9b8f; color: #1b6b62; }
.sp-slot--adjective { border-color: #f59e0b; color: #92400e; }
.sp-slot--object    { border-color: #8b5cf6; color: #4c1d95; }

.sp-slot--over      { background: rgba(74, 144, 217, 0.08); transform: scale(1.03); }

.sp-slot--filled { border-style: solid; }
.sp-slot--filled.sp-slot--subject   { background: #dbeafe; border-color: #4a90d9; }
.sp-slot--filled.sp-slot--verb      { background: #d1fae5; border-color: #4a9b8f; }
.sp-slot--filled.sp-slot--adjective { background: #fef3c7; border-color: #f59e0b; }
.sp-slot--filled.sp-slot--object    { background: #ede9fe; border-color: #8b5cf6; }

.sp-slot__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  opacity: 0.7;
  text-transform: uppercase;
}

.sp-slot__emoji { font-size: 22px; line-height: 1; }
.sp-slot__word  { font-size: 15px; font-weight: 600; margin-top: 2px; }

/* ── Card Pool ── */
.sp-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  padding: 14px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
  min-height: 90px;
}

/* ── Card ── */
.sp-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 72px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 2px solid;
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition: box-shadow 0.15s;
}

.sp-card:active { cursor: grabbing; }

.sp-card--subject   { background: #dbeafe; border-color: #4a90d9; color: #1a5ca8; }
.sp-card--verb      { background: #d1fae5; border-color: #4a9b8f; color: #1b6b62; }
.sp-card--adjective { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
.sp-card--object    { background: #ede9fe; border-color: #8b5cf6; color: #4c1d95; }

.sp-card--overlay {
  box-shadow: 0 8px 24px rgba(0,0,0,.18);
  transform: rotate(2deg) scale(1.06);
  opacity: 0.95;
}

.sp-card__emoji { font-size: 24px; line-height: 1; }
.sp-card__label { font-size: 15px; font-weight: 600; }

/* ── Complete bar ── */
.sp-complete-bar {
  display: flex;
  justify-content: center;
}

/* ── Buttons ── */
.sp-btn {
  padding: 12px 28px;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.sp-btn:active { opacity: 0.8; }

.sp-btn--primary   { background: #4a9b8f; color: #fff; }
.sp-btn--secondary { background: #e5e7eb; color: #374151; }

/* ── Questions screen ── */
.sp-questions-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 16px;
  box-sizing: border-box;
  background: #f8f9fa;
}

.sp-questions-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sp-sentence-block {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}

.sp-sentence-num { font-weight: 700; color: #6b7280; margin-right: 4px; }

.sp-sentence-text {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 14px;
  line-height: 1.4;
}

.sp-q-list { display: flex; flex-direction: column; gap: 10px; }

.sp-q-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.sp-q-num { font-weight: 700; color: #9ca3af; min-width: 20px; padding-top: 2px; }

.sp-q-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sp-q-text { font-size: 17px; color: #1f2937; }

.sp-q-reveal-btn {
  font-size: 13px;
  color: #6b7280;
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  width: fit-content;
}

.sp-q-answer {
  font-size: 16px;
  font-weight: 700;
  color: #4a9b8f;
}

.sp-questions-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/sentence_puzzle.css
git commit -m "feat(sentence_puzzle): add tablet-optimized CSS with role color coding"
```

---

## Task 9: Manual QA

Этот таск выполняется руками в браузере на планшете или в dev-tools с эмуляцией планшета.

- [ ] **Step 1: Импортируй ZIP и запусти сессию**

1. Открой приложение: `npm run dev`
2. Импортируй `tools/sentence_puzzle/sentence_puzzle.zip`
3. Выбери студента → выбери тему "Пазл предложений" → выбери режим → настрой params: level=1, structure=simple
4. Запусти сессию

- [ ] **Step 2: Проверь базовый сценарий (level=1, simple)**

- [ ] Внизу 2 карточки (subject + verb)
- [ ] Слоты КТО? и ЧТО ДЕЛАЕТ? видны сверху
- [ ] Drag карточки в правильный слот → карточка фиксируется, цвет заполнения
- [ ] Drag карточки в неправильный слот → карточка возвращается в пул
- [ ] После заполнения обоих слотов появляется кнопка "Вопросы →"
- [ ] На экране вопросов: предложение отображается, вопросы видны, "показать ответ" работает
- [ ] "Новое задание →" — генерирует другую комбинацию слов
- [ ] "← Назад к пазлу" — возвращает к собранному предложению

- [ ] **Step 3: Проверь level=2, full**

- [ ] В пуле 8 карточек (2 subject + 2 verb + 2 adjective + 2 object)
- [ ] Вверху 2 строки по 4 слота
- [ ] Можно заполнить любую строку любым набором (нет фиксированной "правильной" пары)
- [ ] После заполнения всех 8 слотов — кнопка "Вопросы →"
- [ ] На экране вопросов: 2 блока с вопросами, вопрос 4 = "Какая [объект]?"

- [ ] **Step 4: Commit финального состояния**

```bash
git add .
git commit -m "feat(sentence_puzzle): complete implementation — engine, renderer, DnD, questions view, styles"
```

---

## Self-Review

**Spec coverage:**
- ✓ Два режима сложности (simple/full) — реализовано через `sessionParams.structure`
- ✓ Уровни 1-3 (количество предложений) — реализовано через `sessionParams.level`
- ✓ Цветовое кодирование типов — CSS + классы
- ✓ Drag-and-drop — dnd-kit
- ✓ Отклонение карточки неправильного типа — проверка `card.type !== slotType`
- ✓ Экран вопросов — QuestionsView с reveal-ответами
- ✓ Множество валидных решений (не одна "правильная" пара) — движок не фиксирует пары
- ✓ Без аудио — намеренно, V2
- ✓ Без фото/кастомных субъектов — V2 (student profile)
- ✓ ZIP-модуль — topic.json + avatar.svg + build.mjs

**Placeholders:** отсутствуют.

**Type consistency:** `SLOT_TYPES` экспортируется из `SentenceRow.jsx` и импортируется в `QuestionsView.jsx` — согласованно.
