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
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      root.render(<GuardHost />);
    });
    pushSpy.mockClear();

    act(() => {
      pressBrowserBack();
    });

    expect(useAppStore.getState().screen).toBe("home");
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mirocardBackGuard: true }),
      "",
      window.location.href,
    );
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

  it("rebuilds the guard stack when the app starts on a stale guard entry", () => {
    resetStore("home");
    window.history.replaceState(
      { mirocardBackGuard: true, guardSequence: 42 },
      "",
      "/#_guard",
    );

    act(() => {
      root.render(<GuardHost />);
    });

    expect(window.location.hash).toBe("#_guard");
    expect(window.history.state).toEqual(
      expect.objectContaining({
        mirocardBackGuard: true,
        guardSequence: expect.any(Number),
      }),
    );
    expect(window.history.state.guardSequence).toBeGreaterThan(42);

    act(() => {
      pressBrowserBack();
    });

    expect(useAppStore.getState().screen).toBe("home");
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
});
