# Таймер: свечение вместо авто-открытия, минуты без секунд, подпись шага — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the recipe-triggered timer from force-opening and auto-filling the dial; instead the collapsed tab glows until tapped, all countdown displays drop second-level precision, and the running timer shows a short label naming which recipe step it's timing.

**Architecture:** Single (still singleton) `TimerContext`/`GlobalTimer`/`AnalogTimer` stack, unchanged in shape. `TimerContext.requestTimer(minutes)` becomes `requestTimer(label)` — it now only raises a "there's a pending timer" signal + a text label, never opens the clock or touches the dial. `GlobalTimer`'s collapsed tab drops all digit rendering and shows state via a CSS animation class only. `AnalogTimer` captures the pending label into local state the moment the child actually presses play, and renders it above the compact clock face.

**Tech Stack:** React (hooks, Context), plain CSS (no CSS-in-JS), Vitest for the one pure-function unit test, Playwright (headed) for manual UI verification — this codebase has no component-test harness for animated/visual UI like this timer, so Tasks 2–3 end in a lint/type sanity check and Task 4 is the real behavioral verification pass.

## Global Constraints

- No changes to `content/recipes/*.txt` — the step label is derived at runtime from existing step text, no new recipe-authoring fields.
- No changes to the video-reward countdown (`rewardSecondsLeft` / "Играем в тишину") — seconds stay there, out of scope.
- No multi-timer / concurrency support — single `TimerContext` instance, just a label on it.
- Playwright checks run headed (not headless) — project convention, see `docs/superpowers/specs/2026-07-20-timer-attention-and-labels-design.md`.
- Full design rationale: `docs/superpowers/specs/2026-07-20-timer-attention-and-labels-design.md`.

---

## File Structure

- Modify: `src/topics/renderers/reading/parseRecipeTxt.js` — add `buildTimerLabel(text)`.
- Modify: `src/topics/renderers/reading/parseRecipeTxt.test.js` — tests for it.
- Modify: `src/features/timer/TimerContext.jsx` — `timerSuggested`/`pendingLabel`/`requestTimer(label)`/`acknowledgeTimerSuggestion()` replace `timerRequest`/`requestTimer(minutes)`.
- Modify: `src/features/timer/GlobalTimer.jsx` — icon-only tab, 3-state (`idle`/`suggested`/`running`) class, acknowledge-on-open.
- Modify: `src/features/timer/AnalogTimer.jsx` — drop the dial auto-fill effect; capture/display `activeLabel`; drop second-level precision from the digital readout and the drag-label.
- Modify: `src/topics/renderers/reading/index.jsx` — call `requestTimer(buildTimerLabel(resolvedText))` instead of `requestTimer(minutes)`.
- Modify: `src/styles.css` — new suggestion-glow keyframes, drop dead tab-digit CSS, drag-label restructured for an optional step-label row, new `__text` class for "меньше минуты".

---

### Task 1: `buildTimerLabel` utility

**Files:**
- Modify: `src/topics/renderers/reading/parseRecipeTxt.js` (add function after `parseTimerMinutesFromText`, ~line 474)
- Test: `src/topics/renderers/reading/parseRecipeTxt.test.js`

**Interfaces:**
- Produces: `export function buildTimerLabel(text: string | null | undefined): string | null` — strips the `(установить таймер...)` marker from a recipe step's resolved text and returns a short label, truncated on a word boundary to ≤50 characters with a trailing `…`. Returns `null` for empty/falsy input.

- [ ] **Step 1: Write the failing tests**

Add to `src/topics/renderers/reading/parseRecipeTxt.test.js`, right after the existing `describe('parseTimerMinutesFromText', ...)` block (after line 215):

