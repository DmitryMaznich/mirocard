# "Повтори рисунок" (repeat_draw mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second mode, "Повтори рисунок" (copy instead of mirror), to the existing `symmetry_draw` topic, with its own 8 new figures, without the two modes' cards leaking into each other.

**Architecture:** A new per-card `taskKind: "mirror" | "repeat"` field scopes which cards each mode's task generator picks up. Two new dedicated generator functions are added to the shared `flashcards/engine.js` (the existing generic `"intro"` type is untouched — used by every other flashcards topic). `renderer.js`'s `GridTask` gets a `translatePaths` transform alongside the existing `mirrorPaths`, selected by `shape.taskKind`, plus a visually distinct solid-line/arrow divider for repeat mode.

**Tech Stack:** React (no JSX, `createElement`) IIFE renderer loaded dynamically from the topic ZIP; Vitest for the shared flashcards engine; plain Node scripts for one-off `topic.json` content migrations; `tools/symmetry_draw/build.mjs` for ZIP packaging.

## Global Constraints

- Version must be bumped simultaneously in `topic.json` meta.version, `catalog.json`, and the ZIP filename — never overwrite an existing versioned ZIP.
- `npm run deploy:prod` auto-bumps the app's own patch version; dirty-worktree deploys need `--allow-dirty`, only after explicit user confirmation.
- Universal correct/wrong colors: correct `#16a34a`/`#22c55e` (tint `#dcfce7`/`#d1fae5`/`#f0fdf4`), wrong `#ef4444` (tint `#fef2f2`). Already in use in `renderer.css` as `--sd-good`/`--sd-bad` — reuse, don't reinvent.
- No other flashcards topic may be affected: the existing `"intro"` mode type in `flashcards/engine.js` must remain byte-for-byte behaviorally unchanged.
- Vitest test discovery must be scoped with `--dir src` (stray duplicate-`src` directories elsewhere in the repo pollute discovery otherwise): `npx vitest run --dir src <file>`.
- Any throwaway browser-verification HTML/JS files must be deleted from the repo before the task's commit — they are scratch tools, not shippable content.

---

### Task 1: Add taskKind-aware task generators to the flashcards engine

**Files:**
- Modify: `src/topics/renderers/flashcards/engine.js`
- Modify: `src/topics/renderers/flashcards/engine.test.js`

**Interfaces:**
- Consumes: `deriveConcepts(cards)` → `{ conceptId, cards: [...], primary }[]` (existing, from `@/shared/utils/topicUtils`); `generateIntroTasks(concepts)` (existing, same file, produces `{ type: "intro", conceptId, card, label }[]`).
- Produces: `generateTasks("mirror_draw", concepts, allCards, params)` and `generateTasks("repeat_draw", concepts, allCards, params)`, both returning the same task shape as `generateIntroTasks` but with `type` set to `"mirror_draw"` / `"repeat_draw"` respectively, and pre-filtered to only the concepts whose cards carry the matching `taskKind`.

- [ ] **Step 1: Write the failing tests**

Add to `src/topics/renderers/flashcards/engine.test.js`, after the existing `describe("generateTasks — intro", ...)` block:

```js
describe("generateTasks — mirror_draw / repeat_draw", () => {
  const MIXED_CARDS = [
    { id: "m1", conceptId: "m1", primary: true, label: "Дом",   taskKind: "mirror", sourcePaths: [] },
    { id: "m2", conceptId: "m2", primary: true, label: "Лодка", taskKind: "mirror", sourcePaths: [] },
    { id: "r1", conceptId: "r1", primary: true, label: "Ракета", taskKind: "repeat", sourcePaths: [] },
  ];
  const MIXED_CONCEPTS = deriveConcepts(MIXED_CARDS);

  it("mirror_draw only includes taskKind:mirror cards", () => {
    const tasks = generateTasks("mirror_draw", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.type === "mirror_draw")).toBe(true);
    expect(tasks.every((t) => t.card.taskKind === "mirror")).toBe(true);
  });

  it("repeat_draw only includes taskKind:repeat cards", () => {
    const tasks = generateTasks("repeat_draw", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: "repeat_draw", conceptId: "r1" });
    expect(tasks[0].card.taskKind).toBe("repeat");
  });

  it("each generator still returns conceptId, card, and label", () => {
    const tasks = generateTasks("repeat_draw", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks[0]).toMatchObject({ conceptId: expect.any(String), card: expect.any(Object), label: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --dir src engine.test.js`
