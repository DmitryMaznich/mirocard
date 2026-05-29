import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { useBackButtonGuard } from "./useBackButtonGuard";

let time = 1000;
let root = null;
let container = null;

function GuardHost(props) {
  useBackButtonGuard({
    isTimerOpen: false,
    onCloseTimer: undefined,
    isSessionExitPromptOpen: false,
    onCloseSessionExitPrompt: undefined,
    onRequestSessionExit: undefined,
    ...props,
  });
  return null;
}

function resetStore(screen = "home") {
  useAppStore.setState({
    screen,
    topicRecords: [],
    activeTopicId: null,
  });
}

// Simulates one hardware back press landing on the ROOT entry
// (all guard entries consumed by the burst).
function pressBrowserBack() {
  time += 250;
  vi.setSystemTime(time);
  window.dispatchEvent(new PopStateEvent("popstate", {
    state: { mirocardBackRoot: true },
  }));
}

// Simulates one back press landing on a guard entry (partial consumption).
function pressBrowserBackIntoGuard(seq) {
  time += 250;
  vi.setSystemTime(time);
  window.dispatchEvent(new PopStateEvent("popstate", {
    state: { mirocardBackGuard: true, guardSeq: seq },
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(time);
  window.history.replaceState(null, "", "/");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useBackButtonGuard", () => {
  it("keeps the app on home when browser back is pressed", () => {
    resetStore("home");

    act(() => { root.render(<GuardHost />); });
    act(() => { pressBrowserBack(); });

    expect(useAppStore.getState().screen).toBe("home");
  });

  it("routes regular screens to their app-level parent", () => {
    resetStore("students");

    act(() => { root.render(<GuardHost />); });
    act(() => { pressBrowserBack(); });

    expect(useAppStore.getState().screen).toBe("home");
  });

  it("asks for confirmation before leaving an active session", () => {
    resetStore("session");
    const onRequestSessionExit = vi.fn();

    act(() => { root.render(<GuardHost onRequestSessionExit={onRequestSessionExit} />); });
    act(() => { pressBrowserBack(); });

    expect(useAppStore.getState().screen).toBe("session");
    expect(onRequestSessionExit).toHaveBeenCalledTimes(1);
  });

  it("installs a ROOT + GUARD_DEPTH history structure on app start", () => {
    resetStore("home");
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    act(() => { root.render(<GuardHost />); });

    // Should have set ROOT via replaceState and pushed GUARD_DEPTH guard entries
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mirocardBackRoot: true }),
      expect.anything(),
      expect.anything(),
    );
    expect(pushSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(window.history.state).toEqual(
      expect.objectContaining({ mirocardBackGuard: true }),
    );

    // Back press should be handled correctly
    act(() => { pressBrowserBack(); });
    expect(useAppStore.getState().screen).toBe("home");
  });

  it("re-establishes guard synchronously on each back press", () => {
    resetStore("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => { root.render(<GuardHost />); });
    const countAfterInstall = pushSpy.mock.calls.length;

    act(() => { pressBrowserBack(); });

    // GUARD_DEPTH new entries must be pushed after each back press
    expect(pushSpy.mock.calls.length - countAfterInstall).toBeGreaterThanOrEqual(5);
    expect(window.history.state).toEqual(
      expect.objectContaining({ mirocardBackGuard: true }),
    );
  });

  it("handles a back press that lands on a guard entry (rapid burst)", () => {
    resetStore("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => { root.render(<GuardHost />); });
    const countAfterInstall = pushSpy.mock.calls.length;

    // Simulate rapid press that only consumed 2 of 5 guard entries
    act(() => { pressBrowserBackIntoGuard(3); }); // landed on seq=3 (was at seq=5)

    // Guard must be replenished
    expect(pushSpy.mock.calls.length).toBeGreaterThan(countAfterInstall);
    expect(useAppStore.getState().screen).toBe("home");
  });

  it("adds a native unload fallback only during active sessions", () => {
    resetStore("session");

    act(() => { root.render(<GuardHost />); });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("does not block unload outside of session", () => {
    resetStore("home");

    act(() => { root.render(<GuardHost />); });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("closes the timer before app navigation", () => {
    resetStore("students");
    const onCloseTimer = vi.fn();

    act(() => { root.render(<GuardHost isTimerOpen onCloseTimer={onCloseTimer} />); });
    act(() => { pressBrowserBack(); });

    expect(useAppStore.getState().screen).toBe("students");
    expect(onCloseTimer).toHaveBeenCalledTimes(1);
  });

  it("closes the exit prompt when back is pressed while prompt is open", () => {
    resetStore("session");
    const onCloseSessionExitPrompt = vi.fn();

    act(() => { root.render(<GuardHost isSessionExitPromptOpen onCloseSessionExitPrompt={onCloseSessionExitPrompt} />); });
    act(() => { pressBrowserBack(); });

    expect(onCloseSessionExitPrompt).toHaveBeenCalledTimes(1);
  });

  it("re-establishes guard even when back press is debounced", () => {
    resetStore("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => { root.render(<GuardHost />); });

    // First press
    act(() => { pressBrowserBack(); });
    const countAfterFirst = pushSpy.mock.calls.length;

    // Second press within 180 ms — debounced, but guard must still be re-pushed
    time += 50;
    vi.setSystemTime(time);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { mirocardBackRoot: true } }));
    });

    expect(pushSpy.mock.calls.length).toBeGreaterThan(countAfterFirst);
    expect(window.history.state).toEqual(
      expect.objectContaining({ mirocardBackGuard: true }),
    );
  });
});
