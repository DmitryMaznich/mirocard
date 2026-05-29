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

// Simulates one hardware back press: user moves from GUARD to ROOT.
function pressBrowserBack() {
  time += 250;
  vi.setSystemTime(time);
  window.dispatchEvent(new PopStateEvent("popstate", {
    state: { mirocardBackRoot: true },
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

    act(() => {
      root.render(<GuardHost />);
    });

    act(() => {
      pressBrowserBack();
    });

    expect(useAppStore.getState().screen).toBe("home");
  });

  it("routes regular screens to their app-level parent", () => {
    resetStore("students");

    act(() => {
      root.render(<GuardHost />);
    });
    act(() => {
      pressBrowserBack();
    });

    expect(useAppStore.getState().screen).toBe("home");
  });

  it("asks for confirmation before leaving an active session", () => {
    resetStore("session");
    const onRequestSessionExit = vi.fn();

    act(() => {
      root.render(<GuardHost onRequestSessionExit={onRequestSessionExit} />);
    });
    act(() => {
      pressBrowserBack();
    });

    expect(useAppStore.getState().screen).toBe("session");
    expect(onRequestSessionExit).toHaveBeenCalledTimes(1);
  });

  it("installs a root+guard history structure on app start", () => {
    resetStore("home");
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    act(() => {
      root.render(<GuardHost />);
    });

    // Should have replaced current entry with ROOT and pushed one GUARD
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mirocardBackRoot: true }),
      expect.anything(),
      expect.anything(),
    );
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mirocardBackGuard: true }),
      expect.anything(),
      expect.anything(),
    );
    expect(window.history.state).toEqual(
      expect.objectContaining({ mirocardBackGuard: true }),
    );

    // Back press should still be handled correctly
    act(() => {
      pressBrowserBack();
    });
    expect(useAppStore.getState().screen).toBe("home");
  });

  it("re-establishes guard synchronously on each back press", () => {
    resetStore("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      root.render(<GuardHost />);
    });

    const countAfterInstall = pushSpy.mock.calls.length;

    act(() => {
      pressBrowserBack();
    });

    // Guard must be re-pushed after handling the back press
    expect(pushSpy.mock.calls.length).toBeGreaterThan(countAfterInstall);
    expect(window.history.state).toEqual(
      expect.objectContaining({ mirocardBackGuard: true }),
    );
  });

  it("adds a native unload fallback only during active sessions", () => {
    resetStore("session");

    act(() => {
      root.render(<GuardHost />);
    });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("does not block unload outside of session", () => {
    resetStore("home");

    act(() => {
      root.render(<GuardHost />);
    });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("closes the timer before app navigation", () => {
    resetStore("students");
    const onCloseTimer = vi.fn();

    act(() => {
      root.render(<GuardHost isTimerOpen onCloseTimer={onCloseTimer} />);
    });
    act(() => {
      pressBrowserBack();
    });

    expect(useAppStore.getState().screen).toBe("students");
    expect(onCloseTimer).toHaveBeenCalledTimes(1);
  });

  it("closes the exit prompt when back is pressed while prompt is open", () => {
    resetStore("session");
    const onCloseSessionExitPrompt = vi.fn();

    act(() => {
      root.render(<GuardHost isSessionExitPromptOpen onCloseSessionExitPrompt={onCloseSessionExitPrompt} />);
    });
    act(() => {
      pressBrowserBack();
    });

    expect(onCloseSessionExitPrompt).toHaveBeenCalledTimes(1);
  });

  it("re-establishes guard even when back press is debounced", () => {
    resetStore("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      root.render(<GuardHost />);
    });

    // First press (not debounced)
    act(() => {
      pressBrowserBack();
    });

    const countAfterFirst = pushSpy.mock.calls.length;

    // Second press within 180ms — debounced, but guard must still be re-pushed
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
