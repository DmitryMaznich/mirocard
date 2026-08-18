# Coordinate Dictation Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth mode, "Точки по координатам" (`taskKind: "coordinate"`), to the `symmetry_draw` topic ("Рисуем по клеткам"), where the child finds a Battleship-style grid coordinate (e.g. "Е3") and draws the line to it by hand, reusing the existing dictation drawing gesture.

**Architecture:** `renderer.js`'s `DictationTask` component (used today only by `graphic_dictation`) is generalized to consume a pre-resolved list of `{ end, text, speech }` steps instead of walking `commands` inline, so the same interaction/validation code serves both direction-based dictation cards and the new absolute-coordinate cards. Content for the new mode's 23 cards is generated mechanically from the 23 existing `dictation_*` cards (no new tracing/artwork), by walking their `start`+`commands` into absolute points with the tracing tool's already-exported `commandsToPath`.

**Tech Stack:** React 19 (via `window.__Mirocard.React`, no build step for `tools/symmetry_draw/renderer.js` — it ships as a raw script inside the topic ZIP), Vitest (`src/`), `node --test` (`tools/`), plain JSON content (`topic.json`).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-12-symmetry-draw-coordinate-dictation-design.md` — follow it exactly; this plan implements it task-by-task.
- `renderer.js` cannot use ES `import`/bundler features — it is zipped and shipped verbatim (see `tools/symmetry_draw/build.mjs`). Any logic it needs must be defined inline in the file, even if that duplicates a tested standalone module (existing precedent: `DIRECTION`/`commandsToPath` are duplicated between `tools/symmetry_draw/verify_trace.mjs` and `renderer.js` for exactly this reason).
- Column letters skip `Ё` and `Й` (pronunciation/visual ambiguity) — 31-letter reduced alphabet, per the design spec.
- Row headers stay numeric in every mode, including `coordinate`. Only column headers switch to letters, and only for `taskKind: "coordinate"` cards.
- No print/PDF export for the new mode in this pass — out of scope per spec.
- No new mode icon — reuse `media/dictation_avatar.svg`.
- Do not touch `mirror_draw`/`repeat_draw` cards or `GridTask`.
- Topic content changes (adding cards/modes, bumping `topic.json`'s `meta.version`) must be followed by rebuilding and re-versioning the ZIP per project convention: bump version, rebuild, copy to a **new** `public/decks/symmetry_draw_v<version>.zip` (never overwrite an old version's file), update `public/decks/catalog.json`'s `version`/`url`/`zipUrl` together.

---

## Task 1: `columnLabel` helper (standalone, tested)

**Files:**
- Create: `tools/symmetry_draw/column_label.mjs`
- Create: `tools/symmetry_draw/column_label.test.mjs`

**Interfaces:**
- Produces: `columnLabel(col: number): string` — 0-based column index → Battleship-style Cyrillic column letter. Consumed later by `renderer.js`'s inline duplicate (Task 4) and available as the source-of-truth algorithm reference.

- [ ] **Step 1: Write the module**

```js
// tools/symmetry_draw/column_label.mjs
// Battleship-style column letters for the "coordinate" taskKind grid header.
// Skips Ё and Й (pronunciation/visual ambiguity) — see design doc
// docs/superpowers/specs/2026-08-12-symmetry-draw-coordinate-dictation-design.md.
export const COORDINATE_COLUMN_LETTERS = [
  "А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н",
  "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ",
  "Ы", "Ь", "Э", "Ю", "Я",
];

export function columnLabel(col) {
  return COORDINATE_COLUMN_LETTERS[col] ?? `?${col}`;
}
```

- [ ] **Step 2: Write the test**

```js
// tools/symmetry_draw/column_label.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnLabel } from "./column_label.mjs";

test("columnLabel starts at А for column 0", () => {
  assert.equal(columnLabel(0), "А");
});

test("columnLabel skips Ё between Д and Ж", () => {
  assert.equal(columnLabel(4), "Д");
  assert.equal(columnLabel(5), "Е");
  assert.equal(columnLabel(6), "Ж");
});

test("columnLabel skips Й between И and К", () => {
  assert.equal(columnLabel(8), "И");
  assert.equal(columnLabel(9), "К");
});

