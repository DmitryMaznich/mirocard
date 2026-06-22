# Column Addition/Subtraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Новая тема `column_addition` — тренажёр сложения и вычитания в столбик с UX «клеточной тетради» и перетаскиванием цифр.

**Architecture:** Отдельный renderer `column_addition` (index.jsx + engine.js) регистрируется в registry.js и topicLoader.js. Один режим `column_arithmetic` с параметрами operation/carryMode/digits. Drag & drop с pointer events, управляемый порядок шагов (справа налево).

**Tech Stack:** React (JSX), Vite, Vitest, CSS (linear-gradient для сетки тетради), Pointer Events API.

## Global Constraints

- Renderer folder: `src/topics/renderers/column_addition/`
- Следовать паттерну engine.js существующего addition_subtraction renderer
- Pointer events (не mouse/touch), как в существующем bead stick
- carryMode param: `"none"` | `"carry"` | `"mixed"` (одинаково для сложения и вычитания)
- digits: 2 | 3 (числа в двузначном или трёхзначном диапазоне)
- Результат с digits=2 всегда остаётся двузначным (генератор это гарантирует)
- top > bottom всегда для вычитания

---

## File Map

| Файл | Статус | Ответственность |
|------|--------|----------------|
| `src/topics/renderers/column_addition/engine.js` | Создать | Генерация задач, вся логика столбика |
| `src/topics/renderers/column_addition/engine.test.js` | Создать | Vitest-тесты для engine |
| `src/topics/renderers/column_addition/index.jsx` | Создать | React-рендерер: сетка, drag&drop, визуал |
| `src/topics/renderers/column_addition/column_addition.css` | Создать | Стили тетради, ячеек, лотка, floating digit |
| `src/topics/registry.js` | Изменить | Добавить `column_addition` в RENDERER_REGISTRY |
| `src/topics/topicLoader.js` | Изменить | DEFAULT_MODES, DEFAULT_MODE_METHODOLOGY, DEFAULT_META |
| `public/column_addition_topic.json` | Создать | topic.json для установки темы |

---

### Task 1: engine.js — генерация задач (TDD)

**Files:**
- Create: `src/topics/renderers/column_addition/engine.js`
- Create: `src/topics/renderers/column_addition/engine.test.js`

**Interfaces:**
- Produces: `generateTasks(mode, cards, countOrParams, maybeParams) → Task[]`
- Task shape:
  ```js
  {
    type: "column_arithmetic",
    cardId: string, conceptId: string,
    operation: "add" | "subtract",
    digits: 2 | 3,
    top: number, bottom: number, result: number,
    columns: Column[],   // [units, tens] or [units, tens, hundreds]
    steps: Step[],       // ordered drag steps
  }
  // Column (add): { position, topDigit, bottomDigit, carryIn, carryOut, writeDigit }
  // Column (sub): { position, topDigit, bottomDigit, borrowIn, borrowOut, effectiveTopDigit, writeDigit }
  // Step: { cellType: "result"|"carry"|"borrow", position: "units"|"tens"|"hundreds", digit: number }
  ```

- [ ] **Step 1: Создать engine.test.js**

