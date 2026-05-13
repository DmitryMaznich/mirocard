# Слушаем и собираем — Listen and Assemble Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Слушаем и собираем" mode to Конструктор предложений where children hear a sentence (or the therapist pronounces it) and then assemble it from shuffled word cards.

**Architecture:** The session engine (main app bundle) generates one task per sentence, each containing the target card assignments and a shuffled pool of correct cards + distractors. `ListenBuildView.jsx` (ZIP renderer component) handles a single sentence — audio playback, drag-and-drop into slots, slot-result highlighting, and calling `onCorrect`/`onIncorrect`. `SentenceRow` gets an optional `slotResults` prop for green/red slot borders. `index.jsx` becomes a thin router to either `SentencePuzzleBuilder` (renamed free-build component) or `ListenBuildView`. The topic.json gains 28 pre-defined sentences and the new mode entry; the ZIP version bumps 1.7.1 → 1.8.0.

**Tech Stack:** React 18, @dnd-kit/core (drag-and-drop), Vite IIFE renderer build, Vitest (unit tests for engine).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `tools/sentence_puzzle/topic.json` | Modify | Add `sentences[]`, add `listen_build` mode, bump version 1.7.1→1.8.0 |
| `src/topics/renderers/sentence_puzzle/engine.js` | Modify | New signature `(mode, topicRecord, sessionParams)`; handle both `sentence_puzzle` and `listen_build` |
| `src/topics/renderers/sentence_puzzle/engine.test.js` | Create | Unit tests for task generation (both modes) |
| `src/features/session/useSessionEngine.js` | Modify | Add `sentence_puzzle` special case to pass full `topicRecord` to engine (needed for sentences array) |
| `src/topics/renderers/sentence_puzzle/index.jsx` | Modify | Becomes thin router: delegates to `SentencePuzzleBuilder` or `ListenBuildView` |
| `src/topics/renderers/sentence_puzzle/SentencePuzzleBuilder.jsx` | Create | Current `index.jsx` content, renamed export |
| `src/topics/renderers/sentence_puzzle/ListenBuildView.jsx` | Create | New component: audio prompt, 1 sentence row, card pool, "Проверить" button |
| `src/topics/renderers/sentence_puzzle/SentenceRow.jsx` | Modify | Accept optional `slotResults` prop; apply `.sp-slot--correct` / `.sp-slot--incorrect` CSS classes |
| `src/topics/renderers/sentence_puzzle/sentence_puzzle.css` | Modify | Add audio section styles, slot result styles, shake animation |
| `public/decks/catalog.json` | Modify | sentence_puzzle entry: version 1.8.0, URL `sentence_puzzle_v1.8.0.zip` |

---

### Task 1: Update topic.json — sentences + listen_build mode

**Files:**
- Modify: `tools/sentence_puzzle/topic.json`

- [ ] **Step 1: Replace topic.json content**

Write the following to `tools/sentence_puzzle/topic.json`:

