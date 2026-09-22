import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import CheckoutReturnScreen from "./CheckoutReturnScreen.jsx";

describe("CheckoutReturnScreen", () => {
  let container = null, root = null;

  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({ checkoutOrderId: "order-1", setScreen: vi.fn() });
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
    act(() => { root.render(<CheckoutReturnScreen />); });
  }

  it("shows the processing state while the order is still pending", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ status: "pending" });
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(".checkout-return__title").textContent).toBe("Обрабатываем оплату…");
  });

  it("polls /billing/order-status with the current checkoutOrderId, not /billing/subscription", async () => {
    const getSpy = vi.spyOn(apiModule.api, "get").mockResolvedValue({ status: "pending" });
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(getSpy).toHaveBeenCalledWith("/billing/order-status?orderId=order-1");
  });

  it("shows success once the order status is completed", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({
      status: "completed", plan: "annual", currentPeriodEnd: "2027-09-15T00:00:00.000Z",
    });
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(".checkout-return__title").textContent).toBe("Подписка активна!");
  });

  it("reads /billing/subscription once (not order-status) when there is no checkoutOrderId -- the promo free-grant path", async () => {
    useAppStore.setState({ checkoutOrderId: null });
    const getSpy = vi.spyOn(apiModule.api, "get").mockResolvedValue({
      status: "active", plan: "free_grant", currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    });
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(getSpy).toHaveBeenCalledWith("/billing/subscription");
    expect(container.querySelector(".checkout-return__title").textContent).toBe("Подписка активна!");
  });

  it("shows a failed state (not endless processing) when the order was refunded/abandoned, never claiming success", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ status: "abandoned" });
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(".checkout-return__title").textContent).toBe("Оплата не прошла");
    expect(container.querySelector(".checkout-return__title").textContent).not.toBe("Подписка активна!");
  });

  it("never shows success for a still-pending order even if the account happens to have some other active entitlement (the bug this replaces)", async () => {
    // order-status correctly reports "pending" for THIS order even though
    // the account might be otherwise entitled (trial, another
    // subscription) -- the old /billing/subscription-based poll would
    // have shown "Подписка активна!" here regardless.
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ status: "pending" });
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(".checkout-return__title").textContent).not.toBe("Подписка активна!");
  });

  it("times out after 20s of still-pending, offering retry/back/support instead of spinning forever", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ status: "pending" });
    mount();
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(21000);
    });
    expect(container.querySelector(".checkout-return__title").textContent).toMatch(/больше времени/);
    expect(container.querySelector(".checkout-return__support")).toBeTruthy();
    const buttons = Array.from(container.querySelectorAll(".checkout-return__actions button")).map((b) => b.textContent);
    expect(buttons).toContain("Проверить статус");
    expect(buttons).toContain("Вернуться");
  });

  it("\"Проверить статус\" re-polls and can resolve to success after a timeout", async () => {
    const getSpy = vi.spyOn(apiModule.api, "get").mockResolvedValue({ status: "pending" });
    mount();
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(21000); });
    expect(container.querySelector(".checkout-return__title").textContent).toMatch(/больше времени/);

    getSpy.mockResolvedValue({ status: "completed", plan: "monthly", currentPeriodEnd: "2027-01-01T00:00:00.000Z" });
    const retryButton = Array.from(container.querySelectorAll(".checkout-return__actions button"))
      .find((b) => b.textContent === "Проверить статус");
    await act(async () => { retryButton.click(); await Promise.resolve(); });
    expect(container.querySelector(".checkout-return__title").textContent).toBe("Подписка активна!");
  });

  it("\"Вернуться\"/\"Попробовать снова\" navigates back to the subscription screen", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ status: "abandoned" });
    mount();
    await act(async () => { await Promise.resolve(); });
    const backButton = Array.from(container.querySelectorAll(".checkout-return__actions button"))
      .find((b) => b.textContent === "Попробовать снова");
    act(() => { backButton.click(); });
    expect(useAppStore.getState().setScreen).toHaveBeenCalledWith("subscription");
  });
});
