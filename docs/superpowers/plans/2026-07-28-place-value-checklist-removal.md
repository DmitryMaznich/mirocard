# Remove checklist from build_number/regroup_ten, standard font — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `BuildNumberTask.jsx`'s 4-row checklist and `RegroupTenTask.jsx`'s 1-row checklist with the same single centered swap-in-place instruction line `IdentifyNumberTask.jsx` already uses (`.pv-question`), and switch that shared element from the handwritten `Neucha` font to the app's standard `Nunito`.

**Architecture:** Both components stop rendering a `ChecklistItem`/checkbox row and instead render one `.pv-question` div whose text is derived from the component's existing phase/state (no new state needed). Once nothing renders the checklist classes, all of `place_value.css`'s `.pv-checklist*`/`.pv-check-icon` rules are dead and get deleted.

**Tech Stack:** React 19 (function components, hooks), Vitest + `react-dom/client` for the existing smoke tests, plain CSS.

## Global Constraints

- `.pv-question`'s `font-family` changes from `'Neucha', cursive` to inheriting the app's default (`"Nunito", sans-serif`, already declared on `body` in `src/styles.css:8`) — drop the override rather than repeating the value.
- `collect`/`group` in `BuildNumberTask.jsx` stay tappable (same `confirmCollect`/`confirmGroup` calls) — the instruction line itself becomes the tap target, no separate button.
- `answerTens`/`answerOnes`/`done` in `BuildNumberTask.jsx`, and the single instruction in `RegroupTenTask.jsx`, are NOT tappable — confirmed via the numpad/drag as today.
- No shake on the instruction line for wrong `answerTens`/`answerOnes` digits (matches `IdentifyNumberTask.jsx`, where only the `AnswerSlot` shakes) — shake only applies to a wrong `collect`/`group` tap.
- `fingers_count`'s own separate `fng-checklist` CSS family is out of scope — do not touch it.
- Delete dead CSS outright once nothing references it — no unused legacy rules left behind.

Spec: `docs/superpowers/specs/2026-07-28-place-value-checklist-removal-design.md`

---

### Task 1: BuildNumberTask.jsx — single instruction line

**Files:**
- Modify: `src/topics/renderers/column_addition/BuildNumberTask.jsx`
- Modify: `src/topics/renderers/column_addition/buildNumber.smoke.test.jsx`

**Interfaces:**
- Consumes: `useFitOneLine` (`./textFit.js`, unchanged signature: `(text, {max, min}) => { ref, fontSize }`), `pluralCoins`/`hintDirectionFor` (`./placeValueLabels.js`, unchanged).
- Produces: no new exports — self-contained component behavior change.

- [ ] **Step 1: Replace the smoke test file with the updated/new tests (write the failing tests first)**

