import { useState, useEffect, useCallback } from "react";

export function useAppUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [reg, setReg] = useState(null);

  useEffect(() => {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then((r) => {
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
    const onController = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onController);
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