```js
// src/topics/renderers/column_addition/engine.test.js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";

const CARDS = [
  { id: "col_add", conceptId: "col_add", renderer: "column_addition", params: { operation: "add" } },
  { id: "col_sub", conceptId: "col_sub", renderer: "column_addition", params: { operation: "subtract" } },
];

function posDigit(n, pos) {
  if (pos === "units")   return n % 10;
  if (pos === "tens")    return Math.floor(n / 10) % 10;
  return Math.floor(n / 100) % 10;
}

describe("generateTasks – column_arithmetic", () => {
  it("returns requested count", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 10, { operation: "add", carryMode: "none", digits: 2 });
    expect(tasks).toHaveLength(10);
  });

  it("add/none: no carry in any column", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode: "none", digits: 2 });
    for (const t of tasks) {
      expect(t.columns.every(c => c.carryOut === 0)).toBe(true);
    }
  });

  it("add/carry: at least one column has carry", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode: "carry", digits: 2 });
    for (const t of tasks) {
      expect(t.columns.some(c => c.carryOut > 0)).toBe(true);
    }
  });

  it("subtract/none: no borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "none", digits: 2 });
    for (const t of tasks) {
      expect(t.columns.every(c => c.borrowOut === 0)).toBe(true);
    }
  });

  it("subtract/carry: at least one borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "carry", digits: 2 });
    for (const t of tasks) {
      expect(t.columns.some(c => c.borrowOut > 0)).toBe(true);
    }
  });

  it("result = top + bottom for add", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "add", carryMode: "mixed", digits: 2 });
    for (const t of tasks) expect(t.result).toBe(t.top + t.bottom);
  });

  it("result = top - bottom for subtract", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "subtract", carryMode: "mixed", digits: 2 });
    for (const t of tasks) expect(t.result).toBe(t.top - t.bottom);
  });

  it("each result step digit matches actual result digit", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "add", carryMode: "carry", digits: 2 });
    for (const t of tasks) {
      for (const step of t.steps) {
        if (step.cellType === "result") {
          expect(step.digit).toBe(posDigit(t.result, step.position));
        }
      }
    }
  });

  it("3-digit tasks have 3 columns", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 5, { operation: "add", carryMode: "none", digits: 3 });
    for (const t of tasks) expect(t.columns).toHaveLength(3);
  });

  it("mixed produces both operations", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 40, { operation: "mixed", carryMode: "none", digits: 2 });
    expect(tasks.some(t => t.operation === "add")).toBe(true);
    expect(tasks.some(t => t.operation === "subtract")).toBe(true);
  });

  it("returns empty array when no cards", () => {
    const tasks = generateTasks("column_arithmetic", [], 5, {});
    expect(tasks).toHaveLength(0);
  });

  it("sub: top > bottom always", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "mixed", digits: 2 });
    for (const t of tasks) expect(t.top).toBeGreaterThan(t.bottom);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться что падают**

```
npx vitest run src/topics/renderers/column_addition/engine.test.js
```

Ожидается: FAIL (модуль не найден).

- [ ] **Step 3: Создать engine.js**

```js
// src/topics/renderers/column_addition/engine.js

const POSITIONS = ["units", "tens", "hundreds"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDigits(n, count) {
  return Array.from({ length: count }, (_, i) => Math.floor(n / 10 ** i) % 10);
}

function buildAddColumns(top, bottom, digits) {
  const td = getDigits(top, digits);
  const bd = getDigits(bottom, digits);
  const cols = [];
  let carry = 0;
  for (let i = 0; i < digits; i++) {
    const sum = td[i] + bd[i] + carry;
    const writeDigit = sum % 10;
    const carryOut = Math.floor(sum / 10);
    cols.push({ position: POSITIONS[i], topDigit: td[i], bottomDigit: bd[i], carryIn: carry, carryOut, writeDigit });
    carry = carryOut;
  }
  return cols;
}

function buildSubColumns(top, bottom, digits) {
  const td = getDigits(top, digits);
  const bd = getDigits(bottom, digits);
  const cols = [];
  let borrow = 0;
  for (let i = 0; i < digits; i++) {
    const effective = td[i] - borrow;
    const needsBorrow = effective < bd[i];
    const borrowOut = needsBorrow ? 1 : 0;
    const effectiveTopDigit = effective + (needsBorrow ? 10 : 0);
    const writeDigit = effectiveTopDigit - bd[i];
    cols.push({ position: POSITIONS[i], topDigit: td[i], bottomDigit: bd[i], borrowIn: borrow, borrowOut, effectiveTopDigit, writeDigit });
    borrow = borrowOut;
  }
  return cols;
}

function buildAddSteps(columns) {
  const steps = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const next = columns[i + 1];
    steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
    if (col.carryOut > 0 && next) {
      steps.push({ cellType: "carry", position: next.position, digit: col.carryOut });
    }
  }
  return steps;
}

function buildSubSteps(columns) {
  const steps = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const next = columns[i + 1];
    if (col.borrowOut > 0 && next) {
      steps.push({ cellType: "borrow", position: next.position, digit: 1 });
    }
    steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
  }
  return steps;
}

function generateAddTask(carryMode, digits, card) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let top, bottom;
    if (digits === 2) {
      if (carryMode === "none") {
        const tU = randomInt(1, 8), tT = randomInt(1, 8);
        const bU = randomInt(1, 9 - tU), bT = randomInt(1, 9 - tT);
        top = tT * 10 + tU; bottom = bT * 10 + bU;
      } else if (carryMode === "carry") {
        const tU = randomInt(2, 9), bU = randomInt(10 - tU, 9);
        const tT = randomInt(1, 7), bT = randomInt(1, 8 - tT);
        top = tT * 10 + tU; bottom = bT * 10 + bU;
      } else {
        top = randomInt(11, 89); bottom = randomInt(11, 89);
      }
    } else {
      top = randomInt(101, 899); bottom = randomInt(101, 999 - top);
    }
    const columns = buildAddColumns(top, bottom, digits);
    const hasCarry = columns.some(c => c.carryOut > 0);
    if (carryMode === "none" && hasCarry) continue;
    if (carryMode === "carry" && !hasCarry) continue;
    return { type: "column_arithmetic", cardId: card.id, conceptId: card.conceptId, operation: "add", digits, top, bottom, result: top + bottom, columns, steps: buildAddSteps(columns) };
  }
  return null;
}

