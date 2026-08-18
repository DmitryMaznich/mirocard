import { useCallback, useEffect, useRef } from "react";

const IDLE_LIMIT_MS = 60_000;

/**
 * Counts only time in which the exercise is visible and the child has been
 * active recently. It intentionally does not use the app-wide timer: that
 * timer is a visual aid and can stay open outside a session.
 */
export function useActiveSessionTimer(enabled) {
  const activeMsRef = useRef(0);
  const activeSinceRef = useRef(null);
  const lastInteractionRef = useRef(null);

  const pause = useCallback((at = Date.now()) => {
    if (activeSinceRef.current == null) return;
    const lastActiveAt = Math.min(at, (lastInteractionRef.current ?? at) + IDLE_LIMIT_MS);
    activeMsRef.current += Math.max(0, lastActiveAt - activeSinceRef.current);
    activeSinceRef.current = null;
  }, []);

  const markInteraction = useCallback(() => {
    if (!enabled || document.hidden) return;
    const at = Date.now();
    if (activeSinceRef.current == null) activeSinceRef.current = at;
    lastInteractionRef.current = at;
  }, [enabled]);

  const getActiveDurationMs = useCallback(() => {
    if (activeSinceRef.current == null) return activeMsRef.current;
    const at = Date.now();
    const lastActiveAt = Math.min(at, (lastInteractionRef.current ?? at) + IDLE_LIMIT_MS);
    return activeMsRef.current + Math.max(0, lastActiveAt - activeSinceRef.current);
  }, []);

  useEffect(() => {
    if (!enabled) {
      pause();
      return undefined;
    }

    markInteraction();
    const onVisibilityChange = () => {
      if (document.hidden) pause();
      else markInteraction();
    };
    const onInteraction = () => markInteraction();
    const idleCheck = window.setInterval(() => {
      const lastInteractionAt = lastInteractionRef.current ?? Date.now();
      if (Date.now() - lastInteractionAt >= IDLE_LIMIT_MS) pause();
    }, 15_000);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointerdown", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction);
    return () => {
      window.clearInterval(idleCheck);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      pause();
    };
  }, [enabled, markInteraction, pause]);

  return { getActiveDurationMs };
}
