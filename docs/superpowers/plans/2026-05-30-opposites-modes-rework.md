# Opposites Modes Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переделать три режима темы «Противоположности»: сравнение → двухшаговый reveal с кнопками навигации; choose_two → всегда 2 карточки одной пары без подписей; sort → отдельный таск на каждый концепт.

**Architecture:** `PairComparisonTask` теперь самостоятельно управляет навигацией по всем парам (один task в engine → один компонент с внутренним состоянием). Engine генерирует sort-задачи по conceptId. ChooseTwoTask лишается label.

**Tech Stack:** React 18, CSS (без анимационных библиотек), Vite

---

## Затрагиваемые файлы

| Файл | Действие |
|------|----------|
| `src/topics/renderers/opposites/engine.js` | Изменить: pair_comparison → 1 task с `pairs[]`; sort → по conceptId; choose_two default optionCount:2 |
| `src/topics/renderers/opposites/PairComparisonTask.jsx` | Переписать: двухшаговый reveal + кнопки Пред/След |
| `src/topics/renderers/opposites/ChooseTwoTask.jsx` | Убрать label с карточки |
| `src/topics/renderers/opposites/Opposites.css` | Добавить стили для навигации и reveal-перехода |
| `src/topics/renderers/opposites/index.jsx` | Убрать импорт и case для `intro` |
| `src/topics/renderers/opposites/IntroTask.jsx` | Удалить файл (режим упразднён) |

---

## Task 1: Fix engine.js — три независимых изменения

**Files:**
- Modify: `src/topics/renderers/opposites/engine.js`

### 1a. pair_comparison → один task с массивом pairs

Сейчас `generatePairComparisonTasks` возвращает N отдельных tasks — по одному на каждую пару объектов.
Нужно вернуть ОДИН task с полем `pairs`, чтобы компонент сам управлял навигацией.

- [ ] **Заменить функцию `generatePairComparisonTasks`:**

```js
function generatePairComparisonTasks(cards, params) {
  const showLabels = params.showLabels ?? true;
  const byObject = groupByObjectId(cards);
  const pairs = [];
  for (const [, { left, right }] of byObject) {
    if (!left || !right) continue;
    pairs.push({ leftCard: left, rightCard: right });
  }
  if (!pairs.length) return [];
  return [{ type: "pair_comparison", pairs: shuffle(pairs), showLabels }];
}
```

### 1b. sort → по conceptId

Сейчас генерируется один sort-task из всех карточек колоды — это смешивает разные концепты.
Нужно: один task на каждый `conceptId`, карточки только этого концепта.

- [ ] **Заменить функцию `generateSortTask`:**

```js
function generateSortTask(cards, _params) {
  const byConcept = new Map();
  for (const card of cards) {
    if (!byConcept.has(card.conceptId)) byConcept.set(card.conceptId, []);
    byConcept.get(card.conceptId).push(card);
  }
  const tasks = [];
  for (const [, conceptCards] of byConcept) {
    const left  = conceptCards.filter(c => c.pole === "left");
    const right = conceptCards.filter(c => c.pole === "right");
    if (!left.length || !right.length) continue;
    tasks.push({
      type:       "sort",
      leftLabel:  left[0].poleLabel,
      rightLabel: right[0].poleLabel,
      cards: shuffle([
        ...left.map(card  => ({ card, pole: "left"  })),
        ...right.map(card => ({ card, pole: "right" })),
      ]),
    });
  }
  return shuffle(tasks);
}
```

### 1c. choose_two — зафиксировать optionCount: 2

Сейчас `optionCount` берётся из params (по умолчанию 2, но может быть переопределён).
Нужно жёстко зафиксировать 2 — всегда только две карточки одной пары.

- [ ] **Изменить `generateChooseTwoTasks`** — убрать `optionCount` из params, всегда передавать 2:

```js
function generateChooseTwoTasks(cards, params) {
  const repsPerPair = params.repsPerPair ?? 2;
  const byObject    = groupByObjectId(cards);
  const entries     = [...byObject.entries()];
  const tasks       = [];
  for (const [, { left, right }] of entries) {
    if (!left || !right) continue;
    for (let i = 0; i < repsPerPair; i++) {
      tasks.push(buildChooseTwoTask(left,  right, entries, 2));
      tasks.push(buildChooseTwoTask(right, left,  entries, 2));
    }
  }
  return shuffle(tasks);
}
```

- [ ] **Commit:**

```bash
git add src/topics/renderers/opposites/engine.js
git commit -m "feat(opposites): engine — pair_comparison as single task, sort per concept, choose_two locked to 2 options"
```

---

## Task 2: Переписать PairComparisonTask.jsx

