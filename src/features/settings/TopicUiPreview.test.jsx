import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SettingsScreen from "./SettingsScreen";
import { useAppStore } from "@/core/store";
import { readTopicUiPreview, writeTopicUiPreview, topicUiPreviewScope } from "@/core/topicUiPreview";

describe("hidden topic UI opt-in", () => {
  let root, host;
  const scope = "account:preview-owner";
  beforeEach(() => {
    writeTopicUiPreview(scope, false);
    useAppStore.setState({ account: { id: "preview-owner" }, token: "test", screen: "settings" });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    writeTopicUiPreview(scope, false);
    useAppStore.setState({ account: null, token: null });
  });
  const mount = () => act(async () => root.render(<SettingsScreen />));

  it("does not advertise the experiment to an ordinary settings visitor", async () => {
    await mount();
    expect(host.querySelector('[role="switch"]')).toBeNull();
    expect(host.textContent).not.toContain("Экспериментальный интерфейс");
    expect(readTopicUiPreview(scope)).toBe(false);
    act(() => { for (let i = 0; i < 6; i++) host.querySelector(".settings-build-info").click(); });
    expect(host.querySelector('[role="switch"]')).toBeNull();
    act(() => host.querySelector(".settings-build-info").click());
    expect(host.querySelector('[role="switch"]')?.checked).toBe(false);
  });

  it("can enable and roll back without changing lesson data or synced settings", async () => {
    const before = useAppStore.getState();
    const snapshot = { context: { studentId: "child", topicId: "topic", modeId: "mode" }, sessionState: { tasks: [1] } };
    useAppStore.setState({ activeSessionSnapshot: snapshot });
    await mount();
    act(() => { for (let i = 0; i < 7; i++) host.querySelector(".settings-build-info").click(); });
    act(() => host.querySelector('[role="switch"]').click());
    expect(readTopicUiPreview(scope)).toBe(true);
    expect(localStorage.getItem("mirocard.topic-ui-preview.v1:" + scope)).toBe("enabled");
    expect(useAppStore.getState().settings).toBe(before.settings);
    expect(useAppStore.getState().topicRecords).toBe(before.topicRecords);
    expect(useAppStore.getState().sessions).toBe(before.sessions);
    expect(useAppStore.getState().activeSessionSnapshot).toBe(snapshot);
    act(() => host.querySelector('[role="switch"]').click());
    expect(readTopicUiPreview(scope)).toBe(false);
    expect(localStorage.getItem("mirocard.topic-ui-preview.v1:" + scope)).toBeNull();
    expect(useAppStore.getState().activeSessionSnapshot).toBe(snapshot);
  });

  it("keeps rollback visible after reopening settings and isolates accounts", async () => {
    writeTopicUiPreview(scope, true);
    await mount();
    expect(host.querySelector('[role="switch"]')?.checked).toBe(true);
    act(() => useAppStore.setState({ account: { id: "different-account" } }));
    expect(host.querySelector('[role="switch"]')).toBeNull();
    expect(readTopicUiPreview("account:different-account")).toBe(false);
    expect(topicUiPreviewScope(null, "still-hydrating")).toBeNull();
    expect(readTopicUiPreview(null)).toBe(false);
  });

  it("keeps the switch mounted while disabling a saved opt-in", async () => {
    writeTopicUiPreview(scope, true);
    await mount();
    act(() => host.querySelector('[role="switch"]').click());
    expect(host.querySelector('[role="switch"]')?.checked).toBe(false);
    expect(readTopicUiPreview(scope)).toBe(false);
  });
});
