import { useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getBackTarget, SESSION_EXIT_TARGET } from "@/shared/navigation/backNavigation";

// One entry is enough. With DEPTH=1 the rebound always goes root→#_guard
// (different URLs), so Chrome Android never silently ignores the pushState.
// DEPTH≥2 causes same-URL rebounds (#_guard→#_guard) which Chrome may drop.
const GUARD_HASH = "#_guard";

let guardSequence = 0;
let guardTopSequence = 0;
let lastObservedSequence = 0;
let lastHandledBackAt = 0;

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
  isTimerOpen,
  onCloseTimer,
  isSessionExitPromptOpen,
  onCloseSessionExitPrompt,
  onRequestSessionExit,
}) {
  const isTimerOpenRef = useRef(isTimerOpen);
  const onCloseTimerRef = useRef(onCloseTimer);
  const isSessionExitPromptOpenRef = useRef(isSessionExitPromptOpen);
  const onCloseSessionExitPromptRef = useRef(onCloseSessionExitPrompt);
  const onRequestSessionExitRef = useRef(onRequestSessionExit);

  useEffect(() => {
    isTimerOpenRef.current = isTimerOpen;
    onCloseTimerRef.current = onCloseTimer;
    isSessionExitPromptOpenRef.current = isSessionExitPromptOpen;
    onCloseSessionExitPromptRef.current = onCloseSessionExitPrompt;
    onRequestSessionExitRef.current = onRequestSessionExit;
  }, [
    isTimerOpen,
    onCloseTimer,
    isSessionExitPromptOpen,
    onCloseSessionExitPrompt,
    onRequestSessionExit,
  ]);

  useEffect(() => {
    if (!window.history?.pushState) return undefined;

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