Expected: FAIL — `generateTasks("mirror_draw", ...)` and `generateTasks("repeat_draw", ...)` both currently hit the `default: return [];` branch, so lengths are `0` not `2`/`1`.

- [ ] **Step 3: Implement the two generators and wire them into the dispatch switch**

In `src/topics/renderers/flashcards/engine.js`, right after the existing `generateIntroTasks` function (currently lines 5–18):

```js
function filterByTaskKind(concepts, kind) {
  return concepts.filter((concept) => concept.cards.some((card) => card.taskKind === kind));
}

function generateMirrorDrawTasks(concepts) {
  return generateIntroTasks(filterByTaskKind(concepts, "mirror")).map((t) => ({ ...t, type: "mirror_draw" }));
}

function generateRepeatDrawTasks(concepts) {
  return generateIntroTasks(filterByTaskKind(concepts, "repeat")).map((t) => ({ ...t, type: "repeat_draw" }));
}
```

Then in the same file's `generateTasks` dispatch switch (currently around line 135-144), add two new cases right after `case "intro":`:

```js
export function generateTasks(modeType, concepts, allCards, params = {}) {
  switch (modeType) {
    case "intro":                  return generateIntroTasks(concepts);
    case "mirror_draw":            return generateMirrorDrawTasks(concepts);
    case "repeat_draw":            return generateRepeatDrawTasks(concepts);
    case "question_answer":        return generateIntroTasks(concepts).map((t) => ({ ...t, type: "question_answer" }));
    case "yes_no":                 return generateYesNoTasks(concepts, params);
    case "find_n":                 return generateFindNTasks(concepts, params);
    case "choose_word_by_picture": return generateChooseWordTasks(concepts, params);
    case "choose_all":             return generateChooseAllTasks(concepts, params);
    default:                       return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --dir src engine.test.js`
Expected: PASS (all tests in the file, including the 3 new ones and the pre-existing `intro`/`yes_no`/etc. ones unaffected by this change).

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/flashcards/engine.js src/topics/renderers/flashcards/engine.test.js
git commit -m "feat(flashcards): add taskKind-scoped mirror_draw/repeat_draw task generators"
```

---

### Task 2: Teach the symmetry_draw renderer to draw a translated (non-mirrored) copy

**Files:**
- Modify: `tools/symmetry_draw/renderer.js`
- Modify: `tools/symmetry_draw/renderer.css`

**Interfaces:**
- Consumes: `shape.taskKind` (new field on `task.card`, added to content in Task 3/4) — when absent or `"mirror"`, behaves exactly as today.
- Produces: no new exported interface — this is a leaf UI component; verified by direct browser mount, not imported by other tasks.

- [ ] **Step 1: Add `translatePaths` next to the existing `mirrorPaths`**

In `tools/symmetry_draw/renderer.js`, right after the existing `mirrorPaths` function:

```js
  function mirrorPaths(paths, axisCol) {
    return (paths ?? []).map((path) => path.map((point) => ({ col: 2 * axisCol - point.col, row: point.row })));
  }

  function translatePaths(paths, axisCol) {
    return (paths ?? []).map((path) => path.map((point) => ({ col: point.col + axisCol, row: point.row })));
  }
```

- [ ] **Step 2: Branch the target-path transform on `shape.taskKind` inside `GridTask`**

Find this line in `GridTask` (currently around line 90-91):

```js
    const sourcePaths = shape.sourcePaths ?? [];
    const targetPaths = useMemo(() => mirrorPaths(sourcePaths, axisCol), [sourcePaths, axisCol]);
```

Replace with:

```js
    const sourcePaths = shape.sourcePaths ?? [];
    const isRepeat = shape.taskKind === "repeat";
    const targetPaths = useMemo(
      () => (isRepeat ? translatePaths(sourcePaths, axisCol) : mirrorPaths(sourcePaths, axisCol)),
      [sourcePaths, axisCol, isRepeat],
    );
