# Star Progress & Video Reward — Design Spec

**Date:** 2026-05-18
**Status:** Approved

## Problem

Two bugs in the current video-reward system:

1. **Video button always appears after any completed session.** Root cause: `getCompletedTaskCount` returns `total` when `status === "completed"`, so `completed >= target` is always true regardless of how many answers were actually correct.
2. **Progress is invisible during the session.** The progress bar updates but does not communicate to the child whether they are on track to earn the video reward.

## Goals

- Fix the reward eligibility bug so the video button only appears when the child genuinely met the threshold.
- Replace the progress bar with an animated star bar that makes the reward goal tangible and motivating during the session.
- Keep the change isolated: existing session engine, sync, and DB record format are unchanged.

---

## Design

### 1. Bug fix — `rewardProgress.js`

In `getCompletedTaskCount`, when `status === "completed"`, return `correctCount` instead of `total`:

```js
if (sessionState.status === "completed") return sessionState.correctCount ?? total;
```

This makes `buildRewardProgress().earned` compare actual correct answers against the threshold target, not total tasks.

`SessionSummary` fallback (for sessions saved before this fix):

```js
const rewardEarned = sessionReward
  ? Boolean(sessionReward.earned)
  : (session?.correctCount ?? 0) / Math.max(1, session?.tasks?.length ?? 1) * 100 >= rewardThreshold;
```

### 2. New hook — `useStarProgress`

**File:** `src/features/session/useStarProgress.js`

Computes the real-time star state from session counters. Single source of truth for all star-related display logic.

```js
function thresholdToStars(threshold) {
  if (threshold <= 70) return 3;
  if (threshold <= 80) return 4;
  return 5; // ≥90
}

// `available` is pre-computed by buildRewardProgress (accounts for hasRewardVideos,
// videoRewardEnabled, and modeEvaluation !== "none" in one boolean)
export function useStarProgress({ correctCount, total, rewardThreshold, available }) {
  const thresholdStars = thresholdToStars(rewardThreshold ?? 90);
  const litStars = Math.min(5, Math.floor(correctCount / Math.max(1, total) * 5));
  const videoUnlocked = available && litStars >= thresholdStars;
  return { litStars, thresholdStars, videoUnlocked, available };
}
```

Threshold-to-stars mapping (matches existing ParamsScreen options):

| ParamsScreen | Stars needed | Child sees |
|---|---|---|
| ≥ 70% | 3 out of 5 | ★★★☆☆ |
| ≥ 80% | 4 out of 5 | ★★★★☆ |
| ≥ 90% | 5 out of 5 | ★★★★★ |

Star count formula: `litStars = floor(correctCount / total × 5)`. Works correctly for any card count; no integer-division edge cases.

Stars dim only when `litStars` drops (i.e. when `correctCount` crosses a 20%-band boundary), not on every wrong answer. This reduces stress for the child.

### 3. New component — `StarBar`

**File:** `src/shared/components/StarBar.jsx`

Replaces `<ProgressBar>` in `SessionScreen`. Receives `litStars`, `thresholdStars`, `videoUnlocked`, `available` from `useStarProgress`.

**Layout (Variant A — chosen):**

```
[⭐ 12] | [★★★★☆] [▶YT-icon]          flex:1, left-aligned
```

The component takes `flex: 1` via the existing `session-progress` CSS class so no layout changes are needed in the topbar.

When `available` is false (mode has no evaluation, or no videos added), the component renders nothing — the topbar remains unchanged for those modes.

**Animations:**

| Event | Animation |
|---|---|
| Star gained (litStars increases) | Newly lit star: spring bounce scale 1→1.65→1.3→1 (0.42s) |
| Star lost (litStars decreases) | Ghost star flies up and fades out translateY(−30px) opacity 0 (0.45s) |
| YouTube unlocks (videoUnlocked: false→true) | Icon scales 1→1.28→1 with red drop-shadow, then enters slow pulse (2s loop) |
| YouTube locks again (true→false) | Icon shakes horizontally (3 cycles, 0.35s), then dims |

State tracking: the component uses a ref to remember previous `litStars` so it knows whether to play a gain or lose animation.

**Numeric score counter (`⭐ 12`):**

- Increments on correct answer, decrements on wrong answer (floor of 0).
- Driven by `correctCount` from `sessionState` directly (same value used by `useStarProgress`).

### 4. `SessionScreen` changes

Replace `<ProgressBar>` with `<StarBar>`:

```jsx
// Remove:
import ProgressBar from "@/shared/components/ProgressBar";

// Add:
import StarBar from "@/shared/components/StarBar";
import { useStarProgress } from "@/features/session/useStarProgress";
```

In the render:

```jsx
// Remove:
<ProgressBar value={rewardProgress?.completed ?? taskIndex} max={total} className="session-progress" reward={rewardProgress} />

// Add:
<StarBar
  className="session-progress"
  correctCount={correctCount ?? 0}
  total={total}
  rewardThreshold={rewardProgress?.threshold}
  available={rewardProgress?.available ?? false}
/>
```

`useStarProgress` is called inside `StarBar` itself. `rewardProgress.available` is already the combined boolean from `buildRewardProgress` (checks videos, enabled flag, and evaluation mode). No changes to `useSessionEngine` or `buildRewardProgress`.

### 5. `SessionSummary` changes

- Apply the fallback fix described in Section 1.
- No visual changes to the summary screen. The existing 3-star rating (based on `percentCorrect`) stays as-is — it's a different concept (post-session performance grade vs. in-session reward tracker).

---

## Out of Scope

- ParamsScreen UI changes (threshold options stay as ≥70/80/90%).
- Summary screen star bar (the animated bar is session-only).
- Modes with `evaluation === "none"` (reading, follow_instruction) — StarBar renders nothing, behavior unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/session/rewardProgress.js` | One-line fix in `getCompletedTaskCount` |
| `src/features/session/useStarProgress.js` | **New** — star state hook |
| `src/shared/components/StarBar.jsx` | **New** — animated star bar component |
| `src/styles.css` | Add `.star-bar-*` CSS and animations |
| `src/features/session/SessionScreen.jsx` | Swap ProgressBar → StarBar |
| `src/features/session/SessionSummary.jsx` | Fix `rewardEarned` fallback |
