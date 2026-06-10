# operation_missing_term Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить режим «Найди неизвестное» (ступень 9) в тему `addition_subtraction`, который тренирует решение уравнений вида `3 + ❓ = 7` и `❓ − 2 = 5`.

**Architecture:** Новый тип задачи `operation_missing_term` добавляется в существующий engine и рендерер `addition_subtraction` по тому же паттерну, что уже используют режимы 6–7. Никаких новых файлов — только расширение трёх существующих файлов и одного JSON.

**Tech Stack:** Vitest (тесты), React (рендерер), CSS в `src/styles.css`

---

## File map

| Файл | Действие |
|------|----------|
| `src/topics/renderers/addition_subtraction/engine.js` | Modify — добавить `buildMissingTermTask` + ветку в `generateTasks` |
| `src/topics/renderers/addition_subtraction/engine.test.js` | Modify — добавить тесты для нового типа |
| `src/topics/renderers/addition_subtraction/index.jsx` | Modify — добавить `MissingTermExpression`, `MissingTermTask`, ветку в `OperationTask` |
| `src/styles.css` | Modify — добавить `.operation-expression__unknown` |
| `tools/addition_subtraction/topic.json` | Modify — добавить режим 9 |

---

## Task 1: Engine — генерация задач `operation_missing_term`

**Files:**
- Modify: `src/topics/renderers/addition_subtraction/engine.test.js`
- Modify: `src/topics/renderers/addition_subtraction/engine.js`

- [ ] **Step 1.1: Написать падающие тесты**

Добавить в конец `engine.test.js`:

```js
describe("operation_missing_term", () => {
  it("generates tasks with operation_missing_term type", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 5, { operation: "add" });
    expect(tasks.every((t) => t.type === "operation_missing_term")).toBe(true);
  });

  it("right+add: A + ? = C is arithmetically valid", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "add", unknownPosition: "right", maxNumber: 10, changeMax: 3,
    });
    const rightAdd = tasks.filter((t) => t.missingPosition === "right" && t.operation === "add");
    expect(rightAdd.length).toBeGreaterThan(0);
    rightAdd.forEach((t) => {
      expect(t.A).not.toBeNull();
      expect(t.B).toBeNull();
      expect(t.A + t.answer).toBe(t.C);
      expect(t.C).toBeLessThanOrEqual(10);
      expect(t.answer).toBeGreaterThanOrEqual(1);
    });
  });

  it("left+add: ? + B = C is arithmetically valid", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "add", unknownPosition: "left", maxNumber: 10, changeMax: 3,
    });
    tasks.forEach((t) => {
      expect(t.A).toBeNull();
      expect(t.B).not.toBeNull();
      expect(t.answer + t.B).toBe(t.C);
      expect(t.C).toBeLessThanOrEqual(10);
      expect(t.answer).toBeGreaterThanOrEqual(1);
    });
  });

  it("right+subtract: A - ? = C is arithmetically valid", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "subtract", unknownPosition: "right", maxNumber: 10, changeMax: 3,
    });
    tasks.forEach((t) => {
      expect(t.A).not.toBeNull();
      expect(t.B).toBeNull();
      expect(t.A - t.answer).toBe(t.C);
      expect(t.C).toBeGreaterThanOrEqual(1);
      expect(t.answer).toBeGreaterThanOrEqual(1);
    });
  });

  it("left+subtract: ? - B = C is arithmetically valid", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "subtract", unknownPosition: "left", maxNumber: 10, changeMax: 3,
    });
    tasks.forEach((t) => {
      expect(t.A).toBeNull();
      expect(t.B).not.toBeNull();
      expect(t.answer - t.B).toBe(t.C);
      expect(t.answer).toBeLessThanOrEqual(10);
      expect(t.C).toBeGreaterThanOrEqual(1);
    });
  });

  it("both: alternates left and right positions", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "add", unknownPosition: "both", maxNumber: 10,
    });
    const positions = tasks.map((t) => t.missingPosition);
    expect(positions).toContain("left");
    expect(positions).toContain("right");
  });

  it("mixed operation: produces both add and subtract tasks", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 20, {
      operation: "mixed", unknownPosition: "right", maxNumber: 10,
    });
    const ops = tasks.map((t) => t.operation);
    expect(ops).toContain("add");
    expect(ops).toContain("subtract");
  });

  it("resultOptions contain the answer", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 5, { operation: "add", maxNumber: 10 });
    tasks.forEach((t) => {
      expect(t.resultOptions).toContain(t.answer);
      expect(new Set(t.resultOptions).size).toBe(t.resultOptions.length);
    });
  });

  it("passes inputMode and showHelper to task", () => {
    const [t] = generateTasks("operation_missing_term", CARDS, 1, {
      operation: "add", inputMode: "pad", showHelper: true,
    });
    expect(t.inputMode).toBe("pad");
    expect(t.showHelper).toBe(true);
  });

  it("generates requested count", () => {
    const tasks = generateTasks("operation_missing_term", CARDS, 8, { operation: "mixed", maxNumber: 10 });
    expect(tasks).toHaveLength(8);
  });
});
```

