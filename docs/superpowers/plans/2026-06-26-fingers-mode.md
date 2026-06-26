# Fingers Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить два новых режима (`fingers_show` и `fingers_count`) в тему `column_addition` — терапевтический тренажёр счёта на пальцах с SVG-анимацией.

**Architecture:** Два новых React-компонента + вспомогательные модули внутри существующей папки `column_addition`. Маршрутизация по `task.type` в точке входа рендерера. Карточки добавляются в `column_addition_topic.json`, ZIP пересобирается. Два новых режима регистрируются в `topicLoader.js`.

**Tech Stack:** React, Vitest, JSZip (CLI), SVG, CSS transitions

## Global Constraints

- Near-halves bilateral: right ≥ left, разница 0 или 1, таблица фиксирована для 0–10
- Слагаемые в `fingers_count` add: каждое ≤ 5 (одна рука)
- Вычитаемое в `fingers_count` sub: `a - b ≥ 0`, `b ≤ a`
- removeMode "hand" когда `b === FINGER_MAP[a].left` или `b === FINGER_MAP[a].right`
- CSS transitions на палец ≈ 300ms ease
- Кнопка «Следующая» — `onCorrect()` без параметров, единственный способ завершить карточку
- Класс-префикс CSS для новых компонентов: `fng-`
- Файлы тестов: дополнить `engine.test.js`
- Команда тестов: `npx vitest run src/topics/renderers/column_addition/engine.test.js`
- Команда пересборки ZIP: `node scripts/make_column_addition_zip.mjs`
- Dev-сервер: `npm run dev`

---

## Task 1: FingerSystem.js

**Files:**
- Create: `src/topics/renderers/column_addition/FingerSystem.js`

**Interfaces:**
- Produces:
  - `FINGER_MAP: Record<number, {right: number, left: number}>` — таблица 0–10
  - `getFingerConfig(n: number): {right: number, left: number}` — возвращает `FINGER_MAP[n]`
  - `getRemoveMode(a: number, b: number): {removeMode: "hand"|"fold", removeHand?: "left"|"right"}` — для вычитания

- [ ] **Step 1: Создать файл**

```js
// src/topics/renderers/column_addition/FingerSystem.js

export const FINGER_MAP = {
  0:  { right: 0, left: 0 },
  1:  { right: 1, left: 0 },
  2:  { right: 1, left: 1 },
  3:  { right: 2, left: 1 },
  4:  { right: 2, left: 2 },
  5:  { right: 3, left: 2 },
  6:  { right: 3, left: 3 },
  7:  { right: 4, left: 3 },
  8:  { right: 4, left: 4 },
  9:  { right: 5, left: 4 },
  10: { right: 5, left: 5 },
};

export function getFingerConfig(n) {
  return FINGER_MAP[n] ?? { right: 0, left: 0 };
}

export function getRemoveMode(a, b) {
  const { right, left } = getFingerConfig(a);
  if (b === left)  return { removeMode: "hand", removeHand: "left" };
  if (b === right) return { removeMode: "hand", removeHand: "right" };
  return { removeMode: "fold" };
}
```

- [ ] **Step 2: Добавить тесты в engine.test.js**

В `src/topics/renderers/column_addition/engine.test.js`:

**Добавить импорт** в начало файла (после строки `import { generateTasks } from "./engine.js";`):
```js
import { FINGER_MAP, getFingerConfig, getRemoveMode } from "./FingerSystem.js";
```

**Добавить describe-блок** в конец файла:

```js
describe("FingerSystem", () => {
  it("FINGER_MAP has 11 entries 0..10", () => {
    for (let i = 0; i <= 10; i++) expect(FINGER_MAP[i]).toBeDefined();
  });

  it("right >= left for all", () => {
    for (let i = 0; i <= 10; i++) {
      const { right, left } = FINGER_MAP[i];
      expect(right).toBeGreaterThanOrEqual(left);
    }
  });

  it("right - left is 0 or 1 for all", () => {
    for (let i = 0; i <= 10; i++) {
      const { right, left } = FINGER_MAP[i];
      expect(right - left).toBeLessThanOrEqual(1);
    }
  });

  it("right + left === n for all", () => {
    for (let i = 0; i <= 10; i++) {
      const { right, left } = FINGER_MAP[i];
      expect(right + left).toBe(i);
    }
  });

  it("getFingerConfig(7) returns {right:4, left:3}", () => {
    expect(getFingerConfig(7)).toEqual({ right: 4, left: 3 });
  });

  it("getRemoveMode: b matches left → removeMode hand left", () => {
    // 7: right=4, left=3. b=3 → left
    expect(getRemoveMode(7, 3)).toEqual({ removeMode: "hand", removeHand: "left" });
  });

  it("getRemoveMode: b matches right → removeMode hand right", () => {
    // 7: right=4, left=3. b=4 → right
    expect(getRemoveMode(7, 4)).toEqual({ removeMode: "hand", removeHand: "right" });
  });

  it("getRemoveMode: b matches neither → fold", () => {
    // 7: right=4, left=3. b=2 → fold
    expect(getRemoveMode(7, 2)).toEqual({ removeMode: "fold" });
  });
});
```

- [ ] **Step 3: Запустить тесты, убедиться что проходят**

```
npx vitest run src/topics/renderers/column_addition/engine.test.js
```

Ожидается: все тесты PASS.

- [ ] **Step 4: Commit**

```
git add src/topics/renderers/column_addition/FingerSystem.js src/topics/renderers/column_addition/engine.test.js
git commit -m "feat(fingers): FingerSystem — near-halves canonical table and helpers"
```

---

## Task 2: engine.js — генераторы finger-задач

**Files:**
- Modify: `src/topics/renderers/column_addition/engine.js`

