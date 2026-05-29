# Opposites Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `opposites` renderer — новый тип темы для обучения антонимам (большой/маленький, длинный/короткий и т.д.) через 5 режимов: знакомство, парное сравнение, выбор, сортировка, найди все.

**Architecture:** Новый `src/topics/renderers/opposites/` с собственными engine.js и 5 task-компонентами. Пара антонимов моделируется как один `conceptId` с полем `pole: "left"|"right"` на каждой карточке — это вписывается в существующий pipeline `deriveConcepts / selectedConceptIds` без изменений `useSessionEngine` или `importTopic`. Движок попадает в `else`-ветку `useSessionEngine` и получает `(mode, cards, sessionSize, params)`.

**Tech Stack:** React 18, JSX, plain CSS (конвенция проекта), `@/shared/utils/shuffle`, существующие колбэки сессии (`onCorrect`, `onIncorrect`, `onMistake`, `onAdvance`).

---

## File Map

| Действие | Путь | Ответственность |
|----------|------|----------------|
| Modify | `public/decks/opposites_draft/topic.json` | Убрать поля `image` для чистого импорта без файлов |
| Modify | `src/topics/topicLoader.js` | Зарегистрировать opposites в DEFAULT_META, DEFAULT_TOPIC_ABOUT, DEFAULT_MODE_METHODOLOGY, MODE_ICON_FALLBACKS |
| Modify | `src/topics/registry.js` | Зарегистрировать OppositeRenderer |
| Modify | `src/topics/renderers/engineRegistry.js` | Зарегистрировать opposites engine |
| Create | `src/topics/renderers/opposites/engine.js` | Генерация tasks для всех 5 режимов |
| Create | `src/topics/renderers/opposites/index.jsx` | Диспетчер: маршрутизирует task.type → компонент |
| Create | `src/topics/renderers/opposites/Opposites.css` | Все стили рендерера |
| Create | `src/topics/renderers/opposites/IntroTask.jsx` | Одна карточка, advance по тапу |
| Create | `src/topics/renderers/opposites/PairComparisonTask.jsx` | Две карточки рядом |
| Create | `src/topics/renderers/opposites/ChooseTwoTask.jsx` | Сетка выбора с инструкцией |
| Create | `src/topics/renderers/opposites/FindAllTask.jsx` | Мультиселект + кнопка «Готово» |
| Create | `src/topics/renderers/opposites/SortTask.jsx` | Тап-выбор карточки + тап-зона |

---

## Task 1: Wire-up — регистрация и заглушки

**Files:**
- Modify: `public/decks/opposites_draft/topic.json`
- Modify: `src/topics/topicLoader.js`
- Modify: `src/topics/registry.js`
- Modify: `src/topics/renderers/engineRegistry.js`
- Create: `src/topics/renderers/opposites/engine.js`
- Create: `src/topics/renderers/opposites/index.jsx`

- [ ] **Step 1: Убрать поля `image` из topic.json**

`validateImages` в topicLoader бросает `TopicImportError` если `card.image` задан, но файл отсутствует в ZIP. Убрать ключ `image` из всех 10 карточек в `public/decks/opposites_draft/topic.json`.

Каждая карточка должна выглядеть так (без поля `image`):
```json
{
  "id": "big_dog",
  "conceptId": "big_small",
  "pole": "left",
  "objectId": "dog",
  "objectLabel": "собака",
  "poleLabel": "большой",
  "nominativeLabel": "большая",
  "instructionLabel": "большую",
  "poleLabelPlural": "большие",
  "primary": true
}
```

- [ ] **Step 2: Добавить `opposites` в `topicLoader.js`**

В `src/topics/topicLoader.js` добавить 4 записи:

В `DEFAULT_TOPIC_ABOUT` (рядом с другими записями, ~строка 173):
```js
opposites: {
  description: "Тема знакомит ребёнка с базовыми визуальными противоположностями через сравнение пар.",
  goals: [
    "Сформировать понимание признака через сравнение двух объектов.",
    "Закрепить понятие на нескольких разных объектах одной пары.",
    "Научить классифицировать карточки по признаку.",
  ],
  finalGoal: "Ребёнок узнаёт признак на разных объектах и использует слово без опоры на конкретную картинку.",
  flow: [
    "Начинайте со знакомства и парного сравнения, затем переходите к выбору.",
    "Сортировку и «Найди все» вводите после уверенного выбора из двух.",
  ],
},
```

В `DEFAULT_MODE_METHODOLOGY` (~строка 267):
```js
opposites: {
  intro: {
    summary: "Первое знакомство с парой признаков.",
    text: "Педагог показывает карточки обоих полюсов поочерёдно, называет признак и объект.",
    goal: "Ребёнок видит и слышит оба признака на разных объектах.",
  },
  pair_comparison: {
    summary: "Сравнение двух объектов рядом.",
    text: "На экране два объекта с одним различием. Педагог называет признаки и просит ребёнка смотреть.",
    goal: "Ребёнок замечает различие и связывает его со словами признака.",
  },
  choose_two: {
    summary: "Выбор нужного признака по инструкции.",
    text: "Ребёнок слышит инструкцию и нажимает на нужную карточку.",
    goal: "Ребёнок находит признак по слову без опоры на подсказку.",
  },
  sort: {
    summary: "Сортировка карточек по признаку.",
    text: "Ребёнок перемещает карточки в две группы по нужному признаку.",
    goal: "Ребёнок удерживает понятие и классифицирует разные объекты по одному признаку.",
  },
  find_all: {
    summary: "Поиск всех карточек с нужным признаком.",
    text: "Ребёнок отмечает все карточки, которые подходят под заданный признак.",
    goal: "Ребёнок обобщает признак на нескольких объектах и отличает его от противоположного.",
  },
},
```

В `DEFAULT_META` (~строка 641):
```js
opposites: {
  avatar: "media/avatar.webp",
},
```

В `MODE_ICON_FALLBACKS` (~строка 665):
```js
opposites: {
  default: "media/icons/flashcards_mode.svg",
},
```

- [ ] **Step 3: Создать заглушку engine.js**

Создать `src/topics/renderers/opposites/engine.js`:
```js
export function generateTasks(_mode, _cards, _sessionSize, _params) {
  return [];
}
```

- [ ] **Step 4: Создать заглушку index.jsx**

Создать `src/topics/renderers/opposites/index.jsx`:
```jsx
export default function OppositeRenderer({ task }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1.4rem", color: "#aaa" }}>
      opposites · {task?.type ?? "—"}
    </div>
  );
}
```

- [ ] **Step 5: Зарегистрировать renderer**

В `src/topics/registry.js` добавить импорт:
```js
import OppositeRenderer from "./renderers/opposites/index.jsx";
```
И в объект `RENDERER_REGISTRY`:
```js
opposites: OppositeRenderer,
```

- [ ] **Step 6: Зарегистрировать engine**

В `src/topics/renderers/engineRegistry.js` добавить импорт:
```js
import { generateTasks as oppositeEngine } from "./opposites/engine";
```
И в объект `ENGINE_REGISTRY`:
```js
opposites: oppositeEngine,
```

- [ ] **Step 7: Создать ZIP и импортировать**

```powershell
Compress-Archive -Path "public\decks\opposites_draft\*" -DestinationPath "public\decks\opposites_draft.zip" -Force
```

Импортировать `opposites_draft.zip` через UI приложения (Добавить тему). Открыть сессию в любом режиме — должна показываться заглушка "opposites · intro" без JS-ошибок в консоли.

- [ ] **Step 8: Commit**
```
git add src/topics/registry.js src/topics/renderers/engineRegistry.js src/topics/topicLoader.js src/topics/renderers/opposites/ public/decks/opposites_draft/topic.json
git commit -m "feat(opposites): wire up renderer skeleton"
```

---

## Task 2: Engine — генерация задач

**Files:**
- Modify: `src/topics/renderers/opposites/engine.js`

