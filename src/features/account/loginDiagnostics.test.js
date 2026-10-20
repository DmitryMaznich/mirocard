import { describe, it, expect } from "vitest";
import { loginDiagnosticCode, markLoginFailure } from "./loginDiagnostics";

describe("safe login diagnostics", () => {
  it("keeps the failure stage and storage category without exposing the message", () => {
    const error = new DOMException("private account data and token", "QuotaExceededError");
    markLoginFailure(error, "save-local-data");
    const code = loginDiagnosticCode(error, "google-exchange");
    expect(code).toMatch(/\/save-local-data\/QuotaExceededError$/);
    expect(code).not.toContain("private");
  });

  it("allows only fixed stages, names and HTTP statuses", () => {
    const error = { name: "private@example.com", status: 503, message: "secret" };
    markLoginFailure(error, "token-secret");
    expect(loginDiagnosticCode(error, "password-request")).toMatch(/\/password-request\/HTTP503$/);
    expect(loginDiagnosticCode({ name: "secret", status: 200 }, "secret")).toMatch(/\/unknown\/Error$/);
    expect(loginDiagnosticCode(null, "google-callback")).toMatch(/\/google-callback\/Error$/);
    expect(loginDiagnosticCode("secret", "boot-local")).toMatch(/\/boot-local\/Error$/);
  });
});