**Interfaces:**
- Consumes: `FINGER_MAP`, `getFingerConfig`, `getRemoveMode` from `./FingerSystem.js`
- Produces (дополнение к существующим):
  - `generateFingersShow(card) → {type:"fingers_show", cardId, conceptId, n}`
  - `generateFingersCount(card) → {type:"fingers_count", cardId, conceptId, op, a, b, result, removeMode?, removeHand?}`
  - `generateTasks` обновлён: маршрутизирует по `card.params.mode`

- [ ] **Step 1: Добавить импорт в engine.js**

В начало файла (`src/topics/renderers/column_addition/engine.js`) добавить после первой строки:

```js
import { getFingerConfig, getRemoveMode } from "./FingerSystem.js";
```

- [ ] **Step 2: Добавить генераторы после функции `generateSubTask`**

Вставить перед строкой `export function generateExamples`:

```js
export function generateFingersShow(card) {
  const n = card.params?.n ?? 0;
  return {
    type: "fingers_show",
    cardId: card.id,
    conceptId: card.conceptId,
    n,
  };
}

export function generateFingersCount(card) {
  const op  = card.params?.op ?? "add";
  const a   = card.params?.a ?? 0;
  const b   = card.params?.b ?? 0;
  const result = op === "add" ? a + b : a - b;
  const base = { type: "fingers_count", cardId: card.id, conceptId: card.conceptId, op, a, b, result };
  if (op === "sub") return { ...base, ...getRemoveMode(a, b) };
  return base;
}
```

- [ ] **Step 3: Обновить generateTasks**

Заменить существующую функцию `export function generateTasks` целиком:

```js
export function generateTasks(mode, cards, countOrParams, maybeParams) {
  const count = typeof countOrParams === "number" ? countOrParams : 15;
  const params = (countOrParams && typeof countOrParams === "object") ? countOrParams
    : (maybeParams && typeof maybeParams === "object") ? maybeParams : {};

  const allCards = cards.filter(c => c.renderer === "column_addition");
  if (!allCards.length) return [];

  // Finger modes: deterministic, one task per card
  const fingerShowCards  = allCards.filter(c => c.params?.mode === "fingers_show");
  const fingerCountCards = allCards.filter(c => c.params?.mode === "fingers_count");

  if (mode === "fingers_show") {
    const pool = fingerShowCards.length ? fingerShowCards : [];
    const tasks = [];
    for (let i = 0; tasks.length < count && i < pool.length * 3; i++) {
      tasks.push(generateFingersShow(pool[i % pool.length]));
    }
    return tasks;
  }

  if (mode === "fingers_count") {
    const opFilter = params.op;
    let pool = fingerCountCards.length ? fingerCountCards : [];
    if (opFilter && opFilter !== "mixed") {
      pool = pool.filter(c => (c.params?.op ?? "add") === opFilter);
    }
    if (!pool.length) pool = fingerCountCards;
    const tasks = [];
    for (let i = 0; tasks.length < count && i < pool.length * 3; i++) {
      tasks.push(generateFingersCount(pool[i % pool.length]));
    }
    return tasks;
  }

  // Default: column_arithmetic (existing logic, exclude finger cards)
  const arithmeticCards = allCards.filter(c => !c.params?.mode);
  if (!arithmeticCards.length) return [];

  const operation = params.operation ?? "add";
  const carryMode = params.carryMode ?? "none";
  const digits    = Number(params.digits ?? 2);

  const filtered   = operation === "mixed" ? arithmeticCards
    : arithmeticCards.filter(c => (c.params?.operation ?? "add") === operation);
  const activePool = filtered.length ? filtered : arithmeticCards;

  const tasks = [];
  let idx = 0, attempts = 0;
  while (tasks.length < count && attempts < count * 20) {
    attempts++;
    const card = activePool[idx % activePool.length];
    const op   = operation === "mixed" ? (Math.random() < 0.5 ? "add" : "subtract") : operation;
    const task = op === "add"
      ? generateAddTask(carryMode, digits, card)
      : generateSubTask(carryMode, digits, card);
    if (task) { tasks.push(task); idx++; }
  }
  return tasks;
}
```

- [ ] **Step 4: Добавить тесты в engine.test.js**

Вставить в конец файла:

```js
const FINGER_CARDS = [
  { id: "fshow_3",      conceptId: "fshow_3",      renderer: "column_addition", params: { mode: "fingers_show",  n: 3 } },
  { id: "fshow_7",      conceptId: "fshow_7",      renderer: "column_addition", params: { mode: "fingers_show",  n: 7 } },
  { id: "fcount_a_3_4", conceptId: "fcount_a_3_4", renderer: "column_addition", params: { mode: "fingers_count", op: "add", a: 3, b: 4 } },
  { id: "fcount_s_7_3", conceptId: "fcount_s_7_3", renderer: "column_addition", params: { mode: "fingers_count", op: "sub", a: 7, b: 3 } },
];

describe("generateTasks – fingers_show", () => {
  it("returns tasks of type fingers_show", () => {
    const tasks = generateTasks("fingers_show", FINGER_CARDS, 4);
    expect(tasks.every(t => t.type === "fingers_show")).toBe(true);
  });

  it("task.n matches card.params.n", () => {
    const tasks = generateTasks("fingers_show", FINGER_CARDS, 2);
    expect(tasks[0].n).toBeDefined();
  });

  it("arithmetic mode ignores finger cards", () => {
    const mixed = [...CARDS, ...FINGER_CARDS];
    const tasks = generateTasks("column_arithmetic", mixed, 10, { operation: "add", carryMode: "none", digits: 2 });
    expect(tasks.every(t => t.type === "column_arithmetic")).toBe(true);
  });
});

describe("generateTasks – fingers_count", () => {
  it("returns tasks of type fingers_count", () => {
    const tasks = generateTasks("fingers_count", FINGER_CARDS, 4);
    expect(tasks.every(t => t.type === "fingers_count")).toBe(true);
  });

  it("add task: result = a + b", () => {
    const tasks = generateTasks("fingers_count", FINGER_CARDS, 4);
    const addTasks = tasks.filter(t => t.op === "add");
    for (const t of addTasks) expect(t.result).toBe(t.a + t.b);
  });

  it("sub task: has removeMode", () => {
    const tasks = generateTasks("fingers_count", FINGER_CARDS, 4);
    const subTasks = tasks.filter(t => t.op === "sub");
    for (const t of subTasks) expect(t.removeMode).toMatch(/^hand|fold$/);
  });

  it("sub task 7-3: removeMode hand, removeHand left (3 = left of 7)", () => {
    const tasks = generateTasks("fingers_count", FINGER_CARDS, 10);
    const t = tasks.find(t => t.op === "sub" && t.a === 7 && t.b === 3);
    expect(t?.removeMode).toBe("hand");
    expect(t?.removeHand).toBe("left");
  });
});
```

