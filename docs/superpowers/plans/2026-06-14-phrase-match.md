# phrase_match — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `phrase_match` renderer that shows similar phrases on the left and images on the right; the student drag-and-drops images onto the correct phrases to force precise sentence reading.

**Architecture:** New renderer in `src/topics/renderers/phrase_match/` following the existing engine+index pattern. Deck data uses `groups` (not `cards`), so topicLoader and useSessionEngine both need a small addition. The generate script reads images from Cardgen Studio and packs a pilot ZIP.

**Tech Stack:** React, pointer-events drag-and-drop (same pattern as SortTask.jsx in opposites), JSZip for script, Vitest for engine tests.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/topics/renderers/phrase_match/engine.js` | generateTasks: groups → shuffled match tasks |
| Create | `src/topics/renderers/phrase_match/engine.test.js` | unit tests for engine |
| Create | `src/topics/renderers/phrase_match/MatchTask.jsx` | drag-and-drop UI |
| Create | `src/topics/renderers/phrase_match/phrase_match.css` | layout + visual states |
| Create | `src/topics/renderers/phrase_match/index.jsx` | renderer entry point |
| Create | `scripts/generate-phrase-match-pilot.mjs` | pack pilot ZIP |
| Modify | `src/topics/renderers/engineRegistry.js` | register phrase_match engine |
| Modify | `src/topics/topicLoader.js` | allow groups-based decks, validate group images |
| Modify | `src/features/session/useSessionEngine.js` | route phrase_match to engine |
| Modify | `public/decks/catalog.json` | add pilot deck entry |

---

## Task 1 — engine.js + tests

**Files:**
- Create: `src/topics/renderers/phrase_match/engine.js`
- Create: `src/topics/renderers/phrase_match/engine.test.js`

- [ ] **Step 1.1 — Write failing tests**

```js
// src/topics/renderers/phrase_match/engine.test.js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const MOCK_RECORD = {
  groups: [
    {
      id: "soup",
      items: [
        { id: "soup_pour", phrase: "Чем наливают суп?", image: "media/soup_pour.webp" },
        { id: "soup_eat",  phrase: "Чем едят суп?",      image: "media/soup_eat.webp"  },
        { id: "soup_cook", phrase: "В чём варят суп?",   image: "media/soup_cook.webp" },
      ],
      distractors: [
        { id: "d_fork",  image: "media/d_fork.webp"  },
        { id: "d_plate", image: "media/d_plate.webp" },
      ],
    },
    {
      id: "cut",
      items: [
        { id: "cut_bread", phrase: "Чем режут хлеб?",   image: "media/cut_bread.webp" },
        { id: "cut_paper", phrase: "Чем режут бумагу?", image: "media/cut_paper.webp" },
        { id: "cut_nails", phrase: "Чем режут ногти?",  image: "media/cut_nails.webp" },
      ],
      distractors: [
        { id: "d_pencil", image: "media/d_pencil.webp" },
        { id: "d_ruler",  image: "media/d_ruler.webp"  },
      ],
    },
  ],
};

describe("generateTasks", () => {
  it("returns [] for unknown mode type", () => {
    expect(generateTasks({ type: "unknown" }, MOCK_RECORD)).toEqual([]);
  });

  it("returns one task per group for mode type 'match'", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    expect(tasks).toHaveLength(2);
  });

  it("each task has type 'match', groupId, items, and images", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    const task = tasks.find(t => t.groupId === "soup");
    expect(task.type).toBe("match");
    expect(task.items).toHaveLength(3);
    expect(task.images).toHaveLength(5); // 3 correct + 2 distractors
  });

  it("images contains both correct and distractor entries", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    const task = tasks.find(t => t.groupId === "soup");
    const correct = task.images.filter(i => !i.isDistractor);
    const wrong   = task.images.filter(i =>  i.isDistractor);
    expect(correct).toHaveLength(3);
    expect(wrong).toHaveLength(2);
  });

  it("correct image ids match item ids", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    const task = tasks.find(t => t.groupId === "soup");
    const correctIds = task.images.filter(i => !i.isDistractor).map(i => i.id);
    expect(correctIds.sort()).toEqual(["soup_cook", "soup_eat", "soup_pour"]);
  });

  it("handles missing groups gracefully", () => {
    expect(generateTasks({ type: "match" }, {})).toEqual([]);
  });
});
```

- [ ] **Step 1.2 — Run tests, confirm they fail**

```
npx vitest run src/topics/renderers/phrase_match/engine.test.js
```

Expected: `FAIL` — `Cannot find module './engine'`

- [ ] **Step 1.3 — Implement engine.js**

```js
// src/topics/renderers/phrase_match/engine.js
import { shuffle } from "@/shared/utils/shuffle";

