import { useState, useEffect, useCallback } from "react";

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

    // A long mobile session can resume from the background without a real
    // page reload — Android often revives a suspended tab in place rather
    // than navigating — so the one-shot check above never re-runs on its
    // own. Re-check whenever the app comes back to the foreground so a
    // version that shipped while it was backgrounded is actually noticed.
    function onVisible() {
      if (document.hidden || !currentReg) return;
      if (currentReg.waiting) setHasUpdate(true);
      currentReg.update().catch(() => {});
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
    window.location.reload();
  }, [reg]);

  return { hasUpdate, applyUpdate };
}