- [ ] **Step 5: Запустить тесты**

```
npx vitest run src/topics/renderers/column_addition/engine.test.js
```

Ожидается: все тесты PASS.

- [ ] **Step 6: Commit**

```
git add src/topics/renderers/column_addition/engine.js src/topics/renderers/column_addition/engine.test.js
git commit -m "feat(fingers): engine generators for fingers_show and fingers_count tasks"
```

---

## Task 3: HandSVG.jsx + fingers.css

**Files:**
- Create: `src/topics/renderers/column_addition/HandSVG.jsx`
- Create: `src/topics/renderers/column_addition/fingers.css`

**Interfaces:**
- Produces: `<HandSVG count={n} ghost={m} side="right"|"left" animated={bool} />`
  - `count` (0–5): кол-во solid-пальцев снизу
  - `ghost` (0–5): кол-во ghost-пальцев сразу выше solid
  - `side`: "right" (нормальное) | "left" (зеркальное SVG)
  - `animated`: включает CSS-переходы

- [ ] **Step 1: Создать fingers.css**

```css
/* src/topics/renderers/column_addition/fingers.css */

.fng-hand-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.fng-hand-wrap svg {
  overflow: visible;
}

.fng-finger {
  transition: none;
}

.fng-finger--animated {
  transition: transform 0.3s ease;
}

.fng-screen {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #f0f6ff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  user-select: none;
  touch-action: none;
  overflow: hidden;
}

.fng-number {
  font-family: 'Primo', sans-serif;
  font-size: 96px;
  color: #1a2540;
  line-height: 1;
}

.fng-hands-row {
  display: flex;
  align-items: flex-end;
  gap: 24px;
}

.fng-instruction {
  font-size: 20px;
  color: #4a5568;
  text-align: center;
  padding: 0 24px;
}

.fng-btn {
  padding: 16px 40px;
  border: none;
  border-radius: 16px;
  font-size: 22px;
  font-family: 'Primo', sans-serif;
  cursor: pointer;
  touch-action: manipulation;
}

.fng-btn--next {
  background: #4CAF50;
  color: #fff;
}

.fng-btn--tap {
  background: #FF6B35;
  color: #fff;
  font-size: 28px;
  padding: 20px 60px;
}

.fng-btn--merge {
  background: #7C3AED;
  color: #fff;
}

.fng-btn--disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* merge animation */
.fng-hands-merge {
  display: flex;
  align-items: flex-end;
  gap: 24px;
}

.fng-hand-merging-left {
  animation: fng-slide-right 0.6s ease forwards;
}

.fng-hand-merging-right {
  animation: fng-slide-left 0.6s ease forwards;
}

@keyframes fng-slide-right {
  to { transform: translateX(60px); }
}

@keyframes fng-slide-left {
  to { transform: translateX(-60px); }
}

.fng-count-dots {
  display: flex;
  gap: 8px;
}

.fng-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #d1d5db;
}

.fng-dot--filled {
  background: #FF6B35;
}

.fng-expression {
  font-family: 'Primo', sans-serif;
  font-size: 36px;
  color: #1a2540;
  letter-spacing: 4px;
}

.fng-result-number {
  color: #4CAF50;
}

/* subtraction: hand-to-remove highlight */
.fng-hand--remove {
  animation: fng-pulse-red 0.8s ease infinite alternate;
}

@keyframes fng-pulse-red {
  from { filter: drop-shadow(0 0 4px rgba(239,68,68,0.4)); }
  to   { filter: drop-shadow(0 0 12px rgba(239,68,68,0.9)); }
}

.fng-hand--removed {
  animation: fng-slide-away 0.5s ease forwards;
}

@keyframes fng-slide-away {
  to { transform: translateX(-140px); opacity: 0; }
}

/* counting sequence */
.fng-count-seq {
  display: flex;
  gap: 10px;
  font-family: 'Primo', sans-serif;
  font-size: 32px;
  color: #1a2540;
}

.fng-count-seq span {
  opacity: 0.2;
  transition: opacity 0.25s ease;
}

.fng-count-seq span.fng-count--active {
  opacity: 1;
  color: #FF6B35;
}

.fng-count-seq span.fng-count--done {
  opacity: 1;
}
```

- [ ] **Step 2: Создать HandSVG.jsx**