```

- [ ] **Step 3: Swap the mirror chip label for repeat mode**

Find (currently around line 177):

```js
        h("span", { className: "symmetry-draw__mirror-chip" }, "↔ зеркало"),
```

Replace with:

```js
        h("span", { className: `symmetry-draw__mirror-chip${isRepeat ? " symmetry-draw__mirror-chip--repeat" : ""}` }, isRepeat ? "→ повтори" : "↔ зеркало"),
```

- [ ] **Step 4: Swap the dashed mirror-line + chevrons for a solid line + arrow in repeat mode**

Find (currently around lines 195-197):

```js
          h("line", { className: "symmetry-draw__mirror-line", x1: axisCol, y1: 0.15, x2: axisCol, y2: rows - 0.15 }),
          h("path", { className: "symmetry-draw__mirror-chevron", d: `M ${axisCol - 0.22} 0.55 L ${axisCol} 0.1 L ${axisCol + 0.22} 0.55 Z` }),
          h("path", { className: "symmetry-draw__mirror-chevron", d: `M ${axisCol - 0.22} ${rows - 0.55} L ${axisCol} ${rows - 0.1} L ${axisCol + 0.22} ${rows - 0.55} Z` }),
```

Replace with:

```js
          h("line", { className: `symmetry-draw__mirror-line${isRepeat ? " symmetry-draw__mirror-line--repeat" : ""}`, x1: axisCol, y1: 0.15, x2: axisCol, y2: rows - 0.15 }),
          isRepeat
            ? h("path", { className: "symmetry-draw__repeat-arrow", d: `M ${axisCol - 0.28} ${rows / 2 - 0.32} L ${axisCol + 0.22} ${rows / 2 - 0.32} L ${axisCol + 0.22} ${rows / 2 - 0.6} L ${axisCol + 0.62} ${rows / 2} L ${axisCol + 0.22} ${rows / 2 + 0.6} L ${axisCol + 0.22} ${rows / 2 + 0.32} L ${axisCol - 0.28} ${rows / 2 + 0.32} Z` })
            : [
                h("path", { key: "chev-top", className: "symmetry-draw__mirror-chevron", d: `M ${axisCol - 0.22} 0.55 L ${axisCol} 0.1 L ${axisCol + 0.22} 0.55 Z` }),
                h("path", { key: "chev-bottom", className: "symmetry-draw__mirror-chevron", d: `M ${axisCol - 0.22} ${rows - 0.55} L ${axisCol} ${rows - 0.1} L ${axisCol + 0.22} ${rows - 0.55} Z` }),
              ],
```

- [ ] **Step 5: Add the repeat-mode CSS variables and classes**

In `tools/symmetry_draw/renderer.css`, in the `.symmetry-draw` custom-property block, right after `--sd-mirror: #e8664f;`:

```css
  --sd-repeat: #0d9488;
```

Right after the existing `.symmetry-draw__mirror-chip { ... }` rule block:

```css
.symmetry-draw__mirror-chip--repeat { color: var(--sd-repeat); background: rgba(13, 148, 136, 0.1); border-color: rgba(13, 148, 136, 0.22); }
```

Find the existing rule:

```css
.symmetry-draw__mirror-line { stroke: var(--sd-mirror); stroke-width: 0.05; stroke-dasharray: 0.05 0.13; stroke-linecap: round; pointer-events: none; }
.symmetry-draw__mirror-chevron { fill: var(--sd-mirror); pointer-events: none; }
```

Replace with:

```css
.symmetry-draw__mirror-line { stroke: var(--sd-mirror); stroke-width: 0.05; stroke-dasharray: 0.05 0.13; stroke-linecap: round; pointer-events: none; }
.symmetry-draw__mirror-line--repeat { stroke: var(--sd-repeat); stroke-dasharray: none; }
.symmetry-draw__mirror-chevron { fill: var(--sd-mirror); pointer-events: none; }
.symmetry-draw__repeat-arrow { fill: var(--sd-repeat); pointer-events: none; }
```

- [ ] **Step 6: Write a temporary browser verification harness**

