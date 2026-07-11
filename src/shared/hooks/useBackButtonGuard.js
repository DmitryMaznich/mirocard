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
        if (!state) {
          // Untrusted entry: either a stale one left over from a previous
          // page load (history persists across reloads within the same
          // tab — there is no API to clear it), or genuinely below our own
          // root this session. Either way, don't let the browser sit on
          // content we don't control — re-anchor on the current screen.
          const now = Date.now();
          if (now - lastHandledIosSpecialAt < 180) return;
          lastHandledIosSpecialAt = now;
          pushIosScreen(screenRef.current);
          return;
        }

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