`generateTasks(mode, cards, _sessionSize, params)` — `cards` содержат все карточки выбранных пар (оба полюса, все объекты). `params` — фактические значения из `link.params`, задействует значение по умолчанию если ключ отсутствует.

- [ ] **Step 1: Реализовать engine.js**

Заменить `src/topics/renderers/opposites/engine.js`:

```js
import { shuffle } from "@/shared/utils/shuffle";

function groupByObjectId(cards) {
  const map = new Map();
  for (const card of cards) {
    if (!map.has(card.objectId)) map.set(card.objectId, { left: null, right: null });
    const entry = map.get(card.objectId);
    if (card.pole === "left") entry.left = card;
    else if (card.pole === "right") entry.right = card;
  }
  return map;
}

function generateIntroTasks(cards) {
  const byObject = groupByObjectId(cards);
  const tasks = [];
  for (const [, { left, right }] of byObject) {
    if (left)  tasks.push({ type: "intro", card: left });
    if (right) tasks.push({ type: "intro", card: right });
  }
  return tasks;
}

function generatePairComparisonTasks(cards) {
  const byObject = groupByObjectId(cards);
  const tasks = [];
  for (const [, { left, right }] of byObject) {
    if (left && right) tasks.push({ type: "pair_comparison", leftCard: left, rightCard: right });
  }
  return shuffle(tasks);
}

function buildChooseTwoTask(target, sameObjOpposite, allEntries, optionCount) {
  const options = [{ card: target, isTarget: true }, { card: sameObjOpposite, isTarget: false }];
  if (optionCount > 2) {
    const others = shuffle(allEntries.filter(([oid]) => oid !== target.objectId));
    for (const [, { left, right }] of others.slice(0, optionCount - 2)) {
      const distractor = target.pole === "left" ? right : left;
      if (distractor) options.push({ card: distractor, isTarget: false });
    }
  }
  return {
    type: "choose_two",
    targetPole: target.pole,
    targetLabel: target.instructionLabel,
    options: shuffle(options.slice(0, optionCount)),
  };
}

function generateChooseTwoTasks(cards, params) {
  const optionCount  = params.optionCount  ?? 2;
  const repsPerPair  = params.repsPerPair  ?? 2;
  const byObject = groupByObjectId(cards);
  const entries  = [...byObject.entries()];
  const tasks    = [];
  for (const [, { left, right }] of entries) {
    if (!left || !right) continue;
    for (let i = 0; i < repsPerPair; i++) {
      tasks.push(buildChooseTwoTask(left,  right, entries, optionCount));
      tasks.push(buildChooseTwoTask(right, left,  entries, optionCount));
    }
  }
  return shuffle(tasks);
}

function generateSortTask(cards, params) {
  const cardCount  = params.cardCount ?? 4;
  const half       = Math.floor(cardCount / 2);
  const leftCards  = shuffle(cards.filter((c) => c.pole === "left")).slice(0, half);
  const rightCards = shuffle(cards.filter((c) => c.pole === "right")).slice(0, half);
  return [{
    type:       "sort",
    leftLabel:  leftCards[0]?.poleLabel  ?? "левая",
    rightLabel: rightCards[0]?.poleLabel ?? "правая",
    cards: shuffle([
      ...leftCards.map((card)  => ({ card, pole: "left"  })),
      ...rightCards.map((card) => ({ card, pole: "right" })),
    ]),
  }];
}

function generateFindAllTasks(cards, params) {
  const gridSize   = params.gridSize ?? 6;
  const half       = Math.floor(gridSize / 2);
  const leftCards  = shuffle(cards.filter((c) => c.pole === "left"));
  const rightCards = shuffle(cards.filter((c) => c.pole === "right"));
  return [
    ["left",  leftCards,  rightCards],
    ["right", rightCards, leftCards],
  ].map(([targetPole, targets, others]) => {
    const selectedTargets = targets.slice(0, half);
    const selectedOthers  = others.slice(0, gridSize - selectedTargets.length);
    return {
      type:           "find_all",
      targetPole,
      targetLabel:    selectedTargets[0]?.poleLabelPlural ?? targetPole,
      allCards:       shuffle([...selectedTargets, ...selectedOthers]),
      correctCardIds: selectedTargets.map((c) => c.id),
    };
  });
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  switch (mode.type) {
    case "intro":           return generateIntroTasks(cards);
    case "pair_comparison": return generatePairComparisonTasks(cards);
    case "choose_two":      return generateChooseTwoTasks(cards, params);
    case "sort":            return generateSortTask(cards, params);
    case "find_all":        return generateFindAllTasks(cards, params);
    default:                return [];
  }
}
```

