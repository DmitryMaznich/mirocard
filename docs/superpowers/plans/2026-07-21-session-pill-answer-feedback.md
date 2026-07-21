# Session Pill Answer Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the session-header pill (`.session-plan-tongue`) into the answer-correctness
indicator — it shows 😊/😢 with a tinted background while `sessionState.status` is
`answer_correct`/`answer_incorrect`, and the old full-screen correct/incorrect overlay is
removed.

**Architecture:** A new pure function `getTonguePillState` decides which visual mode the pill
is in (open / correct / incorrect / idle, plus pulse) from three inputs already available to
`SessionScreen`. `SessionHeader` consumes that function to pick a CSS modifier class and to
swap its inner markup (three bars vs. one emoji span). `SessionScreen` starts passing
`sessionState.status` down to `SessionHeader` and stops rendering the
`.session-fb-overlay--correct`/`--incorrect` blocks. CSS gains two new pill-background
modifiers and an emoji pop-in animation; the now-dead full-screen overlay CSS for
correct/incorrect is deleted, the shared/gate overlay CSS is left untouched.

**Tech Stack:** React (JSX, no new deps), vitest for the one pure-logic unit, plain CSS
(existing custom-property/keyframe conventions in `src/styles.css`), Playwright (headed) for
manual verification only.

## Global Constraints

- Do not touch `.session-fb-overlay--gate` or the base `.session-fb-overlay`/`.session-fb-overlay__hint`
  rules — they belong to the unrelated adult-confirm gate screen and must keep working.
- Do not change the `✓/✗` text counter in `.session-counter` — spec says it stays.
- Do not change `playFeedback("correct"/"incorrect")` sound calls.
- Tap on the pill must keep opening/closing `SessionPlanDrawer` in every visual mode, including
  while it shows an emoji.
- No new dependencies (no animation library, no `@testing-library/react` — this codebase has no
  JSX component test harness; keep to what exists).
- Emoji glyphs are exactly `😊` (correct) and `😢` (incorrect) — do not substitute other emoji.

---

### Task 1: Pure pill-state helper + unit tests

**Files:**
- Create: `src/features/session/tonguePillState.js`
- Test: `src/features/session/tonguePillState.test.js`

**Interfaces:**
- Produces: `getTonguePillState({ isDrawerOpen, answerStatus, hasUndonePlanItems })` →
  `{ mode: "open" | "correct" | "incorrect" | "idle", pulse: boolean }`. `SessionHeader`
  (Task 2) calls this with its existing props and switches on `.mode`/`.pulse`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from "vitest";
import { getTonguePillState } from "./tonguePillState";

