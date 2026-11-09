import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import TopicTile from "./TopicTile";

describe("preview tile uses existing download and access handlers", () => {
  let root, host;
  function mount(props) {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root.render(<TopicTile presentation="catalog" title="Тестовая тема" category="Математика"
      onSelect={vi.fn()} onMenu={vi.fn()} onPreviewInfo={vi.fn()} {...props} />));
  }
  afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); vi.restoreAllMocks(); });

  it("shows real fractional progress and opens only after a successful install", async () => {
    let finish, progress;
    const onInstall = vi.fn((entry, options) => {
      progress = options.onProgress;
      return new Promise((resolve) => { finish = resolve; });
    });
    mount({ entry: { id: "test", version: "1", access: "free" }, onInstall });
    act(() => host.querySelector(".topic-ui-primary").click());
    expect(onInstall).not.toHaveBeenCalled(); // Existing confirmation is preserved.
    await act(async () => host.querySelector(".btn-primary").click());
    act(() => progress(.42));
    expect(host.querySelector('[role="progressbar"]').getAttribute("aria-valuenow")).toBe("42");
    expect(host.querySelector(".topic-ui-primary").disabled).toBe(true);
    await act(async () => finish());
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("retains error recovery and indeterminate progress", async () => {
    let reject, progress;
    mount({ entry: { id: "test", version: "1" }, onInstall: (entry, options) => {
      progress = options.onProgress;
      return new Promise((resolve, fail) => { reject = fail; });
    } });
    act(() => host.querySelector(".topic-ui-primary").click());
    await act(async () => host.querySelector(".btn-primary").click());
    act(() => progress(null));
    expect(host.querySelector('[role="progressbar"]').hasAttribute("aria-valuenow")).toBe(false);
    await act(async () => reject(new Error("Соединение потеряно")));
    expect(host.querySelector('[role="alert"]').textContent).toContain("Соединение потеряно");
    expect(host.querySelector(".topic-ui-download-error button").disabled).toBe(false);
  });

  it("opens the installed copy separately from updating it", async () => {
    const record = { meta: { id: "test", version: "1" } };
    const onSelect = vi.fn(); const onInstall = vi.fn().mockResolvedValue(record);
    mount({ installedRecord: record, entry: { id: "test", version: "2" }, onSelect, onInstall });
    expect(host.querySelector(".topic-ui-primary").textContent).toContain("2");
    act(() => host.querySelectorAll(".topic-ui-details")[1].click());
    expect(onSelect).toHaveBeenCalledWith(record);
    expect(onInstall).not.toHaveBeenCalled();
    await act(async () => host.querySelector(".topic-ui-primary").click());
    expect(onInstall).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ force: true }));
  });

  it("does not open an expired paid copy from a home card", () => {
    const onSelect = vi.fn(); const onLockedTap = vi.fn(); const onInstall = vi.fn();
    mount({ presentation: "installed", installedRecord: { meta: { id: "test", version: "1" } },
      entitlementExpired: true, onSelect, onLockedTap, onInstall });
    act(() => host.querySelector(".topic-ui-topic-open").click());
    expect(onLockedTap).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onInstall).not.toHaveBeenCalled();
  });
});
