import { useEffect } from "react";

export function useKioskMode() {
  useEffect(() => {
    // Portrait-only orientation
    try {
      window.screen?.orientation?.lock?.("portrait").catch(() => {});
    } catch {
      // Orientation lock is best-effort and can be unavailable outside fullscreen/PWA mode.
    }

    let wakeLock = null;
    let wakeLockRequestInFlight = false;
    let disposed = false;
    let lastTouchEndAt = 0;
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewportMeta?.getAttribute("content");

    if (viewportMeta) {
      viewportMeta.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover",
      );
    }

    async function requestWakeLock() {
      if (
        disposed ||
        wakeLock ||
        wakeLockRequestInFlight ||
        document.visibilityState !== "visible" ||
        !navigator.wakeLock
      ) {
        return;
      }

      wakeLockRequestInFlight = true;
      try {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock?.addEventListener?.("release", () => {
          wakeLock = null;
          if (!disposed && document.visibilityState === "visible") {
            window.setTimeout(requestWakeLock, 250);
          }
        }, { once: true });
      } catch {
        wakeLock = null;
      }
      finally {
        wakeLockRequestInFlight = false;
      }
    }

    function releaseWakeLock() {
      const lock = wakeLock;
      wakeLock = null;
      lock?.release?.().catch(() => {});
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    }

    requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Block long-press context menu (Android system menu, iOS callout)
    const blockContextMenu = (e) => e.preventDefault();
    const blockGesture = (e) => {
      if (e.cancelable) e.preventDefault();
    };
    const blockMultiTouch = (e) => {
      if (e.touches?.length > 1 && e.cancelable) e.preventDefault();
    };
    const blockDoubleTap = (e) => {
      const now = Date.now();
      if (now - lastTouchEndAt < 350 && e.cancelable) {
        e.preventDefault();
      }
      lastTouchEndAt = now;
    };
    const blockWheelZoom = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.cancelable) e.preventDefault();
    };
    const blockKeyboardZoom = (e) => {
      const isZoomKey = ["+", "-", "=", "0"].includes(e.key);
      if ((e.ctrlKey || e.metaKey) && isZoomKey && e.cancelable) {
        e.preventDefault();
      }
    };

    const nonPassiveOptions = { passive: false };
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("gesturestart", blockGesture, nonPassiveOptions);
    document.addEventListener("gesturechange", blockGesture, nonPassiveOptions);
    document.addEventListener("gestureend", blockGesture, nonPassiveOptions);
    document.addEventListener("touchstart", requestWakeLock, nonPassiveOptions);
    document.addEventListener("touchmove", blockMultiTouch, nonPassiveOptions);
    document.addEventListener("touchend", blockDoubleTap, nonPassiveOptions);
    document.addEventListener("pointerdown", requestWakeLock);
    document.addEventListener("click", requestWakeLock);
    window.addEventListener("focus", requestWakeLock);
    window.addEventListener("wheel", blockWheelZoom, nonPassiveOptions);
    window.addEventListener("keydown", blockKeyboardZoom, nonPassiveOptions);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
      document.removeEventListener("touchstart", requestWakeLock);
      document.removeEventListener("touchmove", blockMultiTouch);
      document.removeEventListener("touchend", blockDoubleTap);
      document.removeEventListener("pointerdown", requestWakeLock);
      document.removeEventListener("click", requestWakeLock);
      window.removeEventListener("focus", requestWakeLock);
      window.removeEventListener("wheel", blockWheelZoom);
      window.removeEventListener("keydown", blockKeyboardZoom);
      if (viewportMeta && originalViewport !== null && originalViewport !== undefined) {
        viewportMeta.setAttribute("content", originalViewport);
      }
      releaseWakeLock();
    };
  }, []);
}
