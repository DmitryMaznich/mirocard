# Written Letters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать тему «Письменные буквы» — тренажёр для распознавания рукописных букв русского алфавита, с пятью режимами и точными SVG-прописями.

**Architecture:** Новый рендерер `written_letters` в `src/topics/renderers/written_letters/`. Данные 33 букв (63 SVG-начертания) хранятся в `letterData.js` и подключаются через `builtinTopics.js`. Рендерер регистрируется в `registry.js` и описывается в `topicLoader.js`.

**Tech Stack:** React 19, Vitest, SVG path, pointer events (drag & drop).

## Global Constraints

- Все SVG-пути в координатной системе: viewBox "0 0 80 100" (строчные) / "0 0 80 120" (строчные с хвостами и заглавные); baseline y=80, x-height top y=30, cap line y=10
- ъ, ь, ы — `has_upper: false`, `upper_strokes: null`, `upper_viewBox: null`
- Дистракторы через существующий `selectDistractorConceptIds` из `@/shared/utils/distractorEngine`
- Тесты: `vitest`, окружение `jsdom`, `import { describe, it, expect } from "vitest"` (globals включены)
- Пути импортов: `@/` = `src/`
- SVG-пути прописей должны соответствовать стандарту Нечаевой / Горецкого, 1 класс

---

## File Map

| Файл | Действие | Назначение |
|------|----------|------------|
| `src/topics/renderers/written_letters/LetterSvg.jsx` | Создать | Статичный SVG рендер из strokes[] |
| `src/topics/renderers/written_letters/PrintedLetter.jsx` | Создать | Крупная печатная буква (CSS text) |
| `src/topics/renderers/written_letters/MatchView.jsx` | Создать | Сетка 2×2 для режимов 2a, 2b, 3 |
| `src/topics/renderers/written_letters/SortCaseView.jsx` | Создать | Drag & drop для режима sort_case |
| `src/topics/renderers/written_letters/index.jsx` | Создать | Точка входа, switch по task.type |
| `src/topics/renderers/written_letters/engine.js` | Создать | generateTasks() для всех 5 режимов |
| `src/topics/renderers/written_letters/engine.test.js` | Создать | Тесты engine |
| `src/topics/renderers/written_letters/written_letters.css` | Создать | Стили |
| `src/topics/renderers/written_letters/letterData.js` | Создать | 33 буквы, 63 SVG-начертания |
| `src/topics/registry.js` | Изменить | Добавить written_letters |
| `src/topics/builtinTopics.js` | Изменить | Добавить тему |
| `src/topics/topicLoader.js` | Изменить | DEFAULT_MODES, DEFAULT_META, DEFAULT_TOPIC_ABOUT, DEFAULT_MODE_METHODOLOGY, MODE_ICON_FALLBACKS |

---

## Task 1: LetterSvg + PrintedLetter + CSS skeleton

**Files:**
- Create: `src/topics/renderers/written_letters/LetterSvg.jsx`
- Create: `src/topics/renderers/written_letters/PrintedLetter.jsx`
- Create: `src/topics/renderers/written_letters/written_letters.css`

**Interfaces:**
- Produces: `<LetterSvg viewBox strokes size className showLines />` → `<svg>`
- Produces: `<PrintedLetter letter size className />` → `<div>`

- [ ] **Step 1: Создать CSS skeleton**

```css
/* src/topics/renderers/written_letters/written_letters.css */

/* ── Screen layout ── */
.wl-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 12px;
  box-sizing: border-box;
  background: #f0f4f8;
  user-select: none;
}

/* ── LetterSvg card ── */
.wl-letter-card {
  background: #fff;
  border-radius: 14px;
  border: 2.5px solid #e2e8f0;
  box-shadow: 0 3px 10px rgba(0,0,0,0.09);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

/* ── PrintedLetter ── */
.wl-printed {
  font-weight: 900;
  color: #1e293b;
  line-height: 1;
  font-family: Arial, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Stimulus (top, large) ── */
.wl-stimulus {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0;
}

/* ── Options grid 2×2 ── */
.wl-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1;
}

.wl-option {
  border-radius: 14px;
  border: 3px solid #e2e8f0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  touch-action: manipulation;
  padding: 8px;
}

.wl-option--correct  { border-color: #22c55e; background: #f0fdf4; }
.wl-option--wrong    { border-color: #ef4444; background: #fef2f2; }
.wl-option--disabled { pointer-events: none; }

/* ── Sort zones (drag & drop) ── */
.wl-zones {
  display: flex;
  gap: 12px;
  flex: 1;
}

.wl-zone {
  flex: 1;
  border-radius: 16px;
  border: 3px solid var(--zone-color);
  background: color-mix(in srgb, var(--zone-color) 7%, #fff);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  gap: 8px;
  transition: background 0.15s, border-color 0.15s;
  overflow: hidden;
}

.wl-zone--active {
  background: color-mix(in srgb, var(--zone-color) 18%, #fff);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--zone-color) 35%, transparent);
}

.wl-zone-label {
  font-weight: 800;
  font-size: clamp(0.85rem, 2.5vw, 1.1rem);
  color: var(--zone-color);
  text-align: center;
}

.wl-zone-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}

.wl-zone-chip {
  background: var(--zone-color);
  border-radius: 8px;
  width: clamp(30px, 8vw, 44px);
  height: clamp(30px, 8vw, 44px);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Draggable letter ── */
.wl-drag-card {
  width: clamp(90px, 22vw, 130px);
  height: clamp(90px, 22vw, 130px);
  border-radius: 16px;
  background: #fff;
  border: 3px solid #e2e8f0;
  box-shadow: 0 4px 14px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
}

.wl-drag-card--floating {
  position: fixed;
  transform: translate(-50%, -50%) scale(1.1);
  cursor: grabbing;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  z-index: 1000;
}

.wl-drag-card--shake {
  animation: wl-shake 0.45s ease;
}

@keyframes wl-shake {
  0%   { transform: translateX(0); }
  18%  { transform: translateX(-12px); }
  36%  { transform: translateX(12px); }
  54%  { transform: translateX(-8px); }
  72%  { transform: translateX(8px); }
  90%  { transform: translateX(-3px); }
  100% { transform: translateX(0); }
}

.wl-dock {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0 clamp(1rem, 4vh, 2rem);
}

/* ── Notebook lines background for LetterSvg ── */
.wl-notebook-line { stroke: #cde8f5; stroke-width: 0.4; }
.wl-notebook-baseline { stroke: #9ec8e8; stroke-width: 0.6; }
.wl-notebook-cap { stroke: #f4b8b8; stroke-width: 0.6; }
```

- [ ] **Step 2: Создать LetterSvg**

