import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import TopicTile from "./TopicTile";

describe("preview tile uses existing download and access handlers", () => {
  let root, host;
  function mount(props) {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    act(() => root.render(<TopicTile presentation="catalog" title="Тестовая тема" category="Математика"
      onSelect={vi.fn()} onMenu={vi.fn()} {...props} />));
  }
  afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); vi.restoreAllMocks(); });

  it("downloads from the explicit arrow with real fractional progress", async () => {
    let finish, progress;
    const onInstall = vi.fn((entry, options) => {
      progress = options.onProgress;
      return new Promise((resolve) => { finish = resolve; });
    });
    mount({ entry: { id: "test", version: "1", access: "free" }, onInstall });
    await act(async () => host.querySelector(".topic-ui-get").click());
    expect(onInstall).toHaveBeenCalledTimes(1); // The download arrow is itself the consent.
    act(() => progress(.42));
    expect(host.querySelector('[role="progressbar"]').getAttribute("aria-valuenow")).toBe("42");
    expect(host.querySelector(".topic-ui-get").disabled).toBe(true);
    await act(async () => finish());
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
  });

  it("describes the topic in a sheet before adding it", async () => {
    const onInstall = vi.fn().mockResolvedValue(undefined);
    mount({ entry: { id: "test", version: "1", access: "free", description: "Длинное описание темы." }, onInstall });
    act(() => host.querySelector(".topic-ui-catalog-open").click());
    expect(host.querySelector('[role="dialog"]').textContent).toContain("Длинное описание темы.");
    expect(onInstall).not.toHaveBeenCalled();
    await act(async () => host.querySelector(".topic-ui-sheet-primary").click());
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("retains error recovery and indeterminate progress", async () => {
    let reject, progress;
    mount({ entry: { id: "test", version: "1" }, onInstall: (entry, options) => {
      progress = options.onProgress;
      return new Promise((resolve, fail) => { reject = fail; });
    } });
    await act(async () => host.querySelector(".topic-ui-get").click());
    act(() => progress(null));
    expect(host.querySelector('[role="progressbar"]').hasAttribute("aria-valuenow")).toBe(false);
    await act(async () => reject(new Error("Соединение потеряно")));
    expect(host.querySelector('[role="alert"]').textContent).toContain("Соединение потеряно");
    expect(host.querySelector(".topic-ui-download-error button").disabled).toBe(false);
  });

  it("opens an installed copy from the row and updates only from the update button", async () => {
    const record = { meta: { id: "test", version: "1" } };
    const onSelect = vi.fn(); const onInstall = vi.fn().mockResolvedValue(record);
    mount({ installedRecord: record, entry: { id: "test", version: "2" }, onSelect, onInstall });
    act(() => host.querySelector(".topic-ui-catalog-open").click());
    await act(async () => host.querySelector(".topic-ui-get--update").click());
    expect(onInstall).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ force: true }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows the short description on a home tile and does not open an expired paid copy", () => {
    const onSelect = vi.fn(); const onLockedTap = vi.fn(); const onInstall = vi.fn();
    mount({ presentation: "installed", installedRecord: { meta: { id: "verbs_v2", version: "1" } },
      entitlementExpired: true, onSelect, onLockedTap, onInstall });
    expect(host.querySelector(".topic-ui-short").textContent).toContain("Действия на фото");
    act(() => host.querySelector(".topic-ui-topic-open").click());
    expect(onLockedTap).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onInstall).not.toHaveBeenCalled();
  });
});