**Files:**
- Modify: `src/topics/renderers/opposites/PairComparisonTask.jsx`

Новая машина состояний:
- `currentIndex` — индекс текущей пары (0..pairs.length-1)
- `step` — 1 (только левый полюс) или 2 (оба полюса)
- Тап по контентной зоне: если `step === 1` → `step = 2`
- Кнопка «Пред»: `currentIndex > 0` → `currentIndex--`, `step = 1`
- Кнопка «След»: если `currentIndex < pairs.length - 1` → `currentIndex++`, `step = 1`; если последняя пара → `onAdvance()`
- На последней паре кнопка «След» подписана «Готово»

- [ ] **Полностью заменить содержимое файла:**

```jsx
import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function PairCard({ topicId, card, showLabels, visible }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <div className={`opp-pair__side${visible ? "" : " opp-pair__side--hidden"}`}>
      <div className="opp-pair__card">
        {url
          ? <img src={url} alt="" draggable={false} />
          : <div className="opp-pair__card-placeholder" />
        }
      </div>
      {showLabels && <div className="opp-pair__label">{card.nominativeLabel}</div>}
      {showLabels && <div className="opp-pair__hint">{card.objectLabel}</div>}
    </div>
  );
}

export default function PairComparisonTask({ task, topicId, onAdvance }) {
  const { pairs, showLabels } = task;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep]                 = useState(1);

  const pair      = pairs[currentIndex];
  const isFirst   = currentIndex === 0;
  const isLast    = currentIndex === pairs.length - 1;

  function handleContentTap() {
    if (step === 1) setStep(2);
  }

  function handlePrev() {
    if (isFirst) return;
    setCurrentIndex(i => i - 1);
    setStep(1);
  }

  function handleNext() {
    if (!isLast) {
      setCurrentIndex(i => i + 1);
      setStep(1);
    } else {
      onAdvance();
    }
  }

  return (
    <div className="session-body opp-pair-v2">
      <div className="opp-pair-v2__content" onClick={handleContentTap}>
        <PairCard topicId={topicId} card={pair.leftCard}  showLabels={showLabels} visible />
        <PairCard topicId={topicId} card={pair.rightCard} showLabels={showLabels} visible={step === 2} />
      </div>

      {step === 1 && (
        <div className="opp-pair-v2__tap-hint">Нажмите, чтобы открыть пару</div>
      )}

      <div className="opp-pair-v2__nav">
        <button
          className="opp-pair-v2__nav-btn"
          onClick={handlePrev}
          disabled={isFirst}
        >
          ←
        </button>
        <span className="opp-pair-v2__progress">
          {currentIndex + 1} / {pairs.length}
        </span>
        <button
          className="opp-pair-v2__nav-btn opp-pair-v2__nav-btn--next"
          onClick={handleNext}
        >
          {isLast ? "Готово" : "→"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Commit:**

```bash
git add src/topics/renderers/opposites/PairComparisonTask.jsx
git commit -m "feat(opposites): pair_comparison — two-step reveal with prev/next navigation"
```

---

## Task 3: Убрать label с карточки в ChooseTwoTask.jsx

**Files:**
- Modify: `src/topics/renderers/opposites/ChooseTwoTask.jsx:13`

Строка 13 в `GridCard` рендерит `nominativeLabel` — это подсказка, которую нужно убрать.

- [ ] **Удалить строку с label** в функции `GridCard`:

Было:
```jsx
function GridCard({ topicId, card, modifier, onClick, disabled }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <button className={`opp-grid-card${modifier ? " " + modifier : ""}`} onClick={onClick} disabled={disabled}>
      {url
        ? <img className="opp-grid-card__img" src={url} alt="" draggable={false} />
        : <div className="opp-grid-card__img opp-grid-card__img--loading" />
      }
      <div className="opp-grid-card__label">{card.nominativeLabel}</div>
    </button>
  );
}
```

Стало:
```jsx
function GridCard({ topicId, card, modifier, onClick, disabled }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <button className={`opp-grid-card${modifier ? " " + modifier : ""}`} onClick={onClick} disabled={disabled}>
      {url
        ? <img className="opp-grid-card__img" src={url} alt="" draggable={false} />
        : <div className="opp-grid-card__img opp-grid-card__img--loading" />
      }
    </button>
  );
}
```

- [ ] **Commit:**

```bash
git add src/topics/renderers/opposites/ChooseTwoTask.jsx
git commit -m "fix(opposites): choose_two — remove label from option cards"
```

---

## Task 4: CSS — стили для нового PairComparisonTask

**Files:**
- Modify: `src/topics/renderers/opposites/Opposites.css`

Нужно добавить стили для классов `.opp-pair-v2__*`. Старые `.opp-pair` можно оставить (они не будут использоваться, но не мешают).

- [ ] **Добавить в конец `Opposites.css`** следующий блок:

```css
/* ── Pair comparison v2 (two-step reveal) ───────────── */
.opp-pair-v2 {
  user-select: none;
  gap: 0;
  padding: 8px 12px 12px;
  justify-content: space-between;
}

