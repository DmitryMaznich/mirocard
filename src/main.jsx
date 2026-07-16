import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";
import "./styles.css";
import App from "./App";
import StudentApp from "./StudentApp";
import { TimerProvider } from "./features/timer/TimerContext";
import { LessonPlanProvider } from "./features/lessonPlan/LessonPlanContext";

window.__Mirocard = { React, ReactDOM, jsxRuntime };
if (import.meta.env.DEV) {
  const { useAppStore } = await import("./core/store.js");
  const { getDb, topics } = await import("./core/db.js");
  window.__store = useAppStore;
  window.__db = { getDb, topics };
}

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

// ── Student portal entry ──────────────────────────────────────────────────────
// In standalone/PWA mode use localStorage so the token survives app restarts.
// In regular browser use sessionStorage so closing the tab clears it — this
// lets the logopedist test a link without getting locked out of their own app.
const _isStandalone =
  navigator.standalone === true ||
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.matchMedia?.("(display-mode: fullscreen)")?.matches;
const _portalStorage = _isStandalone ? localStorage : sessionStorage;

const _urlPortalMatch = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)$/);
if (_urlPortalMatch) {
  _portalStorage.setItem("student_portal_token", _urlPortalMatch[1]);
  // Clean up any stale token in the other storage to avoid surprises.
  (_isStandalone ? sessionStorage : localStorage).removeItem("student_portal_token");
  // When the link is opened in a regular browser, save a short-lived handoff
  // entry so an already-installed PWA can pick up the token on next launch.
  if (!_isStandalone) {
    try {
      localStorage.setItem("student_portal_handoff", JSON.stringify({
        token: _urlPortalMatch[1],
        exp: Date.now() + 30 * 60 * 1000, // 30-minute window
      }));
    } catch {}
    // Keep /s/TOKEN visible in the address bar so Chrome on Android can
    // recognise the PWA scope and offer "Open in app". The landing page
    // calls history.replaceState("/") once the user chooses an action.
  } else {
    history.replaceState(null, "", "/");
  }
}
// Migration: tokens written by the old code always went to localStorage.
// In non-standalone (browser tab) mode, remove them — the user can reopen
// the /s/TOKEN link if needed. This immediately frees the logopedist who
// tested a link and got stuck in student mode.
if (!_isStandalone) {
  localStorage.removeItem("student_portal_token");
}

// In standalone/PWA mode, consume any handoff token left by the browser.
if (_isStandalone && !_urlPortalMatch) {
  try {
    const _handoff = JSON.parse(localStorage.getItem("student_portal_handoff") || "null");
    if (_handoff?.token && Date.now() < (_handoff.exp ?? 0)) {
      localStorage.setItem("student_portal_token", _handoff.token);
    }
    localStorage.removeItem("student_portal_handoff");
  } catch {}
}

const _portalToken = _portalStorage.getItem("student_portal_token");
// ─────────────────────────────────────────────────────────────────────────────

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
      {_portalToken
        ? <StudentApp token={_portalToken} isStandalone={_isStandalone} fromLink={Boolean(_urlPortalMatch) && !_isStandalone} />
        : <LessonPlanProvider><App /></LessonPlanProvider>}
    </TimerProvider>
  </StrictMode>
);

dismissSplash();
