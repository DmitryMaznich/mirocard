# Star Progress & Video Reward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken progress bar + always-on video button with an animated 5-star reward tracker that accurately reflects whether the child earned the bonus video.

**Architecture:** Fix a one-line bug in `getCompletedTaskCount` (session completion returns `correctCount` not `total`), add a pure hook `useStarProgress` that derives star state from session counters, create an animated `StarBar` component that replaces `<ProgressBar>` in `SessionScreen`, and patch the `SessionSummary` fallback. No changes to the session engine, sync, or DB record format.

**Tech Stack:** React 18, Vitest (already configured), CSS animations — no new dependencies.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/features/session/rewardProgress.js` | Modify line 19 | Return `correctCount` when session completed |
| `src/features/session/rewardProgress.test.js` | Modify | Add tests for bug fix |
| `src/features/session/useStarProgress.js` | **Create** | Pure computation: litStars, thresholdStars, videoUnlocked |
| `src/features/session/useStarProgress.test.js` | **Create** | Unit tests for the hook |
| `src/shared/components/StarBar.jsx` | **Create** | Animated star bar + YouTube icon |
| `src/styles.css` | Modify | Add `.star-bar-*` CSS + keyframe animations |
| `src/features/session/SessionScreen.jsx` | Modify | Swap `<ProgressBar>` → `<StarBar>` |
| `src/features/session/SessionSummary.jsx` | Modify lines 69-71 | Fix `rewardEarned` fallback |

---

### Task 1: Fix the video reward eligibility bug

**Files:**
- Modify: `src/features/session/rewardProgress.js:19`
- Modify: `src/features/session/rewardProgress.test.js`

- [ ] **Step 1: Add two failing tests**

In `src/features/session/rewardProgress.test.js`, add inside the `describe("reward progress")` block (after the existing tests):

```js
it("uses correctCount (not total) when session is completed and child failed threshold", () => {
  const progress = buildRewardProgress({
    sessionState: {
      status: "completed",
      tasks: TASKS,
      taskIndex: 9,
      correctCount: 6,
    },
    mode: MODE,
    videoRewardEnabled: true,
    hasRewardVideos: true,
    rewardThreshold: 80,
  });
  expect(progress.completed).toBe(6);
  expect(progress.target).toBe(8);
  expect(progress.earned).toBe(false);
});

it("marks reward earned when correctCount meets threshold on completion", () => {
  const progress = buildRewardProgress({
    sessionState: {
      status: "completed",
      tasks: TASKS,
      taskIndex: 9,
      correctCount: 9,
    },
    mode: MODE,
    videoRewardEnabled: true,
    hasRewardVideos: true,
    rewardThreshold: 80,
  });
  expect(progress.completed).toBe(9);
  expect(progress.earned).toBe(true);
});
```

- [ ] **Step 2: Run and confirm the two new tests fail**

```bash
npx vitest run src/features/session/rewardProgress.test.js
```

Expected: 2 new tests FAIL (completed returns 10 instead of correctCount), existing 5 tests PASS.

- [ ] **Step 3: Fix `getCompletedTaskCount` in `rewardProgress.js`**

Line 19 — change from:
```js
if (sessionState.status === "completed") return total;
```
to:
```js
if (sessionState.status === "completed") return sessionState.correctCount ?? total;
```

The `?? total` fallback preserves behaviour for sessions saved before this fix (no `correctCount` field).

- [ ] **Step 4: Run all tests, confirm all pass**

```bash
npx vitest run src/features/session/rewardProgress.test.js
```

Expected: 7 tests PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/features/session/rewardProgress.js src/features/session/rewardProgress.test.js
git commit -m "fix(reward): use correctCount instead of total when session completes"
```

---

### Task 2: Create `useStarProgress` hook

**Files:**
- Create: `src/features/session/useStarProgress.js`
- Create: `src/features/session/useStarProgress.test.js`

- [ ] **Step 1: Create test file**

