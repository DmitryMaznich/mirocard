# "Какое это число?" answer-first flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a third `answerNumber` phase into `IdentifyNumberTask.jsx` so the child explicitly types the full two-digit number before the existing merge animation confirms it — resolving the mismatch between the permanent "Какое это число?" header and the fact that only tens/ones sub-questions were ever actually asked.

**Architecture:** One new phase (`answerTens → answerOnes → answerNumber → done`) reusing the existing shared numpad and the existing `flashRowWrong`/merge-animation machinery unchanged. A new two-cell "guess row" (built from the same `AnswerSlot` component already used for tens/ones) occupies the same absolutely-centered spot `.pv-merged-number` already sits in, so the subsequent digit-fly-in animation lands exactly where the child's own guess was.

**Tech Stack:** React 19 (function components, hooks), Vitest + `react-dom/client` (`createRoot`) for the existing smoke test, plain CSS (no CSS-in-JS).

## Global Constraints

- No change to `hintDirectionFor` or the directional more/less hint on the tens/ones steps — stays exactly as today.
- No change to `BuildNumberTask.jsx` or `RegroupTenTask.jsx`.
- No entry-order flexibility — tens still asked before ones, unchanged.
- Reuse `flyDigitGhost`/`playMergeAnimation` unmodified — only the trigger point moves.
- Wrong whole-number guess: shake, then clear both digits after the same 500ms window `flashRowWrong` already uses elsewhere — no directional hint for this step.

Spec: `docs/superpowers/specs/2026-07-28-identify-number-answer-first-design.md`

---

### Task 1: Add the `answerNumber` phase to IdentifyNumberTask

**Files:**
- Modify: `src/topics/renderers/column_addition/IdentifyNumberTask.jsx`
- Modify: `src/topics/renderers/column_addition/place_value.css`
- Modify: `src/topics/renderers/column_addition/identifyNumber.smoke.test.jsx`

**Interfaces:**
- Consumes: existing `AnswerSlot` component (local to this file, `props: { state, value, hint, slotRef }`), existing `flashRowWrong(key, direction)`, existing `playMergeAnimation()`, existing `task.model.tens` / `task.model.ones` (numbers).
- Produces: no new exports — this is a self-contained behavior change inside one component.

- [ ] **Step 1: Update the smoke test file with the new/changed test cases (write the failing tests first)**