- [ ] **Step 1.2: Запустить тесты и убедиться что они падают**

```
npx vitest run src/topics/renderers/addition_subtraction/engine.test.js
```

Ожидаемый результат: все тесты в `operation_missing_term` падают с ошибкой типа "tasks is empty" или "undefined".

- [ ] **Step 1.3: Добавить вспомогательную функцию и `buildMissingTermTask` в `engine.js`**

Добавить после функции `buildChainTask` (перед `export function generateTasks`):

```js
function resolveMissingPosition(unknownPosition, taskIndex) {
  if (unknownPosition === "left")  return "left";
  if (unknownPosition === "right") return "right";
  return taskIndex % 2 === 0 ? "right" : "left";
}

function buildMissingTermTask(card, params = {}, taskIndex = 0) {
  const operation = normalizeOperation(card.params?.operation);
  const railSize = Math.max(3, Math.min(DEFAULT_RAIL_SIZE, toNumber(params.railSize ?? params.maxNumber, DEFAULT_RAIL_SIZE)));
  const maxNumber = railSize;
  const changeMax = Math.max(1, Math.min(maxNumber - 1, toNumber(params.changeMax, DEFAULT_CHANGE_MAX)));
  const includeZero = Boolean(params.includeZero);
  const minVal = includeZero ? 0 : 1;
  const missingPosition = resolveMissingPosition(params.unknownPosition ?? "right", taskIndex);

  const delta = randomInt(1, changeMax);
  let A, B, C, answer;

  if (operation === "add") {
    if (missingPosition === "right") {
      A = randomInt(minVal, Math.max(minVal, maxNumber - delta));
      B = null; answer = delta; C = A + delta;
    } else {
      B = randomInt(minVal, Math.max(minVal, maxNumber - delta));
      A = null; answer = delta; C = B + delta;
    }
  } else {
    if (missingPosition === "right") {
      const minA = delta + minVal;
      if (minA > maxNumber) return null;
      A = randomInt(minA, maxNumber);
      B = null; answer = delta; C = A - delta;
    } else {
      B = randomInt(1, changeMax);
      const maxC = maxNumber - B;
      if (maxC < minVal) return null;
      C = randomInt(minVal, maxC);
      A = null; answer = C + B;
    }
  }

  return {
    type: "operation_missing_term",
    cardId: card.id,
    conceptId: card.conceptId,
    operation,
    sign: operation === "add" ? "+" : "-",
    missingPosition,
    A, B, C, answer,
    maxNumber,
    resultOptions: makeNumberOptions(answer, maxNumber),
    inputMode: params.inputMode ?? "choices",
    showHelper: Boolean(params.showHelper),
  };
}
```

- [ ] **Step 1.4: Добавить ветку `operation_missing_term` в `generateTasks`**

В функции `generateTasks`, перед финальным `return shuffle(Array.from(...))`, добавить:

```js
  if (modeType === "operation_missing_term") {
    const operationParam = params.operation ?? "add";
    let pool;
    if (operationParam === "add")      pool = operationCards.filter((c) => normalizeOperation(c.params?.operation) === "add");
    else if (operationParam === "subtract") pool = operationCards.filter((c) => normalizeOperation(c.params?.operation) === "subtract");
    else                               pool = operationCards;
    if (!pool.length) pool = operationCards;

    const result = [];
    let attempts = 0;
    let idx = 0;
    while (result.length < count && attempts < count * 20) {
      attempts++;
      const card = pool[idx % pool.length];
      const task = buildMissingTermTask(card, params, result.length);
      if (task !== null) { result.push(task); idx++; }
    }
    return shuffle(result);
  }
```

- [ ] **Step 1.5: Запустить тесты и убедиться что все проходят**

```
npx vitest run src/topics/renderers/addition_subtraction/engine.test.js
```

Ожидаемый результат: все тесты PASS, в том числе все новые в `operation_missing_term`.

- [ ] **Step 1.6: Закоммитить**

```bash
git add src/topics/renderers/addition_subtraction/engine.js src/topics/renderers/addition_subtraction/engine.test.js
git commit -m "feat(addition_subtraction): engine — генерация задач operation_missing_term"
```