```json
{
  "meta": {
    "id": "sentence_puzzle",
    "version": "1.8.0",
    "renderer": "sentence_puzzle",
    "title": "Конструктор предложений"
  },
  "modes": [
    {
      "id": "sentence_puzzle",
      "type": "sentence_puzzle",
      "evaluation": "none",
      "ui": {
        "title": "Собираем пазл",
        "instruction": "Собери предложения из слов"
      },
      "params": {
        "level": {
          "type": "enum",
          "label": { "ru": "Сложность" },
          "values": [1, 2, 3],
          "labels": { "ru": { "1": "1 предложение", "2": "2 предложения", "3": "3 предложения" } },
          "default": 1
        },
        "structure": {
          "type": "enum",
          "label": { "ru": "Структура" },
          "values": ["simple", "full"],
          "labels": { "ru": { "simple": "Простая (кто + что делает)", "full": "Полная (кто + что делает + какую + что)" } },
          "default": "simple"
        }
      }
    },
    {
      "id": "listen_build",
      "type": "listen_build",
      "evaluation": "auto",
      "ui": {
        "title": "Слушаем и собираем",
        "instruction": "Послушай предложение и собери его из слов"
      },
      "params": {
        "structure": {
          "type": "enum",
          "label": { "ru": "Структура" },
          "values": ["simple", "full"],
          "labels": { "ru": { "simple": "Простая (кто + что делает)", "full": "Полная (кто + что делает + какую + что)" } },
          "default": "simple"
        },
        "distractors": {
          "type": "enum",
          "label": { "ru": "Лишних слов в наборе" },
          "values": [1, 2, 3],
          "labels": { "ru": { "1": "1 лишнее", "2": "2 лишних", "3": "3 лишних" } },
          "default": 2
        }
      }
    }
  ],
  "sentences": [
    { "id": "s01", "subject": "mom",     "verb": "wash"   },
    { "id": "s02", "subject": "mom",     "verb": "draw"   },
    { "id": "s03", "subject": "mom",     "verb": "read_v" },
    { "id": "s04", "subject": "mom",     "verb": "carry"  },
    { "id": "s05", "subject": "dad",     "verb": "wash"   },
    { "id": "s06", "subject": "dad",     "verb": "read_v" },
    { "id": "s07", "subject": "dad",     "verb": "search" },
    { "id": "s08", "subject": "dad",     "verb": "carry"  },
    { "id": "s09", "subject": "boy",     "verb": "draw"   },
    { "id": "s10", "subject": "boy",     "verb": "take"   },
    { "id": "s11", "subject": "boy",     "verb": "search" },
    { "id": "s12", "subject": "girl",    "verb": "wash"   },
    { "id": "s13", "subject": "girl",    "verb": "read_v" },
    { "id": "s14", "subject": "girl",    "verb": "draw"   },
    { "id": "s15", "subject": "grandma", "verb": "wash"   },
    { "id": "s16", "subject": "grandma", "verb": "carry"  },
    { "id": "s17", "subject": "grandpa", "verb": "search" },
    { "id": "s18", "subject": "grandpa", "verb": "carry"  },
    { "id": "f01", "subject": "mom",     "verb": "wash",   "adjective": "red",   "object": "cup"   },
    { "id": "f02", "subject": "mom",     "verb": "carry",  "adjective": "big",   "object": "book"  },
    { "id": "f03", "subject": "dad",     "verb": "draw",   "adjective": "blue",  "object": "car"   },
    { "id": "f04", "subject": "dad",     "verb": "take",   "adjective": "big",   "object": "spoon" },
    { "id": "f05", "subject": "boy",     "verb": "take",   "adjective": "small", "object": "toy"   },
    { "id": "f06", "subject": "boy",     "verb": "draw",   "adjective": "big",   "object": "car"   },
    { "id": "f07", "subject": "girl",    "verb": "wash",   "adjective": "clean", "object": "plate" },
    { "id": "f08", "subject": "girl",    "verb": "search", "adjective": "small", "object": "cup"   },
    { "id": "f09", "subject": "grandma", "verb": "carry",  "adjective": "big",   "object": "plate" },
    { "id": "f10", "subject": "grandpa", "verb": "take",   "adjective": "dirty", "object": "spoon" }
  ],
  "cards": [
    { "id": "mom",     "type": "subject",   "label": "Мама",      "emoji": "👩" },
    { "id": "dad",     "type": "subject",   "label": "Папа",      "emoji": "👨" },
    { "id": "grandma", "type": "subject",   "label": "Бабушка",   "emoji": "👵" },
    { "id": "grandpa", "type": "subject",   "label": "Дедушка",   "emoji": "👴" },
    { "id": "boy",     "type": "subject",   "label": "Мальчик",   "emoji": "👦" },
    { "id": "girl",    "type": "subject",   "label": "Девочка",   "emoji": "👧" },
    { "id": "wash",    "type": "verb",      "label": "моет",      "emoji": "🧼" },
    { "id": "carry",   "type": "verb",      "label": "несёт",     "emoji": "🤲" },
    { "id": "search",  "type": "verb",      "label": "ищет",      "emoji": "🔍" },
    { "id": "take",    "type": "verb",      "label": "берёт",     "emoji": "✋" },
    { "id": "draw",    "type": "verb",      "label": "рисует",    "emoji": "✏️" },
    { "id": "read_v",  "type": "verb",      "label": "читает",    "emoji": "📖" },
    { "id": "red",     "type": "adjective", "label": "красную",   "emoji": "🔴" },
    { "id": "blue",    "type": "adjective", "label": "синюю",     "emoji": "🔵" },
    { "id": "big",     "type": "adjective", "label": "большую",   "emoji": "⬆️" },
    { "id": "small",   "type": "adjective", "label": "маленькую", "emoji": "⬇️" },
    { "id": "clean",   "type": "adjective", "label": "чистую",    "emoji": "✨" },
    { "id": "dirty",   "type": "adjective", "label": "грязную",   "emoji": "🟤" },
    { "id": "cup",     "type": "object", "label": "чашку",    "nominative": "чашка",   "emoji": "☕" },
    { "id": "car",     "type": "object", "label": "машинку",  "nominative": "машинка", "emoji": "🚗" },
    { "id": "book",    "type": "object", "label": "книгу",    "nominative": "книга",   "emoji": "📕" },
    { "id": "spoon",   "type": "object", "label": "ложку",    "nominative": "ложка",   "emoji": "🥄" },
    { "id": "plate",   "type": "object", "label": "тарелку",  "nominative": "тарелка", "emoji": "🍽️" },
    { "id": "toy",     "type": "object", "label": "игрушку",  "nominative": "игрушка", "emoji": "🧸" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/sentence_puzzle/topic.json
git commit -m "feat(sentence_puzzle): add sentences array and listen_build mode (v1.8.0)"
```