function generateSubTask(carryMode, digits, card) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let top, bottom;
    if (digits === 2) {
      if (carryMode === "none") {
        const bU = randomInt(1, 8), tU = randomInt(bU, 9);
        const bT = randomInt(1, 8), tT = randomInt(bT + 1, 9);
        top = tT * 10 + tU; bottom = bT * 10 + bU;
      } else if (carryMode === "carry") {
        const bU = randomInt(2, 9), tU = randomInt(1, bU - 1);
        const bT = randomInt(1, 7), tT = randomInt(bT + 1, 9);
        top = tT * 10 + tU; bottom = bT * 10 + bU;
      } else {
        top = randomInt(21, 99); bottom = randomInt(11, top - 10);
      }
    } else {
      top = randomInt(201, 999); bottom = randomInt(101, top - 100);
    }
    const columns = buildSubColumns(top, bottom, digits);
    const hasBorrow = columns.some(c => c.borrowOut > 0);
    if (carryMode === "none" && hasBorrow) continue;
    if (carryMode === "carry" && !hasBorrow) continue;
    return { type: "column_arithmetic", cardId: card.id, conceptId: card.conceptId, operation: "subtract", digits, top, bottom, result: top - bottom, columns, steps: buildSubSteps(columns) };
  }
  return null;
}

export function generateTasks(mode, cards, countOrParams, maybeParams) {
  const count = typeof countOrParams === "number" ? countOrParams : 15;
  const params = (countOrParams && typeof countOrParams === "object") ? countOrParams
    : (maybeParams && typeof maybeParams === "object") ? maybeParams : {};

  const operation = params.operation ?? "add";
  const carryMode = params.carryMode ?? "none";
  const digits = Number(params.digits ?? 2);

  const allCards = cards.filter(c => c.renderer === "column_addition");
  if (!allCards.length) return [];

  const pool = operation === "mixed" ? allCards
    : (allCards.filter(c => (c.params?.operation ?? "add") === operation) || allCards);
  const activePool = pool.length ? pool : allCards;

  const tasks = [];
  let idx = 0, attempts = 0;

  while (tasks.length < count && attempts < count * 20) {
    attempts++;
    const card = activePool[idx % activePool.length];
    const op = operation === "mixed" ? (Math.random() < 0.5 ? "add" : "subtract") : operation;
    const task = op === "add" ? generateAddTask(carryMode, digits, card) : generateSubTask(carryMode, digits, card);
    if (task) { tasks.push(task); idx++; }
  }

  return tasks;
}
```

- [ ] **Step 4: Запустить тесты — убедиться что проходят**

```
npx vitest run src/topics/renderers/column_addition/engine.test.js
```

Ожидается: все PASS.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/column_addition/engine.js src/topics/renderers/column_addition/engine.test.js
git commit -m "feat(column-addition): engine — task generator with tests"
```

---

### Task 2: CSS + статический рендерер (без drag)

**Files:**
- Create: `src/topics/renderers/column_addition/column_addition.css`
- Create: `src/topics/renderers/column_addition/index.jsx`

**Interfaces:**
- Consumes: `Task` из Task 1
- Produces: `default export ColumnAdditionRenderer({ task, onCorrect, onIncorrect, onMistake })`

- [ ] **Step 1: Создать column_addition.css**

