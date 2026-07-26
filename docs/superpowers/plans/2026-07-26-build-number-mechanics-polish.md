# Build Number Mechanics Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish `BuildNumberTask.jsx` ("Собери число") as a standalone tool by implementing the three remaining items from the 2026-07-23 mechanic roadmap: a directional (больше/меньше) hint on a wrong tens/ones digit, a highlight on the coin zone matching the currently-active answer question, and a visual recede for completed checklist rows once the answer step begins.

**Architecture:** All three changes are contained to `BuildNumberTask.jsx` (state + JSX) and its two stylesheets (`place_value.css`, `coins.css`, both already loaded by this component). No new files, no changes to `engine.js` (task generation is untouched — this is presentation/feedback only), no changes to sibling modes (`identify_number`, `regroup_ten`) or to `column_arithmetic`.

**Tech Stack:** React 19, plain CSS. No test harness exists yet for this component — this plan adds one (same raw `react-dom/client` + `act` pattern as `compareMode.smoke.test.jsx` in the same directory), since manual browser verification is blocked in this environment (no working backend/account — see `docs/superpowers/specs/2026-07-26-column-borrow-discrimination-design.md`'s own "Отклонения при реализации" for the same limitation on a different component).

## Global Constraints

- Scope is `BuildNumberTask.jsx` only. Do not touch `identify_number`/`regroup_ten`/`column_arithmetic` — this session explicitly decided `build_number` is a standalone, optional track, not a prerequisite bridge to column arithmetic.
- Reuse existing visual language, don't invent new colors/keyframes: the zone highlight reuses `pv-checklist-box-pulse` (already used by `.pv-answer-slot--active`); the wrong-answer hint uses the same red (`#ef4444`/`#fef2f2`) already used for `.pv-answer-slot--shake` and the rest of the app's error color convention.
- Every new animation gets a `prefers-reduced-motion: reduce` override, matching every existing animated rule in both stylesheets.
- Design spec: [`docs/superpowers/specs/2026-07-26-build-number-mechanics-polish-design.md`](../specs/2026-07-26-build-number-mechanics-polish-design.md).

---

## Task 1: Directional wrong-answer hint

**Files:**
- Modify: `src/topics/renderers/column_addition/BuildNumberTask.jsx` (new state, `flashRowWrong`, `handleTensDigit`/`handleOnesDigit`, `AnswerSlot`, `tensAnswer`/`onesAnswer`, `Workspace`'s `AnswerSlot` calls)
- Modify: `src/topics/renderers/column_addition/place_value.css` (`.pv-answer-slot` gets `position: relative`, new `.pv-answer-hint` rule)
- Test: `src/topics/renderers/column_addition/buildNumber.smoke.test.jsx` (new file)

**Interfaces:**
- Produces: `AnswerSlot` accepts a new `hint: "more" | "less" | null` prop, rendered as a small plaque above the slot when set.

- [ ] **Step 1: Write the failing test**

`BuildNumberTask`'s "collect" step is driven by **dnd-kit drag**, not a tap — unlike
everything in `compareMode.smoke.test.jsx` (entirely tap-driven). jsdom + raw DOM dispatch
cannot reliably simulate dnd-kit's pointer-sensor drag sequence, so this test does not
attempt to automate the collect/group phases to reach `answerTens` from a cold mount. Instead
it tests the wrong-answer hint at the unit level — extract the direction decision into a
small pure function (`hintDirectionFor`, added in Step 3 below) and unit-test that directly
— plus one trivial mount smoke test that catches any typo/syntax regression across all three
tasks in this plan.

Create `src/topics/renderers/column_addition/buildNumber.smoke.test.jsx`:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import BuildNumberTask, { hintDirectionFor } from "./BuildNumberTask.jsx";

describe("hintDirectionFor", () => {
  it("returns 'more' when the guess is below the target", () => {
    expect(hintDirectionFor(1, 3)).toBe("more");
  });

  it("returns 'less' when the guess is above the target", () => {
    expect(hintDirectionFor(5, 3)).toBe("less");
  });
});

describe("BuildNumberTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  it("mounts without crashing", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 23, target: { tens: 2, ones: 3 } };
    act(() => {
      root.render(<BuildNumberTask task={task} onCorrect={() => {}} onMistake={() => {}} onFlashIncorrect={() => {}} />);
    });
    expect(container.querySelector(".pv-checklist-item")).toBeTruthy();
  });
});
```

This is narrower than `compareMode.smoke.test.jsx`'s full-interaction style, and that's the
correct call here — `BuildNumberTask`'s primary interaction (drag-and-drop) isn't practically
testable at this level; don't force it. (a) unit-tests the pure direction-decision function
that Step 3 below extracts, and (b) keeps one trivial smoke-mount test proving the component
still renders.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/topics/renderers/column_addition/buildNumber.smoke.test.jsx --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**"`
Expected: FAIL — `hintDirectionFor` is not exported from `BuildNumberTask.jsx` yet.