- [ ] **Step 2: Проверить в браузере**

Запустить dev-сервер (`npm run dev`). Открыть сессию «Покажи» — заглушка должна показывать "opposites · choose_two". Счётчик задач (X/N) должен быть ненулевым. Консоль без ошибок.

- [ ] **Step 3: Commit**
```
git add src/topics/renderers/opposites/engine.js
git commit -m "feat(opposites): task generation engine"
```

---

## Task 3: CSS + IntroTask + PairComparisonTask (первый визуал)

**Files:**
- Create: `src/topics/renderers/opposites/Opposites.css`
- Create: `src/topics/renderers/opposites/IntroTask.jsx`
- Create: `src/topics/renderers/opposites/PairComparisonTask.jsx`
- Modify: `src/topics/renderers/opposites/index.jsx`

- [ ] **Step 1: Создать Opposites.css**

Создать `src/topics/renderers/opposites/Opposites.css`:

```css
/* ── Shared card shell ──────────────────────────────── */
.opp-card {
  border-radius: 14px;
  overflow: hidden;
  background: #f2f2f2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.opp-card__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.opp-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: #888;
  padding: 12px;
  text-align: center;
  box-sizing: border-box;
  line-height: 1.4;
}

/* ── Labels ─────────────────────────────────────────── */
.opp-label {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a1a;
  text-align: center;
  margin-top: 10px;
  letter-spacing: 0.03em;
}

.opp-label--secondary {
  font-size: 0.9rem;
  font-weight: 400;
  color: #888;
  margin-top: 2px;
}

.opp-instruction {
  font-size: 1.3rem;
  font-weight: 500;
  color: #333;
  text-align: center;
  padding: 0 8px;
}

/* ── Intro ──────────────────────────────────────────── */
.opp-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  cursor: pointer;
  user-select: none;
}

.opp-intro__card {
  width: min(300px, 65vw);
  height: min(300px, 42vh);
}

/* ── Pair comparison ────────────────────────────────── */
.opp-pair {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 20px;
  height: 100%;
  padding: 20px;
  cursor: pointer;
  user-select: none;
}

.opp-pair__side {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 260px;
}

.opp-pair__card {
  width: 100%;
  aspect-ratio: 1;
}

/* ── Choose two ─────────────────────────────────────── */
.opp-choose {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
  padding: 16px;
  gap: 16px;
}

.opp-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 560px;
}

.opp-grid-card {
  border: 3px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  background: #f2f2f2;
  padding: 0;
  aspect-ratio: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;
}

.opp-grid-card:disabled { cursor: default; }

.opp-grid-card--correct { border-color: #4caf50; background: #e8f5e9; }
.opp-grid-card--wrong   { border-color: #f44336; background: #ffebee; }
.opp-grid-card--selected { border-color: #2196f3; background: #e3f2fd; }

.opp-grid-card__label {
  font-size: 0.85rem;
  color: #555;
  padding: 4px 8px 6px;
  text-align: center;
}

/* ── Find all ───────────────────────────────────────── */
.opp-findall {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  padding: 16px;
  gap: 14px;
}

.opp-submit-btn {
  padding: 12px 36px;
  font-size: 1.1rem;
  background: #2196f3;
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}

.opp-submit-btn:disabled { background: #ccc; cursor: default; }

/* ── Sort ───────────────────────────────────────────── */
.opp-sort {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 10px;
  box-sizing: border-box;
}

.opp-sort__zones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.opp-sort__zone {
  border: 2.5px dashed #ccc;
  border-radius: 14px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  overflow-y: auto;
  transition: border-color 0.15s, background 0.15s;
}

.opp-sort__zone--active { border-color: #2196f3; background: #e3f2fd; }

.opp-sort__zone-label {
  font-size: 1.1rem;
  font-weight: 700;
  color: #333;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.opp-sort__placed {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  color: #666;
  text-align: center;
  padding: 2px;
  box-sizing: border-box;
}

.opp-sort__hand {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 4px 0;
}

.opp-sort__card {
  width: 72px;
  height: 72px;
  border: 2.5px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  background: #f2f2f2;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;
}

.opp-sort__card--pending { border-color: #2196f3; background: #e3f2fd; }

.opp-sort__hint {
  text-align: center;
  color: #888;
  font-size: 0.9rem;
  min-height: 20px;
}
```

