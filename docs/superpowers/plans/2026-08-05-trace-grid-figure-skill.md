# Trace-Grid-Figure Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-scoped `trace-grid-figure` skill that turns a raster reference image into `topic.json`-ready vector data for the `symmetry_draw` topic, plus a reusable verification tool, then use it to fix the two draft `graphic_dictation` cards (`dictation_dog`, `dictation_mouse`) that were traced from the wrong source.

**Architecture:** One small Node/ESM module (`tools/symmetry_draw/verify_trace.mjs`) exposes a pure `commandsToPath` function (unit-tested) plus a two-subcommand CLI (`ruler`, `overlay`) built on `sharp`, which composites an SVG of measured grid coordinates onto the source image so a human/agent can visually confirm a trace before it goes into `topic.json`. The skill itself (`.claude/skills/trace-grid-figure/SKILL.md`) documents the two tracing modes (printed command table vs. bare contour) and always ends in a call to this verification tool. The two draft cards are then rebuilt from the printed tables on `Dog.jpg`/`Mouse.jpg` using the skill and verified with the tool before editing `topic.json`.

**Tech Stack:** Node.js (ESM, `.mjs`), `sharp` (already a project dependency) for image compositing, `node:test` + `node:assert/strict` (Node's built-in test runner) for the pure-function unit test.

## Global Constraints

- Node scripts only — the project is Node/Vite throughout, no Python (spec: Skill design).
- Skill file lives at `.claude/skills/trace-grid-figure/SKILL.md`, project-scoped inside the Mirocard2 repo — it intentionally shares its name with an unrelated global skill for a different project; the project-scoped one takes precedence inside this repo (spec: Skill design).
- Do not modify `renderer.js`, `engine.js`, or the card schema (spec: Out of scope).
- Do not repackage the ZIP, bump `topic.json`'s version, or touch `catalog.json` in this pass (spec: Versioning and rollout).
- Only the `dictation_dog` and `dictation_mouse` cards in `tools/symmetry_draw/topic.json` are modified for content — no other card is touched (spec: Immediate application / Out of scope).
- Every produced trace (dog, mouse, and the two tool self-checks) must be confirmed with the overlay tool before being considered done — no card ships on eyeballing alone (spec: Skill design, Testing plan).

---

### Task 1: `commandsToPath` pure function + unit test

**Files:**
- Create: `tools/symmetry_draw/verify_trace.mjs`
- Create: `tools/symmetry_draw/verify_trace.test.mjs`

**Interfaces:**
- Produces: `export const DIRECTION` — object keyed by the 8 direction tokens (`up`, `down`, `left`, `right`, `up_right`, `down_right`, `up_left`, `down_left`), each `{ col: number, row: number }` unit vector. Must match `tools/symmetry_draw/renderer.js`'s `DIRECTION` map (lines 100-109) exactly — that's the runtime source of truth this tool is verifying against.
- Produces: `export function commandsToPath(start, commands)` — `start: {col:number, row:number}`, `commands: Array<{direction: string, cells: number}>`, returns `Array<{col:number, row:number}>` (the start point followed by one point per command, in order). Throws `Error` on an unknown `direction`.

- [ ] **Step 1: Write the failing test**

Create `tools/symmetry_draw/verify_trace.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { commandsToPath } from "./verify_trace.mjs";

test("commandsToPath walks straight moves", () => {
  const points = commandsToPath({ col: 1, row: 1 }, [
    { direction: "right", cells: 3 },
    { direction: "down", cells: 2 },
  ]);
  assert.deepEqual(points, [
    { col: 1, row: 1 },
    { col: 4, row: 1 },
    { col: 4, row: 3 },
  ]);
});

test("commandsToPath walks diagonal moves and can return to start", () => {
  const points = commandsToPath({ col: 5, row: 5 }, [
    { direction: "up_left", cells: 2 },
    { direction: "down_right", cells: 2 },
  ]);
  assert.deepEqual(points, [
    { col: 5, row: 5 },
    { col: 3, row: 3 },
    { col: 5, row: 5 },
  ]);
});

test("commandsToPath throws on an unknown direction", () => {
  assert.throws(
    () => commandsToPath({ col: 0, row: 0 }, [{ direction: "diagonal", cells: 1 }]),
    /Unknown direction: diagonal/
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tools/symmetry_draw/verify_trace.test.mjs`
Expected: FAIL — `verify_trace.mjs` does not exist yet (module not found).

- [ ] **Step 3: Write the minimal implementation**

Create `tools/symmetry_draw/verify_trace.mjs`:

```js
export const DIRECTION = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  right: { col: 1, row: 0 },
  left: { col: -1, row: 0 },
  up_right: { col: 1, row: -1 },
  down_right: { col: 1, row: 1 },
  up_left: { col: -1, row: -1 },
  down_left: { col: -1, row: 1 },
};

export function commandsToPath(start, commands) {
  const points = [{ col: start.col, row: start.row }];
  let current = { col: start.col, row: start.row };
  for (const command of commands) {
    const direction = DIRECTION[command.direction];
    if (!direction) {
      throw new Error(`Unknown direction: ${command.direction}`);
    }
    current = {
      col: current.col + direction.col * command.cells,
      row: current.row + direction.row * command.cells,
    };
    points.push(current);
  }
  return points;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tools/symmetry_draw/verify_trace.test.mjs`
Expected: PASS, 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add tools/symmetry_draw/verify_trace.mjs tools/symmetry_draw/verify_trace.test.mjs
git commit -m "feat(symmetry_draw): add commandsToPath tracing helper with tests"
```

---

### Task 2: `ruler` and `overlay` CLI on top of `verify_trace.mjs`

**Files:**
- Modify: `tools/symmetry_draw/verify_trace.mjs`
- Modify: `.gitignore` (repo root)

**Interfaces:**
- Consumes: `DIRECTION`, `commandsToPath` from Task 1 (same file, no import needed — both are defined above the new code in the same module).
- Produces: a CLI reachable as `node tools/symmetry_draw/verify_trace.mjs <ruler|overlay> ...` (documented usage below). No other module imports this CLI code — it's a standalone tool, not consumed by app code.

- [ ] **Step 1: Add `.trace-scratch/` to `.gitignore`**

Append to `.gitignore` (root of repo):

```
tools/symmetry_draw/.trace-scratch/
```

- [ ] **Step 2: Append the CLI implementation to `verify_trace.mjs`**

Add below the existing `commandsToPath` function in `tools/symmetry_draw/verify_trace.mjs`:

```js
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

function toPixel(point, cellPx, originX, originY) {
  return { pxX: originX + point.col * cellPx, pxY: originY + point.row * cellPx };
}

function buildOverlaySvg({ width, height, paths, startPoint }) {
  const strokes = paths
    .map((path) => {
      const points = path.map((p) => `${p.pxX},${p.pxY}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="#ff0033" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("\n");
  const dots = paths
    .flat()
    .map((p) => `<circle cx="${p.pxX}" cy="${p.pxY}" r="4" fill="#ff0033" />`)
    .join("\n");
  const start = startPoint
    ? `<circle cx="${startPoint.pxX}" cy="${startPoint.pxY}" r="7" fill="none" stroke="#0055ff" stroke-width="3" />`
    : "";
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${strokes}\n${dots}\n${start}</svg>`;
}

function buildRulerSvg({ width, height, step }) {
  const lines = [];
  const labels = [];
  for (let x = 0; x <= width; x += step) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#00cc44" stroke-width="1" opacity="0.6" />`);
    labels.push(`<text x="${x + 2}" y="12" font-size="10" fill="#008822">${x}</text>`);
  }
  for (let y = 0; y <= height; y += step) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#00cc44" stroke-width="1" opacity="0.6" />`);
    labels.push(`<text x="2" y="${y - 2}" font-size="10" fill="#008822">${y}</text>`);
  }
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines.join("\n")}\n${labels.join("\n")}</svg>`;
}

async function runRuler(imagePath, { step, out }) {
  const image = sharp(imagePath);
  const { width, height } = await image.metadata();
  const svg = buildRulerSvg({ width, height, step });
  await image.composite([{ input: Buffer.from(svg) }]).toFile(out);
  console.log(`Ruler overlay written to ${out} (${width}x${height}px, step ${step}px)`);
}

async function runOverlay(imagePath, dataPath, { cellPx, originX, originY, out }) {
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const rawPaths = data.paths ?? [commandsToPath(data.start, data.commands)];
  const paths = rawPaths.map((path) => path.map((p) => ({ ...p, ...toPixel(p, cellPx, originX, originY) })));
  const startPoint = data.start ? { ...data.start, ...toPixel(data.start, cellPx, originX, originY) } : null;
  const image = sharp(imagePath);
  const { width, height } = await image.metadata();
  const svg = buildOverlaySvg({ width, height, paths, startPoint });
  await image.composite([{ input: Buffer.from(svg) }]).toFile(out);
  console.log(`Overlay written to ${out}`);
}

function parseArgs(argv) {
  const [command, imagePath, maybeDataPath, ...rest] = argv;
  const options = {};
  for (const arg of rest) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) options[match[1]] = match[2];
  }
  return { command, imagePath, maybeDataPath, options };
}

async function main() {
  const { command, imagePath, maybeDataPath, options } = parseArgs(process.argv.slice(2));
  if (command === "ruler") {
    await runRuler(imagePath, {
      step: Number(options.step ?? 50),
      out: options.out ?? "overlay-ruler.png",
    });
  } else if (command === "overlay") {
    await runOverlay(imagePath, maybeDataPath, {
      cellPx: Number(options.cell),
      originX: Number(options.originX),
      originY: Number(options.originY),
      out: options.out ?? "overlay-check.png",
    });
  } else {
    console.error(
      "Usage:\n" +
        "  node verify_trace.mjs ruler <image> [--step=50] [--out=path]\n" +
        "  node verify_trace.mjs overlay <image> <data.json> --cell=N --originX=N --originY=N [--out=path]"
    );
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main();
}
```

- [ ] **Step 3: Create a scratch dir and a synthetic test image**

```bash
mkdir -p tools/symmetry_draw/.trace-scratch
node -e "import('sharp').then(({default:sharp})=>sharp({create:{width:400,height:400,channels:3,background:'#ffffff'}}).png().toFile('tools/symmetry_draw/.trace-scratch/blank.png'))"
```

- [ ] **Step 4: Verify the `overlay` command against a known shape (sourcePaths form)**

```bash
cat > tools/symmetry_draw/.trace-scratch/square.json <<'EOF'
{ "paths": [[{"col":0,"row":0},{"col":5,"row":0},{"col":5,"row":5},{"col":0,"row":5},{"col":0,"row":0}]] }
EOF
node tools/symmetry_draw/verify_trace.mjs overlay tools/symmetry_draw/.trace-scratch/blank.png tools/symmetry_draw/.trace-scratch/square.json --cell=40 --originX=40 --originY=40 --out=tools/symmetry_draw/.trace-scratch/square-overlay.png
```

Then use the Read tool on `tools/symmetry_draw/.trace-scratch/square-overlay.png`.
Expected: a red square outline with corners at pixel (40,40), (240,40), (240,240), (40,240) on a white background, with small red dots at each corner.

- [ ] **Step 5: Verify the `overlay` command against a known shape (start+commands form)**

```bash
cat > tools/symmetry_draw/.trace-scratch/rect-dictation.json <<'EOF'
{ "start": {"col":1,"row":1}, "commands": [
  {"direction":"right","cells":3},
  {"direction":"down","cells":2},
  {"direction":"left","cells":3},
  {"direction":"up","cells":2}
] }
EOF
node tools/symmetry_draw/verify_trace.mjs overlay tools/symmetry_draw/.trace-scratch/blank.png tools/symmetry_draw/.trace-scratch/rect-dictation.json --cell=40 --originX=40 --originY=40 --out=tools/symmetry_draw/.trace-scratch/rect-overlay.png
```

Then use the Read tool on `tools/symmetry_draw/.trace-scratch/rect-overlay.png`.
Expected: a red rectangle outline from pixel (80,80) to (200,120) (start at col1,row1 → px 80,80), and a hollow blue circle at (80,80) marking the start point.

- [ ] **Step 6: Verify the `ruler` command against a real photo**

```bash
node tools/symmetry_draw/verify_trace.mjs ruler GraphNarrative/Dog.jpg --step=50 --out=tools/symmetry_draw/.trace-scratch/dog-ruler.png
```

Then use the Read tool on `tools/symmetry_draw/.trace-scratch/dog-ruler.png`.
Expected: the original Dog.jpg photo with a green pixel grid every 50px and small numeric labels, usable to read off where the drawn grid's lines and the start dot sit in pixel coordinates.

- [ ] **Step 7: Commit**

```bash
git add tools/symmetry_draw/verify_trace.mjs .gitignore
git commit -m "feat(symmetry_draw): add ruler/overlay CLI to verify_trace.mjs"
```

(The `.trace-scratch/` directory itself is gitignored — nothing to add from it.)

---

### Task 3: Write the `trace-grid-figure` skill

**Files:**
- Create: `.claude/skills/trace-grid-figure/SKILL.md`

**Interfaces:**
- Consumes: `tools/symmetry_draw/verify_trace.mjs`'s `ruler`/`overlay` CLI from Task 2 (documented by exact command-line usage, not by importing anything).

- [ ] **Step 1: Write the skill file**

Create `.claude/skills/trace-grid-figure/SKILL.md`:

```markdown
---
name: trace-grid-figure
description: Use when converting a raster reference image into topic.json-ready vector data for the Mirocard symmetry_draw topic ("Рисуем по клеткам") — mirror_draw/repeat_draw sourcePaths or graphic_dictation start+commands. Handles both a worksheet with a printed command table (graphic dictation) and a bare grid-drawn contour with no table.
---

# Trace Grid Figure (symmetry_draw)

## Overview

Turns a raster reference image into the exact vertex data `tools/symmetry_draw/topic.json` cards need, for all three modes of the topic:

- `taskKind: "dictation"` → `start: {col,row}` + `commands: [{direction,cells}]`
- `taskKind: "mirror"` / `taskKind: "repeat"` → `sourcePaths: [[{col,row}, ...], ...]` + `axisCol`

Every trace must be confirmed with `tools/symmetry_draw/verify_trace.mjs` before it goes into `topic.json` — never ship a hand-counted trace without rendering it back over the source image and comparing.

Schema reference: read a few existing cards in `tools/symmetry_draw/topic.json` for exact field shapes and naming (`dictation_*` / `symmetry_*` / `repeat_*` id prefixes, `conceptId` mirrors `id`, `primary` flag). For the `mirror` vs `repeat` distinction (reflect vs. translate around `axisCol`), read `docs/superpowers/specs/2026-08-02-symmetry-draw-repeat-mode-design.md`.

## Mode A — printed command table present

Use this when the image prints a table of arrow+number cells above the figure (standard "графический диктант" worksheet, e.g. a table like `4→ 1↘ 1↑ 1↗ …`).

1. Read the image with the Read tool. Transcribe the table left-to-right, top-to-bottom into an ordered list of `{direction, cells}`. Map arrows to direction tokens literally — no interpretation:

   | Arrow | direction |
   |---|---|
   | → | right |
   | ← | left |
   | ↑ | up |
   | ↓ | down |
   | ↗ | up_right |
   | ↘ | down_right |
   | ↖ | up_left |
   | ↙ | down_left |

2. Find the marked start point (a colored dot on the drawn figure below the table) and count its `{col,row}` from the figure's own ruled grid lines (count grid intersections from the drawn grid's own top-left, not the page edge).
3. Pick `columns`/`rows` for the card: tight bounding box of the traced path plus ~1-2 cells of margin, matching the existing cards' convention.
4. Write a scratch JSON file (e.g. `tools/symmetry_draw/.trace-scratch/<name>.json`) with `{ "start": {...}, "commands": [...] }`.
5. Measure pixel scale: run
   `node tools/symmetry_draw/verify_trace.mjs ruler <image> --step=50 --out=tools/symmetry_draw/.trace-scratch/<name>-ruler.png`
   and read the output image to find the pixel spacing between the drawn grid's own lines (cell size in px) and the pixel position of one grid intersection (origin).
6. Render the overlay:
   `node tools/symmetry_draw/verify_trace.mjs overlay <image> <scratch>.json --cell=<px> --originX=<px> --originY=<px> --out=tools/symmetry_draw/.trace-scratch/<name>-overlay.png`
   and read the output image. The red traced line and blue start-point circle must sit exactly on top of the source drawing's line and start dot.
7. If they don't align, re-check step 1-3 (most likely a table transcription slip or a miscounted start point) and re-render. Only write the final `commands`/`start` into `topic.json` once the overlay matches.
8. Also manually re-read the transcribed `commands` array against the printed table cell-by-cell once — the overlay can visually match by coincidence on a symmetric-looking segment even with a swapped direction token; a manual re-check catches that.

## Mode B — bare contour, no table

Use this for `mirror_draw`/`repeat_draw` cards, or a dictation source with no printed table — the image is just a figure drawn on grid paper.

1. Read the image. Measure the grid's cell size in pixels and the pixel origin of one grid intersection, the same way as Mode A step 5 (`ruler` subcommand).
2. Trace every vertex of every disjoint stroke. A card may need more than one `sourcePaths` entry (e.g. a body plus a separate window/detail) — split into separate paths wherever the pen would lift. Snap every vertex to a grid intersection; `.5` fractional coordinates are allowed for curves/circles (existing precedent: `symmetry_heart`, `symmetry_eye`).
3. For a `mirror` card: trace only the half up to the axis (the engine reflects it at runtime); `axisCol` is the column where the drawn axis line sits. For a `repeat` card: trace the *whole* figure (the engine only translates it, it does not mirror); `axisCol` marks where the student's blank half begins.
4. Write a scratch JSON file with `{ "paths": [[...], ...] }` and render it with the same `overlay` command as Mode A step 6. Iterate until every path aligns with the source drawing.
5. Assemble the full card object (`id`, `conceptId`, `label`, `taskKind`, `columns`, `rows`, `axisCol`, `sourcePaths`, and `primary` if it's the first card introducing a new figure set).

## Cleanup

Scratch files under `tools/symmetry_draw/.trace-scratch/` are gitignored — leave them or delete them, they never get committed.
```

- [ ] **Step 2: Self-review the skill against the checklist below (fix inline, no separate step)**

- Does Mode A give the exact arrow→direction mapping table? (yes)
- Does every mode end with a mandatory overlay verification step referencing the real CLI syntax from Task 2? (yes)
- Does it avoid duplicating the full card JSON schema inline, pointing at `topic.json` and the repeat-mode design doc instead? (yes)
- Any TBD/placeholder text? (none)

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/trace-grid-figure/SKILL.md
git commit -m "docs: add trace-grid-figure skill for symmetry_draw"
```

---

### Task 4: Rebuild `dictation_dog` from the printed table

**Files:**
- Modify: `tools/symmetry_draw/topic.json` (the `dictation_dog` card only — search for `"id": "dictation_dog"`)

**Interfaces:**
- Consumes: the `trace-grid-figure` skill (Task 3) and `tools/symmetry_draw/verify_trace.mjs` (Task 2).

- [ ] **Step 1: Follow Mode A of the `trace-grid-figure` skill on `GraphNarrative/Dog.jpg`**

Read the image fresh with the Read tool (do not reuse any earlier transcription from this conversation without re-reading — the point of the skill is that the transcription is verified, not remembered). Transcribe the printed command table into an ordered `commands` array using the arrow table from the skill. Find the start dot on the drawn dog figure and count its `{col,row}`.

- [ ] **Step 2: Write the scratch trace file**

```bash
mkdir -p tools/symmetry_draw/.trace-scratch
cat > tools/symmetry_draw/.trace-scratch/dog.json <<'EOF'
{ "start": {"col": <measured>, "row": <measured>}, "commands": [ <transcribed from the table> ] }
EOF
```

- [ ] **Step 3: Measure pixel scale and render the overlay**

```bash
node tools/symmetry_draw/verify_trace.mjs ruler GraphNarrative/Dog.jpg --step=25 --out=tools/symmetry_draw/.trace-scratch/dog-ruler.png
```

Read `dog-ruler.png` to find the drawn grid's cell size in px and the pixel origin of the start dot's cell.

```bash
node tools/symmetry_draw/verify_trace.mjs overlay GraphNarrative/Dog.jpg tools/symmetry_draw/.trace-scratch/dog.json --cell=<measured> --originX=<measured> --originY=<measured> --out=tools/symmetry_draw/.trace-scratch/dog-overlay.png
```

Read `dog-overlay.png`. Expected: the red traced line follows the dog's drawn outline exactly, corner for corner, and the blue start-point circle sits exactly on the pink start dot in the source image.

- [ ] **Step 4: Iterate until the overlay matches**

If any segment is off, the most likely causes are: a table cell transcribed with the wrong arrow, a miscounted start point, or a wrong `--cell`/`--originX`/`--originY` measurement. Fix and re-render. Do not proceed until it matches exactly.

- [ ] **Step 5: Update `topic.json`**

In `tools/symmetry_draw/topic.json`, find the card with `"id": "dictation_dog"`. Replace only its `start` and `commands` fields with the verified values from `tools/symmetry_draw/.trace-scratch/dog.json`. Leave `id`, `conceptId`, `label`, `taskKind`, `primary`, `columns`, `rows` as they already are unless the new traced path no longer fits inside the current `columns`/`rows` bounding box — if it doesn't fit, adjust `columns`/`rows` to the tight-bounding-box-plus-margin rule from the skill.

- [ ] **Step 6: Validate the JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('tools/symmetry_draw/topic.json','utf8')); console.log('OK')"`
Expected: prints `OK`.

- [ ] **Step 7: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): rebuild dictation_dog from the printed command table"
```

---

### Task 5: Rebuild `dictation_mouse` from the printed table

**Files:**
- Modify: `tools/symmetry_draw/topic.json` (the `dictation_mouse` card only — search for `"id": "dictation_mouse"`)

**Interfaces:**
- Consumes: the same as Task 4, applied to `GraphNarrative/Mouse.jpg`.

- [ ] **Step 1: Follow Mode A of the `trace-grid-figure` skill on `GraphNarrative/Mouse.jpg`**

Read the image fresh with the Read tool. Transcribe the printed command table into an ordered `commands` array. Find the start dot on the drawn mouse figure and count its `{col,row}`.

- [ ] **Step 2: Write the scratch trace file**

```bash
cat > tools/symmetry_draw/.trace-scratch/mouse.json <<'EOF'
{ "start": {"col": <measured>, "row": <measured>}, "commands": [ <transcribed from the table> ] }
EOF
```

- [ ] **Step 3: Measure pixel scale and render the overlay**

```bash
node tools/symmetry_draw/verify_trace.mjs ruler GraphNarrative/Mouse.jpg --step=25 --out=tools/symmetry_draw/.trace-scratch/mouse-ruler.png
```

Read `mouse-ruler.png` to find the drawn grid's cell size in px and the pixel origin of the start dot's cell.

```bash
node tools/symmetry_draw/verify_trace.mjs overlay GraphNarrative/Mouse.jpg tools/symmetry_draw/.trace-scratch/mouse.json --cell=<measured> --originX=<measured> --originY=<measured> --out=tools/symmetry_draw/.trace-scratch/mouse-overlay.png
```

Read `mouse-overlay.png`. Expected: the red traced line follows the mouse's drawn outline exactly, and the blue start-point circle sits exactly on the pink start dot (bottom-left, in the tail curl) in the source image.

- [ ] **Step 4: Iterate until the overlay matches**

Same failure modes and fix approach as Task 4 Step 4.

- [ ] **Step 5: Update `topic.json`**

Find the card with `"id": "dictation_mouse"`. Replace only its `start` and `commands` fields with the verified values. Leave other fields as-is unless the bounding box needs adjusting per the skill's margin rule.

- [ ] **Step 6: Validate the JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('tools/symmetry_draw/topic.json','utf8')); console.log('OK')"`
Expected: prints `OK`.

- [ ] **Step 7: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "content(symmetry_draw): rebuild dictation_mouse from the printed command table"
```

---

### Task 6: Regression check and cleanup

**Files:**
- None modified (verification only), unless the regression check surfaces a problem — in that case, fix within the relevant file from Tasks 4-5 before re-running.

**Interfaces:**
- Consumes: everything from Tasks 1-5.

- [ ] **Step 1: Run the existing scoped test suite**

Run: `npx vitest run --dir src`
Expected: PASS — this is content-only data, `flashcards/engine.test.js` and `topicLoader.test.js` should be unaffected. (Running scoped to `src/` avoids the known stray-directory test-discovery pollution noted in project memory.)

- [ ] **Step 2: Re-run the Task 1 unit test one more time**

Run: `node --test tools/symmetry_draw/verify_trace.test.mjs`
Expected: PASS, 3 tests passing.

- [ ] **Step 3: Confirm no other `symmetry_draw` cards changed**

Run: `git diff --stat main -- tools/symmetry_draw/topic.json` (or `git log -p` over the commits from Tasks 4-5)
Expected: only the `dictation_dog` and `dictation_mouse` card bodies differ from before this plan started; no other card's fields changed.

- [ ] **Step 4: Leave scratch files in place (gitignored) or delete them**

```bash
rm -rf tools/symmetry_draw/.trace-scratch
```

This is optional cleanup — the directory is gitignored either way and never gets committed.