---

## Task 2: CSS — стиль для символа ❓

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 2.1: Найти точку вставки**

В `src/styles.css` найти строку `.operation-expression__result {` (около строки 14786). Сразу после блока `.operation-expression__result--pop` и `.operation-expression__result--pop-sub` (около строки 15743) добавить новый класс.

- [ ] **Step 2.2: Добавить CSS для unknown**

Добавить после строки `.operation-expression__result--pop-sub { animation: operation-answer-pop .38s ease both; color: #c04040; }`:

```css
.operation-expression__unknown {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--operation-expression-font-size);
  color: #2a6bb5;
  cursor: default;
  min-width: 1.2ch;
}

.operation-expression__unknown--answered {
  animation: operation-answer-pop .38s ease both;
  color: #1f7a6f;
}

.operation-expression__unknown--answered-sub {
  animation: operation-answer-pop .38s ease both;
  color: #c04040;
}
```

- [ ] **Step 2.3: Закоммитить**

```bash
git add src/styles.css
git commit -m "feat(addition_subtraction): CSS стиль для operation-expression__unknown"
```

---

## Task 3: Renderer — компонент MissingTermTask

**Files:**
- Modify: `src/topics/renderers/addition_subtraction/index.jsx`

- [ ] **Step 3.1: Добавить `MissingTermExpression`**

Добавить в `index.jsx` после функции `ChainTask` (перед `OperationTask`):

```jsx
function MissingTermExpression({ task, answered }) {
  const answeredCls = answered
    ? `operation-expression__unknown--answered${task.operation === "subtract" ? "-sub" : ""}`
    : "";

  function renderSlot(value, key) {
    if (value !== null) {
      return <span key={key} className="operation-expression__number">{value}</span>;
    }
    return (
      <span
        key={key}
        className={["operation-expression__unknown", answeredCls].filter(Boolean).join(" ")}
      >
        {answered ? task.answer : "❓"}
      </span>
    );
  }

  return (
    <div className="operation-expression" aria-label="пример">
      {renderSlot(task.A, "left")}
      <span className={`operation-expression__sign operation-expression__sign--${task.operation}`}>{task.sign}</span>
      {renderSlot(task.B, "right")}
      <span className="operation-expression__equals">=</span>
      <span className="operation-expression__number">{task.C}</span>
    </div>
  );
}

function MissingTermTask({ task, onCorrect, onIncorrect }) {
  const [selected, setSelected] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const answered = selected != null;

  const handleAnswer = useCallback((value) => {
    if (answered) return;
    setSelected(value);
    if (value === task.answer) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }, [answered, task, onCorrect, onIncorrect]);

  return (
    <div className="operation-stage operation-stage--missing-term">
      <MissingTermExpression task={task} answered={selected === task.answer} />
      {task.inputMode === "pad" ? (
        <NumberPad
          maxNumber={task.maxNumber}
          answer={task.answer}
          selected={selected}
          onAnswer={handleAnswer}
        />
      ) : (
        <NumberChoices
          task={{ result: task.answer, resultOptions: task.resultOptions }}
          selected={selected}
          onAnswer={handleAnswer}
        />
      )}
      {task.showHelper && !helperOpen && (
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
        <HelperPanel
          maxNumber={task.maxNumber}
          onClose={() => setHelperOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3.2: Зарегистрировать в `OperationTask` и починить `key` в экспорте**

В функции `OperationTask` найти блок:
```js
  if (type === "operation_chain") {
    return <ChainTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }
  return null;
```

Заменить на:
```js
  if (type === "operation_chain") {
    return <ChainTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }
  if (type === "operation_missing_term") {
    return <MissingTermTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }
  return null;
```

Затем найти в `AdditionSubtractionRenderer` строку с `key=`:
```jsx
  return <OperationTask key={`${task.cardId}:${task.start}:${task.delta}:${task.type}:${task.associationDirection ?? ""}`} task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} streakCount={streakCount} />;
```

Заменить `key` чтобы он работал и для нового типа (где `start`/`delta` — undefined):
```jsx
  return <OperationTask key={`${task.cardId}:${task.start ?? task.C}:${task.delta ?? task.answer}:${task.type}:${task.missingPosition ?? task.associationDirection ?? ""}`} task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} streakCount={streakCount} />;