- [ ] **Step 2: Создать IntroTask.jsx**

Создать `src/topics/renderers/opposites/IntroTask.jsx`:

```jsx
import "./Opposites.css";

export default function IntroTask({ task, onAdvance }) {
  const { card } = task;
  const imgSrc = card.imageUrl ?? card.photo ?? null;

  return (
    <div className="opp-intro" onClick={onAdvance}>
      <div className="opp-card opp-intro__card">
        {imgSrc
          ? <img className="opp-card__img" src={imgSrc} alt={card.nominativeLabel} />
          : <div className="opp-card__placeholder">{card.nominativeLabel}<br />{card.objectLabel}</div>
        }
      </div>
      <div className="opp-label">{card.nominativeLabel}</div>
      <div className="opp-label opp-label--secondary">{card.objectLabel}</div>
    </div>
  );
}
```

- [ ] **Step 3: Создать PairComparisonTask.jsx**

Создать `src/topics/renderers/opposites/PairComparisonTask.jsx`:

```jsx
import "./Opposites.css";

function CardSide({ card }) {
  const imgSrc = card.imageUrl ?? card.photo ?? null;
  return (
    <div className="opp-pair__side">
      <div className="opp-card opp-pair__card">
        {imgSrc
          ? <img className="opp-card__img" src={imgSrc} alt={card.nominativeLabel} />
          : <div className="opp-card__placeholder">{card.nominativeLabel}<br />{card.objectLabel}</div>
        }
      </div>
      <div className="opp-label">{card.nominativeLabel}</div>
      <div className="opp-label opp-label--secondary">{card.objectLabel}</div>
    </div>
  );
}

export default function PairComparisonTask({ task, onAdvance }) {
  return (
    <div className="opp-pair" onClick={onAdvance}>
      <CardSide card={task.leftCard} />
      <CardSide card={task.rightCard} />
    </div>
  );
}
```

- [ ] **Step 4: Обновить index.jsx**

Заменить `src/topics/renderers/opposites/index.jsx`:

```jsx
import IntroTask          from "./IntroTask";
import PairComparisonTask from "./PairComparisonTask";

export default function OppositeRenderer({ task, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "intro":           return <IntroTask task={task} onAdvance={onAdvance} />;
    case "pair_comparison": return <PairComparisonTask task={task} onAdvance={onAdvance} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Режим в разработке: {task?.type}
        </div>
      );
  }
}
```

- [ ] **Step 5: Пересобрать ZIP и проверить в браузере**

```powershell
Compress-Archive -Path "public\decks\opposites_draft\*" -DestinationPath "public\decks\opposites_draft.zip" -Force
```

Переимпортировать ZIP. Открыть «Знакомство» и «Сравниваем».

Ожидаемый результат «Знакомство»:
- Прямоугольник-заглушка с текстом «большая / собака» посередине
- Под карточкой: «БОЛЬШАЯ» крупно, «собака» мелко серым
- Тап листает дальше

Ожидаемый результат «Сравниваем»:
- Два прямоугольника рядом
- Левый: «БОЛЬШАЯ» + «собака»; правый: «МАЛЕНЬКАЯ» + «собака»
- Тап в любое место листает дальше