---

### Task 2: Update engine.js + useSessionEngine.js (TDD)

**Files:**
- Modify: `src/topics/renderers/sentence_puzzle/engine.js`
- Modify: `src/features/session/useSessionEngine.js`
- Create: `src/topics/renderers/sentence_puzzle/engine.test.js`

**Context:** The current engine signature is `(mode, cards, sessionSize, sessionParams)`. We change it to `(mode, topicRecord, sessionParams)` so the engine can access `topicRecord.sentences`. The `useSessionEngine.js` passes only `cards` in the general else-branch — we add a `sentence_puzzle` special case there to pass `topicRecord` instead.

- [ ] **Step 1: Write failing tests**

Create `src/topics/renderers/sentence_puzzle/engine.test.js`:

```js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const topicRecord = {
  cards: [
    { id: "mom",    type: "subject", label: "Мама",   emoji: "👩" },
    { id: "dad",    type: "subject", label: "Папа",   emoji: "👨" },
    { id: "boy",    type: "subject", label: "Мальчик", emoji: "👦" },
    { id: "wash",   type: "verb",    label: "моет",   emoji: "🧼" },
    { id: "draw",   type: "verb",    label: "рисует", emoji: "✏️" },
    { id: "read_v", type: "verb",    label: "читает", emoji: "📖" },
  ],
  sentences: [
    { id: "s01", subject: "mom", verb: "wash" },
    { id: "s02", subject: "dad", verb: "draw" },
    { id: "s03", subject: "boy", verb: "read_v" },
  ],
};

describe("generateTasks — sentence_puzzle mode", () => {
  it("returns one task with subjects and verbs", () => {
    const tasks = generateTasks({ type: "sentence_puzzle" }, topicRecord, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("sentence_puzzle");
    expect(tasks[0].subjects).toHaveLength(3);
    expect(tasks[0].verbs).toHaveLength(3);
  });
});

describe("generateTasks — listen_build mode", () => {
  it("returns one task per sentence", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 1 }
    );
    expect(tasks).toHaveLength(3);
  });

  it("each task.target contains the correct cards", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 0 }
    );
    const t = tasks.find((x) => x.target.subject.id === "mom");
    expect(t).toBeDefined();
    expect(t.target.verb.id).toBe("wash");
    expect(t.type).toBe("listen_build");
  });

  it("pool has correct card + N distractors per slot type", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 1 }
    );
    const task = tasks[0];
    const subjects = task.pool.filter((c) => c.type === "subject");
    const verbs    = task.pool.filter((c) => c.type === "verb");
    expect(subjects).toHaveLength(2); // 1 correct + 1 distractor
    expect(verbs).toHaveLength(2);
  });

  it("pool always contains the correct card for each slot", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 2 }
    );
    for (const task of tasks) {
      for (const slotType of ["subject", "verb"]) {
        const correctId = task.target[slotType].id;
        expect(task.pool.some((c) => c.id === correctId)).toBe(true);
      }
    }
  });

  it("filters to only simple sentences when structure=simple", () => {
    const topicWithFull = {
      cards: [
        ...topicRecord.cards,
        { id: "red", type: "adjective", label: "красную", emoji: "🔴" },
        { id: "cup", type: "object",    label: "чашку",   emoji: "☕" },
      ],
      sentences: [
        ...topicRecord.sentences,
        { id: "f01", subject: "mom", verb: "wash", adjective: "red", object: "cup" },
      ],
    };
    const tasks = generateTasks(
      { type: "listen_build" },
      topicWithFull,
      { structure: "simple", distractors: 0 }
    );
    expect(tasks).toHaveLength(3); // only the 3 simple sentences
  });

  it("task.audioPath is null when sentence has no audio field", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 0 }
    );
    expect(tasks[0].audioPath).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/topics/renderers/sentence_puzzle/engine.test.js
```