Create `tools/symmetry_draw/_verify-repeat.html` (temporary — deleted in Step 8):

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<link rel="stylesheet" href="renderer.css">
</head>
<body>
<div id="root"></div>
<script>window.__Mirocard = { React: React };</script>
<script src="renderer.js"></script>
<script>
(async () => {
  const shape = {
    id: "repeat_house", conceptId: "repeat_house", label: "Дом",
    columns: 10, rows: 8, axisCol: 5, taskKind: "repeat",
    sourcePaths: [[{col:5,row:1},{col:3,row:3},{col:3,row:7},{col:5,row:7}]],
  };
  let correctCalls = [];
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(window.__MirocardRenderer, {
    task: { conceptId: shape.conceptId, card: shape },
    mode: { ui: { instruction: "Повтори рисунок целиком справа" } },
    onCorrect: (c, k) => correctCalls.push([c, k]),
  }));
  await new Promise(r => setTimeout(r, 100));

  const svg = document.querySelector('.symmetry-draw__grid');
  svg.setPointerCapture = () => {}; svg.releasePointerCapture = () => {}; svg.hasPointerCapture = () => false;
  function toClient(col, row) {
    const pt = svg.createSVGPoint(); pt.x = col; pt.y = row;
    const c = pt.matrixTransform(svg.getScreenCTM()); return { x: c.x, y: c.y };
  }
  function dispatch(type, x, y, id) {
    const ev = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, clientX: 0, clientY: 0 });
    Object.defineProperty(ev, 'clientX', { value: x, configurable: true });
    Object.defineProperty(ev, 'clientY', { value: y, configurable: true });
    svg.dispatchEvent(ev);
  }

  // The translated (not mirrored) target for source [(5,1),(3,3),(3,7),(5,7)]
  // with axisCol=5 should be [(10,1),(8,3),(8,7),(10,7)] - trace exactly that.
  const pts = [{col:10,row:1},{col:8,row:3},{col:8,row:7},{col:10,row:7}];
  const first = toClient(pts[0].col, pts[0].row);
  dispatch('pointerdown', first.x, first.y, 1);
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i-1], cur = pts[i];
    for (let s = 1; s <= 12; s++) {
      const t = s / 12;
      const c = { col: prev.col + (cur.col - prev.col) * t, row: prev.row + (cur.row - prev.row) * t };
      const p = toClient(c.col, c.row);
      dispatch('pointermove', p.x, p.y, 1);
    }
  }
  const last = toClient(pts.at(-1).col, pts.at(-1).row);
  dispatch('pointerup', last.x, last.y, 1);
  await new Promise(r => setTimeout(r, 60));

  document.querySelector('button.symmetry-draw__button--primary').click();
  await new Promise(r => setTimeout(r, 60));
  const result = document.querySelector('.symmetry-draw__result');
  const chip = document.querySelector('.symmetry-draw__mirror-chip');
  document.title = JSON.stringify({
    resultText: result?.textContent,
    resultClass: result?.className,
    correctCalls,
    chipText: chip?.textContent,
    chipHasRepeatClass: chip?.className.includes('--repeat'),
    lineHasRepeatClass: document.querySelector('.symmetry-draw__mirror-line')?.className.baseVal.includes('--repeat'),
  });
})();
</script>
</body>
</html>
```

- [ ] **Step 7: Run the harness and verify via the page title**

Open `tools/symmetry_draw/_verify-repeat.html` in the Browser pane tool, wait for the script to finish, then read the page title (the script writes its result JSON there for easy inspection):

Expected `document.title` (parsed as JSON):
```json
{
  "resultText": "100%Совпало! Отличная работа.",
  "resultClass": "symmetry-draw__result symmetry-draw__result--good",
  "correctCalls": [["repeat_house", "repeat_house"]],
  "chipText": "→ повтори",
  "chipHasRepeatClass": true,
  "lineHasRepeatClass": true
}
```

If `correctCalls` is empty or `resultText` isn't `100%...`, the translate math or the coverage evaluation against it is wrong — re-check Step 1/2 before continuing.

- [ ] **Step 8: Delete the temporary harness**

```bash
rm tools/symmetry_draw/_verify-repeat.html
```

- [ ] **Step 9: Commit**

```bash
git add tools/symmetry_draw/renderer.js tools/symmetry_draw/renderer.css
git commit -m "feat(symmetry_draw): support taskKind:repeat (translate, not mirror) in GridTask"
```

---

### Task 3: Tag all 23 existing cards with taskKind:mirror and rename the mirror mode's type

**Files:**
- Modify: `tools/symmetry_draw/topic.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: every existing card object gains `"taskKind": "mirror"`; the existing mode object's `"type"` changes from `"intro"` to `"mirror_draw"` (its `"id"` stays `"symmetry_draw"` — unrelated to the rename, and other code keys off `id`, not `type`, wherever it matters, per Task 1/2's design).

