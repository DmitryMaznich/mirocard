# iOS Swipe-Back Real Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make iOS's edge-swipe-back gesture perform a real screen navigation (like tapping the in-app back button) instead of showing a stale white snapshot and snapping back to the same screen, without touching the existing, already-hardened Android back-button mechanism.

**Architecture:** Add a small platform-detection module (`iosBackNavigation.js`) with pure history-manipulation helpers. Branch `useBackButtonGuard.js`'s mount effect and `popstate` handler on `isIOS()`: Android keeps the existing single-guard-entry rebound mechanism untouched; iOS gets a real per-screen-transition history stack (push on every forward screen change, apply on `popstate`), with the `session`-screen and timer-open cases still intercepted exactly as they are today.

**Tech Stack:** React 19, Zustand store (`useAppStore`), Vitest for tests (`npx vitest run <path>`).

## Global Constraints

- Do not modify Android-path behavior or its existing tests in `src/shared/hooks/useBackButtonGuard.test.jsx` — those must keep passing unmodified as proof the Android branch wasn't touched.
- iOS detection pattern (already used in `src/main.jsx:22` and `src/features/student/StudentLandingPage.jsx`): `/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)`.
- No native shell (Capacitor/WKWebView) work — PWA-only, per the approved spec `docs/superpowers/specs/2026-07-10-ios-swipe-back-navigation-design.md`.
- Run tests with `npx vitest run <path>` (no `test` npm script exists in this repo).
- Commit after every task (working tree in this repo is shared with other concurrent sessions that occasionally `git reset --hard` — uncommitted work can be lost; see project memory `feedback-concurrent-reset-risk`).
- Deploying to production (`npm run deploy:prod`) requires explicit user confirmation before running — do not run it unprompted, even at the end of this plan.

---

### Task 1: `iosBackNavigation.js` pure history-stack module

**Files:**
- Create: `src/shared/navigation/iosBackNavigation.js`
- Test: `src/shared/navigation/iosBackNavigation.test.js`

**Interfaces:**
- Produces (consumed by Task 2):
  - `isIOS(): boolean`
  - `installIosRoot(screen: string): void` — tags the current history entry as the iOS nav root and resets the internal sequence counter to 0.
  - `pushIosScreen(screen: string): void` — pushes a new tagged, uniquely-URLed history entry for `screen`.
  - `getIosNavState(event: PopStateEvent): { mirocardIosNav: true, screen: string, seq: number } | null` — returns the tagged state from a `popstate` event, or `null` if the entry isn't one of ours.

- [ ] **Step 1: Write the failing tests**

Create `src/shared/navigation/iosBackNavigation.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isIOS, installIosRoot, pushIosScreen, getIosNavState } from "./iosBackNavigation";

function mockUserAgent(ua, platform = "iPhone", maxTouchPoints = 5) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua);
  vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
  vi.spyOn(window.navigator, "maxTouchPoints", "get").mockReturnValue(maxTouchPoints);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isIOS", () => {
  it("returns true for an iPhone user agent", () => {
    mockUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(isIOS()).toBe(true);
  });

  it("returns true for an iPad user agent", () => {
    mockUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)");
    expect(isIOS()).toBe(true);
  });

  it("returns true for iPadOS spoofing as a touch Mac", () => {
    mockUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5);
    expect(isIOS()).toBe(true);
  });

  it("returns false for a generic desktop user agent", () => {
    mockUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 0);
    expect(isIOS()).toBe(false);
  });

  it("returns false for Android", () => {
    mockUserAgent("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l", 5);
    expect(isIOS()).toBe(false);
  });
});

describe("installIosRoot", () => {
  it("replaces the current history entry with a tagged root state at seq 0", () => {
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    installIosRoot("home");

    expect(replaceSpy).toHaveBeenCalledWith(
      { mirocardIosNav: true, screen: "home", seq: 0 },
      "",
      window.location.href.replace(/#.*$/, ""),
    );
  });

  it("resets the sequence counter so the next push starts at 1", () => {
    installIosRoot("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    pushIosScreen("students");

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ seq: 1 }),
      "",
      expect.any(String),
    );
  });
});

describe("pushIosScreen", () => {
  it("pushes a tagged state with an incrementing sequence and a unique URL each time", () => {
    installIosRoot("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    pushIosScreen("students");
    const firstUrl = pushSpy.mock.calls[0][2];
    expect(pushSpy.mock.calls[0][0]).toEqual({ mirocardIosNav: true, screen: "students", seq: 1 });

    pushIosScreen("student_edit");
    const secondUrl = pushSpy.mock.calls[1][2];
    expect(pushSpy.mock.calls[1][0]).toEqual({ mirocardIosNav: true, screen: "student_edit", seq: 2 });

    expect(secondUrl).not.toBe(firstUrl);
  });
});

describe("getIosNavState", () => {
  it("returns the state when it is tagged", () => {
    const event = { state: { mirocardIosNav: true, screen: "home", seq: 3 } };
    expect(getIosNavState(event)).toEqual({ mirocardIosNav: true, screen: "home", seq: 3 });
  });

  it("returns null when state is missing", () => {
    expect(getIosNavState({ state: null })).toBeNull();
  });

  it("returns null when state is not tagged (foreign entry, e.g. below our root)", () => {
    expect(getIosNavState({ state: { someOtherApp: true } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/navigation/iosBackNavigation.test.js`
