# Instant-Mode Pill Flash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the session-header pill (`.session-plan-tongue`) flash 😊/😢 on the final
answer in `column_addition`'s four `evaluation: "instant"` modes (`fingers_count`,
`build_number`, `identify_number`, `regroup_ten`), where `sessionState.status` never
becomes `"answer_correct"`/`"answer_incorrect"` today.

**Architecture:** A new, purely cosmetic `pillFlash` state (`"correct" | "incorrect" | null`)
lives in `SessionScreen.jsx`, entirely decoupled from `sessionState`/`handleInstantCorrect`/
`handleInstantIncorrect`/streak/reward logic — zero risk to the already-tuned "no pause"
behavior of instant modes. `handleCorrect` sets it to `"correct"` whenever
`mode.evaluation === "instant"` (all 4 renderers already call `onCorrect` exactly once, at
the final right answer — no renderer change needed for the correct case). A new
`onFlashIncorrect` callback, threaded down through `ColumnAdditionRenderer` into exactly the
3 renderers that have an unambiguous "final wrong answer" moment
(`IdentifyNumberTask`, `BuildNumberTask`, and only the digit-keypad branch of
`FingersCountTask` — not its hand-building-phase mismatch), sets it to `"incorrect"`.
A timer clears `pillFlash` after 900ms. `SessionScreen` merges `pillFlash` into the existing
`answerStatus` prop it already passes to `SessionHeader` — `tonguePillState.js` and
`SessionHeader.jsx` need no changes at all.

**Tech Stack:** React (JSX, no new deps), no new tests (no JSX component test harness exists
in this codebase — same constraint as the prior pill-feedback plan), manual browser
verification via Playwright (headed) plus `npm run build`/scoped `eslint`.

## Global Constraints

- Do not touch `sessionState.status`, `handleInstantCorrect`/`handleInstantIncorrect`,
  streak/reward logic, or any instant-mode auto-advance timing — `pillFlash` must be fully
  independent local UI state in `SessionScreen.jsx`.
- Do not change `incorrectCount`/`correctCount` semantics or the existing `onMistake`/
  `strictStars` gating — `onFlashIncorrect` is a new, additional call, never a replacement
  for an existing `onMistake`/`onCorrect` call site.
- `column_arithmetic` ("Столбик — Тренажёр", `evaluation: "auto"`) is out of scope — already
  works correctly, do not touch `ColumnArithmeticTask`.
- `RegroupTenTask.jsx` has no wrong-answer path — do not add `onFlashIncorrect` there.
- In `FingersCountTask.jsx`, `onFlashIncorrect` must fire **only** from the digit-keypad
  mismatch in `handleDigit` — never from the hand-building-phase mismatch in `confirm()`.
- `tonguePillState.js` and `SessionHeader.jsx` are not modified by this plan — the merge
  happens entirely in `SessionScreen.jsx` before the existing `answerStatus` prop is passed.
- `onFlashIncorrect` is not gated by `sessionParams?.strictStars` (unlike `onMistake` /
  `strictMistake`) — it is purely informational UI feedback, not a scoring signal.

---

### Task 1: Add `pillFlash` state and merge it into the pill's `answerStatus` in SessionScreen

**Files:**
- Modify: `src/features/session/SessionScreen.jsx`

**Interfaces:**
- Produces: local state `pillFlash: "correct" | "incorrect" | null`; a `handleFlashIncorrect`
  function (`() => void`) that Task 2 wires into `<Renderer onFlashIncorrect={...} />`;
  `handleCorrect` (existing function) gains a side effect for instant mode.
- Consumes: existing `mode` (from `useSessionEngine()`, already destructured), existing
  `status` (from `sessionState`).

- [ ] **Step 1: Add the `pillFlash` state and its auto-clear effect**

Right after the existing line (currently line 94):
```jsx
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState(false);
```
add:
```jsx
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState(false);
  const [pillFlash, setPillFlash] = useState(null);

  useEffect(() => {
    if (!pillFlash) return undefined;
    const timer = setTimeout(() => setPillFlash(null), 900);
    return () => clearTimeout(timer);
  }, [pillFlash]);
```