export function generateTasks(mode, topicRecord, params = {}) {
  if (mode.type !== "match") return [];
  const groups = topicRecord.groups ?? [];
  return shuffle(groups).map(group => ({
    type:    "match",
    groupId: group.id,
    items:   group.items,
    images:  shuffle([
      ...group.items.map(item => ({ id: item.id, image: item.image, isDistractor: false })),
      ...(group.distractors ?? []).map(d => ({ id: d.id, image: d.image, isDistractor: true })),
    ]),
  }));
}
```

- [ ] **Step 1.4 — Run tests, confirm they pass**

```
npx vitest run src/topics/renderers/phrase_match/engine.test.js
```

Expected: all 6 tests `PASS`

- [ ] **Step 1.5 — Commit**

```
git add src/topics/renderers/phrase_match/engine.js src/topics/renderers/phrase_match/engine.test.js
git commit -m "feat(phrase_match): engine — generateTasks from groups"
```

---

## Task 2 — topicLoader: allow phrase_match without cards

**Files:**
- Modify: `src/topics/topicLoader.js`

The current `validateManifest` (line ~51) rejects any non-reading, non-narrative deck that lacks a non-empty `cards` array. `phrase_match` uses `groups`, so we must exempt it. We also add image validation for groups.

- [ ] **Step 2.1 — Update validateManifest**

In `src/topics/topicLoader.js`, find this block (around line 45–53):

```js
  const isReading   = manifest.meta.renderer === "reading" || Array.isArray(manifest.texts);
  const isNarrative = manifest.meta.renderer === "narrative";
  if (isReading) {
    if (!Array.isArray(manifest.texts) || manifest.texts.length === 0) {
      throw new TopicImportError("Тема чтения не содержит текстов");
    }
  } else if (!isNarrative && (!Array.isArray(manifest.cards) || manifest.cards.length === 0)) {
    throw new TopicImportError("Тема не содержит карточек");
  }
```

Replace with:

```js
  const isReading      = manifest.meta.renderer === "reading" || Array.isArray(manifest.texts);
  const isNarrative    = manifest.meta.renderer === "narrative";
  const isPhraseMatch  = manifest.meta.renderer === "phrase_match";
  if (isReading) {
    if (!Array.isArray(manifest.texts) || manifest.texts.length === 0) {
      throw new TopicImportError("Тема чтения не содержит текстов");
    }
  } else if (isPhraseMatch) {
    if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
      throw new TopicImportError("Тема phrase_match не содержит групп");
    }
  } else if (!isNarrative && (!Array.isArray(manifest.cards) || manifest.cards.length === 0)) {
    throw new TopicImportError("Тема не содержит карточек");
  }
