import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";
import "./styles.css";
import App from "./App";
import { getApiToken } from "./core/api";
import { TimerProvider } from "./features/timer/TimerContext";
import { LessonPlanProvider } from "./features/lessonPlan/LessonPlanContext";
import {
  SYMMETRY_DRAW_PRINT_ROUTE,
  SYMMETRY_DRAW_PRINT_STORAGE_KEY,
  buildSymmetryDrawPrintBody,
  PRINT_STYLE,
} from "./features/session/symmetryDrawPrintHtml.js";

// Shared with deck-ZIP renderers (see topics/rendererLoader.js). getApiToken
// lets a ZIP's bundled copy of shared/utils/protectedPhoto.js load
// owner-only user photos with the app's real token.
window.__Mirocard = { ...(window.__Mirocard ?? {}), React, ReactDOM, jsxRuntime, getApiToken };
if (import.meta.env.DEV) {
  const { useAppStore } = await import("./core/store.js");
  const { getDb, topics } = await import("./core/db.js");
  window.__store = useAppStore;
  window.__db = { getDb, topics };
}

// ── Print route ────────────────────────────────────────────────────────────
// Opened by SymmetryDrawPrintParams (see symmetryDrawPrintHtml.js for why a
// same-origin route, rather than a blob:/about:blank tab, is what actually
// works on Android's print integration). This tab renders only the print
// content — none of the normal app boots — then triggers window.print().
function bootSymmetryDrawPrintRoute() {
  const splash = document.getElementById("splash");
  if (splash) splash.remove();

  let cards = [];
  try {
    cards = JSON.parse(sessionStorage.getItem(SYMMETRY_DRAW_PRINT_STORAGE_KEY) ?? "[]");
  } catch {
    cards = [];
  }
  sessionStorage.removeItem(SYMMETRY_DRAW_PRINT_STORAGE_KEY);

  document.title = "Печать — Mironium";
  const styleEl = document.createElement("style");
  styleEl.textContent = PRINT_STYLE;
  document.head.appendChild(styleEl);
  document.getElementById("root").innerHTML = buildSymmetryDrawPrintBody(cards);

  window.addEventListener("load", () => {
    window.print();
    window.addEventListener("afterprint", () => window.close());
  });
}

function bootMainApp() {
  function markIosStandalone() {
    const ua = navigator.userAgent || "";
    const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const isIos = /iPad|iPhone|iPod/.test(ua) || isTouchMac;
    if (!isIos) return;

    const isStandalone =
      navigator.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.matchMedia?.("(display-mode: fullscreen)")?.matches;

    if (isStandalone) document.documentElement.classList.add("app-ios-standalone");
  }

  markIosStandalone();

  if ("serviceWorker" in navigator) {
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          // Don't send SKIP_WAITING automatically during an active session.
          // HomeScreen detects the waiting SW and shows an "Обновить" button.
          // Auto-SKIP_WAITING caused silent reloads mid-session that users
          // experienced as the back button "reloading the app."
        });
        registration.update().catch(() => {
          // Update checks are best-effort; the app still works with the active worker.
        });
      })
      .catch(() => {
        // Service workers are optional in development and unsupported in some browser modes.
      });
  }

  const SPLASH_MIN_MS = 1800;
  const splashStart = performance.now();
  let splashDismissQueued = false;

  function dismissSplash({ immediate = false } = {}) {
    const splash = document.getElementById("splash");
    if (!splash) return;
    if (splashDismissQueued && !immediate) return;
    splashDismissQueued = true;
    const elapsed = performance.now() - splashStart;
    const wait = immediate ? 0 : Math.max(0, SPLASH_MIN_MS - elapsed);
    setTimeout(() => {
      splash.classList.add("splash--exit");
      setTimeout(() => splash.remove(), immediate ? 0 : 580);
    }, wait);
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) dismissSplash({ immediate: true });
  });

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <TimerProvider>
        <LessonPlanProvider><App /></LessonPlanProvider>
      </TimerProvider>
    </StrictMode>
  );

  dismissSplash();
}

if (window.location.pathname === SYMMETRY_DRAW_PRINT_ROUTE) {
  bootSymmetryDrawPrintRoute();
} else {
  bootMainApp();
}
