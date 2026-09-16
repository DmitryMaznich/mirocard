import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import VerifyEmailSentScreen from "./VerifyEmailSentScreen.jsx";

describe("VerifyEmailSentScreen", () => {
  let container = null, root = null;

  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({
      pendingVerificationEmail: "test@example.com",
      verificationResendAvailableAt: 0,
    });
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
    act(() => { root.render(<VerifyEmailSentScreen />); });
  }

  function remount() {
    act(() => { root.unmount(); });
    root = createRoot(container);
    act(() => { root.render(<VerifyEmailSentScreen />); });
  }

  function resendButton() {
    return container.querySelector("button.btn-secondary");
  }

  it("keeps the resend action visible and disabled across a remount within the cooldown window", async () => {
    vi.spyOn(apiModule.api, "post").mockResolvedValue({});
    mount();

    await act(async () => {
      resendButton().click();
      await Promise.resolve();
    });

    expect(resendButton()).not.toBeNull();
    expect(resendButton().disabled).toBe(true);

    // Simulate the user bouncing away (e.g. through the login screen's
    // email_not_verified redirect) and back to this same screen.
    remount();

    expect(resendButton()).not.toBeNull();
    expect(resendButton().disabled).toBe(true);
  });

  it("re-enables the resend action once the cooldown elapses", async () => {
    vi.spyOn(apiModule.api, "post").mockResolvedValue({});
    mount();

    await act(async () => {
      resendButton().click();
      await Promise.resolve();
    });
    expect(resendButton()).not.toBeNull();
    expect(resendButton().disabled).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(resendButton()).not.toBeNull();
    expect(resendButton().disabled).toBe(false);
  });
});
