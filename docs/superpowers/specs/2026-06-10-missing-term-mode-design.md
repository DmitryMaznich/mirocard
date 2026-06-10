# Дизайн: режим «Найди неизвестное» (operation_missing_term)

**Дата:** 2026-06-10  
**Тема:** `addition_subtraction` (Плюс и минус)  
**Ступень:** 9 — после режима 6 «Сколько стало?»

---

## Цель

Научить ребёнка решать простейшие уравнения с одним неизвестным в позиции операнда:

- `3 + ❓ = 7` (правый операнд, сложение)
- `❓ + 4 = 9` (левый операнд, сложение)
- `8 − ❓ = 3` (правый операнд, вычитание)
- `❓ − 2 = 5` (левый операнд, вычитание)

Неизвестное обозначается символом `❓`. В будущем — параметр `unknownSymbol: "blank" | "x"` для перехода к алгебраической записи.

---

## Архитектура

Один новый тип режима `operation_missing_term` в существующем рендерере `addition_subtraction`. Следует паттерну всех остальных режимов темы.

**Затрагиваемые файлы:**
- `src/topics/renderers/addition_subtraction/engine.js` — новая функция генерации
- `src/topics/renderers/addition_subtraction/index.jsx` — новый компонент + ветка в `OperationTask`
- `src/topics/renderers/addition_subtraction/engine.test.js` — тесты генерации
- `tools/addition_subtraction/topic.json` — новый режим в списке modes

---

## Task shape

```js
{
  type: "operation_missing_term",
  cardId: string,
  conceptId: string,

  operation: "add" | "subtract",
  sign: "+" | "−",
  missingPosition: "left" | "right",

  A: number | null,   // null если missingPosition === "left"
  B: number | null,   // null если missingPosition === "right"
  C: number,          // результат, всегда известен
  answer: number,     // правильный ответ

  maxNumber: number,
  resultOptions: number[],  // 4 варианта для choices
  inputMode: "choices" | "pad",
  showHelper: boolean,
}
```

### Формулы вычисления answer

| missingPosition | operation  | Формула          |
|-----------------|------------|------------------|
| right           | add        | answer = C − A   |
| left            | add        | answer = C − B   |
| right           | subtract   | answer = A − C   |
| left            | subtract   | answer = C + B   |

### Генерация чисел (без выхода за границы)

**right + add:** A ∈ [1, maxNumber−1], B=answer=C−A, C=A+B ≤ maxNumber  
**left + add:** B ∈ [1, maxNumber−1], A=answer=C−B, C=A+B ≤ maxNumber  
**right + subtract:** C ∈ [1, maxNumber−1], B=answer=A−C, A ∈ [C+1, maxNumber]  
**left + subtract:** B ∈ [1, maxNumber−1], A=answer=C+B, C ∈ [1, maxNumber−B]

Все числа ≥ 1 (если `includeZero: false`). Дистракторы — `makeNumberOptions(answer, maxNumber)` (уже есть в engine).

---

## Параметры режима (topic.json)

```json
{
  "id": "operation_missing_term",
  "type": "operation_missing_term",
  "evaluation": "auto",
  "defaultCardId": "operation_plus",
  "ui": {
    "title": "9. Найди неизвестное",
    "instruction": "Какое число спрятано под ❓"
  },
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
      "Переходите к X (unknownSymbol=x) только после уверенного решения с ❓."
    ],
    "duration": "5–8 мин"
  }
}
```

---

## Компонент MissingTermTask

Структура (~60 строк, по образцу `ResultTask`):

```
┌─────────────────────────────────┐
│      3  +  ❓  =  7             │  ← OperationExpression (missingPosition проп)
│                                 │
│   [ 3 ]  [ 4 ]  [ 5 ]  [ 6 ]   │  ← NumberChoices или NumberPad
│                                 │
│                            🧮   │  ← HelperPanel (если showHelper)
└─────────────────────────────────┘
```

- После правильного ответа: `❓` → число с pop-анимацией
- `onCorrect` / `onIncorrect` вызываются немедленно при выборе
- `TimerBar` не включается в v1 (можно добавить позже как параметр)

### Изменения в OperationExpression

Принять проп `missingPosition: "left" | "right" | null`.  
Когда задан — рендерить `❓` вместо соответствующего числа со стилем `operation-expression__unknown`.

### Ветка в OperationTask

```js
if (type === "operation_missing_term") {
  return <MissingTermTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
}
```

---

## Порядок реализации

1. `engine.js` — функция `buildMissingTermTask` + ветка в `generateTasks`
2. `engine.test.js` — покрыть все 4 комбинации позиция × операция
3. `index.jsx` — `MissingTermTask` + `OperationExpression` с `missingPosition`
4. `topic.json` — добавить режим 9
5. Деплой + ручная проверка всех 6 комбинаций параметров

---

## Будущее (вне scope)

- `unknownSymbol: "blank" | "x"` — переход к алгебраической записи
- `TimerBar` — таймер как в режимах 6 и 7
- Режим "листок с уравнениями" — аналог `operation_worksheet`
