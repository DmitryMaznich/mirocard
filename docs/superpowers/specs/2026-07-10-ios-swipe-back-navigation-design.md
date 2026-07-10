# iOS swipe-back: real history navigation

## Problem

On iPhone, swiping from the left screen edge (the native iOS Safari/WebKit
"edge-swipe-back" gesture) causes a visible glitch on various screens: a
white/blank flash appears, then the app snaps back to the screen the user
was trying to leave. The swipe never actually goes anywhere.

### Root cause

Mirocard2 is a state-driven single-page app: `screen` in the Zustand store
(`src/core/store.js`) decides what renders; there are no per-screen URLs.
`useBackButtonGuard.js` fakes a "back" experience for Android's hardware
back button using a single shared history-entry pair:

- `ROOT` (app base URL, no hash) — normalized once at boot via
  `history.replaceState`.
- `#_guard` — pushed on top of `ROOT` at boot and re-pushed
  (`reboundToGuardTop`) every time a real "back" navigation is detected via
  `popstate`.

Screen changes themselves (`setScreen(...)`) never touch `history` — only
React state changes.

iOS's edge-swipe-back gesture is a native, animated WebKit transition: while
dragging, WebKit shows a cached visual snapshot of the entry being revealed
(`ROOT`). That snapshot was captured once, at boot, while `BootScreen`
("Загрузка…") was showing, and is never refreshed by subsequent same-document
`pushState`/`replaceState` calls. So every edge-swipe reveals that stale
boot-screen snapshot (the reported "white background"), and then
`reboundToGuardTop` immediately fights the still-settling native transition
by pushing `#_guard` back on top — which is why the screen appears to hang
and then snap back to where the swipe started.

This was confirmed on-device: a CSS-only mitigation
(`touch-action: pan-y` instead of `pan-x pan-y` on `html, body, #root`,
committed in `77aba0f5`) reduced how often iOS recognizes the gesture but
did not eliminate it — the same white-flash-then-snap-back still occurs.

## Goal

On iOS, a completed edge-swipe-back gesture should behave like tapping the
in-app back button on the current screen: it should actually navigate to the
previous screen, with no flash/hang/snap-back artifact. Android's hardware
back button (and the existing single-guard mechanism that handles it) must
not be touched or risked — it took multiple iterations
(`796eb9f5` through `253cf6ff`) to stabilize against Android Chrome's
history-entry quirks, and there is no reported bug on Android today.

Out of scope: wrapping the app in a native shell (Capacitor/WKWebView) to
call `allowsBackForwardNavigationGestures = false`. That is the only
mechanism that can *guarantee* the gesture never triggers at all, but it is
a separate, much larger project (native app build/signing/distribution) and
is explicitly not part of this change. This design is a best-effort fix
within the existing PWA.

## Approach

Split `useBackButtonGuard` behavior by platform:

- **Android / desktop:** unchanged. The existing single-entry
  `ROOT` + `#_guard` rebound mechanism keeps running exactly as today.
- **iOS** (detected via the existing
  `/iPad|iPhone|iPod/.test(navigator.userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)`
  pattern already used in `src/main.jsx` and
  `src/features/student/StudentLandingPage.jsx`): a real per-transition
  history stack, so each edge-swipe genuinely traverses to the entry that
  was current when the user was last looking at it — giving WebKit a
  correct snapshot to show, and giving the completed gesture a real
  destination instead of something to rebound away from.

### iOS history stack lifecycle

1. **Mount:** normalize the current entry as the app's root:
   `history.replaceState({ mirocardIosNav: true, screen: <current screen> }, "", location.href)`.
   Anything below this entry (whatever was open before the app/tab) is
   outside the app's stack — swiping past the root is a real exit, which is
   the intended behavior (matches "swipe = real back navigation" all the
   way to actually leaving, same as a plain website).

2. **Forward navigation:** whenever `screen` changes (via `setScreen`, from
   anywhere in the app — header back buttons included, since they already
   just call `setScreen(getBackTarget(...))`) and the change was **not**
   caused by restoring from a `popstate` event, push a new entry:
   `history.pushState({ mirocardIosNav: true, screen, seq: n }, "", "#s{n}")`.
   `seq`/`#s{n}` is a monotonically increasing counter — the hash must be
   unique per push so a browser never sees two consecutive identical URLs
   (the same defensive reasoning already applied to the Android guard's
   `#_guard` uniqueness).

3. **`popstate`:** if `event.state.mirocardIosNav` is set, mark a
   "restoring" ref flag, call `setScreen(event.state.screen)`, done — no
   `pushState` fight, the native transition is allowed to complete normally.
   If `event.state` doesn't carry `mirocardIosNav` (traversed below the
   root), do nothing extra and let the browser/OS handle it as a real exit
   — *except* the two special cases below, which still apply regardless of
   whether the popstate crossed the root.

### Special cases (reused unchanged from the Android path's logic)

- **Timer open:** first back/swipe closes the timer instead of navigating.
- **`session` screen:** back/swipe does not navigate away. If the exit
  confirmation modal is already open, back/swipe closes it. Otherwise,
  `pushState` the current `session` entry back on top (same rebound idea as
  today, scoped to just this one case) and call `onRequestSessionExit()` to
  open the confirmation modal — identical UX to today's Android behavior.

### What does NOT change

- `getBackTarget`/`backNavigation.js` stays as-is; it's still used by
  Android's path and by any header "back" button that calls
  `setScreen(getBackTarget(state))` directly (that call doesn't change —
  the iOS `pushState` effect just observes the resulting `screen` change
  like any other).
- No screen-level component needs to change.
- Reload/mid-session refresh: the boot sequence in `App.jsx` already decides
  the correct initial `screen` independently (resumable session, login,
  etc.); the iOS mount step simply re-tags whatever entry exists at that
  point as the new root, discarding any pre-reload forward stack. No attempt
  is made to resume a multi-step history stack across a reload.

## Testing

- New unit tests alongside the existing `useBackButtonGuard.test.jsx`,
  mocking `navigator.userAgent` to an iOS string:
  - Multiple `pushState` transitions followed by a simulated `popstate`
    restore the correct previous `screen`.
  - Popping past the root entry does nothing extra for a normal screen.
  - Popping while on `session` (root or not) opens the exit-confirmation
    prompt instead of navigating.
  - Timer-open interception still takes priority.
- Existing Android-path tests are untouched and must continue to pass
  unmodified (proof the Android branch wasn't touched).
- Manual on-device verification on a real iPhone is required after deploy —
  the interactive gesture/animation cannot be exercised in jsdom. The user
  will test after deploy, same as the previous CSS-only attempt.

## Risks

- iOS Safari's exact behavior around cached gesture snapshots for
  `pushState`-only (same-document) transitions is not something we can
  verify from code alone; the design is based on the WebKit-documented
  gesture navigation model and confirmed on-device symptoms, but there is
  no guarantee this fully eliminates every visual artifact on every iOS
  version. It should, however, make the swipe an actual navigation instead
  of a no-op that snaps back — which is the concrete, testable improvement
  being targeted.
- Platform branching means iOS and Android now have two different
  navigation mechanisms to reason about long-term. Accepted trade-off to
  avoid risking the already-hardened Android path.