```jsx
// src/topics/renderers/column_addition/HandSVG.jsx
import React from "react";
import "./fingers.css";

// Finger definitions for RIGHT hand (left to right: pinky → thumb)
// Each: { x: left edge, topY: top when raised, w: width, h: height }
const FINGERS = [
  { x: 8,  topY: 34, w: 15, h: 58 },  // pinky
  { x: 27, topY: 20, w: 15, h: 72 },  // ring
  { x: 46, topY: 12, w: 15, h: 80 },  // middle
  { x: 65, topY: 22, w: 15, h: 70 },  // index
  { x: 83, topY: 46, w: 12, h: 50 },  // thumb
];

const PALM_Y    = 90;
const LOWER_DY  = 85; // translateY to hide finger behind palm

const COLOR_SOLID = "#FF6B35";
const COLOR_PALM  = "#FFAB85";

export default function HandSVG({ count = 0, ghost = 0, side = "right", animated = false }) {
  const mirrorTransform = side === "left"
    ? "scale(-1,1) translate(-112,0)"
    : undefined;

  return (
    <svg
      width="112"
      height="145"
      viewBox="0 0 112 145"
      aria-hidden="true"
    >
      <g transform={mirrorTransform}>
        {FINGERS.map((f, i) => {
          const isSolid = i < count;
          const isGhost = !isSolid && i < count + ghost;
          const isLowered = !isSolid && !isGhost;

          const dy = isLowered ? LOWER_DY : 0;

          return (
            <g
              key={i}
              className={animated ? "fng-finger fng-finger--animated" : "fng-finger"}
              style={{ transform: `translateY(${dy}px)` }}
            >
              {isGhost ? (
                <rect
                  x={f.x} y={f.topY} width={f.w} height={f.h} rx={7}
                  fill="none"
                  stroke={COLOR_SOLID}
                  strokeWidth={2.5}
                  opacity={0.35}
                />
              ) : (
                <rect
                  x={f.x} y={f.topY} width={f.w} height={f.h} rx={7}
                  fill={COLOR_SOLID}
                />
              )}
            </g>
          );
        })}

        {/* Palm — drawn last to cover lowered finger stubs */}
        <rect x={3} y={PALM_Y} width={106} height={50} rx={10} fill={COLOR_PALM} />
        {/* Wrist */}
        <rect x={20} y={132} width={72} height={13} rx={6} fill={COLOR_PALM} />
      </g>
    </svg>
  );
}
```

- [ ] **Step 3: Визуально проверить компонент**

Запустить `npm run dev`, временно добавить в любой тестовый экран:
```jsx
import HandSVG from "@/topics/renderers/column_addition/HandSVG";
// ...
<HandSVG count={3} ghost={2} side="right" animated />
<HandSVG count={3} ghost={2} side="left" animated />
```

Убедиться что:
- 3 оранжевых пальца видны, 2 полупрозрачных контурных
- Левая рука зеркальная
- Ладонь перекрывает «опущенные» пальцы

Убрать временный код после проверки.

- [ ] **Step 4: Commit**

```
git add src/topics/renderers/column_addition/HandSVG.jsx src/topics/renderers/column_addition/fingers.css
git commit -m "feat(fingers): HandSVG component with solid/ghost/lowered finger states"
```

---

## Task 4: FingersShowTask.jsx

**Files:**
- Create: `src/topics/renderers/column_addition/FingersShowTask.jsx`
- Modify: `src/topics/renderers/column_addition/index.jsx` (добавить 3 строки)

**Interfaces:**
- Consumes: `task: {type:"fingers_show", n, cardId}`, `sessionParams: {hint?: boolean}`, `onCorrect: () => void`
- Consumes: `HandSVG` (count, ghost, side, animated)
- Consumes: `getFingerConfig` из FingerSystem
- Produces: visual card component, маршрут в `index.jsx`

- [ ] **Step 1: Создать FingersShowTask.jsx**