```js
describe('buildTimerLabel', () => {
  it('returns null for empty input', () => {
    expect(buildTimerLabel(null)).toBeNull();
    expect(buildTimerLabel('')).toBeNull();
  });

  it('strips the "(установить таймер)" marker and tidies the trailing punctuation', () => {
    expect(buildTimerLabel('Обжаривать 4 минуты (установить таймер).')).toBe('Обжаривать 4 минуты.');
  });

  it('strips an "установить таймер на N минут" override marker the same way', () => {
    expect(buildTimerLabel('Запекать 1 час (установить таймер на 60 минут).')).toBe('Запекать 1 час.');
  });

  it('returns text unchanged (just trimmed) when under the length limit and there is no marker', () => {
    expect(buildTimerLabel('Нарезать лук мелким кубиком.')).toBe('Нарезать лук мелким кубиком.');
  });

  it('truncates long labels on a word boundary with an ellipsis', () => {
    const text = 'Обжаривать морковку и лук вместе на среднем огне пока не станет мягким (установить таймер).';
    expect(buildTimerLabel(text)).toBe('Обжаривать морковку и лук вместе на среднем огне…');
  });
});
```

Also update the import line at the top of the file (line 2) to include `buildTimerLabel`:

```js
import { stepPortionsMultiplier, applyPortions, formatPortionsPhrase, computeStepSegments, parseTimerMinutesFromText, buildTimerLabel, applyFireEmoji, applyOptionSelections, filterStepsByOptions, applyOptionValueConditional, extractAdjustableTemplates, computeAdjustableDefault, formatWithUnit, formatCompact } from './parseRecipeTxt.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: FAIL — `buildTimerLabel is not a function` (or similar import error), since it doesn't exist yet.

- [ ] **Step 3: Implement `buildTimerLabel`**

In `src/topics/renderers/reading/parseRecipeTxt.js`, add right after the closing `}` of `parseTimerMinutesFromText` (after line 474):

```js
const TIMER_MARKER_PAREN_RE = /\(\s*установить\s+таймер[^)]*\)/i;
const TIMER_LABEL_MAX_LENGTH = 50;

/**
 * Build a short label for the currently-running timer from the recipe step
 * text that triggered it, e.g. "Обжаривать 4 минуты (установить таймер)."
 * → "Обжаривать 4 минуты." — used so a running timer can say what it's
 * timing instead of a generic "Таймер".
 */
