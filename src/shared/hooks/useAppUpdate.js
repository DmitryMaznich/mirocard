import { useState, useEffect, useCallback } from "react";
import { api } from "@/core/api";
import { useAppStore } from "@/core/store";

// What this bundle was actually built with — independent of anything a
// service worker registration believes, since that can drift from what's
// really rendered (see checkVersionMismatch below).
const CURRENT_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

// jsdom refuses to let tests stub window.location.reload directly (it's
// non-configurable there), so every call site goes through this seam instead.
export const _internals = { reload: () => window.location.reload() };

export function useAppUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [reg, setReg] = useState(null);

  useEffect(() => {
    if (!navigator.serviceWorker) return;
    let currentReg = null;

    navigator.serviceWorker.ready.then((r) => {
      currentReg = r;
      setReg(r);
      if (r.waiting) setHasUpdate(true);
      r.addEventListener("updatefound", () => {
        const sw = r.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            setHasUpdate(true);
          }
        });
      });
      r.update().catch(() => {});
    });

    // registration.waiting / controllerchange can silently drift from what's
    // actually on screen: Android can freeze a backgrounded tab (not kill
    // it) for hours without ever delivering controllerchange to it, while
    // the registration itself moves on through some other path (another
    // tab, the browser's own periodic check). This reproduced as the app
    // staying on a build from hours earlier with no update indicator ever
    // appearing, because neither registration-based signal above fired for
    // this specific page. Asking the server directly what it actually built
    // is immune to that drift.
    async function checkVersionMismatch() {
      try {
        const { version } = await api.get("/version");
        if (version && version !== "unknown" && version !== CURRENT_VERSION) {
          setHasUpdate(true);
          // This only runs right as the app becomes visible again, not
          // mid-interaction, so handing off here doesn't cost an in-progress
          // exercise — except when one is actually running (screen ===
          // "session"), where we still only raise the indicator.
          if (useAppStore.getState().screen === "session") return;
          // A bare reload does NOT hand control to a newer worker — the
          // still-active old one keeps serving the reloaded page through its
          // own (stale) fetch handler, so nothing actually changes. This was
          // confirmed live: chrome://serviceworker-internals showed the same
          // active Version ID days apart despite dozens of deploys and
          // repeated reloads via this path. update() first gives the browser
          // a chance to finish installing the newest worker, then SKIP_WAITING
          // it — the controllerchange listener below does the actual reload
          // once the new worker has really taken over.
          if (currentReg) {
            await currentReg.update().catch(() => {});
            if (currentReg.waiting) {
              currentReg.waiting.postMessage({ type: "SKIP_WAITING" });
              return;
            }
          }
          _internals.reload();
        }
      } catch {
        // Best-effort — the registration-based checks above still apply.
      }
    }
    checkVersionMismatch();

    // A long mobile session can resume from the background without a real
    // page reload — Android often revives a suspended tab in place rather
    // than navigating — so the one-shot checks above never re-run on their
    // own. Re-check whenever the app comes back to the foreground so a
    // version that shipped while it was backgrounded is actually noticed.
    function onVisible() {
      if (document.hidden) return;
      if (currentReg) {
        if (currentReg.waiting) setHasUpdate(true);
        currentReg.update().catch(() => {});
      }
      checkVersionMismatch();
    }
    document.addEventListener("visibilitychange", onVisible);

    const onController = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onController);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    try {
      await reg?.update();
    } catch {
      // A manual refresh still gives the browser a chance to load the newest app shell.
    }
    // update() resolving doesn't guarantee the newly-found worker has
    // finished installing yet — check again rather than reloading straight
    // into the same still-active old worker.
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    _internals.reload();
  }, [reg]);

  return { hasUpdate, applyUpdate };
}
