# find_opposite Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a drag-and-drop `find_opposite` mode to the Opposites renderer where the child drags the antonym card into a drop slot next to the stimulus card.

**Architecture:** New `FindOppositeTask.jsx` component (drag logic adapted from `SortTask.jsx`) + `generateFindOppositeTasks()` added to `engine.js`. The task shape is `{ type, stimulusCard, options: [{ card, isTarget }] }`. Routing added to `index.jsx`. No changes to `registry.js` or `engineRegistry.js`.

**Tech Stack:** React 18, Vitest, pointer events API, CSS custom properties.

---

## File Map

| File | Action |
|------|--------|
| `src/topics/renderers/opposites/engine.test.js` | Create — engine unit tests |
| `src/topics/renderers/opposites/engine.js` | Modify — add generator + switch case |
| `src/topics/renderers/opposites/Opposites.css` | Modify — add `/* find-opposite */` section |
| `src/topics/renderers/opposites/FindOppositeTask.jsx` | Create — drag-and-drop component |
| `src/topics/renderers/opposites/index.jsx` | Modify — add import + routing case |

---

## Task 1: Engine — generateFindOppositeTasks + tests

**Files:**
- Create: `src/topics/renderers/opposites/engine.test.js`
- Modify: `src/topics/renderers/opposites/engine.js`

- [ ] **Step 1: Write failing tests**

Create `src/topics/renderers/opposites/engine.test.js`:

```js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  { id: "big_dog",    conceptId: "big_small", pole: "left",  objectId: "dog",   objectLabel: "собака", nominativeLabel: "большая",   image: "media/big_dog.webp" },
  { id: "small_dog",  conceptId: "big_small", pole: "right", objectId: "dog",   objectLabel: "собака", nominativeLabel: "маленькая", image: "media/small_dog.webp" },
  { id: "big_cat",    conceptId: "big_small", pole: "left",  objectId: "cat",   objectLabel: "кошка",  nominativeLabel: "большая",   image: "media/big_cat.webp" },
  { id: "small_cat",  conceptId: "big_small", pole: "right", objectId: "cat",   objectLabel: "кошка",  nominativeLabel: "маленькая", image: "media/small_cat.webp" },
  { id: "big_ball",   conceptId: "big_small", pole: "left",  objectId: "ball",  objectLabel: "мяч",    nominativeLabel: "большой",   image: "media/big_ball.webp" },
  { id: "small_ball", conceptId: "big_small", pole: "right", objectId: "ball",  objectLabel: "мяч",    nominativeLabel: "маленький", image: "media/small_ball.webp" },
  { id: "wet_stone",  conceptId: "wet_dry",   pole: "left",  objectId: "stone", objectLabel: "камень", nominativeLabel: "мокрый",    image: "media/wet_stone.webp" },
  { id: "dry_stone",  conceptId: "wet_dry",   pole: "right", objectId: "stone", objectLabel: "камень", nominativeLabel: "сухой",     image: "media/dry_stone.webp" },
  { id: "wet_leaf",   conceptId: "wet_dry",   pole: "left",  objectId: "leaf",  objectLabel: "лист",   nominativeLabel: "мокрый",    image: "media/wet_leaf.webp" },
  { id: "dry_leaf",   conceptId: "wet_dry",   pole: "right", objectId: "leaf",  objectLabel: "лист",   nominativeLabel: "сухой",     image: "media/dry_leaf.webp" },
];

describe("generateTasks — find_opposite", () => {
  it("returns one task per objectId", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2 });
    expect(tasks).toHaveLength(5);
  });

  it("each task has type find_opposite", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, {});
    expect(tasks.every(t => t.type === "find_opposite")).toBe(true);
  });

  it("each task has stimulusCard and options array", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, {});
    for (const t of tasks) {
      expect(t.stimulusCard).toBeDefined();
      expect(Array.isArray(t.options)).toBe(true);
    }
  });

  it("exactly one option is the target", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 4 });
    for (const t of tasks) {
      expect(t.options.filter(o => o.isTarget)).toHaveLength(1);
    }
  });

  it("target card is the opposite pole of the same objectId", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2 });
    for (const t of tasks) {
      const target = t.options.find(o => o.isTarget);
      expect(target.card.objectId).toBe(t.stimulusCard.objectId);
      expect(target.card.pole).not.toBe(t.stimulusCard.pole);
    }
  });

  it("with distractorCount=2, options has 3 items (1 correct + 2 distractors)", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2 });
    for (const t of tasks) {
      expect(t.options).toHaveLength(3);
    }
  });

  it("with distractorCount=4, options has at most 5 items", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 4 });
    for (const t of tasks) {
      expect(t.options.length).toBeLessThanOrEqual(5);
    }
  });

  it("sameConcept=false: distractors come from different conceptIds", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2, sameConcept: false });
    for (const t of tasks) {
      const distractors = t.options.filter(o => !o.isTarget);
      for (const d of distractors) {
        expect(d.card.conceptId).not.toBe(t.stimulusCard.conceptId);
      }
    }
  });

  it("sameConcept=true: distractors come from same conceptId, different objectId", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2, sameConcept: true });
    for (const t of tasks) {
      const distractors = t.options.filter(o => !o.isTarget);
      for (const d of distractors) {
        expect(d.card.conceptId).toBe(t.stimulusCard.conceptId);
        expect(d.card.objectId).not.toBe(t.stimulusCard.objectId);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/topics/renderers/opposites/engine.test.js
```