```jsx
// src/topics/renderers/column_addition/FingersShowTask.jsx
import React from "react";
import HandSVG from "./HandSVG.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import "./fingers.css";

export default function FingersShowTask({ task, sessionParams, onCorrect }) {
  const hint = sessionParams?.hint !== false; // default: show hands
  const { right, left } = getFingerConfig(task.n);

  return (
    <div className="fng-screen">
      <div className="fng-number">{task.n}</div>

      {hint && (
        <div className="fng-hands-row">
          <HandSVG count={left}  side="left"  animated={false} />
          <HandSVG count={right} side="right" animated={false} />
        </div>
      )}

      <button className="fng-btn fng-btn--next" onClick={onCorrect}>
        → Следующая
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Добавить маршрут в index.jsx**

В файле `src/topics/renderers/column_addition/index.jsx`, в функции `ColumnAdditionRenderer`, добавить после строки `if (mode?.type === "column_copy") {` и перед строкой `if (!task || task.type !== "column_arithmetic")`:

```jsx
import FingersShowTask from "./FingersShowTask.jsx";

// ... в теле ColumnAdditionRenderer:
if (task?.type === "fingers_show") {
  return <FingersShowTask task={task} sessionParams={sessionParams} onCorrect={onCorrect} />;
}
```

Точное место вставки (после строки 734, перед строкой 737):
```jsx
// ДОБАВИТЬ:
if (task?.type === "fingers_show") {
  return <FingersShowTask task={task} sessionParams={sessionParams} onCorrect={onCorrect} />;
}
```

И добавить импорт в начало файла (после строки `import "./column_addition.css";`):
```js
import FingersShowTask from "./FingersShowTask.jsx";
```

- [ ] **Step 3: Добавить режим в topicLoader.js**

В файле `src/topics/topicLoader.js`, в массиве `column_addition` объекта `DEFAULT_MODES`, после объекта `column_copy` (строка ~952), добавить:

```js
{
  id: "fingers_show",
  type: "fingers_show",
  evaluation: "none",
  ui: { title: "Покажи", instruction: "Покажи число на пальцах", icon: "media/icons/column_addition_mode.svg" },
  params: {
    hint: {
      type: "enum",
      values: [true, false],
      labels: { ru: { "true": "С руками (подсказка)", "false": "Только цифра" } },
      default: true,
      label: { ru: "Подсказка" },
    },
  },
},
```

В объекте `DEFAULT_MODE_METHODOLOGY.column_addition` добавить после `column_copy`:

```js
fingers_show: {
  summary: "Покажи число пальцами.",
  text: "На экране — цифра и эталонная поза рук. Ребёнок воспроизводит позу своими пальцами. Логопед оценивает и переходит к следующей.",
  settings: [
    "«Подсказка» — показывать ли схему рук или только цифру.",
  ],
  goal: "Ребёнок запоминает каноническую позу для каждого числа 0–10.",
  tips: [
    "Начинайте с малых чисел (0–5), затем добавляйте большие.",
    "Режим «Только цифра» — для проверки без подсказки.",
  ],
},
```

- [ ] **Step 4: Визуальная проверка**

Запустить `npm run dev`. Открыть тему column_addition, переключить на режим «Покажи», выбрать карточку `fshow_7` (она ещё не в topic.json — добавим в Task 7, но можно временно создать задачу вручную в коде для проверки рендера).

Убедиться что:
- Цифра отображается крупно
- SVG-руки показывают правильную конфигурацию (7 = L:3, R:4)
- Кнопка «Следующая» работает

- [ ] **Step 5: Commit**

```
git add src/topics/renderers/column_addition/FingersShowTask.jsx src/topics/renderers/column_addition/index.jsx src/topics/topicLoader.js
git commit -m "feat(fingers): FingersShowTask component and fingers_show mode registration"
```

---

## Task 5: FingersCountTask.jsx — режим «Счёт»

**Files:**
- Create: `src/topics/renderers/column_addition/FingersCountTask.jsx`
- Modify: `src/topics/renderers/column_addition/index.jsx` (ещё 2 строки)
- Modify: `src/topics/topicLoader.js` (добавить режим fingers_count)

**Interfaces:**
- Consumes: `task: {type:"fingers_count", op:"add"|"sub", a, b, result, removeMode?, removeHand?}`, `onCorrect`
- Produces: компонент с фазами и SVG-анимацией

- [ ] **Step 1: Создать FingersCountTask.jsx**

```jsx
// src/topics/renderers/column_addition/FingersCountTask.jsx
import React, { useState, useEffect, useCallback } from "react";
import HandSVG from "./HandSVG.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import "./fingers.css";

// ── Addition sub-component ────────────────────────────────────────────────────

function AdditionTask({ task, onCorrect }) {
  // phase: "left" | "right" | "merge" | "counting" | "done"
  const [phase, setPhase]       = useState("left");
  const [leftSolid, setLeftSolid]   = useState(0);
  const [rightSolid, setRightSolid] = useState(0);
  const [countIdx, setCountIdx] = useState(-1); // -1 = not counting yet
  const [merging, setMerging]   = useState(false);

  const { a, b, result } = task;

  // Reset on task change
  useEffect(() => {
    setPhase("left");
    setLeftSolid(0);
    setRightSolid(0);
    setCountIdx(-1);
    setMerging(false);
  }, [task.cardId]);

  const handleTap = useCallback(() => {
    if (phase === "left") {
      const next = leftSolid + 1;
      setLeftSolid(next);
      if (next >= a) setPhase("right");
    } else if (phase === "right") {
      const next = rightSolid + 1;
      setRightSolid(next);
      if (next >= b) setPhase("merge");
    }
  }, [phase, leftSolid, rightSolid, a, b]);

  const handleMerge = useCallback(() => {
    setMerging(true);
    setPhase("counting");
    // Start count sequence after animation
    setTimeout(() => {
      setCountIdx(0);
    }, 700);
  }, []);

  // Auto-advance count sequence
  useEffect(() => {
    if (countIdx < 0 || countIdx >= result) return;
    const t = setTimeout(() => {
      const next = countIdx + 1;
      setCountIdx(next);
      if (next >= result) setPhase("done");
    }, 400);
    return () => clearTimeout(t);
  }, [countIdx, result]);

  const instruction =
    phase === "left"  ? `Подними ${a} пальца${a === 1 ? "" : "х"} левой руки` :
    phase === "right" ? `Подними ${b} пальца${b === 1 ? "" : "х"} правой руки` :
    phase === "merge" ? "Соединяем руки!" :
    phase === "counting" ? "Посчитай все пальцы!" : "";

  const tapDisabled = phase !== "left" && phase !== "right";

  return (
    <div className="fng-screen">
      <div className="fng-expression">
        {a} + {b} = {phase === "done" ? <span className="fng-result-number">{result}</span> : "?"}
      </div>

      <div className={merging ? "fng-hands-merge" : "fng-hands-row"}>
        <div className={merging ? "fng-hand-merging-left" : ""}>
          <HandSVG
            count={leftSolid}
            ghost={phase === "left" ? a - leftSolid : 0}
            side="left"
            animated
          />
        </div>
        <div className={merging ? "fng-hand-merging-right" : ""}>
          <HandSVG
            count={rightSolid}
            ghost={phase === "right" ? b - rightSolid : 0}
            side="right"
            animated
          />
        </div>
      </div>

      {(phase === "counting" || phase === "done") && (
        <div className="fng-count-seq">
          {Array.from({ length: result }, (_, i) => (
            <span
              key={i}
              className={
                i < countIdx ? "fng-count--done" :
                i === countIdx ? "fng-count--active" : ""
              }
            >
              {i + 1}
            </span>
          ))}
        </div>
      )}

      {phase !== "done" && (
        <div className="fng-instruction">{instruction}</div>
      )}

      {/* Progress dots for current phase */}
      {(phase === "left" || phase === "right") && (
        <div className="fng-count-dots">
          {Array.from({ length: phase === "left" ? a : b }, (_, i) => (
            <div
              key={i}
              className={`fng-dot ${
                (phase === "left" && i < leftSolid) ||
                (phase === "right" && i < rightSolid)
                  ? "fng-dot--filled" : ""
              }`}
            />
          ))}
        </div>
      )}

      {phase === "merge" && (
        <button className="fng-btn fng-btn--merge" onClick={handleMerge}>
          Соединяем →
        </button>
      )}

      {(phase === "left" || phase === "right") && (
        <button
          className={`fng-btn fng-btn--tap ${tapDisabled ? "fng-btn--disabled" : ""}`}
          onClick={handleTap}
          disabled={tapDisabled}
        >
          тап
        </button>
      )}

      {phase === "done" && (
        <button className="fng-btn fng-btn--next" onClick={onCorrect}>
          → Следующая
        </button>
      )}
    </div>
  );
}

// ── Subtraction sub-component ─────────────────────────────────────────────────

function SubtractionTask({ task, onCorrect }) {
  // phase: "show" | "remove" | "counting" | "done"
  const [phase, setPhase]      = useState("show");
  const [foldsDone, setFolds]  = useState(0);
  const [countIdx, setCountIdx] = useState(-1);
  const [handRemoved, setHandRemoved] = useState(false);

  const { a, b, result, removeMode, removeHand } = task;
  const startConfig  = getFingerConfig(a);
  const resultConfig = getFingerConfig(result);

  // Reset on task change
  useEffect(() => {
    setPhase("show");
    setFolds(0);
    setCountIdx(-1);
    setHandRemoved(false);
  }, [task.cardId]);

  const handleReady = () => setPhase("remove");

  const handleRemoveHand = useCallback(() => {
    setHandRemoved(true);
    setTimeout(() => startCounting(), 600);
  }, []);

  const handleFold = useCallback(() => {
    const next = foldsDone + 1;
    setFolds(next);
    if (next >= b) setTimeout(() => startCounting(), 300);
  }, [foldsDone, b]);

  function startCounting() {
    setPhase("counting");
    setCountIdx(0);
  }

  // Auto-advance count
  useEffect(() => {
    if (countIdx < 0 || countIdx >= result) return;
    const t = setTimeout(() => {
      const next = countIdx + 1;
      setCountIdx(next);
      if (next >= result) setPhase("done");
    }, 400);
    return () => clearTimeout(t);
  }, [countIdx, result]);

  // Compute displayed finger counts
  let leftCount, rightCount;
  if (phase === "show" || (phase === "remove" && !handRemoved && foldsDone === 0)) {
    leftCount  = startConfig.left;
    rightCount = startConfig.right;
  } else if (phase === "remove" && removeMode === "fold") {
    // Folding from the larger hand (right if right >= left)
    if (removeHand === "right" || startConfig.right >= startConfig.left) {
      rightCount = Math.max(startConfig.right - foldsDone, 0);
      leftCount  = startConfig.left;
    } else {
      leftCount  = Math.max(startConfig.left - foldsDone, 0);
      rightCount = startConfig.right;
    }
  } else {
    leftCount  = resultConfig.left;
    rightCount = resultConfig.right;
  }

  const isRemovingLeft  = phase === "remove" && removeMode === "hand" && removeHand === "left";
  const isRemovingRight = phase === "remove" && removeMode === "hand" && removeHand === "right";

  const instruction =
    phase === "show"   ? `Вот ${a} пальцев. Убираем ${b}.` :
    phase === "remove" && removeMode === "hand"
      ? `Убери ${removeHand === "left" ? "левую" : "правую"} руку!` :
    phase === "remove" && removeMode === "fold"
      ? `Загни ${b - foldsDone} пальца${b - foldsDone === 1 ? "" : "х"}` :
    phase === "counting" ? "Сколько осталось? Посчитай!" : "";

  return (
    <div className="fng-screen">
      <div className="fng-expression">
        {a} − {b} = {phase === "done" ? <span className="fng-result-number">{result}</span> : "?"}
      </div>

      <div className="fng-hands-row">
        <div className={
          isRemovingLeft && !handRemoved ? "fng-hand--remove" :
          isRemovingLeft && handRemoved  ? "fng-hand--removed" : ""
        }>
          <HandSVG count={leftCount} side="left" animated />
        </div>
        <div className={
          isRemovingRight && !handRemoved ? "fng-hand--remove" :
          isRemovingRight && handRemoved  ? "fng-hand--removed" : ""
        }>
          <HandSVG count={rightCount} side="right" animated />
        </div>
      </div>

      {(phase === "counting" || phase === "done") && (
        <div className="fng-count-seq">
          {Array.from({ length: result }, (_, i) => (
            <span
              key={i}
              className={
                i < countIdx ? "fng-count--done" :
                i === countIdx ? "fng-count--active" : ""
              }
            >
              {i + 1}
            </span>
          ))}
        </div>
      )}

      {phase !== "done" && (
        <div className="fng-instruction">{instruction}</div>
      )}

      {phase === "show" && (
        <button className="fng-btn fng-btn--next" onClick={handleReady}>
          Готов
        </button>
      )}

      {phase === "remove" && removeMode === "hand" && !handRemoved && (
        <button
          className="fng-btn fng-btn--tap"
          onClick={handleRemoveHand}
        >
          убрать руку
        </button>
      )}

      {phase === "remove" && removeMode === "fold" && foldsDone < b && (
        <button className="fng-btn fng-btn--tap" onClick={handleFold}>
          тап
        </button>
      )}

      {phase === "done" && (
        <button className="fng-btn fng-btn--next" onClick={onCorrect}>
          → Следующая
        </button>
      )}
    </div>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default function FingersCountTask({ task, onCorrect }) {
  if (task.op === "sub") {
    return <SubtractionTask task={task} onCorrect={onCorrect} />;
  }
  return <AdditionTask task={task} onCorrect={onCorrect} />;
}
```

- [ ] **Step 2: Добавить маршрут в index.jsx**

Добавить импорт в начало файла:
```js
import FingersCountTask from "./FingersCountTask.jsx";
```

Добавить маршрут в `ColumnAdditionRenderer` сразу после `fingers_show` маршрута:
```jsx
if (task?.type === "fingers_count") {
  return <FingersCountTask task={task} onCorrect={onCorrect} />;
}
```

- [ ] **Step 3: Добавить режим в topicLoader.js**

В `DEFAULT_MODES.column_addition` после объекта `fingers_show`:

```js
{
  id: "fingers_count",
  type: "fingers_count",
  evaluation: "none",
  ui: { title: "Считаем", instruction: "Поднимай пальцы и считай", icon: "media/icons/column_addition_mode.svg" },
  params: {
    op: {
      type: "enum",
      values: ["add", "sub", "mixed"],
      labels: { ru: { add: "Сложение", sub: "Вычитание", mixed: "Микс" } },
      default: "add",
      label: { ru: "Операция" },
    },
  },
},
```

В `DEFAULT_MODE_METHODOLOGY.column_addition` после `fingers_show`:

```js
fingers_count: {
  summary: "Поднимай пальцы, считай вместе с ребёнком.",
  text: "Экран показывает пример. Ребёнок поднимает пальцы левой руки (первое слагаемое), затем правой (второе), соединяет и считает все. При вычитании — выставляет число и убирает пальцы.",
  settings: [
    "«Операция» — сложение, вычитание или оба.",
  ],
  goal: "Ребёнок понимает сложение как объединение двух групп пальцев, вычитание — как убирание части.",
  tips: [
    "Проговаривайте вслух: «Три пальца плюс четыре пальца — считаем вместе!»",
    "Для вычитания начинайте с примеров где вычитаемое совпадает с одной рукой — убрать целую руку наглядно.",
  ],
},
```

- [ ] **Step 4: Визуальная проверка — сложение**

Запустить `npm run dev`. Временно передать задачу напрямую в рендерер или использовать `column_addition_topic.json` с одной тестовой карточкой.

Протестировать `{ type: "fingers_count", op: "add", a: 3, b: 4, result: 7 }`:
- [ ] Фаза "left": видны 3 контурных пальца на левой руке, кнопка «тап»
- [ ] Три тапа: пальцы становятся оранжевыми один за одним, переход в фазу "right"
- [ ] Фаза "right": 4 контурных пальца на правой, 3 оранжевых на левой
- [ ] Четыре тапа: правая заполняется, кнопка «Соединяем»
- [ ] Нажать «Соединяем»: руки анимируются навстречу, числа 1–7 появляются последовательно
- [ ] Финал: "3 + 4 = 7 ✓", кнопка «Следующая»

- [ ] **Step 5: Визуальная проверка — вычитание hand**

Протестировать `{ type: "fingers_count", op: "sub", a: 7, b: 3, result: 4, removeMode: "hand", removeHand: "left" }`:
- [ ] Фаза "show": L:3, R:4, кнопка «Готов»
- [ ] «Готов» → фаза "remove": левая рука пульсирует красным
- [ ] Тап «убрать руку» → левая уезжает, остаётся правая R:4
- [ ] Числа 1–4 появляются, результат 7 − 3 = 4

- [ ] **Step 6: Визуальная проверка — вычитание fold**

Протестировать `{ type: "fingers_count", op: "sub", a: 6, b: 2, result: 4, removeMode: "fold" }`:
- [ ] Фаза "show": L:3, R:3
- [ ] «Готов» → инструкция «Загни 2 пальца»
- [ ] Два тапа: правая уменьшается R:3→R:1, числа 1–4

- [ ] **Step 7: Commit**

```
git add src/topics/renderers/column_addition/FingersCountTask.jsx src/topics/renderers/column_addition/index.jsx src/topics/topicLoader.js
git commit -m "feat(fingers): FingersCountTask with add/sub phases and fingers_count mode"
```

---

## Task 6: topic.json — добавить карточки и пересобрать ZIP

**Files:**
- Modify: `public/column_addition_topic.json`
- Rebuild: `public/column_addition_v1.1.0.zip` (bump minor version)

**Interfaces:**
- Consumes: все созданные генераторы
- Produces: обновлённый ZIP для установки в приложение

- [ ] **Step 1: Обновить public/column_addition_topic.json**

Заменить содержимое файла:

```json
{
  "meta": {
    "id": "column_addition",
    "renderer": "column_addition",
    "version": "1.1.0",
    "title": { "ru": "Сложение и вычитание в столбик" }
  },
  "cards": [
    { "id": "col_add", "conceptId": "col_add", "renderer": "column_addition", "params": { "operation": "add" } },
    { "id": "col_sub", "conceptId": "col_sub", "renderer": "column_addition", "params": { "operation": "subtract" } },

    { "id": "fshow_0",  "conceptId": "fshow_0",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 0  } },
    { "id": "fshow_1",  "conceptId": "fshow_1",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 1  } },
    { "id": "fshow_2",  "conceptId": "fshow_2",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 2  } },
    { "id": "fshow_3",  "conceptId": "fshow_3",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 3  } },
    { "id": "fshow_4",  "conceptId": "fshow_4",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 4  } },
    { "id": "fshow_5",  "conceptId": "fshow_5",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 5  } },
    { "id": "fshow_6",  "conceptId": "fshow_6",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 6  } },
    { "id": "fshow_7",  "conceptId": "fshow_7",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 7  } },
    { "id": "fshow_8",  "conceptId": "fshow_8",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 8  } },
    { "id": "fshow_9",  "conceptId": "fshow_9",  "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 9  } },
    { "id": "fshow_10", "conceptId": "fshow_10", "renderer": "column_addition", "params": { "mode": "fingers_show", "n": 10 } },

    { "id": "fcount_add_1_1", "conceptId": "fcount_add_1_1", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 1, "b": 1 } },
    { "id": "fcount_add_2_1", "conceptId": "fcount_add_2_1", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 2, "b": 1 } },
    { "id": "fcount_add_2_2", "conceptId": "fcount_add_2_2", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 2, "b": 2 } },
    { "id": "fcount_add_3_1", "conceptId": "fcount_add_3_1", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 3, "b": 1 } },
    { "id": "fcount_add_3_2", "conceptId": "fcount_add_3_2", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 3, "b": 2 } },
    { "id": "fcount_add_3_3", "conceptId": "fcount_add_3_3", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 3, "b": 3 } },
    { "id": "fcount_add_4_1", "conceptId": "fcount_add_4_1", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 4, "b": 1 } },
    { "id": "fcount_add_4_2", "conceptId": "fcount_add_4_2", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 4, "b": 2 } },
    { "id": "fcount_add_4_3", "conceptId": "fcount_add_4_3", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 4, "b": 3 } },
    { "id": "fcount_add_4_4", "conceptId": "fcount_add_4_4", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 4, "b": 4 } },
    { "id": "fcount_add_5_1", "conceptId": "fcount_add_5_1", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 5, "b": 1 } },
    { "id": "fcount_add_5_2", "conceptId": "fcount_add_5_2", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 5, "b": 2 } },
    { "id": "fcount_add_5_3", "conceptId": "fcount_add_5_3", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 5, "b": 3 } },
    { "id": "fcount_add_5_4", "conceptId": "fcount_add_5_4", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 5, "b": 4 } },
    { "id": "fcount_add_5_5", "conceptId": "fcount_add_5_5", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "add", "a": 5, "b": 5 } },

    { "id": "fcount_sub_2_1",  "conceptId": "fcount_sub_2_1",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 2,  "b": 1  } },
    { "id": "fcount_sub_3_1",  "conceptId": "fcount_sub_3_1",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 3,  "b": 1  } },
    { "id": "fcount_sub_3_2",  "conceptId": "fcount_sub_3_2",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 3,  "b": 2  } },
    { "id": "fcount_sub_4_1",  "conceptId": "fcount_sub_4_1",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 4,  "b": 1  } },
    { "id": "fcount_sub_4_2",  "conceptId": "fcount_sub_4_2",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 4,  "b": 2  } },
    { "id": "fcount_sub_4_3",  "conceptId": "fcount_sub_4_3",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 4,  "b": 3  } },
    { "id": "fcount_sub_5_2",  "conceptId": "fcount_sub_5_2",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 5,  "b": 2  } },
    { "id": "fcount_sub_5_3",  "conceptId": "fcount_sub_5_3",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 5,  "b": 3  } },
    { "id": "fcount_sub_6_2",  "conceptId": "fcount_sub_6_2",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 6,  "b": 2  } },
    { "id": "fcount_sub_6_3",  "conceptId": "fcount_sub_6_3",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 6,  "b": 3  } },
    { "id": "fcount_sub_7_3",  "conceptId": "fcount_sub_7_3",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 7,  "b": 3  } },
    { "id": "fcount_sub_7_4",  "conceptId": "fcount_sub_7_4",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 7,  "b": 4  } },
    { "id": "fcount_sub_8_3",  "conceptId": "fcount_sub_8_3",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 8,  "b": 3  } },
    { "id": "fcount_sub_8_4",  "conceptId": "fcount_sub_8_4",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 8,  "b": 4  } },
    { "id": "fcount_sub_9_4",  "conceptId": "fcount_sub_9_4",  "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 9,  "b": 4  } },
    { "id": "fcount_sub_10_5", "conceptId": "fcount_sub_10_5", "renderer": "column_addition", "params": { "mode": "fingers_count", "op": "sub", "a": 10, "b": 5  } }
  ]
}
```

- [ ] **Step 2: Пересобрать ZIP**

```
node scripts/make_column_addition_zip.mjs
```

Ожидается: `✓ Created .../public/column_addition_v1.1.0.zip`

- [ ] **Step 3: Финальный прогон тестов**

```
npx vitest run src/topics/renderers/column_addition/engine.test.js
```

Ожидается: все тесты PASS.

- [ ] **Step 5: Smoke-тест в браузере**

`npm run dev`, установить `column_addition_v1.1.0.zip`:

- [ ] Режим «Покажи» — карточка 7: цифра 7, L:3, R:4, кнопка работает
- [ ] Режим «Покажи» без подсказки: только цифра
- [ ] Режим «Считаем» — 3+4: все 3 фазы работают, счёт 1–7
- [ ] Режим «Считаем» — 7−3: "убрать руку", счёт 1–4
- [ ] Режим «Считаем» — 6−2: "загни пальцы", счёт 1–4
- [ ] Существующий режим «Столбик» — всё работает как раньше

- [ ] **Step 6: Commit**

```
git add public/column_addition_topic.json public/column_addition_v1.1.0.zip dist/column_addition_v1.1.0.zip dist/column_addition_topic.json
git commit -m "feat(fingers): add finger cards to column_addition topic v1.1.0"
```
