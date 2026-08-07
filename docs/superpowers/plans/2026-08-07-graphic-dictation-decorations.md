# Graphic Dictation Decorations + 7 New Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `decorations` field to the `graphic_dictation` mode's card schema (static eye dots / window rects that render from the start, separate from the single traced line), and use it plus the existing `trace-grid-figure` skill to add 7 new dictation cards (pig, dinosaur, airplane, helicopter, car, horned dino, stegosaurus) to the `symmetry_draw` topic.

**Architecture:** `DictationTask` in `tools/symmetry_draw/renderer.js` currently renders exactly one continuous polyline built by walking `start` through `commands`. A new optional `shape.decorations` array (`{type:"dot"|"rect", col, row, width?, height?}`) is rendered as static SVG elements alongside it, untouched by the drawing/coverage logic. Each new card's `start`/`commands`/`decorations` geometry is produced with the project's existing `trace-grid-figure` skill (Mode A: printed command table) and confirmed with `tools/symmetry_draw/verify_trace.mjs` before it's written into `topic.json` — no trace ships on eyeballing alone.

**Tech Stack:** Plain IIFE React renderer (`createElement`, no JSX) loaded from the topic ZIP; Node's built-in `node:test` for `verify_trace.mjs`'s pure helpers; `sharp`-based Node script for pixel-overlay verification; `tools/symmetry_draw/build.mjs` for ZIP packaging.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-graphic-dictation-decorations-design.md` — read it if anything below is ambiguous.
- Never ship a hand-counted trace without rendering it back over the source image via `verify_trace.mjs overlay` and visually confirming the match — this is the rule that exists specifically because `dictation_dog`/`dictation_mouse` shipped wrong once from eyeballing.
- `decorations` is additive only: none of the 16 existing `taskKind: "dictation"` cards in `tools/symmetry_draw/topic.json` may be modified, and a card with no `decorations` field must render byte-for-byte identical to today.
- Decoration ink color must reuse the existing "already drawn" tone `#294e9a` (same as `.dictation__fixed`) — don't invent a new color for this.
- Do not touch `mirror_draw`/`repeat_draw` cards, `GridTask`, `mirrorPaths`, or `translatePaths` — this feature is scoped to `taskKind: "dictation"` only.
- `topic.json` meta.version, the ZIP filename, and `public/decks/catalog.json`'s entry for `symmetry_draw` must be bumped together, minor version (`1.4.0` → `1.5.0`) — new schema capability plus 7 new figures, not a trivial patch. Never overwrite an existing versioned ZIP filename.
- Scratch trace files under `tools/symmetry_draw/.trace-scratch/` are gitignored — fine to leave them.
- Deploy only after explicit user confirmation; dirty-worktree deploys need `--allow-dirty`, only after the user has explicitly said to proceed with a dirty tree.

---

### Task 1: Render `decorations` in `DictationTask`

**Files:**
- Modify: `tools/symmetry_draw/renderer.js`
- Modify: `tools/symmetry_draw/renderer.css`

**Interfaces:**
- Consumes: `shape.decorations` — optional array on `task.card`, each entry `{ type: "dot", col, row }` or `{ type: "rect", col, row, width?, height? }` (grid-vertex coordinates, same space as `start`/`commands` endpoints). Added to actual card content starting in Task 2.
- Produces: no new exported interface — this is a leaf UI branch, verified by direct browser mount like every other change to this renderer.

- [ ] **Step 1: Add the decorations element builder inside `DictationTask`**

In `tools/symmetry_draw/renderer.js`, find the end of the grid-building loops (currently right before the `previewEnd` computation):

```js
    for (let row = 0; row <= rows; row += 1) {
      grid.push(h("line", { key: `h-${row}`, className: "dictation__grid-line", x1: 0, y1: row, x2: columns, y2: row }));
      coordinates.push(h("text", { key: `row-${row}`, className: "dictation__coordinate", x: "-0.33", y: row + 0.08, textAnchor: "middle" }, row + 1));
    }

    const previewEnd = preview?.at(-1)
```

Insert a `decorations` array build between those two blocks:

```js
    for (let row = 0; row <= rows; row += 1) {
      grid.push(h("line", { key: `h-${row}`, className: "dictation__grid-line", x1: 0, y1: row, x2: columns, y2: row }));
      coordinates.push(h("text", { key: `row-${row}`, className: "dictation__coordinate", x: "-0.33", y: row + 0.08, textAnchor: "middle" }, row + 1));
    }

    const decorations = (shape.decorations ?? []).map((decoration, index) =>
      decoration.type === "rect"
        ? h("rect", { key: `deco-${index}`, className: "dictation__decoration-rect", x: decoration.col, y: decoration.row, width: decoration.width ?? 1, height: decoration.height ?? 1 })
        : h("circle", { key: `deco-${index}`, className: "dictation__decoration-dot", cx: decoration.col, cy: decoration.row, r: "0.12" })
    );

    const previewEnd = preview?.at(-1)
```

- [ ] **Step 2: Render `decorations` into the SVG, right after the reference `dots`**

Find (currently the `dots,` line inside the `svg` children):

```js
          grid,
          coordinates,
          dots,
          completed.map((line, index) => h("line", { key: `fixed-${index}`, className: "dictation__fixed", x1: line.start.col, y1: line.start.row, x2: commandEnd(line.start, line.command).col, y2: commandEnd(line.start, line.command).row })),
```

Replace with:

```js
          grid,
          coordinates,
          dots,
          decorations,
          completed.map((line, index) => h("line", { key: `fixed-${index}`, className: "dictation__fixed", x1: line.start.col, y1: line.start.row, x2: commandEnd(line.start, line.command).col, y2: commandEnd(line.start, line.command).row })),
```

- [ ] **Step 3: Add the two decoration CSS classes**

In `tools/symmetry_draw/renderer.css`, find:

```css
.dictation__fixed { stroke: #294e9a; stroke-width: .1; }
```

Replace with:

```css
.dictation__fixed { stroke: #294e9a; stroke-width: .1; }
.dictation__decoration-dot { fill: #294e9a; pointer-events: none; }
.dictation__decoration-rect { fill: none; stroke: #294e9a; stroke-width: .07; pointer-events: none; }
```

- [ ] **Step 4: Write a temporary browser verification harness**

Create `tools/symmetry_draw/_verify-decorations.html` (temporary — deleted in Step 6):

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
    id: "dictation_deco_test", conceptId: "dictation_deco_test", label: "Тест",
    taskKind: "dictation", columns: 10, rows: 10,
    start: { col: 2, row: 2 },
    commands: [{ type: "move", direction: "right", cells: 3 }],
    decorations: [
      { type: "dot", col: 5, row: 5 },
      { type: "rect", col: 6, row: 6, width: 1, height: 1 },
    ],
  };
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(window.__MirocardRenderer, {
    task: { type: "graphic_dictation", conceptId: shape.conceptId, card: shape },
    onCorrect: () => {},
  }));
  await new Promise(r => setTimeout(r, 100));

  const dot = document.querySelector('.dictation__decoration-dot');
  const rect = document.querySelector('.dictation__decoration-rect');
  document.title = JSON.stringify({
    dotPresent: !!dot,
    dotCx: dot?.getAttribute('cx'),
    dotCy: dot?.getAttribute('cy'),
    rectPresent: !!rect,
    rectX: rect?.getAttribute('x'),
    rectY: rect?.getAttribute('y'),
    rectWidth: rect?.getAttribute('width'),
    rectHeight: rect?.getAttribute('height'),
    // no gesture has been performed yet - these must already be in the DOM
    presentBeforeAnyDrawing: !!dot && !!rect,
  });
})();
</script>
</body>
</html>
```

- [ ] **Step 5: Run the harness and verify via the page title**

Open `tools/symmetry_draw/_verify-decorations.html` in the Browser pane tool, wait for the script to finish, then read the page title (parsed as JSON):

Expected:
```json
{
  "dotPresent": true,
  "dotCx": "5",
  "dotCy": "5",
  "rectPresent": true,
  "rectX": "6",
  "rectY": "6",
  "rectWidth": "1",
  "rectHeight": "1",
  "presentBeforeAnyDrawing": true
}
```

If `dotPresent`/`rectPresent` are `false`, re-check Step 1/2 — the decoration builder or its placement in the `svg` children is wrong.

- [ ] **Step 6: Delete the temporary harness**

```bash
rm tools/symmetry_draw/_verify-decorations.html
```

- [ ] **Step 7: Confirm the 16 existing dictation cards are unaffected**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const dictationCards = data.cards.filter((c) => c.taskKind === "dictation");
const withDecorations = dictationCards.filter((c) => c.decorations);
console.log("dictation cards:", dictationCards.length, "with decorations:", withDecorations.length);
'
```