Expected: FAIL — `generateTasks` returns empty array for unknown type `find_opposite`.

- [ ] **Step 3: Add generateFindOppositeTasks to engine.js**

Open `src/topics/renderers/opposites/engine.js`. Add this function before the `generateTasks` export (after `generateFindAllTasks`):

```js
function generateFindOppositeTasks(cards, params) {
  const distractorCount = params.distractorCount ?? 2;
  const sameConcept     = params.sameConcept ?? false;
  const byObject        = groupByObjectId(cards);
  const tasks           = [];

  for (const [, { left, right }] of byObject) {
    if (!left || !right) continue;
    const pair      = shuffle([left, right]);
    const stimulus  = pair[0];
    const correct   = pair[1];

    const distractors = sameConcept
      ? shuffle(cards.filter(c =>
          c.conceptId === stimulus.conceptId &&
          c.pole      === correct.pole       &&
          c.objectId  !== stimulus.objectId
        )).slice(0, distractorCount)
      : shuffle(cards.filter(c =>
          c.conceptId !== stimulus.conceptId
        )).slice(0, distractorCount);

    tasks.push({
      type:         "find_opposite",
      stimulusCard: stimulus,
      options:      shuffle([
        { card: correct, isTarget: true },
        ...distractors.map(c => ({ card: c, isTarget: false })),
      ]),
    });
  }

  return shuffle(tasks);
}
```

Then add a case to the `generateTasks` switch:

```js
case "find_opposite":   return generateFindOppositeTasks(cards, params);
```

Place it after the `find_all` case, before `default`.

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/topics/renderers/opposites/engine.test.js
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/opposites/engine.test.js src/topics/renderers/opposites/engine.js
git commit -m "feat(opposites): add find_opposite task generator"
```

---

## Task 2: CSS — find-opposite styles

**Files:**
- Modify: `src/topics/renderers/opposites/Opposites.css`

- [ ] **Step 1: Append new CSS section**

Add the following block at the very end of `src/topics/renderers/opposites/Opposites.css`:

```css
/* ── find-opposite ──────────────────────────────────── */
.opp-fo {
  flex-direction: column;
  gap: 16px;
  padding: 12px 16px;
  user-select: none;
}

.opp-fo__instruction {
  font-size: clamp(1rem, 3vw, 1.25rem);
  font-weight: 700;
  color: #333;
  text-align: center;
}