Expected: FAIL — current engine signature `(mode, cards, sessionSize, sessionParams)` doesn't match.

- [ ] **Step 3: Replace engine.js**

Replace the full content of `src/topics/renderers/sentence_puzzle/engine.js`:

```js
import { shuffle } from "@/shared/utils/shuffle";

export function generateTasks(mode, topicRecord, sessionParams) {
  const cards = topicRecord.cards ?? [];

  if (mode.type === "sentence_puzzle") {
    return [{
      type:       "sentence_puzzle",
      subjects:   cards.filter((c) => c.type === "subject"),
      verbs:      cards.filter((c) => c.type === "verb"),
      adjectives: cards.filter((c) => c.type === "adjective"),
      objects:    cards.filter((c) => c.type === "object"),
    }];
  }

  if (mode.type === "listen_build") {
    const structure   = sessionParams?.structure ?? "simple";
    const distractors = Math.max(0, Number(sessionParams?.distractors ?? 2));
    const isSimple    = structure === "simple";
    const slotTypes   = isSimple
      ? ["subject", "verb"]
      : ["subject", "verb", "adjective", "object"];

    const sentences = (topicRecord.sentences ?? []).filter((s) =>
      isSimple ? (!s.adjective && !s.object) : (s.adjective && s.object)
    );

    const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));

    return shuffle([...sentences]).map((sentence) => {
      const target = Object.fromEntries(
        slotTypes.map((t) => [t, cardById[sentence[t]]])
      );

      const pool = [];
      for (const slotType of slotTypes) {
        const correct = target[slotType];
        const others  = cards.filter((c) => c.type === slotType && c.id !== correct.id);
        const picks   = shuffle([...others]).slice(0, distractors);
        pool.push(correct, ...picks);
      }

      return {
        type:      "listen_build",
        structure,
        target,
        pool:      shuffle(pool),
        audioPath: sentence.audio ?? null,
      };
    });
  }

  return [];
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/topics/renderers/sentence_puzzle/engine.test.js
```

Expected: PASS (all 6 tests).

- [ ] **Step 5: Update useSessionEngine.js**

In `src/features/session/useSessionEngine.js`, insert a new `else if` branch for `sentence_puzzle` between the `flashcards` branch and the general `else`. Current block around lines 46-58:

```js
    } else if (renderer === "flashcards") {
      const allConcepts = deriveConcepts(topicRecord.cards);
      const concepts = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
      const generateTasks = ENGINE_REGISTRY["flashcards"];
      tasks = generateTasks(mode.type, concepts, topicRecord.cards, sessionParams);
    } else {
```

Replace with:

```js
    } else if (renderer === "flashcards") {
      const allConcepts = deriveConcepts(topicRecord.cards);
      const concepts = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
      const generateTasks = ENGINE_REGISTRY["flashcards"];
      tasks = generateTasks(mode.type, concepts, topicRecord.cards, sessionParams);
    } else if (renderer === "sentence_puzzle") {
      const generateTasks = ENGINE_REGISTRY["sentence_puzzle"];
      tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams) : [];
    } else {
```

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/engine.js src/topics/renderers/sentence_puzzle/engine.test.js src/features/session/useSessionEngine.js
git commit -m "feat(sentence_puzzle): new engine with listen_build task generation; pass topicRecord to engine"
```

---

### Task 3: Update SentenceRow — slot result highlighting

**Files:**
- Modify: `src/topics/renderers/sentence_puzzle/SentenceRow.jsx`
- Modify: `src/topics/renderers/sentence_puzzle/sentence_puzzle.css`

**Context:** `SentenceRow` is used in both free-build and listen_build modes. Adding `slotResults` as an optional prop (defaults to null) preserves existing behavior — the free-build mode never passes it.

- [ ] **Step 1: Replace SentenceRow.jsx**

```jsx
import { useDroppable } from "@dnd-kit/core";
import PuzzlePieceSvg, { BODY_W, BODY_H } from "./PuzzlePiece";

export const SLOT_TYPES = {
  simple: ["subject", "verb"],
  full:   ["subject", "verb", "adjective", "object"],
};

function Slot({ rowIndex, slotType, card, position, structure, result }) {
  const { isOver, setNodeRef } = useDroppable({
    id:   `${rowIndex}_${slotType}`,
    data: { rowIndex, slotType },
  });

  const resultClass = result === "correct"   ? " sp-slot--correct"
                    : result === "incorrect" ? " sp-slot--incorrect"
                    : "";

  return (
    <div
      ref={setNodeRef}
      className={`sp-slot${resultClass}`}
      style={{
        flex:        1,
        aspectRatio: `${BODY_W} / ${BODY_H}`,
        position:    "relative",
        zIndex:      position + 1,
        overflow:    "visible",
      }}
    >
      <PuzzlePieceSvg
        slotType={slotType}
        structure={structure}
        emoji={card?.emoji}
        label={card?.label}
        photo={card?.photo ?? null}
        isEmpty={!card}
        isOver={isOver}
        scalable
      />
    </div>
  );
}