Replace the entire content of `src/topics/renderers/column_addition/identifyNumber.smoke.test.jsx` with:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by the
// current-question prompt's text sizing) needs one. No-op stub — this
// test doesn't assert on live-resize font shrinking.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("IdentifyNumberTask", () => {
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
        <IdentifyNumberTask
          task={task}
          onCorrect={handlers.onCorrect ?? (() => {})}
          onMistake={handlers.onMistake ?? (() => {})}
          onFlashIncorrect={handlers.onFlashIncorrect ?? (() => {})}
        />
      );
    });
  }

  function digitButton(d) {
    return Array.from(container.querySelectorAll(".pv-numkey")).find((b) => b.textContent === String(d));
  }

  function question() {
    return container.querySelector(".pv-question");
  }

  function guessSlots() {
    return container.querySelectorAll(".pv-guess-row .pv-answer-slot");
  }

  it("mounts without crashing, asking for tens first", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });
    expect(question().textContent).toBe("Сколько десятков?");
  });

  it("marks the coin zones to flex-fit the remaining screen height, even with a large tens/ones count", () => {
    // jsdom reports 0 for clientHeight/clientWidth (no real layout), so the
    // zoneScale computation's own early-return guard always fires here —
    // this only confirms the mechanism is wired up (the flex-fit class and
    // a --cb-scale inline style are present), not the actual fitted
    // scale value, which needs a real viewport — verified separately via
    // a static-HTML mockup across a matrix of device heights/counts.
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 99, model: { tens: 9, ones: 9 } });
    const zones = container.querySelector(".pv-zones");
    expect(zones.className).toContain("pv-zones--flex-fit");
    expect(zones.style.getPropertyValue("--cb-scale")).toBeTruthy();
    expect(container.querySelectorAll(".cb-ten-stack").length).toBe(9);
    expect(container.querySelectorAll(".cb-coin").length).toBe(9);
  });

  it("switches the question to ones after tens is answered, and keeps the tens digit shown after a wrong ones digit", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });

    act(() => { digitButton(2).click(); }); // correct tens
    expect(question().textContent).toBe("Сколько единиц?");

    act(() => { digitButton(9).click(); }); // wrong ones
    const slots = container.querySelectorAll(".pv-answer-row--split > .pv-answer-col .pv-answer-slot");
    expect(slots[0].textContent).toBe("2"); // tens digit persists
    expect(slots[0].className).toContain("pv-answer-slot--correct");
    expect(slots[1].className).toContain("pv-answer-slot--shake");
  });

  it("asks 'Какое это число?' after tens and ones are both answered, before merging", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });

    act(() => { digitButton(2).click(); }); // correct tens
    act(() => { digitButton(3).click(); }); // correct ones

    expect(question().textContent).toBe("Какое это число?");
    // Tens/ones stay visibly confirmed while the child answers the third question.
    const topSlots = container.querySelectorAll(".pv-answer-row--split > .pv-answer-col .pv-answer-slot");
    expect(topSlots[0].textContent).toBe("2");
    expect(topSlots[0].className).toContain("pv-answer-slot--correct");
    expect(topSlots[1].textContent).toBe("3");
    expect(topSlots[1].className).toContain("pv-answer-slot--correct");

    const guesses = guessSlots();
    expect(guesses.length).toBe(2);
    expect(guesses[0].textContent).toBe("?");
    expect(guesses[1].textContent).toBe("?");
  });

  it("shakes and clears a wrong two-digit guess without advancing past answerNumber", () => {
    vi.useFakeTimers();
    try {
      const onMistake = vi.fn();
      mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } }, { onMistake });

      act(() => { digitButton(2).click(); }); // correct tens
      act(() => { digitButton(3).click(); }); // correct ones
      act(() => { digitButton(9).click(); }); // wrong guess, digit 1 of 2
      act(() => { digitButton(9).click(); }); // wrong guess, digit 2 of 2 -> 99 !== 23

      expect(onMistake).toHaveBeenCalledTimes(1);
      let guesses = guessSlots();
      expect(guesses[0].className).toContain("pv-answer-slot--shake");
      expect(guesses[1].className).toContain("pv-answer-slot--shake");

      act(() => { vi.advanceTimersByTime(500); });

      guesses = guessSlots();
      expect(guesses[0].textContent).toBe("?");
      expect(guesses[1].textContent).toBe("?");
      // Still on the same question — a wrong whole-number guess doesn't advance the phase.
      expect(question().textContent).toBe("Какое это число?");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows 'Правильно!' and waits for a tap on Далее before calling onCorrect", () => {
    // The real merge animation flies two ghosts via Element.animate(),
    // which jsdom doesn't implement — this test forces the
    // prefers-reduced-motion path instead (playMergeAnimation's own
    // early branch), which sets the same end state synchronously,
    // without touching the Web Animations API or real layout
    // measurement. The flight itself is exercised visually, not here —
    // same "hard to unit-test at this level" precedent as
    // RegroupTenTask's dnd-kit drag.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    vi.useFakeTimers();

    try {
      const onCorrect = vi.fn();
      mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } }, { onCorrect });

      act(() => { digitButton(2).click(); }); // correct tens
      act(() => { digitButton(3).click(); }); // correct ones
      act(() => { digitButton(2).click(); }); // correct number guess, digit 1 of 2
      act(() => { digitButton(3).click(); }); // correct number guess, digit 2 of 2 -> 23 === 23
      act(() => { vi.advanceTimersByTime(180); }); // pre-merge beat

      expect(question().textContent).toBe("Правильно!");
      expect(question().className).toContain("pv-question--correct");

      const merged = container.querySelector(".pv-merged-number");
      expect(merged.textContent).toBe("23");
      expect(merged.className).toContain("pv-merged-number--visible");

      // Reaching the merged result does not advance on its own.
      expect(onCorrect).not.toHaveBeenCalled();
      expect(container.querySelector(".pv-numpad")).toBeNull();

      const nextButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent.includes("Далее"));
      expect(nextButton).toBeTruthy();
      act(() => { nextButton.click(); });
      expect(onCorrect).toHaveBeenCalledWith("x", "x");
    } finally {
      vi.useRealTimers();
      window.matchMedia = originalMatchMedia;
    }
  });
});
```

Note the third test ("switches the question to ones...") and the new fourth test now query `.pv-answer-row--split > .pv-answer-col .pv-answer-slot` instead of the old bare `.pv-answer-slot` selector — this scopes them to the tens/ones slots specifically, since the new guess row also renders `.pv-answer-slot` elements and would otherwise be picked up by `container.querySelectorAll(".pv-answer-slot")`.

- [ ] **Step 2: Run the tests and confirm the new/changed ones fail**

Run: `npx vitest run src/topics/renderers/column_addition/identifyNumber.smoke.test.jsx`

Expected: the two new tests ("asks 'Какое это число?'..." and "shakes and clears a wrong two-digit guess...") FAIL — `question().textContent` will be `"Правильно!"` already at that point instead of `"Какое это число?"`, and `guessSlots()` will return an empty NodeList since `.pv-guess-row` doesn't exist yet. The "shows 'Правильно!'..." test also fails now, since it expects two more digit taps before the merge fires. The other three pre-existing tests still pass unchanged.

- [ ] **Step 3: Implement the `answerNumber` phase in IdentifyNumberTask.jsx**

In `src/topics/renderers/column_addition/IdentifyNumberTask.jsx`:

1. Add a new state field for the in-progress whole-number guess, and extend the two existing per-row state objects with a `number` key. Change:

```jsx
  const [phase, setPhase] = useState("answerTens");
  const [rowWrong, setRowWrong] = useState({ tens: false, ones: false });
  const [hintDirection, setHintDirection] = useState({ tens: null, ones: null });