```jsx
// src/topics/renderers/written_letters/LetterSvg.jsx
const STROKE_COLOR = "#1d4ed8";
const STROKE_W     = 5;

function NotebookBg({ vbW, vbH }) {
  const lines = [];
  for (let y = 10; y <= vbH; y += 10) lines.push(y);
  return (
    <g>
      <rect x={0} y={0} width={vbW} height={vbH} fill="#fefef6" rx={4} />
      {lines.map((y) => (
        <line key={y} x1={0} y1={y} x2={vbW} y2={y} className="wl-notebook-line" />
      ))}
      <line x1={0} y1={10} x2={vbW} y2={10} className="wl-notebook-cap" />
      <line x1={0} y1={80} x2={vbW} y2={80} className="wl-notebook-baseline" />
    </g>
  );
}

export default function LetterSvg({ viewBox, strokes, size = 100, className = "", showLines = false }) {
  const parts = (viewBox ?? "0 0 80 100").split(" ").map(Number);
  const vbW = parts[2] ?? 80;
  const vbH = parts[3] ?? 100;

  return (
    <svg
      viewBox={viewBox ?? "0 0 80 100"}
      width={size}
      height={size * (vbH / vbW)}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block" }}
    >
      {showLines && <NotebookBg vbW={vbW} vbH={vbH} />}
      {(strokes ?? []).map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={STROKE_COLOR}
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 3: Создать PrintedLetter**

```jsx
// src/topics/renderers/written_letters/PrintedLetter.jsx
export default function PrintedLetter({ letter, size = 96, className = "" }) {
  return (
    <div
      className={`wl-printed ${className}`}
      style={{ fontSize: size, width: size * 1.1, height: size * 1.2 }}
    >
      {letter}
    </div>
  );
}
```

- [ ] **Step 4: Запустить dev-сервер и визуально проверить**

```bash
npm run dev
```

Открыть `http://localhost:8080`. Компоненты пока не видны в UI — проверить lint.

```bash
npm run lint
```

Ожидание: 0 ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/written_letters/
git commit -m "feat(written-letters): LetterSvg, PrintedLetter, CSS skeleton"
```

---

## Task 2: engine.js + tests

**Files:**
- Create: `src/topics/renderers/written_letters/engine.js`
- Create: `src/topics/renderers/written_letters/engine.test.js`

**Interfaces:**
- Consumes: `cards[]` — массив карточек с `params.{ printed_upper, printed_lower, has_upper, upper_viewBox, upper_strokes, lower_viewBox, lower_strokes, tags }`
- Produces: `generateTasks(modeType, cards)` → `Task[]`

Task shapes:
```js
// sort_case
{ type: "sort_case", letterCase: "upper"|"lower", correctZone: "upper"|"lower",
  viewBox, strokes, printed, sessionKey }

// match_print_to_written
{ type: "match_print_to_written",
  stimulus: { printed, letterCase },
  options: [{ id, viewBox, strokes, letterCase, isTarget }] }

// match_written_to_print
{ type: "match_written_to_print",
  stimulus: { viewBox, strokes, letterCase },
  options: [{ id, printed, letterCase, isTarget }] }

// match_pair
{ type: "match_pair",
  stimulus: { viewBox, strokes, printed },
  options: [{ id, viewBox, strokes, isTarget }] }
```

- [ ] **Step 1: Написать failing tests**

```js
// src/topics/renderers/written_letters/engine.test.js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  {
    id: "letter_а", conceptId: "letter_а", primary: true,
    params: {
      printed_upper: "А", printed_lower: "а", has_upper: true,
      upper_viewBox: "0 0 80 120", upper_strokes: ["M 14 80 L 38 12 L 62 80", "M 22 54 L 54 54"],
      lower_viewBox: "0 0 80 100", lower_strokes: ["M 40 32 C 58 28 68 44 66 62 C 64 78 50 84 36 80 C 20 76 10 62 14 48 C 18 34 30 30 40 32", "M 66 32 L 66 82"],
      tags: ["oval"],
    },
  },
  {
    id: "letter_о", conceptId: "letter_о", primary: true,
    params: {
      printed_upper: "О", printed_lower: "о", has_upper: true,
      upper_viewBox: "0 0 80 120", upper_strokes: ["M 40 12 C 64 10 76 28 76 50 C 76 74 62 86 40 86 C 18 86 6 72 6 48 C 6 24 22 10 40 12 Z"],
      lower_viewBox: "0 0 80 100", lower_strokes: ["M 40 30 C 62 28 72 46 70 62 C 68 78 54 84 40 84 C 26 84 10 74 12 58 C 14 40 24 28 40 30 Z"],
      tags: ["oval"],
    },
  },
  {
    id: "letter_с", conceptId: "letter_с", primary: true,
    params: {
      printed_upper: "С", printed_lower: "с", has_upper: true,
      upper_viewBox: "0 0 80 120", upper_strokes: ["M 74 24 C 68 10 54 6 40 8 C 20 12 6 28 8 52 C 10 74 26 88 46 86 C 60 84 72 76 74 62"],
      lower_viewBox: "0 0 80 100", lower_strokes: ["M 68 44 C 64 28 50 22 38 26 C 22 30 10 46 12 62 C 14 78 28 86 44 82 C 58 78 68 68 66 58"],
      tags: ["arc"],
    },
  },
  {
    id: "letter_ъ", conceptId: "letter_ъ", primary: true,
    params: {
      printed_upper: null, printed_lower: "ъ", has_upper: false,
      upper_viewBox: null, upper_strokes: null,
      lower_viewBox: "0 0 80 100", lower_strokes: ["M 14 30 L 14 82", "M 14 48 C 26 42 50 42 62 48 C 68 56 68 70 62 76 C 50 84 26 84 14 76"],
      tags: ["arch"],
    },
  },
];

describe("generateTasks — sort_case", () => {
  it("produces upper + lower tasks for has_upper=true letters", () => {
    const tasks = generateTasks("sort_case", CARDS);
    const forA  = tasks.filter((t) => t.printed === "А" || t.printed === "а");
    const cases = forA.map((t) => t.letterCase);
    expect(cases).toContain("upper");
    expect(cases).toContain("lower");
  });

  it("produces only lower tasks for has_upper=false letters (ъ, ь, ы)", () => {
    const tasks = generateTasks("sort_case", CARDS);
    const forHard = tasks.filter((t) => t.printed === "ъ");
    expect(forHard).toHaveLength(1);
    expect(forHard[0].letterCase).toBe("lower");
    expect(forHard[0].correctZone).toBe("lower");
  });

  it("every task has type sort_case with viewBox and strokes", () => {
    const tasks = generateTasks("sort_case", CARDS);
    for (const t of tasks) {
      expect(t.type).toBe("sort_case");
      expect(t.viewBox).toBeTruthy();
      expect(Array.isArray(t.strokes)).toBe(true);
    }
  });
});

describe("generateTasks — match_print_to_written", () => {
  it("produces one task per (letter, case) pair", () => {
    const tasks = generateTasks("match_print_to_written", CARDS);
    // 3 letters with upper × 2 + 1 without upper × 1 = 7
    expect(tasks.length).toBe(7);
  });

  it("each task has exactly 4 options, exactly 1 target", () => {
    const tasks = generateTasks("match_print_to_written", CARDS);
    for (const t of tasks) {
      expect(t.options).toHaveLength(4);
      expect(t.options.filter((o) => o.isTarget)).toHaveLength(1);
    }
  });

  it("stimulus has printed letter and letterCase", () => {
    const tasks = generateTasks("match_print_to_written", CARDS);
    expect(tasks[0].stimulus.printed).toBeTruthy();
    expect(["upper", "lower"]).toContain(tasks[0].stimulus.letterCase);
  });
});

describe("generateTasks — match_written_to_print", () => {
  it("produces one task per (letter, case) pair", () => {
    const tasks = generateTasks("match_written_to_print", CARDS);
    expect(tasks.length).toBe(7);
  });

  it("stimulus has viewBox and strokes", () => {
    const tasks = generateTasks("match_written_to_print", CARDS);
    expect(tasks[0].stimulus.viewBox).toBeTruthy();
    expect(Array.isArray(tasks[0].stimulus.strokes)).toBe(true);
  });

  it("options contain printed letters", () => {
    const tasks = generateTasks("match_written_to_print", CARDS);
    const opts  = tasks[0].options;
    expect(opts.every((o) => typeof o.printed === "string")).toBe(true);
  });
});

