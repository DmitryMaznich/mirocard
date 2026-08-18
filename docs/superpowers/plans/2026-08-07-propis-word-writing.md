# Написание слов Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Написание слов" mode to the `propis` topic that auto-assembles and loop-animates a whole-word handwriting trajectory from individually hand-captured letters plus a small library of connector strokes.

**Architecture:** A pure, framework-free `wordEngine.js` classifies each letter's entry/exit point against the same 7 numbered ruling lines already drawn in the capture tool, then stitches letters (translated into fixed-width slots) together with either an algorithmic straight bridge (same-line transitions) or a hand-captured, horizontally-rescaled connector (different-line transitions). A new `WriteWordsView` screen (word input + case toggle + alphabet keyboard, all reusing `PropisPracticeView`'s existing UI patterns) feeds typed words through this engine and plays the result with the same stroke-by-stroke looping SVG animation already used for single letters, extracted into a shared hook so both consumers share one implementation.

**Tech Stack:** React 19, Vitest, plain SVG path strings (M/C commands only), vanilla JS (capture tool has no build step).

## Global Constraints

- Letter source is exclusively hand-captured strokes from `tools/letter_capture/handwriting_capture.html` → `tools/propis/topic.json`, never the font-derived `written_letters/letterPaths.js` data.
- Release gate for the topic: all 33 letters must be captured before `write_words` ships to production. No "letter not captured" UI state is built — `wordEngine.buildWordTrajectory` throws instead, loud in dev, never silently degrades.
- Missing connectors (a needed line-transition with no hand-drawn shape yet) must never crash — fall back to the same straight-line bridge used for same-line transitions. This is a dev-time safety net, not a final-state feature; all connector types actually needed by the alphabet should be captured before release too.
- Ruling-line numbering (1–7) must stay byte-for-byte identical between `handwriting_capture.html`'s `drawRuling()` and the app's `propisRuling.js` — both are hand-maintained, not generated from one shared source, so any change to one must be mirrored in the other.
- Deviation from the design spec (`docs/superpowers/specs/2026-08-07-propis-word-writing-design.md`): that doc describes connectors as a new top-level `connectors[]` array in `topic.json`. This plan instead stores them **inside the existing `cards[]` array** with `"type": "connector"`, alongside the existing `"type": "letter"` cards. Reason: the app's session engine (`useSessionEngine.js`) only ever passes `topicRecord.cards` into a topic's `generateTasks()` — there is no plumbing to pass a second top-level array through. Putting connectors in `cards[]` (already a heterogeneous, extensible array by convention) needs zero changes outside the `propis` renderer's own files.
- Vitest tests use `import { describe, it, expect } from "vitest"` (globals enabled), environment `jsdom`. Path aliases: `@/` = `src/`.

---

## Task 1: propisRuling.js — shared numbered guide-line vocabulary

**Files:**
- Modify: `src/topics/renderers/propis/propisRuling.js`
- Test: `src/topics/renderers/propis/propisRuling.test.js` (create)

**Interfaces:**
- Produces: `NATIVE_L1`, `NATIVE_TOP_MID`, `NATIVE_L2`, `NATIVE_NARROW_MID`, `NATIVE_L3`, `NATIVE_BOT_MID`, `NATIVE_L4` (numbers, the capture tool's own coordinate system — deliberately distinct from this file's existing `L1`–`L4`, a different system), `GUIDE_LINES: Array<{ line: number, y: number }>` (7 entries, `line` 1–7 in increasing `y` order)

- [ ] **Step 1: Write the failing test**

```js
// src/topics/renderers/propis/propisRuling.test.js
import { describe, it, expect } from "vitest";
import { GUIDE_LINES, NATIVE_L1, NATIVE_L2, NATIVE_L3, NATIVE_L4, NATIVE_TOP_MID, NATIVE_BOT_MID, NATIVE_NARROW_MID, LETTER_BASELINE_UNIT } from "./propisRuling.js";

describe("GUIDE_LINES", () => {
  it("has 7 lines numbered 1-7 in strictly increasing y order", () => {
    expect(GUIDE_LINES.map((g) => g.line)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (let i = 1; i < GUIDE_LINES.length; i += 1) {
      expect(GUIDE_LINES[i].y).toBeGreaterThan(GUIDE_LINES[i - 1].y);
    }
  });

  it("matches the exact y values used in handwriting_capture.html's drawRuling()", () => {
    expect(NATIVE_L1).toBe(10);
    expect(NATIVE_TOP_MID).toBe(36);
    expect(NATIVE_L2).toBe(62);
    expect(NATIVE_NARROW_MID).toBe(75);
    expect(NATIVE_L3).toBe(88);
    expect(NATIVE_BOT_MID).toBe(110);
    expect(NATIVE_L4).toBe(140);
  });

  it("NATIVE_L3 is the same baseline value as the existing LETTER_BASELINE_UNIT constant", () => {
    // Both name "the baseline every captured stroke is drawn against", introduced from two
    // different call sites (LoopingLetterCell's re-anchoring vs wordEngine's classification).
    expect(NATIVE_L3).toBe(LETTER_BASELINE_UNIT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/topics/renderers/propis/propisRuling.test.js`
Expected: FAIL — `NATIVE_L1`/`NATIVE_TOP_MID`/`NATIVE_L2`/`NATIVE_NARROW_MID`/`NATIVE_L3`/`NATIVE_BOT_MID`/`NATIVE_L4`/`GUIDE_LINES` are not exported yet.

- [ ] **Step 3: Add the constants**

**Important — do not alias the new constants to this file's existing `L1`/`L2`/`L3`/`L4`.**
Those describe a *different* coordinate system: a generic 150-unit-tall row with no
top/bottom margin (`L1=0, L2=60, L3=90, L4=150`), used only for the mm-scaled rendering
ruling below (`buildRowGuideLines`). The system every captured letter/connector's own
stroke data is actually drawn in — the same one `handwriting_capture.html`'s canvas and
`drawRuling()` use — has 10-unit margins top and bottom (`L1=10, L2=62, L3=88, L4=140`).
The two happen to agree only by coincidence on the narrow-band midpoint (both give 75).
`LETTER_BASELINE_UNIT` (`=88`) and `LETTER_XHEIGHT_UNIT_SPAN` (`=26`), already in this
file, are the existing examples of this second, "native capture" system — the new
constants extend that same system, under a `NATIVE_` prefix so the two are never
confused.

In `src/topics/renderers/propis/propisRuling.js`, find this block:

```js
export const L4 = mmToUnit(ASCENDER_GAP_MM + NARROW_GAP_MM + DESCENDER_GAP_MM);  // row bottom
export const DIAGONAL_MM = 20; // "стандарт российских школ"
```

Replace it with:

```js
export const L4 = mmToUnit(ASCENDER_GAP_MM + NARROW_GAP_MM + DESCENDER_GAP_MM);  // row bottom

// The coordinate system every captured letter/connector's own stroke data is drawn in —
// same as handwriting_capture.html's canvas/drawRuling() (viewBox "0 0 100 150"). NOT the
// same system as this file's own L1-L4 above (see note in the implementation plan this
// was introduced from — docs/superpowers/plans/2026-08-07-propis-word-writing.md). Kept
// under a NATIVE_ prefix specifically so the two can never be accidentally interchanged.
export const NATIVE_L1 = 10;         // row top
export const NATIVE_TOP_MID = 36;    // tall ascenders (Й,Г,П,Н...) top out here
export const NATIVE_L2 = 62;         // x-height top / top of узкая строка
export const NATIVE_NARROW_MID = 75; // vertical center of узкая строка — most letters' own start/end point
export const NATIVE_L3 = 88;         // baseline (bold) — same value as LETTER_BASELINE_UNIT above
export const NATIVE_BOT_MID = 110;   // real descenders are shallower than ascenders are tall, not simply symmetric
export const NATIVE_L4 = 140;        // row bottom

// The same 7 numbered ruling lines shown in handwriting_capture.html's drawRuling(), in
// the same top-to-bottom numbering (1-7) — the shared vocabulary a letter's entry/exit
// line and a connector's fromLine/toLine are expressed in. Keep this in sync by hand with
// drawRuling()'s H_GUIDES array if either ever changes.
export const GUIDE_LINES = [
  { line: 1, y: NATIVE_L1 },
  { line: 2, y: NATIVE_TOP_MID },
  { line: 3, y: NATIVE_L2 },
  { line: 4, y: NATIVE_NARROW_MID },
  { line: 5, y: NATIVE_L3 },
  { line: 6, y: NATIVE_BOT_MID },
  { line: 7, y: NATIVE_L4 },
];

export const DIAGONAL_MM = 20; // "стандарт российских школ"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/topics/renderers/propis/propisRuling.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/propis/propisRuling.js src/topics/renderers/propis/propisRuling.test.js
git commit -m "feat(propis): add numbered guide-line vocabulary to propisRuling.js"
```

---

## Task 2: pathGeometry.js — SVG path endpoint extraction and transform

**Files:**
- Create: `src/topics/renderers/propis/pathGeometry.js`
- Test: `src/topics/renderers/propis/pathGeometry.test.js`

**Interfaces:**
- Produces: `getPathEndpoints(d: string): { start: [number, number], end: [number, number] }`
- Produces: `transformPathD(d: string, { scaleX?: number, translateX?: number, translateY?: number }): string`