```

to:

```jsx
  const [phase, setPhase] = useState("answerTens");
  const [rowWrong, setRowWrong] = useState({ tens: false, ones: false, number: false });
  const [hintDirection, setHintDirection] = useState({ tens: null, ones: null, number: null });
  // The child's in-progress two-digit guess for "Какое это число?" (phase
  // answerNumber) — an array of typed digit strings, max length 2. Not
  // checked against the target until both are in, mirroring the
  // accumulate-then-validate pattern column_addition's own "copy" mode
  // (index.jsx's handleDigit) already uses for its multi-digit answer.
  const [numberInput, setNumberInput] = useState([]);
```

2. Change the `handleDigit` function. Replace:

```jsx
  function handleDigit(d) {
    if (phase === "answerTens") {
      if (d === task.model.tens) {
        setPhase("answerOnes");
      } else {
        flashRowWrong("tens", hintDirectionFor(d, task.model.tens));
      }
      return;
    }
    if (phase === "answerOnes") {
      if (d === task.model.ones) {
        setPhase("done");
        // A short beat on the confirmed-correct digits before they merge —
        // long enough to register "that's right", short enough to still
        // feel like one continuous moment.
        setTimeout(playMergeAnimation, 180);
      } else {
        flashRowWrong("ones", hintDirectionFor(d, task.model.ones));
      }
    }
  }
```

with:

```jsx
  function handleDigit(d) {
    if (phase === "answerTens") {
      if (d === task.model.tens) {
        setPhase("answerOnes");
      } else {
        flashRowWrong("tens", hintDirectionFor(d, task.model.tens));
      }
      return;
    }
    if (phase === "answerOnes") {
      if (d === task.model.ones) {
        setPhase("answerNumber");
      } else {
        flashRowWrong("ones", hintDirectionFor(d, task.model.ones));
      }
      return;
    }
    if (phase === "answerNumber") {
      const next = [...numberInput, d];
      setNumberInput(next);
      if (next.length < 2) return;
      const guess = Number(next.join(""));
      if (guess === task.model.tens * 10 + task.model.ones) {
        setPhase("done");
        // A short beat on the confirmed-correct digits before they merge —
        // long enough to register "that's right", short enough to still
        // feel like one continuous moment.
        setTimeout(playMergeAnimation, 180);
      } else {
        // Whole-number guess, not a single digit — no directional hint
        // here (unlike tens/ones), just shake and let the child retry.
        // Keeps the wrong guess visible for the same 500ms shake window
        // flashRowWrong already uses elsewhere before clearing it, so the
        // child can see what they typed was wrong, not just a blank flash.
        flashRowWrong("number");
        setTimeout(() => setNumberInput([]), 500);
      }
    }
  }
```

3. Update the derived `tensDone`/`onesDone` flags so the tens/ones slots and the coin-zone "correct" tint stay on through the new `answerNumber` phase instead of reverting. Replace:

```jsx
  const tensDone = phase === "answerOnes" || phase === "done";
  const onesDone = phase === "done";
```

with:

```jsx
  const tensDone = phase === "answerOnes" || phase === "answerNumber" || phase === "done";
  const onesDone = phase === "answerNumber" || phase === "done";
```

4. Update `questionText` to add the third phase's prompt — now textually identical to the permanent `pv-instruction` header, which is the whole point of this change. Replace:

```jsx
  const questionText = phase === "answerTens" ? "Сколько десятков?" : phase === "answerOnes" ? "Сколько единиц?" : "Правильно!";
```

with:

```jsx
  const questionText = phase === "answerTens" ? "Сколько десятков?"
    : phase === "answerOnes" ? "Сколько единиц?"
    : phase === "answerNumber" ? "Какое это число?"
    : "Правильно!";
```

5. Add the guess row's own state-per-slot helper, right after the `onesAnswer` computed value (still before the `questionText` line):

```jsx
  // Guess-row slot state: mirrors tensAnswer/onesAnswer's own single-branch
  // ternary style (never combines "filled" and "shake" on one slot) — a
  // typed-but-unconfirmed digit reads as provisionally filled (blue), a
  // wrong final pair reads as shake (red) regardless of what was typed.
  function numberSlotState(idx) {
    if (rowWrong.number) return "shake";
    return numberInput[idx] != null ? "filled" : undefined;
  }
