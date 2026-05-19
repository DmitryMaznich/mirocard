import { useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getBackTarget, SESSION_EXIT_TARGET } from "@/shared/navigation/backNavigation";

const BACK_GUARD_DEPTH = 5;

// Each guard entry gets a unique URL so Chrome never collapses same-URL entries.
const GUARD_HASH_PREFIX = "#_g";

// Start from Date.now() so new-session sequences are always larger than any
// old-session sequence still sitting in the browser history stack.
// This is the key invariant: sequence(new entry) > sequence(any old entry).
let guardSequence    = Date.now();
let guardTopSequence = 0;
let lastObservedSequence = 0;
let lastHandledBackAt    = 0;

let _baseUrl = null;
function baseUrl() {
  if (!_baseUrl) _baseUrl = window.location.href.replace(/#.*$/, "");
  return _baseUrl;
}
function guardUrl(seq) {
  return baseUrl() + GUARD_HASH_PREFIX + seq;
}

function getGuardSequence(state) {
  return state?.mirocardBackGuard && Number.isFinite(state.guardSequence)
    ? state.guardSequence
    : 0;
}

function installBackGuardStack() {
  const currentState = window.history.state;

  if (currentState?.mirocardBackGuard) {
    const sequence = getGuardSequence(currentState);
    // Sync guardSequence so the next rebound always stays above the existing top.
    guardSequence    = Math.max(guardSequence, sequence);
    guardTopSequence = Math.max(guardTopSequence, sequence);
    lastObservedSequence = sequence;
    return;
  }

  const rootUrl = baseUrl();
  if (!currentState?.mirocardBackRoot) {
    window.history.replaceState(
      { ...(currentState ?? {}), mirocardBackRoot: true, guardSequence: 0 },
      "",
      rootUrl,
    );
  }

  for (let i = 0; i < BACK_GUARD_DEPTH; i += 1) {
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

function reboundToGuardTop(sequence) {
  if (sequence >= guardTopSequence) return;
  // Defence: guardSequence must never fall behind guardTopSequence.
  if (guardSequence < guardTopSequence) guardSequence = guardTopSequence;
  guardSequence += 1;
  guardTopSequence = guardSequence;
  lastObservedSequence = guardTopSequence;
  window.history.pushState(
    { mirocardBackGuard: true, guardSequence },
    "",
    guardUrl(guardSequence),
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