test("columnLabel covers columns 0-12 with unique, defined letters", () => {
  const letters = Array.from({ length: 13 }, (_, i) => columnLabel(i));
  assert.equal(letters.every((letter) => typeof letter === "string" && letter.length === 1), true);
  assert.equal(new Set(letters).size, 13);
});
```

- [ ] **Step 3: Run the tests**

Run: `node --test tools/symmetry_draw/column_label.test.mjs`
Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add tools/symmetry_draw/column_label.mjs tools/symmetry_draw/column_label.test.mjs
git commit -m "feat(symmetry_draw): add columnLabel helper for coordinate mode"
```

---

## Task 2: `generateCoordinateDictationTasks` in the flashcards engine

**Files:**
- Modify: `src/topics/renderers/flashcards/engine.js:32-34` (insert after `generateGraphicDictationTasks`), and the mode switch around line 261
- Test: `src/topics/renderers/flashcards/engine.test.js:27-61`

**Interfaces:**
- Consumes: `filterByTaskKind(concepts, kind)` and `generateIntroTasks(concepts)`, both already defined above in the same file.
- Produces: `generateCoordinateDictationTasks(concepts)` returning tasks shaped `{ type: "coordinate_dictation", conceptId, card, label }`, wired to mode type `"coordinate_dictation"` in `generateTasks`'s switch.

- [ ] **Step 1: Write the failing test**

In `src/topics/renderers/flashcards/engine.test.js`, extend the existing `MIXED_CARDS` array (line 28-33) with one coordinate card, and add a new `it` block after the `graphic_dictation` test (after line 55):

```js
  const MIXED_CARDS = [
    { id: "m1", conceptId: "m1", primary: true, label: "Дом",   taskKind: "mirror", sourcePaths: [] },
    { id: "m2", conceptId: "m2", primary: true, label: "Лодка", taskKind: "mirror", sourcePaths: [] },
    { id: "r1", conceptId: "r1", primary: true, label: "Ракета", taskKind: "repeat", sourcePaths: [] },
    { id: "d1", conceptId: "d1", primary: true, label: "Собака", taskKind: "dictation", start: { col: 0, row: 0 }, commands: [] },
    { id: "c1", conceptId: "c1", primary: true, label: "Ёлка", taskKind: "coordinate", start: { col: 0, row: 0 }, points: [] },
  ];
```

```js
  it("coordinate_dictation only includes taskKind:coordinate cards", () => {
    const tasks = generateTasks("coordinate_dictation", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: "coordinate_dictation", conceptId: "c1" });
    expect(tasks[0].card.taskKind).toBe("coordinate");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/topics/renderers/flashcards/engine.test.js`
Expected: FAIL — `generateTasks("coordinate_dictation", ...)` falls through the switch's default case (returns `[]`, not the expected 1 task), or `"coordinate_dictation"` is unhandled.

- [ ] **Step 3: Implement**

In `src/topics/renderers/flashcards/engine.js`, add after `generateGraphicDictationTasks` (currently lines 32-34):

```js
function generateCoordinateDictationTasks(concepts) {
  return generateIntroTasks(filterByTaskKind(concepts, "coordinate")).map((t) => ({ ...t, type: "coordinate_dictation" }));
}
```

In the `generateTasks` switch, add a case next to the existing `"graphic_dictation"` line:

```js
    case "coordinate_dictation":  return generateCoordinateDictationTasks(displayConcepts);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/topics/renderers/flashcards/engine.test.js`
Expected: PASS — all tests in the file, including the new one and the pre-existing `mirror_draw`/`repeat_draw`/`graphic_dictation` ones (unaffected by the added `c1` fixture card).

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/flashcards/engine.js src/topics/renderers/flashcards/engine.test.js
git commit -m "feat(engine): generate tasks for coordinate_dictation mode"
```

---

## Task 3: Scope concept picker to `taskKind: "coordinate"` for the new mode

**Files:**
- Modify: `src/shared/utils/topicUtils.js:26-30`
- Test: `src/shared/utils/topicUtils.test.js:64-86`

**Interfaces:**
- Consumes: nothing new — extends the existing `TASK_KIND_BY_MODE_TYPE` lookup table used by `getConceptCards`.
- Produces: `getConceptCards(topicRecord, { type: "coordinate_dictation" })` now returns only `taskKind: "coordinate"` cards, matching the pattern already established for `mirror_draw`/`repeat_draw`/`graphic_dictation`.

- [ ] **Step 1: Write the failing test**

In `src/shared/utils/topicUtils.test.js`, extend `symmetryDrawRecord.cards` (lines 64-71) with a coordinate card, and add a new `it` after the `graphic_dictation` test (after line 86):

```js
  const symmetryDrawRecord = {
    meta: { renderer: "flashcards", customModesOnly: true },
    cards: [
      { id: "m1", conceptId: "m1", taskKind: "mirror" },
      { id: "r1", conceptId: "r1", taskKind: "repeat" },
      { id: "d1", conceptId: "d1", taskKind: "dictation" },
      { id: "c1", conceptId: "c1", taskKind: "coordinate" },
    ],
  };
