import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { useBackButtonGuard } from "./useBackButtonGuard";

let root;
let container;

function GuardHost(props) {
  const screen = useAppStore((state) => state.screen);
  useBackButtonGuard({
    screen,
    isTimerOpen: false,
    onCloseTimer: undefined,
    isSessionExitPromptOpen: false,
    onCloseSessionExitPrompt: undefined,
    onRequestSessionExit: undefined,
    ...props,
  });
  return null;
}

async function travel(method = "back") {
  await act(async () => {
    window.history[method]();
    // jsdom dispatches popstate on a later task, as real browsers do.
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

function goTo(screen) {
  act(() => useAppStore.getState().setScreen(screen));
}

beforeEach(() => {
  window.history.pushState(null, "", "/");
  useAppStore.setState({ screen: "boot", topicRecords: [], activeTopicId: null });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe("useBackButtonGuard", () => {
  it("replaces boot instead of leaving it in the Back stack", async () => {
    act(() => root.render(<GuardHost />));
    goTo("home");

    expect(window.history.state).toEqual(expect.objectContaining({ screen: "home", index: 0 }));
    const pushSpy = vi.spyOn(window.history, "pushState");
    await travel();

    expect(useAppStore.getState().screen).toBe("home");
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("navigates through real screen entries with Back and Forward", async () => {
    act(() => root.render(<GuardHost />));
    goTo("home");
    goTo("students");
    goTo("student_edit");

    expect(window.history.state).toEqual(expect.objectContaining({ screen: "student_edit", index: 2 }));
    await travel();
    expect(useAppStore.getState().screen).toBe("students");
    await travel();
    expect(useAppStore.getState().screen).toBe("home");
    await travel("forward");
    expect(useAppStore.getState().screen).toBe("students");
  });

  it("uses an earlier history entry when the in-app Back button changes screen", async () => {
    act(() => root.render(<GuardHost />));
    goTo("home");
    goTo("students");
    goTo("student_edit");
    goTo("students");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(window.history.state).toEqual(expect.objectContaining({ screen: "students", index: 1 }));
    expect(useAppStore.getState().screen).toBe("students");
    await travel();
    expect(useAppStore.getState().screen).toBe("home");
  });

  it("closes a timer before changing screens", async () => {
    const onCloseTimer = vi.fn();
    act(() => root.render(<GuardHost isTimerOpen onCloseTimer={onCloseTimer} />));
    goTo("home");
    goTo("students");

    await travel();
    expect(onCloseTimer).toHaveBeenCalledOnce();
    expect(useAppStore.getState().screen).toBe("students");
    expect(window.history.state).toEqual(expect.objectContaining({ screen: "students", index: 1 }));
  });

  it("asks before leaving a session and never restores it after completion", async () => {
    const onRequestSessionExit = vi.fn();
    act(() => root.render(<GuardHost onRequestSessionExit={onRequestSessionExit} />));
    goTo("home");
    goTo("params");
    goTo("session");

    await travel();
    expect(onRequestSessionExit).toHaveBeenCalledOnce();
    expect(useAppStore.getState().screen).toBe("session");

    goTo("home");
    expect(window.history.state).toEqual(expect.objectContaining({ screen: "home" }));
    await travel("forward");
    expect(useAppStore.getState().screen).toBe("home");
  });

  it("creates a Back destination for a restored session on first interaction", async () => {
    const onRequestSessionExit = vi.fn();
    act(() => root.render(<GuardHost onRequestSessionExit={onRequestSessionExit} />));
    goTo("session");
    expect(window.history.state).toEqual(expect.objectContaining({ screen: "session", index: 0 }));

    act(() => window.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(window.history.state).toEqual(expect.objectContaining({ screen: "session", index: 1 }));
    await travel();
    expect(onRequestSessionExit).toHaveBeenCalledOnce();
    expect(useAppStore.getState().screen).toBe("session");
  });

  it("does not restore authenticated screens after sign-out", async () => {
    act(() => root.render(<GuardHost />));
    goTo("home");
    goTo("students");
    goTo("login");
    await travel();
    expect(useAppStore.getState().screen).toBe("login");
  });

  it("handles iOS swipe history with the same screen stack", async () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", configurable: true,
    });
    try {
      act(() => root.render(<GuardHost />));
      goTo("home");
      goTo("students");
      await travel();
      expect(useAppStore.getState().screen).toBe("home");
    } finally {
      if (original) Object.defineProperty(window.navigator, "userAgent", original);
    }
  });
});