```

6. Extend the coin-zone "correct" tint to cover `answerNumber` too (both zones' className expressions). Replace:

```jsx
        <div className={`pv-zone${tensAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "done" ? " pv-zone--correct" : ""}`}>
```

with:

```jsx
        <div className={`pv-zone${tensAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "answerNumber" || phase === "done" ? " pv-zone--correct" : ""}`}>
```

and replace:

```jsx
        <div className={`pv-zone${onesAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "done" ? " pv-zone--correct" : ""}`}>
```

with:

```jsx
        <div className={`pv-zone${onesAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "answerNumber" || phase === "done" ? " pv-zone--correct" : ""}`}>
```

7. Render the guess row. It occupies the same spot `.pv-merged-number` sits in — add it as a sibling right after the existing `.pv-merged-number` div (which stays exactly as-is):

```jsx
        <div ref={mergedRef} className={`pv-merged-number${merged ? " pv-merged-number--visible" : ""}`}>
          <span ref={mergedTensRef}>{task.model.tens}</span><span ref={mergedOnesRef}>{task.model.ones}</span>
        </div>

        {/* The third question ("Какое это число?") — the child types the
            full two-digit number here, in the same spot the merged result
            will occupy once this phase is answered correctly, so the
            fly-in below lands exactly where the child's own guess was. */}
        {phase === "answerNumber" && (
          <div className="pv-guess-row">
            <AnswerSlot state={numberSlotState(0)} value={numberInput[0] ?? null} />
            <AnswerSlot state={numberSlotState(1)} value={numberInput[1] ?? null} />
          </div>
        )}
```

- [ ] **Step 4: Add the `.pv-guess-row` CSS rule**

In `src/topics/renderers/column_addition/place_value.css`, add this rule right after the `.pv-merged-number--visible` rule (after the block ending at line 430):

```css
/* The child's in-progress guess for "Какое это число?" (IdentifyNumberTask's
   answerNumber phase) — sits in the exact same centered spot .pv-merged-number
   occupies (same position:relative parent, .pv-answer-row--split), so once
   the guess is confirmed correct and this unmounts, the merge animation's
   flying digits land right where the child's own guess was. Two ordinary
   AnswerSlot boxes (not scaled up like .pv-merged-number's finished-number
   typography) since this is still a guess, not the confirmed result. */
.pv-guess-row {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 5: Run the full test file and confirm everything passes**

Run: `npx vitest run src/topics/renderers/column_addition/identifyNumber.smoke.test.jsx`

Expected: all 6 tests PASS.

- [ ] **Step 6: Run the whole project's test suite to check for regressions**

Run: `npx vitest run`

Expected: no new failures elsewhere. `engine.test.js` and `topicLoader.test.js` (which reference `column_addition`/`identify_number` per the earlier grep) don't touch `IdentifyNumberTask.jsx` directly, so they should be unaffected — confirm this rather than assume it.

- [ ] **Step 7: Commit**

```bash
git add src/topics/renderers/column_addition/IdentifyNumberTask.jsx src/topics/renderers/column_addition/place_value.css src/topics/renderers/column_addition/identifyNumber.smoke.test.jsx
git commit -m "$(cat <<'EOF'
feat(identify_number): add a third "Какое это число?" answer step

The permanent header asked this question but the child was only ever
asked for tens then ones — the number was assembled for them. Now a
third phase has the child type the full two-digit number themselves
before the existing merge animation confirms it against the tens/ones
already answered.
EOF
)"
```

---

## Manual verification (not automated — do after Step 7)

Since `playMergeAnimation`'s real flight (Web Animations API) isn't exercised by jsdom tests, confirm visually in the browser before considering this done:

1. Run the dev server (`npm run dev`), open a deck with `identify_number` cards.
2. Answer tens and ones correctly — confirm the sub-question changes to "Какое это число?" and the tens/ones slots stay green (not reverting to blank/active).
3. Type a wrong two-digit number — confirm the guess boxes shake, briefly show what was typed, then clear, without disturbing the tens/ones slots above.
4. Type the correct two-digit number — confirm the two digits fly from the tens/ones slots and land over the guess row's position, "Правильно!" appears, and "Далее →" advances as before.
5. Check the iOS-safe-area rule doesn't apply here — `.pv-guess-row` is centered mid-screen, not pinned to a screen edge, so no `--app-safe-*` inset is needed (per `C:\Users\dmazn\Projects\Mirocard2\CLAUDE.md`'s safe-area rule, which only applies to edge-pinned elements).
