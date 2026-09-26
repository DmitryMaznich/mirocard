import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";

vi.mock("./completeLogin", () => ({ completeLogin: vi.fn(async () => {}) }));
const { completeLogin } = await import("./completeLogin");
const { default: GoogleCompleteProfileScreen } = await import("./GoogleCompleteProfileScreen.jsx");

describe("GoogleCompleteProfileScreen", () => {
  let container = null, root = null;
  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    useAppStore.setState({ googleSignup: null });
    completeLogin.mockClear();
    vi.restoreAllMocks();
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<GoogleCompleteProfileScreen />); });
  }
  const signup = { signupCode: "c", email: "g@example.test", firstName: "Галя", lastName: "" };
  const setSelect = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  async function fillAndSubmit({ consent }) {
    await act(async () => {
      const [role, ref] = container.querySelectorAll("select");
      setSelect(role, "parent");
      setSelect(ref, "other");
    });
    if (consent) await act(async () => { container.querySelector("input[name=consentPersonalData]").click(); });
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
  }

  it("shows who is signing in and an unchecked news box", () => {
    useAppStore.setState({ googleSignup: signup });
    mount();
    expect(container.textContent).toMatch(/Ещё один шаг/);
    expect(container.textContent).toMatch(/g@example\.test/);
    expect(container.querySelector("input[name=marketingOptIn]").checked).toBe(false);
  });

  it("does not submit without personal-data consent", async () => {
    useAppStore.setState({ googleSignup: signup });
    const post = vi.spyOn(apiModule.api, "post").mockResolvedValue({});
    mount();
    await fillAndSubmit({ consent: false });
    expect(post).not.toHaveBeenCalled();
    expect(container.querySelector(".form-error")).not.toBeNull();
  });

  it("creates the account with consent and completes the login", async () => {
    useAppStore.setState({ googleSignup: signup });
    const post = vi.spyOn(apiModule.api, "post").mockResolvedValue({ account: { id: "a1" }, settings: {}, token: "t" });
    mount();
    await fillAndSubmit({ consent: true });
    expect(post).toHaveBeenCalledWith("/auth/google/complete-signup", {
      signupCode: "c", role: "parent", referralSource: "other", consentPersonalData: true, marketingOptIn: false,
    });
    expect(completeLogin).toHaveBeenCalledWith({ account: { id: "a1" }, token: "t" });
  });

  it("explains an expired signup code and offers the way back", async () => {
    useAppStore.setState({ googleSignup: signup });
    vi.spyOn(apiModule.api, "post").mockRejectedValue(new apiModule.ApiError("invalid_or_expired_code", 400));
    mount();
    await fillAndSubmit({ consent: true });
    expect(container.textContent).toMatch(/истекло/);
    expect([...container.querySelectorAll("button")].some((b) => /К входу/.test(b.textContent))).toBe(true);
  });

  it("goes to login when there is no pending Google signup", () => {
    useAppStore.setState({ googleSignup: null, screen: "google_complete_profile" });
    mount();
    expect(useAppStore.getState().screen).toBe("login");
  });
});
