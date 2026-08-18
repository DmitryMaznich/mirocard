# Symmetry Draw Print/PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a parent pick a set of cards from any `symmetry_draw` mode (mirror/repeat/dictation) on the pre-session params screen and print them as A4 worksheets with honest square grid cells, via the browser's native print-to-PDF — no new dependency.

**Architecture:** A new `SymmetryDrawPrintParams` content component is wired into `ParamsScreen.jsx`'s existing per-topic dispatch (same pattern as `WrittenLettersPairParams`/`ComparisonParams`), showing a checkbox grid of the current mode's cards. Its "Скачать PDF" button portal-mounts a print-only `SymmetryDrawPrintView` into `document.body` and calls `window.print()`; `@media print` CSS hides the normal app (`#root`) and shows only the portal content, using millimeter units throughout so grid cells are physically square on paper regardless of print scaling. Cleans up via the `afterprint` event, the same signal `PlannerShoppingScreen.jsx`'s existing print flow already relies on (that precedent uses a separate `window.open()` tab with a hand-built HTML string; this feature instead keeps the print content as normal React JSX in the current document, scoped to print-only via CSS, because the content is data-driven SVG grids per selected card — far more maintainable as JSX than as string-templated HTML, and it avoids standing up a second React root in a new window).

**Tech Stack:** React (existing app, Vite-built `src/` tree — NOT the same pipeline as `tools/symmetry_draw/renderer.js`, which is a separately-built, eval'd-at-runtime IIFE with no ES module exports), Vitest for the new pure-geometry helpers, plain CSS with `@media print`/`@page`.

## Global Constraints

- No new PDF library (no jsPDF/pdf-lib) — the app's build is a single inlined HTML file (`vite-plugin-singlefile`), so this is a deliberate dependency-avoidance decision from the design spec, not an oversight.
- Grid cell size is fixed at **7mm**, not user-configurable. All print grid dimensions are `columns × 7mm` wide, `rows × 7mm` tall — millimeters, never px/vw, or cells will not be square.
- `tools/symmetry_draw/renderer.js`'s geometry helpers (`mirrorPaths`, `translatePaths`, `pathToD`, `DIRECTION`, `commandEnd`) cannot be imported into `src/` — that file lives outside the Vite build root and is a non-ES-module IIFE. This plan duplicates the small pure-function subset it needs into a new `src/`-side module; this is an intentional, acknowledged duplication (flag it in review, don't try to "fix" it by importing across the build boundary).
- `ParamsScreen.jsx`'s existing default "Начать занятие" (start session) button/flow for `symmetry_draw` must keep working exactly as today — the new content is an additional ternary arm for the params body, not a replacement of the screen shell or an early return.
- Print selection state is local UI state only, never persisted (resets every time the params screen mounts) — do not wire it into `persistStudentTopicLink`/`selectedConceptIds`.
- Branding: watermark text "Mironium", diagonal, ~6% opacity, color `#1C3634`. Footer: `public/brand/mironium-logo.svg` + tagline "Ваш ребёнок может больше · mironium.com", exact text, no other wording.
- The app mounts into `<div id="root">` (confirmed in `index.html:247`) — print CSS hides this element specifically, not a generic `body > *` selector.

---

### Task 1: Pure geometry helpers for print (`symmetryDrawGeometry.js`)

**Files:**
- Create: `src/features/session/symmetryDrawGeometry.js`
- Test: `src/features/session/symmetryDrawGeometry.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `DIRECTION` (object, 8 keys → `{col,row}` deltas), `commandEnd(start, command)` → `{col,row}`, `dictationPath(start, commands)` → `{col,row}[]` (full walked polyline, `start` included as the first point), `mirrorPaths(paths, axisCol)` → `{col,row}[][]`, `translatePaths(paths, axisCol)` → `{col,row}[][]`, `pathToD(points)` → SVG path `d` string (`"M x y L x y …"`). All consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

```js
// src/features/session/symmetryDrawGeometry.test.js
import { describe, it, expect } from "vitest";
import { dictationPath, mirrorPaths, translatePaths, pathToD, commandEnd } from "./symmetryDrawGeometry";

describe("commandEnd", () => {
  it("walks a single orthogonal move", () => {
    expect(commandEnd({ col: 2, row: 2 }, { direction: "right", cells: 3 })).toEqual({ col: 5, row: 2 });
  });
  it("walks a diagonal move", () => {
    expect(commandEnd({ col: 5, row: 5 }, { direction: "up_left", cells: 2 })).toEqual({ col: 3, row: 3 });
  });
});

