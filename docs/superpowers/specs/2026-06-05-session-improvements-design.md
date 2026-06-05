# Session Improvements Design
**Date:** 2026-06-05  
**Status:** Approved

## Overview

Three interconnected improvements to the session system:
1. Remove programmatic card limit — therapist controls session end
2. Resume deck from last position across sessions
3. Unified streak-based prize video logic for all modes

---

## Change 1: No Programmatic Card Limit

### Problem
- Procedural modes (comparison, math, etc.) are capped at `sessionSize = maxSize ?? 15`
- Deck-based modes auto-complete when `taskIndex >= tasks.length`
- In both cases the app decides when to end — therapist has no control

### Solution

**Deck-based modes** (`flashcards`, `function_cards`, `reading`, `sentence_puzzle`, `magnetic_alphabet`, `narrative`):  
When all cards are shown, instead of `status: "completed"`, transition to `status: "deck_exhausted"`.  
Show dialog: **"Вы прошли все карточки!"** with two buttons:
- **"Начать снова"** — resets `deckPosition = 0`, re-generates tasks from card 0, resumes session
- **"Завершить"** — ends session normally, goes to SessionSummary

**Procedural modes** (comparison, math_houses, addition_subtraction, etc.):  
Remove `sessionSize` cap. Pre-generate a large batch (500 tasks) at session start — enough that the therapist will never reach the end in a single session. Session ends only when therapist taps **"Завершить"** in the session UI.

### UI
A persistent **"Завершить занятие"** button is already present (or must be clearly accessible) in `SessionScreen` for all modes.

### Affected files
- `src/features/session/sessionEngine.js` — add `deck_exhausted` status, change `handleAdvance` for deck modes
- `src/features/session/useSessionEngine.js` — remove `sessionSize` cap in procedural branch; handle `deck_exhausted` status
- `src/features/session/SessionScreen.jsx` — render deck-exhausted dialog

---

## Change 2: Resume Deck from Last Position

### Problem
Each session starts the deck from the beginning (or shuffled). There is no memory of where the previous session ended.

### Solution

**No shuffle** for deck-based modes. Cards are presented in a fixed order (concept array order), starting from the saved position.

**New field in `studentTopicLinks`:** `deckPosition: number` (default `0`).  
Represents the concept index to start from on the next session.

**On session start:**  
Slice concept array starting at `deckPosition`. Tasks are generated from `concepts[deckPosition..]` (wrapping is handled by the deck-exhausted dialog, not silently).

**On session end (Завершить) mid-deck:**  
Save `deckPosition = lastShownConceptIndex + 1` to `studentTopicLinks`.

**On "Завершить" from deck-exhausted dialog (full deck completed):**  
Save `deckPosition = 0` — следующая сессия начнётся с начала.

**On "Начать снова" from deck-exhausted dialog:**  
`deckPosition = 0`, regenerate tasks.

**Sync:**  
`studentTopicLinks` is already persisted and synced to backend via `applyBootstrapToStore`. Adding `deckPosition` requires no new sync infrastructure — just include it in the link payload.  
Follow the `"field" in raw` guard pattern (per `feedback_apply_bootstrap_store` memory) so existing sessions are not overwritten when `deckPosition` is absent from older payloads.

### Affected files
- `src/core/store.js` — add `deckPosition` to link schema/defaults
- `src/core/linkUtils.js` — include `deckPosition` in persisted fields
- `src/features/session/useSessionEngine.js` — use `deckPosition` when slicing concepts; save on finish
- `src/features/params/ParamsScreen.jsx` — no change needed (deckPosition is internal)

---

## Change 3: Unified Streak-Based Prize Video

### Problem
Two separate evaluation paths exist:
- `evaluation: "auto"` — percentage-based star calculation (`computeStarProgress`)
- `evaluation: "instant"` — streak-based (5 correct in a row)

Prize video is shown only on `SessionSummary` (after session ends), which conflicts with the new continuous session model.

### Solution

**Unified streak logic for all modes with prize video:**
- `streakCount` increments on each correct answer
- `streakCount` resets to `0` on each incorrect answer
- `litStars = min(5, streakCount)` — StarBar reflects live streak
- When `streakCount === 5`: show `<RewardVideoModal />`, then reset `streakCount = 0`
- `videoUnlocked` flag is no longer session-level — video can be earned multiple times per session

**StarBar behavior:**
- Each star = 1 correct answer in a row
- Wrong answer → all stars go dark instantly
- Reaching 5 stars triggers the modal, then stars reset to 0

**`<RewardVideoModal />` — universal reusable component:**
- Props: `videoUrl: string`, `onWatch: () => void`, `onDismiss: () => void`, `title?: string`
- Completely decoupled from session/streak/mode logic
- Can be invoked from: session engine events, summary screen, manual triggers, future contexts
- Renders: celebration message, two buttons — **"Смотреть сейчас"** / **"Продолжать занятие"**
- On "Смотреть сейчас": plays video inline (or opens player), calls `onWatch`
- On "Продолжать": calls `onDismiss`, session resumes immediately

**Video can be earned repeatedly** within one session. Each time streak reaches 5 → modal appears.

**Remove `evaluation: "auto"` path** from `useSessionEngine.js` and `useStarProgress.js`.  
The `evaluation: "instant"` logic becomes the single path, renamed/unified.

**On SessionSummary:**  
No longer shows prize video button (video is consumed mid-session). Summary shows only standard stats.

### Affected files
- `src/features/session/useStarProgress.js` — rewrite to streak-only logic
- `src/features/session/useSessionEngine.js` — remove auto/instant split; emit streak event at 5
- `src/features/session/sessionEngine.js` — update streak state tracking
- `src/features/session/SessionScreen.jsx` — listen for streak event, show `<RewardVideoModal />`
- `src/shared/components/RewardVideoModal.jsx` — **new universal component**
- `src/shared/components/StarBar.jsx` — update to reflect streakCount directly
- `src/features/session/SessionSummary.jsx` — remove prize video button

---

## Data Flow Summary

```
Correct answer
  → streakCount++
  → StarBar updates (litStars = streakCount)
  → if streakCount === 5:
      → show <RewardVideoModal />
      → on watch/dismiss: streakCount = 0, StarBar resets

Wrong answer
  → streakCount = 0
  → StarBar resets to 0

Last card shown (deck mode)
  → status = "deck_exhausted"
  → show deck-exhausted dialog
  → "Начать снова": deckPosition = 0, regenerate
  → "Завершить": save deckPosition, go to SessionSummary

"Завершить" pressed (any mode)
  → save deckPosition (deck modes only)
  → go to SessionSummary (no prize video button)
```

---

## Out of Scope
- Changing which modes support prize video (existing `videoRewardEnabled` flag unchanged)
- Changing how reward videos are stored per student
- Changing SessionSummary stats display
- Any changes to procedural card generation logic beyond removing the 15-card cap
