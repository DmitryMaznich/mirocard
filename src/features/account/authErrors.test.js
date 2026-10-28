import { describe, expect, it } from "vitest";
import { authErrorMessage, googleAuthErrorKey } from "./authErrors";

describe("authErrorMessage", () => {
  it("translates rate limiting and known server errors", () => {
    expect(authErrorMessage({ status: 429, message: "Too many requests, try again later" }, "x")).toMatch(/Слишком много попыток/);
    expect(authErrorMessage({ status: 401, message: "Invalid email or password" }, "x")).toBe("Неверный email или пароль.");
  });

  it("never shows an unknown English server message", () => {
    expect(authErrorMessage({ status: 500, message: "Internal server error" }, "Ошибка входа.")).not.toMatch(/Internal/);
    expect(authErrorMessage({ status: 400, message: "Something odd" }, "Ошибка входа.")).toBe("Ошибка входа.");
  });

  it("explains network failures and server errors instead of a generic retry", () => {
    expect(authErrorMessage(new TypeError("Failed to fetch"), "Ошибка входа.")).toMatch(/VPN/);
    expect(authErrorMessage({ name: "AbortError" }, "Ошибка входа.")).toMatch(/Не удалось связаться/);
    expect(authErrorMessage({ status: 502, message: "Bad Gateway" }, "Ошибка входа.")).toMatch(/Ошибка на стороне сервера/);
  });

  it("distinguishes an expired Google code from a failure after authentication", () => {
    expect(googleAuthErrorKey({ status: 400, message: "invalid_or_expired_code" })).toBe("auth.googleExpired");
    expect(googleAuthErrorKey(new TypeError("Object.hasOwn is not a function"))).toBe("auth.googleFailed");
    expect(googleAuthErrorKey({ name: "QuotaExceededError" })).toBe("auth.googleFailed");
    expect(googleAuthErrorKey({ status: 429 })).toBe("auth.tooManyAttempts");
  });
});