- [ ] **Step 3: Implement `hintDirectionFor` and wire it into the digit handlers**

In `src/topics/renderers/column_addition/BuildNumberTask.jsx`, find:

```jsx
export default function BuildNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
```

Insert immediately **before** it (module scope, alongside `DIGITS`):

```jsx
// Exported for its own unit test — direction is purely a function of the
// wrong digit vs the target, no component state involved.
export function hintDirectionFor(guess, target) {
  return guess < target ? "more" : "less";
}
```

Find:

```js
  const [rowWrong, setRowWrong] = useState({ collect: false, group: false, tens: false, ones: false });
```

Replace with:

```js
  const [rowWrong, setRowWrong] = useState({ collect: false, group: false, tens: false, ones: false });
  const [hintDirection, setHintDirection] = useState({ tens: null, ones: null });
```

Find:

```js
  function flashRowWrong(key, extra) {
    setRowWrong((w) => ({ ...w, [key]: true }));
    if (extra) extra(true);
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => {
      setRowWrong((w) => ({ ...w, [key]: false }));
      if (extra) extra(false);
    }, 500);
  }
```

Replace with:

```js
  // `direction` is only ever passed for the two digit-answer rows
  // ("tens"/"ones") — "collect"/"group" calls omit it, and the hint state
  // update is skipped entirely for those (there's no single wrong "digit"
  // to give a direction for when the mistake is a coin total/grouping
  // mismatch). The hint clears on its own longer timer (1300ms) than the
  // row shake (500ms) — the shake is a quick flash, the hint needs to
  // actually be read.
  function flashRowWrong(key, extra, direction) {
    setRowWrong((w) => ({ ...w, [key]: true }));
    if (extra) extra(true);
    if (direction) setHintDirection((h) => ({ ...h, [key]: direction }));
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => {
      setRowWrong((w) => ({ ...w, [key]: false }));
      if (extra) extra(false);
    }, 500);
    if (direction) {
      setTimeout(() => {
        setHintDirection((h) => ({ ...h, [key]: null }));
      }, 1300);
    }
  }
```

Find:

```js
  function handleTensDigit(d) {
    if (phase !== "answerTens") return;
    if (d === task.target.tens) {
      setPhase("answerOnes");
    } else {
      flashRowWrong("tens");
    }
  }

  function handleOnesDigit(d) {
    if (phase !== "answerOnes") return;
    if (d === task.target.ones) {
      setPhase("done");
      setTimeout(() => onCorrect(task.conceptId, task.cardId), 900);
    } else {
      flashRowWrong("ones");
    }
  }
```

Replace with:

```js
  function handleTensDigit(d) {
    if (phase !== "answerTens") return;
    if (d === task.target.tens) {
      setPhase("answerOnes");
    } else {
      flashRowWrong("tens", undefined, hintDirectionFor(d, task.target.tens));
    }
  }

  function handleOnesDigit(d) {
    if (phase !== "answerOnes") return;
    if (d === task.target.ones) {
      setPhase("done");
      setTimeout(() => onCorrect(task.conceptId, task.cardId), 900);
    } else {
      flashRowWrong("ones", undefined, hintDirectionFor(d, task.target.ones));
    }
  }
```

