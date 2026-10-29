import { useState, useEffect, useCallback } from "react";

const DISMISS_KEY = "installBannerDismissedInTab";

function isIosDevice() {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream) return true;
  // Safari on iPadOS 13+ reports itself as a Mac; a "Mac" with a touch screen is an iPad.
  return /macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

// Add-to-Home-Screen only produces a real installable PWA in actual Safari.
// Other iOS browsers (Chrome/Firefox/Edge/Yandex...) are WebKit under the hood
// but their own "Add to Home Screen" menu item just makes a plain bookmark.
function isIosNonSafariBrowser() {
  return /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo|Mercury/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean(navigator.standalone);
}

function wasDismissedInTab() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(wasDismissedInTab);
  const [installed, setInstalled] = useState(isStandalone);
  const isIos = isIosDevice();
  const isIosNonSafari = isIos && isIosNonSafariBrowser();
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isFirefoxAndroid = isAndroid && /Firefox\//i.test(navigator.userAgent);
  // A narrow desktop window or a touch-enabled Windows laptop is still a PC.
  // Android tablets and desktop-mode iPads retain the mobile guide.
  const isMobileDevice = isIos || isAndroid;

  useEffect(() => {
    if (!isMobileDevice || installed || dismissed) return;

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isMobileDevice, installed, dismissed]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setInstalled(true);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
    setDeferredPrompt(null);
  }, []);

  // Phones/tablets can open a guide before a native install prompt is ready.
  const visible = isMobileDevice && !installed && !dismissed;

  return { visible, install, dismiss, isIos, isIosNonSafari, isAndroid, isFirefoxAndroid, hasNativePrompt: deferredPrompt != null };
}