- [ ] **Step 1: Run a one-off Node migration to add taskKind to every existing card**

```bash
node -e '
const fs = require("fs");
const path = "tools/symmetry_draw/topic.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));
for (const card of data.cards) card.taskKind = "mirror";
fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
'
```

- [ ] **Step 2: Verify all 23 cards got the field, and nothing else changed**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const missing = data.cards.filter((c) => c.taskKind !== "mirror");
console.log("cards:", data.cards.length, "missing taskKind:", missing.length);
'
```

Expected: `cards: 23 missing taskKind: 0`

- [ ] **Step 3: Rename the existing mode's type from "intro" to "mirror_draw"**

In `tools/symmetry_draw/topic.json`, find the existing mode entry:

```json
    {
      "id": "symmetry_draw",
      "type": "intro",
      "evaluation": "auto",
      "ui": {
        "title": "Симметричный рисунок",
        "instruction": "Дорисуй вторую половину фигуры",
        "icon": "media/avatar.svg"
      }
    }
```

Change `"type": "intro"` to `"type": "mirror_draw"` (everything else in this object stays the same).

- [ ] **Step 4: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): tag existing cards taskKind:mirror, rename mode type to mirror_draw"
```

---

### Task 4: Add the 8 new repeat_draw cards and the repeat_draw mode entry

**Files:**
- Modify: `tools/symmetry_draw/topic.json`

**Interfaces:**
- Consumes: `taskKind` field convention from Task 3.
- Produces: 8 new card objects (`taskKind: "repeat"`) and one new mode object (`id: "repeat_draw"`, `type: "repeat_draw"`) that Task 1's `generateRepeatDrawTasks` and Task 2's `GridTask` both consume.

Geometry for all 8 figures below was authored and visually verified (headless-Chrome screenshot of a live mount, reviewed for recognizability) during planning — every figure read clearly except an initial bridge attempt, which was redesigned into the arch-with-railings version below.

- [ ] **Step 1: Append the new mode entry to `modes`**

In `tools/symmetry_draw/topic.json`, add this object to the `modes` array, after the existing `mirror_draw` mode:

```json
    {
      "id": "repeat_draw",
      "type": "repeat_draw",
      "evaluation": "auto",
      "ui": {
        "title": "Повтори рисунок",
        "instruction": "Повтори рисунок целиком справа",
        "icon": "media/avatar.svg"
      }
    }
```

- [ ] **Step 2: Append the 8 new cards to `cards`**

Add these 8 objects to the end of the `cards` array in `tools/symmetry_draw/topic.json`:

