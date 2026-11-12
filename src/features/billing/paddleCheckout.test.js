import { describe, it, expect, afterEach, vi } from "vitest";
import { openPaddleCheckout, paddleLocale, resetPaddleForTests } from "./paddleCheckout";

describe("paddleCheckout", () => {
  afterEach(() => { delete window.Paddle; resetPaddleForTests(); });

  it("speaks Russian, else English", () => {
    expect(paddleLocale("ru")).toBe("ru");
    expect(paddleLocale("sl")).toBe("en");
  });

  it("initializes Paddle once (sandbox) and routes events to the open checkout", async () => {
    const Paddle = { Environment: { set: vi.fn() }, Initialize: vi.fn(), Checkout: { open: vi.fn(), close: vi.fn() } };
    window.Paddle = Paddle;
    const first = vi.fn();
    const second = vi.fn();
    await openPaddleCheckout({ clientToken: "test_tok", environment: "sandbox", transactionId: "txn_1", email: "a@b.c", uiLanguage: "ru", onEvent: first });
    await openPaddleCheckout({ clientToken: "test_tok", environment: "sandbox", transactionId: "txn_2", uiLanguage: "ru", onEvent: second });
    expect(Paddle.Environment.set).toHaveBeenCalledWith("sandbox");
    expect(Paddle.Initialize).toHaveBeenCalledTimes(1);
    expect(Paddle.Checkout.open).toHaveBeenLastCalledWith({
      transactionId: "txn_2",
      settings: { displayMode: "overlay", theme: "light", locale: "ru", allowLogout: false },
    });
    expect(Paddle.Checkout.open.mock.calls[0][0].customer).toEqual({ email: "a@b.c" });
    Paddle.Initialize.mock.calls[0][0].eventCallback({ name: "checkout.completed" });
    expect(second).toHaveBeenCalledWith({ name: "checkout.completed" });
    expect(first).not.toHaveBeenCalled();
  });
});