Create `src/features/session/useStarProgress.test.js`:

```js
import { describe, expect, it } from "vitest";
import { computeStarProgress, thresholdToStars } from "./useStarProgress";

describe("thresholdToStars", () => {
  it("maps <=70 to 3 stars", () => {
    expect(thresholdToStars(70)).toBe(3);
    expect(thresholdToStars(50)).toBe(3);
  });
  it("maps 71-80 to 4 stars", () => {
    expect(thresholdToStars(80)).toBe(4);
    expect(thresholdToStars(75)).toBe(4);
  });
  it("maps >80 to 5 stars", () => {
    expect(thresholdToStars(90)).toBe(5);
    expect(thresholdToStars(95)).toBe(5);
  });
});

describe("computeStarProgress", () => {
  it("returns 0 lit stars at session start", () => {
    const r = computeStarProgress({ correctCount: 0, total: 10, rewardThreshold: 80, available: true });
    expect(r.litStars).toBe(0);
    expect(r.videoUnlocked).toBe(false);
  });

  it("lights stars proportionally to correct answers", () => {
    // 4/10 = 40% → floor(0.4 * 5) = 2
    expect(computeStarProgress({ correctCount: 4, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(2);
    // 8/10 = 80% → floor(0.8 * 5) = 4
    expect(computeStarProgress({ correctCount: 8, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(4);
    // 10/10 = 100% → min(5, 5) = 5
    expect(computeStarProgress({ correctCount: 10, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(5);
  });

  it("unlocks video when litStars >= thresholdStars", () => {
    // threshold 80 → need 4 stars; 8/10 correct = 4 stars
    const r = computeStarProgress({ correctCount: 8, total: 10, rewardThreshold: 80, available: true });
    expect(r.thresholdStars).toBe(4);
    expect(r.videoUnlocked).toBe(true);
  });

  it("does not unlock when litStars is one below threshold", () => {
    // 7/10 = 3 stars lit, threshold 80 needs 4
    const r = computeStarProgress({ correctCount: 7, total: 10, rewardThreshold: 80, available: true });
    expect(r.litStars).toBe(3);
    expect(r.videoUnlocked).toBe(false);
  });

  it("does not unlock when available is false", () => {
    const r = computeStarProgress({ correctCount: 10, total: 10, rewardThreshold: 80, available: false });
    expect(r.videoUnlocked).toBe(false);
  });

  it("handles small card counts without division errors", () => {
    // 2/3 = 66.7% → floor(0.667 * 5) = 3 stars
    expect(computeStarProgress({ correctCount: 2, total: 3, rewardThreshold: 70, available: true }).litStars).toBe(3);
  });

  it("does not exceed 5 stars", () => {
    expect(computeStarProgress({ correctCount: 100, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(5);
  });
});
```

- [ ] **Step 2: Run and confirm tests fail**

```bash
npx vitest run src/features/session/useStarProgress.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `useStarProgress.js`**

Create `src/features/session/useStarProgress.js`:

```js
export function thresholdToStars(threshold) {
  if (threshold <= 70) return 3;
  if (threshold <= 80) return 4;
  return 5;
}

// Pure function — exported separately so tests don't need React's hook rules
export function computeStarProgress({ correctCount, total, rewardThreshold, available }) {
  const thresholdStars = thresholdToStars(rewardThreshold ?? 90);
  const litStars = Math.min(5, Math.floor(correctCount / Math.max(1, total) * 5));
  const videoUnlocked = available && litStars >= thresholdStars;
  return { litStars, thresholdStars, videoUnlocked, available };
}

export function useStarProgress(props) {
  return computeStarProgress(props);
}
```

- [ ] **Step 4: Run tests, confirm all pass**

```bash
npx vitest run src/features/session/useStarProgress.test.js
```

Expected: 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/session/useStarProgress.js src/features/session/useStarProgress.test.js
git commit -m "feat(session): add useStarProgress hook for real-time star reward tracking"
```

