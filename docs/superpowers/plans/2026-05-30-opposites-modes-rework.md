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

Новый unified-формат задачи: `zones[]` + `targetZoneId` на карточке. Работает и для 2 и для 4 зон.

```js
function buildConceptZones(conceptCards) {
  const left  = conceptCards.filter(c => c.pole === "left");
  const right = conceptCards.filter(c => c.pole === "right");
  if (!left.length || !right.length) return null;
  const zL = `${left[0].conceptId}_left`;
  const zR = `${left[0].conceptId}_right`;
  return {
    zones: [
      { id: zL, label: left[0].poleLabel },
      { id: zR, label: right[0].poleLabel },
    ],
    cards: shuffle([
      ...left.map(card  => ({ card, targetZoneId: zL })),
      ...right.map(card => ({ card, targetZoneId: zR })),
    ]),
  };
}

function groupByConcept(cards) {
  const map = new Map();
  for (const card of cards) {
    if (!map.has(card.conceptId)) map.set(card.conceptId, []);
    map.get(card.conceptId).push(card);
  }
  return map;
}

// Level 1: один таск на концепт, 2 зоны
function generateSortL1Tasks(cards) {
  const byConcept = groupByConcept(cards);
  const tasks = [];
  for (const [, conceptCards] of byConcept) {
    const built = buildConceptZones(conceptCards);
    if (!built) continue;
    tasks.push({ type: "sort", ...built });
  }
  return shuffle(tasks);
}

// Level 2: один таск на пару концептов, 4 зоны
function generateSortL2Tasks(cards, params) {
  const cardsPerConcept = params.cardsPerConcept ?? 4;
  const byConcept = groupByConcept(cards);
  const conceptIds = [...byConcept.keys()];
  const tasks = [];
  for (let i = 0; i + 1 < conceptIds.length; i += 2) {
    const aCards = byConcept.get(conceptIds[i]);
    const bCards = byConcept.get(conceptIds[i + 1]);
    const aL = aCards.filter(c => c.pole === "left");
    const aR = aCards.filter(c => c.pole === "right");
    const bL = bCards.filter(c => c.pole === "left");
    const bR = bCards.filter(c => c.pole === "right");
    if (!aL.length || !aR.length || !bL.length || !bR.length) continue;
    const half = Math.ceil(cardsPerConcept / 2);
    const zAL = `${conceptIds[i]}_left`;
    const zAR = `${conceptIds[i]}_right`;
    const zBL = `${conceptIds[i+1]}_left`;
    const zBR = `${conceptIds[i+1]}_right`;
    tasks.push({
      type: "sort",
      zones: [
        { id: zAL, label: aL[0].poleLabel },
        { id: zAR, label: aR[0].poleLabel },
        { id: zBL, label: bL[0].poleLabel },
        { id: zBR, label: bR[0].poleLabel },
      ],
      cards: shuffle([
        ...shuffle(aL).slice(0, half).map(card => ({ card, targetZoneId: zAL })),
        ...shuffle(aR).slice(0, half).map(card => ({ card, targetZoneId: zAR })),
        ...shuffle(bL).slice(0, half).map(card => ({ card, targetZoneId: zBL })),
        ...shuffle(bR).slice(0, half).map(card => ({ card, targetZoneId: zBR })),
      ]),
    });
  }
  return tasks;
}

function generateSortTask(cards, params) {
  const level = params.level ?? 1;
  return level === 2 ? generateSortL2Tasks(cards, params) : generateSortL1Tasks(cards);
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

## Task 3: Переработать ChooseTwoTask.jsx

**Files:**
- Modify: `src/topics/renderers/opposites/ChooseTwoTask.jsx`

Три изменения в одном файле:
1. Убрать `nominativeLabel` с карточки — текстовая подсказка исчезает
2. Добавить визуальный фидбек после ответа (зелёная/красная рамка 600 мс) перед вызовом коллбека
3. Упростить проп `GridCard`: `modifier` → `state` (`"idle" | "correct" | "wrong"`)

- [ ] **Полностью заменить содержимое файла:**

```jsx
import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function GridCard({ topicId, card, state, onClick, disabled }) {
  const url = useTopicFile(topicId, card?.image);
  const mod =
    state === "correct" ? " opp-grid-card--correct" :
    state === "wrong"   ? " opp-grid-card--wrong"   : "";
  return (
    <button
      className={`opp-grid-card${mod}`}
      onClick={onClick}
      disabled={disabled}
    >
      {url
        ? <img className="opp-grid-card__img" src={url} alt="" draggable={false} />
        : <div className="opp-grid-card__img opp-grid-card__img--loading" />
      }
    </button>
  );
}

