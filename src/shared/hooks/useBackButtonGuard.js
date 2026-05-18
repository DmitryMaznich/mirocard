import { useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getBackTarget, SESSION_EXIT_TARGET } from "@/shared/navigation/backNavigation";

const BACK_GUARD_DEPTH = 64;
let guardSequence = 0;
let guardTopSequence = 0;
let lastObservedSequence = 0;
let lastHandledBackAt = 0;

function getGuardSequence(state) {
  return state?.mirocardBackGuard && Number.isFinite(state.guardSequence)
    ? state.guardSequence
    : 0;
}

function installBackGuardStack() {
  const currentState = window.history.state;

  if (currentState?.mirocardBackGuard) {
    const sequence = getGuardSequence(currentState);
    guardTopSequence = Math.max(guardTopSequence, sequence);
    lastObservedSequence = sequence;
    return;
  }

  if (!currentState?.mirocardBackRoot) {
    window.history.replaceState(
      { ...(currentState ?? {}), mirocardBackRoot: true, guardSequence: 0 },
      "",
      window.location.href,
    );
  }

  for (let i = 0; i < BACK_GUARD_DEPTH; i += 1) {
    guardSequence += 1;
    window.history.pushState(
      { mirocardBackGuard: true, guardSequence },
      "",
      window.location.href,
    );
  }
  guardTopSequence = guardSequence;
  lastObservedSequence = guardTopSequence;
}

function reboundToGuardTop(sequence) {
  if (sequence >= guardTopSequence) return;
  guardSequence += 1;
  guardTopSequence = guardSequence;
  lastObservedSequence = guardTopSequence;
  window.history.pushState(
    { mirocardBackGuard: true, guardSequence },
    "",
    window.location.href,
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
