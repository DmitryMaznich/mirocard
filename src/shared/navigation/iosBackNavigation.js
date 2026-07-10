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