```css
/* src/topics/renderers/column_addition/column_addition.css */

.col-screen {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #f8faff;
  background-image:
    linear-gradient(rgba(160, 200, 255, 0.45) 1px, transparent 1px),
    linear-gradient(90deg, rgba(160, 200, 255, 0.45) 1px, transparent 1px);
  background-size: 44px 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 36px;
  touch-action: none;
  user-select: none;
  overflow: hidden;
}

/* ── Problem grid ───────────────────────────── */

.col-problem {
  display: grid;
  /* columns set via inline style: --col-count */
  grid-template-rows: 28px 52px 52px 6px 52px;
  align-items: center;
  justify-items: center;
  gap: 0;
}

/* ── Digit cells ───────────────────────────── */

.col-digit {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-family: 'Courier New', Courier, monospace;
  font-weight: 700;
  color: #1a1a2e;
  position: relative;
}

.col-digit--sign {
  color: #1a1a2e;
  font-size: 28px;
}

.col-digit--top-borrowed {
  text-decoration: line-through;
  text-decoration-color: #ef4444;
  color: #9ca3af;
}

.col-digit-adjusted {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
  line-height: 1;
}

/* effective units label shown in carry row after borrow */
.col-effective-label {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
  font-family: 'Courier New', monospace;
}

/* ── Horizontal line ───────────────────────── */

.col-line {
  height: 3px;
  background: #1a1a2e;
  border-radius: 2px;
  grid-column: 1 / -1;
  width: 100%;
  align-self: center;
}

/* ── Carry / borrow aux cells ──────────────── */

.col-carry-cell {
  width: 28px;
  height: 26px;
  border: 1.5px dashed #f59e0b;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #92400e;
  background: transparent;
  font-family: 'Courier New', monospace;
}

.col-carry-cell--active {
  border-color: #f59e0b;
  border-style: solid;
  background: #fef9c3;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.55);
  animation: col-pulse-carry 1.1s ease-in-out infinite;
}

.col-carry-cell--filled {
  border-style: solid;
  border-color: #d97706;
  background: #fef3c7;
  color: #92400e;
}

@keyframes col-pulse-carry {
  0%, 100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.4); }
  50%       { box-shadow: 0 0 12px rgba(245, 158, 11, 0.8); }
}

/* ── Result empty cells ────────────────────── */

.col-result-cell {
  width: 40px;
  height: 40px;
  border: 2px dashed #94a3b8;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: #1a1a2e;
  background: transparent;
}

.col-result-cell--active {
  border-color: #3b82f6;
  border-style: solid;
  background: #eff6ff;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
  animation: col-pulse-result 1.1s ease-in-out infinite;
}

.col-result-cell--filled {
  border-color: #1d4ed8;
  border-style: solid;
  background: #dbeafe;
  animation: col-ink-in 0.25s ease-out;
}

.col-result-cell--shake {
  animation: col-shake 0.4s ease-in-out;
}

@keyframes col-pulse-result {
  0%, 100% { box-shadow: 0 0 6px rgba(59, 130, 246, 0.4); }
  50%       { box-shadow: 0 0 14px rgba(59, 130, 246, 0.75); }
}

@keyframes col-ink-in {
  from { transform: scale(0.7); opacity: 0.3; }
  to   { transform: scale(1);   opacity: 1; }
}

@keyframes col-shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-7px); }
  75%       { transform: translateX(7px); }
}

/* ── Digit bank ───────────────────────────── */

.col-digit-bank {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.col-bank-tile {
  width: 42px;
  height: 50px;
  border: 2px solid #3b82f6;
  border-radius: 8px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: #1e3a8a;
  cursor: grab;
  touch-action: none;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.12);
  transition: transform 0.08s, box-shadow 0.08s;
}

.col-bank-tile:active {
  cursor: grabbing;
  transform: scale(1.12);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

/* ── Floating digit (follows pointer) ─────── */

.col-floating-digit {
  position: fixed;
  transform: translate(-50%, -60%);
  pointer-events: none;
  z-index: 9999;
  width: 46px;
  height: 54px;
  border: 2px solid #3b82f6;
  border-radius: 8px;
  background: #dbeafe;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: #1e3a8a;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
}
```

- [ ] **Step 2: Создать index.jsx — статическая версия (без drag)**

