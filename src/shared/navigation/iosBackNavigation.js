// iOS Safari recognizes the left-edge swipe-back gesture even when
// touch-action/overscroll-behavior try to suppress it, and there is no web
// API to disable it outright. Two attempts at treating a completed swipe as
// real in-app navigation (restoring `screen` from the revealed history
// entry) both broke navigation in practice: `screen` alone doesn't capture
// full app state (active student/topic/mode ids aren't restorable from
// history), and same-tab history persists across reloads with no API to
// clear it, so stale entries from earlier page loads kept leaking through.
//
// The current approach: never trust history content at all. Every swipe
// pushes a fresh entry for the *current* screen right back on top — the
// same "always rebound" philosophy already proven on Android
// (useBackButtonGuard.js), just with a per-transition entry here instead of
// one shared guard hash, so WebKit's mid-gesture preview reflects the
// current screen rather than a snapshot frozen at boot.

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
