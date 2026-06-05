# Session Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove programmatic card limits, resume deck from last position, and unify all modes to streak-based prize video (5 correct in a row shows `<RewardVideoModal />`).

**Architecture:** Three independent changes to the session pipeline: (1) streak logic replaces percentage-based stars in `sessionEngine.js` and `useStarProgress.js`; (2) new `<RewardVideoModal />` component shown mid-session; (3) `deck_exhausted` status in engine + `deckPosition` field in `studentTopicLinks` for resume.

**Tech Stack:** React, Zustand, Vitest, IndexedDB (via `getDb`/`kv`), `pushOp` for backend sync.

**Spec:** `docs/superpowers/specs/2026-06-05-session-improvements-design.md`

---

## File Map

| File | Change |
|------|--------|
| `src/features/session/sessionEngine.js` | Add `streakCount`, `rewardEarnedCount`, `isDeckMode` to state; update `handleAnswer`/`handleInstantCorrect`/`handleInstantIncorrect`; add `deck_exhausted` in `handleAdvance` |
| `src/features/session/sessionEngine.test.js` | Update + add streak and deck_exhausted tests |
| `src/features/session/useStarProgress.js` | Replace `computeStarProgress` with `computeStreakProgress`; add `computeDisplayStars` for summary |
| `src/features/session/useStarProgress.test.js` | Replace old tests with streak tests |
| `src/features/session/useSessionEngine.js` | Expose `rewardPending`/`clearRewardPending`; handle `deck_exhausted`; apply/save `deckPosition`; bump procedural cap to 500 |
| `src/features/session/SessionScreen.jsx` | Show `<RewardVideoModal />`; show deck-exhausted dialog; fix `StarBar` props |
| `src/features/session/SessionSummary.jsx` | Remove prize video button + related state; use `computeDisplayStars` |
| `src/shared/components/StarBar.jsx` | Accept `streakCount` + `available` props instead of old API |
| `src/shared/components/RewardVideoModal.jsx` | **New** — universal video modal |
| `src/core/linkUtils.js` | Add `deckPosition` to `pushOp` payload |

---

## Task 1: Update sessionEngine.js — streak + deck_exhausted

**Files:**
- Modify: `src/features/session/sessionEngine.js`

- [ ] **Step 1: Open the file and understand the current shape**

Read `src/features/session/sessionEngine.js`. Key functions: `createSessionState`, `handleAnswer`, `handleInstantCorrect`, `handleInstantIncorrect`, `handleAdvance`.

- [ ] **Step 2: Update `createSessionState` to include new fields**

Replace the `createSessionState` function body:

```js
export function createSessionState(tasks, mode, studentId, topicId, topicVersion, conceptIds, textId = null, isDeckMode = false) {
  return {
    status: "task_active",
    tasks,
    taskIndex: 0,
    mode,
    studentId,
    topicId,
    topicVersion,
    textId,
    conceptIds,
    isDeckMode,
    correctCount: 0,
    incorrectCount: 0,
    streakCount: 0,
    rewardEarnedCount: 0,
    mistakes: [],
    assessments: [],
    startedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 3: Update `handleAnswer` to track streak**

Replace the `handleAnswer` function:

```js
export function handleAnswer(state, isCorrect, conceptId, cardId) {
  if (state.mode.evaluation === "none") {
    return handleAdvance(state);
  }
  if (isCorrect) {
    const streakCount = (state.streakCount ?? 0) + 1;
    const rewardEarnedCount = streakCount >= 5
      ? (state.rewardEarnedCount ?? 0) + 1
      : (state.rewardEarnedCount ?? 0);
    const finalStreak = streakCount >= 5 ? 0 : streakCount;
    return {
      ...state,
      status: "answer_correct",
      correctCount: state.correctCount + 1,
      streakCount: finalStreak,
      rewardEarnedCount,
    };
  }
  return {
    ...state,
    status: "answer_incorrect",
    incorrectCount: state.incorrectCount + 1,
    streakCount: 0,
    mistakes: conceptId
      ? [...state.mistakes, { conceptId, cardId }]
      : state.mistakes,
  };
}
```

- [ ] **Step 4: Update `handleInstantCorrect` — no longer completes session**

Replace the `handleInstantCorrect` function:

```js
export function handleInstantCorrect(state, conceptId, cardId) {
  const streakCount = (state.streakCount ?? 0) + 1;
  const correctCount = state.correctCount + 1;
  const rewardEarnedCount = streakCount >= 5
    ? (state.rewardEarnedCount ?? 0) + 1
    : (state.rewardEarnedCount ?? 0);
  const finalStreak = streakCount >= 5 ? 0 : streakCount;
  const nextIndex = (state.taskIndex + 1) % state.tasks.length;
  return {
    ...state,
    status: "task_active",
    taskIndex: nextIndex,
    taskRetry: 0,
    correctCount,
    streakCount: finalStreak,
    rewardEarnedCount,
  };
}
```

- [ ] **Step 5: Update `handleInstantIncorrect` to reset streak explicitly**

Replace the `handleInstantIncorrect` function:

```js
export function handleInstantIncorrect(state, conceptId, cardId) {
  const incorrectCount = state.incorrectCount + 1;
  const mistakes = conceptId ? [...state.mistakes, { conceptId, cardId }] : state.mistakes;
  const nextIndex = (state.taskIndex + 1) % state.tasks.length;
  return {
    ...state,
    status: "task_active",
    taskIndex: nextIndex,
    taskRetry: 0,
    incorrectCount,
    streakCount: 0,
    mistakes,
  };
}
```

- [ ] **Step 6: Update `handleAdvance` for deck_exhausted**

Replace the `handleAdvance` function:

```js
export function handleAdvance(state) {
  const nextIndex = state.taskIndex + 1;
  if (nextIndex >= state.tasks.length) {
    return { ...state, status: state.isDeckMode ? "deck_exhausted" : "completed" };
  }
  return { ...state, status: "task_active", taskIndex: nextIndex };
}
```

---

## Task 2: Update sessionEngine tests

**Files:**
- Modify: `src/features/session/sessionEngine.test.js`

- [ ] **Step 1: Run current tests to establish baseline**

```bash
npx vitest run src/features/session/sessionEngine.test.js
```

Expected: all pass.

- [ ] **Step 2: Update existing tests — remove `evaluation: "auto"` expectation for `completed`**

In the test "advancing from last task sets status to completed", this still holds because `isDeckMode` defaults to `false`. No change needed there.

- [ ] **Step 3: Add streak tests for `handleAnswer`**

Add after the existing `handleAnswer` describe block:

```js
describe("handleAnswer — streak tracking", () => {
  const MODE = { id: "yes_no", type: "yes_no", evaluation: "auto" };
  const TASKS = Array.from({ length: 10 }, (_, i) => ({
    type: "yes_no", conceptId: `c${i}`, card: { id: `c${i}` },
  }));

  it("increments streakCount on correct answer", () => {
    const state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    const next = handleAnswer(state, true);
    expect(next.streakCount).toBe(1);
  });

  it("resets streakCount on incorrect answer", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    state = handleAnswer(state, true);
    state = handleAnswer(state, true);
    expect(state.streakCount).toBe(2);
    state = handleAnswer(state, false);
    expect(state.streakCount).toBe(0);
  });

  it("resets streakCount to 0 and increments rewardEarnedCount at streak 5", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    for (let i = 0; i < 4; i++) state = handleAnswer(state, true);
    expect(state.streakCount).toBe(4);
    expect(state.rewardEarnedCount).toBe(0);
    // 5th correct answer
    state = handleAnswer(state, true);
    expect(state.streakCount).toBe(0);
    expect(state.rewardEarnedCount).toBe(1);
  });

  it("can earn reward multiple times per session", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    for (let i = 0; i < 5; i++) state = handleAnswer(state, true);
    expect(state.rewardEarnedCount).toBe(1);
    for (let i = 0; i < 5; i++) state = handleAnswer(state, true);
    expect(state.rewardEarnedCount).toBe(2);
  });
});
```

- [ ] **Step 4: Add deck_exhausted test**

```js
describe("handleAdvance — deck_exhausted for deck modes", () => {
  const MODE = { id: "yes_no", type: "yes_no", evaluation: "auto" };
  const TASKS = [
    { type: "yes_no", conceptId: "c1", card: { id: "c1" } },
  ];

  it("returns deck_exhausted instead of completed when isDeckMode is true", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", ["c1"], null, true);
    state = handleAnswer(state, true);
    state = handleAdvance(state);
    expect(state.status).toBe("deck_exhausted");
  });

  it("still returns completed when isDeckMode is false", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", ["c1"], null, false);
    state = handleAnswer(state, true);
    state = handleAdvance(state);
    expect(state.status).toBe("completed");
  });
});
```

- [ ] **Step 5: Add handleInstantCorrect tests**

```js
describe("handleInstantCorrect — streak without session completion", () => {
  const MODE = { id: "operation_observe", type: "operation_observe", evaluation: "instant" };
  const TASKS = Array.from({ length: 10 }, (_, i) => ({
    type: "operation_observe", conceptId: `c${i}`, card: { id: `c${i}` },
  }));

  it("increments streakCount", () => {
    const state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    const next = handleInstantCorrect(state);
    expect(next.streakCount).toBe(1);
    expect(next.status).toBe("task_active");
  });

  it("does NOT set status to completed at streak 5", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    for (let i = 0; i < 5; i++) state = handleInstantCorrect(state);
    expect(state.status).toBe("task_active");
    expect(state.streakCount).toBe(0);
    expect(state.rewardEarnedCount).toBe(1);
  });
});
```

- [ ] **Step 6: Run all updated tests**

```bash
npx vitest run src/features/session/sessionEngine.test.js
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/session/sessionEngine.js src/features/session/sessionEngine.test.js
git commit -m "feat(session): unified streak logic + deck_exhausted status"
```

---

## Task 3: Rewrite useStarProgress.js + tests

**Files:**
- Modify: `src/features/session/useStarProgress.js`
- Modify: `src/features/session/useStarProgress.test.js`

- [ ] **Step 1: Rewrite useStarProgress.js**

Replace the entire file:

```js
export function computeStreakProgress({ streakCount, available }) {
  const litStars = Math.min(5, Math.max(0, streakCount ?? 0));
  return { litStars, available: Boolean(available) };
}

