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
    useAppStore.setState({ pendingCheckoutPlan: "annual", subscription: null, setScreen: vi.fn() });
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

  it("shows no current-plan banner when there is no subscription", () => {
    mount();
    expect(container.querySelector(".subscription-status")).toBeFalsy();
  });

  it("shows the current plan and its expiry when a subscription is active", () => {
    useAppStore.setState({
      subscription: { plan: "trial", status: "active", currentPeriodEnd: "2026-09-24T14:42:49.495Z" },
    });
    mount();
    const value = container.querySelector(".subscription-status__value");
    expect(value.textContent).toBe("Пробный период · до 24 сентября 2026 г.");
  });

  it("switching consent language to Slovenian shows Slovenian text and /sl links, and clears ticked boxes", () => {
    mount();
    const boxes = () => Array.from(container.querySelectorAll(".subscription-consent input"));
    act(() => { boxes()[0].click(); });
    expect(boxes()[0].checked).toBe(true);

    const slBtn = Array.from(container.querySelectorAll(".consent-lang__btn")).find((b) => b.textContent === "Slovenščina");
    act(() => { slBtn.click(); });

    const consents = container.querySelector(".subscription-consents");
    expect(consents.getAttribute("lang")).toBe("sl");
    expect(consents.textContent).toContain("Sprejemam");
    expect(consents.textContent).toContain("izgubim pravico do odstopa");
    expect(consents.textContent).toContain("»Leto«");
    const hrefs = Array.from(consents.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/sl/terms", "/sl/refunds"]);
    expect(container.querySelector(".subscription-disclaimer").textContent).toContain("Enkratno plačilo");
    expect(boxes().every((b) => !b.checked)).toBe(true);
  });

  it("sends the chosen consent locale with checkout", async () => {
    const post = vi.spyOn(apiModule.api, "post").mockResolvedValue({ checkoutUrl: "https://checkout.example/x", orderId: "o1" });
    vi.spyOn(window, "open").mockReturnValue(null);
    useAppStore.setState({ setCheckout: vi.fn() });
    mount();
    const slBtn = Array.from(container.querySelectorAll(".consent-lang__btn")).find((b) => b.textContent === "Slovenščina");
    act(() => { slBtn.click(); });
    for (const box of container.querySelectorAll(".subscription-consent input")) act(() => { box.click(); });
    await act(async () => { container.querySelector(".subscription-cta").click(); });
    expect(post).toHaveBeenCalledWith("/billing/checkout", expect.objectContaining({ locale: "sl" }));
  });

  it("shows МИР / СБП as a disabled 'coming soon' option and keeps card selected", () => {
    mount();
    const chips = container.querySelectorAll(".pay-chip");
    const mir = Array.from(chips).find((c) => c.textContent.includes("МИР / СБП"));
    expect(mir.disabled).toBe(true);
    expect(mir.textContent).toContain("скоро");
    act(() => { mir.click(); });
    expect(container.querySelector(".pay-chip--selected").textContent).toBe("Картой");
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

  it("the CTA stays disabled until all three consents are checked", () => {
    mount();
    const cta = container.querySelector(".subscription-cta");
    expect(cta.disabled).toBe(true);
    for (const checkbox of container.querySelectorAll(".subscription-consent input")) {
      act(() => { checkbox.click(); });
    }
    expect(cta.disabled).toBe(false);
  });

  it("submitting calls checkout with the selected plan, method and consents, only once all three are checked", async () => {
    const postSpy = vi.spyOn(apiModule.api, "post").mockResolvedValue({ checkoutUrl: "https://pay.example/x", orderId: "o1" });
    mount();
    for (const checkbox of container.querySelectorAll(".subscription-consent input")) {
      act(() => { checkbox.click(); });
    }
    await act(async () => { container.querySelector(".subscription-cta").click(); await Promise.resolve(); });
    expect(postSpy).toHaveBeenCalledWith("/billing/checkout", {
      plan: "annual", method: "card", code: null,
      consents: { termsAccepted: true, pricePeriodConfirmed: true, digitalContentAck: true },
      locale: "ru",
    });
  });

  it("opens the checkout window synchronously (before the checkout API call resolves), then redirects it to the real URL -- the popup-blocker fix", async () => {
    let resolveApiCall;
    vi.spyOn(apiModule.api, "post").mockReturnValue(new Promise((resolve) => { resolveApiCall = resolve; }));
    const fakeWindow = { closed: false, location: {} };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow);

    mount();
    for (const checkbox of container.querySelectorAll(".subscription-consent input")) {
      act(() => { checkbox.click(); });
    }
    act(() => { container.querySelector(".subscription-cta").click(); });

    // window.open must already have happened -- synchronously, inside the
    // click -- even though the checkout API call hasn't resolved yet.
    expect(openSpy).toHaveBeenCalledWith("", "_blank", "noopener,noreferrer");
    expect(fakeWindow.location.href).toBeUndefined();

    await act(async () => {
      resolveApiCall({ checkoutUrl: "https://checkout.stripe.com/pay/cs_test", orderId: "o1" });
      await Promise.resolve();
    });
    expect(fakeWindow.location.href).toBe("https://checkout.stripe.com/pay/cs_test");
  });

  it("closes the opened window instead of leaving a stray blank tab if the checkout API call fails", async () => {
    vi.spyOn(apiModule.api, "post").mockRejectedValue(new Error("network error"));
    const fakeWindow = { closed: false, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow);

    mount();
    for (const checkbox of container.querySelectorAll(".subscription-consent input")) {
      act(() => { checkbox.click(); });
    }
    await act(async () => { container.querySelector(".subscription-cta").click(); await Promise.resolve(); });
    expect(fakeWindow.close).toHaveBeenCalled();
  });
});
