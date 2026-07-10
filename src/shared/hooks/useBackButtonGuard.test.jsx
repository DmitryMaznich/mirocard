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
    screen: "home",
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

describe("useBackButtonGuard on iOS", () => {
  const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");

  function mockIos() {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      configurable: true,
    });
  }

  afterEach(() => {
    if (originalUserAgentDescriptor) {
      Object.defineProperty(window.navigator, "userAgent", originalUserAgentDescriptor);
    } else {
      delete window.navigator.userAgent;
    }
  });

  function dispatchPopState(state) {
    time += 250;
    vi.setSystemTime(time);
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  }

  it("pushes a real history entry for each forward screen change", () => {
    mockIos();
    resetStore("home");
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      root.render(<GuardHost screen="home" />);
    });
    pushSpy.mockClear();

    act(() => {
      root.render(<GuardHost screen="students" />);
    });

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mirocardIosNav: true, screen: "students" }),
      "",
      expect.any(String),
    );
  });

  it("restores the previous screen on a completed swipe-back", () => {
    mockIos();
    resetStore("home");

    act(() => {
      root.render(<GuardHost screen="home" />);
    });
    act(() => {
      root.render(<GuardHost screen="students" />);
    });

    act(() => {
      dispatchPopState({ mirocardIosNav: true, screen: "home", seq: 0 });
    });

    expect(useAppStore.getState().screen).toBe("home");
  });

  it("does nothing extra when swiping past the app's root", () => {
    mockIos();
    resetStore("home");

    act(() => {
      root.render(<GuardHost screen="home" />);
    });
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      dispatchPopState(null);
    });

    expect(pushSpy).not.toHaveBeenCalled();
    expect(useAppStore.getState().screen).toBe("home");
  });

  it("intercepts swipe-back during an active session with a confirmation prompt", () => {
    mockIos();
    resetStore("session");
    const onRequestSessionExit = vi.fn();

    act(() => {
      root.render(<GuardHost screen="session" onRequestSessionExit={onRequestSessionExit} />);
    });
    const pushSpy = vi.spyOn(window.history, "pushState");

    act(() => {
      dispatchPopState(null);
    });

    expect(useAppStore.getState().screen).toBe("session");
    expect(onRequestSessionExit).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({ mirocardIosNav: true, screen: "session" }),
      "",
      expect.any(String),
    );
  });

  it("closes an already-open session exit prompt on a second swipe-back", () => {
    mockIos();
    resetStore("session");
    const onCloseSessionExitPrompt = vi.fn();

    act(() => {
      root.render(
        <GuardHost
          screen="session"
          isSessionExitPromptOpen
          onCloseSessionExitPrompt={onCloseSessionExitPrompt}
        />,
      );
    });

    act(() => {
      dispatchPopState(null);
    });

    expect(onCloseSessionExitPrompt).toHaveBeenCalledTimes(1);
  });

  it("closes the timer before navigating, without changing screen", () => {
    mockIos();
    resetStore("students");
    const onCloseTimer = vi.fn();

    act(() => {
      root.render(<GuardHost screen="students" isTimerOpen onCloseTimer={onCloseTimer} />);
    });

    act(() => {
      dispatchPopState({ mirocardIosNav: true, screen: "home", seq: 0 });
    });

    expect(onCloseTimer).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().screen).toBe("students");
  });
});