Expected: FAIL — `Cannot find module './iosBackNavigation'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/shared/navigation/iosBackNavigation.js`:

```js
// iOS Safari recognizes the left-edge swipe-back gesture even when
// touch-action/overscroll-behavior try to suppress it. Rather than fight the
// gesture, this module gives it a real history stack to traverse: one tagged
// entry per screen transition, so a completed swipe lands on an actual
// destination instead of rebounding off a stale boot-screen snapshot.

let iosSequence = 0;

export function isIOS() {
  const ua = navigator.userAgent || "";
  const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || isTouchMac;
}

function iosBaseUrl() {
  return window.location.href.replace(/#.*$/, "");
}

export function installIosRoot(screen) {
  iosSequence = 0;
  window.history.replaceState(
    { mirocardIosNav: true, screen, seq: iosSequence },
    "",
    iosBaseUrl(),
  );
}

export function pushIosScreen(screen) {
  iosSequence += 1;
  window.history.pushState(
    { mirocardIosNav: true, screen, seq: iosSequence },
    "",
    `${iosBaseUrl()}#s${iosSequence}`,
  );
}

export function getIosNavState(event) {
  return event.state?.mirocardIosNav ? event.state : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/navigation/iosBackNavigation.test.js`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/shared/navigation/iosBackNavigation.js src/shared/navigation/iosBackNavigation.test.js
git commit -m "$(cat <<'EOF'
feat(navigation): add iOS history-stack helper module

Pure functions for a real per-screen-transition history stack, used to
give iOS's edge-swipe-back gesture an actual destination instead of the
stale boot-screen snapshot the current single-guard-entry model shows.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire the iOS branch into `useBackButtonGuard`

**Files:**
- Modify: `src/shared/hooks/useBackButtonGuard.js`
- Modify: `src/App.jsx:148-154` (pass `screen` into the hook call)
- Modify: `src/shared/hooks/useBackButtonGuard.test.jsx` (add iOS test block; existing Android tests must keep passing unmodified)

**Interfaces:**
- Consumes from Task 1: `isIOS()`, `installIosRoot(screen)`, `pushIosScreen(screen)`, `getIosNavState(event)` from `@/shared/navigation/iosBackNavigation`.
- Consumes: `useAppStore.getState().setScreen(screen: string): void` (existing store action, unchanged).
- Produces: `useBackButtonGuard` now accepts an additional required prop `screen: string` alongside the existing `isTimerOpen`, `onCloseTimer`, `isSessionExitPromptOpen`, `onCloseSessionExitPrompt`, `onRequestSessionExit`.

- [ ] **Step 1: Write the failing iOS tests**

Add this block to the end of `src/shared/hooks/useBackButtonGuard.test.jsx` (inside the existing `describe("useBackButtonGuard", ...)`, after the last existing `it(...)`, before the closing `});`). First, update `GuardHost` at the top of the file to forward `screen`:

```js
function GuardHost(props) {
  useBackButtonGuard({
    screen: "home",
    isTimerOpen: false,
    onCloseTimer: undefined,
    isSessionExitPromptOpen: false,
    onCloseSessionExitPrompt: undefined,
    onRequestSessionExit: undefined,
    ...props,
  });
  return null;
}
```

Then add a new describe block in the same file (after the existing `describe("useBackButtonGuard", ...)` block closes):

```js
describe("useBackButtonGuard on iOS", () => {
  function mockIos() {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
  }

  function dispatchPopState(state) {
    time += 250;
    vi.setSystemTime(time);
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  }

  it("pushes a real history entry for each forward screen change", () => {
    mockIos();
    resetStore("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      root.render(<GuardHost screen="home" />);
    });
    pushSpy.mockClear();

    act(() => {
      root.render(<GuardHost screen="students" />);
    });

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mirocardIosNav: true, screen: "students" }),
      "",
      expect.any(String),
    );
  });

  it("restores the previous screen on a completed swipe-back", () => {
    mockIos();
    resetStore("home");

    act(() => {
      root.render(<GuardHost screen="home" />);
    });
    act(() => {
      root.render(<GuardHost screen="students" />);
    });

    act(() => {
      dispatchPopState({ mirocardIosNav: true, screen: "home", seq: 0 });
    });

    expect(useAppStore.getState().screen).toBe("home");
  });

  it("does nothing extra when swiping past the app's root", () => {
    mockIos();
    resetStore("home");

    act(() => {
      root.render(<GuardHost screen="home" />);
    });
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      dispatchPopState(null);
    });

    expect(pushSpy).not.toHaveBeenCalled();
    expect(useAppStore.getState().screen).toBe("home");
  });

  it("intercepts swipe-back during an active session with a confirmation prompt", () => {
    mockIos();
    resetStore("session");
    const onRequestSessionExit = vi.fn();
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      root.render(<GuardHost screen="session" onRequestSessionExit={onRequestSessionExit} />);
    });
    pushSpy.mockClear();

    act(() => {
      dispatchPopState(null);
    });

    expect(useAppStore.getState().screen).toBe("session");
    expect(onRequestSessionExit).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mirocardIosNav: true, screen: "session" }),
      "",
      expect.any(String),
    );
  });

  it("closes an already-open session exit prompt on a second swipe-back", () => {
    mockIos();
    resetStore("session");
    const onCloseSessionExitPrompt = vi.fn();

    act(() => {
      root.render(
        <GuardHost
          screen="session"
          isSessionExitPromptOpen
          onCloseSessionExitPrompt={onCloseSessionExitPrompt}
        />,
      );
    });

    act(() => {
      dispatchPopState(null);
    });

    expect(onCloseSessionExitPrompt).toHaveBeenCalledTimes(1);
  });

  it("closes the timer before navigating, without changing screen", () => {
    mockIos();
    resetStore("students");
    const onCloseTimer = vi.fn();

    act(() => {
      root.render(<GuardHost screen="students" isTimerOpen onCloseTimer={onCloseTimer} />);
    });

    act(() => {
      dispatchPopState({ mirocardIosNav: true, screen: "home", seq: 0 });
    });

    expect(onCloseTimer).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().screen).toBe("students");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/hooks/useBackButtonGuard.test.jsx`
Expected: FAIL — the new iOS tests fail (e.g. `pushSpy` never called with `mirocardIosNav`, `screen` stays `"home"` instead of restoring), because `useBackButtonGuard` doesn't yet accept `screen` or branch on `isIOS()`. The pre-existing Android tests in the file should still PASS at this point (only the new block fails) — confirm this before moving on, since it proves the test additions didn't break anything by themselves.

- [ ] **Step 3: Implement the iOS branch in `useBackButtonGuard.js`**

Replace the full contents of `src/shared/hooks/useBackButtonGuard.js` with:

```js
import { useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getBackTarget, SESSION_EXIT_TARGET } from "@/shared/navigation/backNavigation";
import { isIOS, installIosRoot, pushIosScreen, getIosNavState } from "@/shared/navigation/iosBackNavigation";

// One entry is enough. With DEPTH=1 the rebound always goes root→#_guard
// (different URLs), so Chrome Android never silently ignores the pushState.
// DEPTH≥2 causes same-URL rebounds (#_guard→#_guard) which Chrome may drop.
const GUARD_HASH = "#_guard";

let guardSequence = 0;
let guardTopSequence = 0;
let lastObservedSequence = 0;
let lastHandledBackAt = 0;
let lastHandledIosSpecialAt = 0;

function guardUrl() {
  return window.location.href.replace(/#.*$/, "") + GUARD_HASH;
}

function getGuardSequence(state) {
  return state?.mirocardBackGuard && Number.isFinite(state.guardSequence)
    ? state.guardSequence
    : 0;
}

function rootStateFrom(state) {
  const nextState = { ...(state ?? {}) };
  delete nextState.mirocardBackGuard;
  nextState.mirocardBackRoot = true;
  nextState.guardSequence = 0;
  return nextState;
}

function installBackGuardStack() {
  const currentState = window.history.state;
  const rootUrl = window.location.href.replace(/#.*$/, "");
  const currentSequence = getGuardSequence(currentState);

  // Always normalize the current entry to the app root, then put a fresh guard
  // on top. If the app reloads while the URL is already #_guard, relying on the
  // existing entry leaves no guaranteed in-app entry behind Android's Back.
  window.history.replaceState(rootStateFrom(currentState), "", rootUrl);

  guardSequence = Math.max(guardSequence, currentSequence) + 1;
  window.history.pushState(
    { mirocardBackGuard: true, guardSequence },
    "",
    guardUrl(),
  );
  guardTopSequence = guardSequence;
  lastObservedSequence = guardTopSequence;
}

function reboundToGuardTop(sequence) {
  if (sequence >= guardTopSequence) return;
  guardSequence += 1;
  guardTopSequence = guardSequence;
  lastObservedSequence = guardTopSequence;
  // guardUrl() is computed fresh from window.location.href (current entry after
  // the back press) → always baseUrl + #_guard, never same as the guard entry
  // we just left, so Chrome will not drop this pushState.
  window.history.pushState(
    { mirocardBackGuard: true, guardSequence },
    "",
    guardUrl(),
  );
}

export function useBackButtonGuard({
  screen,
  isTimerOpen,
  onCloseTimer,
  isSessionExitPromptOpen,
  onCloseSessionExitPrompt,
  onRequestSessionExit,
}) {
  const screenRef = useRef(screen);
  const isTimerOpenRef = useRef(isTimerOpen);
  const onCloseTimerRef = useRef(onCloseTimer);
  const isSessionExitPromptOpenRef = useRef(isSessionExitPromptOpen);
  const onCloseSessionExitPromptRef = useRef(onCloseSessionExitPrompt);
  const onRequestSessionExitRef = useRef(onRequestSessionExit);
  const isFirstIosRenderRef = useRef(true);
  const isRestoringFromHistoryRef = useRef(false);

  useEffect(() => {
    screenRef.current = screen;
    isTimerOpenRef.current = isTimerOpen;
    onCloseTimerRef.current = onCloseTimer;
    isSessionExitPromptOpenRef.current = isSessionExitPromptOpen;
    onCloseSessionExitPromptRef.current = onCloseSessionExitPrompt;
    onRequestSessionExitRef.current = onRequestSessionExit;
  }, [
    screen,
    isTimerOpen,
    onCloseTimer,
    isSessionExitPromptOpen,
    onCloseSessionExitPrompt,
    onRequestSessionExit,
  ]);

  // iOS only: push a real history entry for every forward screen change, so a
  // completed edge-swipe-back has an actual destination to land on instead of
  // rebounding off a stale boot-screen snapshot (see design doc for root cause).
  useEffect(() => {
    if (!isIOS() || !window.history?.pushState) return undefined;

    if (isFirstIosRenderRef.current) {
      isFirstIosRenderRef.current = false;
      installIosRoot(screen);
      return undefined;
    }

    if (isRestoringFromHistoryRef.current) {
      isRestoringFromHistoryRef.current = false;
      return undefined;
    }

    pushIosScreen(screen);
    return undefined;
  }, [screen]);

  useEffect(() => {
    if (!window.history?.pushState) return undefined;

    if (isIOS()) {
      function handleIosPopState(event) {
        if (isTimerOpenRef.current) {
          const now = Date.now();
          if (now - lastHandledIosSpecialAt < 180) return;
          lastHandledIosSpecialAt = now;
          pushIosScreen(screenRef.current);
          onCloseTimerRef.current?.();
          return;
        }

        if (screenRef.current === "session") {
          const now = Date.now();
          if (now - lastHandledIosSpecialAt < 180) return;
          lastHandledIosSpecialAt = now;
          pushIosScreen(screenRef.current);
          if (isSessionExitPromptOpenRef.current) {
            onCloseSessionExitPromptRef.current?.();
          } else {
            onRequestSessionExitRef.current?.();
          }
          return;
        }

        const state = getIosNavState(event);
        if (!state) return;

        isRestoringFromHistoryRef.current = true;
        useAppStore.getState().setScreen(state.screen);
      }

      window.addEventListener("popstate", handleIosPopState);
      return () => window.removeEventListener("popstate", handleIosPopState);
    }

    installBackGuardStack();

    function handlePopState(event) {
      const sequence = getGuardSequence(event.state);
      const isBackNavigation = sequence < lastObservedSequence;
      lastObservedSequence = sequence;
      reboundToGuardTop(sequence);

      if (!isBackNavigation) return;

      const now = Date.now();
      if (now - lastHandledBackAt < 180) return;
      lastHandledBackAt = now;

      const state = useAppStore.getState();

      if (isTimerOpenRef.current) {
        onCloseTimerRef.current?.();
        return;
      }

      if (state.screen === "session" && isSessionExitPromptOpenRef.current) {
        onCloseSessionExitPromptRef.current?.();
        return;
      }

      const target = getBackTarget(state);

      if (target === SESSION_EXIT_TARGET) {
        onRequestSessionExitRef.current?.();
        return;
      }

      if (target) {
        state.setScreen(target);
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
}
```

- [ ] **Step 4: Pass `screen` into the hook call in `App.jsx`**

In `src/App.jsx`, the `useBackButtonGuard` call currently reads (around line 148):

```js
  useBackButtonGuard({
    isTimerOpen,
    onCloseTimer: closeTimer,
    isSessionExitPromptOpen: showSessionExitPrompt,
    onCloseSessionExitPrompt: closeSessionExitPrompt,
    onRequestSessionExit: openSessionExitPrompt,
  });
```

Change it to:

```js
  useBackButtonGuard({
    screen,
    isTimerOpen,
    onCloseTimer: closeTimer,
    isSessionExitPromptOpen: showSessionExitPrompt,
    onCloseSessionExitPrompt: closeSessionExitPrompt,
    onRequestSessionExit: openSessionExitPrompt,
  });
```

(`screen` is already read at the top of the `App` component via `const screen = useAppStore((s) => s.screen);` — no new store subscription needed.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/shared/hooks/useBackButtonGuard.test.jsx`
Expected: PASS — both the pre-existing Android tests and the new iOS tests are green.

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS — all test files pass (70+ tests, same count as before plus the new ones from Task 1 and Task 2).

- [ ] **Step 7: Commit**

```bash
git add src/shared/hooks/useBackButtonGuard.js src/shared/hooks/useBackButtonGuard.test.jsx src/App.jsx
git commit -m "$(cat <<'EOF'
feat(navigation): real history-based back navigation on iOS

Branches useBackButtonGuard by platform: Android keeps the existing
single-guard-entry rebound mechanism untouched, while iOS now pushes a
real history entry per screen transition and applies the destination
screen directly on popstate. This gives iOS's edge-swipe-back gesture an
actual navigation target instead of a stale boot-screen snapshot to
rebound away from. Timer-open and active-session interception behave
the same as on Android.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Deploy and on-device verification

**Files:** none (deployment + manual verification only)

- [ ] **Step 1: Confirm working tree is clean**

Run: `git status --short`
Expected: empty output (everything from Task 1 and Task 2 committed).

- [ ] **Step 2: Ask the user for explicit confirmation before deploying**

Do not run `npm run deploy:prod` without the user's explicit go-ahead in this session, even though the code and tests are ready — deploying to the shared production runtime is a user-confirmed action per this project's established workflow.

- [ ] **Step 3: Deploy (only after user confirms)**

Run: `npm run deploy:prod`
Expected: build succeeds, version bumps, upload completes, and `npm run deploy:prod`'s built-in verification step reports the public URL, LAN URL, and API version all matching.

- [ ] **Step 4: Ask the user to test on a real iPhone**

Ask the user to reload `https://mirocard.kaplieva.help/` on their iPhone and repeat the same edge-swipe-back test across several screens they tried before. Ask them to report specifically:
- Whether the white-flash/hang/snap-back is gone.
- Whether the swipe now visibly navigates to the previous screen (matching the in-app back button).
- Whether the `session` screen still shows the exit-confirmation prompt instead of navigating away.