- [ ] **Step 2: Make `handleCorrect` flash the pill for instant-evaluation modes**

Replace (currently lines 120–123):
```jsx
  function handleCorrect(conceptId, cardId) {
    if (!ownsFeedback) playFeedback("correct");
    onCorrect(conceptId, cardId);
  }
```
with:
```jsx
  function handleCorrect(conceptId, cardId) {
    if (!ownsFeedback) playFeedback("correct");
    if (mode?.evaluation === "instant") setPillFlash("correct");
    onCorrect(conceptId, cardId);
  }
```

- [ ] **Step 3: Add `handleFlashIncorrect`**

Right after the existing `handleMistake` function (currently lines 130–133):
```jsx
  function handleMistake(conceptId, cardId) {
    if (!ownsFeedback) playFeedback("incorrect");
    onMistake(conceptId, cardId);
  }
```
add:
```jsx
  function handleFlashIncorrect() {
    setPillFlash("incorrect");
  }
```

- [ ] **Step 4: Compute the merged pill status and use it in the `SessionHeader` prop**

Replace (currently line 239, inside the `<SessionHeader .../>` call):
```jsx
          answerStatus={status}
```
with:
```jsx
          answerStatus={pillFlash ? (pillFlash === "correct" ? "answer_correct" : "answer_incorrect") : status}
```

- [ ] **Step 5: Pass `onFlashIncorrect` to the Renderer**

Replace (currently line 283, inside the `<Renderer .../>` call):
```jsx
            onMistake={isAdvanceGateActive ? noop : handleMistake}
```
with:
```jsx
            onMistake={isAdvanceGateActive ? noop : handleMistake}
            onFlashIncorrect={isAdvanceGateActive ? noop : handleFlashIncorrect}
```

- [ ] **Step 6: Lint**

Run: `npx eslint src/features/session/SessionScreen.jsx`
Expected: no new errors (same pre-existing `react-hooks/exhaustive-deps` warning on the
unrelated `topicRecord` effect is fine — do not fix it, out of scope).

- [ ] **Step 7: Commit**

```bash
git add src/features/session/SessionScreen.jsx
git commit -m "feat: flash session pill on instant-mode final answer"
```

---

### Task 2: Thread `onFlashIncorrect` through ColumnAdditionRenderer

**Files:**
- Modify: `src/topics/renderers/column_addition/index.jsx`

**Interfaces:**
- Consumes: `onFlashIncorrect` prop from `SessionScreen.jsx` (Task 1).
- Produces: `onFlashIncorrect` prop passed to `IdentifyNumberTask`, `BuildNumberTask`, and
  `FingersCountTask` (Task 3 wires each of them to actually call it).

- [ ] **Step 1: Accept the new prop on `ColumnAdditionRenderer`**

Replace (currently line 829):
```jsx
export default function ColumnAdditionRenderer({ task, mode, sessionParams, onCorrect, onPrevious, student, onMistake }) {
```
with:
```jsx
export default function ColumnAdditionRenderer({ task, mode, sessionParams, onCorrect, onPrevious, student, onMistake, onFlashIncorrect }) {
```

- [ ] **Step 2: Pass it to `FingersCountTask`**

Replace (currently line 838):
```jsx
    return <FingersCountTask task={task} onCorrect={onCorrect} onMistake={strictMistake} />;
```
with:
```jsx
    return <FingersCountTask task={task} onCorrect={onCorrect} onMistake={strictMistake} onFlashIncorrect={onFlashIncorrect} />;
```

- [ ] **Step 3: Pass it to `BuildNumberTask`**