```jsx
// src/topics/renderers/column_addition/index.jsx
import { useState, useRef, useCallback } from "react";
import "./column_addition.css";

const POSITIONS = ["units", "tens", "hundreds"];
const POS_INDEX = { units: 0, tens: 1, hundreds: 2 };

// gridCol = digits + 2 - positionIndex  (col 1=pad, col 2=sign, col 3..=digits right→left)
function posToGridCol(position, digits) {
  return digits + 2 - POS_INDEX[position];
}

function DigitBank({ onDragStart }) {
  return (
    <div className="col-digit-bank" aria-label="Лоток цифр">
      {Array.from({ length: 10 }, (_, d) => (
        <div
          key={d}
          className="col-bank-tile"
          onPointerDown={(e) => onDragStart(e, d)}
          aria-label={`Цифра ${d}`}
        >
          {d}
        </div>
      ))}
    </div>
  );
}

function CarryRow({ task, filledCells, currentStep, activeCellRef, shake }) {
  const digits = task.digits;

  return (
    <>
      {task.columns.map((col) => {
        const gridCol = posToGridCol(col.position, digits);

        if (task.operation === "add") {
          if (col.carryIn === 0) {
            // Check if next step is carry into this position
            const willNeedCarry = task.steps.some(s => s.cellType === "carry" && s.position === col.position);
            if (!willNeedCarry) return <div key={col.position} style={{ gridColumn: gridCol, gridRow: 1 }} />;
          }
          const key = `carry:${col.position}`;
          const filled = filledCells[key] !== undefined;
          const isActive = currentStep?.cellType === "carry" && currentStep?.position === col.position;
          return (
            <div
              key={col.position}
              style={{ gridColumn: gridCol, gridRow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <div
                ref={isActive ? activeCellRef : null}
                className={[
                  "col-carry-cell",
                  isActive ? "col-carry-cell--active" : "",
                  filled ? "col-carry-cell--filled" : "",
                  isActive && shake ? "col-result-cell--shake" : "",
                ].filter(Boolean).join(" ")}
              >
                {filled ? filledCells[key] : ""}
              </div>
            </div>
          );
        }

        // Subtraction: show borrow cell above the column that is borrowed FROM
        // (borrowIn > 0 means this col was borrowed from)
        if (col.borrowIn > 0) {
          const key = `borrow:${col.position}`;
          const filled = filledCells[key] !== undefined;
          const isActive = currentStep?.cellType === "borrow" && currentStep?.position === col.position;

          // Also show effective units value in carry row at units position after borrow
          const unitsCol = task.columns.find(c => c.position === "units");
          const showEffective = col.position === "tens" && filled && unitsCol;

          return (
            <div key={col.position} style={{ gridColumn: gridCol, gridRow: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
              <div
                ref={isActive ? activeCellRef : null}
                className={[
                  "col-carry-cell",
                  isActive ? "col-carry-cell--active" : "",
                  filled ? "col-carry-cell--filled" : "",
                  isActive && shake ? "col-result-cell--shake" : "",
                ].filter(Boolean).join(" ")}
              >
                {filled ? 1 : ""}
              </div>
            </div>
          );
        }

        // Units position in subtraction: show effectiveTopDigit after borrow is filled
        if (col.position === "units" && task.operation === "subtract") {
          const tensCol = task.columns.find(c => c.position === "tens");
          const borrowFilled = tensCol && filledCells[`borrow:tens`] !== undefined;
          if (borrowFilled && col.effectiveTopDigit !== col.topDigit) {
            return (
              <div key={col.position} style={{ gridColumn: gridCol, gridRow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="col-effective-label">{col.effectiveTopDigit}</span>
              </div>
            );
          }
        }

        return <div key={col.position} style={{ gridColumn: gridCol, gridRow: 1 }} />;
      })}
    </>
  );
}

function TopRow({ task, filledCells }) {
  const digits = task.digits;
  const topDigits = Array.from({ length: digits }, (_, i) => Math.floor(task.top / 10 ** (digits - 1 - i)) % 10);

  return (
    <>
      {task.columns.map((col, i) => {
        const gridCol = posToGridCol(col.position, digits);
        const digit = topDigits[digits - 1 - i]; // leftmost first
        // For subtraction: if this column was borrowed from (borrowIn>0), show strikethrough
        const borrowed = task.operation === "subtract" && col.borrowIn > 0 && filledCells[`borrow:${col.position}`] !== undefined;
        return (
          <div
            key={col.position}
            className={["col-digit", borrowed ? "col-digit--top-borrowed" : ""].filter(Boolean).join(" ")}
            style={{ gridColumn: gridCol, gridRow: 2 }}
          >
            {col.topDigit}
            {borrowed && (
              <span className="col-digit-adjusted">{col.effectiveTopDigit}</span>
            )}
          </div>
        );
      })}
    </>
  );
}

function BottomRow({ task }) {
  const digits = task.digits;
  const sign = task.operation === "add" ? "+" : "−";

  return (
    <>
      <div className="col-digit col-digit--sign" style={{ gridColumn: 2, gridRow: 3 }}>{sign}</div>
      {task.columns.map((col) => (
        <div key={col.position} className="col-digit" style={{ gridColumn: posToGridCol(col.position, digits), gridRow: 3 }}>
          {col.bottomDigit}
        </div>
      ))}
    </>
  );
}

function ResultRow({ task, filledCells, currentStep, activeCellRef, shake }) {
  const digits = task.digits;

  return (
    <>
      {task.columns.map((col) => {
        const gridCol = posToGridCol(col.position, digits);
        const key = `result:${col.position}`;
        const filled = filledCells[key] !== undefined;
        const isActive = currentStep?.cellType === "result" && currentStep?.position === col.position;

        return (
          <div key={col.position} style={{ gridColumn: gridCol, gridRow: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              ref={isActive ? activeCellRef : null}
              className={[
                "col-result-cell",
                isActive ? "col-result-cell--active" : "",
                filled ? "col-result-cell--filled" : "",
                isActive && shake ? "col-result-cell--shake" : "",
              ].filter(Boolean).join(" ")}
            >
              {filled ? filledCells[key] : ""}
            </div>
          </div>
        );
      })}
    </>
  );
}

function ColumnProblem({ task, filledCells, currentStep, activeCellRef, shake }) {
  const digits = task.digits;
  // Total grid cols: pad + sign + digit-columns + pad = digits + 3
  const totalCols = digits + 3;
  const colTemplate = `22px 44px ${Array(digits).fill("44px").join(" ")} 22px`;

  return (
    <div
      className="col-problem"
      style={{ gridTemplateColumns: colTemplate }}
      aria-label={`${task.top} ${task.operation === "add" ? "плюс" : "минус"} ${task.bottom}`}
    >
      <CarryRow task={task} filledCells={filledCells} currentStep={currentStep} activeCellRef={activeCellRef} shake={shake} />
      <TopRow task={task} filledCells={filledCells} />
      <BottomRow task={task} />
      <div className="col-line" style={{ gridColumn: `2 / ${totalCols}`, gridRow: 4 }} />
      <ResultRow task={task} filledCells={filledCells} currentStep={currentStep} activeCellRef={activeCellRef} shake={shake} />
    </div>
  );
}

function ColumnArithmeticTask({ task, onCorrect, onIncorrect }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [filledCells, setFilledCells] = useState({});
  const [drag, setDrag] = useState(null);
  const [shake, setShake] = useState(false);
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const activeCellRef = useRef(null);
  const shakeTimerRef = useRef(null);

  const currentStep = task.steps[stepIdx] ?? null;
  const done = stepIdx >= task.steps.length;

  const startDrag = useCallback((e, digit) => {
    if (done) return;
    e.preventDefault();
    rootRef.current?.setPointerCapture(e.pointerId);
    const d = { pointerId: e.pointerId, digit, x: e.clientX, y: e.clientY };
    dragRef.current = d;
    setDrag({ digit, x: e.clientX, y: e.clientY });
  }, [done]);

  function onPointerMove(e) {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    setDrag({ digit: dragRef.current.digit, x: e.clientX, y: e.clientY });
  }

  function onPointerUp(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    rootRef.current?.releasePointerCapture(e.pointerId);
    setDrag(null);

    if (!currentStep || done) return;

    const cell = activeCellRef.current;
    if (!cell) return;

    const rect = cell.getBoundingClientRect();
    const hit = e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top  && e.clientY <= rect.bottom;

    if (!hit) return;

    if (d.digit === currentStep.digit) {
      const key = `${currentStep.cellType}:${currentStep.position}`;
      setFilledCells(prev => ({ ...prev, [key]: d.digit }));
      const next = stepIdx + 1;
      setStepIdx(next);
      if (next >= task.steps.length) {
        setTimeout(() => onCorrect(task.conceptId, task.cardId), 350);
      }
    } else {
      clearTimeout(shakeTimerRef.current);
      setShake(true);
      shakeTimerRef.current = setTimeout(() => setShake(false), 450);
      onIncorrect?.(task.conceptId, task.cardId);
    }
  }

  function onPointerCancel(e) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      setDrag(null);
    }
  }

  return (
    <div
      ref={rootRef}
      className="col-screen"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <ColumnProblem
        task={task}
        filledCells={filledCells}
        currentStep={currentStep}
        activeCellRef={activeCellRef}
        shake={shake}
      />
      <DigitBank onDragStart={startDrag} />
      {drag && (
        <div className="col-floating-digit" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {drag.digit}
        </div>
      )}
    </div>
  );
}

export default function ColumnAdditionRenderer({ task, onCorrect, onIncorrect }) {
  if (!task) return null;
  return (
    <ColumnArithmeticTask
      key={`${task.cardId}:${task.top}:${task.bottom}:${task.operation}`}
      task={task}
      onCorrect={onCorrect}
      onIncorrect={onIncorrect}
    />
  );
}
```

