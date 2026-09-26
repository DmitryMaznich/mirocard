import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import * as apiModule from "@/core/api";
import LoginScreen from "./LoginScreen.jsx";

// Launch testing finding N9: work done in local mode silently vanishes after
// registering, so the entry point is hidden from ordinary visitors and kept
// only behind an explicit ?local=1 (owner/dev escape hatch).
describe("LoginScreen — local mode entry", () => {
  let container = null, root = null;
  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });
  async function mount() {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: true, google: null });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<LoginScreen />); });
    await act(async () => {});
  }

  it("is not offered to ordinary visitors", async () => {
    window.history.replaceState(null, "", "/");
    await mount();
    expect(container.textContent).not.toMatch(/Без аккаунта/);
  });

  it("is still reachable with ?local=1", async () => {
    window.history.replaceState(null, "", "/?local=1");
    await mount();
    expect(container.textContent).toMatch(/Без аккаунта/);
  });
});