- [ ] **Step 4: Thread the hint into `tensAnswer`/`onesAnswer` and `AnswerSlot`**

Find:

```js
  const tensAnswer = {
    value: tensDone ? task.target.tens : null,
    state: tensDone ? "filled correct" : rowWrong.tens ? "shake" : phase === "answerTens" ? "active" : undefined,
  };
  const onesAnswer = {
    value: onesDone ? task.target.ones : null,
    state: onesDone ? "filled correct" : rowWrong.ones ? "shake" : phase === "answerOnes" ? "active" : undefined,
  };
```

Replace with:

```js
  const tensAnswer = {
    value: tensDone ? task.target.tens : null,
    state: tensDone ? "filled correct" : rowWrong.tens ? "shake" : phase === "answerTens" ? "active" : undefined,
    hint: hintDirection.tens,
  };
  const onesAnswer = {
    value: onesDone ? task.target.ones : null,
    state: onesDone ? "filled correct" : rowWrong.ones ? "shake" : phase === "answerOnes" ? "active" : undefined,
    hint: hintDirection.ones,
  };
```

Find:

```jsx
function AnswerSlot({ show, state, value }) {
  if (!show) return null;
  // `state` may carry more than one modifier word (e.g. "filled correct")
  // — each becomes its own pv-answer-slot--x class, not one bogus
  // "pv-answer-slot--filled correct" (a real bug caught while building the
  // visual mockup for this exact change, before it reached this file).
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-answer-slot--${s}`).join("");
  return <div className={`pv-answer-slot${cls}`}>{value ?? "?"}</div>;
}
```

Replace with:

```jsx
function AnswerSlot({ show, state, value, hint }) {
  if (!show) return null;
  // `state` may carry more than one modifier word (e.g. "filled correct")
  // — each becomes its own pv-answer-slot--x class, not one bogus
  // "pv-answer-slot--filled correct" (a real bug caught while building the
  // visual mockup for this exact change, before it reached this file).
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-answer-slot--${s}`).join("");
  return (
    <div className={`pv-answer-slot${cls}`}>
      {value ?? "?"}
      {hint && <div className="pv-answer-hint">{hint === "more" ? "Больше ↑" : "Меньше ↓"}</div>}
    </div>
  );
}
```

Find (inside `Workspace`):

```jsx
            <AnswerSlot show={showAnswerSlots} state={tensAnswer.state} value={tensAnswer.value} />
```

Replace with:

```jsx
            <AnswerSlot show={showAnswerSlots} state={tensAnswer.state} value={tensAnswer.value} hint={tensAnswer.hint} />
```

Find:

```jsx
            <AnswerSlot show={showAnswerSlots} state={onesAnswer.state} value={onesAnswer.value} />
```

Replace with:

```jsx
            <AnswerSlot show={showAnswerSlots} state={onesAnswer.state} value={onesAnswer.value} hint={onesAnswer.hint} />
```

- [ ] **Step 5: CSS for the hint plaque**

In `src/topics/renderers/column_addition/place_value.css`, find:

```css
.pv-answer-slot {
  width: 52px;
  height: 60px;
  border: 2.5px dashed #94a3b8;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  background: rgba(255, 255, 255, 0.6);
  color: #1a1a2e;
}
```

Replace with:

```css
.pv-answer-slot {
  position: relative;
  width: 52px;
  height: 60px;
  border: 2.5px dashed #94a3b8;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  background: rgba(255, 255, 255, 0.6);
  color: #1a1a2e;
}

/* Directional hint on a wrong digit — never names the digit itself, only
   which way to move. Sits above the slot so it doesn't cover the numpad or
   push any layout around. Same red as .pv-answer-slot--shake, paler
   background so it reads as a message, not a second error flash. */
.pv-answer-hint {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  font-family: 'Neucha', cursive;
  font-size: 15px;
  white-space: nowrap;
  color: #b91c1c;
  background: #fef2f2;
  border: 1.5px solid #ef4444;
  animation: pv-answer-hint-in 0.2s ease-out;
  z-index: 2;
}

@keyframes pv-answer-hint-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

Find the existing reduced-motion block:

```css
@media (prefers-reduced-motion: reduce) {
  .pv-answer-slot--active { animation: none; }
}
```

Replace with:

```css
@media (prefers-reduced-motion: reduce) {
  .pv-answer-slot--active { animation: none; }
  .pv-answer-hint { animation: none; }
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/topics/renderers/column_addition/buildNumber.smoke.test.jsx --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**"`
Expected: PASS — both `hintDirectionFor` tests and the mount smoke test.

- [ ] **Step 7: Build sanity check**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/topics/renderers/column_addition/BuildNumberTask.jsx src/topics/renderers/column_addition/place_value.css src/topics/renderers/column_addition/buildNumber.smoke.test.jsx
git commit -m "feat(build_number): directional больше/меньше hint on a wrong tens/ones digit"
```

---

## Task 2: Highlight the coin zone matching the active answer question

**Files:**
- Modify: `src/topics/renderers/column_addition/BuildNumberTask.jsx` (`Workspace`'s zone `className`s)
- Modify: `src/topics/renderers/column_addition/coins.css` (`.cb-area--focus`)

**Interfaces:**
- Consumes: `tensAnswer.state`/`onesAnswer.state` (already computed in Task 1, produced by the parent component, already passed into `Workspace` today) — `"active"` is the exact same flag that already drives the answer slot's own pulse, reused here rather than adding a new prop.

- [ ] **Step 1: Add the focus class to the two coin zones**

In `src/topics/renderers/column_addition/BuildNumberTask.jsx`, find (inside `Workspace`):

```jsx
            <div
              className={`cb-stacks-area${errorZones.tens ? " cb-area--error" : ""}${capacityFlash.tens ? " cb-area--capacity" : ""}`}
              ref={stacksAreaRef}
            >
```

Replace with:

```jsx
            <div
              className={`cb-stacks-area${errorZones.tens ? " cb-area--error" : ""}${capacityFlash.tens ? " cb-area--capacity" : ""}${tensAnswer.state === "active" ? " cb-area--focus" : ""}`}
              ref={stacksAreaRef}
            >
```

Find:

```jsx
            <div
              className={`cb-loose-area${errorZones.ones ? " cb-area--error" : ""}${capacityFlash.ones ? " cb-area--capacity" : ""}`}
              ref={looseAreaRef}
            >
```

Replace with:

```jsx
            <div
              className={`cb-loose-area${errorZones.ones ? " cb-area--error" : ""}${capacityFlash.ones ? " cb-area--capacity" : ""}${onesAnswer.state === "active" ? " cb-area--focus" : ""}`}
              ref={looseAreaRef}
            >
```

- [ ] **Step 2: CSS**

In `src/topics/renderers/column_addition/coins.css`, find:

```css
.cb-area--capacity {
  animation: pv-shake 0.4s ease-in-out;
  outline: 2px solid #d97706;
  outline-offset: 2px;
  border-radius: 10px;
  background: rgba(217, 119, 6, 0.08);
}
```

Insert immediately after it:

```css

/* Directs attention to the zone the currently-active "Сколько...?"
   question refers to — same pulse .pv-answer-slot--active already uses
   (pv-checklist-box-pulse, defined in place_value.css, loaded alongside
   this file), not a new animation. Outline (not border/box-shadow alone)
   matches the .cb-area--error/--capacity pattern above so all three read
   as the same family of zone-state marker. */
.cb-area--focus {
  border-radius: 10px;
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  animation: pv-checklist-box-pulse 1.8s ease-in-out infinite;
}
```

Find the existing reduced-motion block:

```css
@media (prefers-reduced-motion: reduce) {
  .cb-pile-coin--top { animation: none; }
  .cb-coin--groupable { animation: pv-pop 0.22s ease-out both; }
}
```

Replace with:

```css
@media (prefers-reduced-motion: reduce) {
  .cb-pile-coin--top { animation: none; }
  .cb-coin--groupable { animation: pv-pop 0.22s ease-out both; }
  .cb-area--focus { animation: none; }
}
```

- [ ] **Step 3: Build sanity check**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Run the existing smoke test (regression check)**

Run: `npx vitest run src/topics/renderers/column_addition/buildNumber.smoke.test.jsx --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**"`
Expected: PASS (unaffected — this task doesn't touch `hintDirectionFor` or the mount path's structure).

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/column_addition/BuildNumberTask.jsx src/topics/renderers/column_addition/coins.css
git commit -m "feat(build_number): highlight the coin zone matching the active answer question"
```

---

## Task 3: De-emphasize completed checklist rows once the answer step begins

**Files:**
- Modify: `src/topics/renderers/column_addition/BuildNumberTask.jsx` (`.pv-checklist` container class)
- Modify: `src/topics/renderers/column_addition/place_value.css` (`.pv-checklist-item` transition, new `.pv-checklist--focused .pv-checklist-item.is-done` rule)

- [ ] **Step 1: Add the `--focused` modifier to the checklist container**

In `src/topics/renderers/column_addition/BuildNumberTask.jsx`, find:

```jsx
        <div className="pv-checklist">
```

Replace with:

```jsx
        <div className={`pv-checklist${showAnswerSlots ? " pv-checklist--focused" : ""}`}>
```

- [ ] **Step 2: CSS — extend the base transition, add the recede rule**

In `src/topics/renderers/column_addition/place_value.css`, find:

```css
.pv-checklist-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: transform 0.15s ease;
  animation: pv-checklist-item-in 0.4s cubic-bezier(.34, 1.2, .64, 1) both;
}
```

Replace with:

```css
.pv-checklist-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: transform 0.15s ease, opacity 0.25s ease;
  animation: pv-checklist-item-in 0.4s cubic-bezier(.34, 1.2, .64, 1) both;
}