- [ ] **Step 3: Проверить что проект собирается**

```
npx vite build --mode development 2>&1 | tail -20
```

Ожидается: No errors (warnings про unused imports допустимы).

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/column_addition/column_addition.css src/topics/renderers/column_addition/index.jsx
git commit -m "feat(column-addition): renderer — notebook grid UI with drag & drop"
```

---

### Task 3: Зарегистрировать renderer и создать topic.json

**Files:**
- Modify: `src/topics/registry.js`
- Modify: `src/topics/topicLoader.js`
- Create: `public/column_addition_topic.json`

**Interfaces:**
- Consumes: `ColumnAdditionRenderer` из Task 2, `generateTasks` из Task 1

- [ ] **Step 1: Добавить в registry.js**

В [src/topics/registry.js](src/topics/registry.js) добавить импорт и запись:

```js
// Добавить импорт после существующих:
import ColumnAdditionRenderer from "./renderers/column_addition/index.jsx";

// Добавить в RENDERER_REGISTRY:
column_addition: ColumnAdditionRenderer,
```

- [ ] **Step 2: Добавить в topicLoader.js**

В [src/topics/topicLoader.js](src/topics/topicLoader.js) добавить в четыре места:

**2a. В `DEFAULT_MODES` (после `operation_missing_term` блока, рядом с другими renderers):**

```js
column_addition: [
  {
    id: "column_arithmetic",
    type: "column_arithmetic",
    evaluation: "auto",
    ui: {
      title: "Столбик",
      instruction: "Перетащи цифры в нужные клетки",
      icon: "media/icons/operations_mode.svg",
    },
    params: {
      operation: {
        type: "enum",
        values: ["add", "subtract", "mixed"],
        labels: { ru: { add: "Сложение", subtract: "Вычитание", mixed: "Смешанный" } },
        default: "add",
        label: { ru: "Операция" },
      },
      carryMode: {
        type: "enum",
        values: ["none", "carry", "mixed"],
        labels: { ru: { none: "Без переноса/займа", carry: "С переносом/займом", mixed: "Смешанный" } },
        default: "none",
        label: { ru: "Перенос / заём" },
      },
      digits: {
        type: "enum",
        values: [2, 3],
        labels: { ru: { "2": "Двузначные", "3": "Трёхзначные" } },
        default: 2,
        label: { ru: "Разрядность" },
      },
    },
  },
],
```

**2b. В `DEFAULT_TOPIC_ABOUT`:**

```js
column_addition: {
  description: "Тренажёр сложения и вычитания в столбик: ребёнок перетаскивает цифры в клеточной тетради.",
  goals: [
    "Освоить процедуру сложения и вычитания по разрядам справа налево.",
    "Понять смысл переноса при сложении и займа при вычитании.",
    "Научиться самостоятельно заполнять столбик без пошаговых подсказок.",
  ],
  finalGoal: "Ребёнок уверенно решает примеры в столбик, соблюдая правильный порядок действий.",
  flow: [
    "Начинайте без переноса/займа; переходите к переносу после уверенного освоения.",
    "Трёхзначные числа вводите только после стабильных результатов на двузначных.",
  ],
},
```

**2c. В `DEFAULT_MODE_METHODOLOGY`:**

```js
column_addition: {
  column_arithmetic: {
    summary: "Сложение или вычитание двух чисел в столбик.",
    text: "Ребёнок перетаскивает цифры из лотка в пустые клетки — единицы, перенос/заём, затем десятки.",
    settings: [
      "Операция: выберите сложение, вычитание или смешанный режим.",
      "Перенос/заём: начинайте без переноса; с переносом вводите отдельно после освоения.",
      "Разрядность: двузначные числа — основной уровень для начала.",
    ],
    goal: "Ребёнок заполняет столбик в правильном порядке: единицы → перенос/заём → десятки.",
  },
},
```

**2d. В `DEFAULT_META` и `MODE_ICON_FALLBACKS`:**

```js
// В DEFAULT_META:
column_addition: {
  avatar: "media/avatar_operations.svg",
},

