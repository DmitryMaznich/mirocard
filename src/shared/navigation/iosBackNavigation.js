// iOS Safari recognizes the left-edge swipe-back gesture even when
// touch-action/overscroll-behavior try to suppress it. Rather than fight the
// gesture, this module gives it a real history stack to traverse: one tagged
// entry per screen transition, so a completed swipe lands on an actual
// destination instead of rebounding off a stale boot-screen snapshot.
//
// History entries survive page reloads (same-tab history is never cleared by
// the History API — there is no way to truncate it), so entries pushed by a
// *previous* load of this app can still be revealed by swiping past this
// load's root. sessionNonce, generated fresh on every module evaluation
// (i.e. every real page load), tags entries as belonging to the current load
// so stale entries from earlier loads are never trusted to restore a screen.

let iosSequence = 0;
const sessionNonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
    { mirocardIosNav: true, nonce: sessionNonce, screen, seq: iosSequence },
    "",
    iosBaseUrl(),
  );
}

export function pushIosScreen(screen) {
  iosSequence += 1;
  window.history.pushState(
    { mirocardIosNav: true, nonce: sessionNonce, screen, seq: iosSequence },
    "",
    `${iosBaseUrl()}#s${iosSequence}`,
  );
}

export function getIosNavState(event) {
  const state = event.state;
  if (!state?.mirocardIosNav || state.nonce !== sessionNonce) return null;
  return state;
}
