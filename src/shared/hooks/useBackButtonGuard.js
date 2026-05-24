import { useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getBackTarget, SESSION_EXIT_TARGET } from "@/shared/navigation/backNavigation";

// Keep GUARD_DEPTH history entries ahead of root so rapid-fire back presses
// (before JS can rebound) can't escape the app. Each entry uses a unique URL
// so Chrome Android never silently drops the pushState.
const GUARD_DEPTH = 3;

let guardSequence = 0;
let guardTopSequence = 0;
let lastObservedSequence = 0;
let lastHandledBackAt = 0;

function baseUrl() {
  return window.location.href.replace(/#.*$/, "");
}

function guardUrl(seq) {
  return `${baseUrl()}#_guard_${seq}`;
}

function getGuardSequence(state) {
  return state?.mirocardBackGuard && Number.isFinite(state.guardSequence)
    ? state.guardSequence
    : 0;
}

function pushGuardEntries(count) {
  for (let i = 0; i < count; i++) {
    guardSequence += 1;
    window.history.pushState(
      { mirocardBackGuard: true, guardSequence },
      "",
      guardUrl(guardSequence),
    );
  }
  guardTopSequence = guardSequence;
  lastObservedSequence = guardTopSequence;
}

function installBackGuardStack() {
  const currentState = window.history.state;

  if (currentState?.mirocardBackGuard) {
    const sequence = getGuardSequence(currentState);
    guardSequence    = Math.max(guardSequence, sequence);
    guardTopSequence = Math.max(guardTopSequence, sequence);
    lastObservedSequence = sequence;
    return;
  }

  const rootUrl = window.location.href.replace(/#.*$/, "");
  if (!currentState?.mirocardBackRoot) {
    window.history.replaceState(
      { ...(currentState ?? {}), mirocardBackRoot: true, guardSequence: 0 },
      "",
      rootUrl,
    );
  }

  pushGuardEntries(GUARD_DEPTH);
}

function reboundToGuardTop(sequence) {
  if (sequence >= guardTopSequence) return;
  // Always restore a full GUARD_DEPTH buffer so subsequent rapid-fire back
  // presses (queued before this rebound fires) are also absorbed.
  pushGuardEntries(GUARD_DEPTH);
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
