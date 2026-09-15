import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import CheckoutReturnScreen from "./CheckoutReturnScreen.jsx";

describe("CheckoutReturnScreen", () => {
  let container = null, root = null;

  beforeEach(() => { vi.useFakeTimers(); });
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

  it("shows the processing state while polling finds no active subscription yet", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue(null);
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(".checkout-return__title").textContent).toBe("Обрабатываем оплату…");
  });

  it("shows success once polling finds an active subscription", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ plan: "annual", status: "active", currentPeriodEnd: "2027-09-15T00:00:00.000Z" });
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(".checkout-return__title").textContent).toBe("Подписка активна!");
  });
});