// В MODE_ICON_FALLBACKS:
column_addition: {
  default: "media/icons/operations_mode.svg",
},
```

- [ ] **Step 3: Создать topic.json**

```json
// public/column_addition_topic.json
{
  "meta": {
    "id": "column_addition",
    "renderer": "column_addition",
    "version": "1.0.0",
    "title": { "ru": "Сложение и вычитание в столбик" },
    "cardType": "procedural"
  },
  "cards": [
    {
      "id": "col_add",
      "conceptId": "col_add",
      "renderer": "column_addition",
      "primary": true,
      "params": { "operation": "add" }
    },
    {
      "id": "col_sub",
      "conceptId": "col_sub",
      "renderer": "column_addition",
      "primary": true,
      "params": { "operation": "subtract" }
    }
  ]
}
```

- [ ] **Step 4: Добавить engine.js в engineRegistry (если он есть)**

Проверить существует ли `src/topics/renderers/engineRegistry.js`:

```bash
cat src/topics/renderers/engineRegistry.js
```

Если существует — добавить:
```js
import { generateTasks as columnAdditionGenerateTasks } from "./column_addition/engine.js";
// и зарегистрировать: column_addition: columnAdditionGenerateTasks
```

Если файла нет — пропустить этот шаг (движок подключается иначе).

- [ ] **Step 5: Проверить сборку**

```
npx vite build --mode development 2>&1 | tail -30
```

Ожидается: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/topics/registry.js src/topics/topicLoader.js public/column_addition_topic.json
git commit -m "feat(column-addition): register renderer and topic.json"
```