// Used by SessionSummary for display-only stars (percentage-based, not for reward logic)
export function computeDisplayStars({ correctCount, incorrectCount = 0, total }) {
  const netScore = Math.max(0, (correctCount ?? 0) - (incorrectCount ?? 0));
  return Math.min(5, Math.floor(netScore / Math.max(1, total) * 5));
}

export function useStarProgress(props) {
  return computeStreakProgress(props);
}
```

- [ ] **Step 2: Rewrite useStarProgress.test.js**

Replace the entire file:

```js
import { describe, expect, it } from "vitest";
import { computeStreakProgress, computeDisplayStars } from "./useStarProgress";

describe("computeStreakProgress", () => {
  it("returns 0 lit stars at streak 0", () => {
    const r = computeStreakProgress({ streakCount: 0, available: true });
    expect(r.litStars).toBe(0);
  });

  it("maps streakCount directly to litStars", () => {
    expect(computeStreakProgress({ streakCount: 1, available: true }).litStars).toBe(1);
    expect(computeStreakProgress({ streakCount: 3, available: true }).litStars).toBe(3);
    expect(computeStreakProgress({ streakCount: 5, available: true }).litStars).toBe(5);
  });

  it("caps at 5 stars", () => {
    expect(computeStreakProgress({ streakCount: 10, available: true }).litStars).toBe(5);
  });

  it("never goes below 0", () => {
    expect(computeStreakProgress({ streakCount: -1, available: true }).litStars).toBe(0);
  });

  it("passes through available flag", () => {
    expect(computeStreakProgress({ streakCount: 5, available: false }).available).toBe(false);
    expect(computeStreakProgress({ streakCount: 5, available: true }).available).toBe(true);
  });
});