Expected: `dictation cards: 16 with decorations: 0` (none of the existing 16 have been touched yet — the 7 new ones land in later tasks).

- [ ] **Step 8: Commit**

```bash
git add tools/symmetry_draw/renderer.js tools/symmetry_draw/renderer.css
git commit -m "feat(symmetry_draw): render static decorations (eye dots, windows) in graphic_dictation cards"
```

---

### Task 2: Trace and add card — Свинья (`Pig.png`)

**Files:**
- Modify: `tools/symmetry_draw/topic.json`
- Create (scratch, gitignored): `tools/symmetry_draw/.trace-scratch/pig.json`

**Interfaces:**
- Consumes: `decorations` schema from Task 1.
- Produces: card `dictation_pig` in `topic.json`'s `cards` array, consumed only by the running app (no other task depends on its exact geometry).

- [ ] **Step 1: Transcribe the command table**

Read `GraphNarrative/Pig.png` with the Read tool. Transcribe the printed arrow+count table above the figure, left-to-right top-to-bottom, into an ordered `{direction, cells}` array. Map arrows literally: `→`=right, `←`=left, `↑`=up, `↓`=down, `↗`=up_right, `↘`=down_right, `↖`=up_left, `↙`=down_left. Do not interpret or "fix" the sequence — transcribe exactly what's printed.

- [ ] **Step 2: Locate the start point and the eye decoration**

