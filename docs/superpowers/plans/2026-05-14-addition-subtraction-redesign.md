# Addition/Subtraction Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать полную педагогическую лестницу темы "Плюс и минус" согласно спеку `docs/superpowers/specs/2026-05-14-addition-subtraction-redesign-design.md`.

**Architecture:** Движок (`engine.js`) генерирует задачи для каждого из 7 режимов. Рендерер (`index.jsx`) маршрутизирует к нужному компоненту по `task.type`. Новые режимы 5–6 — новые компоненты внутри `index.jsx`. Режим 7 — отдельный файл `ModeChain.jsx`. Хелпер — `HelperPanel.jsx`.

**Tech Stack:** React 19, Vite, Vitest, CSS BEM-like (`.operation-*`), `src/styles.css` — единый CSS-файл.

**ВАЖНО:** Визуализация режимов 3 и 4 (stick, link-drill) неприкосновенна. Только текст инструкций + responsive CSS.

---

## Карта файлов

| Действие | Файл |
|----------|------|
| Изменить | `src/topics/renderers/addition_subtraction/engine.js` |
| Изменить | `src/topics/renderers/addition_subtraction/engine.test.js` |
| Изменить | `src/topics/renderers/addition_subtraction/index.jsx` |
| Изменить | `src/styles.css` |
| Создать | `src/topics/renderers/addition_subtraction/HelperPanel.jsx` |
| Создать | `src/topics/renderers/addition_subtraction/ModeChain.jsx` |
| Создать | `src/topics/renderers/addition_subtraction/ModeChain.test.js` |
| Создать | `tools/addition_subtraction/topic.json` |

---

## Task 1: Тексты инструкций режима 3

**Files:**
- Modify: `src/topics/renderers/addition_subtraction/index.jsx:473-477`

- [ ] **Шаг 1: Обновить строки prompt в ManipulationTask**

Найти в `ManipulationTask` (строки ~473–477):
```jsx
const prompt = phase === "setup"
  ? "Посчитай, сколько было."
  : phase === "action"
    ? `${actionWord} ${task.delta}.`
    : "Посчитай, сколько стало, и нажми на число.";
```

Заменить на:
```jsx
const prompt = phase === "setup"
  ? `Покажи ${task.start} на палке`
  : phase === "action"
    ? `${actionWord} ${task.delta}`
    : "Нажми сколько стало";
```

- [ ] **Шаг 2: Проверить в браузере**

Запустить `npm run dev`, открыть тему "Плюс и минус", режим "Сделай действие". Убедиться что все три фазы показывают новые короткие инструкции.

- [ ] **Шаг 3: Коммит**

```bash
git add src/topics/renderers/addition_subtraction/index.jsx
git commit -m "fix(addition-subtraction): shorten mode-3 instruction prompts"
```

---

## Task 2: Параметр `direction` для режима 4 — движок

**Files:**
- Modify: `src/topics/renderers/addition_subtraction/engine.js`
- Modify: `src/topics/renderers/addition_subtraction/engine.test.js`

- [ ] **Шаг 1: Написать падающие тесты**

