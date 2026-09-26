import { describe, it, expect, afterEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";

vi.mock("./completeLogin", () => ({ completeLogin: vi.fn(async () => {}) }));
const { completeLogin } = await import("./completeLogin");
const { handleGoogleCode } = await import("./googleSignIn");

describe("handleGoogleCode", () => {
  afterEach(() => { vi.restoreAllMocks(); completeLogin.mockClear(); useAppStore.setState({ googleSignup: null }); });

  it("signs a known Google user straight in", async () => {
    vi.spyOn(apiModule.api, "post").mockResolvedValue({ account: { id: "a1" }, settings: {}, token: "t" });
    await handleGoogleCode("code-1");
    expect(apiModule.api.post).toHaveBeenCalledWith("/auth/google/exchange", { code: "code-1" });
    expect(completeLogin).toHaveBeenCalledWith({ account: { id: "a1" }, token: "t" });
  });

  it("sends a new person to the one-more-step screen without creating a session", async () => {
    vi.spyOn(apiModule.api, "post").mockResolvedValue({ needsProfile: true, signupCode: "s", email: "g@example.test", firstName: "Галя", lastName: "Г" });
    await handleGoogleCode("code-2");
    expect(completeLogin).not.toHaveBeenCalled();
    expect(useAppStore.getState().googleSignup).toEqual({ signupCode: "s", email: "g@example.test", firstName: "Галя", lastName: "Г" });
    expect(useAppStore.getState().screen).toBe("google_complete_profile");
  });
});