.opp-fo__pair {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.opp-fo__stimulus {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.opp-fo__stimulus-card {
  width: clamp(72px, 22vw, 110px);
  height: clamp(72px, 22vw, 110px);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #ffb74d;
  background: #fff3e0;
}

.opp-fo__stimulus-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.opp-fo__stimulus-label {
  font-size: clamp(0.7rem, 2.5vw, 0.9rem);
  font-weight: 600;
  color: #e65100;
  text-align: center;
}

.opp-fo__arrow {
  font-size: 1.8rem;
  color: #bbb;
  flex-shrink: 0;
}

.opp-fo__slot {
  width: clamp(72px, 22vw, 110px);
  height: clamp(72px, 22vw, 110px);
  border-radius: 12px;
  border: 2.5px dashed #bbb;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  color: #ccc;
  transition: border-color 0.15s, background 0.15s;
  overflow: hidden;
}

.opp-fo__slot--active {
  border-color: #42a5f5;
  border-style: solid;
  background: #e3f2fd;
  color: #42a5f5;
}

.opp-fo__slot--correct {
  border-color: #66bb6a;
  border-style: solid;
  background: #e8f5e9;
}

.opp-fo__slot--correct img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.opp-fo__slot--wrong {
  border-color: #e57373;
  border-style: solid;
  background: #ffebee;
  animation: opp-fo-shake 0.35s ease;
}

@keyframes opp-fo-shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  60%       { transform: translateX(6px); }
  80%       { transform: translateX(-3px); }
}

.opp-fo__scatter {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  align-items: center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 14px;
  flex: 1;
}

.opp-fo__card {
  width: clamp(64px, 18vw, 96px);
  height: clamp(64px, 18vw, 96px);
  border-radius: 10px;
  overflow: hidden;
  border: 1.5px solid #ddd;
  background: white;
  cursor: grab;
  touch-action: none;
  transition: opacity 0.2s;
}

.opp-fo__card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.opp-fo__card--loading {
  background: #e0e0e0;
}

.opp-fo__card--dragging {
  opacity: 0.35;
}

.opp-fo__card--faded {
  opacity: 0.25;
}

.opp-fo__ghost {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid #42a5f5;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  transform: rotate(-4deg) scale(1.06);
  background: white;
}

.opp-fo__ghost img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/opposites/Opposites.css
git commit -m "feat(opposites): add find-opposite CSS styles"
```

---

## Task 3: FindOppositeTask.jsx component

**Files:**
- Create: `src/topics/renderers/opposites/FindOppositeTask.jsx`

- [ ] **Step 1: Create component**

Create `src/topics/renderers/opposites/FindOppositeTask.jsx`:

```jsx
import { useState, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function CardImage({ topicId, card, className }) {
  const url = useTopicFile(topicId, card?.image);
  if (!url) return <div className={`${className} opp-fo__card--loading`} />;
  return <img src={url} alt="" draggable={false} />;
}

export default function FindOppositeTask({ task, topicId, onCorrect, onIncorrect }) {
  const { stimulusCard, options } = task;
  const [answered,  setAnswered]  = useState(false);
  const [slotState, setSlotState] = useState("idle");
  const [dragging,  setDragging]  = useState(null);
  const slotRef = useRef(null);

  function isOverSlot(x, y) {
    const el = slotRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function handlePointerDown(e, opt) {
    if (answered) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      opt,
      x:       rect.left,
      y:       rect.top,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      size:    rect.width,
    });
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    setDragging(prev => ({
      ...prev,
      x: e.clientX - prev.offsetX,
      y: e.clientY - prev.offsetY,
    }));
    setSlotState(isOverSlot(e.clientX, e.clientY) ? "active" : "idle");
  }

  function handlePointerUp(e) {
    if (!dragging) return;
    const over = isOverSlot(e.clientX, e.clientY);
    const opt  = dragging.opt;
    setDragging(null);
    if (!over) {
      setSlotState("idle");
      return;
    }
    setAnswered(true);
    if (opt.isTarget) {
      setSlotState("correct");
      setTimeout(() => onCorrect(stimulusCard.pole, opt.card.id), 900);
    } else {
      setSlotState("wrong");
      setTimeout(() => onIncorrect(stimulusCard.pole, opt.card.id), 900);
    }
  }

  const correctCard = options.find(o => o.isTarget)?.card;

  return (
    <div
      className="session-body opp-fo"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      <div className="opp-fo__instruction">
        Найди неприятеля — перетащи!
      </div>

      <div className="opp-fo__pair">
        <div className="opp-fo__stimulus">
          <div className="opp-fo__stimulus-card">
            <CardImage topicId={topicId} card={stimulusCard} />
          </div>
          <div className="opp-fo__stimulus-label">
            {stimulusCard.nominativeLabel} {stimulusCard.objectLabel}
          </div>
        </div>

        <div className="opp-fo__arrow">→</div>

        <div
          ref={slotRef}
          className={`opp-fo__slot opp-fo__slot--${slotState}`}
        >
          {slotState === "correct"
            ? <CardImage topicId={topicId} card={correctCard} />
            : "+"}
        </div>
      </div>

      <div className="opp-fo__scatter">
        {options.map((opt, i) => {
          const rotation  = ((opt.card.id.charCodeAt(0) * 7 + i * 13) % 9) - 4;
          const isDragging = dragging?.opt.card.id === opt.card.id;
          const isFaded    = answered && !isDragging;
          return (
            <div
              key={opt.card.id}
              className={[
                "opp-fo__card",
                isDragging ? "opp-fo__card--dragging" : "",
                isFaded    ? "opp-fo__card--faded"    : "",
              ].join(" ").trim()}
              style={{ transform: `rotate(${rotation}deg)` }}
              onPointerDown={e => handlePointerDown(e, opt)}
            >
              <CardImage topicId={topicId} card={opt.card} />
            </div>
          );
        })}
      </div>

      {dragging && (
        <div
          className="opp-fo__ghost"
          style={{
            left:   dragging.x,
            top:    dragging.y,
            width:  dragging.size,
            height: dragging.size,
          }}
        >
          <CardImage topicId={topicId} card={dragging.opt.card} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/opposites/FindOppositeTask.jsx
git commit -m "feat(opposites): add FindOppositeTask drag-and-drop component"
```

---

## Task 4: Wire into index.jsx

**Files:**
- Modify: `src/topics/renderers/opposites/index.jsx`

- [ ] **Step 1: Add import and routing case**

Open `src/topics/renderers/opposites/index.jsx`. Current content:

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

Replace with:

```jsx
import PairComparisonTask from "./PairComparisonTask";
import ChooseTwoTask      from "./ChooseTwoTask";
import FindAllTask        from "./FindAllTask";
import SortTask           from "./SortTask";
import FindOppositeTask   from "./FindOppositeTask";

export default function OppositeRenderer({ task, topicId, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "pair_comparison": return <PairComparisonTask task={task} topicId={topicId} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "find_all":        return <FindAllTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "sort":            return <SortTask task={task} topicId={topicId} onCorrect={onCorrect} onMistake={onMistake} />;
    case "find_opposite":   return <FindOppositeTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Неизвестный тип: {task?.type}
        </div>
      );
  }
}
```

- [ ] **Step 2: Run full engine tests to confirm nothing broke**

```bash
npx vitest run src/topics/renderers/opposites/
```

Expected: all 9 tests PASS, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/opposites/index.jsx
git commit -m "feat(opposites): wire find_opposite into OppositeRenderer"
```

---

## Self-Review Notes

- Spec coverage: all 4 sections covered (engine, CSS, component, routing)
- No TBDs or placeholders — every step has complete code
- `generateFindOppositeTasks` is called via `generateTasks({ type: "find_opposite" }, cards, n, params)` — consistent with existing callers
- `FindOppositeTask` props match what `OppositeRenderer` passes: `task`, `topicId`, `onCorrect`, `onIncorrect`
- `slotState` resets correctly: wrong drop resets to `"idle"` on next pointer events (but `answered=true` blocks further interaction — only correct drops set `answered`)
- Wait — on wrong drop, `answered` is set to `true` and `onIncorrect` fires after 900ms. This is intentional: one attempt per task, matching `choose_two` behavior.