describe("getTonguePillState", () => {
  it("returns open when the drawer is open, regardless of answer status", () => {
    expect(getTonguePillState({ isDrawerOpen: true, answerStatus: "answer_correct", hasUndonePlanItems: true }))
      .toEqual({ mode: "open", pulse: false });
  });

  it("returns correct when closed and status is answer_correct", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "answer_correct", hasUndonePlanItems: false }))
      .toEqual({ mode: "correct", pulse: false });
  });

  it("returns incorrect when closed and status is answer_incorrect", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "answer_incorrect", hasUndonePlanItems: false }))
      .toEqual({ mode: "incorrect", pulse: false });
  });

  it("returns idle with no pulse for task_active status and no undone items", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "task_active", hasUndonePlanItems: false }))
      .toEqual({ mode: "idle", pulse: false });
  });

  it("returns idle with pulse when there are undone plan items", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "task_active", hasUndonePlanItems: true }))
      .toEqual({ mode: "idle", pulse: true });
  });

  it("never pulses while showing a correct/incorrect emoji, even with undone items", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "answer_correct", hasUndonePlanItems: true }))
      .toEqual({ mode: "correct", pulse: false });
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "answer_incorrect", hasUndonePlanItems: true }))
      .toEqual({ mode: "incorrect", pulse: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/session/tonguePillState.test.js`
Expected: FAIL — `tonguePillState.js` does not exist / `getTonguePillState` is not a function.

- [ ] **Step 3: Write the minimal implementation**

```js
export function getTonguePillState({ isDrawerOpen, answerStatus, hasUndonePlanItems }) {
  if (isDrawerOpen) return { mode: "open", pulse: false };
  if (answerStatus === "answer_correct") return { mode: "correct", pulse: false };
  if (answerStatus === "answer_incorrect") return { mode: "incorrect", pulse: false };
  return { mode: "idle", pulse: !!hasUndonePlanItems };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/session/tonguePillState.test.js`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/session/tonguePillState.js src/features/session/tonguePillState.test.js
git commit -m "feat: add pure helper for session pill visual state"
```

---

### Task 2: Wire the helper into SessionHeader (emoji/bars swap + aria-label)

**Files:**
- Modify: `src/features/session/SessionHeader.jsx`

**Interfaces:**
- Consumes: `getTonguePillState` from `./tonguePillState` (Task 1).
- Produces: `SessionHeader` now accepts a new prop `answerStatus` (string, one of
  `sessionState.status`'s values). Existing props (`tongueLabel`, `isDrawerOpen`,
  `onSetDrawerOpen`, `hasUndonePlanItems`, etc.) are unchanged. `SessionScreen` (Task 4) must
  pass `answerStatus={status}`.

- [ ] **Step 1: Import the helper and add the `answerStatus` prop**

In `src/features/session/SessionHeader.jsx`, add the import at the top:

```js
import { getTonguePillState } from "./tonguePillState";
```

Add `answerStatus` to the destructured props (after `hasUndonePlanItems`):

```jsx
export default function SessionHeader({
  topicTitle,
  modeTitle,
  showProgress,
  showStreak,
  streakCount,
  rewardAvailable,
  answersPerStar,
  taskIndex,
  total,
  correctCount,
  incorrectCount,
  evaluation,
  onClose,
  tongueLabel,
  isDrawerOpen,
  onSetDrawerOpen,
  hasUndonePlanItems,
  answerStatus,
}) {
```

- [ ] **Step 2: Compute pill state and aria-label inside the component**

Right after `const isOnline = useOnlineStatus();` (currently line 98), add:

```jsx
  const pillState = getTonguePillState({ isDrawerOpen, answerStatus, hasUndonePlanItems });
  const pillAriaLabel =
    pillState.mode === "correct" ? "Правильно, открыть меню"
    : pillState.mode === "incorrect" ? "Неправильно, открыть меню"
    : tongueLabel;
```

- [ ] **Step 3: Replace the pill `<button>` markup**

Replace this block (currently lines 144–159):

```jsx
      <button
        type="button"
        className={`session-plan-tongue${isDrawerOpen ? " session-plan-tongue--open" : ""}${!isDrawerOpen && hasUndonePlanItems ? " session-plan-tongue--pulse" : ""}`}
        style={{ "--tongue-pull": tonguePull.pullProgress }}
        onPointerDown={tonguePull.onPointerDown}
        onPointerMove={tonguePull.onPointerMove}
        onPointerUp={tonguePull.onPointerUp}
        onPointerCancel={tonguePull.onPointerCancel}
        onClick={tonguePull.onClick}
        aria-label={tongueLabel}
        aria-expanded={isDrawerOpen}
      >
        <span className="session-plan-tongue__bar" aria-hidden="true" />
        <span className="session-plan-tongue__bar" aria-hidden="true" />
        <span className="session-plan-tongue__bar" aria-hidden="true" />
      </button>
```

with:

```jsx
      <button
        type="button"
        className={`session-plan-tongue${pillState.mode === "open" ? " session-plan-tongue--open" : ""}${pillState.mode === "correct" ? " session-plan-tongue--correct" : ""}${pillState.mode === "incorrect" ? " session-plan-tongue--incorrect" : ""}${pillState.pulse ? " session-plan-tongue--pulse" : ""}`}
        style={{ "--tongue-pull": tonguePull.pullProgress }}
        onPointerDown={tonguePull.onPointerDown}
        onPointerMove={tonguePull.onPointerMove}
        onPointerUp={tonguePull.onPointerUp}
        onPointerCancel={tonguePull.onPointerCancel}
        onClick={tonguePull.onClick}
        aria-label={pillAriaLabel}
        aria-expanded={isDrawerOpen}
      >
        {pillState.mode === "correct" || pillState.mode === "incorrect" ? (
          <span className="session-plan-tongue__emoji" aria-hidden="true">
            {pillState.mode === "correct" ? "😊" : "😢"}
          </span>
        ) : (
          <>
            <span className="session-plan-tongue__bar" aria-hidden="true" />
            <span className="session-plan-tongue__bar" aria-hidden="true" />
            <span className="session-plan-tongue__bar" aria-hidden="true" />
          </>
        )}
      </button>
```

- [ ] **Step 4: Run lint**

Run: `npx eslint src/features/session/SessionHeader.jsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/session/SessionHeader.jsx
git commit -m "feat: show emoji in session pill for correct/incorrect answers"
```

---

### Task 3: CSS for the emoji pill states

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: class names `session-plan-tongue--correct`, `session-plan-tongue--incorrect`,
  `session-plan-tongue__emoji`, `session-plan-tongue__bar` produced by Task 2's JSX.

- [ ] **Step 1: Extend the pill's transition list to cover background**

Find (in the `.session-plan-tongue` rule, currently line 12288):

```css
  transition: transform 0.08s ease, box-shadow 0.12s ease;
```

Replace with:

```css
  transition: transform 0.08s ease, box-shadow 0.12s ease, background 0.15s ease;
```

- [ ] **Step 2: Add the correct/incorrect background modifiers, the emoji span style, and the
  keyframes**

Immediately after the existing block (currently lines 12317–12323):

```css
@keyframes sessionPlanTonguePulse {
  0%, 100% { transform: translate(-50%, 50%) scaleY(1); }
  50%      { transform: translate(-50%, 50%) scaleY(1.1) scale(1.06); }
}
.session-plan-tongue--pulse {
  animation: sessionPlanTonguePulse 2.4s ease-in-out infinite;
}
```

add:

```css
.session-plan-tongue--correct {
  background: linear-gradient(180deg, #eafaf0 0%, #d3f3de 55%, #b9ecc9 100%);
}
.session-plan-tongue--incorrect {
  background: linear-gradient(180deg, #fdecea 0%, #fbd6d2 55%, #f7c0ba 100%);
}
.session-plan-tongue__emoji {
  font-size: 13px;
  line-height: 1;
  animation: sessionPlanTonguePop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.session-plan-tongue__bar {
  animation: sessionPlanTongueBarsIn 0.15s ease;
}
@keyframes sessionPlanTonguePop {
  0%   { transform: scale(0.9); }
  60%  { transform: scale(1.05); }
  100% { transform: scale(1); }
}
@keyframes sessionPlanTongueBarsIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

Note: `.session-plan-tongue__bar` already has a rule earlier (line 12300) with
`width/height/border-radius/background/box-shadow/transition` — this new rule is additive
(a second selector block for the same class only adding `animation`), not a replacement. Add it
as its own rule right after the pulse block, do not merge into the existing bar rule.

- [ ] **Step 3: Manual CSS sanity check**

Run: `npx vite build --configLoader native` (or `npm run build`)
Expected: build succeeds with no CSS syntax errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "style: add correct/incorrect background and emoji animation to session pill"
```

---

### Task 4: Wire `answerStatus` from SessionScreen and remove the full-screen overlay

**Files:**
- Modify: `src/features/session/SessionScreen.jsx`

**Interfaces:**
- Consumes: `SessionHeader`'s new `answerStatus` prop (Task 2).

- [ ] **Step 1: Pass `answerStatus` to `SessionHeader`**

Find the `<SessionHeader ... />` call (currently lines 228–246) and add `answerStatus={status}`
right after `incorrectCount={incorrectCount}`:

```jsx
        <SessionHeader
          topicTitle={topicTitle}
          modeTitle={modeTitle}
          showProgress={showProgress}
          showStreak={showStreak}
          streakCount={streakCount}
          rewardAvailable={rewardProgress?.available ?? false}
          answersPerStar={answersPerStar}
          taskIndex={taskIndex}
          total={total}
          correctCount={correctCount}
          incorrectCount={incorrectCount}
          answerStatus={status}
          evaluation={mode.evaluation}
          onClose={openSessionExitPrompt}
          tongueLabel={formatPlanTongueLabel(lessonPlan?.activeSessionPlan ?? null)}
          hasUndonePlanItems={(lessonPlan?.activeSessionPlan?.items ?? []).some((item) => !item.done)}
          isDrawerOpen={isPlanDrawerOpen}
          onSetDrawerOpen={setIsPlanDrawerOpen}
        />
```

(`status` is already destructured from `sessionState` at the existing line
`const { status, taskIndex, tasks, correctCount, incorrectCount } = sessionState ?? {};` — no
new variable needed.)

- [ ] **Step 2: Delete the now-dead `isIncorrectFeedback` const**

`isIncorrectFeedback` (currently line 141: `const isIncorrectFeedback = status === "answer_incorrect";`)
is only read by the overlay block deleted in the next step — nowhere else in the file. Delete
this line. Do **not** delete `isCorrectFeedback` (line 140) — it is also used by
`defaultAdvanceGate`, `showStandaloneGate`, and `.session-renderer-wrap`'s className/onClick, so
it must stay.

- [ ] **Step 3: Delete the correct/incorrect overlay blocks**

Find and delete this whole block (currently lines 312–328):

```jsx
      {isIncorrectFeedback && !ownsFeedback && (
        <div className="session-fb-overlay session-fb-overlay--incorrect" aria-hidden="true">
          <span className="session-fb-overlay__icon">✕</span>
        </div>
      )}

      {isCorrectFeedback && !ownsFeedback && (
        <div
          className={`session-fb-overlay session-fb-overlay--correct${!adultConfirmAdvance || isAdvanceReady ? " session-fb-overlay--ready" : ""}`}
          onClick={requestAdvance}
        >
          <span className="session-fb-overlay__icon">✓</span>
          {(!adultConfirmAdvance || isAdvanceReady) && (
            <span className="session-fb-overlay__hint">Нажмите, чтобы продолжить</span>
          )}
        </div>
      )}
```

Leave the `showStandaloneGate` block right after it (the `.session-fb-overlay--gate` block)
untouched — it is unrelated to answer correctness.

- [ ] **Step 4: Run lint**

Run: `npx eslint src/features/session/SessionScreen.jsx`
Expected: no errors, in particular no "unused variable" error for `isIncorrectFeedback` (deleted
in Step 2) and no such error for `isCorrectFeedback` (kept, since it's still read by
`defaultAdvanceGate`, `showStandaloneGate`, and `.session-renderer-wrap`'s className/onClick).

- [ ] **Step 5: Commit**

```bash
git add src/features/session/SessionScreen.jsx
git commit -m "feat: drive session pill from answer status, drop full-screen answer overlay"
```

---

### Task 5: Remove the now-dead overlay CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Delete the correct/incorrect-specific overlay rules**

In the `/* ─── Session feedback overlays ──────────────────────────────────────────── */`
section, delete these rules (keep everything else in the section, including the base
`.session-fb-overlay`, `.session-fb-overlay--gate`, `.session-fb-overlay--gate.session-fb-overlay--ready`,
and the base `.session-fb-overlay__hint`):

```css
.session-fb-overlay--incorrect {
  background: rgba(210, 20, 20, 0.45);
  pointer-events: none;
  animation: session-fb-fade-out 1.5s ease-out forwards;
}
.session-fb-overlay--correct {
  background: transparent;
  cursor: pointer;
  user-select: none;
}
.session-fb-overlay--correct.session-fb-overlay--ready {
  background: transparent;
}
```

```css
.session-fb-overlay__icon {
  font-size: 140px;
  line-height: 1;
  color: #fff;
  text-shadow: 0 4px 32px rgba(0, 0, 0, 0.4);
}
.session-fb-overlay--incorrect .session-fb-overlay__icon {
  animation: session-fb-x-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.session-fb-overlay--correct .session-fb-overlay__icon {
  animation: session-fb-check-pop 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  color: #22a04a;
  text-shadow: 0 2px 12px rgba(255, 255, 255, 0.9), 0 0 32px rgba(255, 255, 255, 0.6);
}
.session-fb-overlay--correct .session-fb-overlay__hint {
  color: #22a04a;
  text-shadow: 0 1px 6px rgba(255, 255, 255, 0.95), 0 0 20px rgba(255, 255, 255, 0.7);
}
```

and the three now-unused keyframes:

```css
@keyframes session-fb-fade-out {
  0%, 60% { opacity: 1; }
  100%     { opacity: 0; }
}
@keyframes session-fb-x-pop {
  0%   { transform: scale(0.1) rotate(-20deg); opacity: 0; }
  50%  { transform: scale(1.2)  rotate(5deg);  opacity: 1; }
  75%  { transform: scale(0.95) rotate(-2deg); }
  100% { transform: scale(1.05) rotate(0deg); }
}
@keyframes session-fb-check-pop {
  0%   { transform: scale(0.2); opacity: 0; }
  55%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
}
```

- [ ] **Step 2: Grep for leftover references**

Run: `grep -rn "session-fb-overlay--correct\|session-fb-overlay--incorrect\|session-fb-x-pop\|session-fb-check-pop\|session-fb-fade-out" src`
Expected: no output (all references removed from both JSX and CSS).

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "chore: remove dead correct/incorrect full-screen overlay CSS"
```

---

### Task 6: Full unit-test run and manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit-test suite**

Run: `npx vitest run`
Expected: all test files pass, including the new `tonguePillState.test.js` (from Task 1).

- [ ] **Step 2: Run lint across the repo**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Start the dev server**

Run (background): `npm run dev`
Expected: Vite dev server listening on `http://localhost:8080/` (or the configured LAN host).

- [ ] **Step 4: Manual check in a headed Playwright browser**

Using the Playwright MCP tools in headed mode (per project convention — this app's touch/visual
behavior is not reliably checkable headless):

1. Navigate to the app, pick a student and a topic/mode where `evaluation` is `"auto"` (e.g. any
   `yes_no` mode) so the correctness pill/overlay path is exercised.
2. Answer one question correctly. Confirm:
   - No full-screen check/cross overlay appears anywhere on screen.
   - The pill at the header/content seam shows 😊 with a soft green-tinted background instead of
     the three-bar icon.
   - Tapping the pill while it shows 😊 opens the `SessionPlanDrawer` (the plan panel slides
     out) — the tap function still works.
   - After the pill's emoji state clears (auto-advance timer or next question), the pill returns
     to the neutral three-bar look.
3. Answer one question incorrectly. Confirm the same, but with 😢 and a soft red/coral tint.
4. Confirm the `✓/✗` text counter in the header still updates normally.
5. Screenshot both the correct-state and incorrect-state pill for the record.

- [ ] **Step 5: Report results**

Summarize pass/fail for each check in Step 4 back to the user before considering the plan done.
