import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import SubscriptionScreen from "./SubscriptionScreen.jsx";

describe("SubscriptionScreen", () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    useAppStore.setState({ pendingCheckoutPlan: "annual", setScreen: vi.fn() });
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.restoreAllMocks();
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<SubscriptionScreen />); });
  }

  it("pre-selects the plan from pendingCheckoutPlan", () => {
    mount();
    const selected = container.querySelector(".plan--selected .plan__name");
    expect(selected.textContent).toBe("Год");
  });

  it("switching plan updates the CTA total", () => {
    mount();
    const monthlyRadio = container.querySelectorAll(".plan")[0];
    act(() => { monthlyRadio.click(); });
    const cta = container.querySelector(".subscription-cta");
    expect(cta.textContent).toContain("9,90");
  });

  it("applying a valid percent-off code updates the displayed price", async () => {
    vi.spyOn(apiModule.api, "post").mockImplementation(async (path) => {
      if (path === "/billing/validate-code") {
        return { ok: true, code: "TENOFF", kind: "percent_off", value: 10, originalAmountMinor: 8990, discountedAmountMinor: 8091 };
      }
      throw new Error(`unexpected path ${path}`);
    });
    mount();
    act(() => { container.querySelector(".promo-toggle").click(); });
    const input = container.querySelector(".promo-input");
    act(() => { input.value = "tenoff"; input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { container.querySelector(".promo-apply").click(); await Promise.resolve(); });
    const cta = container.querySelector(".subscription-cta");
    expect(cta.textContent).toContain("80,91");
  });

  it("submitting calls checkout with the selected plan and method", async () => {
    const postSpy = vi.spyOn(apiModule.api, "post").mockResolvedValue({ checkoutUrl: "https://pay.example/x", orderId: "o1" });
    mount();
    await act(async () => { container.querySelector(".subscription-cta").click(); await Promise.resolve(); });
    expect(postSpy).toHaveBeenCalledWith("/billing/checkout", { plan: "annual", method: "card", code: null });
  });
});
