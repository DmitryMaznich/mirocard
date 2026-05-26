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

function rootStateFrom(state) {
  const nextState = { ...(state ?? {}) };
  delete nextState.mirocardBackGuard;
  nextState.mirocardBackRoot = true;
  nextState.guardSequence = 0;
  return nextState;
}

function pushGuardEntries(count) {
  for (let i = 0; i < count; i++) {
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

function installBackGuardStack() {
  const currentState = window.history.state;
  const currentSequence = getGuardSequence(currentState);

  if (currentState?.mirocardBackGuard) {
    guardSequence = Math.max(guardSequence, currentSequence);
    guardTopSequence = Math.max(guardTopSequence, currentSequence);
    lastObservedSequence = currentSequence;
    return;
  }

  guardSequence = Math.max(guardSequence, guardTopSequence, currentSequence);
  window.history.replaceState(rootStateFrom(currentState), "", window.location.href);

  pushGuardEntries(BACK_GUARD_DEPTH);
}

function reboundToGuardTop(sequence) {
  if (sequence >= guardTopSequence) return;
  window.history.go(guardTopSequence - sequence);
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

    function ensureGuardAfterResume() {
      if (document.visibilityState === "hidden") return;
      if (window.history.state?.mirocardBackGuard) return;
      installBackGuardStack();
    }

    function handleBeforeUnload(event) {
      if (useAppStore.getState().screen !== "session") return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", ensureGuardAfterResume);
    window.addEventListener("focus", ensureGuardAfterResume);
    document.addEventListener("visibilitychange", ensureGuardAfterResume);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", ensureGuardAfterResume);
      window.removeEventListener("focus", ensureGuardAfterResume);
      document.removeEventListener("visibilitychange", ensureGuardAfterResume);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