```

- [ ] **Step 2.2 — Update validateImages to check group images**

In `validateImages` (around line 74), find:

```js
function validateImages(manifest, zip) {
  const isProcedural = manifest.meta.cardType === "procedural" || !!manifest.meta.renderer;
  for (const card of manifest.cards ?? []) {
    if (isProcedural && card.renderer) continue;
    if (card.image && !zip.file(card.image)) {
      throw new TopicImportError(`Файл не найден в ZIP: ${card.image}`);
    }
  }
```

Replace with:

```js
function validateImages(manifest, zip) {
  const isProcedural = manifest.meta.cardType === "procedural" || !!manifest.meta.renderer;
  for (const card of manifest.cards ?? []) {
    if (isProcedural && card.renderer) continue;
    if (card.image && !zip.file(card.image)) {
      throw new TopicImportError(`Файл не найден в ZIP: ${card.image}`);
    }
  }

  for (const group of manifest.groups ?? []) {
    for (const item of group.items ?? []) {
      if (item.image && !zip.file(item.image)) {
        throw new TopicImportError(`Файл не найден в ZIP: ${item.image}`);
      }
    }
    for (const d of group.distractors ?? []) {
      if (d.image && !zip.file(d.image)) {
        throw new TopicImportError(`Файл не найден в ZIP: ${d.image}`);
      }
    }
  }
```

- [ ] **Step 2.3 — Run existing topicLoader tests**

```
npx vitest run src/topics/topicLoader.test.js
```

Expected: all existing tests `PASS` (no regressions)

- [ ] **Step 2.4 — Commit**

```
git add src/topics/topicLoader.js
git commit -m "feat(phrase_match): topicLoader — allow groups-based decks"
```

---

## Task 3 — Register engine + wire session routing

**Files:**
- Modify: `src/topics/renderers/engineRegistry.js`
- Modify: `src/features/session/useSessionEngine.js`

- [ ] **Step 3.1 — Register in engineRegistry.js**

Add after the last import (before `export const ENGINE_REGISTRY`):

```js
import { generateTasks as phraseMatchEngine } from "./phrase_match/engine";
```

Add inside `ENGINE_REGISTRY`:

```js
  phrase_match: phraseMatchEngine,
```

- [ ] **Step 3.2 — Add routing in useSessionEngine.js**

In `buildGeneratedSessionState`, find the `} else if (renderer === "shopping") {` block (around line 71–73):

```js
  } else if (renderer === "shopping") {
    const generateTasks = ENGINE_REGISTRY.shopping;
    tasks = generateTasks ? generateTasks(mode, topicRecord) : [];
  } else {
```

Insert before the `} else {` fallback:

```js
  } else if (renderer === "phrase_match") {
    const generateTasks = ENGINE_REGISTRY.phrase_match;
    tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams) : [];
  } else {
```

- [ ] **Step 3.3 — Run all tests**

```
npx vitest run
```

Expected: all tests `PASS`

- [ ] **Step 3.4 — Commit**

```
git add src/topics/renderers/engineRegistry.js src/features/session/useSessionEngine.js
git commit -m "feat(phrase_match): register engine and wire session routing"
```

---

## Task 4 — CSS

**Files:**
- Create: `src/topics/renderers/phrase_match/phrase_match.css`

- [ ] **Step 4.1 — Create phrase_match.css**

```css
/* src/topics/renderers/phrase_match/phrase_match.css */

.pm-root {
  display: flex;
  flex-direction: row;
  gap: 12px;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  touch-action: none;
  user-select: none;
}

/* Left column: phrase drop-zones */
.pm-phrases {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
}

.pm-slot {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 72px;
  padding: 8px 12px;
  border: 2px dashed #ccc;
  border-radius: 12px;
  background: #fafafa;
  transition: border-color 0.15s, background 0.15s;
}

.pm-slot--hover {
  border-color: #4a90d9;
  background: #e8f2fb;
}

.pm-slot--matched {
  border-style: solid;
  border-color: #4caf50;
  background: #f1fbf2;
}

.pm-slot--error {
  border-color: #e53935;
  background: #fdecea;
}

.pm-slot__img {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border-radius: 8px;
  flex-shrink: 0;
}

.pm-slot__img--placeholder {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  background: #e0e0e0;
  flex-shrink: 0;
}

.pm-slot__phrase {
  font-size: 1rem;
  line-height: 1.3;
  color: #222;
}

/* Right column: draggable image pool */
.pm-pool {
  flex: 0 0 auto;
  width: 120px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
}

.pm-pool__img {
  width: 100px;
  height: 100px;
  object-fit: contain;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: #fff;
  cursor: grab;
  touch-action: none;
}

.pm-pool__img--dragging {
  opacity: 0.35;
}

/* Ghost (floating image during drag) */
.pm-ghost {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
  width: 100px;
  height: 100px;
  object-fit: contain;
  border-radius: 12px;
  border: 2px solid #4a90d9;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
}
```

- [ ] **Step 4.2 — Commit**

```
git add src/topics/renderers/phrase_match/phrase_match.css
git commit -m "feat(phrase_match): add CSS layout and visual states"
```

---

## Task 5 — MatchTask.jsx + index.jsx

**Files:**
- Create: `src/topics/renderers/phrase_match/MatchTask.jsx`
- Create: `src/topics/renderers/phrase_match/index.jsx`

- [ ] **Step 5.1 — Create MatchTask.jsx**

```jsx
// src/topics/renderers/phrase_match/MatchTask.jsx
import { useState, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./phrase_match.css";

function PoolImage({ topicId, img, isDragging }) {
  const url = useTopicFile(topicId, img.image);
  if (!url) return <div className="pm-pool__img" style={{ background: "#e0e0e0" }} />;
  return (
    <img
      className={`pm-pool__img${isDragging ? " pm-pool__img--dragging" : ""}`}
      src={url}
      alt=""
      draggable={false}
    />
  );
}

function SlotImage({ topicId, image }) {
  const url = useTopicFile(topicId, image);
  if (!url) return <div className="pm-slot__img--placeholder" />;
  return <img className="pm-slot__img" src={url} alt="" draggable={false} />;
}

export default function MatchTask({ task, topicId, onCorrect, onMistake }) {
  const { items, images } = task;

  // placements: itemId → imageId (confirmed correct pairs)
  const [placements, setPlacements] = useState({});
  const [dragging, setDragging]     = useState(null); // { img, x, y, offsetX, offsetY }
  const [hoverSlot, setHoverSlot]   = useState(null); // itemId being hovered
  const [errorSlot, setErrorSlot]   = useState(null); // itemId flashing red
  const [done, setDone]             = useState(false);
  const slotRefs   = useRef({});
  const onCorrectRef = useRef(onCorrect);
  onCorrectRef.current = onCorrect;

  // Matched imageIds (correctly placed)
  const matchedImageIds = new Set(Object.values(placements));

  // Images still in pool (not matched)
  const poolImages = images.filter(img => !matchedImageIds.has(img.id));

  function getSlotAt(x, y) {
    for (const item of items) {
      const el = slotRefs.current[item.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return item.id;
    }
    return null;
  }

  function handlePointerDown(e, img) {
    if (done || matchedImageIds.has(img.id)) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      img,
      x: rect.left,
      y: rect.top,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    setDragging(prev => ({ ...prev, x: e.clientX - prev.offsetX, y: e.clientY - prev.offsetY }));
    setHoverSlot(getSlotAt(e.clientX, e.clientY));
  }

  function handlePointerUp(e) {
    if (!dragging) return;
    const slotId = getSlotAt(e.clientX, e.clientY);
    const img    = dragging.img;
    setDragging(null);
    setHoverSlot(null);

    if (!slotId) return;

    // Correct if image id matches item id AND not a distractor
    if (!img.isDistractor && img.id === slotId) {
      const next = { ...placements, [slotId]: img.id };
      setPlacements(next);
      const allDone = items.every(item => next[item.id]);
      if (allDone) {
        setDone(true);
        setTimeout(() => onCorrectRef.current(null, null), 400);
      }
    } else {
      // Wrong drop
      setErrorSlot(slotId);
      if (onMistake) onMistake(slotId, img.id);
      setTimeout(() => setErrorSlot(null), 600);
    }
  }

  return (
    <div
      className="pm-root"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Left: phrase slots */}
      <div className="pm-phrases">
        {items.map(item => {
          const matchedImgId = placements[item.id];
          const matchedImg   = matchedImgId ? images.find(i => i.id === matchedImgId) : null;
          const isHover      = hoverSlot === item.id;
          const isError      = errorSlot === item.id;
          const isMatched    = !!matchedImgId;
          let slotClass = "pm-slot";
          if (isMatched) slotClass += " pm-slot--matched";
          else if (isError) slotClass += " pm-slot--error";
          else if (isHover) slotClass += " pm-slot--hover";
          return (
            <div
              key={item.id}
              ref={el => { slotRefs.current[item.id] = el; }}
              className={slotClass}
            >
              {matchedImg
                ? <SlotImage topicId={topicId} image={matchedImg.image} />
                : <div className="pm-slot__img--placeholder" />
              }
              <span className="pm-slot__phrase">{item.phrase}</span>
            </div>
          );
        })}
      </div>

      {/* Right: image pool */}
      <div className="pm-pool">
        {poolImages.map(img => (
          <div
            key={img.id}
            onPointerDown={e => handlePointerDown(e, img)}
          >
            <PoolImage
              topicId={topicId}
              img={img}
              isDragging={dragging?.img.id === img.id}
            />
          </div>
        ))}
      </div>

      {/* Ghost: floating image during drag */}
      {dragging && (
        <img
          className="pm-ghost"
          src={undefined}
          alt=""
          draggable={false}
          style={{ left: dragging.x, top: dragging.y }}
        />
      )}
    </div>
  );
}
```

> **Note on ghost image:** The ghost `<img>` needs its own `useTopicFile` call. Extract a `GhostImage` component that receives `topicId` and `img` (the dragging img object) and renders with the resolved URL. Add this above `MatchTask`:

```jsx
function GhostImage({ topicId, img, x, y }) {
  const url = useTopicFile(topicId, img?.image);
  if (!url || !img) return null;
  return (
    <img
      className="pm-ghost"
      src={url}
      alt=""
      draggable={false}
      style={{ left: x, top: y }}
    />
  );
}
```

And replace the ghost block in the render with:
```jsx
{dragging && (
  <GhostImage topicId={topicId} img={dragging.img} x={dragging.x} y={dragging.y} />
)}
```

- [ ] **Step 5.2 — Create index.jsx**

```jsx
// src/topics/renderers/phrase_match/index.jsx
import MatchTask from "./MatchTask";

export default function PhraseMatchRenderer({ task, topicId, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "match":
      return (
        <MatchTask
          task={task}
          topicId={topicId}
          onCorrect={onCorrect}
          onMistake={onMistake}
        />
      );
    default:
      return null;
  }
}
```

- [ ] **Step 5.3 — Run vitest (no regressions)**

```
npx vitest run
```

Expected: all tests `PASS`

- [ ] **Step 5.4 — Commit**

```
git add src/topics/renderers/phrase_match/MatchTask.jsx src/topics/renderers/phrase_match/index.jsx
git commit -m "feat(phrase_match): MatchTask drag-and-drop UI + renderer entry point"
```

---

## Task 6 — Generate script (pilot ZIP)

**Files:**
- Create: `scripts/generate-phrase-match-pilot.mjs`

The script reads 25 images from Cardgen Studio and packs the pilot deck. Images must exist at the source path before running.

**Expected image files in** `C:/Users/dmazn/Projects/Mirocard/cardgen-studio/projects/phrase_match_pilot/generated/`:

| File | Subject | Prompt |
|------|---------|--------|
| `soup_pour.webp` | половник | `a ladle (soup ladle), isolated, plain white background, square 1:1, no text` |
| `soup_eat.webp` | ложка | `a soup spoon, isolated, plain white background, square 1:1, no text` |
| `soup_cook.webp` | кастрюля | `a cooking pot (saucepan with lid), isolated, plain white background, square 1:1, no text` |
| `soup_d_fork.webp` | вилка (дистрактор) | `a fork, isolated, plain white background, square 1:1, no text` |
| `soup_d_plate.webp` | тарелка (дистрактор) | `a dinner plate, isolated, plain white background, square 1:1, no text` |
| `cut_bread.webp` | нож | `a kitchen knife, isolated, plain white background, square 1:1, no text` |
| `cut_paper.webp` | ножницы | `a pair of scissors, isolated, plain white background, square 1:1, no text` |
| `cut_nails.webp` | щипчики | `nail clippers, isolated, plain white background, square 1:1, no text` |
| `cut_d_pencil.webp` | карандаш (дистрактор) | `a pencil, isolated, plain white background, square 1:1, no text` |
| `cut_d_ruler.webp` | линейка (дистрактор) | `a ruler, isolated, plain white background, square 1:1, no text` |
| `trans_road.webp` | автобус | `a city bus, isolated, plain white background, square 1:1, no text` |
| `trans_sky.webp` | самолёт | `an airplane, isolated, plain light blue background, square 1:1, no text` |
| `trans_sea.webp` | корабль | `a cargo ship on calm water, square 1:1, no text` |
| `trans_d_bike.webp` | велосипед (дистрактор) | `a bicycle, isolated, plain white background, square 1:1, no text` |
| `trans_d_train.webp` | поезд (дистрактор) | `a passenger train, isolated, plain white background, square 1:1, no text` |
| `cloth_wash.webp` | стиральная машина | `a front-loading washing machine, isolated, plain white background, square 1:1, no text` |
| `cloth_iron.webp` | утюг | `a clothes steam iron, isolated, plain white background, square 1:1, no text` |
| `cloth_dry.webp` | верёвка с прищепками | `clothes hanging on a clothesline with wooden pegs, square 1:1, no text` |
| `cloth_d_wardrobe.webp` | шкаф (дистрактор) | `a wardrobe cabinet, isolated, plain white background, square 1:1, no text` |
| `cloth_d_hanger.webp` | вешалка (дистрактор) | `a clothes hanger, isolated, plain white background, square 1:1, no text` |
| `play_with.webp` | две девочки | `two girls playing together outdoors, smiling, square 1:1, no text` |
| `play_where.webp` | детская площадка | `a children's playground with swings and slide, square 1:1, no text` |
| `play_what.webp` | мяч | `a colorful soccer ball, isolated, plain white background, square 1:1, no text` |
| `play_d_doll.webp` | кукла (дистрактор) | `a doll toy, isolated, plain white background, square 1:1, no text` |
| `play_d_bike.webp` | велосипед детский (дистрактор) | `a children's bicycle, isolated, plain white background, square 1:1, no text` |

- [ ] **Step 6.1 — Create generate-phrase-match-pilot.mjs**

```js
// scripts/generate-phrase-match-pilot.mjs
import JSZip from "jszip";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const VERSION   = "1.0.0";
const SRC_DIR   = "C:/Users/dmazn/Projects/Mirocard/cardgen-studio/projects/phrase_match_pilot/generated";
const OUT_PATH  = join(ROOT, "public", "decks", `phrase_match_pilot_v${VERSION}.zip`);

const GROUPS = [
  {
    id: "soup",
    items: [
      { id: "soup_pour", phrase: "Чем наливают суп?", image: "media/soup_pour.webp", src: "soup_pour.webp" },
      { id: "soup_eat",  phrase: "Чем едят суп?",      image: "media/soup_eat.webp",  src: "soup_eat.webp"  },
      { id: "soup_cook", phrase: "В чём варят суп?",   image: "media/soup_cook.webp", src: "soup_cook.webp" },
    ],
    distractors: [
      { id: "soup_d_fork",  image: "media/soup_d_fork.webp",  src: "soup_d_fork.webp"  },
      { id: "soup_d_plate", image: "media/soup_d_plate.webp", src: "soup_d_plate.webp" },
    ],
  },
  {
    id: "cut",
    items: [
      { id: "cut_bread", phrase: "Чем режут хлеб?",   image: "media/cut_bread.webp", src: "cut_bread.webp" },
      { id: "cut_paper", phrase: "Чем режут бумагу?", image: "media/cut_paper.webp", src: "cut_paper.webp" },
      { id: "cut_nails", phrase: "Чем режут ногти?",  image: "media/cut_nails.webp", src: "cut_nails.webp" },
    ],
    distractors: [
      { id: "cut_d_pencil", image: "media/cut_d_pencil.webp", src: "cut_d_pencil.webp" },
      { id: "cut_d_ruler",  image: "media/cut_d_ruler.webp",  src: "cut_d_ruler.webp"  },
    ],
  },
  {
    id: "transport",
    items: [
      { id: "trans_road", phrase: "На чём едут по дороге?", image: "media/trans_road.webp", src: "trans_road.webp" },
      { id: "trans_sky",  phrase: "На чём летят по небу?",  image: "media/trans_sky.webp",  src: "trans_sky.webp"  },
      { id: "trans_sea",  phrase: "На чём плывут по морю?", image: "media/trans_sea.webp",  src: "trans_sea.webp"  },
    ],
    distractors: [
      { id: "trans_d_bike",  image: "media/trans_d_bike.webp",  src: "trans_d_bike.webp"  },
      { id: "trans_d_train", image: "media/trans_d_train.webp", src: "trans_d_train.webp" },
    ],
  },
  {
    id: "clothing",
    items: [
      { id: "cloth_wash", phrase: "Чем стирают одежду?", image: "media/cloth_wash.webp", src: "cloth_wash.webp" },
      { id: "cloth_iron", phrase: "Чем гладят одежду?",  image: "media/cloth_iron.webp", src: "cloth_iron.webp" },
      { id: "cloth_dry",  phrase: "Где сушат одежду?",   image: "media/cloth_dry.webp",  src: "cloth_dry.webp"  },
    ],
    distractors: [
      { id: "cloth_d_wardrobe", image: "media/cloth_d_wardrobe.webp", src: "cloth_d_wardrobe.webp" },
      { id: "cloth_d_hanger",   image: "media/cloth_d_hanger.webp",   src: "cloth_d_hanger.webp"   },
    ],
  },
  {
    id: "play",
    items: [
      { id: "play_with",  phrase: "С кем играет девочка?",  image: "media/play_with.webp",  src: "play_with.webp"  },
      { id: "play_where", phrase: "Где играет девочка?",    image: "media/play_where.webp", src: "play_where.webp" },
      { id: "play_what",  phrase: "Во что играет девочка?", image: "media/play_what.webp",  src: "play_what.webp"  },
    ],
    distractors: [
      { id: "play_d_doll", image: "media/play_d_doll.webp", src: "play_d_doll.webp" },
      { id: "play_d_bike", image: "media/play_d_bike.webp", src: "play_d_bike.webp" },
    ],
  },
];

async function main() {
  const zip = new JSZip();
  const missing = [];

  for (const group of GROUPS) {
    for (const entry of [...group.items, ...group.distractors]) {
      const srcPath = join(SRC_DIR, entry.src);
      if (existsSync(srcPath)) {
        zip.file(entry.image, readFileSync(srcPath));
      } else {
        missing.push(entry.src);
      }
    }
  }

  if (missing.length > 0) {
    console.warn("⚠️  Missing images (add placeholder or generate first):");
    missing.forEach(f => console.warn("   -", f));
  }

  const groupsForDeck = GROUPS.map(g => ({
    id: g.id,
    items:       g.items.map(({ id, phrase, image }) => ({ id, phrase, image })),
    distractors: g.distractors.map(({ id, image }) => ({ id, image })),
  }));

  const deckJson = {
    meta: {
      id:       "phrase_match_pilot",
      version:  VERSION,
      renderer: "phrase_match",
      title:    { ru: "Точное чтение" },
    },
    modes: [
      {
        id:         "match",
        type:       "match",
        evaluation: "auto",
        ui: {
          title:       "Соедини фразу с картинкой",
          instruction: "Перетащи картинку к нужной фразе",
        },
      },
    ],
    groups: groupsForDeck,
    cards: [],
  };

  zip.file("deck.json", JSON.stringify(deckJson, null, 2));

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  writeFileSync(OUT_PATH, buf);
  console.log(`✅  Written: ${OUT_PATH}`);
  console.log(`   Groups: ${GROUPS.length}, Images: ${GROUPS.length * 5} (${missing.length} missing)`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 6.2 — Run the script with placeholder images first**

Create a tiny test image placeholder to verify script structure:

```
node scripts/generate-phrase-match-pilot.mjs
```

Expected output (with missing images):
```
⚠️  Missing images (add placeholder or generate first):
   - soup_pour.webp
   ... (25 lines)
✅  Written: C:\Users\dmazn\Projects\Mirocard2\public\decks\phrase_match_pilot_v1.0.0.zip
   Groups: 5, Images: 25 (25 missing)
```

The ZIP is created (with no media, just deck.json) — this confirms the script runs without errors.

- [ ] **Step 6.3 — Commit**

```
git add scripts/generate-phrase-match-pilot.mjs
git commit -m "feat(phrase_match): add pilot generate script with 5 groups"
```

---

## Task 7 — Register React component + add to catalog

**Files:**
- Modify: `src/topics/registry.js`
- Modify: `public/decks/catalog.json`

React-компоненты рендереров хранятся в `src/topics/registry.js` (отдельно от `engineRegistry.js`). `SessionScreen` импортирует `RENDERER_REGISTRY` из этого файла и выбирает нужный компонент по `topicRecord.meta.renderer`.

- [ ] **Step 7.1 — Добавить PhraseMatchRenderer в registry.js**

Открыть `src/topics/registry.js`. Добавить импорт после последнего импорта:

```js
import PhraseMatchRenderer from "./renderers/phrase_match/index.jsx";
```

Добавить в `RENDERER_REGISTRY`:

```js
  phrase_match: PhraseMatchRenderer,
```

Итоговый файл должен выглядеть так:

```js
import FlashcardsRenderer          from "./renderers/flashcards/index.jsx";
import OppositeRenderer            from "./renderers/opposites/index.jsx";
import ComparisonRenderer          from "./renderers/comparison/index.jsx";
import MathHousesRenderer          from "./renderers/math_houses/index.jsx";
import AdditionSubtractionRenderer from "./renderers/addition_subtraction/index.jsx";
import ReadingRenderer             from "./renderers/reading/index.jsx";
import FunctionCardsRenderer       from "./renderers/function_cards/index.jsx";
import VowelConsonantRenderer      from "./renderers/vowel_consonant/index.jsx";
import NarrativeRenderer           from "./renderers/narrative/index.jsx";
import LetterWritingRenderer       from "./renderers/letter_writing/index.jsx";
import StreakTrackerRenderer        from "./renderers/streak_tracker/index.jsx";
import ShoppingRenderer             from "./renderers/shopping/index.jsx";
import PhraseMatchRenderer          from "./renderers/phrase_match/index.jsx";

export const RENDERER_REGISTRY = {
  flashcards:            FlashcardsRenderer,
  comparison:            ComparisonRenderer,
  math_houses:           MathHousesRenderer,
  addition_subtraction:  AdditionSubtractionRenderer,
  reading:               ReadingRenderer,
  function_cards:        FunctionCardsRenderer,
  vowel_consonant:       VowelConsonantRenderer,
  opposites:             OppositeRenderer,
  narrative:             NarrativeRenderer,
  letter_writing:        LetterWritingRenderer,
  streak_tracker:        StreakTrackerRenderer,
  shopping:              ShoppingRenderer,
  phrase_match:          PhraseMatchRenderer,
};
```

- [ ] **Step 7.2 — Добавить запись в catalog.json**

В `public/decks/catalog.json` добавить в массив `"decks"` (в конец, перед закрывающей `]`):

```json
{
  "id": "phrase_match_pilot",
  "version": "1.0.0",
  "title": {
    "ru": "Точное чтение"
  },
  "description": {
    "ru": "Пилот: 5 групп похожих фраз. Перетащи картинку к нужной фразе."
  },
  "url": "./decks/phrase_match_pilot_v1.0.0.zip"
}
```

- [ ] **Step 7.3 — Запустить тесты (проверка на регрессии)**

```
npx vitest run
```

Expected: все тесты `PASS`

- [ ] **Step 7.4 — Собрать приложение**

```
npm run build
```

Expected: сборка завершается без ошибок.

- [ ] **Step 7.5 — Запустить generate-скрипт и проверить ZIP**

```
node scripts/generate-phrase-match-pilot.mjs
```

Убедиться что `public/decks/phrase_match_pilot_v1.0.0.zip` создан.

- [ ] **Step 7.6 — Smoke test в приложении**

1. Открыть `http://localhost:8080` (или `npm run dev`)
2. Перейти в Темы → Каталог → найти «Точное чтение» → установить
3. Открыть тему → выбрать режим «Соедини фразу с картинкой»
4. Начать сессию → 3 фразы слева, 5 картинок справа (серые заглушки если нет изображений)
5. Перетащить картинку на фразу → зелёная рамка при совпадении, красная при ошибке
6. Заполнить все 3 пары → сессия переходит к следующей группе

- [ ] **Step 7.7 — Commit**

```
git add src/topics/registry.js public/decks/catalog.json
git commit -m "feat(phrase_match): register React renderer + add pilot to catalog"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Left column: 3 phrase drop-zones — implemented in MatchTask.jsx
- ✅ Right column: images pool (3 correct + 2 distractors) — in engine.js + MatchTask
- ✅ Drag-and-drop bidirectional (image→phrase primary) — pointer events in MatchTask
- ✅ Correct drop: green lock, image stays — `pm-slot--matched` + `placements` state
- ✅ Wrong drop: red flash, image returns — `pm-slot--error` timeout + image stays in pool
- ✅ Distractors never accepted — `img.isDistractor` check
- ✅ All 3 paired → advance — `onCorrect` after 400ms
- ✅ No intro mode — only `match` mode type
- ✅ 5 pilot groups — GROUPS constant in generate script
- ✅ topicLoader update — Task 2
- ✅ Session routing — Task 3
- ✅ React renderer registration — Task 7 Step 7.1 (`src/topics/registry.js`)
- ✅ Catalog entry — Task 7 Step 7.2 (`public/decks/catalog.json`)

**Placeholder scan:** None found — все шаги содержат конкретный код.

**Type consistency:**
- `img.id` matches `item.id` для корректных пар (engine устанавливает `id: item.id` для non-distractor images) ✅
- `placements` отображает `itemId → imageId` консистентно во всех setPlacements и matchedImageIds ✅
- `onCorrect(null, null)` соответствует сигнатуре в SortTask.jsx ✅