Only `M` (moveto) and `C` (cubic bezier) commands appear in captured stroke data (per `handwriting_capture.html`'s own pipeline comment: "cubic Bézier → strokes:[{d}]"), so the parser only needs to handle those two.

- [ ] **Step 1: Write the failing tests**

```js
// src/topics/renderers/propis/pathGeometry.test.js
import { describe, it, expect } from "vitest";
import { getPathEndpoints, transformPathD } from "./pathGeometry.js";

// Real captured stroke, first M-only-then-C path from tools/propis/topic.json ("Б", stroke 0)
const REAL_STROKE_D =
  "M 31.58 45.29 C 30.54 47.86 31.46 46.75 28.46 52.99 C 25.46 59.23 16.40 77.37 13.57 82.74 " +
  "C 10.75 88.12 12.10 84.72 11.50 85.23 C 10.90 85.74 10.50 85.77 9.97 85.82 " +
  "C 9.44 85.86 8.76 85.80 8.32 85.50 C 7.88 85.19 7.49 84.64 7.34 83.99 " +
  "C 7.20 83.34 7.29 82.50 7.45 81.61 C 7.61 80.72 7.77 79.93 8.30 78.65 " +
  "C 8.83 77.38 9.70 75.57 10.63 73.95 C 11.57 72.33 12.60 70.53 13.93 68.94 " +
  "C 15.25 67.35 17.41 65.39 18.60 64.43 C 19.80 63.46 20.17 63.53 21.08 63.16 " +
  "C 21.99 62.80 22.84 62.51 24.09 62.23 C 25.33 61.95 27.22 61.57 28.57 61.46 " +
  "C 29.92 61.36 31.17 61.46 32.21 61.62 C 33.24 61.78 34.11 62.02 34.79 62.41 " +
  "C 35.48 62.80 35.97 63.36 36.30 63.95 C 36.64 64.55 36.76 65.14 36.81 65.97 " +
  "C 36.87 66.81 37.04 67.15 36.63 68.97 C 36.22 70.79 35.03 75.03 34.37 76.91 " +
  "C 33.71 78.79 33.34 79.18 32.66 80.25 C 31.99 81.33 30.92 82.63 30.31 83.34 " +
  "C 29.69 84.05 29.57 84.17 28.99 84.50 C 28.41 84.84 27.50 85.16 26.81 85.37 " +
  "C 26.12 85.59 25.80 85.84 24.85 85.80 C 23.91 85.77 21.96 85.40 21.14 85.16 " +
  "C 20.32 84.93 20.42 84.93 19.92 84.38 C 19.43 83.82 18.75 82.68 18.16 81.84";

describe("getPathEndpoints", () => {
  it("reads the start point from the M command", () => {
    const { start } = getPathEndpoints(REAL_STROKE_D);
    expect(start).toEqual([31.58, 45.29]);
  });

  it("reads the end point from the last C command's final coordinate pair", () => {
    const { end } = getPathEndpoints(REAL_STROKE_D);
    expect(end).toEqual([18.16, 81.84]);
  });

  it("handles a path with no C commands (M only)", () => {
    const { start, end } = getPathEndpoints("M 5 10");
    expect(start).toEqual([5, 10]);
    expect(end).toEqual([5, 10]);
  });
});

describe("transformPathD", () => {
  it("translates M and C coordinates by translateX/translateY", () => {
    const result = transformPathD("M 0 0 C 1 1 2 2 3 3", { translateX: 10, translateY: 5 });
    expect(result).toBe("M 10.000 5.000 C 11.000 6.000 12.000 7.000 13.000 8.000");
  });

  it("scales x (never y) by scaleX", () => {
    const result = transformPathD("M 0 0 C 1 1 2 2 3 3", { scaleX: 2 });
    expect(result).toBe("M 0.000 0.000 C 2.000 1.000 4.000 2.000 6.000 3.000");
  });

  it("defaults to identity when no options are given", () => {
    const result = transformPathD("M 1.5 2.5 C 3 3 4 4 5 5");
    expect(result).toBe("M 1.500 2.500 C 3.000 3.000 4.000 4.000 5.000 5.000");
  });

  it("round-trips getPathEndpoints after a pure translation", () => {
    const moved = transformPathD(REAL_STROKE_D, { translateX: 100 });
    const { start, end } = getPathEndpoints(moved);
    expect(start).toEqual([131.58, 45.29]);
    expect(end).toEqual([118.16, 81.84]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/topics/renderers/propis/pathGeometry.test.js`
Expected: FAIL — `Cannot find module './pathGeometry.js'`

- [ ] **Step 3: Implement pathGeometry.js**

```js
// src/topics/renderers/propis/pathGeometry.js
// Minimal SVG path helpers for propis stroke data — only M (moveto) and C (cubic bezier)
// commands ever appear in captured strokes (see handwriting_capture.html's pipeline
// comment: EMA -> RDP -> Hermite -> cubic Bézier -> strokes:[{d}]).

const TOKEN_RE = /[MC]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g;

export function getPathEndpoints(d) {
  const tokens = d.match(TOKEN_RE) || [];
  let i = 0;
  let cmd = null;
  let start = null;
  let end = null;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "M" || t === "C") {
      cmd = t;
      i += 1;
      continue;
    }
    if (cmd === "M") {
      const x = parseFloat(tokens[i]);
      const y = parseFloat(tokens[i + 1]);
      i += 2;
      if (!start) start = [x, y];
      end = [x, y];
    } else if (cmd === "C") {
      const x = parseFloat(tokens[i + 4]);
      const y = parseFloat(tokens[i + 5]);
      i += 6;
      end = [x, y];
    } else {
      i += 1;
    }
  }

  return { start, end };
}

export function transformPathD(d, { scaleX = 1, translateX = 0, translateY = 0 } = {}) {
  const tokens = d.match(TOKEN_RE) || [];
  const tx = (x) => (x * scaleX + translateX).toFixed(3);
  const ty = (y) => (y + translateY).toFixed(3);

  let out = "";
  let i = 0;
  let cmd = null;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "M" || t === "C") {
      cmd = t;
      out += (out ? " " : "") + t;
      i += 1;
      continue;
    }
    if (cmd === "M") {
      out += " " + tx(parseFloat(tokens[i])) + " " + ty(parseFloat(tokens[i + 1]));
      i += 2;
    } else if (cmd === "C") {
      out +=
        " " + tx(parseFloat(tokens[i])) + " " + ty(parseFloat(tokens[i + 1])) +
        " " + tx(parseFloat(tokens[i + 2])) + " " + ty(parseFloat(tokens[i + 3])) +
        " " + tx(parseFloat(tokens[i + 4])) + " " + ty(parseFloat(tokens[i + 5]));
      i += 6;
    } else {
      i += 1;
    }
  }

  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/topics/renderers/propis/pathGeometry.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/propis/pathGeometry.js src/topics/renderers/propis/pathGeometry.test.js
git commit -m "feat(propis): add pathGeometry — SVG path endpoint extraction and transform"
```

---

## Task 3: wordEngine.js — line classification and word trajectory assembly

**Files:**
- Create: `src/topics/renderers/propis/wordEngine.js`
- Test: `src/topics/renderers/propis/wordEngine.test.js`

**Interfaces:**
- Consumes: `getPathEndpoints`, `transformPathD` from `./pathGeometry.js` (Task 2); `GUIDE_LINES` from `./propisRuling.js` (Task 1)
- Produces: `classifyLine(y: number): number` (1-7)
- Produces: `getConnectionInfo(item: { id, strokes: [{d}] }): { entryPoint: [number,number], exitPoint: [number,number], entryLine: number, exitLine: number }`
- Produces: `buildWordTrajectory(word: string, lettersByLabel: Map<string, LetterRecord>, connectorsByKey: Map<string, ConnectorRecord>): { strokes: [{d}], totalWidthUnits: number, viewBox: string }`
  - `LetterRecord` = `{ id, type: "letter", label, viewBox, strokes: [{d}] }` (existing card shape)
  - `ConnectorRecord` = `{ id, type: "connector", fromLine, toLine, viewBox, strokes: [{d}] }` (Task 5/10 shape)
  - `connectorsByKey` is keyed by `` `${fromLine}_${toLine}` ``

- [ ] **Step 1: Write the failing tests**

```js
// src/topics/renderers/propis/wordEngine.test.js
import { describe, it, expect } from "vitest";
import { classifyLine, getConnectionInfo, buildWordTrajectory } from "./wordEngine.js";

const LETTER_A = {
  id: "а",
  type: "letter",
  strokes: [{ d: "M 10 75 C 12 74 14 74 16 75 C 18 76 20 76 22 75" }],
};

// Entry point deliberately near line 2 (y=36) instead of line 4 (y=75), like real б/в do.
const LETTER_B_HIGH_ENTRY = {
  id: "б",
  type: "letter",
  strokes: [{ d: "M 10 37 C 12 50 14 60 16 75 C 18 78 20 78 22 75" }],
};

describe("classifyLine", () => {
  it("picks line 4 (y=75) for a point exactly on it", () => {
    expect(classifyLine(75)).toBe(4);
  });

  it("picks line 1 (y=10) for a point near the top", () => {
    expect(classifyLine(11)).toBe(1);
  });

  it("picks line 7 (y=140) for a point near the bottom", () => {
    expect(classifyLine(139)).toBe(7);
  });

  it("picks the nearer of two adjacent lines for a midpoint-ish value", () => {
    // Between line 3 (y=62) and line 4 (y=75): 65 is closer to 62.
    expect(classifyLine(65)).toBe(3);
  });
});

describe("getConnectionInfo", () => {
  it("reads entry point + line from the first point of the first stroke", () => {
    const info = getConnectionInfo(LETTER_A);
    expect(info.entryPoint).toEqual([10, 75]);
    expect(info.entryLine).toBe(4);
  });

  it("reads exit point + line from the last point of the last stroke", () => {
    const info = getConnectionInfo(LETTER_A);
    expect(info.exitPoint).toEqual([22, 75]);
    expect(info.exitLine).toBe(4);
  });

  it("classifies a high entry point to a different line", () => {
    const info = getConnectionInfo(LETTER_B_HIGH_ENTRY);
    expect(info.entryLine).toBe(2);
  });

  it("throws a clear error for an item with no strokes", () => {
    expect(() => getConnectionInfo({ id: "x", strokes: [] })).toThrow(/x/);
  });
});

describe("buildWordTrajectory", () => {
  const letters = new Map([
    ["а", LETTER_A],
    ["б", LETTER_B_HIGH_ENTRY],
  ]);

  it("throws naming the missing letter when the word contains an uncaptured letter", () => {
    expect(() => buildWordTrajectory("х", letters, new Map())).toThrow(/х/);
  });

  it("returns just the one letter's strokes for a single-letter word, no bridge", () => {
    const result = buildWordTrajectory("а", letters, new Map());
    expect(result.strokes).toHaveLength(1);
    // translateStrokes always runs through transformPathD (even at dx=0), which reformats
    // every coordinate via toFixed(3) — same points as LETTER_A.strokes[0].d, different string.
    expect(result.strokes[0].d).toBe(
      "M 10.000 75.000 C 12.000 74.000 14.000 74.000 16.000 75.000 C 18.000 76.000 20.000 76.000 22.000 75.000"
    );
  });

  it("inserts a straight M/L bridge for a same-line transition with no connector needed", () => {
    const result = buildWordTrajectory("аа", letters, new Map());
    expect(result.strokes).toHaveLength(3); // letter, bridge, letter
    expect(result.strokes[1].d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  });

  it("offsets the second letter's strokes by one slot width (100 units)", () => {
    const result = buildWordTrajectory("аа", letters, new Map());
    expect(result.strokes[2].d).toContain("110.000"); // second а's M x=10 + 100
  });

  it("uses a matching connector's (translated + x-scaled) strokes when lines differ", () => {
    const connector = {
      id: "conn_4_2",
      type: "connector",
      fromLine: 4,
      toLine: 2,
      strokes: [{ d: "M 0 75 C 1 60 2 50 3 37" }],
    };
    const connectors = new Map([["4_2", connector]]);
    const result = buildWordTrajectory("аб", letters, connectors);
    expect(result.strokes).toHaveLength(3); // letter а, connector bridge, letter б
    expect(result.strokes[1].d).not.toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
    expect(result.strokes[1].d.startsWith("M 22.000")).toBe(true); // connector start snapped to а's exit point
  });

  it("falls back to a straight bridge when the needed connector is missing", () => {
    const result = buildWordTrajectory("аб", letters, new Map());
    expect(result.strokes).toHaveLength(3);
    expect(result.strokes[1].d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  });

  it("reports total width as letterCount * 100 and a matching viewBox", () => {
    const result = buildWordTrajectory("баба", new Map([["б", LETTER_B_HIGH_ENTRY], ["а", LETTER_A]]), new Map());
    expect(result.totalWidthUnits).toBe(400);
    expect(result.viewBox).toBe("0 0 400 150");
  });

  it("returns empty output for an empty word", () => {
    const result = buildWordTrajectory("", letters, new Map());
    expect(result.strokes).toEqual([]);
    expect(result.totalWidthUnits).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/topics/renderers/propis/wordEngine.test.js`
Expected: FAIL — `Cannot find module './wordEngine.js'`

- [ ] **Step 3: Implement wordEngine.js**

```js
// src/topics/renderers/propis/wordEngine.js
import { getPathEndpoints, transformPathD } from "./pathGeometry.js";
import { GUIDE_LINES } from "./propisRuling.js";

const SLOT_WIDTH = 100; // matches the fixed per-letter slot already used in the capture tool

export function classifyLine(y) {
  let bestLine = GUIDE_LINES[0].line;
  let bestDist = Infinity;
  for (const g of GUIDE_LINES) {
    const dist = Math.abs(y - g.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestLine = g.line;
    }
  }
  return bestLine;
}

export function getConnectionInfo(item) {
  const strokes = item.strokes ?? [];
  if (strokes.length === 0) {
    throw new Error(`getConnectionInfo: item "${item.id}" has no strokes`);
  }
  const entry = getPathEndpoints(strokes[0].d);
  const exit = getPathEndpoints(strokes[strokes.length - 1].d);
  return {
    entryPoint: entry.start,
    exitPoint: exit.end,
    entryLine: classifyLine(entry.start[1]),
    exitLine: classifyLine(exit.end[1]),
  };
}

function translateStrokes(strokes, dx) {
  return strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx }) }));
}

function straightBridge(fromPoint, toPoint) {
  const x1 = fromPoint[0].toFixed(3);
  const y1 = fromPoint[1].toFixed(3);
  const x2 = toPoint[0].toFixed(3);
  const y2 = toPoint[1].toFixed(3);
  return { d: `M ${x1} ${y1} L ${x2} ${y2}` };
}

// Snaps the connector's own start point onto fromPoint and its own end point onto
// toPoint. Only x is rescaled (the connector's own shape/height is authored to already
// match its fromLine/toLine y values) — y is only translated, per the design spec.
function fitConnectorStrokes(connector, fromPoint, toPoint) {
  const info = getConnectionInfo(connector);
  const connStart = info.entryPoint;
  const connEnd = info.exitPoint;
  const dx = connEnd[0] - connStart[0];
  const scaleX = dx === 0 ? 1 : (toPoint[0] - fromPoint[0]) / dx;
  const translateX = fromPoint[0] - scaleX * connStart[0];
  const translateY = fromPoint[1] - connStart[1];
  return connector.strokes.map((s) => ({
    d: transformPathD(s.d, { scaleX, translateX, translateY }),
  }));
}

export function buildWordTrajectory(word, lettersByLabel, connectorsByKey) {
  const chars = Array.from(word);
  if (chars.length === 0) {
    return { strokes: [], totalWidthUnits: 0, viewBox: "0 0 0 150" };
  }

  const strokes = [];
  let prevExitLine = null;
  let prevExitPointWorld = null;

  chars.forEach((ch, index) => {
    const letter = lettersByLabel.get(ch);
    if (!letter) {
      throw new Error(`buildWordTrajectory: letter "${ch}" is not in the letter library`);
    }
    const offset = index * SLOT_WIDTH;
    const info = getConnectionInfo(letter);
    const entryPointWorld = [info.entryPoint[0] + offset, info.entryPoint[1]];
    const exitPointWorld = [info.exitPoint[0] + offset, info.exitPoint[1]];

    if (prevExitPointWorld) {
      if (prevExitLine === info.entryLine) {
        strokes.push(straightBridge(prevExitPointWorld, entryPointWorld));
      } else {
        const connector = connectorsByKey.get(`${prevExitLine}_${info.entryLine}`);
        if (connector) {
          strokes.push(...fitConnectorStrokes(connector, prevExitPointWorld, entryPointWorld));
        } else {
          strokes.push(straightBridge(prevExitPointWorld, entryPointWorld));
        }
      }
    }

    strokes.push(...translateStrokes(letter.strokes, offset));
    prevExitLine = info.exitLine;
    prevExitPointWorld = exitPointWorld;
  });

  const totalWidthUnits = chars.length * SLOT_WIDTH;
  return { strokes, totalWidthUnits, viewBox: `0 0 ${totalWidthUnits} 150` };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/topics/renderers/propis/wordEngine.test.js`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/propis/wordEngine.js src/topics/renderers/propis/wordEngine.test.js
git commit -m "feat(propis): add wordEngine — line classification + word trajectory assembly"
```

---

## Task 4: engine.js — write_words mode, split letters/connectors by card type

**Files:**
- Modify: `src/topics/renderers/propis/engine.js`
- Test: `src/topics/renderers/propis/engine.test.js` (create)

**Interfaces:**
- Produces: for `mode.type === "write_words"`, `generateTasks` returns `[{ type: "write_words", letters: LetterRecord[], connectors: ConnectorRecord[] }]`

- [ ] **Step 1: Write the failing tests**

```js
// src/topics/renderers/propis/engine.test.js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";

const LETTER_CARD = { id: "а", type: "letter", label: "а", strokes: [{ d: "M 0 0 C 1 1 2 2 3 3" }] };
const CONNECTOR_CARD = { id: "conn_4_2", type: "connector", fromLine: 4, toLine: 2, strokes: [{ d: "M 0 0 C 1 1 2 2 3 3" }] };
const CARD_NO_STROKES = { id: "я", type: "letter", label: "я", strokes: [] };

describe("generateTasks — practice/show (existing behavior)", () => {
  it("practice mode returns only letter-type cards with strokes as items", () => {
    const tasks = generateTasks({ type: "practice" }, [LETTER_CARD, CONNECTOR_CARD, CARD_NO_STROKES]);
    expect(tasks).toEqual([{ type: "practice", items: [LETTER_CARD] }]);
  });

  it("show mode returns only letter-type cards with strokes as items", () => {
    const tasks = generateTasks({ type: "show" }, [LETTER_CARD, CONNECTOR_CARD]);
    expect(tasks).toEqual([{ type: "show", items: [LETTER_CARD] }]);
  });
});

describe("generateTasks — write_words", () => {
  it("splits cards into letters and connectors by type", () => {
    const tasks = generateTasks({ type: "write_words" }, [LETTER_CARD, CONNECTOR_CARD, CARD_NO_STROKES]);
    expect(tasks).toEqual([{ type: "write_words", letters: [LETTER_CARD], connectors: [CONNECTOR_CARD] }]);
  });

  it("returns empty arrays when there are no cards of either type", () => {
    const tasks = generateTasks({ type: "write_words" }, []);
    expect(tasks).toEqual([{ type: "write_words", letters: [], connectors: [] }]);
  });
});

describe("generateTasks — unknown mode", () => {
  it("returns an empty array", () => {
    expect(generateTasks({ type: "nope" }, [LETTER_CARD])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/topics/renderers/propis/engine.test.js`
Expected: FAIL on the `write_words` tests (practice/show tests may already pass against current code, since this task also codifies existing behavior before changing it).

- [ ] **Step 3: Update engine.js**

Replace the entire contents of `src/topics/renderers/propis/engine.js` with:

```js
export function generateTasks(mode, cards) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const withStrokes = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);
  const letters = withStrokes.filter((c) => c.type === "letter");
  const connectors = withStrokes.filter((c) => c.type === "connector");

  if (mode.type === "practice") {
    return [{ type: "practice", items: letters }];
  }

  if (mode.type === "show") {
    return [{ type: "show", items: letters }];
  }

  if (mode.type === "write_words") {
    return [{ type: "write_words", letters, connectors }];
  }

  return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/topics/renderers/propis/engine.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/propis/engine.js src/topics/renderers/propis/engine.test.js
git commit -m "feat(propis): engine — write_words mode, split cards into letters/connectors"
```

---

## Task 5: handwriting_capture.html — "Соединитель" capture type

**Files:**
- Modify: `tools/letter_capture/handwriting_capture.html`

No test runner is wired to this standalone file (it has no build step and is opened directly in a browser) — verification is manual, via the browser, same as every prior change to this file in this project.

**Interfaces:**
- Produces: collection entries of shape `{ type: "connector", label: "<from>→<to>", fromLine: number, toLine: number, viewBox, strokes: [{d}], meta }`, saved into the same `collection` array (and hence the same exported JSON) as letter/element entries.

- [ ] **Step 1: Add the "Соединитель" option and the from/to line fields**

Find (around line 373-383):

```html
        <div class="field-row">
          <div class="field type-field">
            <label for="typeSelect">Тип</label>
            <select id="typeSelect">
              <option value="letter">Буква(ы)</option>
              <option value="element">Элемент</option>
            </select>
          </div>
          <div class="field label-field">
            <label for="labelInput" id="labelFieldLabel">Буквы</label>
            <input type="text" id="labelInput" maxlength="3" placeholder="Аба" autocomplete="off" />
          </div>
        </div>
```

Replace with:

```html
        <div class="field-row">
          <div class="field type-field">
            <label for="typeSelect">Тип</label>
            <select id="typeSelect">
              <option value="letter">Буква(ы)</option>
              <option value="element">Элемент</option>
              <option value="connector">Соединитель</option>
            </select>
          </div>
          <div class="field label-field" id="labelFieldWrap">
            <label for="labelInput" id="labelFieldLabel">Буквы</label>
            <input type="text" id="labelInput" maxlength="3" placeholder="Аба" autocomplete="off" />
          </div>
        </div>
        <div class="field-row" id="connectorFieldWrap" style="display:none;">
          <div class="field">
            <label for="fromLineSelect">От линии</label>
            <select id="fromLineSelect"></select>
          </div>
          <div class="field">
            <label for="toLineSelect">До линии</label>
            <select id="toLineSelect"></select>
          </div>
        </div>
```

- [ ] **Step 2: Wire up the new elements and populate the line dropdowns**

Find (around line 462-465):

```js
  const typeSelect = document.getElementById("typeSelect");
  const addToSetBtn = document.getElementById("addToSetBtn");
  const labelInput = document.getElementById("labelInput");
  const labelFieldLabel = document.getElementById("labelFieldLabel");
```

Replace with:

```js
  const typeSelect = document.getElementById("typeSelect");
  const addToSetBtn = document.getElementById("addToSetBtn");
  const labelInput = document.getElementById("labelInput");
  const labelFieldLabel = document.getElementById("labelFieldLabel");
  const labelFieldWrap = document.getElementById("labelFieldWrap");
  const connectorFieldWrap = document.getElementById("connectorFieldWrap");
  const fromLineSelect = document.getElementById("fromLineSelect");
  const toLineSelect = document.getElementById("toLineSelect");

  for (const sel of [fromLineSelect, toLineSelect]) {
    for (let n = 1; n <= 7; n += 1) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      sel.appendChild(opt);
    }
  }
  toLineSelect.value = "4"; // most common target line, per the propis ruling analysis
```

- [ ] **Step 3: Toggle the two field layouts in applyTypeUI()**

Find (around line 861-868):

```js
  function applyTypeUI() {
    const t = TYPE_COPY[typeSelect.value];
    labelInput.placeholder = t.placeholder;
    labelInput.maxLength = t.maxlength;
    labelFieldLabel.textContent = t.fieldLabel;
    formHint.textContent = t.hint;
    updateGuideFromLabel();
  }
```

Replace with:

```js
  function applyTypeUI() {
    const isConnector = typeSelect.value === "connector";
    labelFieldWrap.style.display = isConnector ? "none" : "";
    connectorFieldWrap.style.display = isConnector ? "flex" : "none";
    if (isConnector) {
      formHint.textContent =
        "Соединитель между линией \"от\" (где заканчивается предыдущая буква) и линией " +
        "\"до\" (где начинается следующая) — см. пронумерованные направляющие на холсте. " +
        "Нарисуйте штрих(и) выше и добавьте в набор.";
      return;
    }
    const t = TYPE_COPY[typeSelect.value];
    labelInput.placeholder = t.placeholder;
    labelInput.maxLength = t.maxlength;
    labelFieldLabel.textContent = t.fieldLabel;
    formHint.textContent = t.hint;
    updateGuideFromLabel();
  }
```

- [ ] **Step 4: Branch the save handler on the connector type**

Find (around line 956-976):

```js
  addToSetBtn.addEventListener("click", () => {
    const label = labelInput.value.trim();
    if (!label || strokes.length === 0) return;
    collection.push({
      type: typeSelect.value,
      label,
      viewBox: "0 0 " + CANVAS_W + " " + VB_H,
      strokes: strokes.map(s => ({ d: s.smoothD })),
      meta: { capturedAt: new Date().toISOString(), strokeCount: strokes.length }
    });
    saveCollection();
    renderGallery();

    strokes = [];
    undoBtn.disabled = true;
    clearBtn.disabled = true;
    redrawAll();
    labelInput.value = "";
    updateGuideFromLabel();
    labelInput.focus();

    addedMsg.classList.add("show");
    setTimeout(() => addedMsg.classList.remove("show"), 1400);
  });
```

Replace with:

```js
  addToSetBtn.addEventListener("click", () => {
    if (strokes.length === 0) return;
    const isConnector = typeSelect.value === "connector";

    if (isConnector) {
      const fromLine = Number(fromLineSelect.value);
      const toLine = Number(toLineSelect.value);
      collection.push({
        type: "connector",
        label: fromLine + "→" + toLine,
        fromLine,
        toLine,
        viewBox: "0 0 " + CANVAS_W + " " + VB_H,
        strokes: strokes.map(s => ({ d: s.smoothD })),
        meta: { capturedAt: new Date().toISOString(), strokeCount: strokes.length }
      });
    } else {
      const label = labelInput.value.trim();
      if (!label) return;
      collection.push({
        type: typeSelect.value,
        label,
        viewBox: "0 0 " + CANVAS_W + " " + VB_H,
        strokes: strokes.map(s => ({ d: s.smoothD })),
        meta: { capturedAt: new Date().toISOString(), strokeCount: strokes.length }
      });
    }
    saveCollection();
    renderGallery();

    strokes = [];
    undoBtn.disabled = true;
    clearBtn.disabled = true;
    redrawAll();
    if (!isConnector) {
      labelInput.value = "";
      updateGuideFromLabel();
      labelInput.focus();
    }

    addedMsg.classList.add("show");
    setTimeout(() => addedMsg.classList.remove("show"), 1400);
  });
```

- [ ] **Step 5: Tag connector entries in the gallery display**

Find (around line 924):

```js
      const typeTag = item.type === "element" ? " · эл." : (item.case === "lower" ? " (стр.)" : "");
```

Replace with:

```js
      const typeTag = item.type === "element" ? " · эл." : item.type === "connector" ? " · соед." : (item.case === "lower" ? " (стр.)" : "");
```

- [ ] **Step 6: Manual verification in the browser**

```bash
npm run dev
```

Open `http://localhost:8080/tools/letter_capture/handwriting_capture.html` (or the `file://` path directly — this tool has no server dependency). Confirm:
1. Selecting "Соединитель" in the Тип dropdown hides the letter/element text field and shows two numbered dropdowns (От линии / До линии).
2. Draw any stroke, pick e.g. От=5 До=4, tap «Добавить в набор» — a gallery card appears labelled "5→4 · соед.".
3. Switching back to "Буква(ы)" restores the text-input field and its original behavior (already-existing letters still work).
4. «Скачать набор» produces JSON containing the connector entry with `fromLine`/`toLine` fields intact.

- [ ] **Step 7: Commit**

```bash
git add tools/letter_capture/handwriting_capture.html
git commit -m "feat(letter_capture): add Соединитель capture type (fromLine/toLine)"
```

---

## Task 6: useLoopingStrokes.js — extract the shared animation loop

**Files:**
- Create: `src/topics/renderers/propis/useLoopingStrokes.js`
- Modify: `src/topics/renderers/propis/LoopingLetterCell.jsx`

This is a behavior-preserving extraction (no test file existed for `LoopingLetterCell.jsx` before this change — `getTotalLength()`/`getPointAtLength()` aren't implemented in jsdom, so this animation code has always been verified visually, not with vitest; this task keeps that precedent). Verification is manual: the single-letter loop in "Учим буквы" must look and behave identically after the extraction.

**Interfaces:**
- Produces: `useLoopingStrokes(containerRef: RefObject<SVGGElement>, dependencyKey: string | number, { delayMs?: number, loopPauseMs?: number }): void` — imperatively drives every `[data-pr-anim]` path and the `[data-pr-tip]` circle inside `containerRef.current`, looping forever until unmount. `dependencyKey` should change whenever the strokes being animated change (e.g. a letter id, or a word's joined stroke data) so the effect restarts.

- [ ] **Step 1: Create the hook**

```js
// src/topics/renderers/propis/useLoopingStrokes.js
import { useRef, useEffect, useCallback } from "react";
import { SPEED, easeInOut } from "./propisRuling.js";

// Drives a looping stroke-by-stroke draw animation over whatever [data-pr-anim="N"] paths
// and [data-pr-tip] circle currently exist inside containerRef.current. Shared by
// LoopingLetterCell (one letter's own strokes) and WordAnimatedCard (a whole word's
// already-assembled stroke list) — the two differ only in how they position/scale their
// own <g>, not in how the draw animation itself runs.
export function useLoopingStrokes(containerRef, dependencyKey, { delayMs = 0, loopPauseMs = 1400 } = {}) {
  const rafRef = useRef(null);
  const timersRef = useRef([]);
  const lensRef = useRef([]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const g = containerRef.current;
    if (!g) return undefined;

    const paths = g.querySelectorAll("[data-pr-anim]");
    lensRef.current = Array.from(paths).map((el) => {
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", len);
      el.setAttribute("stroke-dashoffset", len);
      return len;
    });

    const t = setTimeout(() => loopPlay(g), delayMs);
    timersRef.current.push(t);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey, stop]);

  function loopPlay(g) {
    const paths = g.querySelectorAll("[data-pr-anim]");
    paths.forEach((el, i) => el.setAttribute("stroke-dashoffset", lensRef.current[i]));
    const tip = g.querySelector("[data-pr-tip]");
    if (tip) tip.setAttribute("opacity", "0");

    const PAUSE = 260;
    const strokeCount = paths.length;

    function runStroke(i) {
      if (i >= strokeCount) {
        if (tip) tip.setAttribute("opacity", "0");
        const t = setTimeout(() => loopPlay(g), loopPauseMs);
        timersRef.current.push(t);
        return;
      }
      const t = setTimeout(() => {
        animStroke(g, i, tip, () => {
          const t2 = setTimeout(() => runStroke(i + 1), PAUSE);
          timersRef.current.push(t2);
        });
      }, PAUSE);
      timersRef.current.push(t);
    }

    runStroke(0);
  }

  function animStroke(g, idx, tip, onDone) {
    const el = g.querySelector(`[data-pr-anim="${idx}"]`);
    if (!el) { onDone(); return; }
    const len = lensRef.current[idx];
    const dur = (len / SPEED) * 1000;
    const t0 = performance.now();

    function frame(now) {
      const raw = Math.min((now - t0) / dur, 1);
      const eased = easeInOut(raw);
      el.setAttribute("stroke-dashoffset", len * (1 - eased));
      const pt = el.getPointAtLength(eased * len);
      if (tip) {
        tip.setAttribute("cx", pt.x);
        tip.setAttribute("cy", pt.y);
        tip.setAttribute("opacity", "0.9");
      }
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        el.setAttribute("stroke-dashoffset", 0);
        if (tip) tip.setAttribute("opacity", "0");
        onDone();
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }
}
```

- [ ] **Step 2: Refactor LoopingLetterCell.jsx to use the hook**

Replace the entire contents of `src/topics/renderers/propis/LoopingLetterCell.jsx` with:

```jsx
import { useRef } from "react";
import { LINE_MM, UNIT_H, L2, L3, LETTER_BASELINE_UNIT, LETTER_XHEIGHT_UNIT_SPAN, INK_COLOR, NIB_COLOR, STROKE_W, TIP_R } from "./propisRuling.js";
import { useLoopingStrokes } from "./useLoopingStrokes.js";

// One item's animated sample, looping forever until unmounted.
export default function LoopingLetterCell({ item, delayMs = 0, loopPauseMs = 1400 }) {
  const gRef = useRef(null);
  useLoopingStrokes(gRef, item.id, { delayMs, loopPauseMs });

  const [vbMinX, vbMinY] = (item.viewBox || "0 0 100 150").split(" ").map(Number);

  // Scale so the letter's own x-height body (LETTER_XHEIGHT_UNIT_SPAN, its main body
  // excluding ascenders/descenders) matches the ruling's узкая строка exactly — not the
  // letter's whole 150-unit box against the whole row, which underscales the body.
  const rulingNarrowMm = ((L3 - L2) / UNIT_H) * LINE_MM;
  const scale = rulingNarrowMm / LETTER_XHEIGHT_UNIT_SPAN;

  // Re-anchor onto the ruling's actual baseline guide (L3) instead of relying on the
  // letter's baked-in baseline (LETTER_BASELINE_UNIT, from the original font-formation
  // system) to already land there — the two diverge under the current row zones.
  const targetBaselineMm = (L3 / UNIT_H) * LINE_MM;
  const naiveBaselineMm  = LETTER_BASELINE_UNIT * scale;
  const baselineShiftMm  = targetBaselineMm - naiveBaselineMm;

  return (
    <g ref={gRef} transform={`translate(0 ${baselineShiftMm}) scale(${scale}) translate(${-vbMinX} ${-vbMinY})`}>
      {item.strokes.map((s, i) => (
        <path key={`g${i}`} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={STROKE_W}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
      ))}
      {item.strokes.map((s, i) => (
        <path key={`a${i}`} data-pr-anim={i} d={s.d} fill="none" stroke={INK_COLOR}
          strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <circle data-pr-tip r={TIP_R} cx="0" cy="0" fill={NIB_COLOR} opacity="0" />
    </g>
  );
}
```

`gRef` sits directly on the same transformed `<g>` as before — `querySelectorAll('[data-pr-anim]')` finds its direct children regardless, so no extra nesting is needed here. `WordAnimatedCard` (Task 7) uses a plain non-transformed `<g ref={gRef}>` for the same reason: it has no per-letter re-anchoring to apply, so its ref target and animation target are the same element too.

- [ ] **Step 3: Manual verification in the browser**

```bash
npm run dev
```

Navigate to the propis topic's "Учим буквы" mode (through the app UI, or via `http://localhost:8080/` if already set up as a student/topic per earlier sessions). Tap a captured letter (e.g. Б). Confirm the looping handwriting animation looks and times identically to before this refactor: ink trace fills in stroke-by-stroke, a small pen-tip dot follows the active stroke, then the whole thing pauses and loops.

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/propis/useLoopingStrokes.js src/topics/renderers/propis/LoopingLetterCell.jsx
git commit -m "refactor(propis): extract useLoopingStrokes hook from LoopingLetterCell"
```

---

## Task 7: WordAnimatedCard.jsx — plays an assembled word trajectory

**Files:**
- Create: `src/topics/renderers/propis/WordAnimatedCard.jsx`

**Interfaces:**
- Consumes: `trajectory: { strokes: [{d}], totalWidthUnits: number, viewBox: string }` (Task 3's `buildWordTrajectory` return shape)
- Consumes: `useLoopingStrokes` (Task 6), `GUIDE_LINES`, `NATIVE_L3`, `INK_COLOR`, `NIB_COLOR`, `STROKE_W`, `TIP_R` (`propisRuling.js`)

Unlike `LoopingLetterCell`, this component's input is already in final, absolute coordinates (produced by `wordEngine.js`) — no per-letter re-anchoring/scaling transform is needed, it renders the trajectory as-is inside its own `viewBox`.

- [ ] **Step 1: Create the component**

```jsx
// src/topics/renderers/propis/WordAnimatedCard.jsx
import { useRef } from "react";
import { INK_COLOR, NIB_COLOR, STROKE_W, TIP_R, GUIDE_LINES, NATIVE_L3 } from "./propisRuling.js";
import { useLoopingStrokes } from "./useLoopingStrokes.js";

const GUIDE_THIN_W = 0.4;
const GUIDE_BOLD_W = 0.9;
const GUIDE_COLOR = "#6fa3e0";

export default function WordAnimatedCard({ trajectory }) {
  const gRef = useRef(null);
  const dependencyKey = trajectory.strokes.map((s) => s.d).join("|");
  useLoopingStrokes(gRef, dependencyKey, { delayMs: 200, loopPauseMs: 1400 });

  return (
    <svg
      className="propis-practice-card-svg"
      viewBox={trajectory.viewBox}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
      {GUIDE_LINES.map((g) => (
        <line
          key={g.line}
          x1="0" y1={g.y} x2={trajectory.totalWidthUnits} y2={g.y}
          stroke={GUIDE_COLOR}
          strokeWidth={g.y === NATIVE_L3 ? GUIDE_BOLD_W : GUIDE_THIN_W}
        />
      ))}
      <g ref={gRef}>
        {trajectory.strokes.map((s, i) => (
          <path key={`g${i}`} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={STROKE_W}
            strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
        ))}
        {trajectory.strokes.map((s, i) => (
          <path key={`a${i}`} data-pr-anim={i} d={s.d} fill="none" stroke={INK_COLOR}
            strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        <circle data-pr-tip r={TIP_R} cx="0" cy="0" fill={NIB_COLOR} opacity="0" />
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- --quiet
```

Expected: 0 errors. (Manual visual verification happens together with Task 8, once this card is actually reachable through `WriteWordsView`.)

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/propis/WordAnimatedCard.jsx
git commit -m "feat(propis): add WordAnimatedCard — loops an assembled word trajectory"
```

---

## Task 8: WriteWordsView.jsx — the screen

**Files:**
- Create: `src/topics/renderers/propis/WriteWordsView.jsx`
- Modify: `src/topics/renderers/propis/propis.css`

**Interfaces:**
- Consumes: `task: { type: "write_words", letters: LetterRecord[], connectors: ConnectorRecord[] }`, `onClose: () => void`
- Consumes: `buildWordTrajectory` (Task 3), `WordAnimatedCard` (Task 7)

- [ ] **Step 1: Add the word-row CSS**

In `src/topics/renderers/propis/propis.css`, find:

```css
.propis-key:disabled { background: transparent; color: #c3c8ce; cursor: default; }
```

Add immediately after it:

```css

/* ─── Прописи · «Написание слов» ──────────────────────────────────────── */

.propis-word-row { display: flex; align-items: center; gap: 8px; padding: 0 calc(20px + var(--app-safe-right, 0px)) 0 calc(20px + var(--app-safe-left, 0px)); }

.propis-word-preview {
  flex: 1; min-width: 0;
  background: #fffdf8; border-radius: 9px; border: 1px solid #d7dcd0;
  padding: 9px 12px; font-size: 22px; font-weight: 600; letter-spacing: 0.05em;
  color: #1f2a3a; min-height: 20px; overflow-x: auto; white-space: nowrap;
}

.propis-word-btn {
  flex: none; min-height: 38px; padding: 0 12px; border-radius: 8px;
  border: 1px solid #d7dcd0; background: #eef1ec; color: #334155;
  font-size: 13px; font-weight: 700; cursor: pointer;
}

.propis-word-btn:disabled { opacity: 0.4; cursor: default; }
```

- [ ] **Step 2: Create WriteWordsView.jsx**

```jsx
// src/topics/renderers/propis/WriteWordsView.jsx
import { useMemo, useState, useCallback } from "react";
import WordAnimatedCard from "./WordAnimatedCard.jsx";
import { buildWordTrajectory } from "./wordEngine.js";

// Same alphabetical grouping PropisPracticeView and the app's magnetic_alphabet
// keyboard both use, for a consistent layout across topics.
const ABV_ROWS = [
  ["А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "И", "Й"],
  ["К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф"],
  ["Х", "Ц", "Ч", "Ш", "Щ", "Ъ", "Ы", "Ь", "Э", "Ю", "Я"],
];

export default function WriteWordsView({ task, onClose }) {
  const lettersByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.letters ?? []) map.set(item.label ?? item.id, item);
    return map;
  }, [task]);

  const connectorsByKey = useMemo(() => {
    const map = new Map();
    for (const item of task?.connectors ?? []) map.set(`${item.fromLine}_${item.toLine}`, item);
    return map;
  }, [task]);

  const [word, setWord] = useState("");
  const [caseMode, setCaseMode] = useState("lower");

  const trajectory = useMemo(() => {
    if (!word) return null;
    try {
      return buildWordTrajectory(word, lettersByLabel, connectorsByKey);
    } catch {
      return null;
    }
  }, [word, lettersByLabel, connectorsByKey]);

  const handleKey = useCallback((letter) => {
    const ch = caseMode === "upper" ? letter : letter.toLowerCase();
    setWord((w) => w + ch);
  }, [caseMode]);

  const handleBackspace = useCallback(() => {
    setWord((w) => Array.from(w).slice(0, -1).join(""));
  }, []);

  const handleClear = useCallback(() => setWord(""), []);

  return (
    <div className="propis-practice-stage">
      <button type="button" className="propis-ctrl-btn propis-practice-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-practice-frame">
        <div className="propis-practice-demo">
          {trajectory
            ? <WordAnimatedCard trajectory={trajectory} />
            : <div className="propis-practice-empty">Набери слово внизу — здесь появится анимация письма</div>}
        </div>

        <div className="propis-word-row">
          <div className="propis-word-preview">{word || " "}</div>
          <button type="button" className="propis-word-btn" onClick={handleBackspace} disabled={!word} aria-label="Стереть букву">←</button>
          <button type="button" className="propis-word-btn" onClick={handleClear} disabled={!word}>Очистить</button>
        </div>

        <div className="propis-practice-keyboard">
          <div className="propis-case-toggle" role="group" aria-label="Регистр">
            <button
              type="button"
              className={`propis-case-btn${caseMode === "upper" ? " propis-case-btn--active" : ""}`}
              onClick={() => setCaseMode("upper")}
            >
              <span className="propis-case-arrow">▲</span>
              ЗАГЛАВНАЯ
            </button>
            <button
              type="button"
              className={`propis-case-btn${caseMode === "lower" ? " propis-case-btn--active" : ""}`}
              onClick={() => setCaseMode("lower")}
            >
              <span className="propis-case-arrow">▼</span>
              строчная
            </button>
          </div>

          <div className="propis-key-rows">
            {ABV_ROWS.map((row, ri) => (
              <div className="propis-key-row" key={ri}>
                {row.map((l) => (
                  <button
                    type="button"
                    key={l}
                    className="propis-key"
                    onClick={() => handleKey(l)}
                  >
                    {caseMode === "upper" ? l : l.toLowerCase()}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Lint**

```bash
npm run lint -- --quiet
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/propis/WriteWordsView.jsx src/topics/renderers/propis/propis.css
git commit -m "feat(propis): add WriteWordsView — word input + assembled animation"
```

---

## Task 9: index.jsx — dispatch write_words to WriteWordsView

**Files:**
- Modify: `src/topics/renderers/propis/index.jsx`

- [ ] **Step 1: Add the new case**

Replace the entire contents of `src/topics/renderers/propis/index.jsx` with:

```jsx
import "./propis.css";
import PropisPracticeView from "./PropisPracticeView";
import PropisShowView from "./PropisShowView";
import WriteWordsView from "./WriteWordsView";

export default function PropisRenderer({ task, onAdvance, onClose }) {
  if (!task) return null;

  switch (task.type) {
    case "practice":
      return <PropisPracticeView task={task} onAdvance={onAdvance} onClose={onClose} />;
    case "show":
      return <PropisShowView task={task} onAdvance={onAdvance} onClose={onClose} />;
    case "write_words":
      return <WriteWordsView task={task} onClose={onClose} />;
    default:
      return <PropisPracticeView task={task} onAdvance={onAdvance} onClose={onClose} />;
  }
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- --quiet
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/propis/index.jsx
git commit -m "feat(propis): wire write_words mode into the renderer"
```

---

## Task 10: tools/propis/topic.json — add the write_words mode

**Files:**
- Modify: `tools/propis/topic.json`

- [ ] **Step 1: Add the mode entry and bump the version**

In `tools/propis/topic.json`, change:

```json
  "meta": {
    "id": "propis",
    "version": "1.2.0",
```

to:

```json
  "meta": {
    "id": "propis",
    "version": "1.3.0",
```

Then find the `"modes"` array (currently a single `"practice"` entry) and add a second entry after it:

```json
  "modes": [
    {
      "id": "practice",
      "type": "practice",
      "evaluation": "none",
      "ui": {
        "title": "Учим буквы",
        "instruction": "Нажимай на букву внизу — смотри, как она пишется"
      },
      "methodology": {
        "text": "Вертикальный экран: клавиатура алфавита внизу (со своим переключателем регистра, без пробела — он тут не нужен), крупный зацикленный образец написания выбранной буквы сверху. Ребёнок сам выбирает, какие буквы смотреть и в каком порядке.",
        "tips": [
          "Буквы без записанного образца показаны на клавиатуре неактивными.",
          "Анимация не останавливается — можно спокойно рассматривать нужный штрих сколько угодно раз.",
          "Переключатель слева — регистр (заглавная/строчная), это не буква и не пробел."
        ],
        "duration": "5–10 минут"
      }
    },
    {
      "id": "write_words",
      "type": "write_words",
      "evaluation": "none",
      "ui": {
        "title": "Написание слов",
        "instruction": "Набери слово на клавиатуре — посмотри, как оно пишется целиком"
      },
      "methodology": {
        "text": "Ребёнок набирает слово буква за буквой на той же алфавитной клавиатуре, что и в режиме «Учим буквы» (с переключателем регистра). Приложение автоматически собирает и зацикленно проигрывает рукописную анимацию всего слова, вставляя между буквами либо прямой переход, либо заранее нарисованный соединительный штрих — в зависимости от того, на какой высоте заканчивается одна буква и начинается следующая.",
        "tips": [
          "Регистр переключается перед вводом каждой буквы отдельно — это обычный тумблер, не Shift.",
          "Клавиатура полностью активна — все буквы уже записаны рукой.",
          "«←» стирает последнюю букву, «Очистить» — сбрасывает слово целиком."
        ],
        "duration": "5–10 минут"
      }
    }
  ],
```

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

Import/refresh the propis deck in the running app (per the project's existing local-import flow), open the topic, confirm "Написание слов" now appears as a selectable mode alongside "Учим буквы", and that typing a short word from the currently-captured letters (e.g. any combination of Б, б, В, в, А, а, Г, г) produces a looping animation in `WriteWordsView` without console errors (missing-connector cases fall back to a straight line, per Global Constraints — that is expected, not a bug, until more connectors are captured).

- [ ] **Step 3: Commit**

```bash
git add tools/propis/topic.json
git commit -m "feat(propis): add write_words mode entry, bump deck to v1.3.0"
```

---

## Task 11: Rebuild the propis deck ZIP and update the catalog

**Files:**
- Create: `scripts/build-propis-deck.mjs`
- Create (generated): `public/decks/propis_v1.3.0.zip`
- Modify: `public/decks/catalog.json`

Per the project's deck-versioning convention: the deck's `meta.version`, the ZIP filename, and the catalog entry all change together — the old `propis_v1.2.0.zip` URL is never overwritten, so anyone who already installed it keeps working until they update.

- [ ] **Step 1: Write the build script**

```js
// scripts/build-propis-deck.mjs
import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const TOPIC_PATH = "tools/propis/topic.json";
const EXPECTED_VERSION = "1.3.0";
const ZIP_PATH = `public/decks/propis_v${EXPECTED_VERSION}.zip`;
const CATALOG_PATH = "public/decks/catalog.json";

const topic = JSON.parse(readFileSync(TOPIC_PATH, "utf-8"));
if (topic.meta.version !== EXPECTED_VERSION) {
  throw new Error(
    `${TOPIC_PATH} meta.version is "${topic.meta.version}", expected "${EXPECTED_VERSION}". ` +
    "Bump meta.version (and this script's EXPECTED_VERSION for the next release) before building."
  );
}

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(1)} KB, ${topic.cards.length} cards, ${topic.modes.length} modes)`);

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
const idx = catalog.decks.findIndex((d) => d.id === "propis");
if (idx === -1) throw new Error(`"propis" entry not found in ${CATALOG_PATH}`);
catalog.decks[idx] = {
  ...catalog.decks[idx],
  version: EXPECTED_VERSION,
  url: `./decks/propis_v${EXPECTED_VERSION}.zip`,
};
writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
console.log(`✓ ${CATALOG_PATH} updated to v${EXPECTED_VERSION}`);
```

- [ ] **Step 2: Run it**

```bash
node scripts/build-propis-deck.mjs
```

Expected output: two `✓` lines confirming the new zip and updated catalog entry. Confirm `public/decks/propis_v1.3.0.zip` now exists and `public/decks/propis_v1.2.0.zip` still exists unchanged (`git status` should show the old zip untouched).

- [ ] **Step 3: Verify the zip contents**

```bash
node -e '
const JSZip = require("jszip");
const fs = require("fs");
JSZip.loadAsync(fs.readFileSync("public/decks/propis_v1.3.0.zip")).then(async (z) => {
  const topic = JSON.parse(await z.file("topic.json").async("string"));
  console.log("version:", topic.meta.version, "modes:", topic.modes.map((m) => m.id));
});
'
```

Expected: `version: 1.3.0 modes: [ 'practice', 'write_words' ]`

- [ ] **Step 4: Commit**

```bash
git add scripts/build-propis-deck.mjs public/decks/propis_v1.3.0.zip public/decks/catalog.json
git commit -m "chore(propis): build v1.3.0 deck zip with write_words mode"
```

---

## Final check: full test suite + lint

- [ ] **Run everything once more before wrapping up**

```bash
npx vitest run src/topics/renderers/propis
npm run lint -- --quiet
```

Expected: all propis tests pass, 0 lint errors.