Replace the entire content of `src/topics/renderers/column_addition/buildNumber.smoke.test.jsx` with:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import BuildNumberTask from "./BuildNumberTask.jsx";
import { hintDirectionFor } from "./placeValueLabels.js";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by the
// instruction line's text sizing) needs one. A no-op stub is enough — this
// test doesn't assert on live-resize font shrinking.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

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

  function mount(task, handlers = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <BuildNumberTask
          task={task}
          onCorrect={handlers.onCorrect ?? (() => {})}
          onMistake={handlers.onMistake ?? (() => {})}
          onFlashIncorrect={handlers.onFlashIncorrect ?? (() => {})}
        />
      );
    });
  }

  function question() {
    return container.querySelector(".pv-question");
  }

  it("mounts showing the collect instruction as a single tappable line", () => {
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 23, target: { tens: 2, ones: 3 } };
    mount(task);
    expect(question().textContent).toBe("Собери 23 монеты");
    expect(question().getAttribute("role")).toBe("button");
  });

  it("advances collect -> group -> answerTens by tapping the instruction line each time", () => {
    // number: 0 lets confirming "collect" succeed with zero coins placed,
    // and confirming "group" succeed with zero grouping needed, reaching
    // answerTens without simulating a dnd-kit drag.
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 0, target: { tens: 0, ones: 0 } };
    mount(task);

    expect(question().textContent).toBe("Собери 0 монет");
    act(() => { question().click(); });
    expect(question().textContent).toBe("Сложи десятки");
    act(() => { question().click(); });
    expect(question().textContent).toBe("Сколько десятков?");
    // The numpad ticks off answerTens/answerOnes, not a tap on the line —
    // no role="button" once we're past the tappable collect/group steps.
    expect(question().getAttribute("role")).toBeNull();
  });

  it("shakes the instruction line on a wrong collect tap, without advancing or calling onMistake more than once", () => {
    const onMistake = () => { onMistakeCalls += 1; };
    let onMistakeCalls = 0;
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 5, target: { tens: 0, ones: 5 } };
    mount(task, { onMistake });

    // No coins placed yet, so the collected total (0) doesn't match the
    // target (5) — tapping the instruction line should shake, not advance.
    act(() => { question().click(); });
    expect(question().className).toContain("pv-question--shake");
    expect(question().textContent).toBe("Собери 5 монет");
    expect(onMistakeCalls).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests and confirm the new ones fail**

Run: `npx vitest run src/topics/renderers/column_addition/buildNumber.smoke.test.jsx`

Expected: the three `BuildNumberTask` tests FAIL — `.pv-question` doesn't exist yet in this component (only `.pv-checklist-item` does), so `question()` returns `null` and every assertion throws. The two `hintDirectionFor` tests still pass unchanged.

- [ ] **Step 3: Implement the single instruction line in BuildNumberTask.jsx**

In `src/topics/renderers/column_addition/BuildNumberTask.jsx`:

1. Delete the `CheckIcon` and `ChecklistItem` functions entirely (currently lines 166-197):

```jsx
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pv-check-icon" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Same checklist-row-doubles-as-confirm-button idiom as fingers_count's
// ChecklistItem (FingersCountTask.jsx) — kept as a separate copy with its
// own pv-checklist-* classes rather than a shared component so the two
// families' visuals stay independently tunable. `clickable=false` is for
// the two "Сколько...?" rows: they tick themselves off once the numpad
// gets the right digit, not from a tap on the row.
function ChecklistItem({ text, state, onTap, textRef, fontSize, clickable = true }) {
  const done = state === "done";
  const wrong = state === "wrong";
  const interactive = clickable && !done;
  return (
    <div
      className={`pv-checklist-item${done ? " is-done" : ""}${wrong ? " is-wrong" : ""}${!clickable ? " is-pending" : ""}`}
      onClick={interactive ? onTap : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className="pv-checklist-box">{done && <CheckIcon />}</span>
      <span ref={textRef} className="pv-checklist-text" style={fontSize ? { fontSize } : undefined}>
        {text}
      </span>
    </div>
  );
}
```

Delete all of the above — nothing replaces it (the new instruction div is written directly in the component's `return`, see step below).

2. In `withHighlightedNumber` (still needed, keep the function), rename the highlight class. Change:

```jsx
      <span className="pv-checklist-number">{numStr}</span>
```

to:

```jsx
      <span className="pv-question-number">{numStr}</span>
```

3. Replace the four separate `useFitOneLine` calls and the shared `checklistFontSize` with one call driven by the current phase's text. Replace:

```jsx
  const groupableCount = canGroup && placed.ones >= 10 ? 10 : 0;
  const collectText = `Собери ${task.number} ${pluralCoins(task.number)}`;
  const collectContent = withHighlightedNumber(collectText, task.number);

  // Every row gets its own fit call, all sharing the same 45px ceiling
  // (3x the old compact 15px row) — a completed row keeps the same size
  // instead of shrinking away just because it's no longer the active one.
  // min lowered from 20 to 13: the checklist's left inset (see .pv-checklist
  // in place_value.css) leaves much less width for text than before, and
  // "Собери 47 монет" no longer fits on one line at 20px on a narrow
  // (~320px) phone.
  const { ref: collectRef, fontSize: collectFontSize } = useFitOneLine(collectText, { max: 45, min: 13 });
  const { ref: groupRef, fontSize: groupFontSize } = useFitOneLine("Сложи десятки", { max: 45, min: 13 });
  const { ref: tensQRef, fontSize: tensQFontSize } = useFitOneLine("Сколько десятков?", { max: 45, min: 13 });
  const { ref: onesQRef, fontSize: onesQFontSize } = useFitOneLine("Сколько единиц?", { max: 45, min: 13 });
  // One shared size for every row instead of each row keeping its own
  // independently-fitted size: a not-yet-mounted row's hook stays at its
  // initial `max` (its useLayoutEffect never ran, since it isn't in the
  // DOM to measure), so this only pulls the shared size down to whatever
  // the currently-visible rows actually need — a row that mounts later
  // and needs less room doesn't shrink the others further than necessary,
  // but "Собери N монет" (often the tightest fit) no longer renders
  // visibly smaller than a short neighboring row like "Сложи десятки".
  const checklistFontSize = Math.min(collectFontSize, groupFontSize, tensQFontSize, onesQFontSize);
```

with:

```jsx
  const groupableCount = canGroup && placed.ones >= 10 ? 10 : 0;
  const collectText = `Собери ${task.number} ${pluralCoins(task.number)}`;
  const collectContent = withHighlightedNumber(collectText, task.number);

  // Only one instruction is ever visible at a time now (matching
  // IdentifyNumberTask.jsx's own pv-question), so there's no longer a need
  // to fit multiple simultaneously-visible rows to one shared size — a
  // single useFitOneLine call on whichever text is current is enough.
  const questionText = phase === "collect" ? collectText
    : phase === "group" ? "Сложи десятки"
    : phase === "answerTens" ? "Сколько десятков?"
    : phase === "answerOnes" ? "Сколько единиц?"
    : "Правильно!";
  const questionContent = phase === "collect" ? collectContent : questionText;
  const { ref: questionRef, fontSize: questionFontSize } = useFitOneLine(questionText, { max: 45, min: 13 });

  const questionTappable = phase === "collect" || phase === "group";
  const questionTap = phase === "collect" ? confirmCollect : phase === "group" ? confirmGroup : undefined;
  const questionWrong = (phase === "collect" && rowWrong.collect) || (phase === "group" && rowWrong.group);
```

4. Replace the checklist JSX block. Replace:

```jsx
        {/* --focused is unconditional (unlike the earlier version, which only
            added it once showAnswerSlots): a done row should recede as soon
            as it's done, not wait for the answer step — same as
            IdentifyNumberTask.jsx, which applies it unconditionally too. */}
        <div className="pv-checklist pv-checklist--focused">
          <ChecklistItem
            text={collectContent}
            state={phase === "collect" ? (rowWrong.collect ? "wrong" : "active") : "done"}
            onTap={phase === "collect" ? confirmCollect : undefined}
            textRef={collectRef}
            fontSize={checklistFontSize}
          />
          {phase !== "collect" && (
            <ChecklistItem
              text="Сложи десятки"
              state={phase === "group" ? (rowWrong.group ? "wrong" : "active") : "done"}
              onTap={phase === "group" ? confirmGroup : undefined}
              textRef={groupRef}
              fontSize={checklistFontSize}
            />
          )}
          {/* These two appear one at a time, same as the rows above — the
              numpad ticks them off (clickable=false), not a tap on the row
              itself. The matching answer slot pulses (see AnswerSlot's
              "active" state, nested under its own Десятки/Единицы column)
              at the same time its question is the active one here, so the
              question and where to type the answer are visually tied
              together instead of the child having to hunt for the field. */}
          {showAnswerSlots && (
            <ChecklistItem
              text="Сколько десятков?"
              state={phase === "answerTens" ? (rowWrong.tens ? "wrong" : "active") : "done"}
              clickable={false}
              textRef={tensQRef}
              fontSize={checklistFontSize}
            />
          )}
          {(phase === "answerOnes" || phase === "done") && (
            <ChecklistItem
              text="Сколько единиц?"
              state={phase === "answerOnes" ? (rowWrong.ones ? "wrong" : "active") : "done"}
              clickable={false}
              textRef={onesQRef}
              fontSize={checklistFontSize}
            />
          )}
        </div>
```

with:

```jsx
        <div
          className={`pv-question${phase === "done" ? " pv-question--correct" : ""}${questionWrong ? " pv-question--shake" : ""}`}
          onClick={questionTappable ? questionTap : undefined}
          role={questionTappable ? "button" : undefined}
          tabIndex={questionTappable ? 0 : undefined}
        >
          <span ref={questionRef} style={{ fontSize: questionFontSize }}>{questionContent}</span>
        </div>
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/topics/renderers/column_addition/buildNumber.smoke.test.jsx`

Expected: all 5 tests PASS (2 `hintDirectionFor` + 3 `BuildNumberTask`).

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/column_addition/BuildNumberTask.jsx src/topics/renderers/column_addition/buildNumber.smoke.test.jsx
git commit -m "$(cat <<'EOF'
feat(build_number): replace the checklist with one instruction line

Matches IdentifyNumberTask's own pattern: one centered line that
swaps to the next phase's text instead of a growing checkbox
checklist. collect/group stay tappable (the line itself is now the
confirm target); answerTens/answerOnes/done stay non-interactive,
confirmed via the numpad as before.
EOF
)"
```

---

### Task 2: RegroupTenTask.jsx — single instruction line

**Files:**
- Modify: `src/topics/renderers/column_addition/RegroupTenTask.jsx`
- Modify: `src/topics/renderers/column_addition/regroupTen.smoke.test.jsx`

**Interfaces:**
- Consumes: `useFitOneLine` (unchanged).
- Produces: none — self-contained.

- [ ] **Step 1: Replace the smoke test file (write the failing test first)**

Replace the entire content of `src/topics/renderers/column_addition/regroupTen.smoke.test.jsx` with:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import RegroupTenTask from "./RegroupTenTask.jsx";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by the
// instruction line's text sizing) needs one. No-op stub.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("RegroupTenTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  it("mounts showing the instruction as a single non-interactive line", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const task = { cardId: "x", conceptId: "x", type: "regroup_ten", number: 23, initial: { tens: 2, ones: 3 }, after: { tens: 1, ones: 13 } };
    act(() => {
      root.render(<RegroupTenTask task={task} onCorrect={() => {}} />);
    });
    const question = container.querySelector(".pv-question");
    expect(question.textContent).toBe("Разменяй десяток в единицы");
    expect(question.getAttribute("role")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/topics/renderers/column_addition/regroupTen.smoke.test.jsx`

Expected: FAIL — `.pv-question` doesn't exist yet in this component (only `.pv-checklist-item` does), so `question` is `null` and `question.textContent` throws.

- [ ] **Step 3: Implement the single instruction line in RegroupTenTask.jsx**

In `src/topics/renderers/column_addition/RegroupTenTask.jsx`:

1. Delete the `CheckIcon` and `ChecklistItem` functions entirely (currently lines 24-45):

```jsx
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pv-check-icon" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Single-row checklist: this mode has exactly one action (drag the ten into
// ЕДИНИЦЫ), so there's no active/wrong state to track — only pending until
// the drag succeeds, then done. The row's own text replaces what used to be
// a separate .pv-caption line below the zones.
function ChecklistItem({ text, done, textRef, fontSize }) {
  return (
    <div className={`pv-checklist-item${done ? " is-done" : " is-pending"}`}>
      <span className="pv-checklist-box">{done && <CheckIcon />}</span>
      <span ref={textRef} className="pv-checklist-text" style={fontSize ? { fontSize } : undefined}>
        {text}
      </span>
    </div>
  );
}
```

2. Rename the fit-hook variable for clarity (it now feeds the shared `.pv-question`, not a checklist row) and replace the render block. Replace:

```jsx
  const { ref: checklistRef, fontSize: checklistFontSize } = useFitOneLine("Разменяй десяток в единицы", { max: 45, min: 13 });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen cb-screen">
        <div className="pv-checklist">
          <ChecklistItem text="Разменяй десяток в единицы" done={exchanged} textRef={checklistRef} fontSize={checklistFontSize} />
        </div>
```

with:

```jsx
  const { ref: questionRef, fontSize: questionFontSize } = useFitOneLine("Разменяй десяток в единицы", { max: 45, min: 13 });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen cb-screen">
        <div className="pv-question">
          <span ref={questionRef} style={{ fontSize: questionFontSize }}>Разменяй десяток в единицы</span>
        </div>
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/topics/renderers/column_addition/regroupTen.smoke.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/column_addition/RegroupTenTask.jsx src/topics/renderers/column_addition/regroupTen.smoke.test.jsx
git commit -m "$(cat <<'EOF'
feat(regroup_ten): replace the single-row checklist with pv-question

Same shared instruction-line element IdentifyNumberTask and (as of
the previous commit) BuildNumberTask use — this mode only ever had
one instruction, so there's no sequence to collapse, just the
checkbox/strikethrough chrome dropped.
EOF
)"
```

---

### Task 3: CSS — standard font, dead checklist rules removed

**Files:**
- Modify: `src/topics/renderers/column_addition/place_value.css`

**Interfaces:**
- Consumes: nothing new — `.pv-question`/`.pv-question--correct` already exist; this task edits their font and adds one sibling modifier (`.pv-question--shake`) that Task 1 already references.
- Produces: `.pv-question--shake` (used by `BuildNumberTask.jsx`, already wired up in Task 1), `.pv-question-number` (used by `BuildNumberTask.jsx`'s `withHighlightedNumber`, already wired up in Task 1).

This task is CSS-only — verified by grepping for leftover references (Step 2) and running the full test suite (Step 3), not by a new unit test.

- [ ] **Step 1: Edit place_value.css**

In `src/topics/renderers/column_addition/place_value.css`:

1. Change `.pv-question`'s font (currently, right after the block-comment starting "identify_number only: the single current-step prompt..."):

```css
.pv-question {
  text-align: center;
  font-family: 'Neucha', cursive;
  font-weight: 400;
  color: #1a1a2e;
  line-height: 1.2;
  margin-top: clamp(8px, 2vh, 18px);
  margin-bottom: 2px;
  flex-shrink: 0;
}
```

to:

```css
.pv-question {
  text-align: center;
  font-weight: 400;
  color: #1a1a2e;
  line-height: 1.2;
  margin-top: clamp(8px, 2vh, 18px);
  margin-bottom: 2px;
  flex-shrink: 0;
}
```

(dropping the `font-family` line entirely lets it inherit the app's default `"Nunito", sans-serif` from `body`, `src/styles.css:8`).

Also update the block comment directly above `.pv-question` — it currently ends with an outdated claim about Neucha. Replace:

```
/* identify_number only: the single current-step prompt ("Сколько
   десятков?" → "Сколько единиц?" → "Правильно!") that replaces what used
   to be a two-row checklist — a checklist was overkill for a two-step
   question where the digit landing in its own slot already confirms it.
   Text swaps in place (no growing row count), so unlike the old
   .pv-checklist--reserve-2 this needs no height reservation. Small top
   margin on purpose: that space is better spent on the coin zones below,
   which flex to fill whatever's left (IdentifyNumberTask.jsx's
   zoneScale). Neucha keeps the same "handwritten prompt" language as the
   rest of this family's checklists, even though this isn't one. */
```

with:

```
/* Shared by all three place-value modes (build_number, identify_number,
   regroup_ten): the single current-phase instruction, swapping in place
   with no growing history — a checklist was overkill once each phase's
   own confirmation (digit landing in its slot, a drag succeeding, a tap
   on this very line) already shows the child they got it right. Small
   top margin on purpose: that space is better spent on the coin zones
   below, which flex to fill whatever's left. */
```

2. Add a shake modifier right after `.pv-question--correct` (used by `BuildNumberTask.jsx`'s `collect`/`group` wrong-tap feedback):

```css
.pv-question--correct {
  color: #16a34a;
  font-weight: 700;
}
```

becomes:

```css
.pv-question--correct {
  color: #16a34a;
  font-weight: 700;
}

/* build_number only: collect/group are tappable (the line itself is the
   confirm button), so a wrong tap needs the same shake every other wrong
   answer in this family gets — reuses the shared pv-shake keyframe. */
.pv-question--shake {
  animation: pv-shake 0.4s ease-in-out;
}
```

3. Delete the entire checklist block — everything from the `/* ── Checklist rows (build_number's phased flow) ──...` comment through the `.pv-checklist-number` rule (currently spanning from the `.pv-checklist` container rule down to and including `.pv-checklist-number`, i.e. everything between the `.pv-cube-pop`/`pv-pop` keyframe block above and the `.pv-numpad` rule below):

```css
/* ── Checklist rows (build_number's phased flow) ──────────────────────────
   Same "tap-the-instruction-to-confirm, completed rows stay on screen
   frozen/struck-through" pattern as fingers_count's fng-checklist (see
   textFit.js for the shared font-fit/row-height-cap hooks both use) — kept
   as its own pv-* rule set rather than a shared class so retouching one
   family's checklist visuals never touches the other's. */
.pv-checklist {
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;
  /* Left inset (rows stay full-width — default align-items:stretch, so
     the whole row is still tappable, not just the text — but their
     content starts flush at that inset instead of at the screen edge).
     A third of the screen width was tried first but left too little room
     for the longer instructions to still fit on one line on a narrow
     phone (~320px) even at the smallest legible size; a quarter keeps
     the same idea with room to spare. */
  padding: 2px 16px 10px 25vw;
  /* Roughly two lines of the screen's own body text, so the checklist
     starts a bit below the very top edge instead of hugging it. */
  margin-top: clamp(28px, 6vh, 52px);
}
```

... down through ...

```css
/* Highlights the target number inside the "Собери N монет" instruction —
   this used to be its own separate huge pv-number display above the
   checklist; colour (not an oversized nested span) keeps it from throwing
   off useFitOneLine's own width measurement of the row. */
.pv-checklist-number {
  color: #1d4ed8;
}
```

— delete this whole span, including every rule in between (`.pv-checklist-item` and its `:active`/`::after` connector/`is-done`/`is-wrong`/`is-pending` states, the `pv-checklist-item-in` keyframe, `.pv-checklist--focused`, `.pv-checklist-box` and its `pv-checklist-box-pulse` keyframe and done/wrong border colors, `.pv-check-icon` and its `pv-check-pop` keyframe, the `@media (prefers-reduced-motion: reduce)` block that turns off `.pv-checklist-item`/`.pv-checklist-box`/`.pv-check-icon` animations, and `.pv-checklist-text` with its `is-done`/`is-wrong` color rules) — and add the renamed highlight rule in its place:

```css
/* Highlights the target number inside the "Собери N монет" instruction —
   colour only (not an oversized nested span), so it doesn't throw off
   useFitOneLine's own width measurement of the line. */
.pv-question-number {
  color: #1d4ed8;
}
```

- [ ] **Step 2: Verify nothing still references the deleted classes**

Run:
```bash
grep -rn "pv-checklist\|pv-check-icon\|ChecklistItem\|CheckIcon" src/topics/renderers/column_addition/BuildNumberTask.jsx src/topics/renderers/column_addition/RegroupTenTask.jsx src/topics/renderers/column_addition/place_value.css
```
Expected: no output (empty). If anything prints, it's a leftover reference that must be removed before continuing — do not proceed to Step 3 with output here.

Note: `fingers_count`'s `FingersCountTask.jsx`/its own `fng-checklist` CSS is a separate, deliberately-untouched family — this grep is scoped to the three files above precisely so it won't flag that unrelated code.

- [ ] **Step 3: Run the full column_addition test suite**

Run:
```bash
npx vitest run --exclude "**/node_modules/**" --exclude "**/.worktrees/**" --exclude "**/.claude/**" \
  --exclude "**/.superpowers/**" --exclude "**/runtime/**" \
  --exclude "**/.codex-deploy-backfix-*/**" --exclude "**/codex-deploy-backfix-*/**" \
  --exclude "**/__codex_deploy_reward_fix_*/**" --exclude "**/output/**" --exclude "**/dist/**" \
  src/topics/renderers/column_addition/
```
Expected: every test file passes EXCEPT the pre-existing, unrelated `engine.test.js` `FingerSystem`/`getRemoveMode`/`fingers_count` failures (6 tests — confirmed pre-existing via `git stash` earlier this session, nothing to do with this change). If any `buildNumber.smoke.test.jsx`, `regroupTen.smoke.test.jsx`, or `identifyNumber.smoke.test.jsx` test fails, stop and investigate before committing.

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/column_addition/place_value.css
git commit -m "$(cat <<'EOF'
style(place_value): standard Nunito font, delete dead checklist CSS

.pv-question now inherits the app's default body font instead of the
handwritten Neucha override — nothing renders a checklist anymore
after the previous two commits, so every .pv-checklist*/.pv-check-icon
rule is dead and removed outright. .pv-checklist-number survives,
renamed to .pv-question-number (still used by build_number's
highlighted coin count). fingers_count's separate fng-checklist family
is untouched.
EOF
)"
```

---

## Manual verification (not automated — do after Task 3)

1. Run the dev server, open a deck with `build_number`, `identify_number`, and `regroup_ten` cards.
2. `build_number`: confirm each phase's instruction reads as one centered Nunito-font line (not the cursive Neucha), tapping it while on `collect`/`group` advances (or shakes if wrong), and the numpad drives `answerTens`/`answerOnes` as before, ending on "Правильно!".
3. `identify_number`: confirm its own instruction line switched from Neucha to Nunito (only a font change here — the rest of the flow is untouched).
4. `regroup_ten`: confirm "Разменяй десяток в единицы" reads as a plain Nunito line, unstyled by any checkbox, and the equation panel + "Далее →" still appear after the drag.
5. Confirm the checkered background is still gone (from the earlier session change) and the tablet numpad layout is still the classic 3-column dial pad — this task shouldn't have touched either, but both live in the same `place_value.css`, so a quick look confirms nothing regressed.
