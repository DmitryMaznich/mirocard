import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import * as apiModule from "@/core/api";
import RegisterScreen from "./RegisterScreen.jsx";

describe("RegisterScreen", () => {
  let container = null, root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.restoreAllMocks();
  });

  async function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<RegisterScreen />); });
    await act(async () => {});
  }

  it("shows the form when email signup is open", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: true, google: null });
    await mount();
    expect(container.querySelector("input[type=email]")).not.toBeNull();
  });

  it("hides the form and says come back tomorrow when the budget is spent", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: false, google: null });
    await mount();
    expect(container.querySelector("input[type=email]")).toBeNull();
    expect(container.textContent).toMatch(/приходите/);
  });

  it("points to Google when the budget is spent but Google is available", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: false, google: { clientId: "x" } });
    await mount();
    expect(container.textContent).toMatch(/через Google/);
  });

  it("news checkbox is unchecked by default and its value is sent with the signup", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: true, google: null });
    const post = vi.spyOn(apiModule.api, "post").mockResolvedValue({});
    await mount();
    const box = container.querySelector("input[name=marketingOptIn]");
    expect(box).not.toBeNull();
    expect(box.checked).toBe(false);

    const setInput = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const setSelect = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    await act(async () => {
      setInput(container.querySelector("input[type=email]"), "n@example.test");
      setInput(container.querySelector("input[placeholder='Имя *']"), "Нина");
      const [role, ref] = container.querySelectorAll("select");
      setSelect(role, "parent");
      setSelect(ref, "other");
      setInput(container.querySelector("input[placeholder^='Пароль']"), "correct horse battery");
    });
    await act(async () => { container.querySelector(".auth-consent input[type=checkbox]").click(); });
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1].marketingOptIn).toBe(false);
  });

  it("keeps the form if the status request fails", async () => {
    vi.spyOn(apiModule.api, "get").mockRejectedValue(new Error("offline"));
    await mount();
    expect(container.querySelector("input[type=email]")).not.toBeNull();
  });
});