In the same image, find the red dot (start marker, at the pig's snout) and count its `{col, row}` from the figure's own ruled grid lines (not the page edge). Separately locate the small black dot inside the head (the eye) and count its `{col, row}` the same way — this becomes the card's single `dot` decoration.

- [ ] **Step 3: Write the scratch file**

Write `tools/symmetry_draw/.trace-scratch/pig.json`:

```json
{ "start": { "col": <measured>, "row": <measured> }, "commands": [ /* transcribed in Step 1 */ ] }
```

- [ ] **Step 4: Measure pixel scale**

```bash
node tools/symmetry_draw/verify_trace.mjs ruler GraphNarrative/Pig.png --step=25 --out=tools/symmetry_draw/.trace-scratch/pig-ruler.png
```

Read `tools/symmetry_draw/.trace-scratch/pig-ruler.png` with the Read tool and find the pixel spacing between the drawn grid's own lines (cell size in px) and the pixel position of one grid intersection (origin). Use a smaller `--step` and re-run if the drawn cells are smaller than 25px.

- [ ] **Step 5: Render the overlay and compare**

```bash
node tools/symmetry_draw/verify_trace.mjs overlay GraphNarrative/Pig.png tools/symmetry_draw/.trace-scratch/pig.json --cell=<measured> --originX=<measured> --originY=<measured> --out=tools/symmetry_draw/.trace-scratch/pig-overlay.png
```

Read `tools/symmetry_draw/.trace-scratch/pig-overlay.png`. The red traced line and blue start-point circle must sit exactly on top of the source drawing's outline and red dot. If they don't align, re-check Steps 1–3 (most likely a table transcription slip or a miscounted start point) and re-render until they do.

- [ ] **Step 6: Manual re-check against the printed table**

Re-read the transcribed `commands` array against the printed table cell-by-cell once, independent of the overlay — catches a direction-token swap (e.g. `up_right` vs `down_right`) that could still look visually plausible on a near-symmetric segment.

- [ ] **Step 7: Determine `columns`/`rows`**

Walk `start` through the verified `commands` to get the path's bounding box (min/max col, min/max row). Set `columns`/`rows` to that bounding box plus 1–2 cells of margin on each side, matching the convention of the 16 existing dictation cards in `topic.json`.

- [ ] **Step 8: Append the card to `topic.json`**

Add this object to the end of the `cards` array in `tools/symmetry_draw/topic.json` (fill `<...>` from Steps 1–7's verified values):

```json
{
  "id": "dictation_pig",
  "conceptId": "dictation_pig",
  "primary": true,
  "label": "Свинья",
  "taskKind": "dictation",
  "columns": <measured>,
  "rows": <measured>,
  "start": { "col": <measured>, "row": <measured> },
  "commands": [ /* verified in Step 6 */ ],
  "decorations": [ { "type": "dot", "col": <measured>, "row": <measured> } ]
}
```

- [ ] **Step 9: Verify the JSON is well-formed and the id doesn't collide**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const ids = data.cards.map((c) => c.id);
console.log("total cards:", ids.length, "unique ids:", new Set(ids).size, "has dictation_pig:", ids.includes("dictation_pig"));
'
```

Expected: `unique ids` equals `total cards` (no collision), `has dictation_pig: true`.

- [ ] **Step 10: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): add dictation_pig card"
```

---

### Task 3: Trace and add card — Динозавр (`Trex.png`)

**Files:**
- Modify: `tools/symmetry_draw/topic.json`
- Create (scratch): `tools/symmetry_draw/.trace-scratch/trex.json`

**Interfaces:** same shape as Task 2, no `decorations`.

- [ ] **Step 1: Transcribe the command table**

Read `GraphNarrative/Trex.png`. Transcribe the printed table into an ordered `{direction, cells}` array, same arrow mapping as Task 2 Step 1. The grey squares visible over parts of the figure are Shutterstock watermark artifacts, not drawn content — ignore them entirely, they are not decorations and not part of the outline.

- [ ] **Step 2: Locate the start point**

Find the blue dot (front foot, left side of the figure) and count its `{col, row}` from the figure's own grid. There is no separate eye mark on this figure — no `decorations` field on this card.

- [ ] **Step 3: Write the scratch file, measure scale, render overlay, iterate**

Same procedure as Task 2 Steps 3–6, against `GraphNarrative/Trex.png` and `tools/symmetry_draw/.trace-scratch/trex.json` / `trex-ruler.png` / `trex-overlay.png`.

- [ ] **Step 4: Determine `columns`/`rows`**

Same procedure as Task 2 Step 7.

- [ ] **Step 5: Append the card to `topic.json`**

```json
{
  "id": "dictation_trex",
  "conceptId": "dictation_trex",
  "primary": true,
  "label": "Динозавр",
  "taskKind": "dictation",
  "columns": <measured>,
  "rows": <measured>,
  "start": { "col": <measured>, "row": <measured> },
  "commands": [ /* verified */ ]
}
```

- [ ] **Step 6: Verify id uniqueness**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const ids = data.cards.map((c) => c.id);
console.log("total cards:", ids.length, "unique ids:", new Set(ids).size, "has dictation_trex:", ids.includes("dictation_trex"));
'
```

Expected: `unique ids` equals `total cards`, `has dictation_trex: true`.

- [ ] **Step 7: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): add dictation_trex card"
```

---

### Task 4: Trace and add card — Самолёт (`Airplane.png`)

**Files:**
- Modify: `tools/symmetry_draw/topic.json`
- Create (scratch): `tools/symmetry_draw/.trace-scratch/airplane.json`

**Interfaces:** consumes the `rect` decoration type from Task 1.

- [ ] **Step 1: Transcribe the command table**

Read `GraphNarrative/Airplane.png`. Transcribe the printed table into an ordered `{direction, cells}` array, same arrow mapping as Task 2 Step 1.

- [ ] **Step 2: Locate the start point and the 4 window decorations**

Find the blue dot (nose, left side) and count its `{col, row}`. Separately, locate each of the 4 small squares along the fuselage (the windows) and count each one's top-left grid vertex `{col, row}` — these become 4 `rect` decorations, `width: 1, height: 1` each.

- [ ] **Step 3: Write the scratch file, measure scale, render overlay, iterate**

Same procedure as Task 2 Steps 3–6, against `GraphNarrative/Airplane.png` and `tools/symmetry_draw/.trace-scratch/airplane.json` / `airplane-ruler.png` / `airplane-overlay.png`. Note: `verify_trace.mjs overlay` only draws the traced line and start point, not decorations — cross-check the 4 window squares' `{col,row}` against the source image's grid manually (they're a single measurement each, low risk compared to the long command sequence).

- [ ] **Step 4: Determine `columns`/`rows`**

Same procedure as Task 2 Step 7.

- [ ] **Step 5: Append the card to `topic.json`**

```json
{
  "id": "dictation_airplane",
  "conceptId": "dictation_airplane",
  "primary": true,
  "label": "Самолёт",
  "taskKind": "dictation",
  "columns": <measured>,
  "rows": <measured>,
  "start": { "col": <measured>, "row": <measured> },
  "commands": [ /* verified */ ],
  "decorations": [
    { "type": "rect", "col": <measured>, "row": <measured>, "width": 1, "height": 1 },
    { "type": "rect", "col": <measured>, "row": <measured>, "width": 1, "height": 1 },
    { "type": "rect", "col": <measured>, "row": <measured>, "width": 1, "height": 1 },
    { "type": "rect", "col": <measured>, "row": <measured>, "width": 1, "height": 1 }
  ]
}
```

- [ ] **Step 6: Verify id uniqueness**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const ids = data.cards.map((c) => c.id);
console.log("total cards:", ids.length, "unique ids:", new Set(ids).size, "has dictation_airplane:", ids.includes("dictation_airplane"));
'
```

Expected: `unique ids` equals `total cards`, `has dictation_airplane: true`.

- [ ] **Step 7: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): add dictation_airplane card with window decorations"
```

---

### Task 5: Trace and add card — Вертолёт (`Helicopter.png`)

**Files:**
- Modify: `tools/symmetry_draw/topic.json`
- Create (scratch): `tools/symmetry_draw/.trace-scratch/helicopter.json`

**Interfaces:** consumes the `rect` decoration type from Task 1, including non-1×1 `width`/`height` for the rotor blades if they turn out to be disconnected.

- [ ] **Step 1: Transcribe the command table**

Read `GraphNarrative/Helicopter.png`. Transcribe the printed table into an ordered `{direction, cells}` array, same arrow mapping as Task 2 Step 1.

- [ ] **Step 2: Locate the start point and the cabin window**

Find the blue dot (nose, left side) and count its `{col, row}`. Locate the single small square inside the body (cabin window) and count its top-left `{col, row}` — becomes a `rect` decoration, `width: 1, height: 1`.

- [ ] **Step 3: Resolve the rotor blades**

The two long rectangles above the cabin (rotor blades) are the open question flagged in the design spec. After Step 5's overlay confirms the transcribed `commands` sequence traces the main body/cabin outline correctly, check specifically whether that same traced polyline also passes through both blade rectangles (i.e. the table's commands route the pen up through them as part of the one continuous line) or whether they sit completely off the traced path (never touched by `commands` at all, connected to the body only by empty space in the source image).

- If the traced line does reach and outline both blade rectangles: they're already covered by `commands`, no extra decoration needed for them.
- If the traced line never reaches them: add them as two more `rect` decorations, measuring each one's top-left `{col,row}` and its `width`/`height` in cells (they are wider than 1 cell, unlike the window) from the source grid.

- [ ] **Step 4: Write the scratch file, measure scale, render overlay, iterate**

Same procedure as Task 2 Steps 3–6, against `GraphNarrative/Helicopter.png` and `tools/symmetry_draw/.trace-scratch/helicopter.json` / `helicopter-ruler.png` / `helicopter-overlay.png`.

- [ ] **Step 5: Determine `columns`/`rows`**

Same procedure as Task 2 Step 7.

- [ ] **Step 6: Append the card to `topic.json`**

```json
{
  "id": "dictation_helicopter",
  "conceptId": "dictation_helicopter",
  "primary": true,
  "label": "Вертолёт",
  "taskKind": "dictation",
  "columns": <measured>,
  "rows": <measured>,
  "start": { "col": <measured>, "row": <measured> },
  "commands": [ /* verified */ ],
  "decorations": [
    { "type": "rect", "col": <measured>, "row": <measured>, "width": 1, "height": 1 }
    /* plus rotor-blade rects here only if Step 3 determined they're disconnected */
  ]
}
```

- [ ] **Step 7: Verify id uniqueness**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const ids = data.cards.map((c) => c.id);
console.log("total cards:", ids.length, "unique ids:", new Set(ids).size, "has dictation_helicopter:", ids.includes("dictation_helicopter"));
'
```

Expected: `unique ids` equals `total cards`, `has dictation_helicopter: true`.

- [ ] **Step 8: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): add dictation_helicopter card"
```

---

### Task 6: Trace and add card — Машина (`Car.png`)

**Files:**
- Modify: `tools/symmetry_draw/topic.json`
- Create (scratch): `tools/symmetry_draw/.trace-scratch/car.json`

**Interfaces:** same shape as Task 2/3, no `decorations` expected.

- [ ] **Step 1: Transcribe the command table**

Read `GraphNarrative/Car.png`. Transcribe the printed table into an ordered `{direction, cells}` array, same arrow mapping as Task 2 Step 1. The two cross/plus-shaped wheels at the bottom are expected to be part of this single continuous sequence (a standard technique in these worksheets) — transcribe the table as printed rather than assuming a shortcut around them.

- [ ] **Step 2: Locate the start point**

Find the blue dot (front, left side) and count its `{col, row}`.

- [ ] **Step 3: Write the scratch file, measure scale, render overlay, iterate**

Same procedure as Task 2 Steps 3–6, against `GraphNarrative/Car.png` and `tools/symmetry_draw/.trace-scratch/car.json` / `car-ruler.png` / `car-overlay.png`. Confirm specifically that the overlay's traced line covers both wheel crosses exactly — if it doesn't, the table transcription around the wheel section needs re-checking (that's the trickiest part of this figure to transcribe correctly).

- [ ] **Step 4: Determine `columns`/`rows`**

Same procedure as Task 2 Step 7.

- [ ] **Step 5: Append the card to `topic.json`**

```json
{
  "id": "dictation_car",
  "conceptId": "dictation_car",
  "primary": true,
  "label": "Машина",
  "taskKind": "dictation",
  "columns": <measured>,
  "rows": <measured>,
  "start": { "col": <measured>, "row": <measured> },
  "commands": [ /* verified */ ]
}
```

- [ ] **Step 6: Verify id uniqueness**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const ids = data.cards.map((c) => c.id);
console.log("total cards:", ids.length, "unique ids:", new Set(ids).size, "has dictation_car:", ids.includes("dictation_car"));
'
```

Expected: `unique ids` equals `total cards`, `has dictation_car: true`.

- [ ] **Step 7: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): add dictation_car card"
```

---

### Task 7: Trace and add card — Рогатый динозавр (`HornedDino.png`)

**Files:**
- Modify: `tools/symmetry_draw/topic.json`
- Create (scratch): `tools/symmetry_draw/.trace-scratch/horned_dino.json`

**Interfaces:** consumes the `dot` decoration type from Task 1.

- [ ] **Step 1: Transcribe the command table**

Read `GraphNarrative/HornedDino.png`. This source has two panels — a left panel with the filled reference figure, and a right panel that's blank except for a red dot. Transcribe the printed table (below both panels) into an ordered `{direction, cells}` array, same arrow mapping as Task 2 Step 1.

- [ ] **Step 2: Locate the start point and the eye decoration**

In the **left** panel, find the red dot on the outline (the start marker) and count its `{col, row}` from that panel's own ruled grid. Cross-check against the **right** (blank) panel's red dot — both should land on the same `{col, row}` in their respective grids, since the right panel shows the same starting position on an empty grid. Separately, locate the small black dot inside the head (the eye) in the left panel and count its `{col, row}` — this becomes the card's single `dot` decoration.

- [ ] **Step 3: Write the scratch file, measure scale, render overlay, iterate**

Same procedure as Task 2 Steps 3–6, against `GraphNarrative/HornedDino.png` (measure scale from the **left** panel specifically, since that's the one with the drawn figure) and `tools/symmetry_draw/.trace-scratch/horned_dino.json` / `horned_dino-ruler.png` / `horned_dino-overlay.png`.

- [ ] **Step 4: Determine `columns`/`rows`**

Same procedure as Task 2 Step 7.

- [ ] **Step 5: Append the card to `topic.json`**

```json
{
  "id": "dictation_horned_dino",
  "conceptId": "dictation_horned_dino",
  "primary": true,
  "label": "Рогатый динозавр",
  "taskKind": "dictation",
  "columns": <measured>,
  "rows": <measured>,
  "start": { "col": <measured>, "row": <measured> },
  "commands": [ /* verified */ ],
  "decorations": [ { "type": "dot", "col": <measured>, "row": <measured> } ]
}
```

- [ ] **Step 6: Verify id uniqueness**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const ids = data.cards.map((c) => c.id);
console.log("total cards:", ids.length, "unique ids:", new Set(ids).size, "has dictation_horned_dino:", ids.includes("dictation_horned_dino"));
'
```

Expected: `unique ids` equals `total cards`, `has dictation_horned_dino: true`.

- [ ] **Step 7: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): add dictation_horned_dino card"
```

---

### Task 8: Trace and add card — Стегозавр (`Stegosaurus.png`)

**Files:**
- Modify: `tools/symmetry_draw/topic.json`
- Create (scratch): `tools/symmetry_draw/.trace-scratch/stegosaurus.json`

**Interfaces:** consumes the `dot` decoration type from Task 1.

- [ ] **Step 1: Transcribe the command table**

Read `GraphNarrative/Stegosaurus.png`. Same two-panel source layout as Task 7 (left = filled reference, right = blank practice panel with a red dot). Transcribe the printed table into an ordered `{direction, cells}` array, same arrow mapping as Task 2 Step 1.

- [ ] **Step 2: Locate the start point and the eye decoration**

Same procedure as Task 7 Step 2: red dot on the outline in the left panel (cross-checked against the right panel's red dot), plus the black eye dot inside the head — becomes the card's single `dot` decoration.

- [ ] **Step 3: Write the scratch file, measure scale, render overlay, iterate**

Same procedure as Task 2 Steps 3–6, against `GraphNarrative/Stegosaurus.png` (left panel) and `tools/symmetry_draw/.trace-scratch/stegosaurus.json` / `stegosaurus-ruler.png` / `stegosaurus-overlay.png`.

- [ ] **Step 4: Determine `columns`/`rows`**

Same procedure as Task 2 Step 7.

- [ ] **Step 5: Append the card to `topic.json`**

```json
{
  "id": "dictation_stegosaurus",
  "conceptId": "dictation_stegosaurus",
  "primary": true,
  "label": "Стегозавр",
  "taskKind": "dictation",
  "columns": <measured>,
  "rows": <measured>,
  "start": { "col": <measured>, "row": <measured> },
  "commands": [ /* verified */ ],
  "decorations": [ { "type": "dot", "col": <measured>, "row": <measured> } ]
}
```

- [ ] **Step 6: Verify id uniqueness**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const ids = data.cards.map((c) => c.id);
console.log("total cards:", ids.length, "unique ids:", new Set(ids).size, "has dictation_stegosaurus:", ids.includes("dictation_stegosaurus"));
'
```

Expected: `unique ids` equals `total cards`, `has dictation_stegosaurus: true`.

- [ ] **Step 7: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): add dictation_stegosaurus card"
```

---

### Task 9: Bump version, rebuild ZIP, update catalog

**Files:**
- Modify: `tools/symmetry_draw/topic.json` (meta.version only)
- Modify: `tools/symmetry_draw/symmetry_draw.zip` (build artifact, tracked in git per project convention)
- Create: `public/decks/symmetry_draw_v1.5.0.zip`
- Modify: `public/decks/catalog.json`

**Interfaces:**
- Consumes: the finished `topic.json` from Tasks 1–8 (8 existing + 7 new = 15 dictation cards, 23 mirror, 8 repeat = 46 cards total).
- Produces: a deployable topic package.

- [ ] **Step 1: Bump the topic version**

In `tools/symmetry_draw/topic.json`, find:

```json
    "version": "1.4.0",
```

Change to:

```json
    "version": "1.5.0",
```

- [ ] **Step 2: Verify the full card count and new ids**

```bash
node -e '
const data = require("./tools/symmetry_draw/topic.json");
const dictationCards = data.cards.filter((c) => c.taskKind === "dictation");
console.log("total cards:", data.cards.length, "dictation cards:", dictationCards.length);
console.log("dictation ids:", dictationCards.map((c) => c.id).join(", "));
console.log("version:", data.meta.version);
'
```

Expected: `total cards: 52`, `dictation cards: 23`, the ids list includes all 16 original ones plus `dictation_pig, dictation_trex, dictation_airplane, dictation_helicopter, dictation_car, dictation_horned_dino, dictation_stegosaurus`, `version: 1.5.0`.

- [ ] **Step 3: Rebuild the ZIP**

```bash
node tools/symmetry_draw/build.mjs
```

Expected output: `Built .../tools/symmetry_draw/symmetry_draw.zip`

- [ ] **Step 4: Copy to the versioned public deck filename**

```bash
cp tools/symmetry_draw/symmetry_draw.zip public/decks/symmetry_draw_v1.5.0.zip
```

- [ ] **Step 5: Update `public/decks/catalog.json`**

Find the `symmetry_draw` entry (currently pointing at `1.4.0`):

```json
      "id": "symmetry_draw",
      "version": "1.4.0",
      "url": "./decks/symmetry_draw_v1.4.0.zip",
      "zipUrl": "symmetry_draw_v1.4.0.zip",
```

Replace with:

```json
      "id": "symmetry_draw",
      "version": "1.5.0",
      "url": "./decks/symmetry_draw_v1.5.0.zip",
      "zipUrl": "symmetry_draw_v1.5.0.zip",
```

(If the current committed version differs from `1.4.0`, use whatever is actually there instead — read the file first to confirm the exact current field values before editing.)

- [ ] **Step 6: Commit**

```bash
git add tools/symmetry_draw/topic.json tools/symmetry_draw/symmetry_draw.zip public/decks/symmetry_draw_v1.5.0.zip public/decks/catalog.json
git commit -m "content(symmetry_draw): rebuild deck v1.5.0 with decorations + 7 new dictation cards"
```

---

### Task 10: End-to-end verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the existing verify_trace unit tests**

```bash
node --test tools/symmetry_draw/verify_trace.test.mjs
```

Expected: all 3 pre-existing tests pass, unaffected by this feature.

- [ ] **Step 2: Live browser check — one new card end-to-end**

Using a temporary harness (same pattern as Task 1 Step 4, deleted after use), mount the real, final `dictation_pig` card object read directly out of the now-final `tools/symmetry_draw/topic.json`, and confirm:
- The eye `dot` decoration is present in the DOM immediately on mount, before any gesture.
- Performing the first command's drag correctly advances `stepIndex` and adds a `.dictation__fixed` line, while the decoration stays present and unchanged throughout.
- Completing all commands reaches `finished: true` and fires `onCorrect` with `("dictation_pig", "dictation_pig")`.

- [ ] **Step 3: Live browser check — a card with multiple `rect` decorations**

Same harness technique, mount the final `dictation_airplane` card and confirm all 4 window `rect` elements are present in the DOM immediately on mount, at the exact `{col,row}` recorded in `topic.json`.

- [ ] **Step 4: Screenshot for a final visual sanity check**

For each of the 7 new cards, mount it in the harness and screenshot (Browser pane tool) before any interaction — confirm each figure reads clearly as its label (a pig looks like a pig, etc.) and any decorations sit visually inside the figure, not floating outside its outline.

- [ ] **Step 5: Report results to the user**

Summarize pass/fail for each check above, and show the 7 screenshots. If everything passes, the feature is complete for this task — proceed to Task 11 only with explicit user go-ahead.

---

### Task 11: Deploy (only with explicit user confirmation)

**Files:** none modified — deployment only.

- [ ] **Step 1: Confirm clean worktree**

```bash
git status --short
```

If anything unrelated to this feature is dirty, stop and ask the user how to proceed rather than deploying over it.

- [ ] **Step 2: Ask the user to confirm before deploying**

Do not run the deploy command until the user has explicitly said to proceed in this session.

- [ ] **Step 3: Deploy**

```bash
npm run deploy:prod
```

- [ ] **Step 4: Verify**

```bash
npm run deploy:verify
```

Both the public (`https://mirocard.kaplieva.help/`) and LAN (`http://192.168.1.163:8080/`) URLs must report the new app version.
