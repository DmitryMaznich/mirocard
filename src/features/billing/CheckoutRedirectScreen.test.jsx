import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import CheckoutRedirectScreen from "./CheckoutRedirectScreen.jsx";

describe("CheckoutRedirectScreen", () => {
  let container = null, root = null;

  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({ checkoutUrl: "https://checkout.stripe.com/pay/cs_test", setScreen: vi.fn() });
  });
  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CheckoutRedirectScreen />); });
  }

  it("shows an explicit fallback button to open the checkout URL manually", () => {
    mount();
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Открыть оплату");
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(false);
  });

  it("the fallback button opens the checkout URL directly in a new tab on click (a fresh user gesture)", () => {
    mount();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => {});
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Открыть оплату");
    act(() => { button.click(); });
    expect(openSpy).toHaveBeenCalledWith("https://checkout.stripe.com/pay/cs_test", "_blank", "noopener,noreferrer");
  });

  it("the fallback button is disabled if there's no checkoutUrl at all", () => {
    useAppStore.setState({ checkoutUrl: null });
    mount();
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Открыть оплату");
    expect(button.disabled).toBe(true);
  });

  it("auto-advances to the checkout_return screen after a brief delay", async () => {
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(useAppStore.getState().setScreen).toHaveBeenCalledWith("checkout_return");
  });
});