Replace (currently lines 840–848):
```jsx
  if (task?.type === "build_number") {
    return (
      <BuildNumberTask
        key={`${task.cardId}-${task.number}`}
        task={task}
        onCorrect={onCorrect}
        onMistake={strictMistake}
      />
    );
  }
```
with:
```jsx
  if (task?.type === "build_number") {
    return (
      <BuildNumberTask
        key={`${task.cardId}-${task.number}`}
        task={task}
        onCorrect={onCorrect}
        onMistake={strictMistake}
        onFlashIncorrect={onFlashIncorrect}
      />
    );
  }
```

- [ ] **Step 4: Pass it to `IdentifyNumberTask`**

Replace (currently lines 850–858):
```jsx
  if (task?.type === "identify_number") {
    return (
      <IdentifyNumberTask
        key={`${task.cardId}-${task.number}`}
        task={task}
        onCorrect={onCorrect}
        onMistake={strictMistake}
      />
    );
  }
```
with:
```jsx
  if (task?.type === "identify_number") {
    return (
      <IdentifyNumberTask
        key={`${task.cardId}-${task.number}`}
        task={task}
        onCorrect={onCorrect}
        onMistake={strictMistake}
        onFlashIncorrect={onFlashIncorrect}
      />
    );
  }
```

Do **not** add it to the `regroup_ten` branch (currently lines 860–868) — `RegroupTenTask`
has no wrong-answer path.

- [ ] **Step 5: Lint**