/* Once the answer step (Сколько десятков?/единиц?) begins, the earlier
   done rows recede — still readable (they stay struck-through, not
   hidden), just no longer competing for attention with the counting the
   child is doing right now. */
.pv-checklist--focused .pv-checklist-item.is-done {
  opacity: 0.5;
  transform: scale(0.92);
}
```

- [ ] **Step 3: Build sanity check**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Run the existing smoke test (regression check)**

Run: `npx vitest run src/topics/renderers/column_addition/buildNumber.smoke.test.jsx --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/column_addition/BuildNumberTask.jsx src/topics/renderers/column_addition/place_value.css
git commit -m "style(build_number): recede completed checklist rows once the answer step begins"
```

---

## Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**"`
Expected: same baseline pass/fail counts as established earlier this session (the known-unrelated `FingerSystem`/`comparison`/`function_cards`/`reading`/`RewardVideoModal`/`format`/`activeSession`/`backend`/`topicLoader "addition/subtraction procedural cards"` failures — none of them touch files this plan modifies), plus the new `buildNumber.smoke.test.jsx` tests passing.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 3: Manual verification note**

Same limitation as every other UI change this session — no working backend/account in this
dev environment to reach the real screen live. Rely on: the design spec's reasoning, the
unit test for `hintDirectionFor`, the mount smoke test, and the build check above. If a
future session has a working backend + account, do a real pass: trigger a wrong tens digit
and confirm the "Больше"/"Меньше" plaque appears above the slot and fades after ~1.3s;
confirm the tens coin zone pulses blue while "Сколько десятков?" is active and the ones
zone pulses while "Сколько единиц?" is active; confirm the collect/group rows visibly
shrink and fade once the first answer slot appears.

- [ ] **Step 4: Note deviations in the spec, if any**

If anything changed from `docs/superpowers/specs/2026-07-26-build-number-mechanics-polish-design.md` during implementation, append a short note there and commit it alongside the code.