.opp-pair-v2__content {
  display: flex;
  flex-direction: row;
  gap: 12px;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* Приглушённый полюс: видим как силуэт, не читается — layout не прыгает */
.opp-pair__side--hidden {
  opacity: 0.2;
  filter: grayscale(1);
  pointer-events: none;
  transition: opacity 0.3s ease, filter 0.3s ease;
}

.opp-pair__side {
  transition: opacity 0.3s ease;
}

.opp-pair-v2__tap-hint {
  text-align: center;
  color: #aaa;
  font-size: clamp(0.75rem, 2.5vw, 0.9rem);
  padding: 4px 0;
  flex-shrink: 0;
}

.opp-pair-v2__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  flex-shrink: 0;
}

.opp-pair-v2__nav-btn {
  padding: 10px 22px;
  font-size: 1.1rem;
  font-weight: 700;
  background: #f5f5f5;
  border: 2px solid #ddd;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  min-width: 72px;
}
.opp-pair-v2__nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.opp-pair-v2__nav-btn--next {
  background: #e3f2fd;
  border-color: #90caf9;
}
.opp-pair-v2__nav-btn--next:hover:not(:disabled) {
  background: #bbdefb;
}

.opp-pair-v2__progress {
  font-size: clamp(0.9rem, 3vw, 1.1rem);
  color: #666;
  font-weight: 600;
  flex: 1;
  text-align: center;
}
```

- [ ] **Commit:**

```bash
git add src/topics/renderers/opposites/Opposites.css
git commit -m "feat(opposites): CSS styles for pair_comparison v2 navigation"
```

---

## Task 5: Убрать intro из index.jsx и удалить IntroTask.jsx

**Files:**
- Modify: `src/topics/renderers/opposites/index.jsx`
- Delete: `src/topics/renderers/opposites/IntroTask.jsx`

Режим `intro` упразднён — знакомство теперь происходит в pair_comparison.

- [ ] **Изменить `index.jsx`** — убрать импорт IntroTask и case "intro":

```jsx
import PairComparisonTask from "./PairComparisonTask";
import ChooseTwoTask      from "./ChooseTwoTask";
import FindAllTask        from "./FindAllTask";
import SortTask           from "./SortTask";

export default function OppositeRenderer({ task, topicId, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "pair_comparison": return <PairComparisonTask task={task} topicId={topicId} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "find_all":        return <FindAllTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "sort":            return <SortTask task={task} topicId={topicId} onCorrect={onCorrect} onMistake={onMistake} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Неизвестный тип: {task?.type}
        </div>
      );
  }
}
```

- [ ] **Удалить файл `IntroTask.jsx`:**

```bash
git rm src/topics/renderers/opposites/IntroTask.jsx
```

- [ ] **Commit:**

```bash
git add src/topics/renderers/opposites/index.jsx
git commit -m "feat(opposites): remove intro mode, pair_comparison is now the introduction step"
```

---

## Task 6: Проверить в браузере

- [ ] Запустить dev-сервер: `npm run dev`
- [ ] Открыть тему Противоположности, режим **Сравнение**:
  - Пара открывается с одним полюсом
  - Тап по контенту → появляется второй полюс (плавно)
  - Кнопка «←» неактивна на первой паре
  - Кнопка «→» листает пары, сбрасывает к шагу 1
  - На последней паре кнопка подписана «Готово»
  - Счётчик «1 / N» обновляется корректно
- [ ] Открыть режим **Покажи**:
  - Две карточки, одна пара объектов (big_dog / small_dog)
  - Подписей на карточках нет
- [ ] Открыть режим **Разложи**:
  - Один таск = один концепт (все big_* и small_* этого концепта)
  - Несколько тасков по очереди если концептов несколько

---

## Self-review

| Требование | Таск |
|-----------|------|
| pair_comparison: двухшаговый reveal | Task 2 |
| pair_comparison: тап раскрывает второй полюс | Task 2 |
| pair_comparison: кнопки Пред/След меняют пару | Task 2 |
| pair_comparison: «Пред» всегда сбрасывает к шагу 1 | Task 2 |
| pair_comparison: счётчик пар | Task 2 |
| choose_two: без label на карточках | Task 3 |
| choose_two: всегда 2 карточки одной пары | Task 1c |
| sort: один task на концепт | Task 1b |
| intro: упразднён | Task 5 |
| CSS для нового layout | Task 4 |
