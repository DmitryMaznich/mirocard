import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import * as apiModule from "@/core/api";
import ForgotPasswordScreen from "./ForgotPasswordScreen.jsx";

describe("ForgotPasswordScreen", () => {
  let container = null, root = null;

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
    act(() => { root.render(<ForgotPasswordScreen />); });
  }

  async function submit(email) {
    const input = container.querySelector("input[type=email]");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    await act(async () => {
      setter.call(input, email);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
  }

  it("shows the neutral 'if registered, we sent a link' message on success", async () => {
    vi.spyOn(apiModule.api, "post").mockResolvedValue({ ok: true });
    mount();
    await submit("a@example.test");
    expect(container.textContent).toMatch(/Если такой email зарегистрирован/);
  });

  it("says try tomorrow instead of pretending a mail was sent when the budget is spent", async () => {
    vi.spyOn(apiModule.api, "post").mockRejectedValue(new apiModule.ApiError("email_budget_exhausted", 503));
    mount();
    await submit("a@example.test");
    expect(container.textContent).toMatch(/завтра/);
    expect(container.textContent).not.toMatch(/Если такой email зарегистрирован/);
  });
});
