import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import MarketingPromptCard from "./MarketingPromptCard.jsx";

describe("MarketingPromptCard", () => {
  let container = null, root = null;
  const base = { id: "a1", email: "x@example.test", marketingOptIn: false };

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
    act(() => { root.render(<MarketingPromptCard />); });
  }

  it("renders for an account that has not answered", () => {
    useAppStore.setState({ account: { ...base, marketingPromptAnswered: false } });
    mount();
    expect(container.textContent).toMatch(/новых темах/);
  });

  it("renders nothing once answered", () => {
    useAppStore.setState({ account: { ...base, marketingPromptAnswered: true } });
    mount();
    expect(container.textContent).toBe("");
  });

  it("renders nothing for a cached account that predates the field", () => {
    useAppStore.setState({ account: { ...base } });
    mount();
    expect(container.textContent).toBe("");
  });

  it("renders nothing in local mode (no account id)", () => {
    useAppStore.setState({ account: { email: "local", displayName: "Локальный режим" } });
    mount();
    expect(container.textContent).toBe("");
  });

  it("'Да' sends optIn true with source prompt and hides the card", async () => {
    useAppStore.setState({ account: { ...base, marketingPromptAnswered: false } });
    const patch = vi.spyOn(apiModule.api, "patch").mockResolvedValue({
      account: { ...base, marketingOptIn: true, marketingPromptAnswered: true },
    });
    mount();
    await act(async () => { container.querySelector("button[data-answer=yes]").click(); });
    expect(patch).toHaveBeenCalledWith("/account/marketing", { optIn: true, source: "prompt" });
    expect(container.textContent).toBe("");
  });

  it("closing with ✕ counts as 'no'", async () => {
    useAppStore.setState({ account: { ...base, marketingPromptAnswered: false } });
    const patch = vi.spyOn(apiModule.api, "patch").mockResolvedValue({
      account: { ...base, marketingPromptAnswered: true },
    });
    mount();
    await act(async () => { container.querySelector("button[aria-label=Закрыть]").click(); });
    expect(patch).toHaveBeenCalledWith("/account/marketing", { optIn: false, source: "prompt" });
    expect(container.textContent).toBe("");
  });

  it("stays visible and usable if saving fails (offline)", async () => {
    useAppStore.setState({ account: { ...base, marketingPromptAnswered: false } });
    vi.spyOn(apiModule.api, "patch").mockRejectedValue(new Error("offline"));
    mount();
    await act(async () => { container.querySelector("button[data-answer=no]").click(); });
    expect(container.textContent).toMatch(/новых темах/);
    expect(container.querySelector("button[data-answer=yes]").disabled).toBe(false);
  });
});