```json
    {
      "id": "repeat_rocket",
      "conceptId": "repeat_rocket",
      "primary": true,
      "label": "Ракета",
      "taskKind": "repeat",
      "columns": 18,
      "rows": 14,
      "axisCol": 9,
      "sourcePaths": [
        [{"col":4,"row":0},{"col":6,"row":3},{"col":6,"row":10},{"col":2,"row":10},{"col":2,"row":3},{"col":4,"row":0}],
        [{"col":2,"row":10},{"col":0,"row":13},{"col":2,"row":13}],
        [{"col":6,"row":10},{"col":8,"row":13},{"col":6,"row":13}],
        [{"col":3,"row":4},{"col":4,"row":3},{"col":5,"row":4},{"col":4,"row":5},{"col":3,"row":4}]
      ]
    },
    {
      "id": "repeat_robot",
      "conceptId": "repeat_robot",
      "primary": true,
      "label": "Робот",
      "taskKind": "repeat",
      "columns": 18,
      "rows": 14,
      "axisCol": 9,
      "sourcePaths": [
        [{"col":2,"row":1},{"col":6,"row":1},{"col":6,"row":4},{"col":2,"row":4},{"col":2,"row":1}],
        [{"col":4,"row":1},{"col":4,"row":0}],
        [{"col":1,"row":4},{"col":7,"row":4},{"col":7,"row":10},{"col":1,"row":10},{"col":1,"row":4}],
        [{"col":1,"row":5},{"col":0,"row":5},{"col":0,"row":8}],
        [{"col":7,"row":5},{"col":8,"row":5},{"col":8,"row":8}],
        [{"col":3,"row":10},{"col":3,"row":13},{"col":2,"row":13}],
        [{"col":5,"row":10},{"col":5,"row":13},{"col":6,"row":13}]
      ]
    },
    {
      "id": "repeat_train",
      "conceptId": "repeat_train",
      "primary": true,
      "label": "Поезд",
      "taskKind": "repeat",
      "columns": 20,
      "rows": 12,
      "axisCol": 10,
      "sourcePaths": [
        [{"col":1,"row":4},{"col":9,"row":4},{"col":9,"row":8},{"col":1,"row":8},{"col":1,"row":4}],
        [{"col":1,"row":1},{"col":5,"row":1},{"col":5,"row":4},{"col":1,"row":4},{"col":1,"row":1}],
        [{"col":3,"row":1},{"col":3,"row":0}],
        [{"col":2,"row":8},{"col":3,"row":9},{"col":2,"row":10},{"col":1,"row":9},{"col":2,"row":8}],
        [{"col":6,"row":8},{"col":7,"row":9},{"col":6,"row":10},{"col":5,"row":9},{"col":6,"row":8}],
        [{"col":2,"row":2},{"col":4,"row":2},{"col":4,"row":3},{"col":2,"row":3},{"col":2,"row":2}]
      ]
    },
    {
      "id": "repeat_crane",
      "conceptId": "repeat_crane",
      "primary": true,
      "label": "Кран",
      "taskKind": "repeat",
      "columns": 18,
      "rows": 16,
      "axisCol": 9,
      "sourcePaths": [
        [{"col":1,"row":15},{"col":1,"row":2}],
        [{"col":0,"row":15},{"col":3,"row":15}],
        [{"col":1,"row":2},{"col":8,"row":2}],
        [{"col":1,"row":3},{"col":0,"row":3},{"col":0,"row":2}],
        [{"col":7,"row":2},{"col":7,"row":6}],
        [{"col":6,"row":6},{"col":7,"row":7},{"col":8,"row":6}],
        [{"col":1,"row":10},{"col":3,"row":15}]
      ]
    },
    {
      "id": "repeat_gear",
      "conceptId": "repeat_gear",
      "primary": true,
      "label": "Шестерёнка",
      "taskKind": "repeat",
      "columns": 24,
      "rows": 13,
      "axisCol": 12,
      "sourcePaths": [
        [{"col":4,"row":2},{"col":8,"row":2},{"col":10,"row":4},{"col":10,"row":8},{"col":8,"row":10},{"col":4,"row":10},{"col":2,"row":8},{"col":2,"row":4},{"col":4,"row":2}],
        [{"col":4,"row":2},{"col":4,"row":0},{"col":8,"row":0},{"col":8,"row":2}],
        [{"col":4,"row":10},{"col":4,"row":12},{"col":8,"row":12},{"col":8,"row":10}],
        [{"col":2,"row":4},{"col":0,"row":4},{"col":0,"row":8},{"col":2,"row":8}],
        [{"col":10,"row":4},{"col":12,"row":4},{"col":12,"row":8},{"col":10,"row":8}],
        [{"col":6,"row":5},{"col":7,"row":6},{"col":6,"row":7},{"col":5,"row":6},{"col":6,"row":5}]
      ]
    },
    {
      "id": "repeat_bridge",
      "conceptId": "repeat_bridge",
      "primary": true,
      "label": "Мост",
      "taskKind": "repeat",
      "columns": 20,
      "rows": 9,
      "axisCol": 10,
      "sourcePaths": [
        [{"col":0,"row":5},{"col":9,"row":5}],
        [{"col":1,"row":5},{"col":2,"row":7},{"col":5,"row":8},{"col":8,"row":7},{"col":9,"row":5}],
        [{"col":2,"row":5},{"col":2,"row":4}],
        [{"col":4,"row":5},{"col":4,"row":4}],
        [{"col":6,"row":5},{"col":6,"row":4}],
        [{"col":8,"row":5},{"col":8,"row":4}]
      ]
    },
    {
      "id": "repeat_skyscraper",
      "conceptId": "repeat_skyscraper",
      "primary": true,
      "label": "Небоскрёб",
      "taskKind": "repeat",
      "columns": 16,
      "rows": 16,
      "axisCol": 8,
      "sourcePaths": [
        [{"col":1,"row":2},{"col":7,"row":2},{"col":7,"row":15},{"col":1,"row":15},{"col":1,"row":2}],
        [{"col":4,"row":2},{"col":4,"row":0}],
        [{"col":2,"row":4},{"col":3,"row":4},{"col":3,"row":5},{"col":2,"row":5},{"col":2,"row":4}],
        [{"col":5,"row":4},{"col":6,"row":4},{"col":6,"row":5},{"col":5,"row":5},{"col":5,"row":4}],
        [{"col":2,"row":7},{"col":3,"row":7},{"col":3,"row":8},{"col":2,"row":8},{"col":2,"row":7}],
        [{"col":5,"row":7},{"col":6,"row":7},{"col":6,"row":8},{"col":5,"row":8},{"col":5,"row":7}],
        [{"col":2,"row":10},{"col":3,"row":10},{"col":3,"row":11},{"col":2,"row":11},{"col":2,"row":10}],
        [{"col":5,"row":10},{"col":6,"row":10},{"col":6,"row":11},{"col":5,"row":11},{"col":5,"row":10}]
      ]
    },
    {
      "id": "repeat_star",
      "conceptId": "repeat_star",
      "primary": true,
      "label": "Звезда",
      "taskKind": "repeat",
      "columns": 18,
      "rows": 9,
      "axisCol": 9,
      "sourcePaths": [
        [{"col":4,"row":0},{"col":5,"row":3},{"col":8,"row":3},{"col":6,"row":5},{"col":7,"row":8},{"col":4,"row":6},{"col":1,"row":8},{"col":2,"row":5},{"col":0,"row":3},{"col":3,"row":3},{"col":4,"row":0}]
      ]
    }
```

