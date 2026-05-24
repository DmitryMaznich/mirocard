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
      expect.stringMatching(/#_guard_\d+$/),
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
