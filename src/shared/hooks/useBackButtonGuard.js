import { useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { interceptBack } from "@/shared/navigation/backInterceptor";

// A browser/PWA cannot cancel the OS Back action at the start destination.
// Keep real screen entries instead of repeatedly pushing a synthetic guard
// from popstate (which browsers are allowed to skip).
const NAV_KEY = "mirocardScreenNav";

function baseUrl() {
  return window.location.href.replace(/#.*$/, "");
}

function screenUrl(index) {
  return `${baseUrl()}#app-${index}`;
}

function isOurEntry(state, id) {
  return state?.[NAV_KEY] === id && Number.isInteger(state.index) && state.index >= 0;
}

function entry(id, index, screen) {
  return { [NAV_KEY]: id, index, screen };
}

export function useBackButtonGuard({
  screen,
  isTimerOpen,
  onCloseTimer,
  isSessionExitPromptOpen,
  onCloseSessionExitPrompt,
  onRequestSessionExit,
}) {
  const latest = useRef({
    screen, isTimerOpen, onCloseTimer, isSessionExitPromptOpen,
    onCloseSessionExitPrompt, onRequestSessionExit,
  });
  const nav = useRef({
    id: null,
    initialized: false,
    screens: [],
    index: 0,
    pending: null,
    fromPopstate: null,
  });

  useEffect(() => {
    latest.current = {
      screen, isTimerOpen, onCloseTimer, isSessionExitPromptOpen,
      onCloseSessionExitPrompt, onRequestSessionExit,
    };
  }, [screen, isTimerOpen, onCloseTimer, isSessionExitPromptOpen,
    onCloseSessionExitPrompt, onRequestSessionExit]);

  useEffect(() => {
    if (!window.history?.pushState) return;
    const current = nav.current;

    if (!current.initialized) {
      current.id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      current.initialized = true;
      current.screens = [screen];
      current.index = 0;
      window.history.replaceState(entry(current.id, 0, screen), "", baseUrl());
      return;
    }

    if (current.fromPopstate === screen) {
      current.fromPopstate = null;
      return;
    }

    const previous = current.screens[current.index];
    if (screen === previous) return;

    if (screen === "login" && previous !== "boot") {
      // A sign-out/auth failure starts a new navigation lifetime. Old
      // authenticated screens must never be restored by browser Forward/Back.
      current.id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      current.screens = [screen];
      current.index = 0;
      current.pending = null;
      window.history.replaceState(entry(current.id, 0, screen), "", baseUrl());
      return;
    }

    // Boot and login are not destinations to return to after loading/auth.
    // A finished session must not reappear on browser Forward.
    if (previous === "boot" || (previous === "login" && screen === "home") || previous === "session") {
      current.screens[current.index] = screen;
      window.history.replaceState(entry(current.id, current.index, screen), "", current.index ? screenUrl(current.index) : baseUrl());
      return;
    }

    // In-app Back buttons already call setScreen(parent). Reuse a matching
    // earlier entry instead of pushing parent on top of its child.
    const priorIndex = current.index > 0
      ? current.screens.lastIndexOf(screen, current.index - 1)
      : -1;
    if (priorIndex >= 0) {
      current.pending = { index: priorIndex, screen };
      window.history.go(priorIndex - current.index);
      return;
    }

    current.screens = current.screens.slice(0, current.index + 1);
    current.index += 1;
    current.screens.push(screen);
    window.history.pushState(entry(current.id, current.index, screen), "", screenUrl(current.index));
  }, [screen]);

  useEffect(() => {
    if (!window.history?.pushState) return undefined;

    function ensureResumedSessionBackEntry() {
      const current = nav.current;
      if (!current.initialized || current.index !== 0 ||
        current.screens[0] !== "session" || latest.current.screen !== "session") return;

      // A restored session has no preceding app screen. Add one during an
      // actual user interaction so mobile browsers do not mark it skippable.
      const parent = useAppStore.getState().sessionReturnScreen ?? "home";
      current.screens = [parent, "session"];
      window.history.replaceState(entry(current.id, 0, parent), "", baseUrl());
      current.index = 1;
      window.history.pushState(entry(current.id, 1, "session"), "", screenUrl(1));
    }

    function handlePopState(event) {
      const current = nav.current;
      const destination = event.state;
      if (!isOurEntry(destination, current.id) || destination.index >= current.screens.length) {
        // An entry from a previous document/load is not ours to trap.
        return;
      }

      if (current.pending) {
        const pending = current.pending;
        current.pending = null;
        current.index = destination.index;
        current.screens[current.index] = pending.screen;
        window.history.replaceState(entry(current.id, current.index, pending.screen), "", current.index ? screenUrl(current.index) : baseUrl());
        return;
      }

      const { screen: visibleScreen, isTimerOpen, onCloseTimer,
        isSessionExitPromptOpen, onCloseSessionExitPrompt, onRequestSessionExit } = latest.current;
      const isBack = destination.index < current.index;

      if (isBack && (isTimerOpen || visibleScreen === "session")) {
        // Handle transient UI while retaining the visible screen.
        current.index = destination.index;
        current.screens = current.screens.slice(0, current.index + 1);
        current.index += 1;
        current.screens.push(visibleScreen);
        window.history.pushState(entry(current.id, current.index, visibleScreen), "", screenUrl(current.index));

        if (isTimerOpen) onCloseTimer?.();
        else if (isSessionExitPromptOpen) onCloseSessionExitPrompt?.();
        else onRequestSessionExit?.();
        return;
      }

      if (isBack && interceptBack()) {
        // The screen handled Back itself (an inner view with its own Back / unsaved-work question): stay on it, keep the history entry.
        current.index = destination.index;
        current.screens = current.screens.slice(0, current.index + 1);
        current.index += 1;
        current.screens.push(visibleScreen);
        window.history.pushState(entry(current.id, current.index, visibleScreen), "", screenUrl(current.index));
        return;
      }

      current.index = destination.index;
      const target = current.screens[current.index];
      if (!target || target === "boot" || target === visibleScreen) return;
      current.fromPopstate = target;
      useAppStore.getState().setScreen(target);
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pointerdown", ensureResumedSessionBackEntry, true);
    window.addEventListener("keydown", ensureResumedSessionBackEntry, true);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pointerdown", ensureResumedSessionBackEntry, true);
      window.removeEventListener("keydown", ensureResumedSessionBackEntry, true);
    };
  }, []);
}
