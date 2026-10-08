import { test, expect, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import "fake-indexeddb/auto";
import { useUsageTracking } from "./useUsageTracking";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { api } from "@/core/api";
vi.mock("@/core/api", () => ({
  api: { post: vi.fn(async () => ({ ok: true })) },
}));
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
test("persistent login records and sends time and topic changes without logout or reload", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date());
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const visible = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("syncQueue", "readwrite");
    tx.objectStore("syncQueue").clear();
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
  useAppStore.setState({
    token: "test-token",
    account: { id: "persistent" },
    screen: "home",
    homeActiveTab: "session",
    activeTopicId: "first",
  });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  function Collector() {
    useUsageTracking();
    return null;
  }
  try {
    await act(async () => root.render(createElement(Collector)));
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(11000);
      await settle();
    });
    await act(async () => useAppStore.getState().setActiveTopicId("second"));
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(11000);
      await settle();
    });
    const events = api.post.mock.calls
      .filter(([path]) => path === "/sync")
      .flatMap(([, body]) => body.operations)
      .filter((op) => op.type === "usage.append")
      .map((op) => op.data);
    expect(
      events.filter((e) => e.kind === "topic_open").map((e) => e.topicId),
    ).toContain("second");
    expect(
      events.filter((e) => e.kind === "time" && e.topicId === "first").length,
    ).toBeGreaterThan(0);
    expect(
      events.filter((e) => e.kind === "time" && e.topicId === "second").length,
    ).toBeGreaterThan(0);
    expect(useAppStore.getState().token).toBe("test-token");
  } finally {
    await act(async () => root.unmount());
    await settle();
    node.remove();
    visible.mockRestore();
    vi.useRealTimers();
    useAppStore.setState({ token: null, account: null });
  }
});
