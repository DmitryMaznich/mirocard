import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import SubscriptionScreen from "./SubscriptionScreen.jsx";
import { subscriptionView } from "./PaddleSubscriptionScreen.jsx";

const paddle = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }));
vi.mock("./paddleCheckout", () => ({
  openPaddleCheckout: (...args) => paddle.open(...args),
  closePaddleCheckout: (...args) => paddle.close(...args),
}));

const PREVIEW = { id: "a1", email: "parent@example.test", featureFlags: ["billing_preview"] };
const future = (days) => new Date(Date.now() + days * 86400000).toISOString();

function provider(overrides = {}) {
  return { provider: "paddle", plan: "annual", status: "active", currentPeriodEnd: future(365), scheduledCancelAt: null, graceUntil: null, renews: true, ...overrides };
}

describe("subscriptionView", () => {
  it("picks the view from Paddle's state", () => {
    expect(subscriptionView(null)).toBe("plans");
    expect(subscriptionView({ plan: "trial" })).toBe("plans");
    expect(subscriptionView({ provider: provider() })).toBe("active");
    expect(subscriptionView({ provider: provider({ renews: false, scheduledCancelAt: future(30) }) })).toBe("canceled");
    expect(subscriptionView({ provider: provider({ status: "past_due", graceUntil: future(7) }) })).toBe("past_due");
    expect(subscriptionView({ provider: provider({ status: "canceled", renews: false }) })).toBe("plans");
  });
});