(Note: the train's window card in this final version uses `{"col":2,"row":2}` instead of the `row:1.5` used during the throwaway visual-review mockup — snapped to the grid for consistency with every other vertex in the topic; recheck it still sits visibly inside the cab silhouette, which spans row 1–4, before moving on.)

- [ ] **Step 3: Bump the topic version**

In `tools/symmetry_draw/topic.json`, change:

```json
    "version": "1.0.9",
```

to:

```json
    "version": "1.1.0",
```

(minor bump — new mode, not a patch, per the project's versioning rule.)

- [ ] **Step 4: Verify the JSON is well-formed and the new content is wired correctly**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const repeatCards = data.cards.filter((c) => c.taskKind === "repeat");
const mirrorCards = data.cards.filter((c) => c.taskKind === "mirror");
console.log("total cards:", data.cards.length, "repeat:", repeatCards.length, "mirror:", mirrorCards.length);
console.log("modes:", data.modes.map((m) => `${m.id}:${m.type}`));
console.log("version:", data.meta.version);
'
```

Expected:
```
total cards: 31 repeat: 8 mirror: 23
modes: [ 'symmetry_draw:mirror_draw', 'repeat_draw:repeat_draw' ]
version: 1.1.0
```

- [ ] **Step 5: Live-render all 8 new figures once more in their final, in-topic form and screenshot for a final visual check**

Reuse the same throwaway-mockup technique from planning (a temporary HTML file in `tools/symmetry_draw/` that loads the real `renderer.js`/`renderer.css` and mounts each of the 8 cards from the now-final `topic.json`), screenshot via headless Chrome, confirm all 8 still read clearly, then delete the temporary file. This re-check matters because Step 2 snapped the train's window row to an integer, which is a real (if small) geometry change from what was screenshotted during planning.

- [ ] **Step 6: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): add 8 new repeat_draw figures and the repeat_draw mode"
```

---

### Task 5: Rebuild the ZIP, bump the catalog, and deploy

**Files:**
- Modify: `public/decks/catalog.json`
- Create: `public/decks/symmetry_draw_v1.1.0.zip` (via `tools/symmetry_draw/build.mjs`, then copied)
- Modify: `tools/symmetry_draw/symmetry_draw.zip` (build artifact, tracked in git per project convention)

**Interfaces:**
- Consumes: the finished `tools/symmetry_draw/topic.json` (v1.1.0) and `renderer.js`/`renderer.css` from Tasks 2–4.
- Produces: a deployed, publicly-servable topic update.

- [ ] **Step 1: Rebuild the ZIP**

```bash
node tools/symmetry_draw/build.mjs
```

Expected output: `Built .../tools/symmetry_draw/symmetry_draw.zip`

- [ ] **Step 2: Copy to the versioned public deck filename**

```bash
cp tools/symmetry_draw/symmetry_draw.zip public/decks/symmetry_draw_v1.1.0.zip
```

- [ ] **Step 3: Update `public/decks/catalog.json`**

Find the `symmetry_draw` entry:

```json
      "id": "symmetry_draw",
      "version": "1.0.9",
      "url": "./decks/symmetry_draw_v1.0.9.zip",
      "zipUrl": "symmetry_draw_v1.0.9.zip",
```

Replace with:

```json
      "id": "symmetry_draw",
      "version": "1.1.0",
      "url": "./decks/symmetry_draw_v1.1.0.zip",
      "zipUrl": "symmetry_draw_v1.1.0.zip",
```

- [ ] **Step 4: Commit**

```bash
git add tools/symmetry_draw/symmetry_draw.zip public/decks/symmetry_draw_v1.1.0.zip public/decks/catalog.json
git commit -m "content(symmetry_draw): rebuild deck v1.1.0 with the new repeat_draw mode"
```

- [ ] **Step 5: Deploy**

```bash
git status --short
```

Confirm the only uncommitted changes are ones unrelated to this feature (there is a known pre-existing unrelated dirty state from `column_addition` in this worktree — do not touch it, do not commit it). If clean apart from that, ask the user to confirm before running:

```bash
npm run deploy:prod -- --allow-dirty
```

Then verify:

```bash
npm run deploy:verify
```

Both the public and LAN URLs must report the new app version.

---

### Task 6: End-to-end verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full relevant vitest suite**

```bash
npx vitest run --dir src engine.test.js topicLoader.test.js
```

Expected: all pass except the already-known pre-existing unrelated `addition_subtraction` mode-order failure (confirmed pre-existing via `git stash`/`git stash pop` earlier in this project's history — do not attempt to fix it as part of this feature).

- [ ] **Step 2: Live browser check — mode separation**

Using a temporary harness (same pattern as Task 2 Step 6, deleted after use): install/mount the real topic content (or a fixture built from the actual `topic.json`), call `generateTasks("mirror_draw", ...)` and `generateTasks("repeat_draw", ...)` against the full 31-card concept list, and confirm:
- `mirror_draw` produces exactly 23 tasks, all with `card.taskKind === "mirror"`.
- `repeat_draw` produces exactly 8 tasks, all with `card.taskKind === "repeat"`.

- [ ] **Step 3: Live browser check — repeat mode drawing + hint + star behavior**

Using the same temporary-harness technique used throughout this topic's development: mount one `repeat_draw` card (e.g. `repeat_star`, the simplest — single path) and confirm, in order:
1. A correct continuous drag along the translated target reads `100%` / green and fires `onCorrect` once.
2. Clearing, then turning on the hint before drawing, then a correct trace: reads `100%` / green, but `onCorrect` is never called and `onAdvance` fires once after the delay (hint-disqualifies-star, reused unchanged from mirror mode — must still hold true for repeat mode's translate-based targets).
3. The Undo button is absent; only Очистить / ✦ Подсказка / Готово are present.

- [ ] **Step 4: Screenshot the finished repeat_draw mode in the mode picker**

Confirm both "Симметричный рисунок" and "Повтори рисунок" appear as separate selectable modes for the `symmetry_draw` topic (not merged, not showing any of the generic template modes removed earlier in this project's history).

- [ ] **Step 5: Report results to the user**

Summarize pass/fail for each check above. If everything passes, the feature is complete — no further commit needed for this task (verification-only).