```

```js
  it("scopes coordinate_dictation to taskKind:coordinate cards only", () => {
    const cards = getConceptCards(symmetryDrawRecord, { type: "coordinate_dictation" });
    expect(cards.map((c) => c.id)).toEqual(["c1"]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/utils/topicUtils.test.js`
Expected: FAIL — `TASK_KIND_BY_MODE_TYPE["coordinate_dictation"]` is `undefined`, so `getConceptCards` falls through to returning all 4 cards instead of just `["c1"]`.

- [ ] **Step 3: Implement**

In `src/shared/utils/topicUtils.js`, update the lookup table (lines 26-30):

```js
const TASK_KIND_BY_MODE_TYPE = {
  mirror_draw: "mirror",
  repeat_draw: "repeat",
  graphic_dictation: "dictation",
  coordinate_dictation: "coordinate",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/utils/topicUtils.test.js`
Expected: PASS — all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/topicUtils.js src/shared/utils/topicUtils.test.js
git commit -m "feat(topicUtils): scope concept picker to coordinate_dictation mode"
```

---

## Task 4: Generalize `DictationTask` in `renderer.js` for coordinate steps

**Files:**
- Modify: `tools/symmetry_draw/renderer.js`

**Interfaces:**
- Consumes: `task.card.taskKind` (`"dictation"` or `"coordinate"`), `task.card.start`, `task.card.commands` (dictation cards) or `task.card.points` (coordinate cards) — all already defined by the Task 6 content and the existing dictation card shape.
- Produces: `window.__MirocardRenderer` now also routes `task.type === "coordinate_dictation"` to `DictationTask`, matching how `"graphic_dictation"` already does.

There is no automated test harness for this file (it's a raw browser script with no DOM/React test runner wired up in this repo) — `node --check` catches syntax errors; full behavior is verified manually in Task 7.

- [ ] **Step 1: Add `columnLabel` and step-building helpers**

In `tools/symmetry_draw/renderer.js`, insert the following new top-level helpers directly above the `function DictationTask({ task, onCorrect }) {` line (currently line 140):

```js
  // Battleship-style column letters used only when shape.taskKind === "coordinate".
  // Skips Ё and Й (pronunciation/visual ambiguity). Duplicated from
  // tools/symmetry_draw/column_label.mjs — this file ships as a raw browser
  // script inside the topic ZIP (no bundler pass, no imports), same reason
  // DIRECTION/commandsToPath are duplicated between verify_trace.mjs and here.
  const COORDINATE_COLUMN_LETTERS = [
    "А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н",
    "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ",
    "Ы", "Ь", "Э", "Ю", "Я",
  ];

  function columnLabel(col) {
    return COORDINATE_COLUMN_LETTERS[col] ?? `?${col}`;
  }

  function coordinateText(point) {
    return `Найди точку ${columnLabel(point.col)}${point.row + 1}`;
  }

  function coordinateSpeech(point) {
    return `Точка ${columnLabel(point.col)}, ${point.row + 1}`;
  }

  // Reduces either a dictation card's `commands` (relative direction+cells,
  // walked cumulatively from `start`) or a coordinate card's `points`
  // (already-absolute targets) to the same step shape, so the rest of
  // DictationTask doesn't need to know which taskKind produced it.
  function buildSteps(shape) {
    if (shape.taskKind === "coordinate") {
      return (shape.points ?? []).map((point) => ({
        end: point,
        text: coordinateText(point),
        speech: coordinateSpeech(point),
      }));
    }
    let current = shape.start;
    return (shape.commands ?? []).map((command) => {
      const end = commandEnd(current, command);
      current = end;
      return { end, text: commandText(command), speech: commandText(command), direction: command.direction };
    });
  }
```

- [ ] **Step 2: Simplify `isCorrectMove` to take a resolved endpoint**

Replace (currently lines 130-134):

```js
  function isCorrectMove(points, start, command) {
    const end = commandEnd(start, command);
    if (points.length < 2 || distance(points[0], start) > 0.55 || distance(points.at(-1), end) > 0.55) return false;
    return points.every((point) => distanceToSegment(point, start, end) <= 0.8);
  }
```

with:

```js
  function isCorrectMove(points, start, end) {
    if (points.length < 2 || distance(points[0], start) > 0.55 || distance(points.at(-1), end) > 0.55) return false;
    return points.every((point) => distanceToSegment(point, start, end) <= 0.8);
  }
```

- [ ] **Step 3: Replace the `DictationTask` function body**

Replace the entire `DictationTask` function (currently lines 140-293, from `function DictationTask({ task, onCorrect }) {` through its closing `}`) with:

```js
  function DictationTask({ task, onCorrect }) {
    const svgRef = useRef(null);
    const drawingRef = useRef(false);
    const gestureRef = useRef([]);
    const shape = task.card;
    const steps = useMemo(() => buildSteps(shape), [shape]);
    const [activePoint, setActivePoint] = useState(shape.start);
    const [stepIndex, setStepIndex] = useState(0);
    const [completed, setCompleted] = useState([]);
    const [preview, setPreview] = useState(null);
    const [showTargetHint, setShowTargetHint] = useState(false);
    const [notice, setNotice] = useState("");
    const [finished, setFinished] = useState(false);
    const isCoordinate = shape.taskKind === "coordinate";
    const step = steps[stepIndex];
    const columns = Number(shape.columns ?? 10);
    const rows = Number(shape.rows ?? 10);
    const target = step ? step.end : null;

    function localPoint(event) {
      const svg = svgRef.current;
      if (!svg) return null;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const local = point.matrixTransform(ctm.inverse());
      if (local.x < -0.45 || local.x > columns + 0.45 || local.y < -0.45 || local.y > rows + 0.45) return null;
      return { col: Math.max(0, Math.min(columns, local.x)), row: Math.max(0, Math.min(rows, local.y)) };
    }

    function speakInstruction() {
      if (!step || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(step.speech);
      utterance.lang = "ru-RU";
      window.speechSynthesis.speak(utterance);
    }

    function startGesture(event) {
      if (finished || !step) return;
      event.preventDefault();
      const point = localPoint(event);
      if (!point) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drawingRef.current = true;
      gestureRef.current = [point];
      setPreview([point]);
      setNotice("");
    }

    function moveGesture(event) {
      if (!drawingRef.current) return;
      event.preventDefault();
      const point = localPoint(event);
      if (!point) return;
      const last = gestureRef.current.at(-1);
      if (last && distance(last, point) < 0.03) return;
      gestureRef.current = [...gestureRef.current, point];
      setPreview(gestureRef.current);
    }

    function finishGesture(event) {
      if (!drawingRef.current || !step) return;
      drawingRef.current = false;
      if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const points = gestureRef.current;
      const correct = isCorrectMove(points, activePoint, step.end);
      if (!correct) {
        setPreview(null);
        setNotice("Попробуй ещё раз. Начни с активной точки.");
        return;
      }
      setCompleted((lines) => [...lines, { start: activePoint, end: step.end }]);
      setActivePoint(step.end);
      setPreview(null);
      setShowTargetHint(false);
      setNotice("");
      if (stepIndex + 1 >= steps.length) {
        setFinished(true);
        setTimeout(() => onCorrect?.(task.conceptId, shape.id), 650);
      } else {
        setStepIndex((index) => index + 1);
      }
    }

    function useHint() {
      setShowTargetHint(true);
    }

    const grid = [];
    const dots = [];
    const coordinates = [];
    for (let col = 0; col <= columns; col += 1) {
      grid.push(h("line", { key: `v-${col}`, className: "dictation__grid-line", x1: col, y1: 0, x2: col, y2: rows }));
      coordinates.push(h("text", { key: `col-${col}`, className: "dictation__coordinate", x: col, y: "-0.31", textAnchor: "middle" }, isCoordinate ? columnLabel(col) : col + 1));
      for (let row = 0; row <= rows; row += 1) dots.push(h("circle", { key: `p-${col}-${row}`, className: "dictation__grid-dot", cx: col, cy: row, r: "0.05" }));
    }
    for (let row = 0; row <= rows; row += 1) {
      grid.push(h("line", { key: `h-${row}`, className: "dictation__grid-line", x1: 0, y1: row, x2: columns, y2: row }));
      coordinates.push(h("text", { key: `row-${row}`, className: "dictation__coordinate", x: "-0.33", y: row + 0.08, textAnchor: "middle" }, row + 1));
    }

    const decorations = (shape.decorations ?? []).map((decoration, index) => {
      if (decoration.type === "rect") {
        return h("rect", { key: `deco-${index}`, className: "dictation__decoration-rect", x: decoration.col, y: decoration.row, width: decoration.width ?? 1, height: decoration.height ?? 1 });
      }
      if (decoration.type === "polygon") {
        return h("path", { key: `deco-${index}`, className: "dictation__decoration-rect", d: `${pathToD(decoration.points)} Z` });
      }
      return h("circle", { key: `deco-${index}`, className: "dictation__decoration-dot", cx: decoration.col, cy: decoration.row, r: "0.12" });
    }
    );

    const previewEnd = preview?.at(-1)
      ? { col: Math.max(0, Math.min(columns, Math.round(preview.at(-1).col))), row: Math.max(0, Math.min(rows, Math.round(preview.at(-1).row))) }
      : null;
    const previewPath = preview?.length > 1 ? `M ${activePoint.col} ${activePoint.row} L ${previewEnd.col} ${previewEnd.row}` : null;

    return h("section", { className: "dictation", "aria-label": isCoordinate ? "Точки по координатам" : "Графический диктант" },
      h("div", { className: "dictation__command" },
        step?.direction ? h("div", { className: "dictation__arrow-wrap" }, h(InstructionGraphic, { command: { direction: step.direction } })) : null,
        h("div", { className: "dictation__command-copy" },
          h("div", { className: "dictation__text" }, finished ? `Получился рисунок: ${shape.label}` : step?.text ?? ""),
        ),
        !finished ? h("button", { type: "button", className: "dictation__repeat", onClick: speakInstruction, "aria-label": "Повторить инструкцию", title: "Повторить инструкцию" }, "↻") : null,
      ),
      h("div", { className: "dictation__canvas" },
        h("svg", { ref: svgRef, className: "dictation__grid", viewBox: `-0.55 -0.78 ${columns + 1.1} ${rows + 1.58}`, onPointerDown: startGesture, onPointerMove: moveGesture, onPointerUp: finishGesture, onPointerCancel: finishGesture, onPointerLeave: finishGesture },
          h("rect", { className: "dictation__paper", x: "-0.5", y: "-0.72", width: columns + 1, height: rows + 1.45, rx: "0.12" }),
          grid,
          coordinates,
          dots,
          decorations,
          completed.map((line, index) => h("line", { key: `fixed-${index}`, className: "dictation__fixed", x1: line.start.col, y1: line.start.row, x2: line.end.col, y2: line.end.row })),
          previewPath ? h("path", { className: "dictation__preview", d: previewPath }) : null,
          showTargetHint && target ? h("circle", { className: "dictation__target", cx: target.col, cy: target.row, r: "0.18" },
            h("animate", { attributeName: "r", values: "0.18;0.27;0.18", dur: "1s", repeatCount: "indefinite" }),
            h("animate", { attributeName: "opacity", values: "1;0.6;1", dur: "1s", repeatCount: "indefinite" }),
          ) : null,
          !finished ? h("circle", { className: "dictation__active", cx: activePoint.col, cy: activePoint.row, r: "0.15" },
            h("animate", { attributeName: "r", values: "0.15;0.25;0.15", dur: "1.2s", repeatCount: "indefinite" }),
            h("animate", { attributeName: "opacity", values: "1;0.58;1", dur: "1.2s", repeatCount: "indefinite" }),
          ) : null,
        ),
      ),
      !finished ? h("div", { className: "dictation__helpers" },
        h("button", { type: "button", className: "dictation__hint", onClick: useHint, "aria-pressed": showTargetHint }, "● Показать точку"),
        h("span", { className: "dictation__hint-text" }, showTargetHint ? "Жёлтая точка — конец линии." : "Подсветит конечный узел."),
      ) : h("p", { className: "dictation__done" }, `Готово: ${shape.label}`),
      notice ? h("p", { className: "dictation__notice", "aria-live": "polite" }, notice) : null,
    );
  }
```

Note what changed from the original: `command`/`commandEnd(activePoint, command)` calls are replaced by the pre-resolved `step`/`step.end`; `completed` entries now store `{ start, end }` instead of `{ start, command }` (so the fixed-line render no longer needs `commandEnd` at all); the arrow icon and column headers are now conditional on `step.direction` / `isCoordinate` respectively; the aria-label switches by mode.

- [ ] **Step 4: Route `coordinate_dictation` tasks to `DictationTask`**

Replace the file's final export (currently lines 445-447):

```js
  window.__MirocardRenderer = function SymmetryDrawRenderer(props) {
    return props.task?.type === "graphic_dictation" ? h(DictationTask, props) : h(GridTask, props);
  };
```

with:

```js
  window.__MirocardRenderer = function SymmetryDrawRenderer(props) {
    const isDictationLike = props.task?.type === "graphic_dictation" || props.task?.type === "coordinate_dictation";
    return isDictationLike ? h(DictationTask, props) : h(GridTask, props);
  };
```

- [ ] **Step 5: Syntax-check the file**

Run: `node --check tools/symmetry_draw/renderer.js`
Expected: no output, exit code 0 (this only catches syntax errors — functional correctness is verified in Task 7).

- [ ] **Step 6: Commit**

```bash
git add tools/symmetry_draw/renderer.js
git commit -m "feat(symmetry_draw): generalize DictationTask for coordinate steps"
```

---

## Task 5: Register the new mode in `topic.json`

**Files:**
- Modify: `tools/symmetry_draw/topic.json` (the `modes` array)

**Interfaces:**
- Produces: a `modes` entry with `id`/`type` `"coordinate_dictation"`, consumed by `ModePickerScreen`/`ParamsScreen` (existing generic mode-list rendering — no code changes needed there, they iterate `topic.meta`'s `modes` array already) and by Task 2's `generateTasks` switch and Task 3's `TASK_KIND_BY_MODE_TYPE`.

- [ ] **Step 1: Add the mode entry**

In `tools/symmetry_draw/topic.json`, the `modes` array currently ends with the `graphic_dictation` entry:

```json
    {
      "id": "graphic_dictation",
      "type": "graphic_dictation",
      "evaluation": "auto",
      "ui": {
        "title": "Графический диктант",
        "instruction": "Слушай команду и веди линию от активной точки",
        "icon": "media/dictation_avatar.svg"
      },
      "params": {
        "showArrow": {
          "type": "boolean",
          "default": true,
          "label": { "ru": "Стрелка в подсказке" },
          "hint": { "ru": "Выключите, чтобы ребёнок читал команду текстом, а не смотрел на значок" }
        }
      }
    }
  ],
```

Change the closing `}\n  ],` of that entry to add a new entry after it:

```json
    {
      "id": "graphic_dictation",
      "type": "graphic_dictation",
      "evaluation": "auto",
      "ui": {
        "title": "Графический диктант",
        "instruction": "Слушай команду и веди линию от активной точки",
        "icon": "media/dictation_avatar.svg"
      },
      "params": {
        "showArrow": {
          "type": "boolean",
          "default": true,
          "label": { "ru": "Стрелка в подсказке" },
          "hint": { "ru": "Выключите, чтобы ребёнок читал команду текстом, а не смотрел на значок" }
        }
      }
    },
    {
      "id": "coordinate_dictation",
      "type": "coordinate_dictation",
      "evaluation": "auto",
      "ui": {
        "title": "Точки по координатам",
        "instruction": "Найди точку по координатам и веди линию от активной точки",
        "icon": "media/dictation_avatar.svg"
      }
    }
  ],
```

- [ ] **Step 2: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('tools/symmetry_draw/topic.json', 'utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "feat(symmetry_draw): register coordinate_dictation mode"
```

---

## Task 6: Generate the 23 `coordinate_*` cards from existing dictation cards

**Files:**
- Create: `tools/symmetry_draw/generate_coordinate_cards.mjs`
- Modify: `tools/symmetry_draw/topic.json` (via running the script — its `cards` array grows by 23 entries)

**Interfaces:**
- Consumes: `commandsToPath(start, commands)` exported from `tools/symmetry_draw/verify_trace.mjs` (already exists, already tested — see `verify_trace.test.mjs`).
- Produces: 23 new cards, `id`/`conceptId` `coordinate_<name>` (mirroring each `dictation_<name>`'s suffix), `taskKind: "coordinate"`, `start` copied from the source card, `points` = the source card's commands walked to absolute coordinates (dropping the leading point that duplicates `start`).

- [ ] **Step 1: Write the script**

```js
// tools/symmetry_draw/generate_coordinate_cards.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { commandsToPath } from "./verify_trace.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const topicPath = join(dir, "topic.json");
const topic = JSON.parse(readFileSync(topicPath, "utf8"));

const dictationCards = topic.cards.filter((card) => card.taskKind === "dictation");

const coordinateCards = dictationCards.map((card) => {
  const path = commandsToPath(card.start, card.commands);
  const points = path.slice(1); // drop the leading point, which duplicates `start`
  const id = card.id.replace(/^dictation_/, "coordinate_");
  return {
    id,
    conceptId: id,
    primary: true,
    label: card.label,
    taskKind: "coordinate",
    columns: card.columns,
    rows: card.rows,
    start: card.start,
    points,
  };
});

const existingIds = new Set(topic.cards.map((card) => card.id));
const newCards = coordinateCards.filter((card) => !existingIds.has(card.id));
if (newCards.length !== coordinateCards.length) {
  console.log(`Skipped ${coordinateCards.length - newCards.length} card(s) that already exist.`);
}

topic.cards.push(...newCards);
writeFileSync(topicPath, `${JSON.stringify(topic, null, 2)}\n`, "utf8");
console.log(`Added ${newCards.length} coordinate card(s) to ${topicPath}`);
```

- [ ] **Step 2: Run the script**

Run: `node tools/symmetry_draw/generate_coordinate_cards.mjs`
Expected: `Added 23 coordinate card(s) to .../topic.json`

- [ ] **Step 3: Verify one card by hand**

Run: `node -e "const t = JSON.parse(require('fs').readFileSync('tools/symmetry_draw/topic.json','utf8')); console.log(JSON.stringify(t.cards.find(c => c.id === 'coordinate_house'), null, 2))"`

Expected output — `dictation_house`'s 6 commands (`up 4`, `right 3`, `up_right 2`, `down_right 2`, `down 4`, `left 7`) starting from `{col:2,row:7}` walk to exactly these 6 points:

```json
{
  "id": "coordinate_house",
  "conceptId": "coordinate_house",
  "primary": true,
  "label": "Дом",
  "taskKind": "coordinate",
  "columns": 11,
  "rows": 9,
  "start": { "col": 2, "row": 7 },
  "points": [
    { "col": 2, "row": 3 },
    { "col": 5, "row": 3 },
    { "col": 7, "row": 1 },
    { "col": 9, "row": 3 },
    { "col": 9, "row": 7 },
    { "col": 2, "row": 7 }
  ]
}
```

If this doesn't match, do not proceed — check `commandsToPath`'s direction deltas against `tools/symmetry_draw/verify_trace.mjs`'s `DIRECTION` map before re-running.

- [ ] **Step 4: Confirm total card count**

Run: `node -e "const t = JSON.parse(require('fs').readFileSync('tools/symmetry_draw/topic.json','utf8')); console.log(t.cards.length, t.cards.filter(c => c.taskKind === 'coordinate').length)"`
Expected: total card count is 23 more than before this task; the second number is `23`.

- [ ] **Step 5: Commit**

```bash
git add tools/symmetry_draw/generate_coordinate_cards.mjs tools/symmetry_draw/topic.json
git commit -m "feat(symmetry_draw): generate 23 coordinate cards from existing dictation cards"
```

---

## Task 7: Manual verification in the running app

**Files:** none (no code changes — this task is a live check before packaging)

Per project convention (headed Playwright, not headless — see project memory on this), verify interactively rather than relying only on the automated tests above, since `renderer.js` itself has no automated coverage.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite dev server starts on `http://localhost:8080` (or the configured port).

- [ ] **Step 2: Open the app and reach the new mode**

Using a headed browser (Playwright MCP tools or manual browser), navigate to the app, open the topic "Рисуем по клеткам", and select the new mode "Точки по координатам" from the mode picker.

- [ ] **Step 3: Verify the grid and instruction**

Confirm: column headers along the top read letters starting `А, Б, В, Г, Д, Е, Ж, З, И, К, Л…` (not numbers); row headers down the side stay numeric; the instruction text reads something like "Найди точку …" with a letter+digit coordinate (not a "N клеток вправо/влево" phrase); there is no arrow icon next to the instruction (unlike the `graphic_dictation` mode).

- [ ] **Step 4: Complete one step and one full card**

Drag (or tap-sequence) a line from the pulsing active point to the coordinate named in the instruction. Confirm: a correct line is accepted and the active point moves to that spot with a new instruction; an intentionally wrong line (drawn to the wrong coordinate) is rejected with the "Попробуй ещё раз…" notice. Finish an entire card and confirm the "Получился рисунок: …" completion copy appears, matching the dictation mode's completion behavior.

- [ ] **Step 5: Verify hint and speech**

Click "● Показать точку" and confirm the correct target pulses. Click the "↻" repeat-instruction button and confirm speech synthesis reads the coordinate aloud (e.g. "Точка Е, 3") without crashing if the browser lacks TTS support.

- [ ] **Step 6: Regression-check the untouched modes**

Switch to "Симметричный рисунок" and "Графический диктант" and confirm both still work exactly as before (column headers numeric, dictation instructions unchanged) — this is the regression guard for Task 4's shared-code refactor.

This task has no commit of its own — proceed to Task 8 once all checks pass. If any check fails, fix the relevant earlier task and re-run this verification before continuing.

---

## Task 8: Version bump, rebuild ZIP, update catalog

**Files:**
- Modify: `tools/symmetry_draw/topic.json` (`meta.version`)
- Modify: `public/decks/catalog.json` (the `symmetry_draw` entry)
- Create: `public/decks/symmetry_draw_v1.7.0.zip` (new file — do not overwrite `symmetry_draw_v1.6.0.zip` or any earlier version)

- [ ] **Step 1: Bump the topic version**

In `tools/symmetry_draw/topic.json`, change `"meta": { "id": "symmetry_draw", "version": "1.6.0", ...` to `"version": "1.7.0"`.

- [ ] **Step 2: Rebuild the ZIP**

Run: `node tools/symmetry_draw/build.mjs`
Expected: `Built .../tools/symmetry_draw/symmetry_draw.zip`

- [ ] **Step 3: Copy the ZIP into `public/decks` under its versioned name**

Run: `cp tools/symmetry_draw/symmetry_draw.zip public/decks/symmetry_draw_v1.7.0.zip`
(PowerShell: `Copy-Item tools/symmetry_draw/symmetry_draw.zip public/decks/symmetry_draw_v1.7.0.zip`)

- [ ] **Step 4: Update the catalog entry**

In `public/decks/catalog.json`, change the `symmetry_draw` entry from:

```json
    {
      "id": "symmetry_draw",
      "version": "1.6.0",
      "url": "./decks/symmetry_draw_v1.6.0.zip",
      "zipUrl": "symmetry_draw_v1.6.0.zip",
      "title": {
        "ru": "Рисуем по клеткам"
      },
      "description": {
        "ru": "Симметрия, повтор и графический диктант на клетчатом поле."
      },
      "renderer": "flashcards",
      "status": "release",
      "access": "free"
```

to:

```json
    {
      "id": "symmetry_draw",
      "version": "1.7.0",
      "url": "./decks/symmetry_draw_v1.7.0.zip",
      "zipUrl": "symmetry_draw_v1.7.0.zip",
      "title": {
        "ru": "Рисуем по клеткам"
      },
      "description": {
        "ru": "Симметрия, повтор, графический диктант и точки по координатам на клетчатом поле."
      },
      "renderer": "flashcards",
      "status": "release",
      "access": "free"
```

- [ ] **Step 5: Verify old versions are untouched**

Run: `ls public/decks/symmetry_draw_v1.6.0.zip public/decks/symmetry_draw_v1.7.0.zip`
(PowerShell: `Get-ChildItem public/decks/symmetry_draw_v1.6.0.zip, public/decks/symmetry_draw_v1.7.0.zip`)
Expected: both files exist — the old version was never overwritten.

- [ ] **Step 6: Commit**

```bash
git add tools/symmetry_draw/topic.json public/decks/catalog.json public/decks/symmetry_draw_v1.7.0.zip
git commit -m "chore(symmetry_draw): release v1.7.0 with coordinate_dictation mode"
```

This is the last task in this plan. Deploying the built frontend to production (`npm run deploy:prod`) is a separate, explicit action outside this plan's scope — run it only when the user asks for it.

---

## Self-Review Notes

- **Spec coverage:** schema (`taskKind: "coordinate"`, `points`) → Task 6; mode registration → Task 5; renderer behavior (letter columns, coordinate instruction/speech, unchanged gesture/hint/finish flow, no print export) → Task 4; content sourced from existing cards with no new tracing → Task 6; concept-picker scoping (implied by the existing per-mode scoping pattern the spec's context assumes) → Task 3; versioning convention → Task 8; manual test plan from the spec → Task 7.
- **Placeholder scan:** no TBD/TODO markers; every step has concrete code or a concrete, runnable verification command with an expected result.
- **Type consistency:** `step` shape `{ end, text, speech, direction? }` is defined once in Task 4's `buildSteps` and used consistently through `DictationTask` (`step.end`, `step.text`, `step.speech`, `step.direction`); `isCorrectMove(points, start, end)`'s new signature is used consistently at its one call site in the same task.