---

### Task 4: Упаковать тему в ZIP и проверить установку

**Files:**
- Create: `scripts/make_column_addition_zip.mjs`

- [ ] **Step 1: Создать скрипт упаковки**

```js
// scripts/make_column_addition_zip.mjs
import JSZip from "jszip";
import { readFileSync, writeFileSync } from "fs";

const zip = new JSZip();
const json = readFileSync("public/column_addition_topic.json", "utf-8");
zip.file("topic.json", json);

const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync("public/column_addition_v1.0.0.zip", buf);
console.log("Created public/column_addition_v1.0.0.zip");
```

- [ ] **Step 2: Запустить скрипт**

```
node scripts/make_column_addition_zip.mjs
```

Ожидается: `Created public/column_addition_v1.0.0.zip`

- [ ] **Step 3: Запустить dev-сервер и установить тему вручную**

```
npx vite --port 8081
```

Открыть `http://localhost:8081`, войти в аккаунт, перейти в «Добавить тему» → загрузить `public/column_addition_v1.0.0.zip`. Убедиться что тема появилась в списке.

- [ ] **Step 4: Проверить режим в сессии**

Создать сессию с темой «Сложение и вычитание в столбик», выбрать режим «Столбик», params: operation=add, carryMode=none, digits=2. Убедиться:
- Появляется фон тетради в клетку
- Показывается столбик с двумя числами
- Внизу лоток с цифрами 0-9
- Перетащить правильную цифру в активную клетку → цифра вписывается
- Перетащить неправильную → ячейка вибрирует
- Все клетки заполнены → анимация успеха

- [ ] **Step 5: Проверить carryMode=carry для сложения**

Запустить сессию с carryMode=carry. Убедиться:
- Появляется строка переноса над десятками
- Порядок шагов: единицы → маленькая ячейка переноса → десятки
- После заполнения переноса десятки учитывают его

- [ ] **Step 6: Проверить вычитание с займом**

Запустить с operation=subtract, carryMode=carry. Убедиться:
- Первый шаг — маленькая ячейка займа над десятками
- После вписывания «1»: десяток верхнего числа получает зачёркивание + уменьшенное значение, над единицами появляется эффективное значение
- Остальные шаги работают корректно

- [ ] **Step 7: Final commit**

```bash
git add scripts/make_column_addition_zip.mjs public/column_addition_v1.0.0.zip
git commit -m "feat(column-addition): packaging script and initial ZIP"
```

---

## Self-Review

**Spec coverage:**
- ✅ Отдельная тема (column_addition renderer)
- ✅ Один режим с params: operation / carryMode / digits
- ✅ UX клеточная тетрадь (CSS linear-gradient)
- ✅ Лоток цифр 0-9, перетаскивание
- ✅ Управляемый порядок справа налево
- ✅ Перенос (carry) для сложения
- ✅ Заём (borrow) для вычитания + визуализация effectiveTopDigit
- ✅ Двузначные и трёхзначные числа
- ✅ Правильный дроп → ink animation, неправильный → shake

**Placeholder scan:** Нет TBD и TODO.

**Type consistency:**
- `generateTasks` → Task[] — одинаково везде
- `currentStep?.cellType === "carry"` / `"borrow"` / `"result"` — одинаково в CarryRow и ResultRow
- `filledCells[key]` где key = `"${cellType}:${position}"` — одинаково везде
