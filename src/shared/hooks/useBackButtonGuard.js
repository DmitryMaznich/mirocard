import { useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getBackTarget, SESSION_EXIT_TARGET } from "@/shared/navigation/backNavigation";

// Guard depth: how many history entries to keep above ROOT.
// On Android, rapid hardware back presses are processed at native level and can
// navigate through multiple history entries before any JS runs. A depth of 5
// absorbs any realistic burst of rapid button presses while keeping history
// size manageable.
const GUARD_DEPTH = 5;

// Monotonically increasing sequence number assigned to each guard entry.
// Used to detect direction: if the arriving sequence is higher than the last
// observed, the user went forward (ignore); if lower or equal, they went back.
let guardSeqTop = 0;
let lastObservedSeq = 0;
let lastHandledBackAt = 0;

function pushGuardEntries() {
  for (let i = 0; i < GUARD_DEPTH; i++) {
    guardSeqTop++;
    window.history.pushState(
      { mirocardBackGuard: true, guardSeq: guardSeqTop },
      "",
      window.location.href,
    );
  }
  lastObservedSeq = guardSeqTop;
}

function installBackGuard() {
  const current = window.history.state;

  if (current?.mirocardBackGuard) {
    // Already on a guard entry — sync module counters and return.
    const seq = current.guardSeq || 0;
    guardSeqTop = Math.max(guardSeqTop, seq);
    lastObservedSeq = guardSeqTop;
    return;
  }

  if (!current?.mirocardBackRoot) {
    // Replace whatever is here with a ROOT marker so the entry is recognisable
    // if the user ever navigates back to it.
    window.history.replaceState({ mirocardBackRoot: true }, "", window.location.href);
  }

  pushGuardEntries();
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
  }, [isTimerOpen, onCloseTimer, isSessionExitPromptOpen, onCloseSessionExitPrompt, onRequestSessionExit]);

  useEffect(() => {
    if (!window.history?.pushState) return undefined;

    installBackGuard();

    function handlePopState(event) {
      const state = event.state;
      const seq = state?.mirocardBackGuard ? (state.guardSeq || 0) : 0;

      // Forward navigation (user pressed forward or guard was replenished
      // with higher sequences) — update counter and ignore.
      if (seq > lastObservedSeq) {
        lastObservedSeq = seq;
        return;
      }

      lastObservedSeq = seq;

      // Re-establish the full guard depth synchronously before any React updates.
      // pushState from the current position truncates the remaining old guard
      // entries above it and adds GUARD_DEPTH new ones, so the stack never
      // grows unboundedly in normal single-press usage.
      pushGuardEntries();

      // Debounce: suppress app-level action on rapid presses.
      // Guard is already restored above, so no press can ever escape regardless.
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

      const appState = useAppStore.getState();
      const target = getBackTarget(appState);

      if (target === SESSION_EXIT_TARGET) {
        onRequestSessionExitRef.current?.();
        return;
      }

      if (target) {
        appState.setScreen(target);
      }
    }

    function handleBeforeUnload(event) {
      // Last-resort fallback if the guard is bypassed by an external navigation.
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
