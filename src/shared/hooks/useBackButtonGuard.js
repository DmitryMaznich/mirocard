import { useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getBackTarget, SESSION_EXIT_TARGET } from "@/shared/navigation/backNavigation";

// History layout maintained by this guard:
//   [...browser history...] [ROOT] [GUARD]  ← always at GUARD
//
// On back press → we land at ROOT, which fires popstate.
// We push a new GUARD synchronously (before any React updates),
// so the next back press is already absorbed before we process this one.
// pushState from ROOT truncates the old GUARD, so the stack never grows.

const ROOT_STATE = { mirocardBackRoot: true };
const GUARD_STATE = { mirocardBackGuard: true };

let lastHandledBackAt = 0;

function installBackGuard() {
  const current = window.history.state;
  if (current?.mirocardBackGuard) return;
  if (current?.mirocardBackRoot) {
    window.history.pushState(GUARD_STATE, "", window.location.href);
    return;
  }
  window.history.replaceState(ROOT_STATE, "", window.location.href);
  window.history.pushState(GUARD_STATE, "", window.location.href);
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

    installBackGuard();

    function handlePopState(event) {
      // Forward navigation back to guard entry — not a user back press
      if (event.state?.mirocardBackGuard) return;

      // Re-establish guard synchronously FIRST, before any async React updates.
      // pushState from ROOT truncates the old GUARD, so history stays at 2 entries.
      if (event.state?.mirocardBackRoot) {
        window.history.pushState(GUARD_STATE, "", window.location.href);
      } else {
        // Went past ROOT (e.g., multi-step history jump via long-press back menu)
        window.history.replaceState(ROOT_STATE, "", window.location.href);
        window.history.pushState(GUARD_STATE, "", window.location.href);
      }

      // Debounce: suppress app-level action on rapid presses.
      // Guard is already restored above, so rapid presses can never escape.
      const now = Date.now();
      if (now - lastHandledBackAt < 180) return;
      lastHandledBackAt = now;

      if (isTimerOpenRef.current) {
        onCloseTimerRef.current?.();
        return;
      }

      if (isSessionExitPromptOpenRef.current) {
        onCloseSessionExitPromptRef.current?.();
        return;
      }

      const state = useAppStore.getState();
      const target = getBackTarget(state);

      if (target === SESSION_EXIT_TARGET) {
        onRequestSessionExitRef.current?.();
        return;
      }

      if (target) {
        state.setScreen(target);
      }
    }

    function handleBeforeUnload(event) {
      // Last-resort protection if the guard is somehow bypassed
      if (useAppStore.getState().screen !== "session") return;
      event.preventDefault();
      event.returnValue = "";
    }

    function ensureGuardAfterResume() {
      if (document.visibilityState === "hidden") return;
      installBackGuard();
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