Добавить в `engine.test.js`:
```js
describe("operation_action_from_sign direction param", () => {
  it("alternating: tasks alternate sign_to_action and action_to_sign", () => {
    const tasks = generateTasks("operation_action_from_sign", CARDS, 10, { direction: "alternating" });
    const dirs = tasks.map((t) => t.associationDirection);
    expect(dirs).toHaveLength(10);
    expect(dirs.every((d) => ["sign_to_action", "action_to_sign"].includes(d))).toBe(true);
    // After sort by generation order, adjacent tasks should alternate
    // (We can't test shuffle order, but we test both values appear)
    expect(dirs.filter((d) => d === "sign_to_action").length).toBeGreaterThan(0);
    expect(dirs.filter((d) => d === "action_to_sign").length).toBeGreaterThan(0);
  });

  it("sign_to_action: all tasks have sign_to_action direction", () => {
    const tasks = generateTasks("operation_action_from_sign", CARDS, 8, { direction: "sign_to_action" });
    expect(tasks.every((t) => t.associationDirection === "sign_to_action")).toBe(true);
  });

  it("action_to_sign: all tasks have action_to_sign direction", () => {
    const tasks = generateTasks("operation_action_from_sign", CARDS, 8, { direction: "action_to_sign" });
    expect(tasks.every((t) => t.associationDirection === "action_to_sign")).toBe(true);
  });

  it("default direction is alternating (both values present)", () => {
    const tasks = generateTasks("operation_action_from_sign", CARDS, 10, {});
    const dirs = tasks.map((t) => t.associationDirection);
    expect(dirs.filter((d) => d === "sign_to_action").length).toBeGreaterThan(0);
    expect(dirs.filter((d) => d === "action_to_sign").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Шаг 2: Убедиться что тесты падают**

```bash
npx vitest run src/topics/renderers/addition_subtraction/engine.test.js
```

Ожидаемый результат: тест "sign_to_action: all tasks..." падает (сейчас всё случайно).

- [ ] **Шаг 3: Реализовать в engine.js**

Добавить вспомогательную функцию перед `buildOperationTask`:
```js
function resolveAssociationDirection(modeType, params, taskIndex) {
  if (modeType !== "operation_action_from_sign") return undefined;
  const direction = params.direction ?? "alternating";
  if (direction === "sign_to_action") return "sign_to_action";
  if (direction === "action_to_sign") return "action_to_sign";
  if (direction === "random") return Math.random() < 0.5 ? "sign_to_action" : "action_to_sign";
  return taskIndex % 2 === 0 ? "sign_to_action" : "action_to_sign";
}
```

Обновить сигнатуру `buildOperationTask`:
```js
function buildOperationTask(modeType, card, params = {}, taskIndex = 0) {
```

Заменить строку с `associationDirection`:
```js
// было:
const associationDirection = modeType === "operation_action_from_sign"
  ? (Math.random() < 0.5 ? "sign_to_action" : "action_to_sign")
  : undefined;
// стало:
const associationDirection = resolveAssociationDirection(modeType, params, taskIndex);
```

Обновить вызов в `generateTasks`:
```js
// было:
return shuffle(Array.from({ length: count }, (_, index) =>
  buildOperationTask(modeType, operationCards[index % operationCards.length], params)
));
// стало:
return shuffle(Array.from({ length: count }, (_, index) =>
  buildOperationTask(modeType, operationCards[index % operationCards.length], params, index)
));
```

- [ ] **Шаг 4: Прогнать тесты**

```bash
npx vitest run src/topics/renderers/addition_subtraction/engine.test.js
```

Ожидаемый результат: все тесты зелёные.

- [ ] **Шаг 5: Коммит**

```bash
git add src/topics/renderers/addition_subtraction/engine.js src/topics/renderers/addition_subtraction/engine.test.js
git commit -m "feat(addition-subtraction): add direction param to mode-4 engine"
```

---

## Task 3: Адаптивный CSS для режимов 3 и 4

**Files:**
- Modify: `src/styles.css`

Режимы 3 и 4 должны корректно работать на:
- Телефон портрет (≤ 480px шириной)
- Телефон ландшафт (≥ 568px шириной, ≤ 430px высотой)
- Планшет портрет (768px+)
- Планшет ландшафт (уже работает — существующий `@media (min-width: 768px) and (orientation: landscape)`)

- [ ] **Шаг 1: Добавить CSS для портретного телефона**

Найти в `src/styles.css` строку `@media (max-width: 520px)` (около строки 13637). Добавить в этот блок:

```css
  /* Mode 3: stick responsive on narrow portrait */
  .operation-stick__bead {
    max-width: clamp(24px, 8.5vw, 44px);
  }

  .operation-stick__track {
    gap: clamp(1px, 0.5vw, 3px);
  }

  .operation-stick-caption {
    font-size: 1rem;
  }

  /* Mode 4: link-drill tighter on narrow screens */
  .operation-link-drill {
    min-height: 180px;
  }
```

- [ ] **Шаг 2: Добавить CSS для ландшафтного телефона**

После блока `@media (min-width: 768px) and (orientation: landscape)` (около строки 14007), добавить новый блок:

```css
@media (max-width: 767px) and (orientation: landscape) {
  .operation-stage {
    min-height: auto;
    padding-block: 6px;
    gap: 8px;
  }

  .operation-stage--stick {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: center;
  }

  .operation-stick {
    width: 100%;
  }

  .operation-stick__bead {
    max-width: clamp(28px, 6vw, 52px);
  }

  .operation-expression {
    --operation-expression-font-size: min(clamp(1.8rem, 10vw, 4rem), calc((100dvh - 80px) / 5));
  }

  .operation-link-drill {
    min-height: 160px;
    flex-direction: row;
    align-items: center;
    gap: 20px;
  }

  .operation-link-drill__symbol,
  .operation-link-drill__verb {
    flex: 0 0 auto;
  }
}
```

- [ ] **Шаг 3: Проверить на реальных размерах**

Открыть DevTools, проверить следующие конфигурации:
- iPhone SE (375×667 портрет) — палка и link-drill не обрезаются
- iPhone SE (667×375 ландшафт) — все элементы помещаются
- iPad (768×1024 портрет) — корректный размер
- iPad landscape (1024×768) — уже работало

- [ ] **Шаг 4: Коммит**

```bash
git add src/styles.css
git commit -m "fix(addition-subtraction): responsive layout for modes 3 and 4"
```

---

## Task 4: Движок для режимов 5 и 6

**Files:**
- Modify: `src/topics/renderers/addition_subtraction/engine.js`
- Modify: `src/topics/renderers/addition_subtraction/engine.test.js`

Режимы 5 (`operation_find_sign`) и 6 (`operation_result`) уже работают через `buildOperationTask` — тип задачи пишется в `task.type`. Нужно только прокинуть дополнительные params в задачу.

- [ ] **Шаг 1: Написать тесты**

Добавить в `engine.test.js`:
```js
describe("operation_find_sign", () => {
  it("task has sign as answer field", () => {
    const tasks = generateTasks("operation_find_sign", CARDS, 5, { maxNumber: 10 });
    expect(tasks.every((t) => t.type === "operation_find_sign")).toBe(true);
    expect(tasks.every((t) => ["+", "-"].includes(t.sign))).toBe(true);
  });

  it("passes showHelper param to task", () => {
    const [task] = generateTasks("operation_find_sign", CARDS, 1, { showHelper: true });
    expect(task.showHelper).toBe(true);
  });
});

describe("operation_result", () => {
  it("passes inputMode and timer to task", () => {
    const [task] = generateTasks("operation_result", CARDS, 1, { inputMode: "pad", timer: 10 });
    expect(task.inputMode).toBe("pad");
    expect(task.timer).toBe(10);
  });

  it("inputMode defaults to choices", () => {
    const [task] = generateTasks("operation_result", CARDS, 1, {});
    expect(task.inputMode).toBe("choices");
  });
});
```

- [ ] **Шаг 2: Убедиться что тесты падают**

```bash
npx vitest run src/topics/renderers/addition_subtraction/engine.test.js
```

- [ ] **Шаг 3: Добавить params в buildOperationTask**

В конце `buildOperationTask`, перед `return` для operation `add`, добавить:
```js
const extraParams = {
  showHelper: Boolean(params.showHelper),
  inputMode: params.inputMode ?? "choices",
  timer: params.timer ?? null,
};
```

И включить `...extraParams` в оба возвращаемых объекта (`add` и `subtract`):
```js
// В блоке if (operation === "add"):
return {
  type: modeType,
  cardId: card.id,
  conceptId: card.conceptId,
  operation,
  sign: "+",
  action: "add",
  actionLabel: "добавь",
  start,
  delta,
  result,
  maxNumber,
  railSize,
  associationDirection,
  resultOptions: makeNumberOptions(result, maxNumber),
  ...extraParams,
};

// В блоке subtract:
return {
  type: modeType,
  cardId: card.id,
  conceptId: card.conceptId,
  operation,
  sign: "-",
  action: "remove",
  actionLabel: "убери",
  start,
  delta,
  result,
  maxNumber,
  railSize,
  associationDirection,
  resultOptions: makeNumberOptions(result, maxNumber),
  ...extraParams,
};
```

- [ ] **Шаг 4: Прогнать все тесты**

```bash
npx vitest run src/topics/renderers/addition_subtraction/engine.test.js
```

Все зелёные.

- [ ] **Шаг 5: Коммит**

```bash
git add src/topics/renderers/addition_subtraction/engine.js src/topics/renderers/addition_subtraction/engine.test.js
git commit -m "feat(addition-subtraction): pass showHelper/inputMode/timer params to tasks"
```

---

## Task 5: HelperPanel — компонент хелпера

**Files:**
- Create: `src/topics/renderers/addition_subtraction/HelperPanel.jsx`
- Modify: `src/styles.css`

Хелпер — простой счётчик с кнопками ±. Не использует drag/stick из режима 3 чтобы не создавать путаницу. Ребёнок тапает + / − и видит число. Это позволяет посчитать без автоответа.

- [ ] **Шаг 1: Создать HelperPanel.jsx**

```jsx
import { useState } from "react";

export default function HelperPanel({ maxNumber = 10, onClose }) {
  const [count, setCount] = useState(0);

  function decrement() {
    setCount((prev) => Math.max(0, prev - 1));
  }

  function increment() {
    setCount((prev) => Math.min(maxNumber, prev + 1));
  }

  return (
    <div className="helper-panel" role="dialog" aria-label="Счётный помощник">
      <div className="helper-panel__inner">
        <div className="helper-panel__counter">
          <button
            type="button"
            className="helper-panel__btn helper-panel__btn--minus"
            onClick={decrement}
            disabled={count === 0}
            aria-label="Убрать один"
          >
            −
          </button>
          <span className="helper-panel__count" aria-live="polite">{count}</span>
          <button
            type="button"
            className="helper-panel__btn helper-panel__btn--plus"
            onClick={increment}
            disabled={count === maxNumber}
            aria-label="Добавить один"
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="helper-panel__close"
          onClick={onClose}
          aria-label="Закрыть помощник"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Шаг 2: Добавить CSS в styles.css**

Найти строку `/* ─── Settings ───` (около строки 14032). Вставить перед ней:

```css
/* ─── Helper Panel ───────────────────────────────────────────────────────── */
.helper-panel {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.helper-panel__inner {
  background: #fff;
  border-radius: 20px 20px 0 0;
  padding: 24px 20px 28px;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.helper-panel__counter {
  display: flex;
  align-items: center;
  gap: 24px;
}

.helper-panel__btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  font-size: 2.4rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, transform 0.1s;
  line-height: 1;
}

.helper-panel__btn--minus {
  background: #fee2e2;
  color: #c04040;
}

.helper-panel__btn--plus {
  background: #dcfce7;
  color: #1f7a6f;
}

.helper-panel__btn:not(:disabled):active {
  transform: scale(0.93);
}

.helper-panel__btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.helper-panel__count {
  font-size: 3.6rem;
  font-weight: 800;
  min-width: 80px;
  text-align: center;
  color: #1a1a1a;
  font-variant-numeric: tabular-nums;
}

.helper-panel__close {
  background: #f3f4f6;
  border: none;
  border-radius: 12px;
  padding: 10px 28px;
  font-size: 0.95rem;
  color: #555;
  cursor: pointer;
  font-family: inherit;
}

.helper-toggle-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: #f3f4f6;
  font-size: 1.4rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  transition: background 0.12s;
}

.helper-toggle-btn:active {
  background: #e5e7eb;
}
```

- [ ] **Шаг 3: Коммит**

```bash
git add src/topics/renderers/addition_subtraction/HelperPanel.jsx src/styles.css
git commit -m "feat(addition-subtraction): add HelperPanel counter component"
```

---

## Task 6: Режим 5 — «Найди знак» (рендерер + CSS)

**Files:**
- Modify: `src/topics/renderers/addition_subtraction/index.jsx`
- Modify: `src/styles.css`

- [ ] **Шаг 1: Добавить компонент FindSignTask в index.jsx**

Добавить новый компонент после `ManipulationTask` (перед `OperationTask`):

```jsx
function FindSignTask({ task, onCorrect, onIncorrect }) {
  const [selected, setSelected] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);

  function handleAnswer(value) {
    if (selected != null) return;
    setSelected(value);
    if (value === task.sign) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }

  return (
    <div className="operation-stage operation-stage--find-sign">
      <OperationExpression task={task} missingSign answered={selected === task.sign} />
      <ChoiceGrid
        options={SIGN_OPTIONS}
        selected={selected}
        answer={task.sign}
        variant="large-signs"
        onAnswer={handleAnswer}
      />
      {task.showHelper && (
        <button
          type="button"
          className="helper-toggle-btn"
          onClick={() => setHelperOpen(true)}
          aria-label="Открыть помощник"
        >
          🧮
        </button>
      )}
      {helperOpen && (
        <HelperPanel maxNumber={task.maxNumber} onClose={() => setHelperOpen(false)} />
      )}
    </div>
  );
}
```

- [ ] **Шаг 2: Добавить импорт HelperPanel в index.jsx**

В начало файла (после существующих импортов):
```jsx
import HelperPanel from "./HelperPanel";
```

- [ ] **Шаг 3: Добавить ветку в OperationTask**

В функции `OperationTask`, после блока `if (type === "operation_do_action")`:
```jsx
if (type === "operation_find_sign") {
  return (
    <FindSignTask
      task={task}
      onCorrect={onCorrect}
      onIncorrect={onIncorrect}
    />
  );
}
```

- [ ] **Шаг 4: Добавить CSS для operation-stage--find-sign**

В `src/styles.css`, в раздел `/* ─── Helper Panel ───` (перед ним), добавить:

```css
/* ─── Mode 5: Find Sign ─────────────────────────────────────────────────── */
.operation-stage--find-sign {
  position: relative;
  justify-content: center;
  gap: 32px;
}

.operation-stage--find-sign .operation-expression {
  --operation-expression-font-size: min(clamp(3rem, 18vw, 9rem), calc((100dvw - 36px) / 4.5));
}

.operation-stage--find-sign .operation-choice-grid--large-signs {
  gap: 20px;
}

@media (max-width: 520px) {
  .operation-stage--find-sign {
    gap: 20px;
  }
}
```

- [ ] **Шаг 5: Проверить в браузере**

Запустить `npm run dev`. Протестировать режим `operation_find_sign`:
- Выражение `3 ? 2 = 5` крупное по центру
- Две большие кнопки `+` и `−`
- Кнопка хелпера (при `showHelper: true`)
- Хелпер открывается, работает ±, закрывается
- Правильный ответ — зелёная подсветка, неправильный — красная встряска

- [ ] **Шаг 6: Коммит**

```bash
git add src/topics/renderers/addition_subtraction/index.jsx src/styles.css
git commit -m "feat(addition-subtraction): implement mode 5 FindSign renderer"
```

---

## Task 7: Режим 6 — «Сколько стало?» (рендерер + CSS)

**Files:**
- Modify: `src/topics/renderers/addition_subtraction/index.jsx`
- Modify: `src/styles.css`

- [ ] **Шаг 1: Добавить компонент ResultTask**

Добавить в `index.jsx` после `FindSignTask`:

```jsx
function TimerBar({ seconds, onExpire }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const id = setTimeout(() => setRemaining((prev) => prev - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, onExpire]);

  const pct = Math.max(0, (remaining / seconds) * 100);
  return (
    <div className="operation-timer" role="timer" aria-label={`${remaining} секунд`}>
      <div className="operation-timer__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ResultTask({ task, onCorrect, onIncorrect }) {
  const [selected, setSelected] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const answered = selected != null;

  function handleAnswer(value) {
    if (answered) return;
    setSelected(value);
    if (value === task.result) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }

  return (
    <div className="operation-stage operation-stage--result">
      <OperationExpression
        task={task}
        missingResult={selected !== task.result}
        answered={selected === task.result}
      />
      {task.inputMode === "pad" ? (
        <NumberPad
          maxNumber={task.maxNumber}
          answer={task.result}
          selected={selected}
          onAnswer={handleAnswer}
        />
      ) : (
        <NumberChoices
          task={task}
          selected={selected}
          onAnswer={handleAnswer}
        />
      )}
      {task.timer != null && !answered && (
        <TimerBar seconds={task.timer} onExpire={() => handleAnswer(-1)} />
      )}
      {task.showHelper && (
        <button
          type="button"
          className="helper-toggle-btn"
          onClick={() => setHelperOpen(true)}
          aria-label="Открыть помощник"
        >
          🧮
        </button>
      )}
      {helperOpen && (
        <HelperPanel maxNumber={task.maxNumber} onClose={() => setHelperOpen(false)} />
      )}
    </div>
  );
}
```

- [ ] **Шаг 2: Добавить ветку в OperationTask**

После блока `operation_find_sign`:
```jsx
if (type === "operation_result") {
  return (
    <ResultTask
      task={task}
      onCorrect={onCorrect}
      onIncorrect={onIncorrect}
    />
  );
}
```

- [ ] **Шаг 3: Добавить CSS**

В `src/styles.css` добавить после секции `/* ─── Mode 5: Find Sign ───`:

```css
/* ─── Mode 6: Result ────────────────────────────────────────────────────── */
.operation-stage--result {
  position: relative;
  justify-content: center;
  gap: 28px;
}

.operation-stage--result .operation-expression {
  --operation-expression-font-size: min(clamp(2.8rem, 16vw, 8rem), calc((100dvw - 36px) / 5.8));
}

.operation-timer {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.operation-timer__bar {
  height: 100%;
  background: #1f7a6f;
  border-radius: 4px;
  transition: width 1s linear;
}

@media (max-width: 520px) {
  .operation-stage--result {
    gap: 18px;
  }
}
```

- [ ] **Шаг 4: Проверить в браузере**

- Режим `operation_result` с `inputMode: "choices"` — 4 варианта
- С `inputMode: "pad"` — числовая клавиатура
- С `timer: 10` — таймер-полоска убывает
- По истечении таймера фиксируется неправильный ответ
- Хелпер работает

- [ ] **Шаг 5: Коммит**

```bash
git add src/topics/renderers/addition_subtraction/index.jsx src/styles.css
git commit -m "feat(addition-subtraction): implement mode 6 Result renderer with timer"
```

---

## Task 8: Режим 7 — движок цепочки

**Files:**
- Create: `src/topics/renderers/addition_subtraction/ModeChain.test.js`
- Modify: `src/topics/renderers/addition_subtraction/engine.js`

- [ ] **Шаг 1: Написать тесты**

Создать файл `ModeChain.test.js`:

```js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  { id: "op_plus",  conceptId: "plus",  primary: true, renderer: "addition_subtraction", params: { operation: "add" } },
  { id: "op_minus", conceptId: "minus", primary: true, renderer: "addition_subtraction", params: { operation: "subtract" } },
];

describe("operation_chain engine", () => {
  it("generates chain tasks with correct shape", () => {
    const tasks = generateTasks("operation_chain", CARDS, 6, { maxNumber: 10, changeMax: 3 });
    expect(tasks).toHaveLength(6);
    for (const t of tasks) {
      expect(t.type).toBe("operation_chain");
      expect(t.numbers).toHaveLength(3);
      expect(t.signs).toHaveLength(2);
      expect(t.intermediate).toBeTypeOf("number");
      expect(t.result).toBeTypeOf("number");
    }
  });

  it("intermediate is arithmetically correct", () => {
    const tasks = generateTasks("operation_chain", CARDS, 20, { maxNumber: 10, changeMax: 3 });
    for (const t of tasks) {
      const [A, B] = t.numbers;
      const expected = t.signs[0] === "+" ? A + B : A - B;
      expect(t.intermediate).toBe(expected);
    }
  });

  it("result is arithmetically correct", () => {
    const tasks = generateTasks("operation_chain", CARDS, 20, { maxNumber: 10, changeMax: 3 });
    for (const t of tasks) {
      const C = t.numbers[2];
      const expected = t.signs[1] === "+" ? t.intermediate + C : t.intermediate - C;
      expect(t.result).toBe(expected);
    }
  });

  it("all values stay within maxNumber bounds", () => {
    const tasks = generateTasks("operation_chain", CARDS, 30, { maxNumber: 8, changeMax: 3 });
    for (const t of tasks) {
      expect(t.numbers[0]).toBeGreaterThanOrEqual(1);
      expect(t.numbers[0]).toBeLessThanOrEqual(8);
      expect(t.intermediate).toBeGreaterThanOrEqual(1);
      expect(t.intermediate).toBeLessThanOrEqual(8);
      expect(t.result).toBeGreaterThanOrEqual(1);
      expect(t.result).toBeLessThanOrEqual(8);
    }
  });

  it("intermediateOptions contains the intermediate value", () => {
    const tasks = generateTasks("operation_chain", CARDS, 5, { maxNumber: 10 });
    for (const t of tasks) {
      expect(t.intermediateOptions).toContain(t.intermediate);
    }
  });
});
```

- [ ] **Шаг 2: Убедиться что тесты падают**

```bash
npx vitest run src/topics/renderers/addition_subtraction/ModeChain.test.js
```

- [ ] **Шаг 3: Добавить buildChainTask в engine.js**

Добавить после `buildOperationTask`:

```js
function buildChainTask(card, params = {}) {
  const maxNumber = Math.max(4, Math.min(DEFAULT_RAIL_SIZE, toNumber(params.maxNumber, 10)));
  const changeMax = Math.max(1, Math.min(Math.floor(maxNumber / 3), toNumber(params.changeMax, DEFAULT_CHANGE_MAX)));
  const operationParam = params.operation ?? "both";

  function pickOp() {
    if (operationParam === "add") return "add";
    if (operationParam === "subtract") return "subtract";
    return Math.random() < 0.5 ? "add" : "subtract";
  }

  const op1 = pickOp();
  const op2 = pickOp();
  const d1 = randomInt(1, changeMax);
  const d2 = randomInt(1, changeMax);

  let A, mid;

  if (op1 === "add") {
    const maxA = op2 === "add" ? maxNumber - d1 - d2 : maxNumber - d1;
    if (maxA < 1) return buildChainTask(card, params);
    A = randomInt(1, maxA);
    mid = A + d1;
  } else {
    const minA = op2 === "subtract" ? d1 + d2 + 1 : d1 + 1;
    if (minA > maxNumber) return buildChainTask(card, params);
    A = randomInt(minA, maxNumber);
    mid = A - d1;
  }

  const result = op2 === "add" ? mid + d2 : mid - d2;
  if (result < 1 || result > maxNumber) return buildChainTask(card, params);

  return {
    type: "operation_chain",
    cardId: card.id,
    conceptId: card.conceptId,
    numbers: [A, d1, d2],
    signs: [op1 === "add" ? "+" : "-", op2 === "add" ? "+" : "-"],
    operations: [op1, op2],
    intermediate: mid,
    result,
    maxNumber,
    showHelper: Boolean(params.showHelper),
    intermediateOptions: makeNumberOptions(mid, maxNumber),
    resultOptions: makeNumberOptions(result, maxNumber),
  };
}
```

- [ ] **Шаг 4: Подключить buildChainTask в generateTasks**

В функции `generateTasks`, перед строкой `return shuffle(...)`:

```js
if (modeType === "operation_chain") {
  return shuffle(Array.from({ length: count }, () =>
    buildChainTask(operationCards[Math.floor(Math.random() * operationCards.length)], params)
  ));
}
```

- [ ] **Шаг 5: Прогнать тесты**

```bash
npx vitest run src/topics/renderers/addition_subtraction/ModeChain.test.js
```

Все зелёные.

- [ ] **Шаг 6: Прогнать все тесты**

```bash
npx vitest run src/topics/renderers/addition_subtraction/
```

- [ ] **Шаг 7: Коммит**

```bash
git add src/topics/renderers/addition_subtraction/engine.js src/topics/renderers/addition_subtraction/ModeChain.test.js
git commit -m "feat(addition-subtraction): chain task generation for mode 7"
```

---

## Task 9: Режим 7 — рендерер цепочки (ModeChain.jsx + CSS)

**Files:**
- Create: `src/topics/renderers/addition_subtraction/ModeChain.jsx`
- Modify: `src/topics/renderers/addition_subtraction/index.jsx`
- Modify: `src/styles.css`

- [ ] **Шаг 1: Создать ModeChain.jsx**

```jsx
import { useState } from "react";
import HelperPanel from "./HelperPanel";

function ChainExpression({ numbers, signs, step, intermediateValue }) {
  const [A, B, C] = numbers;
  const [s1, s2] = signs;

  return (
    <div className="chain-expression" aria-label="цепочка">
      {step === 0 && (
        <>
          <span className="chain-expression__group chain-expression__group--active">
            <span className="chain-expression__num">{A}</span>
            <span className={`chain-expression__sign chain-expression__sign--${s1 === "+" ? "add" : "sub"}`}>{s1}</span>
            <span className="chain-expression__num">{B}</span>
          </span>
          <span className={`chain-expression__sign chain-expression__sign--${s2 === "+" ? "add" : "sub"} chain-expression__sign--dim`}>{s2}</span>
          <span className="chain-expression__num chain-expression__num--dim">{C}</span>
          <span className="chain-expression__equals">=</span>
          <span className="chain-expression__num chain-expression__num--unknown">?</span>
        </>
      )}
      {step === 1 && (
        <>
          <span className="chain-expression__group chain-expression__group--active">
            <span className="chain-expression__num">{intermediateValue}</span>
            <span className={`chain-expression__sign chain-expression__sign--${s2 === "+" ? "add" : "sub"}`}>{s2}</span>
            <span className="chain-expression__num">{C}</span>
          </span>
          <span className="chain-expression__equals">=</span>
          <span className="chain-expression__num chain-expression__num--unknown">?</span>
        </>
      )}
    </div>
  );
}

function NumberChoiceRow({ options, selected, answer, onAnswer }) {
  return (
    <div className="chain-choices">
      {options.map((value) => {
        const isSelected = selected === value;
        const isCorrect = selected != null && value === answer;
        const isWrong = isSelected && value !== answer;
        return (
          <button
            key={value}
            type="button"
            className={[
              "chain-choice",
              isCorrect ? "chain-choice--correct" : "",
              isWrong ? "chain-choice--wrong" : "",
            ].filter(Boolean).join(" ")}
            disabled={selected != null}
            onClick={() => onAnswer(value)}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

export default function ModeChain({ task, onCorrect, onIncorrect, onMistake }) {
  const [step, setStep] = useState(0);
  const [intermediateSelected, setIntermediateSelected] = useState(null);
  const [resultSelected, setResultSelected] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);

  function handleIntermediate(value) {
    if (intermediateSelected != null) return;
    setIntermediateSelected(value);
    if (value === task.intermediate) {
      setTimeout(() => setStep(1), 600);
    } else {
      onMistake?.(task.conceptId, task.cardId);
    }
  }

  function handleResult(value) {
    if (resultSelected != null) return;
    setResultSelected(value);
    if (value === task.result) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }

  const caption = step === 0
    ? "Реши первую часть"
    : "Теперь до конца";

  return (
    <div className="operation-stage operation-stage--chain">
      <ChainExpression
        numbers={task.numbers}
        signs={task.signs}
        step={step}
        intermediateValue={intermediateSelected === task.intermediate ? task.intermediate : null}
      />
      <div className="chain-caption">{caption}</div>
      {step === 0 && (
        <NumberChoiceRow
          options={task.intermediateOptions}
          selected={intermediateSelected}
          answer={task.intermediate}
          onAnswer={handleIntermediate}
        />
      )}
      {step === 1 && (
        <NumberChoiceRow
          options={task.resultOptions}
          selected={resultSelected}
          answer={task.result}
          onAnswer={handleResult}
        />
      )}
      {task.showHelper && (
        <button
          type="button"
          className="helper-toggle-btn"
          onClick={() => setHelperOpen(true)}
          aria-label="Открыть помощник"
        >
          🧮
        </button>
      )}
      {helperOpen && (
        <HelperPanel maxNumber={task.maxNumber} onClose={() => setHelperOpen(false)} />
      )}
    </div>
  );
}
```

- [ ] **Шаг 2: Подключить ModeChain в index.jsx**

Добавить импорт в начало файла:
```jsx
import ModeChain from "./ModeChain";
```

В функции `OperationTask`, добавить ветку:
```jsx
if (type === "operation_chain") {
  return (
    <ModeChain
      task={task}
      onCorrect={onCorrect}
      onIncorrect={onIncorrect}
      onMistake={onMistake}
    />
  );
}
```

- [ ] **Шаг 3: Добавить CSS**

В `src/styles.css` добавить после секции `/* ─── Mode 6: Result ───`:

```css
/* ─── Mode 7: Chain ─────────────────────────────────────────────────────── */
.operation-stage--chain {
  position: relative;
  justify-content: center;
  gap: 24px;
}

.chain-expression {
  display: flex;
  align-items: center;
  gap: clamp(4px, 2vw, 12px);
  flex-wrap: nowrap;
  font-variant-numeric: tabular-nums;
}

.chain-expression__group {
  display: flex;
  align-items: center;
  gap: clamp(4px, 1.5vw, 10px);
  background: #f0f9f6;
  border-radius: 16px;
  padding: 6px 12px;
  border: 2px solid #1f7a6f33;
}

.chain-expression__group--active {
  border-color: #1f7a6f;
  background: #e8f7f3;
}

.chain-expression__num {
  font-size: clamp(2rem, 10vw, 5rem);
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1.1;
}

.chain-expression__num--dim {
  opacity: 0.38;
}

.chain-expression__num--unknown {
  color: #888;
  font-style: italic;
}

.chain-expression__sign {
  font-size: clamp(1.8rem, 8vw, 4rem);
  font-weight: 700;
  line-height: 1;
}

.chain-expression__sign--add  { color: #1f7a6f; }
.chain-expression__sign--sub  { color: #c04040; }
.chain-expression__sign--dim  { opacity: 0.3; }

.chain-expression__equals {
  font-size: clamp(1.8rem, 8vw, 4rem);
  color: #888;
  font-weight: 700;
}

.chain-caption {
  font-size: 0.95rem;
  color: #666;
  text-align: center;
}

.chain-choices {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.chain-choice {
  min-width: 64px;
  height: 64px;
  border-radius: 16px;
  border: 2px solid #e0e0e0;
  background: #fff;
  font-size: 1.8rem;
  font-weight: 700;
  color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
  font-family: inherit;
}

.chain-choice:not(:disabled):active {
  background: #f3f4f6;
}

.chain-choice--correct {
  border-color: #1f7a6f;
  background: #e8f7f3;
  color: #1f5f57;
}

.chain-choice--wrong {
  border-color: #ef6f5e;
  background: #fff4ee;
  color: #9f3029;
}

.chain-choice:disabled {
  cursor: default;
}

@media (max-width: 520px) {
  .chain-expression__group {
    padding: 4px 8px;
    border-radius: 12px;
  }

  .chain-choice {
    min-width: 56px;
    height: 56px;
    font-size: 1.5rem;
  }
}
```

- [ ] **Шаг 4: Проверить в браузере**

- Шаг 1: выражение `[2 + 3] − 1 = ?` с активной группой, варианты ответа
- Правильный ответ → пауза 600мс → шаг 2: `[5 − 1] = ?`
- Правильный финальный ответ → onCorrect
- Неправильный на шаге 1 → ошибка, не переходит к шагу 2
- Хелпер работает

- [ ] **Шаг 5: Коммит**

```bash
git add src/topics/renderers/addition_subtraction/ModeChain.jsx src/topics/renderers/addition_subtraction/index.jsx src/styles.css
git commit -m "feat(addition-subtraction): implement mode 7 Chain renderer"
```

---

## Task 10: Заглушки для режимов 1–2

**Files:**
- Modify: `src/topics/renderers/addition_subtraction/index.jsx`

- [ ] **Шаг 1: Добавить PlaceholderTask компонент**

Добавить в `index.jsx` перед `OperationTask`:

```jsx
function PlaceholderTask() {
  return (
    <div className="operation-stage operation-stage--placeholder">
      <div className="operation-placeholder-text">Скоро</div>
    </div>
  );
}
```

- [ ] **Шаг 2: Добавить ветки в OperationTask**

```jsx
if (type === "operation_observe" || type === "operation_name_action") {
  return <PlaceholderTask />;
}
```

- [ ] **Шаг 3: Добавить минимальный CSS**

```css
.operation-stage--placeholder {
  justify-content: center;
  align-items: center;
}

.operation-placeholder-text {
  font-size: 2rem;
  color: #ccc;
  font-weight: 600;
}
```

- [ ] **Шаг 4: Коммит**

```bash
git add src/topics/renderers/addition_subtraction/index.jsx src/styles.css
git commit -m "feat(addition-subtraction): add placeholder stubs for modes 1-2"
```

---

## Task 11: topic.json — источник деки

**Files:**
- Create: `tools/addition_subtraction/topic.json`

- [ ] **Шаг 1: Создать tools/addition_subtraction/**

```bash
mkdir -p tools/addition_subtraction
```

- [ ] **Шаг 2: Создать topic.json**

Создать файл `tools/addition_subtraction/topic.json`:

```json
{
  "meta": {
    "id": "addition_subtraction",
    "version": "1.2.0",
    "minAppVersion": "1.0.2",
    "language": "ru",
    "cardType": "procedural",
    "renderer": "addition_subtraction",
    "title": { "ru": "Плюс и минус", "en": "Addition and Subtraction" },
    "description": {
      "ru": "Педагогическая лестница: от действия с фишками до цепочек из двух операций.",
      "en": "Pedagogical ladder: from bead manipulation to two-step expression chains."
    },
    "about": {
      "ru": ["Семь ступеней от конкретного к абстрактному. Специалист настраивает уровень для каждого ребёнка."],
      "en": ["Seven steps from concrete to abstract. The specialist configures the level for each child."]
    },
    "conceptCount": 2,
    "sessionConfig": { "maxSize": 12 }
  },
  "modes": [
    {
      "id": "operation_observe",
      "type": "operation_observe",
      "evaluation": "auto",
      "ui": { "title": "1. Смотри — что случилось", "instruction": "Скоро" }
    },
    {
      "id": "operation_name_action",
      "type": "operation_name_action",
      "evaluation": "auto",
      "ui": { "title": "2. Было — стало", "instruction": "Скоро" }
    },
    {
      "id": "operation_do_action",
      "type": "operation_do_action",
      "evaluation": "auto",
      "params": { "maxNumber": 5, "changeMax": 2 },
      "ui": { "title": "3. Сделай действие", "instruction": "Покажи на палке" },
      "methodology": {
        "text": "Конкретный этап: ребёнок сам выставляет начальное число фишек и физически выполняет операцию (прибавляет или убирает). Затем называет результат. Строит телесный якорь для понятия «прибавить/убрать».",
        "tips": [
          "Начинайте с changeMax: 1 — ребёнок прибавляет/убирает по одной фишке.",
          "Комментируйте действие вслух: «Было 3, убрали 1 — стало 2».",
          "Не торопите переход к следующей ступени — твёрдое владение этим уровнем важнее скорости.",
          "Если ребёнок тянется к фишкам сам — хороший знак, поощряйте."
        ],
        "duration": "3–5 мин"
      }
    },
    {
      "id": "operation_sign_action",
      "type": "operation_action_from_sign",
      "evaluation": "auto",
      "params": { "direction": "alternating" },
      "ui": { "title": "4. Знак ↔ Действие", "instruction": "Что это значит?" },
      "methodology": {
        "text": "Связываем знак «+» со словом «прибавить» и «−» со словом «убрать». Задачи чередуют направление: то знак→слово, то слово→знак — это предотвращает машинальное нажатие.",
        "tips": [
          "direction: sign_to_action — если ребёнок только начинает, сначала закрепите одно направление.",
          "direction: alternating — дефолт, когда оба направления знакомы.",
          "Хвалите за паузу и обдуманный ответ, а не за скорость."
        ],
        "duration": "3–5 мин"
      }
    },
    {
      "id": "operation_find_sign",
      "type": "operation_find_sign",
      "evaluation": "auto",
      "params": { "maxNumber": 10, "changeMax": 3, "showHelper": false },
      "ui": { "title": "5. Найди знак", "instruction": "Какой знак?" },
      "methodology": {
        "text": "Ребёнок читает выражение с пропущенным знаком (3 ? 2 = 5) и выбирает «+» или «−». Первый режим работы с математической записью без визуальных подпорок.",
        "tips": [
          "Включайте showHelper: true на старте — ребёнок сам решает, пользоваться ли счётчиком.",
          "Уменьшайте changeMax: 1 для первого знакомства.",
          "Когда ошибок нет — уберите хелпер и увеличьте changeMax."
        ],
        "duration": "3–5 мин"
      }
    },
    {
      "id": "operation_result",
      "type": "operation_result",
      "evaluation": "auto",
      "params": { "maxNumber": 10, "changeMax": 3, "inputMode": "choices", "showHelper": false },
      "ui": { "title": "6. Сколько стало?", "instruction": "Нажми сколько стало" },
      "methodology": {
        "text": "Ребёнок вычисляет результат выражения. inputMode: choices — 4 варианта на выбор. inputMode: pad — вся числовая клавиатура. Таймер (timer: N секунд) создаёт режим fluency.",
        "tips": [
          "Начинайте с inputMode: choices и без таймера.",
          "Переходите к pad когда choices даются уверенно.",
          "Таймер добавляйте последним — он требует автоматизации, а не просто знания."
        ],
        "duration": "3–5 мин"
      }
    },
    {
      "id": "operation_chain",
      "type": "operation_chain",
      "evaluation": "auto",
      "params": { "maxNumber": 10, "changeMax": 3, "operation": "both", "showHelper": false },
      "ui": { "title": "7. Цепочка", "instruction": "Реши шаг за шагом" },
      "methodology": {
        "text": "Двухшаговые цепочки: A + B − C = ? Ребёнок решает первую операцию, видит промежуточный результат, затем решает вторую. Промежуточный ответ визуально встраивается в выражение.",
        "tips": [
          "Начинайте с operation: add — только сложения в цепочке.",
          "operation: both включает смешанные цепочки — самый сложный уровень.",
          "showHelper: true на старте — хелпер помогает при двухшаговом счёте."
        ],
        "duration": "5–7 мин"
      }
    }
  ],
  "cards": [
    {
      "id": "operation_plus",
      "conceptId": "plus",
      "primary": true,
      "label": "Плюс",
      "renderer": "addition_subtraction",
      "params": { "operation": "add" }
    },
    {
      "id": "operation_minus",
      "conceptId": "minus",
      "primary": true,
      "label": "Минус",
      "renderer": "addition_subtraction",
      "params": { "operation": "subtract" }
    }
  ]
}
```

- [ ] **Шаг 3: Коммит**

```bash
git add tools/addition_subtraction/topic.json
git commit -m "feat(addition-subtraction): add source topic.json with all 7 modes"
```

---

## Task 12: Финальная проверка

- [ ] **Шаг 1: Прогнать все тесты**

```bash
npx vitest run src/topics/renderers/addition_subtraction/
```

Все зелёные.

- [ ] **Шаг 2: Сборка**

```bash
npm run build
```

Без ошибок.

- [ ] **Шаг 3: Smoke-тест всех режимов**

Запустить `npm run dev`. Пройти все 7 режимов:

| Режим | Что проверить |
|-------|--------------|
| operation_observe | Экран-заглушка "Скоро" |
| operation_name_action | Экран-заглушка "Скоро" |
| operation_do_action | 3 фазы, новые короткие инструкции, адаптив |
| operation_action_from_sign | Чередование направлений при `direction: "alternating"` |
| operation_find_sign | Чистый экран, большие знаки, хелпер работает |
| operation_result | Choices и pad режимы, таймер, хелпер |
| operation_chain | Двухшаговое решение, подсветка группы, хелпер |

- [ ] **Шаг 4: Финальный коммит**

```bash
git add -A
git commit -m "chore(addition-subtraction): final integration check"
```