```

- [ ] **Step 3.3: Запустить все тесты чтобы убедиться что ничего не сломалось**

```
npx vitest run
```

Ожидаемый результат: все тесты PASS (включая существующие 84 + новые из Task 1).

- [ ] **Step 3.4: Закоммитить**

```bash
git add src/topics/renderers/addition_subtraction/index.jsx
git commit -m "feat(addition_subtraction): renderer — MissingTermTask компонент"
```

---

## Task 4: topic.json — добавить режим 9

**Files:**
- Modify: `tools/addition_subtraction/topic.json`

- [ ] **Step 4.1: Добавить режим в конец массива `modes`**

В `tools/addition_subtraction/topic.json` найти закрывающую скобку массива `modes` (после блока `operation_worksheet`). Добавить новый элемент перед `]`:

```json
,
{
  "id": "operation_missing_term",
  "type": "operation_missing_term",
  "evaluation": "auto",
  "defaultCardId": "operation_plus",
  "ui": { "title": "9. Найди неизвестное", "instruction": "Какое число спрятано под ❓" },
  "params": {
    "operation": {
      "type": "enum",
      "values": ["add", "subtract", "mixed"],
      "labels": { "ru": { "add": "Только +", "subtract": "Только −", "mixed": "Микс" } },
      "default": "add",
      "label": { "ru": "Операция" }
    },
    "unknownPosition": {
      "type": "enum",
      "values": ["right", "left", "both"],
      "labels": { "ru": { "right": "Правый операнд", "left": "Левый операнд", "both": "Оба" } },
      "default": "right",
      "label": { "ru": "Позиция неизвестного" }
    },
    "maxNumber": {
      "type": "enum",
      "values": [5, 10, 20],
      "labels": { "ru": { "5": "до 5", "10": "до 10", "20": "до 20" } },
      "default": 5,
      "label": { "ru": "Максимальное число" }
    },
    "changeMax": {
      "type": "enum",
      "values": [1, 3, 5, 10, 99],
      "labels": { "ru": { "1": "1", "3": "3", "5": "5", "10": "10", "99": "любое" } },
      "default": 3,
      "label": { "ru": "Максимальное изменение" }
    },
    "inputMode": {
      "type": "enum",
      "values": ["choices", "pad"],
      "labels": { "ru": { "choices": "Варианты ответа", "pad": "Числовая клавиатура" } },
      "default": "choices",
      "label": { "ru": "Тип ввода" }
    },
    "showHelper": {
      "type": "boolean",
      "default": false,
      "label": { "ru": "Кнопка счётного помощника" }
    }
  },
  "methodology": {
    "text": "Девятая ступень: ребёнок находит неизвестный операнд в уравнении. Начинайте с правого неизвестного (easier: считаем от A до C) и операции +. Левое неизвестное сложнее — требует обратного хода мысли. Режим «Оба» вводите после уверенного освоения каждой позиции по отдельности.",
    "tips": [
      "Называйте стратегию вслух: «Смотрим на результат — сколько не хватает?»",
      "Счётный помощник (🧮) помогает отсчитать от C назад — особенно полезен для левого неизвестного.",
      "Начинайте с maxNumber=5 и changeMax=1.",
      "Переходите к X только после уверенного решения с ❓."
    ],
    "duration": "5–8 мин"
  }
}
```

- [ ] **Step 4.2: Закоммитить**

```bash
git add tools/addition_subtraction/topic.json
git commit -m "feat(addition_subtraction): topic.json — режим 9 operation_missing_term"
```

---

## Task 5: Ручная проверка в браузере

**Files:** нет изменений

- [ ] **Step 5.1: Запустить dev-сервер**

```
npm run dev
```

Открыть `http://localhost:8080/` в браузере.

- [ ] **Step 5.2: Проверить все 6 комбинаций параметров**

Открыть тему «Плюс и минус» → режим «9. Найди неизвестное». Проверить:

| operation | unknownPosition | Ожидаемое поведение |
|---|---|---|
| add | right | `A + ❓ = C`, ❓ — правый операнд |
| add | left | `❓ + B = C`, ❓ — левый операнд |
| subtract | right | `A − ❓ = C` |
| subtract | left | `❓ − B = C` |
| mixed | both | чередуются все варианты |
| add | right + showHelper=true | кнопка 🧮 появляется |

- [ ] **Step 5.3: Проверить inputMode=pad**

Сменить параметр `inputMode` на `pad`. Убедиться что появляется числовая клавиатура вместо 4 кнопок.

- [ ] **Step 5.4: Проверить pop-анимацию**

При правильном ответе ❓ должен заменяться числом с зелёной pop-анимацией (или красной для subtract). При неверном — варианты реагируют подсветкой.

- [ ] **Step 5.5: Закоммитить финальный статус (если не было дополнительных правок)**

```bash
git status
# Если clean — деплой готов
npm run deploy:prod
```