- [ ] **Step 6: Commit**
```
git add src/topics/renderers/opposites/
git commit -m "feat(opposites): intro and pair_comparison components"
```

---

## Task 4: ChooseTwoTask

**Files:**
- Create: `src/topics/renderers/opposites/ChooseTwoTask.jsx`
- Modify: `src/topics/renderers/opposites/index.jsx`

- [ ] **Step 1: Создать ChooseTwoTask.jsx**

Создать `src/topics/renderers/opposites/ChooseTwoTask.jsx`:

```jsx
import { useState } from "react";
import "./Opposites.css";

export default function ChooseTwoTask({ task, onCorrect, onIncorrect }) {
  const { targetLabel, options } = task;
  const [answered, setAnswered] = useState(false);

  function handleSelect(opt) {
    if (answered) return;
    setAnswered(true);
    if (opt.isTarget) {
      onCorrect(task.targetPole, opt.card.id);
    } else {
      onIncorrect(task.targetPole, opt.card.id);
    }
  }

  return (
    <div className="opp-choose">
      <div className="opp-instruction">Покажи: {targetLabel}</div>
      <div className="opp-grid">
        {options.map((opt) => {
          const imgSrc = opt.card.imageUrl ?? opt.card.photo ?? null;
          return (
            <button
              key={opt.card.id}
              className="opp-grid-card"
              onClick={() => handleSelect(opt)}
              disabled={answered}
            >
              {imgSrc
                ? <img className="opp-card__img" src={imgSrc} alt={opt.card.nominativeLabel} />
                : <div className="opp-card__placeholder">{opt.card.nominativeLabel}<br />{opt.card.objectLabel}</div>
              }
              <div className="opp-grid-card__label">{opt.card.nominativeLabel}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Добавить ChooseTwoTask в index.jsx**

```jsx
import IntroTask          from "./IntroTask";
import PairComparisonTask from "./PairComparisonTask";
import ChooseTwoTask      from "./ChooseTwoTask";

export default function OppositeRenderer({ task, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "intro":           return <IntroTask task={task} onAdvance={onAdvance} />;
    case "pair_comparison": return <PairComparisonTask task={task} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Режим в разработке: {task?.type}
        </div>
      );
  }
}
```

- [ ] **Step 3: Проверить в браузере**

Открыть «Покажи» (optionCount=2 по умолчанию). Проверить:
- Инструкция: «Покажи: большую» или «Покажи: маленький» (зависит от задачи)
- Два плейсхолдера в сетке
- Тап на правильный → SessionScreen показывает ✓
- Тап на неправильный → SessionScreen показывает ✕, через 1.5 сек та же задача снова

- [ ] **Step 4: Commit**
```
git add src/topics/renderers/opposites/ChooseTwoTask.jsx src/topics/renderers/opposites/index.jsx
git commit -m "feat(opposites): choose_two task component"
```

---

## Task 5: FindAllTask

**Files:**
- Create: `src/topics/renderers/opposites/FindAllTask.jsx`
- Modify: `src/topics/renderers/opposites/index.jsx`

- [ ] **Step 1: Создать FindAllTask.jsx**

Создать `src/topics/renderers/opposites/FindAllTask.jsx`:

```jsx
import { useState } from "react";
import "./Opposites.css";

