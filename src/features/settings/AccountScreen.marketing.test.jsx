import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import AccountScreen from "./AccountScreen.jsx";

describe("AccountScreen — news emails toggle", () => {
  let container = null, root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    useAppStore.setState({ account: null });
    vi.restoreAllMocks();
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<AccountScreen />); });
  }

  it("reflects the current consent and saves a change with source 'settings'", async () => {
    useAppStore.setState({ account: { id: "a1", email: "x@example.test", marketingOptIn: false, marketingPromptAnswered: true } });
    const patch = vi.spyOn(apiModule.api, "patch").mockResolvedValue({
      account: { id: "a1", email: "x@example.test", marketingOptIn: true, marketingPromptAnswered: true },
    });
    mount();
    const toggle = container.querySelector("input[name=marketingOptIn]");
    expect(toggle.checked).toBe(false);
    await act(async () => { toggle.click(); });
    expect(patch).toHaveBeenCalledWith("/account/marketing", { optIn: true, source: "settings" });
    expect(container.querySelector("input[name=marketingOptIn]").checked).toBe(true);
  });
});