Run: `npx eslint src/topics/renderers/column_addition/index.jsx`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/column_addition/index.jsx
git commit -m "feat: thread onFlashIncorrect through ColumnAdditionRenderer"
```

---

### Task 3: Call `onFlashIncorrect` at the final-wrong-answer moment in the 3 task components

**Files:**
- Modify: `src/topics/renderers/column_addition/IdentifyNumberTask.jsx`
- Modify: `src/topics/renderers/column_addition/BuildNumberTask.jsx`
- Modify: `src/topics/renderers/column_addition/FingersCountTask.jsx`

**Interfaces:**
- Consumes: `onFlashIncorrect` prop from `ColumnAdditionRenderer` (Task 2).

- [ ] **Step 1: `IdentifyNumberTask.jsx` — accept the prop and call it in `checkAnswer`**

Replace (currently line 10):
```jsx
export default function IdentifyNumberTask({ task, onCorrect, onMistake }) {
```
with:
```jsx
export default function IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
```

Replace (currently lines 22–24, inside `checkAnswer`):
```jsx
    setShake({ tens: !okTens, ones: !okOnes });
    onMistake?.(task.conceptId, task.cardId);
    setTimeout(() => {
```
with:
```jsx
    setShake({ tens: !okTens, ones: !okOnes });
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => {
```

- [ ] **Step 2: `BuildNumberTask.jsx` — accept the prop and call it in `handleDone`**

Replace (currently line 142):
```jsx
export default function BuildNumberTask({ task, onCorrect, onMistake }) {
```
with:
```jsx
export default function BuildNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
```

Replace (currently the `else` branch of `handleDone`, lines 271–273):
```jsx
    } else {
      setErrorZones({ tens: !okTens, ones: !okOnes });
      onMistake?.(task.conceptId, task.cardId);
    }
```
with:
```jsx
    } else {
      setErrorZones({ tens: !okTens, ones: !okOnes });
      onMistake?.(task.conceptId, task.cardId);
      onFlashIncorrect?.();
    }
```

- [ ] **Step 3: `FingersCountTask.jsx` — accept the prop and call it only from the digit
  keypad's wrong-answer branch**

Replace (currently line 261):
```jsx
export default function FingersCountTask({ task, onCorrect, onMistake }) {
  return <TwoPhaseTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
}
```
with:
```jsx
export default function FingersCountTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  return <TwoPhaseTask task={task} onCorrect={onCorrect} onMistake={onMistake} onFlashIncorrect={onFlashIncorrect} />;
}
```

Replace (currently line 144, the `TwoPhaseTask` signature):
```jsx
function TwoPhaseTask({ task, onCorrect, onMistake }) {
```
with:
```jsx
function TwoPhaseTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
```

Replace (currently lines 192–202, `handleDigit` — note the hand-building-phase mismatch in
`confirm()`, lines 167–178, is **not** touched):
```jsx
  function handleDigit(d) {
    if (phase !== "answer" || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) { setInput(next); return; }
    if (Number(next.join("")) === result) {
      setPhase("done"); setTimeout(() => onCorrect(), 700);
    } else {
      setShake(true); setTimeout(() => { setShake(false); setInput([]); }, 500);
      onMistake?.();
    }
  }
```
with:
```jsx
  function handleDigit(d) {
    if (phase !== "answer" || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) { setInput(next); return; }
    if (Number(next.join("")) === result) {
      setPhase("done"); setTimeout(() => onCorrect(), 700);
    } else {
      setShake(true); setTimeout(() => { setShake(false); setInput([]); }, 500);
      onMistake?.();
      onFlashIncorrect?.();
    }
  }
```

- [ ] **Step 4: Lint all three files**

Run: `npx eslint src/topics/renderers/column_addition/IdentifyNumberTask.jsx src/topics/renderers/column_addition/BuildNumberTask.jsx src/topics/renderers/column_addition/FingersCountTask.jsx`
Expected: no new errors.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/column_addition/IdentifyNumberTask.jsx src/topics/renderers/column_addition/BuildNumberTask.jsx src/topics/renderers/column_addition/FingersCountTask.jsx
git commit -m "feat: flash session pill on final wrong answer in column_addition instant tasks"
```

---

### Task 4: Verification

**Files:** none (verification only)

- [ ] **Step 1: Grep sanity check — confirm the hand-building-phase mismatch was not touched**

Run: `grep -n "onFlashIncorrect" src/topics/renderers/column_addition/FingersCountTask.jsx`
Expected: exactly one match, inside `handleDigit` (the digit-keypad branch). The `confirm()`
function (hand-building-phase mismatch, around line 176) must show zero matches for
`onFlashIncorrect`.

- [ ] **Step 2: Run the full unit-test suite**

Run: `npx vitest run --exclude "**/node_modules/**" --exclude "**/.worktrees/**" --exclude "**/.claude/**" --exclude "**/.superpowers/**" --exclude "**/runtime/**" --exclude "**/.codex-deploy-backfix-*/**" --exclude "**/codex-deploy-backfix-*/**" --exclude "**/__codex_deploy_reward_fix_*/**" --exclude "**/output/**" --exclude "**/dist/**"`
Expected: no new failures beyond the known pre-existing baseline (unrelated files —
backend tests, `topicLoader`, `format.test`, `comparison`/`function_cards`/`reading` engine
tests; see `feedback_test_baseline_stray_dirs` memory). None of the files touched by this
plan should appear in the failure list.

- [ ] **Step 3: Manual check in a headed Playwright browser**

Navigate to a student session on topic "Сложение и вычитание в столбик", mode
"Считаем на пальцах" (`fingers_count`). Build both hands to match the first number, confirm
— the pill must **not** flash on a wrong hand-confirm at this stage (per Global Constraints).
Complete the exercise up to the digit keypad, then:
1. Enter the wrong final number → pill must flash 😢 with the coral-tinted background for
   about 900ms, then return to neutral (or to the next task's own visuals).
2. Enter the correct final number → pill must flash 😊 with the green-tinted background.
3. Repeat with mode "Собери число" (`build_number`) and "Какое это число?"
   (`identify_number`) — both correct and wrong final answers should flash the pill.
4. Confirm mode "Разменяй десяток" (`regroup_ten`) still works normally (no crash from a
   missing `onFlashIncorrect` prop — it's simply never called there).
5. Confirm mode "Столбик — Тренажёр" (`column_arithmetic`, `evaluation: "auto"`) still shows
   pill feedback exactly as before (untouched by this plan).

- [ ] **Step 4: Report results**

Summarize pass/fail for each check in Step 3 back to the user before considering the plan
done.