describe("PaddleSubscriptionScreen", () => {
  let container = null;
  let root = null;
  let setScreen;

  function mockApi({ subscription = null, paddleStatus = { enabled: true, environment: "sandbox" }, post = {} } = {}) {
    vi.spyOn(apiModule.api, "get").mockImplementation(async (path) => {
      if (path === "/auth/signup-status") return { paddle: paddleStatus };
      if (path === "/billing/subscription") return subscription;
      throw new Error(`unexpected GET ${path}`);
    });
    return vi.spyOn(apiModule.api, "post").mockImplementation(async (path, body) => {
      const handler = post[path];
      if (!handler) throw new Error(`unexpected POST ${path}`);
      return handler(body);
    });
  }

  async function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<SubscriptionScreen />));
    await act(async () => {});
  }

  beforeEach(() => {
    setScreen = vi.fn();
    paddle.open.mockReset();
    paddle.close.mockReset();
    useAppStore.setState({ account: PREVIEW, subscription: null, pendingCheckoutPlan: null, setScreen });
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.restoreAllMocks();
  });

  it("is shown only to billing-preview accounts", async () => {
    useAppStore.setState({ account: { ...PREVIEW, featureFlags: [] } });
    mockApi();
    await mount();
    expect(container.textContent).not.toContain("Оформить за");
  });

  it("offers three plans with the year chosen, and opens Paddle for a server-made transaction", async () => {
    const trial = { plan: "trial", status: "active", currentPeriodEnd: future(12) };
    useAppStore.setState({ subscription: trial });
    const post = mockApi({
      subscription: trial,
      post: { "/billing/paddle/checkout": () => ({ orderId: "ord-1", transactionId: "txn_1", email: "parent@example.test", clientToken: "test_tok", environment: "sandbox" }) },
    });
    await mount();

    expect(container.textContent).toContain("Пробный период до");
    expect(container.textContent).toContain("Тестовый режим Paddle");
    const plans = container.querySelectorAll(".plan");
    expect(plans).toHaveLength(3);
    expect(plans[0].getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector(".subscription-cta").textContent).toBe("Оформить за € 89,90 в год");

    act(() => plans[2].click());
    expect(container.querySelector(".subscription-cta").textContent).toBe("Оформить за € 9,90 в месяц");

    await act(async () => container.querySelector(".subscription-cta").click());
    expect(post).toHaveBeenCalledWith("/billing/paddle/checkout", { plan: "monthly" });
    expect(useAppStore.getState().checkoutOrderId).toBe("ord-1");
    expect(paddle.open).toHaveBeenCalledTimes(1);
    const args = paddle.open.mock.calls[0][0];
    expect(args).toMatchObject({ transactionId: "txn_1", clientToken: "test_tok", environment: "sandbox", email: "parent@example.test" });

    act(() => args.onEvent({ name: "checkout.completed" }));
    expect(paddle.close).toHaveBeenCalled();
    expect(setScreen).toHaveBeenCalledWith("checkout_return");
  });

  it("keeps the button off while Paddle checkout is not configured", async () => {
    mockApi({ paddleStatus: { enabled: false } });
    await mount();
    expect(container.querySelector(".subscription-cta").disabled).toBe(true);
    expect(container.textContent).toContain("Оплата сейчас недоступна");
  });

  it("says so when Paddle.js can't load", async () => {
    mockApi({ post: { "/billing/paddle/checkout": () => ({ orderId: "o", transactionId: "t", clientToken: "c", environment: "sandbox" }) } });
    paddle.open.mockRejectedValue(new Error("paddle_unavailable"));
    await mount();
    await act(async () => container.querySelector(".subscription-cta").click());
    expect(container.querySelector(".subscription-error").textContent).toContain("блокировщик рекламы");
  });

  it("an active subscription offers the portal rows", async () => {
    const sub = { plan: "annual", status: "active", currentPeriodEnd: future(365), provider: provider() };
    mockApi({ subscription: sub });
    await mount();
    expect(container.textContent).toContain("Активна");
    const rows = [...container.querySelectorAll(".subscription-manage__row")].map((r) => r.querySelector(".subscription-manage__label").textContent);
    expect(rows).toEqual(["Способ оплаты", "Сменить план", "Счета и чеки", "Отменить подписку"]);
    expect(container.querySelector(".plan")).toBe(null);
  });

  it("the portal link opens in the tab opened by the click", async () => {
    const sub = { plan: "annual", status: "active", currentPeriodEnd: future(365), provider: provider() };
    mockApi({ subscription: sub, post: { "/billing/portal": () => ({ overviewUrl: "https://portal/overview", cancelUrl: "https://portal/cancel", updatePaymentMethodUrl: "https://portal/card" }) } });
    const tab = { closed: false, opener: {}, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab);
    await mount();
    const cancelRow = [...container.querySelectorAll(".subscription-manage__row")][3];
    await act(async () => cancelRow.click());
    expect(window.open).toHaveBeenCalledWith("", "_blank");
    expect(tab.location.href).toBe("https://portal/cancel");
    expect(tab.opener).toBe(null);
  });

  it("a scheduled cancellation shows the end date and resumes", async () => {
    const end = future(40);
    const canceled = { plan: "annual", status: "active", currentPeriodEnd: end, provider: provider({ renews: false, scheduledCancelAt: end }) };
    const resumed = { ...canceled, provider: provider() };
    let current = canceled;
    vi.spyOn(apiModule.api, "get").mockImplementation(async (path) => (path === "/auth/signup-status" ? { paddle: { enabled: true } } : current));
    const post = vi.spyOn(apiModule.api, "post").mockImplementation(async () => { current = resumed; return resumed.provider; });
    await mount();
    expect(container.textContent).toContain("Отменена — доступ до");
    await act(async () => container.querySelector(".subscription-cta").click());
    expect(post).toHaveBeenCalledWith("/billing/resume", {});
    await act(async () => {});
    expect(container.textContent).toContain("Активна");
  });

  it("a failed renewal asks to update the card", async () => {
    const sub = { plan: "monthly", status: "active", currentPeriodEnd: future(7), provider: provider({ plan: "monthly", status: "past_due", graceUntil: future(7) }) };
    mockApi({ subscription: sub });
    await mount();
    expect(container.querySelector(".subscription-status--warn")).not.toBe(null);
    expect(container.textContent).toContain("Не удалось списать оплату");
    expect(container.querySelector(".subscription-cta").textContent).toBe("Обновить карту");
  });
});