describe("generateTasks — match_pair", () => {
  it("skips has_upper=false letters", () => {
    const tasks = generateTasks("match_pair", CARDS);
    const ids   = tasks.map((t) => t.stimulus.printed);
    expect(ids).not.toContain("ъ");
  });

  it("produces one task per has_upper=true letter", () => {
    const tasks = generateTasks("match_pair", CARDS);
    expect(tasks.length).toBe(3); // А, О, С
  });

  it("stimulus is uppercase, options are lowercase", () => {
    const tasks = generateTasks("match_pair", CARDS);
    for (const t of tasks) {
      expect(t.stimulus.viewBox).toBeTruthy();
      expect(t.options.every((o) => o.viewBox)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Запустить failing tests**

```bash
npx vitest run src/topics/renderers/written_letters/engine.test.js
```

Ожидание: `FAIL` — `Cannot find module './engine'`.

- [ ] **Step 3: Реализовать engine.js**

```js
// src/topics/renderers/written_letters/engine.js
import { selectDistractorConceptIds } from "@/shared/utils/distractorEngine";
import { shuffle } from "@/shared/utils/shuffle";

function toConcepts(cards) {
  return cards.map((c) => ({
    conceptId: c.conceptId ?? c.id,
    primary: { tags: c.params?.tags ?? [] },
  }));
}

function generateSortTasks(cards) {
  const sessionKey = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const tasks = [];
  for (const card of cards) {
    const p = card.params;
    if (p.has_upper && p.upper_strokes) {
      tasks.push({
        type: "sort_case",
        letterCase: "upper",
        correctZone: "upper",
        viewBox: p.upper_viewBox,
        strokes: p.upper_strokes,
        printed: p.printed_upper,
        sessionKey,
      });
    }
    tasks.push({
      type: "sort_case",
      letterCase: "lower",
      correctZone: "lower",
      viewBox: p.lower_viewBox,
      strokes: p.lower_strokes,
      printed: p.printed_lower,
      sessionKey,
    });
  }
  return shuffle(tasks);
}

function buildMatchOptions(targetCard, targetCase, allCards, concepts, optionCount) {
  const p = targetCard.params;
  const targetConceptId = targetCard.conceptId ?? targetCard.id;
  const distractorCount = Math.min(optionCount - 1, allCards.length - 1);
  const distractorIds   = selectDistractorConceptIds(targetConceptId, concepts, distractorCount, "medium");

  const targetOption = {
    id: targetConceptId,
    viewBox:   targetCase === "upper" ? p.upper_viewBox   : p.lower_viewBox,
    strokes:   targetCase === "upper" ? p.upper_strokes   : p.lower_strokes,
    printed:   targetCase === "upper" ? p.printed_upper   : p.printed_lower,
    letterCase: targetCase,
    isTarget: true,
  };

  const distractorOptions = distractorIds.map((cid) => {
    const dc = allCards.find((c) => (c.conceptId ?? c.id) === cid);
    if (!dc) return null;
    const dp = dc.params;
    const dCase = targetCase === "upper" && dp.has_upper ? "upper" : "lower";
    return {
      id: cid,
      viewBox:   dCase === "upper" ? dp.upper_viewBox : dp.lower_viewBox,
      strokes:   dCase === "upper" ? dp.upper_strokes : dp.lower_strokes,
      printed:   dCase === "upper" ? dp.printed_upper : dp.printed_lower,
      letterCase: dCase,
      isTarget: false,
    };
  }).filter(Boolean);

  return shuffle([targetOption, ...distractorOptions]);
}

function generateMatchPrintToWrittenTasks(cards) {
  const concepts = toConcepts(cards);
  const tasks = [];
  for (const card of cards) {
    const p = card.params;
    // uppercase variant
    if (p.has_upper && p.upper_strokes) {
      const options = buildMatchOptions(card, "upper", cards, concepts, 4);
      tasks.push({
        type: "match_print_to_written",
        stimulus: { printed: p.printed_upper, letterCase: "upper" },
        options,
      });
    }
    // lowercase variant
    {
      const options = buildMatchOptions(card, "lower", cards, concepts, 4);
      tasks.push({
        type: "match_print_to_written",
        stimulus: { printed: p.printed_lower, letterCase: "lower" },
        options,
      });
    }
  }
  return shuffle(tasks);
}

function generateMatchWrittenToPrintTasks(cards) {
  const concepts = toConcepts(cards);
  const tasks = [];
  for (const card of cards) {
    const p = card.params;
    if (p.has_upper && p.upper_strokes) {
      const distractorIds = selectDistractorConceptIds(card.conceptId ?? card.id, concepts, 3, "medium");
      const distractors   = distractorIds.map((cid) => {
        const dc = cards.find((c) => (c.conceptId ?? c.id) === cid);
        return dc ? { id: cid, printed: dc.params.printed_upper ?? dc.params.printed_lower, letterCase: "upper", isTarget: false } : null;
      }).filter(Boolean);
      tasks.push({
        type: "match_written_to_print",
        stimulus: { viewBox: p.upper_viewBox, strokes: p.upper_strokes, letterCase: "upper" },
        options: shuffle([{ id: card.conceptId ?? card.id, printed: p.printed_upper, letterCase: "upper", isTarget: true }, ...distractors]),
      });
    }
    {
      const distractorIds = selectDistractorConceptIds(card.conceptId ?? card.id, concepts, 3, "medium");
      const distractors   = distractorIds.map((cid) => {
        const dc = cards.find((c) => (c.conceptId ?? c.id) === cid);
        return dc ? { id: cid, printed: dc.params.printed_lower, letterCase: "lower", isTarget: false } : null;
      }).filter(Boolean);
      tasks.push({
        type: "match_written_to_print",
        stimulus: { viewBox: p.lower_viewBox, strokes: p.lower_strokes, letterCase: "lower" },
        options: shuffle([{ id: card.conceptId ?? card.id, printed: p.printed_lower, letterCase: "lower", isTarget: true }, ...distractors]),
      });
    }
  }
  return shuffle(tasks);
}

function generateMatchPairTasks(cards) {
  const withUpper   = cards.filter((c) => c.params?.has_upper && c.params?.upper_strokes);
  const lowerCards  = cards;
  const concepts    = toConcepts(lowerCards);
  const tasks = [];
  for (const card of withUpper) {
    const p = card.params;
    const distractorIds = selectDistractorConceptIds(card.conceptId ?? card.id, concepts, 3, "medium");
    const distractors   = distractorIds.map((cid) => {
      const dc = lowerCards.find((c) => (c.conceptId ?? c.id) === cid);
      if (!dc) return null;
      return { id: cid, viewBox: dc.params.lower_viewBox, strokes: dc.params.lower_strokes, isTarget: false };
    }).filter(Boolean);
    tasks.push({
      type: "match_pair",
      stimulus: { viewBox: p.upper_viewBox, strokes: p.upper_strokes, printed: p.printed_upper },
      options: shuffle([{ id: card.conceptId ?? card.id, viewBox: p.lower_viewBox, strokes: p.lower_strokes, isTarget: true }, ...distractors]),
    });
  }
  return shuffle(tasks);
}

export function generateTasks(modeType, cards) {
  switch (modeType) {
    case "sort_case":              return generateSortTasks(cards);
    case "match_print_to_written": return generateMatchPrintToWrittenTasks(cards);
    case "match_written_to_print": return generateMatchWrittenToPrintTasks(cards);
    case "match_pair":             return generateMatchPairTasks(cards);
    default: return [];
  }
}
```

- [ ] **Step 4: Запустить tests — ожидание PASS**

```bash
npx vitest run src/topics/renderers/written_letters/engine.test.js
```

Ожидание: все тесты `PASS`.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/written_letters/engine.js src/topics/renderers/written_letters/engine.test.js
git commit -m "feat(written-letters): engine.js — generateTasks for all 5 modes"
```

---

## Task 3: MatchView

**Files:**
- Create: `src/topics/renderers/written_letters/MatchView.jsx`

**Interfaces:**
- Consumes: `task` (type = `match_print_to_written` | `match_written_to_print` | `match_pair`)
- Consumes: `onAdvance`, `onCorrect`, `onMistake`

- [ ] **Step 1: Создать MatchView**

```jsx
// src/topics/renderers/written_letters/MatchView.jsx
import { useState, useCallback } from "react";
import LetterSvg     from "./LetterSvg";
import PrintedLetter from "./PrintedLetter";

const OPTION_SIZE   = 80;
const STIMULUS_SIZE = 140;

function Stimulus({ task }) {
  if (task.type === "match_print_to_written") {
    return (
      <div className="wl-stimulus">
        <PrintedLetter letter={task.stimulus.printed} size={STIMULUS_SIZE} />
      </div>
    );
  }
  // match_written_to_print or match_pair — show SVG
  return (
    <div className="wl-stimulus">
      <div className="wl-letter-card">
        <LetterSvg
          viewBox={task.stimulus.viewBox}
          strokes={task.stimulus.strokes}
          size={STIMULUS_SIZE}
          showLines
        />
      </div>
    </div>
  );
}

function Option({ opt, state, onTap }) {
  const cls = [
    "wl-option",
    state === "correct"  ? "wl-option--correct"  : "",
    state === "wrong"    ? "wl-option--wrong"     : "",
    state ? "wl-option--disabled" : "",
  ].filter(Boolean).join(" ");

  const inner = opt.strokes
    ? <LetterSvg viewBox={opt.viewBox} strokes={opt.strokes} size={OPTION_SIZE} showLines />
    : <PrintedLetter letter={opt.printed} size={OPTION_SIZE * 0.7} />;

  return (
    <button className={cls} onClick={onTap} type="button">
      {inner}
    </button>
  );
}

export default function MatchView({ task, onAdvance, onCorrect, onMistake }) {
  const [states, setStates] = useState({});
  const [done,   setDone]   = useState(false);

  const handleTap = useCallback((opt, idx) => {
    if (done) return;
    if (opt.isTarget) {
      setStates((s) => ({ ...s, [idx]: "correct" }));
      setDone(true);
      onCorrect?.(task.stimulus?.printed ?? "?", task.stimulus?.printed ?? "?");
      setTimeout(() => onAdvance?.(), 700);
    } else {
      setStates((s) => ({ ...s, [idx]: "wrong" }));
      onMistake?.(task.stimulus?.printed ?? "?", task.stimulus?.printed ?? "?");
      setTimeout(() => setStates((s) => ({ ...s, [idx]: null })), 800);
    }
  }, [done, task, onAdvance, onCorrect, onMistake]);

  return (
    <div className="wl-screen">
      <Stimulus task={task} />
      <div className="wl-options">
        {(task.options ?? []).map((opt, i) => (
          <Option
            key={opt.id + i}
            opt={opt}
            state={states[i] ?? null}
            onTap={() => handleTap(opt, i)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- --quiet
```

Ожидание: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/written_letters/MatchView.jsx
git commit -m "feat(written-letters): MatchView — 2x2 grid for match modes"
```

---

## Task 4: SortCaseView

**Files:**
- Create: `src/topics/renderers/written_letters/SortCaseView.jsx`

**Interfaces:**
- Consumes: `task` (type = `sort_case`)
- Consumes: `onAdvance`, `onCorrect`, `onMistake`

- [ ] **Step 1: Создать SortCaseView**

```jsx
// src/topics/renderers/written_letters/SortCaseView.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import LetterSvg from "./LetterSvg";

const ZONE_DEFS = [
  { id: "upper", label: "Заглавные", color: "#6366f1" },
  { id: "lower", label: "Строчные",  color: "#0ea5e9" },
];

const CARD_SIZE = 110;

// Session-level chip store (persists across task remounts within same session)
let _chips = { key: null, list: [] };

function getChips(key) {
  if (_chips.key !== key) _chips = { key, list: [] };
  return _chips.list;
}

function pushChip(key, chip) {
  if (_chips.key !== key) _chips = { key, list: [] };
  _chips.list = [..._chips.list, chip];
  return _chips.list;
}

export default function SortCaseView({ task, onAdvance, onCorrect, onMistake }) {
  const { viewBox, strokes, correctZone, sessionKey } = task;

  const chips       = getChips(sessionKey);
  const [dragPos,   setDragPos]   = useState(null);
  const [hovered,   setHovered]   = useState(null);
  const [shaking,   setShaking]   = useState(false);

  const screenRef    = useRef(null);
  const zoneRefs     = useRef({});
  const pointerIdRef = useRef(null);

  useEffect(() => {
    setDragPos(null);
    setHovered(null);
    setShaking(false);
  }, [task]);

  function detectZone(x, y) {
    for (const [id, el] of Object.entries(zoneRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    try { screenRef.current?.setPointerCapture(e.pointerId); } catch {}
    pointerIdRef.current = e.pointerId;
    setDragPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragPos || e.pointerId !== pointerIdRef.current) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    setHovered(detectZone(e.clientX, e.clientY));
  }, [dragPos]);

  const handlePointerEnd = useCallback((e) => {
    if (e.pointerId !== pointerIdRef.current) return;
    if (!dragPos) { setDragPos(null); return; }
    const zone = detectZone(e.clientX, e.clientY);
    setDragPos(null);
    setHovered(null);
    pointerIdRef.current = null;
    if (!zone) return;
    if (zone === correctZone) {
      pushChip(sessionKey, { zone, printed: task.printed });
      onCorrect?.(task.printed, task.printed);
      onAdvance?.();
    } else {
      setShaking(true);
      onMistake?.(task.printed, task.printed);
      setTimeout(() => setShaking(false), 500);
    }
  }, [dragPos, correctZone, sessionKey, task.printed, onCorrect, onMistake, onAdvance]);

  return (
    <div
      ref={screenRef}
      className="wl-screen"
      style={{ touchAction: "none" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div className="wl-dock">
        {!dragPos && (
          <div
            className={`wl-drag-card wl-letter-card${shaking ? " wl-drag-card--shake" : ""}`}
            onPointerDown={handlePointerDown}
            style={{ cursor: "grab" }}
          >
            <LetterSvg viewBox={viewBox} strokes={strokes} size={CARD_SIZE} showLines />
          </div>
        )}
      </div>

      <div className="wl-zones">
        {ZONE_DEFS.map((zone) => (
          <div
            key={zone.id}
            ref={(el) => { zoneRefs.current[zone.id] = el; }}
            className={`wl-zone${hovered === zone.id ? " wl-zone--active" : ""}`}
            style={{ "--zone-color": zone.color }}
          >
            <span className="wl-zone-label">{zone.label}</span>
            <div className="wl-zone-chips">
              {chips.filter((c) => c.zone === zone.id).map((c, i) => (
                <div key={i} className="wl-zone-chip">
                  <LetterSvg
                    viewBox={viewBox}
                    strokes={strokes}
                    size={34}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {dragPos && (
        <div
          className="wl-drag-card wl-drag-card--floating wl-letter-card"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          <LetterSvg viewBox={viewBox} strokes={strokes} size={CARD_SIZE} showLines />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- --quiet
```

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/written_letters/SortCaseView.jsx
git commit -m "feat(written-letters): SortCaseView — drag & drop upper/lower zones"
```

---

## Task 5: index.jsx + registry + topicLoader

**Files:**
- Create: `src/topics/renderers/written_letters/index.jsx`
- Modify: `src/topics/registry.js` (добавить строку)
- Modify: `src/topics/topicLoader.js` (добавить metadata для renderer)

**Interfaces:**
- Consumes: `{ task, onAdvance, onCorrect, onMistake }` — стандартный контракт рендерера

- [ ] **Step 1: Создать index.jsx**

```jsx
// src/topics/renderers/written_letters/index.jsx
import "./written_letters.css";
import MatchView    from "./MatchView";
import SortCaseView from "./SortCaseView";

export default function WrittenLettersRenderer({ task, onAdvance, onCorrect, onMistake }) {
  if (!task) return null;
  switch (task.type) {
    case "sort_case":
      return <SortCaseView task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
    case "match_print_to_written":
    case "match_written_to_print":
    case "match_pair":
      return <MatchView task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
    default:
      return <div style={{ padding: 24, color: "#aaa" }}>Неизвестный тип задания: {task.type}</div>;
  }
}
```

- [ ] **Step 2: Добавить в registry.js**

В файле `src/topics/registry.js` добавить после строки с `ColumnAdditionRenderer`:

```js
import WrittenLettersRenderer from "./renderers/written_letters/index.jsx";
```

И в объект `RENDERER_REGISTRY`:

```js
written_letters: WrittenLettersRenderer,
```

- [ ] **Step 3: Добавить metadata в topicLoader.js**

В `DEFAULT_TOPIC_ABOUT` добавить (после секции `column_addition`):

```js
written_letters: {
  description: "Тема тренирует распознавание рукописных букв русского алфавита: различение строчных и заглавных, соответствие печатной и письменной форм.",
  goals: [
    "Научить ребёнка различать строчные и заглавные рукописные буквы.",
    "Закрепить соответствие печатной и рукописной формы каждой буквы.",
    "Научить находить пару: заглавная рукописная ↔ строчная рукописная.",
  ],
  finalGoal: "Ребёнок уверенно узнаёт любую букву алфавита в рукописном написании и соотносит её с печатным образцом.",
  flow: [
    "Начинайте с режима «Строчная или заглавная?» — он даёт общую ориентацию.",
    "Переходите к «Найди рукописную» и «Найди печатную» для закрепления соответствий.",
    "«Найди пару» используйте для автоматизации сопоставления регистров.",
  ],
},
```

В `DEFAULT_MODE_METHODOLOGY` добавить:

```js
written_letters: {
  sort_case: {
    summary: "Сортировка рукописных букв на заглавные и строчные.",
    text: "Ребёнок видит рукописную букву и перетаскивает её в зону «Заглавные» или «Строчные».",
    goal: "Ребёнок безошибочно определяет регистр любой буквы в рукописном написании.",
  },
  match_print_to_written: {
    summary: "Поиск рукописной буквы по печатному образцу.",
    text: "Ребёнок видит печатную букву и выбирает соответствующую рукописную из четырёх вариантов.",
    goal: "Ребёнок связывает печатный образ буквы с её рукописным написанием.",
  },
  match_written_to_print: {
    summary: "Поиск печатной буквы по рукописному образцу.",
    text: "Ребёнок видит рукописную букву и выбирает соответствующую печатную из четырёх вариантов.",
    goal: "Ребёнок узнаёт рукописную букву и соотносит её с печатным образцом.",
  },
  match_pair: {
    summary: "Поиск строчной пары для заглавной рукописной буквы.",
    text: "Ребёнок видит рукописную заглавную букву и выбирает правильную строчную из четырёх рукописных вариантов.",
    goal: "Ребёнок уверенно соотносит заглавную и строчную форму одной буквы в рукописном написании.",
  },
},
```

В `DEFAULT_MODES` добавить:

```js
written_letters: [
  {
    id: "sort_case", type: "sort_case", evaluation: "auto",
    ui: { title: "Строчная или заглавная?", instruction: "Потяни букву в нужную группу",
          icon: "media/icons/sort_letters.svg" },
  },
  {
    id: "match_print_to_written", type: "match_print_to_written", evaluation: "auto",
    ui: { title: "Найди рукописную", instruction: "Нажми на рукописную букву",
          icon: "media/icons/flashcards_find_n.svg" },
    params: { repsPerConcept: { type: "number", label: { ru: "Повторений" }, default: 1, min: 1, max: 3 } },
  },
  {
    id: "match_written_to_print", type: "match_written_to_print", evaluation: "auto",
    ui: { title: "Найди печатную", instruction: "Нажми на печатную букву",
          icon: "media/icons/flashcards_find_n.svg" },
    params: { repsPerConcept: { type: "number", label: { ru: "Повторений" }, default: 1, min: 1, max: 3 } },
  },
  {
    id: "match_pair", type: "match_pair", evaluation: "auto",
    ui: { title: "Найди пару", instruction: "Нажми на строчную пару заглавной буквы",
          icon: "media/icons/flashcards_find_n.svg" },
    params: { repsPerConcept: { type: "number", label: { ru: "Повторений" }, default: 1, min: 1, max: 3 } },
  },
],
```

В `DEFAULT_META` добавить:

```js
written_letters: {
  avatar: "media/avatar.svg",
},
```

В `MODE_ICON_FALLBACKS` добавить:

```js
written_letters: {
  default: "media/icons/reading_mode.svg",
},
```

- [ ] **Step 4: Lint**

```bash
npm run lint -- --quiet
```

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/written_letters/index.jsx src/topics/registry.js src/topics/topicLoader.js
git commit -m "feat(written-letters): register renderer, add topicLoader metadata"
```

---

## Task 6: letterData.js — MVP 10 букв + builtinTopics

**Files:**
- Create: `src/topics/renderers/written_letters/letterData.js`
- Modify: `src/topics/builtinTopics.js`

**Примечание по SVG-путям:** Все пути приблизительно соответствуют рукописным прописям Нечаевой. Координатная система: baseline y=80, x-height top y=30, cap line y=10. После добавления обязательно проверить каждую букву визуально в dev-сервере через режим `sort_case` или `match_pair`.

- [ ] **Step 1: Создать letterData.js с 10 MVP буквами**

```js
// src/topics/renderers/written_letters/letterData.js
// SVG paths approximate Russian school cursive (Nechayeva/Goretsky, grade 1).
// Coordinate system: viewBox "0 0 80 100" (lowercase) / "0 0 80 120" (with descenders, uppercase)
// baseline y=80, x-height top y=30, cap line y=10
// After adding all letters: verify each one visually in dev server.

export const LETTER_DATA = [
  {
    id: "letter_а", conceptId: "letter_а", primary: true,
    params: {
      printed_upper: "А", printed_lower: "а", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 14 82 C 20 62 28 40 38 12",
        "M 38 12 C 48 40 56 62 64 82",
        "M 22 54 L 56 54",
      ],
      lower_viewBox: "0 0 80 100",
      lower_strokes: [
        "M 40 32 C 58 28 68 44 66 62 C 64 78 50 84 36 80 C 20 76 10 62 14 48 C 18 34 30 30 40 32",
        "M 66 32 L 66 82",
      ],
      tags: ["oval"],
    },
  },
  {
    id: "letter_о", conceptId: "letter_о", primary: true,
    params: {
      printed_upper: "О", printed_lower: "о", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 40 12 C 64 10 76 28 76 50 C 76 74 62 86 40 86 C 18 86 6 72 6 48 C 6 24 22 10 40 12 Z",
      ],
      lower_viewBox: "0 0 80 100",
      lower_strokes: [
        "M 40 30 C 62 28 72 46 70 62 C 68 78 54 84 40 84 C 26 84 10 74 12 58 C 14 40 24 28 40 30 Z",
      ],
      tags: ["oval"],
    },
  },
  {
    id: "letter_с", conceptId: "letter_с", primary: true,
    params: {
      printed_upper: "С", printed_lower: "с", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 74 24 C 68 10 54 6 40 8 C 20 12 6 28 8 52 C 10 74 26 88 46 86 C 60 84 72 76 74 62",
      ],
      lower_viewBox: "0 0 80 100",
      lower_strokes: [
        "M 68 44 C 64 28 50 22 38 26 C 22 30 10 46 12 62 C 14 78 28 86 44 82 C 58 78 68 68 66 58",
      ],
      tags: ["arc"],
    },
  },
  {
    id: "letter_е", conceptId: "letter_е", primary: true,
    params: {
      printed_upper: "Е", printed_lower: "е", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 68 22 C 62 10 48 8 36 10 C 18 14 6 30 8 50 C 10 70 26 84 44 86 C 60 88 70 80 72 66",
        "M 16 48 L 62 48",
      ],
      lower_viewBox: "0 0 80 100",
      lower_strokes: [
        "M 12 56 L 66 56",
        "M 66 56 C 64 40 52 28 38 28 C 22 28 10 42 12 60 C 14 76 28 84 44 82 C 58 80 66 70 66 58",
      ],
      tags: ["arc"],
    },
  },
  {
    id: "letter_и", conceptId: "letter_и", primary: true,
    params: {
      printed_upper: "И", printed_lower: "и", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 66 12 C 68 32 68 54 66 82",
        "M 66 12 C 56 34 44 56 34 70 C 26 80 16 84 14 82",
        "M 14 82 C 12 60 12 36 14 12",
      ],
      lower_viewBox: "0 0 80 100",
      lower_strokes: [
        "M 14 80 C 13 62 13 44 16 30 C 22 24 30 28 32 40 C 34 54 34 68 36 80 C 40 62 44 46 52 34 C 58 24 66 28 68 40 C 70 54 70 68 68 80",
      ],
      tags: ["arch"],
    },
  },
  {
    id: "letter_н", conceptId: "letter_н", primary: true,
    params: {
      printed_upper: "Н", printed_lower: "н", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 14 12 C 12 34 12 58 14 82",
        "M 14 48 C 28 44 52 44 66 48",
        "M 66 12 C 68 34 68 58 66 82",
      ],
      lower_viewBox: "0 0 80 100",
      lower_strokes: [
        "M 14 30 C 12 48 12 64 14 82",
        "M 14 56 C 28 52 52 52 66 56",
        "M 66 30 C 68 48 68 64 66 82",
      ],
      tags: ["arch"],
    },
  },
  {
    id: "letter_п", conceptId: "letter_п", primary: true,
    params: {
      printed_upper: "П", printed_lower: "п", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 14 82 C 12 60 12 38 14 12 C 28 10 52 10 66 12 C 68 38 68 60 66 82",
      ],
      lower_viewBox: "0 0 80 100",
      lower_strokes: [
        "M 14 82 C 12 62 12 44 14 30 C 28 26 52 26 66 30 C 68 44 68 62 66 82",
      ],
      tags: ["arch"],
    },
  },
  {
    id: "letter_р", conceptId: "letter_р", primary: true,
    params: {
      printed_upper: "Р", printed_lower: "р", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 14 12 C 12 36 12 60 14 82",
        "M 14 12 C 26 8 48 8 60 16 C 72 22 72 38 64 48 C 56 58 42 60 26 58 C 18 56 14 52 14 44",
      ],
      lower_viewBox: "0 0 80 120",
      lower_strokes: [
        "M 14 30 C 12 52 12 74 12 96 C 12 108 14 116 18 118",
        "M 14 30 C 24 22 42 20 54 28 C 66 36 68 52 62 64 C 56 76 44 80 30 78 C 20 76 14 68 14 56",
      ],
      tags: ["oval"],
    },
  },
  {
    id: "letter_т", conceptId: "letter_т", primary: true,
    params: {
      printed_upper: "Т", printed_lower: "т", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 8 12 C 24 8 56 8 72 12",
        "M 40 12 L 40 82",
      ],
      lower_viewBox: "0 0 80 100",
      lower_strokes: [
        "M 8 32 C 24 26 56 26 72 32",
        "M 14 82 C 12 62 12 44 14 32 C 26 36 38 36 40 32 C 42 40 42 58 40 82 C 46 62 52 46 60 34 C 66 26 72 32 72 44 C 72 60 70 72 68 82",
      ],
      tags: ["arch"],
    },
  },
  {
    id: "letter_у", conceptId: "letter_у", primary: true,
    params: {
      printed_upper: "У", printed_lower: "у", has_upper: true,
      upper_viewBox: "0 0 80 120",
      upper_strokes: [
        "M 14 12 C 24 34 34 56 40 68",
        "M 66 12 C 56 34 46 56 40 68 C 36 82 32 98 30 110 C 26 118 18 120 14 116",
      ],
      lower_viewBox: "0 0 80 120",
      lower_strokes: [
        "M 14 80 C 12 62 12 44 16 30 C 22 22 30 26 32 40 C 34 54 34 70 36 80 C 42 62 48 46 56 34 C 64 24 72 28 72 44 C 72 64 68 90 60 106 C 54 118 44 122 36 116",
      ],
      tags: ["arch"],
    },
  },
];
```

- [ ] **Step 2: Добавить тему в builtinTopics.js**

В файле `src/topics/builtinTopics.js` добавить импорт и запись в массив:

```js
import { LETTER_DATA } from "./renderers/written_letters/letterData.js";
```

В массив `BUILTIN_TOPICS` добавить (перед `streak_tracker`):

```js
{
  meta: {
    id: "written_letters",
    renderer: "written_letters",
    version: "1.0.0",
    title: { ru: "Письменные буквы" },
    avatar: "media/avatar.svg",
    builtin: true,
    about: {
      description: "Тема тренирует распознавание рукописных букв русского алфавита: строчные и заглавные, соответствие печатной и письменной форм.",
      goals: [
        "Научить ребёнка различать строчные и заглавные рукописные буквы.",
        "Закрепить соответствие печатной и рукописной формы каждой буквы.",
        "Научить находить пару: заглавная рукописная ↔ строчная рукописная.",
      ],
      finalGoal: "Ребёнок уверенно узнаёт любую букву алфавита в рукописном написании и соотносит её с печатным образцом.",
      flow: [
        "Начинайте с режима «Строчная или заглавная?».",
        "Переходите к «Найди рукописную» / «Найди печатную» для закрепления.",
        "«Найди пару» — завершающий режим для автоматизации.",
      ],
    },
  },
  modes: [
    {
      id: "sort_case", type: "sort_case", evaluation: "auto",
      ui: { title: { ru: "Строчная или заглавная?" }, instruction: { ru: "Потяни букву в нужную группу" }, icon: "media/icons/sort_letters.svg" },
    },
    {
      id: "match_print_to_written", type: "match_print_to_written", evaluation: "auto",
      ui: { title: { ru: "Найди рукописную" }, instruction: { ru: "Нажми на рукописную букву" }, icon: "media/icons/flashcards_find_n.svg" },
      params: { repsPerConcept: { type: "number", label: { ru: "Повторений" }, default: 1, min: 1, max: 3 } },
    },
    {
      id: "match_written_to_print", type: "match_written_to_print", evaluation: "auto",
      ui: { title: { ru: "Найди печатную" }, instruction: { ru: "Нажми на печатную букву" }, icon: "media/icons/flashcards_find_n.svg" },
      params: { repsPerConcept: { type: "number", label: { ru: "Повторений" }, default: 1, min: 1, max: 3 } },
    },
    {
      id: "match_pair", type: "match_pair", evaluation: "auto",
      ui: { title: { ru: "Найди пару" }, instruction: { ru: "Нажми на строчную пару" }, icon: "media/icons/flashcards_find_n.svg" },
    },
  ],
  cards: LETTER_DATA,
  installedAt: "builtin",
},
```

- [ ] **Step 3: Запустить все тесты**

```bash
npx vitest run
```

Ожидание: все тесты PASS.

- [ ] **Step 4: Визуальная проверка букв**

```bash
npm run dev
```

1. Открыть `http://localhost:8080`
2. Найти тему «Письменные буквы»
3. Войти в режим «Строчная или заглавная?» — проверить каждую из 10 букв (строчная и заглавная)
4. Войти в режим «Найди пару» — проверить все 10 букв
5. Для каждой буквы убедиться: форма узнаваема, похожа на школьные прописи, нет артефактов (пересечений, заходов за viewBox)
6. Если буква выглядит неправильно — скорректировать путь в `letterData.js` и перезагрузить

**Чеклист проверки каждой буквы:**
- [ ] а / А
- [ ] о / О  
- [ ] с / С
- [ ] е / Е
- [ ] и / И
- [ ] н / Н
- [ ] п / П
- [ ] р / Р
- [ ] т / Т
- [ ] у / У

- [ ] **Step 5: Commit после визуальной проверки**

```bash
git add src/topics/renderers/written_letters/letterData.js src/topics/builtinTopics.js
git commit -m "feat(written-letters): MVP letter data — 10 letters verified"
```

---

## Task 7: Полные данные — оставшиеся 23 буквы

**Files:**
- Modify: `src/topics/renderers/written_letters/letterData.js` (добавить 23 буквы)

Добавить в `LETTER_DATA` следующие буквы. Координатная система та же.

Буквы с `has_upper: false`: **ъ, ь, ы** — только `lower_strokes`, `upper_strokes: null`.

Все пути нужно создать по образцу прописей (Нечаева/Горецкий) и визуально проверить в dev-сервере.

- [ ] **Step 1: Добавить буквы б, в, г, д, ж, з, к, л, м**

```js
// Добавить в массив LETTER_DATA в letterData.js:
{
  id: "letter_б", conceptId: "letter_б", primary: true,
  params: {
    printed_upper: "Б", printed_lower: "б", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 66 12 L 14 12",
      "M 14 12 L 14 82",
      "M 14 48 C 28 42 54 42 66 52 C 74 62 70 78 58 82 C 44 86 24 84 14 76",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 52 30 L 14 30",
      "M 14 30 L 14 82",
      "M 14 56 C 26 50 52 50 64 58 C 72 66 68 80 56 84 C 42 88 22 84 14 76",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_в", conceptId: "letter_в", primary: true,
  params: {
    printed_upper: "В", printed_lower: "в", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 12 L 14 82",
      "M 14 12 C 42 10 66 18 66 36 C 66 50 44 52 14 52",
      "M 14 52 C 46 52 72 60 72 72 C 72 88 46 86 14 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 30 L 14 82",
      "M 14 30 C 36 28 58 34 58 48 C 58 58 38 60 14 60",
      "M 14 60 C 40 60 66 66 66 75 C 66 86 40 86 14 82",
    ],
    tags: ["oval"],
  },
},
{
  id: "letter_г", conceptId: "letter_г", primary: true,
  params: {
    printed_upper: "Г", printed_lower: "г", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 12 L 66 12",
      "M 14 12 L 14 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 30 L 58 30",
      "M 14 30 L 14 82",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_д", conceptId: "letter_д", primary: true,
  params: {
    printed_upper: "Д", printed_lower: "д", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 12 C 18 40 22 62 24 82 L 56 82 C 58 62 62 40 66 12",
      "M 14 12 L 66 12",
      "M 20 82 L 20 96 C 20 98 18 100 16 100",
      "M 60 82 L 60 96 C 60 98 62 100 64 100",
    ],
    lower_viewBox: "0 0 80 120",
    lower_strokes: [
      "M 14 30 C 18 50 22 66 24 82 L 56 82 C 58 66 62 50 66 30",
      "M 14 30 L 66 30",
      "M 20 82 L 20 96 C 20 100 18 102 14 104",
      "M 60 82 L 60 96 C 60 100 62 102 66 104",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_ж", conceptId: "letter_ж", primary: true,
  params: {
    printed_upper: "Ж", printed_lower: "ж", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 40 12 L 40 82",
      "M 16 12 L 40 48 L 16 82",
      "M 64 12 L 40 48 L 64 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 40 30 L 40 82",
      "M 16 30 L 40 56 L 16 82",
      "M 64 30 L 40 56 L 64 82",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_з", conceptId: "letter_з", primary: true,
  params: {
    printed_upper: "З", printed_lower: "з", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 14 C 28 8 56 8 68 22 C 76 32 68 46 50 48",
      "M 50 48 C 70 50 78 64 70 76 C 60 88 30 90 12 84",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 32 C 24 26 52 24 62 36 C 68 46 60 56 46 58",
      "M 46 58 C 62 60 70 70 64 78 C 56 88 28 88 12 82",
    ],
    tags: ["arc"],
  },
},
{
  id: "letter_к", conceptId: "letter_к", primary: true,
  params: {
    printed_upper: "К", printed_lower: "к", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 12 L 14 82",
      "M 62 12 L 14 48",
      "M 14 48 L 62 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 30 L 14 82",
      "M 60 30 L 14 56",
      "M 14 56 L 60 82",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_л", conceptId: "letter_л", primary: true,
  params: {
    printed_upper: "Л", printed_lower: "л", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 54 12 L 20 82",
      "M 54 12 L 66 12 L 66 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 48 30 L 16 82",
      "M 48 30 L 64 30 L 64 82",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_м", conceptId: "letter_м", primary: true,
  params: {
    printed_upper: "М", printed_lower: "м", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 12 82 L 12 12",
      "M 12 12 L 40 54 L 68 12",
      "M 68 12 L 68 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 12 82 C 12 62 12 44 14 30 C 22 28 30 30 32 42 C 34 56 34 70 36 82 C 40 62 44 46 52 34 C 58 26 64 30 66 42 C 68 56 68 70 66 82",
    ],
    tags: ["arch"],
  },
},
```

- [ ] **Step 2: Добавить буквы ф, х, ц, ч, ш, щ, э, ю, я**

```js
{
  id: "letter_ф", conceptId: "letter_ф", primary: true,
  params: {
    printed_upper: "Ф", printed_lower: "ф", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 40 12 L 40 82",
      "M 40 28 C 16 28 6 40 8 54 C 10 68 24 76 40 76 C 56 76 72 68 72 54 C 72 40 62 28 40 28",
    ],
    lower_viewBox: "0 0 80 120",
    lower_strokes: [
      "M 40 18 L 40 104",
      "M 40 32 C 20 32 10 44 12 56 C 14 70 26 78 40 78 C 54 78 68 70 68 56 C 68 44 58 32 40 32",
    ],
    tags: ["oval"],
  },
},
{
  id: "letter_х", conceptId: "letter_х", primary: true,
  params: {
    printed_upper: "Х", printed_lower: "х", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 12 C 28 32 38 52 40 82",
      "M 66 12 C 52 32 42 52 40 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 30 C 26 46 36 62 40 82",
      "M 66 30 C 54 46 44 62 40 82",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_ц", conceptId: "letter_ц", primary: true,
  params: {
    printed_upper: "Ц", printed_lower: "ц", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 82 C 12 60 12 38 14 12 C 28 10 52 10 66 12 C 68 38 68 60 66 82",
      "M 66 82 L 72 82 L 72 94",
    ],
    lower_viewBox: "0 0 80 120",
    lower_strokes: [
      "M 14 82 C 12 62 12 44 14 30 C 28 26 52 26 66 30 C 68 44 68 62 66 82",
      "M 66 82 L 72 82 L 72 96",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_ч", conceptId: "letter_ч", primary: true,
  params: {
    printed_upper: "Ч", printed_lower: "ч", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 12 C 14 12 60 12 62 36 C 64 54 44 60 14 62",
      "M 62 12 L 62 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 30 C 14 30 56 30 58 48 C 60 62 42 66 14 66",
      "M 58 30 L 58 82",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_ш", conceptId: "letter_ш", primary: true,
  params: {
    printed_upper: "Ш", printed_lower: "ш", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 82 C 12 60 12 38 14 12 C 24 10 36 10 40 12 C 42 38 42 60 40 82 C 50 60 52 38 52 12 C 62 10 72 10 66 12 C 68 38 68 60 66 82",
      "M 14 82 L 66 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 82 C 12 62 12 44 14 30 C 22 26 32 26 36 30 C 38 44 38 62 36 82 C 44 62 46 44 48 30 C 56 26 66 26 66 30 C 68 44 68 62 66 82",
      "M 14 82 L 66 82",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_щ", conceptId: "letter_щ", primary: true,
  params: {
    printed_upper: "Щ", printed_lower: "щ", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 82 C 12 60 12 38 14 12 C 24 10 34 10 38 12 C 40 38 40 60 38 82 C 46 60 48 38 48 12 C 58 10 64 10 62 12 C 64 38 64 60 62 82",
      "M 14 82 L 62 82",
      "M 62 82 L 68 82 L 68 94",
    ],
    lower_viewBox: "0 0 80 120",
    lower_strokes: [
      "M 14 82 C 12 62 12 44 14 30 C 22 26 30 26 34 30 C 36 44 36 62 34 82 C 40 62 42 44 44 30 C 52 26 60 26 60 30 C 62 44 62 62 60 82",
      "M 14 82 L 60 82",
      "M 60 82 L 66 82 L 66 96",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_э", conceptId: "letter_э", primary: true,
  params: {
    printed_upper: "Э", printed_lower: "э", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 22 C 24 10 46 8 62 14 C 76 20 76 36 62 46",
      "M 62 46 C 76 56 78 72 66 80 C 52 90 24 92 10 82",
      "M 22 46 L 62 46",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 36 C 22 26 44 24 58 32 C 68 38 66 50 54 56",
      "M 54 56 C 68 62 70 74 60 80 C 46 88 22 88 12 80",
      "M 20 56 L 54 56",
    ],
    tags: ["arc"],
  },
},
{
  id: "letter_ю", conceptId: "letter_ю", primary: true,
  params: {
    printed_upper: "Ю", printed_lower: "ю", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 14 12 L 14 82",
      "M 14 48 L 32 48",
      "M 32 12 C 56 10 72 26 70 48 C 68 70 52 86 32 82 C 24 80 16 74 14 66",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 30 L 14 82",
      "M 14 56 L 28 56",
      "M 28 30 C 52 28 68 44 66 62 C 64 78 50 86 30 84 C 22 82 16 76 14 70",
    ],
    tags: ["oval"],
  },
},
{
  id: "letter_я", conceptId: "letter_я", primary: true,
  params: {
    printed_upper: "Я", printed_lower: "я", has_upper: true,
    upper_viewBox: "0 0 80 120",
    upper_strokes: [
      "M 66 12 C 66 12 18 12 16 36 C 14 52 34 58 66 60",
      "M 66 12 L 66 82",
      "M 16 60 L 16 82",
    ],
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 64 30 C 64 30 16 30 14 48 C 12 60 28 66 64 66",
      "M 64 30 L 64 82",
      "M 14 66 L 14 82",
    ],
    tags: ["arch"],
  },
},
```

- [ ] **Step 3: Добавить буквы ъ, ь, ы (без заглавных)**

```js
{
  id: "letter_ъ", conceptId: "letter_ъ", primary: true,
  params: {
    printed_upper: null, printed_lower: "ъ", has_upper: false,
    upper_viewBox: null, upper_strokes: null,
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 30 L 14 82",
      "M 14 48 C 26 42 52 42 64 50 C 70 58 68 72 58 78 C 46 86 22 86 14 78",
      "M 8 30 L 30 30",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_ь", conceptId: "letter_ь", primary: true,
  params: {
    printed_upper: null, printed_lower: "ь", has_upper: false,
    upper_viewBox: null, upper_strokes: null,
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 30 L 14 82",
      "M 14 54 C 26 48 52 48 64 56 C 70 64 68 76 58 82 C 46 88 22 86 14 78",
    ],
    tags: ["arch"],
  },
},
{
  id: "letter_ы", conceptId: "letter_ы", primary: true,
  params: {
    printed_upper: null, printed_lower: "ы", has_upper: false,
    upper_viewBox: null, upper_strokes: null,
    lower_viewBox: "0 0 80 100",
    lower_strokes: [
      "M 14 30 L 14 82",
      "M 14 54 C 22 48 42 48 52 56 C 58 64 56 76 46 82 C 36 88 18 86 14 78",
      "M 60 30 L 60 82",
    ],
    tags: ["arch"],
  },
},
```

- [ ] **Step 4: Запустить все тесты**

```bash
npx vitest run
```

Ожидание: все PASS.

- [ ] **Step 5: Визуальная проверка всех 23 новых букв в dev-сервере**

```bash
npm run dev
```

Проверить в режиме `sort_case` каждую из 23 новых букв (строчная и заглавная, где применимо). Для ъ, ь, ы — только строчные.

Чеклист:
- [ ] б/Б  - [ ] в/В  - [ ] г/Г  - [ ] д/Д  - [ ] ж/Ж
- [ ] з/З  - [ ] к/К  - [ ] л/Л  - [ ] м/М  - [ ] ф/Ф
- [ ] х/Х  - [ ] ц/Ц  - [ ] ч/Ч  - [ ] ш/Ш  - [ ] щ/Щ
- [ ] э/Э  - [ ] ю/Ю  - [ ] я/Я  - [ ] ъ    - [ ] ь  - [ ] ы

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/written_letters/letterData.js
git commit -m "feat(written-letters): complete Russian alphabet — 33 letters, 63 forms"
```

---

## Финальная проверка

- [ ] `npx vitest run` — все тесты PASS
- [ ] `npm run lint -- --quiet` — 0 ошибок
- [ ] `npm run build` — сборка без ошибок
- [ ] Открыть все 4 режима в dev-сервере, пройти по 3–5 букв в каждом
- [ ] Убедиться что ъ, ь, ы не появляются в режиме `sort_case` как заглавные и отсутствуют в `match_pair`