export default function SentenceRow({ rowIndex, structure, placed, slotResults }) {
  const slots = SLOT_TYPES[structure] ?? SLOT_TYPES.simple;

  return (
    <div className="sp-row">
      {slots.map((slotType, i) => (
        <Slot
          key={slotType}
          rowIndex={rowIndex}
          slotType={slotType}
          card={placed[slotType] ?? null}
          position={i}
          structure={structure}
          result={slotResults?.[slotType] ?? null}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Append to sentence_puzzle.css**

Add the following block at the end of `src/topics/renderers/sentence_puzzle/sentence_puzzle.css`:

```css
/* ── Slot result highlighting (listen_build) ── */
.sp-slot { position: relative; }

.sp-slot--correct {
  outline: 3px solid #22c55e;
  border-radius: 8px;
}
.sp-slot--incorrect {
  outline: 3px solid #ef4444;
  border-radius: 8px;
  animation: sp-shake 0.4s ease;
}

@keyframes sp-shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}

/* ── Audio section (listen_build) ── */
.sp-audio-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0;
  min-height: 64px;
}

.sp-audio-btn {
  font-size: 48px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 16px;
  border-radius: 12px;
  transition: transform 0.1s;
}
.sp-audio-btn:active { transform: scale(0.92); }

.sp-audio-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.sp-audio-prompt__label {
  font-size: 14px;
  color: #9ca3af;
}
.sp-audio-prompt__sentence {
  font-size: 22px;
  font-weight: 700;
  color: #374151;
  text-align: center;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/SentenceRow.jsx src/topics/renderers/sentence_puzzle/sentence_puzzle.css
git commit -m "feat(sentence_puzzle): slot result highlighting and audio section CSS"
```

---

### Task 4: Create ListenBuildView.jsx

**Files:**
- Create: `src/topics/renderers/sentence_puzzle/ListenBuildView.jsx`

**Context:** This component handles exactly one sentence (one task). The session engine remounts it for each new task via the `key={taskIndex}` prop in `SessionScreen`. On incorrect answer, the session engine sets `taskRetry++` which also remounts the component via `key={taskIndex}_${taskRetry}` — so the placed-cards state resets automatically without manual cleanup.

- [ ] **Step 1: Create ListenBuildView.jsx**

```jsx
import { useState, useEffect }                                                        from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import SentenceRow, { SLOT_TYPES } from "./SentenceRow";
import CardPool                    from "./CardPool";
import PuzzlePieceSvg              from "./PuzzlePiece";

export default function ListenBuildView({
  task, topicId, soundEnabled, playTopicFile, onCorrect, onIncorrect,
}) {
  const slotTypes = SLOT_TYPES[task.structure] ?? SLOT_TYPES.simple;
  const emptyRow  = () => Object.fromEntries(slotTypes.map((t) => [t, null]));

  const [placed,      setPlaced]      = useState(emptyRow);
  const [pool,        setPool]        = useState(() => [...task.pool]);
  const [slotResults, setSlotResults] = useState(null);
  const [activeCard,  setActiveCard]  = useState(null);

  useEffect(() => {
    if (task.audioPath && soundEnabled) {
      playTopicFile(topicId, task.audioPath);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const isComplete = slotTypes.every((t) => placed[t] !== null);

  function handleDragStart({ active }) {
    setActiveCard(active.data.current?.card ?? null);
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null);
    if (!over) return;
    const card = active.data.current?.card;
    if (!card) return;
    const { rowIndex, slotType } = over.data.current ?? {};
    if (rowIndex === undefined || !slotType) return;
    if (card.type !== slotType) return;

    setPlaced((prev) => {
      if (prev[slotType] !== null) return prev;
      return { ...prev, [slotType]: card };
    });
    setPool((prev) => prev.filter((c) => c.id !== card.id));
  }

  function handleCheck() {
    const results = Object.fromEntries(
      slotTypes.map((t) => [t, placed[t]?.id === task.target[t]?.id ? "correct" : "incorrect"])
    );
    setSlotResults(results);
    const allCorrect = slotTypes.every((t) => results[t] === "correct");
    setTimeout(() => {
      if (allCorrect) onCorrect();
      else            onIncorrect();
    }, 600);
  }

  function handleReplay() {
    if (task.audioPath && soundEnabled) playTopicFile(topicId, task.audioPath);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="sp-screen">

        <div className="sp-audio-section">
          {task.audioPath ? (
            <button className="sp-audio-btn" onClick={handleReplay} aria-label="Повторить предложение">
              🔊
            </button>
          ) : (
            <div className="sp-audio-prompt">
              <span className="sp-audio-prompt__label">Произнесите вслух:</span>
              <span className="sp-audio-prompt__sentence">
                {slotTypes.map((t) => task.target[t]?.label ?? "").join(" ")}
              </span>
            </div>
          )}
        </div>

        <div className="sp-rows-area">
          <SentenceRow
            rowIndex={0}
            structure={task.structure}
            placed={placed}
            slotResults={slotResults}
          />
        </div>

        <CardPool cards={pool} structure={task.structure} />

        {isComplete && !slotResults && (
          <div className="sp-complete-bar">
            <button className="sp-btn sp-btn--primary" onClick={handleCheck}>
              Проверить →
            </button>
          </div>
        )}

      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <div className="sp-card-overlay">
            <PuzzlePieceSvg
              slotType={activeCard.type}
              structure={task.structure}
              emoji={activeCard.emoji}
              label={activeCard.label}
              photo={activeCard.photo ?? null}
              isEmpty={false}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/ListenBuildView.jsx
git commit -m "feat(sentence_puzzle): add ListenBuildView component for listen_build mode"
```

---

### Task 5: Refactor index.jsx → router + SentencePuzzleBuilder

**Files:**
- Create: `src/topics/renderers/sentence_puzzle/SentencePuzzleBuilder.jsx`
- Modify: `src/topics/renderers/sentence_puzzle/index.jsx`

**Context:** React rules forbid calling hooks before a conditional return. Since `ListenBuildView` and `SentencePuzzleBuilder` have completely different hook setups (different `useState` shapes, different DnD contexts), we route between them in a parent component that has no hooks itself. The CSS import moves to `index.jsx` so the ZIP bundle still includes it regardless of which branch renders.

- [ ] **Step 1: Create SentencePuzzleBuilder.jsx**

Create `src/topics/renderers/sentence_puzzle/SentencePuzzleBuilder.jsx` with the full current content of `index.jsx`, renaming the export:

```jsx
import { useState }                                                                   from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { shuffle }    from "@/shared/utils/shuffle";
import SentenceRow, { SLOT_TYPES } from "./SentenceRow";
import CardPool       from "./CardPool";
import QuestionsView  from "./QuestionsView";
import PuzzlePieceSvg from "./PuzzlePiece";

function pickN(arr, n) {
  return shuffle([...arr]).slice(0, Math.min(n, arr.length));
}

function adultsAsSubjects(student) {
  const adults = student?.closeAdults;
  if (!Array.isArray(adults) || adults.length === 0) return null;
  return adults.map((a) => ({
    id:    `adult_${a.id}`,
    type:  "subject",
    label: a.name,
    emoji: null,
    photo: a.photo ?? null,
  }));
}

function buildRound(task, sessionParams, student) {
  const level     = Number(sessionParams?.level)  || 1;
  const structure = sessionParams?.structure      || "simple";
  const slotTypes = SLOT_TYPES[structure] ?? SLOT_TYPES.simple;

  const adultSubjects = adultsAsSubjects(student);
  const subjects   = adultSubjects ? pickN(adultSubjects, level) : pickN(task.subjects, level);
  const verbs      = pickN(task.verbs,      level);
  const adjectives = structure === "full" ? pickN(task.adjectives, level) : [];
  const objects    = structure === "full" ? pickN(task.objects,    level) : [];

  const pool     = shuffle([...subjects, ...verbs, ...adjectives, ...objects]);
  const emptyRow = () => Object.fromEntries(slotTypes.map((t) => [t, null]));
  const rows     = Array.from({ length: level }, emptyRow);

  return { pool, rows, structure, slotTypes, level };
}

function playSound(name, enabled) {
  if (!enabled) return;
  const ext = name === "incorrect" ? "mp3" : "wav";
  try { new Audio(`/sounds/${name}.${ext}`).play(); } catch {}
}

export default function SentencePuzzleBuilder({ task, sessionParams, student, soundEnabled }) {
  const [round,      setRound]      = useState(() => buildRound(task, sessionParams, student));
  const [phase,      setPhase]      = useState("building");
  const [activeCard, setActiveCard] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const isComplete = round.rows.every((placed) =>
    round.slotTypes.every((t) => placed[t] !== null)
  );

  function handleDragStart({ active }) {
    setActiveCard(active.data.current?.card ?? null);
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null);
    if (!over) return;

    const card = active.data.current?.card;
    if (!card) return;

    const { rowIndex, slotType } = over.data.current ?? {};
    if (rowIndex === undefined || !slotType) return;

    if (card.type !== slotType) {
      playSound("incorrect", soundEnabled);
      return;
    }

    setRound((prev) => {
      if (prev.rows[rowIndex]?.[slotType] !== null) return prev;
      const newRows = prev.rows.map((row, i) =>
        i === rowIndex ? { ...row, [slotType]: card } : row
      );
      const newPool = prev.pool.filter((c) => c.id !== card.id);
      const rowComplete = prev.slotTypes.every((t) => newRows[rowIndex][t] !== null);
      if (rowComplete) playSound("correct", soundEnabled);
      return { ...prev, rows: newRows, pool: newPool };
    });
  }

  function startNewRound() {
    setRound(buildRound(task, sessionParams, student));
    setPhase("building");
  }

  if (phase === "questions") {
    return (
      <QuestionsView
        rows={round.rows}
        structure={round.structure}
        onNewRound={startNewRound}
        onBack={() => setPhase("building")}
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="sp-screen">
        <div className="sp-rows-area">
          <div className="sp-title">
            {round.level === 1 ? "Собери предложение" : "Собери предложения"}
          </div>
          {round.rows.map((placed, rowIndex) => (
            <SentenceRow
              key={rowIndex}
              rowIndex={rowIndex}
              structure={round.structure}
              placed={placed}
            />
          ))}
        </div>

        <CardPool cards={round.pool} structure={round.structure} />

        {isComplete && (
          <div className="sp-complete-bar">
            <button className="sp-btn sp-btn--primary" onClick={() => setPhase("questions")}>
              Вопросы →
            </button>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <div className="sp-card-overlay">
            <PuzzlePieceSvg
              slotType={activeCard.type}
              structure={round.structure}
              emoji={activeCard.emoji}
              label={activeCard.label}
              photo={activeCard.photo ?? null}
              isEmpty={false}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Replace index.jsx with thin router**

Replace the full content of `src/topics/renderers/sentence_puzzle/index.jsx`:

```jsx
import SentencePuzzleBuilder from "./SentencePuzzleBuilder";
import ListenBuildView       from "./ListenBuildView";
import "./sentence_puzzle.css";

export default function SentencePuzzleRenderer(props) {
  if (props.mode?.type === "listen_build") {
    return (
      <ListenBuildView
        task={props.task}
        topicId={props.topicId}
        soundEnabled={props.soundEnabled}
        playTopicFile={props.playTopicFile}
        onCorrect={props.onCorrect}
        onIncorrect={props.onIncorrect}
      />
    );
  }
  return (
    <SentencePuzzleBuilder
      task={props.task}
      sessionParams={props.sessionParams}
      student={props.student}
      soundEnabled={props.soundEnabled}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/sentence_puzzle/SentencePuzzleBuilder.jsx src/topics/renderers/sentence_puzzle/index.jsx
git commit -m "refactor(sentence_puzzle): extract SentencePuzzleBuilder; index.jsx becomes router"
```

---

### Task 6: Build v1.8.0 ZIP, update catalog, deploy

**Files:**
- Modify: `public/decks/catalog.json`

- [ ] **Step 1: Update catalog.json — sentence_puzzle entry**

In `public/decks/catalog.json`, change the `sentence_puzzle` entry to:

```json
{
  "id": "sentence_puzzle",
  "version": "1.8.0",
  "title": { "ru": "Конструктор предложений", "en": "Sentence Builder" },
  "description": {
    "ru": "Собираем пазл из слов и слушаем предложения. Цветовое кодирование ролей.",
    "en": "Assemble sentences from word cards. Color-coded roles. Listen-and-build mode."
  },
  "url": "./decks/sentence_puzzle_v1.8.0.zip"
}
```

- [ ] **Step 2: Build the renderer ZIP**

```bash
node tools/sentence_puzzle/build.mjs
```

Expected: `tools/sentence_puzzle/sentence_puzzle.zip` created. Console shows "✓ Built: …/sentence_puzzle.zip".

- [ ] **Step 3: Copy ZIP to public/decks**

```bash
cp tools/sentence_puzzle/sentence_puzzle.zip public/decks/sentence_puzzle_v1.8.0.zip
```

- [ ] **Step 4: Build main app**

```bash
npm run build
```

Expected: Vite build completes with no errors. `dist/` is updated.

- [ ] **Step 5: Deploy to production**

```bash
npm run deploy:prod
```

Expected: SSH upload succeeds, server reloads.

- [ ] **Step 6: Commit**

```bash
git add public/decks/catalog.json public/decks/sentence_puzzle_v1.8.0.zip
git commit -m "chore: release sentence_puzzle v1.8.0 — add listen_build mode"
```

---

## Manual Verification Checklist

After deploy, open the app on the tablet:

1. **Open Конструктор предложений** — verify "Слушаем и собираем" appears as a second mode
2. **Start listen_build, simple structure, 2 distractors** — session starts
3. **Audio prompt**: "Произнесите вслух: Мама моет" (or similar — no audio files yet, text fallback)
4. **Pool**: shows 6 cards — 3 subjects + 3 verbs (1 correct + 2 distractors each), with deterministic tilt
5. **Drag correct subject into subject slot, correct verb into verb slot** → "Проверить →" appears
6. **Tap Проверить** — both slots flash green briefly, then session "Правильно!" overlay appears
7. **Tap overlay to advance** — next sentence appears (different cards), progress bar advances
8. **Drag wrong verb into verb slot**, then correct subject → tap Проверить → verb slot shows red + shake, subject shows green → "Попробуем ещё раз…" overlay → auto-resets after 1.5s → same sentence again
9. **After all 18 sentences (simple)**: session summary with correct/incorrect counts
10. **Free-build mode (Собираем пазл)** still works — verify Questions view, multi-row, type-mismatch sound
11. **Full-structure listen_build** — verify 4-slot layout with adjective + object