describe("dictationPath", () => {
  it("builds the full polyline from start through all commands", () => {
    const points = dictationPath({ col: 1, row: 1 }, [
      { direction: "right", cells: 3 },
      { direction: "down", cells: 2 },
    ]);
    expect(points).toEqual([
      { col: 1, row: 1 },
      { col: 4, row: 1 },
      { col: 4, row: 3 },
    ]);
  });

  it("returns just the start point when there are no commands", () => {
    expect(dictationPath({ col: 0, row: 0 }, [])).toEqual([{ col: 0, row: 0 }]);
  });
});

describe("mirrorPaths", () => {
  it("reflects points across the axis column", () => {
    const result = mirrorPaths([[{ col: 2, row: 3 }, { col: 4, row: 5 }]], 5);
    expect(result).toEqual([[{ col: 8, row: 3 }, { col: 6, row: 5 }]]);
  });
  it("returns an empty array for undefined input", () => {
    expect(mirrorPaths(undefined, 5)).toEqual([]);
  });
});

describe("translatePaths", () => {
  it("shifts points right by the axis column", () => {
    const result = translatePaths([[{ col: 2, row: 3 }]], 5);
    expect(result).toEqual([[{ col: 7, row: 3 }]]);
  });
});

describe("pathToD", () => {
  it("builds an SVG path with M for the first point and L for the rest", () => {
    expect(pathToD([{ col: 1, row: 1 }, { col: 4, row: 1 }, { col: 4, row: 3 }])).toBe("M 1 1 L 4 1 L 4 3");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --dir src symmetryDrawGeometry.test.js`
Expected: FAIL — `src/features/session/symmetryDrawGeometry.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

```js
// src/features/session/symmetryDrawGeometry.js
// Duplicated (not imported) from tools/symmetry_draw/renderer.js — that file
// is a separately-built, eval'd-at-runtime IIFE outside the Vite build root
// with no ES module exports, so it cannot be imported from src/. Keep this
// file's logic in sync by hand if renderer.js's geometry ever changes.

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

export function commandEnd(start, command) {
  const direction = DIRECTION[command.direction];
  return { col: start.col + direction.col * command.cells, row: start.row + direction.row * command.cells };
}

export function dictationPath(start, commands) {
  const points = [{ col: start.col, row: start.row }];
  let current = { col: start.col, row: start.row };
  for (const command of commands) {
    current = commandEnd(current, command);
    points.push(current);
  }
  return points;
}

export function mirrorPaths(paths, axisCol) {
  return (paths ?? []).map((path) => path.map((point) => ({ col: 2 * axisCol - point.col, row: point.row })));
}

export function translatePaths(paths, axisCol) {
  return (paths ?? []).map((path) => path.map((point) => ({ col: point.col + axisCol, row: point.row })));
}

export function pathToD(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.col} ${point.row}`).join(" ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --dir src symmetryDrawGeometry.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/session/symmetryDrawGeometry.js src/features/session/symmetryDrawGeometry.test.js
git commit -m "feat(session): add symmetry_draw print geometry helpers"
```

---

### Task 2: Commit the Mironium brand logo as a source file

**Files:**
- Create: `public/brand/mironium-logo.svg`

**Interfaces:**
- Consumes: nothing.
- Produces: a static asset served at `/brand/mironium-logo.svg` at runtime, consumed by Task 3's `PageFooter`. Also fixes `mironium-prototype/index.html`'s and `mironium-prototype/{en,sl}/index.html`'s existing `<img src="../public/brand/mironium-logo.svg">` references, which currently resolve to nothing since this file has never been committed (it exists today only inside the gitignored `dist/` build output).

- [ ] **Step 1: Create the directory and write the file**

```bash
mkdir -p public/brand
```

Write `public/brand/mironium-logo.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 15 320 60" fill="none"><title>Mironium</title><g transform="translate(2 19) scale(.115)"><path d="M 98.0 0.0 L 376.0 0.0 L 401.0 5.0 L 401.0 7.0 L 388.0 12.0 L 382.0 20.0 L 379.0 17.0 L 369.0 15.0 L 342.0 24.0 L 319.0 23.0 L 291.0 29.0 L 291.0 31.0 L 297.0 29.0 L 313.0 29.0 L 313.0 31.0 L 279.0 41.0 L 229.0 67.0 L 219.0 67.0 L 209.0 61.0 L 215.0 69.0 L 233.0 71.0 L 245.0 67.0 L 265.0 55.0 L 268.0 56.0 L 247.0 71.0 L 204.0 88.0 L 198.0 96.0 L 196.0 112.0 L 200.0 102.0 L 209.0 93.0 L 219.0 91.0 L 206.0 102.0 L 199.0 125.0 L 188.0 136.0 L 200.0 132.0 L 194.0 142.0 L 193.0 151.0 L 201.0 143.0 L 198.0 156.0 L 203.0 167.0 L 206.0 148.0 L 209.0 147.0 L 207.0 151.0 L 209.0 155.0 L 216.0 150.0 L 213.0 159.0 L 214.0 200.0 L 212.0 206.0 L 196.0 224.0 L 176.0 236.0 L 171.0 245.0 L 173.0 255.0 L 191.0 273.0 L 190.0 284.0 L 185.0 289.0 L 186.0 296.0 L 197.0 303.0 L 198.0 310.0 L 209.0 311.0 L 213.0 309.0 L 215.0 311.0 L 212.0 316.0 L 199.0 317.0 L 194.0 322.0 L 195.0 331.0 L 202.0 338.0 L 204.0 344.0 L 203.0 365.0 L 205.0 375.0 L 214.0 386.0 L 224.0 390.0 L 274.0 390.0 L 294.0 396.0 L 304.0 406.0 L 311.0 421.0 L 316.0 440.0 L 92.0 440.0 L 75.0 435.0 L 54.0 422.0 L 42.0 408.0 L 35.0 395.0 L 30.0 374.0 L 31.0 61.0 L 40.0 36.0 L 59.0 15.0 L 77.0 5.0 Z" fill="#1C3634"/></g><text x="57" y="64" fill="#1C3634" font-family="'DM Serif Display', Georgia, serif" font-size="54" letter-spacing="-3">Mironi<tspan fill="#C18B22" font-size="58" font-style="italic" dx="-2">u</tspan><tspan dx="-2">m</tspan></text></svg>
```

- [ ] **Step 2: Verify it's valid SVG and matches the existing build output byte-for-byte**

```bash
node -e '
const fs = require("fs");
const a = fs.readFileSync("public/brand/mironium-logo.svg", "utf8").trim();
const b = fs.readFileSync("dist/brand/mironium-logo.svg", "utf8").trim();
console.log("matches dist build output:", a === b);
'
```

Expected: `matches dist build output: true`. (If `dist/brand/mironium-logo.svg` no longer exists in your checkout — it is gitignored build output and may have been cleaned — skip this diff check; the file written in Step 1 is still correct on its own.)

- [ ] **Step 3: Commit**

```bash
git add public/brand/mironium-logo.svg
git commit -m "chore(brand): commit Mironium logo SVG as a source file"
```

---

### Task 3: Print-only rendering component (`SymmetryDrawPrintView`)

**Files:**
- Create: `src/features/session/SymmetryDrawPrintView.jsx`
- Create: `src/features/session/SymmetryDrawPrintView.css`

**Interfaces:**
- Consumes: `dictationPath`, `mirrorPaths`, `translatePaths`, `pathToD` from Task 1's `./symmetryDrawGeometry`; `public/brand/mironium-logo.svg` from Task 2 (referenced as `/brand/mironium-logo.svg`).
- Produces: `export default function SymmetryDrawPrintView({ cards, onDone })` — `cards` is an array of raw `symmetry_draw` card objects (each has `taskKind: "dictation" | "mirror" | "repeat"` plus the fields matching its kind: dictation → `id, label, columns, rows, start, commands, decorations?`; mirror/repeat → `id, label, columns, rows, axisCol, sourcePaths, taskKind`). `onDone` is called once after the browser's print flow finishes (whether printed or cancelled). Consumed by Task 4's `SymmetryDrawPrintParams`.

- [ ] **Step 1: Write the component**

```jsx
// src/features/session/SymmetryDrawPrintView.jsx
import { useEffect } from "react";
import { dictationPath, mirrorPaths, translatePaths, pathToD } from "./symmetryDrawGeometry";
import "./SymmetryDrawPrintView.css";

const ARROW_BY_DIRECTION = {
  up: "↑", down: "↓", left: "←", right: "→",
  up_right: "↗", down_right: "↘", up_left: "↖", down_left: "↙",
};

function decorationElement(decoration, index) {
  if (decoration.type === "rect") {
    return <rect key={index} className="sdp-deco" x={decoration.col} y={decoration.row} width={decoration.width ?? 1} height={decoration.height ?? 1} />;
  }
  if (decoration.type === "polygon") {
    return <path key={index} className="sdp-deco" d={`${pathToD(decoration.points)} Z`} />;
  }
  return <circle key={index} className="sdp-deco-dot" cx={decoration.col} cy={decoration.row} r={0.14} />;
}

function GridLines({ columns, rows }) {
  const lines = [];
  for (let c = 0; c <= columns; c += 1) {
    lines.push(<line key={`v${c}`} className="sdp-grid-line" x1={c} y1={0} x2={c} y2={rows} />);
  }
  for (let r = 0; r <= rows; r += 1) {
    lines.push(<line key={`h${r}`} className="sdp-grid-line" x1={0} y1={r} x2={columns} y2={r} />);
  }
  return lines;
}

function DictationThumb({ card }) {
  const points = dictationPath(card.start, card.commands);
  return (
    <svg className="sdp-thumb-svg" viewBox={`-0.5 -0.5 ${card.columns + 1} ${card.rows + 1}`}>
      <path className="sdp-thumb-path" d={pathToD(points)} />
      {(card.decorations ?? []).map(decorationElement)}
    </svg>
  );
}

function DictationPage({ card }) {
  return (
    <section className="sdp-page sdp-page--dictation">
      <h2 className="sdp-title">{card.label}</h2>
      <div className="sdp-dict-top">
        <div className="sdp-dict-thumb"><DictationThumb card={card} /></div>
        <div className="sdp-dict-instructions">
          {card.commands.map((command, index) => (
            <span key={index} className="sdp-instr">{command.cells}{ARROW_BY_DIRECTION[command.direction]}</span>
          ))}
        </div>
      </div>
      <div className="sdp-dict-grid" style={{ "--sdp-cols": card.columns, "--sdp-rows": card.rows }}>
        <svg viewBox={`0 0 ${card.columns} ${card.rows}`} preserveAspectRatio="xMinYMin meet">
          <GridLines columns={card.columns} rows={card.rows} />
          <circle className="sdp-start-dot" cx={card.start.col} cy={card.start.row} r={0.16} />
        </svg>
      </div>
    </section>
  );
}

function MirrorRepeatStrip({ card }) {
  const isRepeat = card.taskKind === "repeat";
  const targetPaths = isRepeat ? translatePaths(card.sourcePaths, card.axisCol) : mirrorPaths(card.sourcePaths, card.axisCol);
  return (
    <div className="sdp-strip">
      <div className="sdp-strip-thumb">
        <svg viewBox={`-0.5 -0.5 ${card.columns + 1} ${card.rows + 1}`}>
          {card.sourcePaths.map((path, i) => <path key={`s${i}`} className="sdp-thumb-path" d={pathToD(path)} />)}
          {targetPaths.map((path, i) => <path key={`t${i}`} className="sdp-thumb-path" d={pathToD(path)} />)}
        </svg>
      </div>
      <div className="sdp-strip-grid" style={{ "--sdp-cols": card.columns, "--sdp-rows": card.rows }}>
        <svg viewBox={`0 0 ${card.columns} ${card.rows}`} preserveAspectRatio="xMinYMin meet">
          <GridLines columns={card.columns} rows={card.rows} />
          {card.sourcePaths.map((path, i) => <path key={i} className="sdp-source-path" d={pathToD(path)} />)}
          <line
            className={isRepeat ? "sdp-repeat-axis" : "sdp-mirror-axis"}
            x1={card.axisCol} y1={0.15} x2={card.axisCol} y2={card.rows - 0.15}
          />
        </svg>
      </div>
    </div>
  );
}

function Watermark() {
  const words = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="sdp-watermark" aria-hidden="true">
      {words.map((i) => <span key={i}>Mironium</span>)}
    </div>
  );
}

function PageFooter() {
  return (
    <div className="sdp-footer">
      <img src="/brand/mironium-logo.svg" alt="Mironium" className="sdp-footer-logo" />
      <span className="sdp-footer-tag">Ваш ребёнок может больше · mironium.com</span>
    </div>
  );
}

export default function SymmetryDrawPrintView({ cards, onDone }) {
  useEffect(() => {
    function handleAfterPrint() {
      onDone();
    }
    window.addEventListener("afterprint", handleAfterPrint);
    const raf = requestAnimationFrame(() => window.print());
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      cancelAnimationFrame(raf);
    };
  }, [onDone]);

  const dictationCards = cards.filter((card) => card.taskKind === "dictation");
  const stripCards = cards.filter((card) => card.taskKind !== "dictation");

  return (
    <div className="sdp-root">
      <Watermark />
      {dictationCards.map((card) => <DictationPage key={card.id} card={card} />)}
      {stripCards.length > 0 && (
        <section className="sdp-page sdp-page--strips">
          {stripCards.map((card) => <MirrorRepeatStrip key={card.id} card={card} />)}
        </section>
      )}
      <PageFooter />
    </div>
  );
}
```

- [ ] **Step 2: Write the print CSS**

```css
/* src/features/session/SymmetryDrawPrintView.css */
.sdp-root { display: none; }

@media print {
  #root, #splash { display: none !important; }
  .sdp-root { display: block; }

  @page {
    size: A4 portrait;
    margin: 15mm 12mm 20mm 12mm;
  }

  .sdp-page {
    break-after: page;
    break-inside: avoid;
  }
  .sdp-page:last-child { break-after: auto; }

  .sdp-page--dictation {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sdp-title {
    font: 700 16pt "Nunito", sans-serif;
    color: #1e3a6e;
    text-align: center;
    margin: 0 0 4mm;
  }

  .sdp-dict-top {
    display: flex;
    gap: 6mm;
    align-items: flex-start;
    flex: 0 0 auto;
  }

  .sdp-dict-thumb {
    flex: 0 0 35mm;
    border: 0.4mm dashed #bbb;
    border-radius: 3mm;
    padding: 2mm;
  }
  .sdp-thumb-svg { width: 100%; display: block; }
  .sdp-thumb-path { fill: none; stroke: #1e3a6e; stroke-width: 0.12; }
  .sdp-deco { fill: none; stroke: #1e3a6e; stroke-width: 0.09; }
  .sdp-deco-dot { fill: #1e3a6e; }

  .sdp-dict-instructions {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 2mm 4mm;
    align-content: flex-start;
    border: 0.3mm solid #ccc;
    border-radius: 3mm;
    padding: 3mm;
  }
  .sdp-instr { font: 700 11pt "Nunito", sans-serif; color: #285da8; }

  .sdp-dict-grid, .sdp-strip-grid {
    width: calc(var(--sdp-cols) * 7mm);
    height: calc(var(--sdp-rows) * 7mm);
    max-width: 100%;
  }
  .sdp-dict-grid { margin-top: 6mm; }
  .sdp-dict-grid svg, .sdp-strip-grid svg { width: 100%; height: 100%; display: block; }

  .sdp-grid-line { stroke: #bcd4ee; stroke-width: 1px; vector-effect: non-scaling-stroke; }
  .sdp-start-dot { fill: #2563eb; }
  .sdp-source-path { fill: none; stroke: #1e3a6e; stroke-width: 0.12; }
  .sdp-mirror-axis { stroke: #e8664f; stroke-width: 0.05; stroke-dasharray: 0.08 0.08; }
  .sdp-repeat-axis { stroke: #0d9488; stroke-width: 0.05; }

  .sdp-page--strips {
    display: flex;
    flex-direction: column;
    gap: 5mm;
  }
  .sdp-strip {
    display: flex;
    gap: 5mm;
    align-items: center;
    border: 0.3mm solid #ccc;
    border-radius: 3mm;
    padding: 3mm;
    break-inside: avoid;
  }
  .sdp-strip-thumb { flex: 0 0 25mm; }
  .sdp-strip-grid { flex: 0 0 auto; }

  .sdp-watermark {
    position: fixed;
    inset: 0;
    z-index: -1;
    display: flex;
    flex-wrap: wrap;
    align-content: space-evenly;
    justify-content: space-evenly;
    transform: rotate(-28deg) scale(1.4);
    opacity: 0.06;
    pointer-events: none;
  }
  .sdp-watermark span {
    font: italic 700 13pt Georgia, serif;
    color: #1C3634;
    white-space: nowrap;
    margin: 6mm 8mm;
  }

  .sdp-footer {
    position: fixed;
    bottom: 6mm;
    left: 12mm;
    right: 12mm;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3mm;
    border-top: 0.3mm solid #eee;
    padding-top: 2mm;
  }
  .sdp-footer-logo { height: 6mm; width: auto; }
  .sdp-footer-tag { font: 700 7pt "Nunito", sans-serif; color: #1C3634; letter-spacing: 0.02em; }
}
```

- [ ] **Step 3: Live browser check — structural verification**

Automating the OS print dialog itself isn't possible, so this step verifies everything up to the point `window.print()` is called: create a temporary harness, mount the component with fixture data, and inspect the DOM.

Create `src/features/session/_verify-print-view.html` (temporary — deleted in Step 5) is not applicable here since this is a real `src/` React component, not a standalone-eval'd renderer like `tools/symmetry_draw/renderer.js`. Instead, verify via the dev server:

1. Start the dev server (`preview_start` with name `mirocard-dev` per `.claude/launch.json`, or `npm run dev`).
2. Temporarily add a throwaway route/render call — in `src/main.jsx` or any already-mounted screen reachable in dev, temporarily render:

```jsx
import SymmetryDrawPrintView from "@/features/session/SymmetryDrawPrintView";

// temporary, for verification only — remove before Step 4
const fixtureCards = [
  {
    id: "dictation_test", taskKind: "dictation", label: "Тест",
    columns: 10, rows: 8, start: { col: 2, row: 2 },
    commands: [{ direction: "right", cells: 3 }, { direction: "down", cells: 2 }],
    decorations: [{ type: "dot", col: 6, row: 3 }],
  },
  {
    id: "mirror_test", taskKind: "mirror", label: "Дом",
    columns: 10, rows: 8, axisCol: 5,
    sourcePaths: [[{ col: 5, row: 1 }, { col: 3, row: 3 }, { col: 3, row: 7 }, { col: 5, row: 7 }]],
  },
];
// mount: <SymmetryDrawPrintView cards={fixtureCards} onDone={() => console.log("done")} />
```

3. In the Browser pane, before triggering an actual print (which would block on the OS dialog in automation), inspect via `javascript_tool`:

```js
document.querySelectorAll('.sdp-page').length // expect 2 (1 dictation page + 1 strips page)
document.querySelector('.sdp-title')?.textContent // expect "Тест"
document.querySelectorAll('.sdp-instr').length // expect 2 ("3→", "2↓")
document.querySelector('.sdp-deco-dot')?.getAttribute('cx') // expect "6"
getComputedStyle(document.querySelector('.sdp-dict-grid')).getPropertyValue('--sdp-cols') // expect "10"
document.querySelector('.sdp-footer-logo')?.getAttribute('src') // expect "/brand/mironium-logo.svg"
document.querySelectorAll('.sdp-watermark span').length // expect 24
```

Expected: all values match. Note this check runs with the component visible (not gated by the `@media print` CSS, since we're inspecting outside of an actual print), which is fine for structural verification — the `display:none` default only matters for what a human sees on screen, not for `querySelector`.

4. Remove the temporary mount/import from wherever it was added in step 2 before moving on — this was verification scaffolding, not part of the shipped feature (the real mount point is Task 4/5).

- [ ] **Step 4: Commit**

```bash
git add src/features/session/SymmetryDrawPrintView.jsx src/features/session/SymmetryDrawPrintView.css
git commit -m "feat(session): add SymmetryDrawPrintView print-only renderer"
```

---

### Task 4: Selection UI (`SymmetryDrawPrintParams`)

**Files:**
- Create: `src/features/session/SymmetryDrawPrintParams.jsx`
- Create: `src/features/session/SymmetryDrawPrintParams.css`

**Interfaces:**
- Consumes: `deriveConcepts`, `getConceptCards` from `@/shared/utils/topicUtils` (existing, already filter by the mode's `taskKind` — `getConceptCards(topicRecord, mode)` returns only cards matching `mode.type`'s `taskKind`); `Button` from `@/shared/components/Button` (existing, used as `<Button fullWidth disabled={...} onClick={...}>label</Button>`); `SymmetryDrawPrintView` from Task 3.
- Produces: `export default function SymmetryDrawPrintParams({ topicRecord, mode })`. Consumed by Task 5's `ParamsScreen.jsx`.

- [ ] **Step 1: Write the component**

```jsx
// src/features/session/SymmetryDrawPrintParams.jsx
import { useState } from "react";
import { createPortal } from "react-dom";
import { deriveConcepts, getConceptCards } from "@/shared/utils/topicUtils";
import Button from "@/shared/components/Button";
import SymmetryDrawPrintView from "./SymmetryDrawPrintView";
import "./SymmetryDrawPrintParams.css";

export default function SymmetryDrawPrintParams({ topicRecord, mode }) {
  const concepts = deriveConcepts(getConceptCards(topicRecord, mode));
  const [selected, setSelected] = useState(new Set());
  const [printCards, setPrintCards] = useState(null);

  function toggle(cardId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  const allSelected = concepts.length > 0 && concepts.every((concept) => selected.has(concept.primary.id));

  function selectAll() {
    setSelected(new Set(concepts.map((concept) => concept.primary.id)));
  }
  function selectNone() {
    setSelected(new Set());
  }

  function downloadPdf() {
    const chosen = concepts
      .filter((concept) => selected.has(concept.primary.id))
      .map((concept) => concept.primary);
    setPrintCards(chosen);
  }

  return (
    <div className="sdpp-root">
      <div className="sdpp-header">
        <span className="sdpp-count">Выбрано: {selected.size}</span>
        <button type="button" className="sdpp-select-toggle" onClick={allSelected ? selectNone : selectAll}>
          {allSelected ? "Снять всё" : "Выбрать всё"}
        </button>
      </div>
      <div className="sdpp-grid">
        {concepts.map((concept) => {
          const card = concept.primary;
          const isSelected = selected.has(card.id);
          return (
            <button
              type="button"
              key={card.id}
              className={`sdpp-card${isSelected ? " sdpp-card--selected" : ""}`}
              onClick={() => toggle(card.id)}
            >
              <span className="sdpp-card-label">{card.label}</span>
            </button>
          );
        })}
      </div>
      <Button fullWidth disabled={selected.size === 0} onClick={downloadPdf}>
        Скачать PDF ({selected.size})
      </Button>
      {printCards && createPortal(
        <SymmetryDrawPrintView cards={printCards} onDone={() => setPrintCards(null)} />,
        document.body
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the selection-grid CSS**

```css
/* src/features/session/SymmetryDrawPrintParams.css */
.sdpp-root { padding: 12px 0; }

.sdpp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.sdpp-count { font: 700 14px/1.2 Nunito, sans-serif; color: #1e3a6e; }
.sdpp-select-toggle {
  border: 1px solid #cbd9ea;
  border-radius: 9px;
  background: #fff;
  color: #285da8;
  font: 700 13px/1 Nunito, sans-serif;
  padding: 7px 12px;
  cursor: pointer;
}
.sdpp-select-toggle:hover { background: #f3f7fd; }

.sdpp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}
.sdpp-card {
  border: 2px solid #e3e9f4;
  border-radius: 12px;
  background: #fff;
  padding: 10px;
  min-height: 44px;
  cursor: pointer;
  text-align: center;
}
.sdpp-card--selected {
  border-color: #2563eb;
  background: #eef4ff;
}
.sdpp-card-label { font: 700 13px/1.3 Nunito, sans-serif; color: #1e3a6e; }
```

- [ ] **Step 3: Live browser check**

Using the same dev-server + temporary-mount technique as Task 3 Step 3, mount `<SymmetryDrawPrintParams topicRecord={fixtureTopicRecord} mode={{ type: "graphic_dictation" }} />` where `fixtureTopicRecord.cards` includes at least 2 cards with `taskKind: "dictation"`. Confirm:
- `document.querySelectorAll('.sdpp-card').length` matches the fixture card count.
- Clicking a `.sdpp-card` toggles `.sdpp-card--selected` and updates `.sdpp-count`'s text.
- The "Скачать PDF" button (`Button` renders as a native `<button>`) is `disabled` when `.sdpp-count` reads "Выбрано: 0", and enabled after selecting one card.
- Clicking "Скачать PDF" causes `document.querySelector('.sdp-root')` to appear in the DOM (the portal mounted) — do this check in a way that doesn't actually block on `window.print()`'s OS dialog if running in an automated harness; if the dialog does appear, cancel it and confirm `afterprint` still eventually fires by checking `.sdp-root` is removed from the DOM afterward.

Remove the temporary mount before moving on, same as Task 3 Step 3.4.

- [ ] **Step 4: Commit**

```bash
git add src/features/session/SymmetryDrawPrintParams.jsx src/features/session/SymmetryDrawPrintParams.css
git commit -m "feat(session): add SymmetryDrawPrintParams card-selection UI"
```

---

### Task 5: Wire into `ParamsScreen.jsx`

**Files:**
- Modify: `src/features/session/ParamsScreen.jsx`

**Interfaces:**
- Consumes: `SymmetryDrawPrintParams` from Task 4 (`./SymmetryDrawPrintParams`); `topicRecord` and `mode`, both already computed as local variables earlier in `ParamsScreen` (see Global Constraints/research — `topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId)`, `mode = topicRecord?.modes.find((m) => m.id === activeModeId)`).
- Produces: `symmetry_draw`'s params screen now shows the card-selection + PDF UI above the existing default "Начать занятие" button, without altering that button's behavior.

- [ ] **Step 1: Add the import**

In `src/features/session/ParamsScreen.jsx`, find the existing content-component imports:

```js
import WrittenLettersPairParams from "@/topics/renderers/written_letters/WrittenLettersPairParams";
```

Add right after it:

```js
import WrittenLettersPairParams from "@/topics/renderers/written_letters/WrittenLettersPairParams";
import SymmetryDrawPrintParams from "@/features/session/SymmetryDrawPrintParams";
```

- [ ] **Step 2: Add the topic-detection flag**

Find the existing `is<X>` boolean block:

```js
const isWrittenLettersPair  = topicRecord?.meta.renderer === "written_letters" && activeModeId === "match_pair";
const isAlphabetPairs       = topicRecord?.meta.renderer === "written_letters" && activeModeId === "alphabet_pairs";
```

Add right after it:

```js
const isWrittenLettersPair  = topicRecord?.meta.renderer === "written_letters" && activeModeId === "match_pair";
const isAlphabetPairs       = topicRecord?.meta.renderer === "written_letters" && activeModeId === "alphabet_pairs";
const isSymmetryDrawPrint   = activeTopicId === "symmetry_draw";
```

(Keyed on the topic id, not `meta.renderer` — `symmetry_draw`'s `meta.renderer` is `"flashcards"` with `customModesOnly: true`, shared with many unrelated topics, so the topic id is the only thing that uniquely identifies it here.)

- [ ] **Step 3: Add the ternary arm**

The `paramsContent` ternary has an arm shaped exactly like this (locate it by searching for the unique string `isComparison ? (` — do not touch the `isReading` or final default arms, which are large and irrelevant to this change):

```js
) : isComparison ? (
  <ComparisonParams params={params} onChange={setParams} />
) : (
```

Insert a new arm between the `isComparison` arm and the final `) : (` that opens the default branch:

```js
) : isComparison ? (
  <ComparisonParams params={params} onChange={setParams} />
) : isSymmetryDrawPrint ? (
  <SymmetryDrawPrintParams topicRecord={topicRecord} mode={mode} />
) : (
```

Everything else in the ternary (the `isReading` arm above, and the default branch's body after this `) : (`) stays exactly as it is — this change only inserts one new `cond ? (jsx) :` segment into the existing chain.

- [ ] **Step 4: Live browser check — default start flow untouched**

Using the dev server, navigate to any topic that is *not* `symmetry_draw` (e.g. an existing recipe or comparison topic) and confirm its params screen and "Начать занятие" button still work exactly as before — this confirms the new ternary arm didn't disturb the default branch or the other named branches (`isReading`, `isWrittenLettersPair`, `isComparison`), since they're all still evaluated in the same `if`/ternary chain above the new arm.

- [ ] **Step 5: Live browser check — symmetry_draw shows the new UI**

Navigate to the `symmetry_draw` topic's mode picker, choose each of the 3 modes in turn (`mirror_draw`, `repeat_draw`, `graphic_dictation`), and confirm on each params screen:
- `SymmetryDrawPrintParams`'s card grid appears, showing only that mode's cards (mirror mode shows only `taskKind: "mirror"` cards, etc. — cross-check the count against `node -e 'console.log(require("./tools/symmetry_draw/topic.json").cards.filter(c=>c.taskKind==="mirror").length)'` for the mirror case, and similarly for `"repeat"`/`"dictation"`).
- The existing "Начать занятие" button is still present and still starts a normal session when clicked (unaffected by the new component sitting above it).

- [ ] **Step 6: Commit**

```bash
git add src/features/session/ParamsScreen.jsx
git commit -m "feat(session): wire SymmetryDrawPrintParams into ParamsScreen for symmetry_draw"
```

---

### Task 6: End-to-end verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full relevant test suite**

```bash
npx vitest run --dir src symmetryDrawGeometry.test.js topicLoader.test.js
```

Expected: all pass except the already-known pre-existing unrelated `addition_subtraction` mode-order failure in `topicLoader.test.js` (confirmed pre-existing on `main` before this feature, unrelated to `symmetry_draw` — do not attempt to fix it as part of this feature).

- [ ] **Step 2: Live browser check — pick cards and open the print dialog for real, in each mode**

For each of the 3 modes:
1. Navigate to `symmetry_draw`'s params screen for that mode.
2. Select 2–3 cards (for `graphic_dictation`, select cards including at least one with `decorations` — e.g. `dictation_pig` — to confirm decorations show on the preview thumb only).
3. Click "Скачать PDF".
4. In the browser's print preview (this part is a manual visual check — the OS print dialog itself cannot be scripted): confirm —
   - `graphic_dictation`: one page per selected card, title = figure name, small finished-figure preview (with decorations) on the left, arrow+number instruction list on the right, large blank grid below with only a start-point dot (no drawn line, no decorations).
   - `mirror_draw`/`repeat_draw`: all selected cards flow onto as many pages as needed, each as a compact strip (preview + half-drawn grid + dashed axis for mirror / solid arrow-marked line for repeat).
   - Grid cells read as visually square (not stretched) at any zoom level in the print preview.
   - A faint diagonal "Mironium" watermark is visible across the page.
   - The Mironium logo + "Ваш ребёнок может больше · mironium.com" footer appears at the bottom of every page.
5. Cancel the print dialog (don't actually print/save, unless you want a physical/PDF copy for your own visual sanity check) and confirm the app returns to normal (the `SymmetryDrawPrintParams` screen, still showing your selection, still usable) — this confirms `afterprint` cleanup ran even on cancel.

- [ ] **Step 3: Report results to the user**

Summarize pass/fail for each check above, and note whether Step 2's manual print-preview inspection matched the approved mockups. If everything passes, the feature is complete.