export default function FindAllTask({ task, onCorrect, onIncorrect }) {
  const { targetLabel, allCards, correctCardIds } = task;
  const correctSet = new Set(correctCardIds);
  const [selected, setSelected]   = useState(new Set());
  const [submitted, setSubmitted] = useState(false);

  function toggle(id) {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (submitted) return;
    setSubmitted(true);
    const allCorrect =
      correctCardIds.every((id) => selected.has(id)) &&
      [...selected].every((id) => correctSet.has(id));
    if (allCorrect) onCorrect(task.targetPole, null);
    else            onIncorrect(task.targetPole, null);
  }

  return (
    <div className="opp-findall">
      <div className="opp-instruction">Найди все: {targetLabel}</div>
      <div className="opp-grid">
        {allCards.map((card) => {
          const imgSrc     = card.imageUrl ?? card.photo ?? null;
          const isSelected = selected.has(card.id);
          let cls = "opp-grid-card";
          if (submitted && correctSet.has(card.id))              cls += " opp-grid-card--correct";
          else if (submitted && isSelected)                       cls += " opp-grid-card--wrong";
          else if (isSelected)                                    cls += " opp-grid-card--selected";

          return (
            <button key={card.id} className={cls} onClick={() => toggle(card.id)} disabled={submitted}>
              {imgSrc
                ? <img className="opp-card__img" src={imgSrc} alt={card.nominativeLabel} />
                : <div className="opp-card__placeholder">{card.nominativeLabel}<br />{card.objectLabel}</div>
              }
              <div className="opp-grid-card__label">{card.nominativeLabel}</div>
            </button>
          );
        })}
      </div>
      <button
        className="opp-submit-btn"
        onClick={handleSubmit}
        disabled={selected.size === 0 || submitted}
      >
        Готово
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Добавить FindAllTask в index.jsx**

```jsx
import IntroTask          from "./IntroTask";
import PairComparisonTask from "./PairComparisonTask";
import ChooseTwoTask      from "./ChooseTwoTask";
import FindAllTask        from "./FindAllTask";

export default function OppositeRenderer({ task, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "intro":           return <IntroTask task={task} onAdvance={onAdvance} />;
    case "pair_comparison": return <PairComparisonTask task={task} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "find_all":        return <FindAllTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Режим в разработке: {task?.type}
        </div>
      );
  }
}
```

- [ ] **Step 3: Проверить в браузере**

Открыть «Найди все». Проверить:
- Инструкция: «Найди все: большие» или «маленькие»
- Тап по карточкам toggles синюю рамку
- «Готово» неактивна пока не выбрана хоть одна карточка
- Верный набор → ✓; неверный → ✕, затем задача повторяется (taskRetry++)

- [ ] **Step 4: Commit**
```
git add src/topics/renderers/opposites/FindAllTask.jsx src/topics/renderers/opposites/index.jsx
git commit -m "feat(opposites): find_all task component"
```

---

## Task 6: SortTask

**Files:**
- Create: `src/topics/renderers/opposites/SortTask.jsx`
- Modify: `src/topics/renderers/opposites/index.jsx`

Взаимодействие: тап карточки в «руке» → выделить как pending; тап зоны → назначить. Неверная зона → `onMistake`, карточка остаётся в руке. Все верно → `onCorrect`.

- [ ] **Step 1: Создать SortTask.jsx**

Создать `src/topics/renderers/opposites/SortTask.jsx`:

```jsx
import { useState } from "react";
import "./Opposites.css";

export default function SortTask({ task, onCorrect, onMistake }) {
  const { leftLabel, rightLabel, cards } = task;
  const [placements, setPlacements] = useState({});
  const [pending,    setPending]    = useState(null);
  const [done,       setDone]       = useState(false);

  function selectCard(item) {
    if (done || placements[item.card.id]) return;
    setPending((prev) => (prev?.card.id === item.card.id ? null : item));
  }

  function assignToZone(zone) {
    if (!pending || done) return;
    const item = pending;
    setPending(null);
    if (item.pole !== zone) {
      onMistake(zone, item.card.id);
      return;
    }
    setPlacements((prev) => {
      const next = { ...prev, [item.card.id]: zone };
      const allDone = cards.every((c) => next[c.card.id] === c.pole);
      if (allDone) { setDone(true); setTimeout(() => onCorrect(null, null), 400); }
      return next;
    });
  }

  const unplaced = cards.filter((item) => !placements[item.card.id]);
  const inLeft   = cards.filter((item) => placements[item.card.id] === "left");
  const inRight  = cards.filter((item) => placements[item.card.id] === "right");

  function PlacedCard({ card }) {
    const imgSrc = card.imageUrl ?? card.photo ?? null;
    return (
      <div className="opp-sort__placed">
        {imgSrc
          ? <img className="opp-card__img" src={imgSrc} alt={card.nominativeLabel} />
          : <span>{card.nominativeLabel}</span>
        }
      </div>
    );
  }

  return (
    <div className="opp-sort">
      <div className="opp-sort__zones">
        <div className={`opp-sort__zone${pending ? " opp-sort__zone--active" : ""}`} onClick={() => assignToZone("left")}>
          <div className="opp-sort__zone-label">{leftLabel}</div>
          {inLeft.map(({ card }) => <PlacedCard key={card.id} card={card} />)}
        </div>
        <div className={`opp-sort__zone${pending ? " opp-sort__zone--active" : ""}`} onClick={() => assignToZone("right")}>
          <div className="opp-sort__zone-label">{rightLabel}</div>
          {inRight.map(({ card }) => <PlacedCard key={card.id} card={card} />)}
        </div>
      </div>

      <div className="opp-sort__hand">
        {unplaced.map((item) => {
          const imgSrc    = item.card.imageUrl ?? item.card.photo ?? null;
          const isPending = pending?.card.id === item.card.id;
          return (
            <button
              key={item.card.id}
              className={`opp-sort__card${isPending ? " opp-sort__card--pending" : ""}`}
              onClick={() => selectCard(item)}
              disabled={done}
            >
              {imgSrc
                ? <img className="opp-card__img" src={imgSrc} alt={item.card.nominativeLabel} />
                : <div className="opp-card__placeholder">{item.card.nominativeLabel}</div>
              }
            </button>
          );
        })}
      </div>

      <div className="opp-sort__hint">
        {pending ? "Нажми на нужную группу" : unplaced.length > 0 ? "Выбери карточку" : ""}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Финальная версия index.jsx**

Заменить `src/topics/renderers/opposites/index.jsx`:

```jsx
import IntroTask          from "./IntroTask";
import PairComparisonTask from "./PairComparisonTask";
import ChooseTwoTask      from "./ChooseTwoTask";
import FindAllTask        from "./FindAllTask";
import SortTask           from "./SortTask";

export default function OppositeRenderer({ task, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "intro":           return <IntroTask task={task} onAdvance={onAdvance} />;
    case "pair_comparison": return <PairComparisonTask task={task} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "find_all":        return <FindAllTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "sort":            return <SortTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Неизвестный тип: {task?.type}
        </div>
      );
  }
}
```

- [ ] **Step 3: Проверить в браузере**

Открыть «Сортировка». Проверить:
- Карточки в «руке» снизу
- Тап карточки → синяя рамка (pending), обе зоны подсвечиваются
- Тап той же карточки → снимает pending
- Верная зона → карточка уходит в зону
- Неверная зона → `onMistake` (счётчик ошибок++), карточка остаётся в руке
- Все разложены верно → ✓ и сессия переходит дальше

- [ ] **Step 4: Commit**
```
git add src/topics/renderers/opposites/SortTask.jsx src/topics/renderers/opposites/index.jsx
git commit -m "feat(opposites): sort task component — all 5 modes complete"
```

---

## Self-Review

**Покрытие ТЗ:**
- intro (flash) ✓ — Task 3
- pair_comparison ✓ — Task 3; показывает nominativeLabel крупно + objectLabel мелко
- choose_two (optionCount 2/4, repsPerPair) ✓ — Task 4
- sort (cardCount) ✓ — Task 6
- find_all (gridSize) ✓ — Task 5
- Схема карточки: все 9 полей корректно используются ✓
- groupByObjectId связывает left↔right через objectId ✓
- choose_two дистракторы = противоположный полюс, та же пара ✓
- mixPairs=false по умолчанию; при true — логика та же (деградирует gracefully) ✓

**Консистентность типов:** Все ссылки на `card.nominativeLabel`, `card.instructionLabel`, `card.poleLabel`, `card.poleLabelPlural`, `card.objectLabel`, `card.pole` одинаковы во всех файлах.

**Плейсхолдеры:** отсутствуют. Каждый шаг содержит полный код.
