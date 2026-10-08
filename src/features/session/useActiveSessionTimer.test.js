import { test, expect, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useActiveSessionTimer } from "./useActiveSessionTimer";
test("active timer caps idle and resets for the next session", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let read;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Timer({ id }) {
    read = useActiveSessionTimer(true, id).getActiveDurationMs;
    return null;
  }
  try {
    await act(async () => root.render(createElement(Timer, { id: "first" })));
    await act(async () => vi.advanceTimersByTime(75000));
    expect(read()).toBe(60000);
    await act(async () => root.render(createElement(Timer, { id: "second" })));
    expect(read()).toBe(0);
    await act(async () => vi.advanceTimersByTime(10000));
    expect(read()).toBe(10000);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  }
});
