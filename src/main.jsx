import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";
import "./styles.css";
import App from "./App";

window.__Mirocard = { React, ReactDOM, jsxRuntime };

if ("serviceWorker" in navigator) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
    .then((registration) => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
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

function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const elapsed = performance.now() - splashStart;
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(() => {
    splash.classList.add("splash--exit");
    setTimeout(() => splash.remove(), 580);
  }, wait);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

dismissSplash();