export default function ChooseTwoTask({ task, topicId, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);
  const [pickedId, setPickedId] = useState(null);

  function handleSelect(opt) {
    if (answered) return;
    setAnswered(true);
    setPickedId(opt.card.id);
    const cb = opt.isTarget ? onCorrect : onIncorrect;
    setTimeout(() => cb(task.targetPole, opt.card.id), 600);
  }

  function cardState(opt) {
    if (!answered || pickedId !== opt.card.id) return "idle";
    return opt.isTarget ? "correct" : "wrong";
  }

  return (
    <div className="session-body">
      <div className="session-instruction">Покажи: {task.targetLabel}</div>
      <div className="opp-grid">
        {task.options.map((opt) => (
          <GridCard
            key={opt.card.id}
            topicId={topicId}
            card={opt.card}
            state={cardState(opt)}
            onClick={() => handleSelect(opt)}
            disabled={answered}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Commit:**

```bash
git add src/topics/renderers/opposites/ChooseTwoTask.jsx
git commit -m "feat(opposites): choose_two — no labels, visual feedback 600ms before advancing"
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

## Task 4b: Переписать SortTask.jsx для N зон

**Files:**
- Modify: `src/topics/renderers/opposites/SortTask.jsx`

Старый формат (`leftLabel/rightLabel`, `pole`) заменяется на `zones[]` + `targetZoneId`.
Компонент рендерит зоны динамически:
- `zones.length === 2` → две колонки (текущий layout)
- `zones.length === 4` → сетка 2×2

- [ ] **Полностью заменить содержимое файла:**

```jsx
import { useState, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function SortImage({ topicId, card }) {
  const url = useTopicFile(topicId, card?.image);
  if (!url) return <div style={{ width: "100%", height: "100%", background: "#e0e0e0" }} />;
  return <img src={url} alt="" draggable={false} />;
}

export default function SortTask({ task, topicId, onCorrect, onMistake }) {
  const { zones, cards } = task;
  const [placements, setPlacements] = useState({});
  const [dragging, setDragging]     = useState(null);
  const [hoverZone, setHoverZone]   = useState(null);
  const [done, setDone]             = useState(false);
  const zoneRefs    = useRef({});
  const onCorrectRef = useRef(onCorrect);
  onCorrectRef.current = onCorrect;

  function getZoneAt(x, y) {
    for (const zone of zones) {
      const el = zoneRefs.current[zone.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return zone.id;
    }
    return null;
  }

  function handlePointerDown(e, item) {
    if (done || placements[item.card.id]) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      item,
      x: rect.left, y: rect.top,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      size: rect.width,
    });
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    setDragging(prev => ({ ...prev, x: e.clientX - prev.offsetX, y: e.clientY - prev.offsetY }));
    setHoverZone(getZoneAt(e.clientX, e.clientY));
  }

  function handlePointerUp(e) {
    if (!dragging) return;
    const zoneId = getZoneAt(e.clientX, e.clientY);
    const item   = dragging.item;
    setDragging(null);
    setHoverZone(null);
    if (!zoneId) return;
    if (item.targetZoneId !== zoneId) {
      onMistake(zoneId, item.card.id);
      return;
    }
    const newPlacements = { ...placements, [item.card.id]: zoneId };
    setPlacements(newPlacements);
    const allDone = cards.every(c => newPlacements[c.card.id] === c.targetZoneId);
    if (allDone) {
      setDone(true);
      setTimeout(() => onCorrectRef.current(null, null), 400);
    }
  }

  const unplaced = cards.filter(item => !placements[item.card.id]);
  const gridClass = zones.length === 4 ? "opp-sort__zones opp-sort__zones--four" : "opp-sort__zones";

  return (
    <div
      className="session-body opp-sort"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      <div className="opp-sort__hand">
        {unplaced.map(item => (
          <div
            key={item.card.id}
            className={`opp-sort__card${dragging?.item.card.id === item.card.id ? " opp-sort__card--dragging" : ""}`}
            onPointerDown={e => handlePointerDown(e, item)}
          >
            <SortImage topicId={topicId} card={item.card} />
          </div>
        ))}
      </div>

      <div className={gridClass}>
        {zones.map(zone => {
          const inZone = cards.filter(item => placements[item.card.id] === zone.id);
          return (
            <div
              key={zone.id}
              ref={el => { zoneRefs.current[zone.id] = el; }}
              className={`opp-sort__zone${hoverZone === zone.id ? " opp-sort__zone--active" : ""}`}
            >
              <div className="opp-sort__zone-label">{zone.label}</div>
              <div className="opp-sort__placed-grid">
                {inZone.map(({ card }) => (
                  <div key={card.id} className="opp-sort__placed">
                    <SortImage topicId={topicId} card={card} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="opp-sort__hint">
        {dragging ? "Перетащи в нужную группу" : unplaced.length > 0 ? "Перетащи карточку" : ""}
      </div>

      {dragging && (
        <div
          className="opp-sort__ghost"
          style={{ left: dragging.x, top: dragging.y, width: dragging.size, height: dragging.size }}
        >
          <SortImage topicId={topicId} card={dragging.item.card} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Добавить в `Opposites.css`** стиль для 4 зон (после существующих `.opp-sort__zones`):

```css
/* 4-zone grid (Level 2 sort) */
.opp-sort__zones--four {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  height: min(460px, 80vh);
}

@media (orientation: landscape) {
  .opp-sort__zones--four {
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: 1fr;
    height: min(280px, 56vh);
  }
}
```

- [ ] **Commit:**

```bash
git add src/topics/renderers/opposites/SortTask.jsx src/topics/renderers/opposites/Opposites.css
git commit -m "feat(opposites): sort — N-zone layout, unified zones[]/targetZoneId format, 4-zone 2x2 grid"
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
- [ ] Открыть режим **Разложи** (Level 1, `params.level: 1`):
  - Один таск = один концепт (все big_* и small_* этого концепта), 2 зоны
  - Несколько тасков по очереди если концептов несколько
- [ ] Открыть режим **Разложи** (Level 2, `params.level: 2`):
  - Один таск = два концепта, 4 зоны в сетке 2×2
  - В ландшафтной ориентации — 4 колонки

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
| choose_two: визуальный фидбек 600 мс перед авансом | Task 3 |
| choose_two: всегда 2 карточки одной пары | Task 1c |
| sort Level 1: один task на концепт, 2 зоны | Task 1b |
| sort Level 2: два концепта, 4 зоны 2×2 | Task 1b |
| SortTask: N зон динамически, новый формат zones[]/targetZoneId | Task 4b |
| intro: упразднён | Task 5 |
| CSS для нового layout | Task 4 |
