import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginScreen from "./LoginScreen.jsx";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import * as apiModule from "@/core/api";
import { ApiError } from "@/core/api";

describe("login UI language", () => {
  let root, container;
  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    act(() => setUiLanguage("ru"));
    useAppStore.setState({ authNotice: null });
    vi.restoreAllMocks();
  });

  it("changes the form and a visible error without resetting credentials or revealing the password", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ google: null });
    vi.spyOn(apiModule.api, "post").mockRejectedValue(new ApiError("Invalid email or password", 401));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<LoginScreen />));
    const setInput = (selector, value) => {
      const input = container.querySelector(selector);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    act(() => {
      setInput('input[type="email"]', "person@example.com");
      setInput('input[type="password"]', "private-password");
    });
    await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    act(() => {
      const select = container.querySelector("select");
      select.value = "sl";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector('input[type="email"]').value).toBe("person@example.com");
    expect(container.querySelector('input[type="password"]').value).toBe("private-password");
    expect(container.querySelector('[role="alert"]').textContent).toBe("Napačen e-poštni naslov ali geslo.");
    expect(container.querySelector('button[type="submit"]').textContent).toBe("Prijava");
    expect(document.documentElement.lang).toBe("sl");
  });
});