export function buildTimerLabel(text) {
  if (!text) return null;
  const stripped = text
    .replace(TIMER_MARKER_PAREN_RE, "")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!stripped) return null;
  if (stripped.length <= TIMER_LABEL_MAX_LENGTH) return stripped;
  const truncated = stripped.slice(0, TIMER_LABEL_MAX_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${cut}…`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: PASS — all tests including the 5 new `buildTimerLabel` ones.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/reading/parseRecipeTxt.js src/topics/renderers/reading/parseRecipeTxt.test.js
git commit -m "feat(timer): add buildTimerLabel to derive a step label from recipe text"
```

---

### Task 2: Suggestion glow, icon-only tab, and step label

**Files:**
- Modify: `src/features/timer/TimerContext.jsx` (full-file rewrite, small)
- Modify: `src/features/timer/GlobalTimer.jsx` (full-file rewrite, small)
- Modify: `src/features/timer/AnalogTimer.jsx` (destructure, new state, remove dead effect, `hardReset`, `startTimer`, drag-label JSX)
- Modify: `src/topics/renderers/reading/index.jsx` (call-site swap)
- Modify: `src/styles.css` (tab digit CSS removed/replaced, drag-label restructured)

**Interfaces:**
- Consumes: `buildTimerLabel` from Task 1 (`src/topics/renderers/reading/parseRecipeTxt.js`).
- Produces: `useTimer()` now exposes `timerSuggested: boolean`, `pendingLabel: string | null`, `requestTimer(label: string | null): void`, `acknowledgeTimerSuggestion(): void` (in place of the old `timerRequest`/`requestTimer(minutes)`). `AnalogTimer` internal `activeLabel` state, captured on `startTimer()`, cleared in `hardReset()`.

- [ ] **Step 1: Rewrite `TimerContext.jsx`**

Replace the entire contents of `src/features/timer/TimerContext.jsx` with:

```jsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef, useEffect } from "react";

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [configMinutes, setConfigMinutes] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [timerSuggested, setTimerSuggested] = useState(false);
  const [pendingLabel, setPendingLabel] = useState(null);
  const sessionStart = useRef(null);

  function requestTimer(label) {
    setPendingLabel(label);
    setTimerSuggested(true);
  }

  function acknowledgeTimerSuggestion() {
    setTimerSuggested(false);
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (sessionStart.current !== null) {
        setSessionSeconds(Math.floor((Date.now() - sessionStart.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function markSessionStart() {
    if (sessionStart.current === null) {
      sessionStart.current = Date.now();
    }
  }

  function resetSession() {
    sessionStart.current = null;
    setSessionSeconds(0);
    setTimerSuggested(false);
    setPendingLabel(null);
  }

  return (
    <TimerContext.Provider value={{
      isOpen, setIsOpen,
      timeLeft, setTimeLeft,
      isRunning, setIsRunning,
      configMinutes, setConfigMinutes,
      sessionSeconds,
      timerSuggested, pendingLabel, requestTimer, acknowledgeTimerSuggestion,
      markSessionStart,
      resetSession,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  return useContext(TimerContext);
}
```

- [ ] **Step 2: Rewrite `GlobalTimer.jsx`**

Replace the entire contents of `src/features/timer/GlobalTimer.jsx` with:

```jsx
import { useEffect, useRef } from "react";
import { useTimer } from "./TimerContext";
import AnalogTimer from "./AnalogTimer";

export default function GlobalTimer({ rewardVideos = [] }) {
  const { isOpen, setIsOpen, isRunning, timerSuggested, acknowledgeTimerSuggestion } = useTimer();
  const clockRef = useRef(null);
  const tabRef = useRef(null);
  const swipeRef = useRef(null);

  const tabState = isRunning ? "running" : (timerSuggested ? "suggested" : "idle");

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e) {
      if (
        clockRef.current && !clockRef.current.contains(e.target) &&
        tabRef.current && !tabRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [isOpen, setIsOpen]);

  function handleClockPointerDown(e) {
    swipeRef.current = { y: e.clientY };
  }
  function handleClockPointerUp(e) {
    if (!swipeRef.current) return;
    const dy = e.clientY - swipeRef.current.y;
    swipeRef.current = null;
    if (dy < -40) setIsOpen(false);
  }

  function handleTabClick() {
    setIsOpen((v) => {
      const next = !v;
      if (next) acknowledgeTimerSuggestion();
      return next;
    });
  }

  return (
    <>
      <button
        ref={tabRef}
        className={`global-timer-tab global-timer-tab--${tabState}`}
        onClick={handleTabClick}
        aria-label="Таймер"
      >
        <span className="global-timer-tab__icon">⏱</span>
      </button>

      <div
        ref={clockRef}
        className={`global-timer${isOpen ? " global-timer--open" : ""}`}
      >
        <div
          className="global-timer__clock"
          onPointerDown={handleClockPointerDown}
          onPointerUp={handleClockPointerUp}
        >
          <AnalogTimer rewardVideos={rewardVideos} clockOnly />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: `AnalogTimer.jsx` — swap the context destructure**

Find (line 68):

```js
  const { setIsOpen, setTimeLeft, setIsRunning, setConfigMinutes, timerRequest } = useTimer();
```

Replace with:

```js
  const { setIsOpen, setTimeLeft, setIsRunning, setConfigMinutes, pendingLabel } = useTimer();
```

- [ ] **Step 4: `AnalogTimer.jsx` — add `activeLabel` state**

Find:

```js
  const [setMinutes, setSetMinutes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
```

Replace with:

```js
  const [setMinutes, setSetMinutes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [activeLabel, setActiveLabel] = useState(null);
```

- [ ] **Step 5: `AnalogTimer.jsx` — delete the dial auto-fill effect**

Find and delete entirely (this whole block, including the two comment lines above it):

```js
  // A recipe step asked for a specific duration (parseTimerMinutesFromText).
  // Pre-fill the dial so the child only has to press play — but never
  // clobber a countdown that's already running.
  useEffect(() => {
    if (!timerRequest || running) return;
    hardReset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing the dial to an external request from the recipe engine, not derived local state
    setSetMinutes(Math.max(1, Math.min(59, Math.round(timerRequest.minutes))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRequest]);
```

- [ ] **Step 6: `AnalogTimer.jsx` — clear `activeLabel` in `hardReset`**

Find:

```js
    setRunning(false);
    setFinished(false);
    setSecondsLeft(0);
    setSetMinutes(0);
    setListenState("idle");
    setCenterPressed(false);
    resetRewardState();
```

Replace with:

```js
    setRunning(false);
    setFinished(false);
    setSecondsLeft(0);
    setSetMinutes(0);
    setListenState("idle");
    setCenterPressed(false);
    setActiveLabel(null);
    resetRewardState();
```

- [ ] **Step 7: `AnalogTimer.jsx` — capture `activeLabel` in `startTimer`**

Find:

```js
  function startTimer() {
    if (setMinutes <= 0) return;
    setListenState("idle");
    setFinished(false);
    resetRewardState();
    setSecondsLeft(setMinutes * 60);
```

Replace with:

```js
  function startTimer() {
    if (setMinutes <= 0) return;
    setListenState("idle");
    setFinished(false);
    resetRewardState();
    setActiveLabel(pendingLabel || "Таймер");
    setSecondsLeft(setMinutes * 60);
```

- [ ] **Step 8: `AnalogTimer.jsx` — render the step label above the drag-label**

Find:

```jsx
          {(running || setMinutes > 0) && listenState !== "success" && (
            <div className="analog-timer-drag-label">
              {running ? (
                remainingSeconds < 60 ? (
                  <>
                    <span className="analog-timer-drag-label__value">{remainingSeconds}</span>
                    <span className="analog-timer-drag-label__unit">{getSecondLabel(remainingSeconds)}</span>
                  </>
                ) : (
                  <>
                    <span className="analog-timer-drag-label__value">{displayMin}</span>
                    <span className="analog-timer-drag-label__unit">{minuteWord}</span>
                  </>
                )
              ) : (
                <>
                  <span className="analog-timer-drag-label__value">{setMinutes}</span>
                  <span className="analog-timer-drag-label__unit">{getMinuteLabel(setMinutes)}</span>
                </>
              )}
            </div>
          )}
```

Replace with:

```jsx
          {(running || setMinutes > 0) && listenState !== "success" && (
            <div className="analog-timer-drag-label">
              {running && activeLabel && (
                <span className="analog-timer-drag-label__step">{activeLabel}</span>
              )}
              <div className="analog-timer-drag-label__row">
                {running ? (
                  remainingSeconds < 60 ? (
                    <>
                      <span className="analog-timer-drag-label__value">{remainingSeconds}</span>
                      <span className="analog-timer-drag-label__unit">{getSecondLabel(remainingSeconds)}</span>
                    </>
                  ) : (
                    <>
                      <span className="analog-timer-drag-label__value">{displayMin}</span>
                      <span className="analog-timer-drag-label__unit">{minuteWord}</span>
                    </>
                  )
                ) : (
                  <>
                    <span className="analog-timer-drag-label__value">{setMinutes}</span>
                    <span className="analog-timer-drag-label__unit">{getMinuteLabel(setMinutes)}</span>
                  </>
                )}
              </div>
            </div>
          )}
```

(Note: the seconds branch here still reads `getSecondLabel` — Task 3 replaces that. Leaving it as-is keeps this step a pure structural change.)

- [ ] **Step 9: `reading/index.jsx` — import `buildTimerLabel`**

Find (line 7):

```js
import { parseRecipeTxt, resolveStepOwners, applyPortions, applyFireEmoji, stepPortionsMultiplier, computeStepSegments, formatPortionsPhrase, parseTimerMinutesFromText, applyOptionSelections, applyOptionValueConditional, filterStepsByOptions } from "./parseRecipeTxt";
```

Replace with:

```js
import { parseRecipeTxt, resolveStepOwners, applyPortions, applyFireEmoji, stepPortionsMultiplier, computeStepSegments, formatPortionsPhrase, parseTimerMinutesFromText, buildTimerLabel, applyOptionSelections, applyOptionValueConditional, filterStepsByOptions } from "./parseRecipeTxt";
```

- [ ] **Step 10: `reading/index.jsx` — call `requestTimer` with a label, not minutes**

Find (around line 630-642):

```js
  const requestTimer = useTimer()?.requestTimer;
  useEffect(() => {
    // Duration can be templated ({N|минуту|минуты|минут}) to scale with
    // portions (e.g. "подогревать 3 минуты" for 1 stakan of milk becomes
    // "6 минут" for 2), or depend on which option was chosen
    // ({filling:колбаса?1 минуту|4 минуты}) — resolve both before parsing,
    // or the raw, unresolved template text (which still contains every
    // candidate duration as a literal substring) would let the wrong one
    // win the "last duration mentioned" pick.
    const minutes = parseTimerMinutesFromText(applyOptionValueConditional(applyOptionSelections(applyPortions(step?.text, portions, ingredientOverrides), optionSelections), optionSelections));
    if (minutes && requestTimer) requestTimer(minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, portions, ingredientOverrides, optionSelections]); // step derived from stepIndex; portions loads asynchronously and may not be settled yet on the first render for this step
```

Replace with:

```js
  const requestTimer = useTimer()?.requestTimer;
  useEffect(() => {
    // Duration can be templated ({N|минуту|минуты|минут}) to scale with
    // portions (e.g. "подогревать 3 минуты" for 1 stakan of milk becomes
    // "6 минут" for 2), or depend on which option was chosen
    // ({filling:колбаса?1 минуту|4 минуты}) — resolve both before parsing,
    // or the raw, unresolved template text (which still contains every
    // candidate duration as a literal substring) would let the wrong one
    // win the "last duration mentioned" pick.
    const resolvedText = applyOptionValueConditional(applyOptionSelections(applyPortions(step?.text, portions, ingredientOverrides), optionSelections), optionSelections);
    const minutes = parseTimerMinutesFromText(resolvedText);
    if (minutes && requestTimer) requestTimer(buildTimerLabel(resolvedText));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, portions, ingredientOverrides, optionSelections]); // step derived from stepIndex; portions loads asynchronously and may not be settled yet on the first render for this step
```

- [ ] **Step 11: `styles.css` — replace the tab-digit CSS with icon-only + glow states**

Find (this spans from `.global-timer-tab__icon` through the end of the `gt-breathe` keyframes):

```css
.global-timer-tab__icon {
  font-size: 17px;
  line-height: 1;
}

.global-timer-tab__time {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 0;
}

.global-timer-tab__mm,
.global-timer-tab__ss {
  font-family: ui-monospace, "Courier New", monospace;
  font-size: 15px;
  font-weight: 800;
  line-height: 1;
  color: #3a2e22;
  letter-spacing: -0.5px;
  transition: font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.global-timer-tab__sep {
  font-family: ui-monospace, "Courier New", monospace;
  font-size: 15px;
  font-weight: 800;
  line-height: 1;
  color: #3a2e22;
  letter-spacing: -0.5px;
  transition: font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.global-timer-tab--running .global-timer-tab__sep {
  animation: gt-colon-blink 1s step-start infinite;
}

@keyframes gt-colon-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.global-timer-tab--idle { background: #fffdf9; }

.global-timer-tab--session { background: #fffdf9; }
.global-timer-tab--session .global-timer-tab__mm,
.global-timer-tab--session .global-timer-tab__ss { color: rgba(58, 46, 34, 0.45); }

.global-timer-tab--set { background: #fffdf9; }
.global-timer-tab--set .global-timer-tab__mm,
.global-timer-tab--set .global-timer-tab__ss { color: #c84b2a; }

.global-timer-tab--set,
.global-timer-tab--running {
  width: 240px;
  height: 102px;
  border-radius: 0 0 42px 42px;
}

.global-timer-tab--set .global-timer-tab__mm,
.global-timer-tab--set .global-timer-tab__ss,
.global-timer-tab--set .global-timer-tab__sep,
.global-timer-tab--running .global-timer-tab__mm,
.global-timer-tab--running .global-timer-tab__ss,
.global-timer-tab--running .global-timer-tab__sep {
  font-size: 45px;
  letter-spacing: -1px;
}

.global-timer-tab--running {
  background: #f5c842;
  animation: gt-breathe 2.2s ease-in-out infinite;
}

@keyframes gt-breathe {
  0%, 100% { box-shadow: 3px 3px 6px rgba(245, 200, 66, 0.4), -3px 3px 6px rgba(245, 200, 66, 0.4); }
  50%       { box-shadow: 3px 3px 18px rgba(245, 200, 66, 0.8), -3px 3px 18px rgba(245, 200, 66, 0.8); }
}
```

Replace with:

```css
.global-timer-tab__icon {
  font-size: 17px;
  line-height: 1;
}

.global-timer-tab--idle { background: #fffdf9; }

.global-timer-tab--running {
  background: #f5c842;
  animation: gt-breathe 2.2s ease-in-out infinite;
}

@keyframes gt-breathe {
  0%, 100% { box-shadow: 3px 3px 6px rgba(245, 200, 66, 0.4), -3px 3px 6px rgba(245, 200, 66, 0.4); }
  50%       { box-shadow: 3px 3px 18px rgba(245, 200, 66, 0.8), -3px 3px 18px rgba(245, 200, 66, 0.8); }
}

.global-timer-tab--suggested {
  animation: gt-suggest-glow 1.8s ease-in-out infinite;
}

@keyframes gt-suggest-glow {
  0%, 100% { box-shadow: 3px 3px 8px rgba(200, 75, 42, 0.18), -3px 3px 8px rgba(200, 75, 42, 0.18); }
  50%      { box-shadow: 3px 3px 20px rgba(200, 75, 42, 0.55), -3px 3px 20px rgba(200, 75, 42, 0.55); }
}
```

(This drops the now-unreachable `--session`/`--set` digit-color rules and the 240×102 big-tab size along with the colon-blink keyframes — none of that markup exists anymore after Step 2's `GlobalTimer.jsx` rewrite.)

- [ ] **Step 12: `styles.css` — restructure the drag-label for the optional step-label row**

Find:

```css
.analog-timer-drag-label {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  width: 100%;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  pointer-events: none;
  animation: drag-label-in 0.12s ease both;
  z-index: 10;
}

.analog-timer-drag-label__value {
  font-size: 56px;
  font-weight: 900;
  line-height: 1;
  color: #c84b2a;
  font-family: Nunito, sans-serif;
  letter-spacing: -1px;
  text-shadow: 0 2px 8px rgba(200, 75, 42, 0.25);
}

.analog-timer-drag-label__unit {
  font-size: 20px;
  font-weight: 600;
  color: rgba(200, 75, 42, 0.7);
  font-family: Nunito, sans-serif;
  padding-bottom: 8px;
}
```

Replace with:

```css
.analog-timer-drag-label {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  animation: drag-label-in 0.12s ease both;
  z-index: 10;
}

.analog-timer-drag-label__step {
  font-size: 13px;
  font-weight: 700;
  color: rgba(58, 44, 32, 0.6);
  font-family: Nunito, sans-serif;
  max-width: min(84vw, var(--gt-clock-size, 260px));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 14px;
}

.analog-timer-drag-label__row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
}

.analog-timer-drag-label__value {
  font-size: 56px;
  font-weight: 900;
  line-height: 1;
  color: #c84b2a;
  font-family: Nunito, sans-serif;
  letter-spacing: -1px;
  text-shadow: 0 2px 8px rgba(200, 75, 42, 0.25);
}

.analog-timer-drag-label__unit {
  font-size: 20px;
  font-weight: 600;
  color: rgba(200, 75, 42, 0.7);
  font-family: Nunito, sans-serif;
  padding-bottom: 8px;
}
```

- [ ] **Step 13: Lint sanity check**

Run: `npx eslint src/features/timer/TimerContext.jsx src/features/timer/GlobalTimer.jsx src/features/timer/AnalogTimer.jsx src/topics/renderers/reading/index.jsx`
Expected: no errors (in particular, no `no-unused-vars` for `timerRequest`, `pad`, or `activeLabel` — all old references are gone and the new `activeLabel` is read in Step 8's JSX).

- [ ] **Step 14: Commit**

```bash
git add src/features/timer/TimerContext.jsx src/features/timer/GlobalTimer.jsx src/features/timer/AnalogTimer.jsx src/topics/renderers/reading/index.jsx src/styles.css
git commit -m "feat(timer): glow the tab instead of auto-opening, drop tab digits, show step label"
```

---

### Task 3: Minutes-only countdown display

**Files:**
- Modify: `src/features/timer/AnalogTimer.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: the `analog-timer-drag-label__row` structure produced by Task 2, Step 8.
- Produces: no new interfaces — purely a display-text change inside the existing `timeDisplayString` variable and the drag-label row.

- [ ] **Step 1: `AnalogTimer.jsx` — static "меньше минуты" in the digital readout**

Find:

```js
  const timeDisplayString = running
    ? (
      remainingSeconds > 0 && remainingSeconds < 60
        ? `Осталось ${remainingSeconds} ${getSecondLabel(remainingSeconds)}`
        : (sectorMin > 0 ? `${leftWord} ${displayMin} ${minuteWord}` : "0 минут")
    )
    : idleDisplayString;
```

Replace with:

```js
  const timeDisplayString = running
    ? (
      remainingSeconds > 0 && remainingSeconds < 60
        ? "Осталось меньше минуты"
        : (sectorMin > 0 ? `${leftWord} ${displayMin} ${minuteWord}` : "0 минут")
    )
    : idleDisplayString;
```

- [ ] **Step 2: `AnalogTimer.jsx` — same for the drag-label**

Find:

```jsx
                {running ? (
                  remainingSeconds < 60 ? (
                    <>
                      <span className="analog-timer-drag-label__value">{remainingSeconds}</span>
                      <span className="analog-timer-drag-label__unit">{getSecondLabel(remainingSeconds)}</span>
                    </>
                  ) : (
```

Replace with:

```jsx
                {running ? (
                  remainingSeconds < 60 ? (
                    <span className="analog-timer-drag-label__text">меньше минуты</span>
                  ) : (
```

- [ ] **Step 3: `AnalogTimer.jsx` — remove the now-unused `getSecondLabel`**

Find and delete entirely:

```js
function getSecondLabel(value) {
  const safeValue = Math.max(0, Math.floor(value));
  const lastDigit = safeValue % 10;
  const lastTwoDigits = safeValue % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "секунд";
  if (lastDigit === 1) return "секунда";
  if (lastDigit >= 2 && lastDigit <= 4) return "секунды";
  return "секунд";
}
```

- [ ] **Step 4: `styles.css` — add the `__text` variant**

Find (this is now right after Task 2 Step 12's version of `.analog-timer-drag-label__unit`):

```css
.analog-timer-drag-label__unit {
  font-size: 20px;
  font-weight: 600;
  color: rgba(200, 75, 42, 0.7);
  font-family: Nunito, sans-serif;
  padding-bottom: 8px;
}
```

Replace with:

```css
.analog-timer-drag-label__unit {
  font-size: 20px;
  font-weight: 600;
  color: rgba(200, 75, 42, 0.7);
  font-family: Nunito, sans-serif;
  padding-bottom: 8px;
}

.analog-timer-drag-label__text {
  font-size: 30px;
  font-weight: 900;
  line-height: 1;
  color: #c84b2a;
  font-family: Nunito, sans-serif;
  text-shadow: 0 2px 8px rgba(200, 75, 42, 0.25);
}
```

- [ ] **Step 5: Lint sanity check**

Run: `npx eslint src/features/timer/AnalogTimer.jsx`
Expected: no errors — in particular no `no-undef` for `getSecondLabel`, which would mean Step 2's replacement missed a reference to it somewhere else in the file.

- [ ] **Step 6: Commit**

```bash
git add src/features/timer/AnalogTimer.jsx src/styles.css
git commit -m "feat(timer): drop second-level precision from the countdown display"
```

---

### Task 4: Manual verification in the browser

**Files:** none (verification only)

**Interfaces:**
- Consumes: the complete feature from Tasks 1–3.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running; app serves at `http://localhost:8080`)

- [ ] **Step 2: Open a recipe with a timer step, headed Playwright**

Open `buckwheat.txt` (has "Варить 20 минут (установить таймер)" at step 11) in the app and step through to that instruction. Confirm:
- The analog clock does **not** pop open by itself.
- The collapsed tab starts a soft pulsing orange glow (no digits, no MM:SS — just the ⏱ icon with an animated shadow).

- [ ] **Step 3: Confirm the dial isn't auto-filled and the glow clears on open**

Tap the glowing tab. Confirm:
- The glow animation stops immediately.
- The dial is **not** pre-set to 20 minutes — it shows whatever was left from the last manual use (or "Выберите время" / 0 if never used this session).

- [ ] **Step 4: Confirm the step label appears once started**

Drag the dial to any duration and press play. Confirm:
- A small line of text appears above the big countdown number reading the recipe step's label (something like "Варить 20 минут." — not the raw "(установить таймер)" marker text).
- The countdown itself only shows whole minutes (e.g. "20" → "19" → ... ), no seconds, no colon.

- [ ] **Step 5: Confirm the last-minute wording and that the tab never shows digits**

Fast-forward is not available in the UI, so either wait it out on a 1-minute dial-set timer, or temporarily edit `secondsLeft` in React DevTools to a value under 60 to check the visual without waiting. Confirm:
- The big label switches to "меньше минуты" (or the drag-label shows "меньше минуты") with no second-by-second countdown digit.
- The collapsed tab (glance at it without opening) shows only the pulsing/highlighted icon at every point during the run — never any numbers.
- The second hand on the clock face still visually sweeps and the tick sound (if enabled) still plays every second — these were intentionally left unchanged.

- [ ] **Step 6: Confirm manual (non-recipe) timer still defaults to "Таймер"**

Close the recipe, open the timer tab directly from the home/idle screen (or wherever `GlobalTimer` is mounted outside a recipe), set a duration by hand, and start it. Confirm the step-label line reads plain "Таймер" (or is simply the fallback default — no recipe step text).

- [ ] **Step 7: Report results**

No commit for this task — if any check fails, go back to the relevant task, fix, and re-run its lint/test step before re-verifying here.

---

## Self-Review Notes

- **Spec coverage:** §1 (no auto-open/no auto-fill) → Task 2 Steps 1, 5, 9-10. §2 (icon-only tab, 3 states) → Task 2 Steps 2, 11. §3 (step label, correct render location after the dead-code correction) → Task 2 Steps 3, 4, 6, 7, 8, 9, 10, 12. §4 (minutes-only) → Task 3. Out-of-scope items (video reward, multi-timer, recipe content) are untouched by every task above — confirmed no task references `rewardSecondsLeft`, recipe `.txt` files, or a second `TimerProvider` instance.
- **Placeholder scan:** none found — every step has complete code, no "TODO"/"similar to above".
- **Type/name consistency:** `pendingLabel`, `timerSuggested`, `acknowledgeTimerSuggestion`, `activeLabel` are spelled identically everywhere they're introduced (Task 2) and consumed (Task 2 Step 8, Task 3). `buildTimerLabel` signature matches between Task 1's export and Task 2 Step 10's call site.
