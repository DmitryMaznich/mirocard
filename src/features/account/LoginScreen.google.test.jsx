import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import LoginScreen from "./LoginScreen.jsx";

describe("LoginScreen — Google", () => {
  let container = null, root = null;
  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    useAppStore.setState({ authNotice: null });
    vi.restoreAllMocks();
  });
  async function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<LoginScreen />); });
    await act(async () => {});
  }

  it("offers Google sign-in when the server has a client id", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: true, google: { clientId: "cid" } });
    await mount();
    expect(container.querySelector(".google-signin")).not.toBeNull();
  });

  it("has no Google button when Google is not configured", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: true, google: null });
    await mount();
    expect(container.querySelector(".google-signin")).toBeNull();
  });

  it("shows a one-shot notice (e.g. failed Google sign-in) and clears it", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ emailSignupOpen: true, google: null });
    useAppStore.setState({ authNotice: "Не получилось войти через Google." });
    await mount();
    expect(container.textContent).toMatch(/Не получилось войти через Google/);
    act(() => root.unmount()); root = null;
    expect(useAppStore.getState().authNotice).toBeNull();
  });
});
