# write_text Tap-to-Animate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In propis's "Пишем текст" (write_text) mode, tapping an already-typed word on the notebook grid plays that word's cursive handwriting as a continuously looping animation — the same visual write_words already uses — with one word active at a time, tap-to-toggle, and any text edit clearing the selection.

**Architecture:** Extract the animation markup (background outline + animated strokes + pen tip, driven by the existing `useLoopingStrokes` hook) out of `WordAnimatedCard.jsx` into a new standalone `AnimatedStrokes.jsx` component that renders just an SVG `<g>`, no `<svg>`/`viewBox` of its own. `WordAnimatedCard.jsx` becomes a thin wrapper (unchanged behavior). `WriteTextView.jsx` tracks which word index is "active" and swaps that one word's cursive segment(s) to render via `AnimatedStrokes` instead of a plain static path.

**Tech Stack:** React (function components, hooks), plain SVG (no charting/animation library — hand-rolled requestAnimationFrame loop already exists in `useLoopingStrokes.js`).

## Global Constraints

- No changes to `wordEngine.js`/`layoutTextIntoRows` — word width for the tap hit-target is derived client-side from `segments[].width`, already returned per segment.
- No behavior change to `write_words`' own rendering — Task 1 is a pure extraction.
- One active word at a time; tapping the active word again clears it; any `text` state change clears it (see spec, `docs/superpowers/specs/2026-08-13-write-text-tap-to-animate-design.md`).
- This topic's JSX view components have no automated test coverage (only the pure-logic files — `engine.js`, `pathGeometry.js`, `propisRuling.js`, `wordEngine.js` — have `.test.js` files). Verify JSX/interaction changes live via the project's established throwaway dev-harness workflow (`docs/propis.md`'s "Verifying visual changes locally" section), not new unit tests. Always run the full `npx vitest run src/topics/renderers/propis` suite after each task regardless, to catch import/syntax breakage.
- Delete the throwaway `dev-propis.html` / `src/dev-propis-preview.jsx` files before each commit — never commit them.

---

### Task 1: Extract `AnimatedStrokes` out of `WordAnimatedCard.jsx`

**Files:**
- Create: `src/topics/renderers/propis/AnimatedStrokes.jsx`
- Modify: `src/topics/renderers/propis/WordAnimatedCard.jsx` (full file, currently 45 lines)

**Interfaces:**
- Produces: `AnimatedStrokes({ trajectory, delayMs = 200, loopPauseMs = 1400 })` — a default-exported component. `trajectory` is `{ strokes: [{ d, continuous? }], totalWidthUnits, inkWidthUnits, viewBox }` (the shape `buildWordTrajectory`/`buildWordSegments` in `wordEngine.js` already produce, and what `WordAnimatedCard`'s own `trajectory` prop already is). Renders a single `<g>` — no `<svg>` — containing: a faint (opacity 0.15) static copy of every stroke, an animated copy of every stroke (`data-pr-anim="i"`, `data-pr-continuous="1"` when `strokes[i].continuous` is truthy), and a `data-pr-tip` circle. Internally calls `useLoopingStrokes` from `./useLoopingStrokes.js`, keyed by `trajectory.strokes.map(s => s.d).join("|")`.
- Consumes: `useLoopingStrokes` from `./useLoopingStrokes.js` (already exists, unchanged), `INK_COLOR`/`NIB_COLOR`/`STROKE_W`/`TIP_R` from `./propisRuling.js` (already exist, unchanged).

- [ ] **Step 1: Read the current file to confirm nothing has changed underneath this plan**

Run: read `src/topics/renderers/propis/WordAnimatedCard.jsx` in full. It should match exactly:

```jsx
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
          <path key={`a${i}`} data-pr-anim={i} data-pr-continuous={s.continuous ? "1" : undefined}
            d={s.d} fill="none" stroke={INK_COLOR}
            strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        <circle data-pr-tip r={TIP_R} cx="0" cy="0" fill={NIB_COLOR} opacity="0" />
      </g>
    </svg>
  );
}
```

If it differs, stop and re-read this plan's assumptions before continuing — the rest of this task's diffs assume this exact starting content.

- [ ] **Step 2: Create `AnimatedStrokes.jsx`**

```jsx
import { useRef } from "react";
import { INK_COLOR, NIB_COLOR, STROKE_W, TIP_R } from "./propisRuling.js";
import { useLoopingStrokes } from "./useLoopingStrokes.js";

// Renders one trajectory's looping handwriting animation: a faint static background copy
// of every stroke, the same strokes redrawn as an animated dash-offset reveal, and a
// moving pen-tip dot. No <svg>/viewBox of its own — the caller positions it (a plain <g>
// inside its own coordinate space): WordAnimatedCard.jsx wraps it in a per-word <svg>,
// WriteTextView.jsx wraps it in a <g transform> inside its shared multi-row grid <svg>.
export default function AnimatedStrokes({ trajectory, delayMs = 200, loopPauseMs = 1400 }) {
  const gRef = useRef(null);
  const dependencyKey = trajectory.strokes.map((s) => s.d).join("|");
  useLoopingStrokes(gRef, dependencyKey, { delayMs, loopPauseMs });

  return (
    <g ref={gRef}>
      {trajectory.strokes.map((s, i) => (
        <path key={`g${i}`} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={STROKE_W}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
      ))}
      {trajectory.strokes.map((s, i) => (
        <path key={`a${i}`} data-pr-anim={i} data-pr-continuous={s.continuous ? "1" : undefined}
          d={s.d} fill="none" stroke={INK_COLOR}
          strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <circle data-pr-tip r={TIP_R} cx="0" cy="0" fill={NIB_COLOR} opacity="0" />
    </g>
  );
}
```

- [ ] **Step 3: Replace `WordAnimatedCard.jsx` with the thin wrapper**

```jsx
import { GUIDE_LINES, NATIVE_L3 } from "./propisRuling.js";
import AnimatedStrokes from "./AnimatedStrokes.jsx";

const GUIDE_THIN_W = 0.4;
const GUIDE_BOLD_W = 0.9;
const GUIDE_COLOR = "#6fa3e0";

export default function WordAnimatedCard({ trajectory }) {
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
      <AnimatedStrokes trajectory={trajectory} />
    </svg>
  );
}
```

- [ ] **Step 4: Run the full propis test suite**

Run: `npx vitest run src/topics/renderers/propis`
Expected: all test files pass (same count as before this change — this is a pure JSX refactor, no test file touches either of these two files directly, so the count must be unchanged; if it drops, something imports one of these files in a way that broke).

- [ ] **Step 5: Live-verify write_words still animates identically**

Create the throwaway dev harness (delete both files at the end of this step, before committing):

`dev-propis.html` (repo root):
```html
<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>dev-propis</title></head>
<body style="margin:0">
<div id="root"></div>
<script type="module" src="/src/dev-propis-preview.jsx"></script>
</body>
</html>
```

`src/dev-propis-preview.jsx`:
```jsx
import { createRoot } from "react-dom/client";
import WriteWordsView from "./topics/renderers/propis/WriteWordsView.jsx";
import "./topics/renderers/propis/propis.css";
import topic from "../tools/propis/topic.json";

const letters = topic.cards.filter((c) => c.type === "letter");
const connectors = topic.cards.filter((c) => c.type === "connector");

createRoot(document.getElementById("root")).render(
  <WriteWordsView
    task={{ type: "write_words", letters, connectors }}
    onClose={() => console.log("close")}
  />
);
```

Start the dev server (reuses the `dev-propis-preview` entry already in `.claude/launch.json` from earlier this session, port 8099) via the Browser pane's `preview_start` tool with `{ "name": "dev-propis-preview" }`, navigate to `http://localhost:8099/dev-propis.html`.

Since screenshots may not be visible this session (as happened earlier — the Browser pane not being displayed on the user's side blocks `computer` screenshots and `requestAnimationFrame`), verify via DOM/React-fiber inspection instead of a screenshot:

1. Type any captured word (e.g. click the on-screen keys for "мама") via `javascript_tool`, clicking each `.propis-key` button whose text matches the letter.
2. Confirm the DOM now contains, inside `.propis-practice-card-svg`: a `<g>` with child `<path>` elements at `opacity="0.15"` (the ghost), sibling `<path data-pr-anim="0">` etc., and a `<circle data-pr-tip>` — i.e. exactly the same DOM shape write_words produced before this refactor. Example check:
   ```js
   document.querySelectorAll('.propis-practice-card-svg [data-pr-anim]').length > 0 &&
   document.querySelector('.propis-practice-card-svg [data-pr-tip]') !== null
   ```
   should both be true.
3. Stop the preview server, delete `dev-propis.html` and `src/dev-propis-preview.jsx`.

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/propis/AnimatedStrokes.jsx src/topics/renderers/propis/WordAnimatedCard.jsx
git commit -m "$(cat <<'EOF'
refactor(propis): extract AnimatedStrokes out of WordAnimatedCard

Pure extraction, no behavior change — write_text's tap-to-animate
(next commit) needs the same ghost+strokes+pen-tip markup positioned
inside its own shared grid <svg> instead of a dedicated per-word one.
EOF
)"
```

---

### Task 2: Tap a word in write_text to animate it

**Files:**
- Modify: `src/topics/renderers/propis/WriteTextView.jsx` (full file, currently 218 lines)
- Modify: `src/topics/renderers/propis/propis.css` (add one rule near the existing write_text section, around line 158, right after `.propis-text-grid-svg`)

**Interfaces:**
- Consumes: `AnimatedStrokes` from `./AnimatedStrokes.jsx` (Task 1). `layout.placed[i]` items: `{ word, rowIndex, x, segments }` where `segments[j]` is either `{ type: "cursive", xOffset, trajectory, width }` or `{ type: "fallback", xOffset, text, width }` (unchanged shape from `wordEngine.js`, confirmed in Task 1's constraints — not modified by this task).
- Produces: no new exports — this is the top-level view component, already the default export of this file.

- [ ] **Step 1: Add the CSS rule for the word tap target**

In `src/topics/renderers/propis/propis.css`, immediately after the existing `.propis-text-grid-svg { ... }` block (around line 152-158), add:

```css
/* Invisible tap target covering a whole placed word — pointer-events:all is required
   because the paths/rect it sits behind use fill="none"/"transparent", which the SVG
   pointer-events model does NOT hit-test by default (only "painted" fills are). */
.propis-text-word-hit { fill: transparent; pointer-events: all; cursor: pointer; }
```

- [ ] **Step 2: Add `activeIndex` state and the text-change reset effect**

In `src/topics/renderers/propis/WriteTextView.jsx`, add the import at the top (line 1 currently reads `import { useMemo, useState, useCallback, useRef, useEffect } from "react";` — no new React imports needed, `useState`/`useEffect` are already imported). Add this import after line 2 (`import { layoutTextIntoRows } from "./wordEngine.js";`):

```js
import AnimatedStrokes from "./AnimatedStrokes.jsx";
```

Then, right after the `const [text, setText] = useState("");` / `const [caseMode, setCaseMode] = useState("lower");` pair (currently lines 65-66), add:

```js
  const [activeIndex, setActiveIndex] = useState(null);
  useEffect(() => setActiveIndex(null), [text]);
```

- [ ] **Step 3: Render the hit target and swap the active word's cursive segments to `AnimatedStrokes`**

Replace the current placed-words rendering block (currently lines 137-159):

```jsx
            {layout.placed.map((p, i) => (
              <g key={i} transform={`translate(${p.x} ${p.rowIndex * UNIT_H})`}>
                {p.segments.map((seg, si) =>
                  seg.type === "cursive" ? (
                    <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                      {seg.trajectory.strokes.map((s, ssi) => (
                        <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                    </g>
                  ) : (
                    <text
                      key={si}
                      x={seg.xOffset} y={NATIVE_L3}
                      fontSize={FALLBACK_FONT_SIZE}
                      fontFamily="system-ui, sans-serif"
                      fill={INK_COLOR}
                    >
                      {seg.text}
                    </text>
                  )
                )}
              </g>
            ))}
```

with:

```jsx
            {layout.placed.map((p, i) => {
              const wordWidth = p.segments.reduce((sum, seg) => sum + seg.width, 0);
              const isActive = i === activeIndex;
              return (
                <g key={i} transform={`translate(${p.x} ${p.rowIndex * UNIT_H})`}>
                  <rect
                    className="propis-text-word-hit"
                    x={-4} y={0} width={wordWidth + 8} height={UNIT_H}
                    onClick={() => setActiveIndex((cur) => (cur === i ? null : i))}
                  />
                  {p.segments.map((seg, si) =>
                    seg.type === "cursive" ? (
                      <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                        {isActive ? (
                          <AnimatedStrokes trajectory={seg.trajectory} />
                        ) : (
                          seg.trajectory.strokes.map((s, ssi) => (
                            <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          ))
                        )}
                      </g>
                    ) : (
                      <text
                        key={si}
                        x={seg.xOffset} y={NATIVE_L3}
                        fontSize={FALLBACK_FONT_SIZE}
                        fontFamily="system-ui, sans-serif"
                        fill={INK_COLOR}
                      >
                        {seg.text}
                      </text>
                    )
                  )}
                </g>
              );
            })}
```

- [ ] **Step 4: Run the full propis test suite**

Run: `npx vitest run src/topics/renderers/propis`
Expected: same pass count as after Task 1 — this task touches only JSX with no direct test file, so no test count change is expected, but a broken import/syntax error would surface here as a failure to collect the suite at all.

- [ ] **Step 5: Live-verify the full interaction set**

Recreate the throwaway dev harness (same two files as Task 1 Step 5, but pointing at `WriteTextView` instead of `WriteWordsView` — this is exactly the harness used earlier this session for the row-wrap/backspace verification):

`dev-propis.html` — identical to Task 1 Step 5.

`src/dev-propis-preview.jsx`:
```jsx
import { createRoot } from "react-dom/client";
import WriteTextView from "./topics/renderers/propis/WriteTextView.jsx";
import "./topics/renderers/propis/propis.css";
import topic from "../tools/propis/topic.json";

const letters = topic.cards.filter((c) => c.type === "letter");
const connectors = topic.cards.filter((c) => c.type === "connector");

createRoot(document.getElementById("root")).render(
  <WriteTextView
    task={{ type: "write_text", letters, connectors }}
    onClose={() => console.log("close")}
  />
);
```

Start it via `preview_start` with `{ "name": "dev-propis-preview" }`, navigate to `http://localhost:8099/dev-propis.html`. Use `javascript_tool` for everything below — do not rely on `computer` screenshots or `requestAnimationFrame`-based waits (both were unreliable earlier this session when the Browser pane wasn't visible on the user's side).

To read `activeIndex` and confirm DOM state, use the same React-fiber-walk technique used earlier this session (find the `WriteTextView` fiber via `document.getElementById('root')`'s `__reactContainer$...` key → `.stateNode.current`, walk `.child`/`.sibling` for `f.type.name === 'WriteTextView'`, then walk `.memoizedState` hook-by-hook). Because Step 2/3 add one new `useState` and one new `useEffect` hook, **the hook index positions from earlier in this session have shifted by two** — do not reuse old hardcoded indices; instead find `activeIndex`'s hook by scanning for a `memoizedState` value that is `null` or a small integer at a position after `text`/`caseMode`, or more robustly, find it by elimination (log all hook values with their JS `typeof`/shape and identify which one changes after a click).

Test sequence:
1. Click letters to type `"мама папа"` (space-separated), same technique as before (click each `.propis-key` button by matching its text).
2. Read `layout.placed` (already known to be at the hook whose `memoizedState[0]` has a `rowCount`/`placed` shape) — confirm 2 words placed, note their indices (0 and 1).
3. Click the `<rect class="propis-text-word-hit">` inside the first word's `<g>` (query `document.querySelectorAll('.propis-text-word-hit')[0]`), then re-read hooks: `activeIndex` must now be `0`. Confirm the DOM: the first word's `<g>` now contains a `[data-pr-anim]` element and a `[data-pr-tip]` circle; the second word's `<g>` does not.
4. Click the same rect again (`[0]`): `activeIndex` must be back to `null`. Confirm no `[data-pr-anim]`/`[data-pr-tip]` remain anywhere in the grid SVG.
5. Click the second word's hit rect (`[1]`): `activeIndex` must be `1`. Confirm `[data-pr-anim]`/`[data-pr-tip]` now exist inside the *second* word's `<g>` only.
6. With word 1 still active, click one more letter key (anything) to append to the text: re-read `activeIndex`, confirm it is `null` again (the text-change effect fired) and no `[data-pr-anim]`/`[data-pr-tip]` remain.
7. Click `Очистить`, then type `"1 мама"` (digit, space, word). Click the first word's hit rect (the lone `"1"`, a fallback-only word with no cursive segment). Confirm: no thrown error (check `read_console_messages` for new errors), `activeIndex` becomes that word's index, and no `[data-pr-anim]`/`[data-pr-tip]` appear anywhere (nothing to animate — the fallback segment renders as `<text>` exactly as before, active or not).
8. Stop the preview server, delete `dev-propis.html` and `src/dev-propis-preview.jsx`.

Note the limitation explicitly when reporting results: this verifies the *state machine and DOM wiring* are correct (which word is selected, that the right markup mounts/unmounts). It does not confirm the animation's frame-by-frame motion looks right, since `requestAnimationFrame` doesn't run while the Browser pane isn't visible on the user's side — flag that a quick visual look once deployed (or with the pane visible) is still worth doing.

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/propis/WriteTextView.jsx src/topics/renderers/propis/propis.css
git commit -m "$(cat <<'EOF'
feat(propis): write_text — tap a word to animate its handwriting

Tapping an already-typed word plays the same looping animation
write_words uses (faint background outline + moving pen tip), via the
AnimatedStrokes component extracted in the previous commit. One word
active at a time; tapping the active word again clears it; any text
edit (typing, backspace, clear) clears it too. Fallback (digit/
punctuation) segments have nothing to animate and render unchanged.

See docs/superpowers/specs/2026-08-13-write-text-tap-to-animate-design.md
EOF
)"
```

---

## Post-plan note (not a task)

Deployment is intentionally not part of this plan — ask the user before running `npm run deploy:prod`, same as every other change to this app (see `CLAUDE.md`).