---

### Task 3: Add StarBar CSS to `styles.css`

**Files:**
- Modify: `src/styles.css` (insert after `.session-progress { flex: 1; }` line, around line 12156)

- [ ] **Step 1: Insert CSS block**

Find the line `.session-progress { flex: 1; }` in `src/styles.css` and add the following block immediately after it:

```css
/* ── StarBar ─────────────────────────────────────── */
.star-bar-zone {
  display: flex;
  align-items: center;
  gap: 6px;
}
.star-bar-score {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.9rem;
  font-weight: 800;
  color: #1a1a2e;
  white-space: nowrap;
}
.star-bar-score__icon { font-size: 0.95rem; }
.star-bar-divider {
  width: 1px;
  height: 20px;
  background: #e5e7eb;
  flex-shrink: 0;
}
.star-bar-stars {
  display: flex;
  gap: 2px;
  align-items: center;
}
.star-bar-star-wrap {
  position: relative;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.star-bar-star {
  font-size: 20px;
  line-height: 1;
  position: absolute;
  user-select: none;
}
.star-bar-star--lit {
  filter: drop-shadow(0 0 3px rgba(251, 191, 36, 0.7));
}
.star-bar-star--dim {
  filter: grayscale(1);
  opacity: 0.2;
}
@keyframes starBarBounce {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.65) rotate(-8deg); }
  65%  { transform: scale(1.3) rotate(4deg); }
  100% { transform: scale(1) rotate(0deg); }
}
.star-bar-star--gain {
  animation: starBarBounce 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
@keyframes starBarFly {
  0%   { opacity: 1; transform: scale(1) translateY(0); }
  100% { opacity: 0; transform: scale(0.4) translateY(-28px); }
}
.star-bar-star--fly {
  animation: starBarFly 0.45s ease-out forwards;
  pointer-events: none;
}
.star-bar-yt {
  width: 38px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.3s, filter 0.3s;
}
.star-bar-yt svg { width: 34px; height: 24px; }
.star-bar-yt--locked { opacity: 0.15; filter: grayscale(1); }
.star-bar-yt--unlocked { opacity: 1; filter: none; }
@keyframes starBarYtUnlock {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.28); filter: drop-shadow(0 0 8px rgba(255, 60, 60, 0.7)); }
  100% { transform: scale(1); }
}
.star-bar-yt--anim-unlock {
  animation: starBarYtUnlock 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
@keyframes starBarYtLock {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-4px); }
  40%      { transform: translateX(4px); }
  60%      { transform: translateX(-3px); }
  80%      { transform: translateX(2px); }
}
.star-bar-yt--anim-lock { animation: starBarYtLock 0.35s ease both; }
@keyframes starBarYtPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.07); filter: drop-shadow(0 0 4px rgba(255, 40, 40, 0.4)); }
}
.star-bar-yt--pulse { animation: starBarYtPulse 2s ease-in-out infinite; }
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "style: add StarBar CSS animations and layout classes"
```

---

### Task 4: Create `StarBar` component

**Files:**
- Create: `src/shared/components/StarBar.jsx`

- [ ] **Step 1: Create the component**

Create `src/shared/components/StarBar.jsx`:

```jsx
import { useRef, useEffect, useState } from "react";
import { useStarProgress } from "@/features/session/useStarProgress";

const STAR_COUNT = 5;

export default function StarBar({ className = "", correctCount, total, rewardThreshold, available }) {
  const { litStars, videoUnlocked } = useStarProgress({ correctCount, total, rewardThreshold, available });

  const prevLitRef      = useRef(litStars);
  const prevUnlockedRef = useRef(videoUnlocked);
  const [animState, setAnimState] = useState({ gainIdx: null, loseIdx: null });
  const [ytAnim, setYtAnim]       = useState(null);

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

  useEffect(() => {
    const prev = prevUnlockedRef.current;
    prevUnlockedRef.current = videoUnlocked;
    if (videoUnlocked === prev) return;
    setYtAnim(videoUnlocked ? "unlock" : "lock");
    const t = setTimeout(() => setYtAnim(null), 700);
    return () => clearTimeout(t);
  }, [videoUnlocked]);

  if (!available) return null;

  const { gainIdx, loseIdx } = animState;

  return (
    <div className={`star-bar-zone ${className}`}>
      <div className="star-bar-score">
        <span className="star-bar-score__icon">⭐</span>
        <span className="star-bar-score__num">{correctCount}</span>
      </div>
      <div className="star-bar-divider" />
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
      <div
        className={[
          "star-bar-yt",
          videoUnlocked ? "star-bar-yt--unlocked" : "star-bar-yt--locked",
          ytAnim ? `star-bar-yt--anim-${ytAnim}` : "",
          videoUnlocked && !ytAnim ? "star-bar-yt--pulse" : "",
        ].filter(Boolean).join(" ")}
      >
        <svg viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="YouTube">
          <rect width="34" height="24" rx="6" fill="#FF0000" />
          <polygon points="13,6 25,12 13,18" fill="white" />
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/StarBar.jsx
git commit -m "feat(ui): add animated StarBar component with YouTube unlock indicator"
```

---

### Task 5: Wire StarBar into `SessionScreen`

**Files:**
- Modify: `src/features/session/SessionScreen.jsx`

- [ ] **Step 1: Swap the import**

At the top of `SessionScreen.jsx`, replace:
```js
import ProgressBar from "@/shared/components/ProgressBar";
```
with:
```js
import StarBar from "@/shared/components/StarBar";
```

- [ ] **Step 2: Replace the JSX (around line 148)**

Remove:
```jsx
<ProgressBar
  value={rewardProgress?.completed ?? taskIndex}
  max={total}
  className="session-progress"
  reward={rewardProgress}
/>
```

Add:
```jsx
<StarBar
  className="session-progress"
  correctCount={correctCount ?? 0}
  total={total}
  rewardThreshold={rewardProgress?.threshold}
  available={rewardProgress?.available ?? false}
/>
```

- [ ] **Step 3: Start dev server and manually verify**

```bash
npm run dev
```

Open a session with a topic that has reward videos and threshold ≠ "Нет" — check:
- Header shows `⭐ 0` + 5 dim stars + dim YouTube icon
- Correct answer → target star bounces to lit, count increments
- Wrong answer → ghost star flies up, star dims, count decrements
- When threshold stars lit → YouTube icon flashes then pulses
- Drop below threshold again → YouTube shakes and dims

Open a reading / follow_instruction mode session → StarBar renders nothing, layout unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/features/session/SessionScreen.jsx
git commit -m "feat(session): replace progress bar with animated StarBar"
```

---

### Task 6: Fix `SessionSummary` reward eligibility fallback

**Files:**
- Modify: `src/features/session/SessionSummary.jsx:69-71`

- [ ] **Step 1: Fix the fallback**

Find lines 69–71 in `SessionSummary.jsx`:
```js
const rewardEarned = sessionReward
  ? Boolean(sessionReward.earned)
  : (session?.percentCorrect ?? -1) >= rewardThreshold;
```

Replace with:
```js
const rewardEarned = sessionReward
  ? Boolean(sessionReward.earned)
  : (session?.correctCount ?? 0) / Math.max(1, session?.tasks?.length ?? 1) * 100 >= rewardThreshold;
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (no regressions).

- [ ] **Step 3: Manually verify summary**

Complete a session deliberately below threshold (answer mostly wrong, threshold 90%): summary must NOT show "🎬 Смотреть мультик".

Complete a session above threshold: summary MUST show the button.

- [ ] **Step 4: Commit**

```bash
git add src/features/session/SessionSummary.jsx
git commit -m "fix(summary): use correctCount for reward eligibility, not percentCorrect fallback"
```
