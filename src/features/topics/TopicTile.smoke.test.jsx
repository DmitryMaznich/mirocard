import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import TopicTile from "./TopicTile.jsx";

// Mounts the real component -- TopicTile is pure props-in, no store/db
// dependency, so this doesn't need any of the mocking other feature smoke
// tests in this app require.

const BASE_PROPS = {
  title: "Прописи",
  category: "Чтение",
  onInstall: vi.fn(),
  onSelect: vi.fn(),
};

describe("TopicTile — mounted through the real component", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.clearAllMocks();
  });

  function mount(props) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<TopicTile {...BASE_PROPS} {...props} />);
    });
  }

  it("not-yet-installed, free: shows a download badge and installs on tap", async () => {
    const onInstall = vi.fn().mockResolvedValue(undefined);
    mount({ entry: { id: "propis", version: "1.0.0" }, installedRecord: null, onInstall });
    expect(container.querySelector(".topic-tile-row__badge--get")).toBeTruthy();
    await act(async () => {
      container.querySelector("article").click();
    });
    expect(onInstall).toHaveBeenCalledWith({ id: "propis", version: "1.0.0" }, { force: false });
  });

  it("installed, not active: shows a checkmark badge and opens on tap", () => {
    const onSelect = vi.fn();
    const record = { meta: { id: "propis", version: "1.0.0" } };
    mount({ installedRecord: record, isActive: false, onSelect });
    expect(container.querySelector(".topic-tile-row__badge--done")).toBeTruthy();
    act(() => { container.querySelector("article").click(); });
    expect(onSelect).toHaveBeenCalledWith(record);
  });

  it("update available: tile still opens, badge specifically re-installs", async () => {
    const onInstall = vi.fn().mockResolvedValue(undefined);
    const onSelect = vi.fn();
    const record = { meta: { id: "propis", version: "1.0.0" } };
    mount({ installedRecord: record, entry: { id: "propis", version: "1.1.0" }, onInstall, onSelect });
    expect(container.querySelector(".topic-tile-row__badge--get")).toBeTruthy();
    act(() => { container.querySelector("article").click(); });
    expect(onSelect).toHaveBeenCalledWith(record);
    await act(async () => {
      container.querySelector(".topic-tile-row__badge").click();
    });
    expect(onInstall).toHaveBeenCalledWith({ id: "propis", version: "1.1.0" }, { force: true });
  });

  it("paid tier, no access yet: badge is enabled and requests access on tap", async () => {
    const onInstall = vi.fn().mockResolvedValue(undefined);
    mount({ entry: { id: "propis", version: "1.0.0" }, access: "paid", claimSource: null, onInstall });
    const badge = container.querySelector(".topic-tile-row__badge");
    expect(badge.disabled).toBe(false);
    await act(async () => { badge.click(); });
    expect(onInstall).toHaveBeenCalled();
  });

  it("request already sent: badge is disabled and does nothing on tap", () => {
    const onInstall = vi.fn();
    mount({ entry: { id: "propis", version: "1.0.0" }, access: "paid", claimSource: "request", onInstall });
    const badge = container.querySelector(".topic-tile-row__badge");
    expect(badge.disabled).toBe(true);
    act(() => { badge.click(); });
    expect(onInstall).not.toHaveBeenCalled();
  });

  it("shows the menu trigger only for an installed, non-builtin topic", () => {
    const onMenu = vi.fn();
    mount({ installedRecord: { meta: { id: "propis", version: "1.0.0" } }, onMenu });
    const more = container.querySelector(".topic-tile-row__more");
    expect(more).toBeTruthy();
    act(() => { more.click(); });
    expect(onMenu).toHaveBeenCalled();
  });

  it("shows the info trigger, not the menu trigger, for a builtin topic", () => {
    const onMenu = vi.fn();
    const onInfo = vi.fn();
    mount({ installedRecord: { meta: { id: "math_houses", version: "1.0.0", builtin: true } }, onMenu, onInfo });
    expect(container.querySelector(".topic-tile-row__more").textContent).toBe("i");
    act(() => { container.querySelector(".topic-tile-row__more").click(); });
    expect(onInfo).toHaveBeenCalled();
    expect(onMenu).not.toHaveBeenCalled();
  });

  it("hides the menu/info trigger for a not-yet-installed topic", () => {
    mount({ entry: { id: "propis", version: "1.0.0" }, installedRecord: null, onMenu: vi.fn(), onInfo: vi.fn() });
    expect(container.querySelector(".topic-tile-row__more")).toBeFalsy();
  });

  it("renders the version eyebrow and a beta tag when the entry carries one", () => {
    mount({ entry: { id: "propis", version: "1.0.0", status: "beta" } });
    expect(container.querySelector(".topic-tile-row__eyebrow").textContent).toContain("v1.0.0");
    const tag = container.querySelector(".topic-tile-row__tag--beta");
    expect(tag?.textContent).toBe("БЕТА");
  });
});