describe("computeDisplayStars", () => {
  it("returns 0 at session start", () => {
    expect(computeDisplayStars({ correctCount: 0, total: 10 })).toBe(0);
  });

  it("lights stars proportionally to correct answers", () => {
    expect(computeDisplayStars({ correctCount: 4, total: 10 })).toBe(2);
    expect(computeDisplayStars({ correctCount: 8, total: 10 })).toBe(4);
    expect(computeDisplayStars({ correctCount: 10, total: 10 })).toBe(5);
  });

  it("incorrect answers reduce stars", () => {
    expect(computeDisplayStars({ correctCount: 6, incorrectCount: 2, total: 10 })).toBe(2);
  });

  it("never exceeds 5", () => {
    expect(computeDisplayStars({ correctCount: 100, total: 10 })).toBe(5);
  });

  it("never goes below 0", () => {
    expect(computeDisplayStars({ correctCount: 2, incorrectCount: 10, total: 10 })).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/features/session/useStarProgress.test.js
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/session/useStarProgress.js src/features/session/useStarProgress.test.js
git commit -m "feat(session): replace percentage stars with computeStreakProgress + computeDisplayStars"
```

---

## Task 4: Create RewardVideoModal.jsx

**Files:**
- Create: `src/shared/components/RewardVideoModal.jsx`

This is a universal component that shows a "Молодец!" message and two buttons: watch the video now or continue. It is completely decoupled from session logic.

- [ ] **Step 1: Create the component**

Create `src/shared/components/RewardVideoModal.jsx`:

```jsx
import { useState, useEffect } from "react";
import { pickStoredRewardVideoId } from "@/shared/utils/rewardVideoPicker";
import { formatRewardTime } from "@/shared/utils/format";

const REWARD_SECONDS = 120;

function blockInteraction(event) {
  if (event.target instanceof Element && event.target.closest(".video-reward-close")) return;
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
}

export default function RewardVideoModal({ rewardVideos = [], studentId, onDismiss }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!videoUrl || secondsLeft <= 0) return undefined;
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(t); onDismiss(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [videoUrl, onDismiss]);

  function handleWatch() {
    const videoId = pickStoredRewardVideoId(rewardVideos, `student:${studentId ?? "unknown"}`);
    if (!videoId) { onDismiss(); return; }
    setVideoUrl(
      `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&controls=0&rel=0&fs=0&disablekb=1&iv_load_policy=3&modestbranding=1`
    );
    setSecondsLeft(REWARD_SECONDS);
  }

  if (videoUrl) {
    return (
      <div
        className="video-reward-overlay"
        onClickCapture={blockInteraction}
        onContextMenu={blockInteraction}
        onPointerDown={blockInteraction}
        onPointerMove={blockInteraction}
        onPointerUp={blockInteraction}
        onTouchStart={blockInteraction}
        onTouchMove={blockInteraction}
        onTouchEnd={blockInteraction}
        onWheel={blockInteraction}
      >
        <button className="video-reward-close" onClick={onDismiss} aria-label="Закрыть">✕</button>
        <div className="video-reward-frame">
          <iframe
            src={videoUrl}
            allow="accelerometer; autoplay; encrypted-media"
            frameBorder="0"
            className="video-reward-iframe"
            title="Reward video"
          />
          <div className="video-reward-blocker" aria-hidden="true" />
        </div>
        <div className="video-reward-progress">
          <div
            className="video-reward-progress__bar"
            style={{ width: `${(secondsLeft / REWARD_SECONDS) * 100}%` }}
          />
          <span className="video-reward-progress__label">{formatRewardTime(secondsLeft)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="reward-modal-overlay">
      <div className="reward-modal">
        <div className="reward-modal__stars">⭐⭐⭐⭐⭐</div>
        <div className="reward-modal__title">Молодец! Пять правильных подряд!</div>
        <div className="reward-modal__actions">
          <button className="reward-modal__btn reward-modal__btn--watch" onClick={handleWatch}>
            🎬 Смотреть мультик
          </button>
          <button className="reward-modal__btn reward-modal__btn--continue" onClick={onDismiss}>
            Продолжать занятие
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/RewardVideoModal.jsx
git commit -m "feat(components): add universal RewardVideoModal"
```

---

## Task 5: Update useSessionEngine.js — reward + deck_exhausted + deckPosition

**Files:**
- Modify: `src/features/session/useSessionEngine.js`

This task covers three areas: (1) expose `rewardPending`/`clearRewardPending`, (2) handle `deck_exhausted` status, (3) apply and save `deckPosition`.

- [ ] **Step 1: Add imports for persistStudentTopicLink**

At the top of `useSessionEngine.js`, add this import:

```js
import { persistStudentTopicLink } from "@/core/linkUtils";
```

- [ ] **Step 2: Add React state and ref for reward pending**

Inside `useSessionEngine()`, after the existing state declarations:

```js
const [rewardPending, setRewardPending] = useState(false);
const lastRewardEarnedCountRef = useRef(0);
```

Add `useRef` to the existing React import: `import { useState, useCallback, useEffect, useRef } from "react";`

- [ ] **Step 3: Add a useEffect to detect rewardEarnedCount changes**

After the existing `useEffect` for active session snapshot (around line 232), add:

```js
useEffect(() => {
  if (!sessionState) return;
  const earned = sessionState.rewardEarnedCount ?? 0;
  if (earned > lastRewardEarnedCountRef.current) {
    lastRewardEarnedCountRef.current = earned;
    if (rewardConfig.hasRewardVideos && rewardConfig.videoRewardEnabled) {
      setRewardPending(true);
    }
  }
}, [sessionState?.rewardEarnedCount]);  // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Add clearRewardPending callback**

```js
const clearRewardPending = useCallback(() => setRewardPending(false), []);
```

- [ ] **Step 5: Update buildGeneratedSessionState to pass isDeckMode and apply deckPosition**

In `buildGeneratedSessionState`, change the `flashcards` and `function_cards` branches to:

```js
} else if (renderer === "flashcards") {
  const allConcepts = deriveConcepts(topicRecord.cards);
  const selected = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
  const deckPos = link.deckPosition ?? 0;
  const safeStart = selected.length > 0 ? deckPos % selected.length : 0;
  const concepts = safeStart === 0 ? selected : selected.slice(safeStart);
  const generateTasks = ENGINE_REGISTRY.flashcards;
  tasks = generateTasks ? generateTasks(mode.type, concepts, topicRecord.cards, sessionParams) : [];
  isDeckMode = true;
} else if (renderer === "function_cards") {
  const allConcepts = deriveConcepts(topicRecord.cards);
  const selected = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
  const deckPos = link.deckPosition ?? 0;
  const safeStart = selected.length > 0 ? deckPos % selected.length : 0;
  const concepts = safeStart === 0 ? selected : selected.slice(safeStart);
  const generateTasks = ENGINE_REGISTRY.function_cards;
  tasks = generateTasks ? generateTasks(mode.type, concepts, topicRecord.cards, sessionParams) : [];
  isDeckMode = true;
```

Declare `let isDeckMode = false;` before the renderer if/else block. Pass `isDeckMode` to `createSessionState` as the 8th argument.

- [ ] **Step 6: Bump procedural session cap to 500**

Change line:
```js
const sessionSize = topicRecord.meta.sessionConfig?.maxSize ?? 15;
```
to:
```js
const sessionSize = topicRecord.meta.sessionConfig?.maxSize ?? 500;
```

- [ ] **Step 7: Add deck_exhausted React state + handlers**

Inside `useSessionEngine()`, add:

```js
const [deckExhausted, setDeckExhausted] = useState(false);
```

Add handlers:

```js
const handleRestartDeck = useCallback(async () => {
  await persistStudentTopicLink(activeStudentId, activeTopicId, { deckPosition: 0 });
  setDeckExhausted(false);
  const newState = buildGeneratedSessionState({
    topicRecord, mode, activeStudentId, activeTopicId,
    activeTextId, activeText, activeStudent,
    link: { ...link, deckPosition: 0 },
    selectedConceptIds, sessionParams,
  });
  if (newState) setSessionState(newState);
}, [activeStudentId, activeTopicId, topicRecord, mode, activeTextId, activeText, activeStudent, link, selectedConceptIds, sessionParams]);

const handleFinishDeck = useCallback(() => {
  setDeckExhausted(false);
  if (sessionState) finishSession({ ...sessionState, status: "completed" });
}, [sessionState]);
```

- [ ] **Step 8: Detect deck_exhausted in all callbacks where finishSession is called**

In `onAdvance`, `onCorrect`, `onQualityAnswer`, wherever `next.status === "completed"` triggers `finishSession`, also add:

```js
if (next.status === "deck_exhausted") { setDeckExhausted(true); return next; }
if (next.status === "completed") finishSession(next);
```

Apply this pattern to all the `setSessionState` callbacks. Specifically:
- `onCorrect` (line ~270-295): add the `deck_exhausted` check before the `completed` check
- `onIncorrect` (line ~297-318): add check in the auto-advance `setTimeout`
- `onAdvance` (line ~333-339)
- `onQualityAnswer` (line ~341-347)

- [ ] **Step 9: Save deckPosition on normal session finish**

In `finishSession`, before the `appendSession` call, add deckPosition save for deck modes:

```js
if (state.isDeckMode) {
  const reps = link.repsPerConcept ?? 1;
  const conceptsDone = Math.max(0, Math.floor((state.taskIndex) / reps));
  const currentDeckPos = link.deckPosition ?? 0;
  const totalSelected = (isReading
    ? []
    : selectedConceptIds).length;
  const newPos = totalSelected > 0
    ? (currentDeckPos + conceptsDone) % totalSelected
    : 0;
  await persistStudentTopicLink(activeStudentId, activeTopicId, { deckPosition: newPos });
}
```

- [ ] **Step 10: Update return value**

Add `rewardPending`, `clearRewardPending`, `deckExhausted`, `handleRestartDeck`, `handleFinishDeck` to the returned object:

```js
return {
  sessionState,
  currentTask,
  mode,
  topicRecord,
  sessionParams,
  completedRecord,
  rewardProgress,
  streakCount,
  rewardPending,
  clearRewardPending,
  deckExhausted,
  handleRestartDeck,
  handleFinishDeck,
  onCorrect,
  onIncorrect,
  onMistake,
  onAdvance,
  onQualityAnswer,
  onCardShown: cardLogger.onCardShown,
  onTap: cardLogger.onTap,
  onQuality: cardLogger.onQuality,
};
```

- [ ] **Step 11: Run tests to check nothing is broken**

```bash
npx vitest run
```

Expected: all existing tests pass (useSessionEngine has no unit tests so nothing to fail here).

- [ ] **Step 12: Commit**

```bash
git add src/features/session/useSessionEngine.js src/core/linkUtils.js
git commit -m "feat(session): reward pending, deck_exhausted handling, deckPosition save"
```

---

## Task 6: Update linkUtils.js — add deckPosition to sync payload

**Files:**
- Modify: `src/core/linkUtils.js`

- [ ] **Step 1: Add deckPosition to pushOp payload**

In `persistStudentTopicLink`, update the `pushOp` call to include `deckPosition`:

```js
pushOp("student_topic_link.upsert", {
  id: link.id ?? key,
  studentId,
  topicId,
  selectedConceptIds: link.selectedConceptIds ?? [],
  selectionMode:      link.selectionMode ?? "auto",
  repsPerConcept:     link.repsPerConcept ?? 1,
  params:             link.params ?? {},
  videoRewardEnabled: link.videoRewardEnabled ?? true,
  rewardThreshold:    link.rewardThreshold ?? 90,
  deckPosition:       link.deckPosition ?? 0,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/core/linkUtils.js
git commit -m "feat(sync): include deckPosition in student_topic_link upsert payload"
```

---

## Task 7: Update StarBar.jsx — new streak-based props

**Files:**
- Modify: `src/shared/components/StarBar.jsx`

- [ ] **Step 1: Rewrite StarBar to accept streakCount + available**

Replace the entire file:

```jsx
import { useRef, useEffect, useState } from "react";
import { computeStreakProgress } from "@/features/session/useStarProgress";

const STAR_COUNT = 5;

export default function StarBar({ className = "", streakCount = 0, available }) {
  const { litStars } = computeStreakProgress({ streakCount, available });

  const prevLitRef = useRef(litStars);
  const [animState, setAnimState] = useState({ gainIdx: null, loseIdx: null });

  useEffect(() => {
    const prev = prevLitRef.current;
    prevLitRef.current = litStars;
    if (litStars === prev) return;
    if (litStars > prev) {
      setAnimState({ gainIdx: litStars - 1, loseIdx: null });
      const t = setTimeout(() => setAnimState({ gainIdx: null, loseIdx: null }), 500);
      return () => clearTimeout(t);
    }
    setAnimState({ gainIdx: null, loseIdx: prev - 1 });
    const t = setTimeout(() => setAnimState({ gainIdx: null, loseIdx: null }), 500);
    return () => clearTimeout(t);
  }, [litStars]);

  if (!available) return null;

  const { gainIdx, loseIdx } = animState;

  return (
    <div className={`star-bar-zone ${className}`}>
      <div className="star-bar-stars">
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const isLit  = i < litStars;
          const isGain = i === gainIdx;
          const isLose = i === loseIdx;
          return (
            <span key={i} className="star-bar-star-wrap">
              <span
                className={[
                  "star-bar-star",
                  isLit  ? "star-bar-star--lit"  : "star-bar-star--dim",
                  isGain ? "star-bar-star--gain" : "",
                ].filter(Boolean).join(" ")}
              >★</span>
              {isLose && (
                <span className="star-bar-star star-bar-star--fly">★</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

Note: The YouTube icon is removed from StarBar — the reward is now shown via `<RewardVideoModal />`.

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/StarBar.jsx
git commit -m "feat(StarBar): accept streakCount prop, remove YT icon (reward via modal)"
```

---

## Task 8: Update SessionScreen.jsx

**Files:**
- Modify: `src/features/session/SessionScreen.jsx`

- [ ] **Step 1: Add new imports**

At the top of `SessionScreen.jsx`, add:

```jsx
import RewardVideoModal from "@/shared/components/RewardVideoModal";
```

- [ ] **Step 2: Extract new values from useSessionEngine**

Update the destructuring of `useSessionEngine()` (around line 71-76):

```js
const {
  sessionState, currentTask, mode, topicRecord, sessionParams,
  completedRecord, rewardProgress, streakCount,
  rewardPending, clearRewardPending,
  deckExhausted, handleRestartDeck, handleFinishDeck,
  onCorrect, onIncorrect, onMistake, onAdvance, onQualityAnswer,
  onCardShown, onTap, onQuality,
} = useSessionEngine();
```

- [ ] **Step 3: Update StarBar props**

Find the `<StarBar>` element (around line 191-198) and replace it:

```jsx
<StarBar
  className="session-progress"
  streakCount={streakCount}
  available={rewardProgress?.available ?? false}
/>
```

- [ ] **Step 4: Remove isInstantMode and update counter + streakCount prop**

Remove the line:
```js
const isInstantMode = mode?.evaluation === "instant";
```

Find the counter block (around line 200-207) and replace:

```jsx
{!isInstantMode && (
  <div className="session-counter">
    {taskIndex + 1} / {total}
    {mode.evaluation === "auto" && (
      <span className="session-score">  ✓{correctCount}  ✗{incorrectCount}</span>
    )}
  </div>
)}
```

with:

```jsx
{!sessionState?.isDeckMode && (
  <div className="session-counter">
    {taskIndex + 1} / {total}
    {mode.evaluation !== "none" && (
      <span className="session-score">  ✓{correctCount}  ✗{incorrectCount}</span>
    )}
  </div>
)}
```

Also find the `streakCount` prop passed to `Renderer` (around line 267):
```jsx
streakCount={isInstantMode ? streakCount : undefined}
```
Replace with:
```jsx
streakCount={streakCount}
```
(All modes now track streakCount — renderers that use it still get it.)

- [ ] **Step 5: Add RewardVideoModal rendering**

In the return JSX, add `<RewardVideoModal />` just before the closing `</div>` of the session screen (or after the main content area):

```jsx
{rewardPending && activeStudent && (
  <RewardVideoModal
    rewardVideos={activeStudent.rewardVideos ?? []}
    studentId={activeStudent.id}
    onDismiss={clearRewardPending}
  />
)}
```

- [ ] **Step 6: Add deck-exhausted dialog**

Add after the `rewardPending` block:

```jsx
{deckExhausted && (
  <div className="deck-exhausted-overlay">
    <div className="deck-exhausted-dialog">
      <div className="deck-exhausted-dialog__icon">🎉</div>
      <div className="deck-exhausted-dialog__title">Вы прошли все карточки!</div>
      <div className="deck-exhausted-dialog__actions">
        <button className="deck-exhausted-dialog__btn" onClick={handleRestartDeck}>
          Начать снова
        </button>
        <button className="deck-exhausted-dialog__btn deck-exhausted-dialog__btn--finish" onClick={handleFinishDeck}>
          Завершить
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add src/features/session/SessionScreen.jsx
git commit -m "feat(SessionScreen): show RewardVideoModal mid-session, deck-exhausted dialog"
```

---

## Task 9: Update SessionSummary.jsx — remove prize video

**Files:**
- Modify: `src/features/session/SessionSummary.jsx`

- [ ] **Step 1: Update imports**

Change the import from `useStarProgress`:
```js
import { computeDisplayStars } from "./useStarProgress";
```
Remove: `computeStarProgress` from imports. Remove: `computeRewardSeconds`, `formatRewardTime` from `format` imports (if no longer used).

Also remove import of `pickStoredRewardVideoId`.

- [ ] **Step 2: Remove reward-related state and effects**

Remove these state declarations:
```js
const [videoOpen,      setVideoOpen]      = useState(false);
const [rewardConsumed, setRewardConsumed] = useState(false);
const [rewardRemaining,setRewardRemaining]= useState(0);
const [rewardVideoUrl, setRewardVideoUrl] = useState(null);
```

Remove the `useEffect` for the countdown timer (lines 112-121).

Remove these computed values:
```js
const rewardVideos = ...
const sessionReward = ...
const videoRewardEnabled = ...
const rewardThreshold = ...
const rewardAvailable = ...
const rewardTotal = ...
const starProgress = ...
const rewardEarned = ...
const rewardSeconds = ...
```

- [ ] **Step 3: Simplify display stars computation**

Replace the `displayStars` / `starCount` computation with:

```js
const isEvaluated = session?.percentCorrect !== null && session?.percentCorrect !== undefined;
const rewardTotal = (session?.correctCount ?? 0) + (session?.incorrectCount ?? 0);
const starCount = isEvaluated && !isReading
  ? computeDisplayStars({
      correctCount:   session?.correctCount ?? 0,
      incorrectCount: session?.incorrectCount ?? 0,
      total:          rewardTotal,
    })
  : null;
const praiseText = getPraiseText(starCount, isReading);
```

- [ ] **Step 4: Remove reward-related JSX and handlers**

Remove:
- `handleOpenVideo` function
- `blockVideoRewardInteraction` function
- `showRewardButton` computed value
- `{showRewardButton && ( <button ...>🎬 Смотреть мультик</button> )}` JSX
- The entire video overlay block (`{videoOpen && ( <div className="video-reward-overlay">...</div> )}`)

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/session/SessionSummary.jsx
git commit -m "feat(SessionSummary): remove mid-session prize video, use computeDisplayStars"
```

---

## Task 10: Add CSS for new UI elements

**Files:**
- Modify: the main CSS file (find it via `grep -r "video-reward-overlay" src/ --include="*.css" -l`)

- [ ] **Step 1: Find the CSS file**

```bash
grep -r "video-reward-overlay" src/ --include="*.css" -l
```

- [ ] **Step 2: Add styles for reward modal (pre-video choice screen)**

Add after the existing `.video-reward-overlay` rules:

```css
.reward-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.reward-modal {
  background: #fff;
  border-radius: 20px;
  padding: 32px 24px;
  text-align: center;
  max-width: 340px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reward-modal__stars {
  font-size: 2rem;
  letter-spacing: 4px;
}

.reward-modal__title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1a1a1a;
}

.reward-modal__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reward-modal__btn {
  padding: 14px 24px;
  border-radius: 12px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.reward-modal__btn--watch {
  background: #FF0000;
  color: #fff;
}

.reward-modal__btn--continue {
  background: #f0f0f0;
  color: #333;
}
```

- [ ] **Step 3: Add styles for deck-exhausted dialog**

```css
.deck-exhausted-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.deck-exhausted-dialog {
  background: #fff;
  border-radius: 20px;
  padding: 32px 24px;
  text-align: center;
  max-width: 320px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.deck-exhausted-dialog__icon {
  font-size: 2.5rem;
}

.deck-exhausted-dialog__title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1a1a1a;
}

.deck-exhausted-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deck-exhausted-dialog__btn {
  padding: 14px 24px;
  border-radius: 12px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  background: #4CAF50;
  color: #fff;
}

.deck-exhausted-dialog__btn--finish {
  background: #f0f0f0;
  color: #333;
}
```

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -p
git commit -m "style: add RewardVideoModal and deck-exhausted dialog CSS"
```

---

## Task 11: Verify rewardProgress.js is no longer misused

**Files:**
- Read-only check: `src/features/session/rewardProgress.js`

- [ ] **Step 1: Check remaining usages of buildRewardProgress**

```bash
grep -r "buildRewardProgress\|computeStarProgress\|thresholdToStars" src/ --include="*.js" --include="*.jsx" -l
```

- [ ] **Step 2: Simplify rewardProgress in useSessionEngine**

In `useSessionEngine.js`, find the `rewardProgress` computation block (lines ~351-365):

```js
const rewardProgress = mode?.evaluation === "instant"
  ? { available: ..., earned: ..., ... }
  : buildRewardProgress({ sessionState, mode, ...rewardConfig });
```

Replace with:

```js
const rewardProgress = {
  available: Boolean(rewardConfig.hasRewardVideos && rewardConfig.videoRewardEnabled),
};
```

Remove the `import { buildRewardProgress } from "./rewardProgress";` line if `buildRewardProgress` is no longer referenced anywhere else in the file.

- [ ] **Step 3: Run full tests**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/session/useSessionEngine.js
git commit -m "refactor(session): simplify rewardProgress to available-only flag"
```

---

## Task 12: Final integration check + deploy

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Manual test checklist**

1. Start a flashcard session → verify StarBar shows 0 stars
2. Answer 3 correct → StarBar shows 3 stars
3. Answer 1 incorrect → StarBar resets to 0
4. Answer 5 correct in a row → `RewardVideoModal` appears with "Молодец! Пять правильных подряд!"
5. Click "Продолжать занятие" → session continues, stars reset to 0
6. Answer 5 correct again → modal appears again (multiple rewards per session ✓)
7. Run through all flashcards in a short deck → deck-exhausted dialog appears
8. Click "Начать снова" → session restarts from card 0
9. End session mid-deck → click "Завершить" → goes to Summary
10. Start new session → verify it starts from where you left off
11. Open a math/comparison procedural session → verify it doesn't end at 15 cards

- [ ] **Step 4: Deploy**

```bash
npm run deploy:prod
npm run deploy:verify
```
