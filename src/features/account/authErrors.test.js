import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./authErrors";

describe("authErrorMessage", () => {
  it("translates rate limiting and known server errors", () => {
    expect(authErrorMessage({ status: 429, message: "Too many requests, try again later" }, "x")).toMatch(/Слишком много попыток/);
    expect(authErrorMessage({ status: 401, message: "Invalid email or password" }, "x")).toBe("Неверный email или пароль.");
  });

  it("never shows an unknown English server message", () => {
    expect(authErrorMessage({ status: 500, message: "Internal server error" }, "Ошибка входа.")).toBe("Ошибка входа.");
    expect(authErrorMessage(new TypeError("Failed to fetch"), "Ошибка входа.")).toBe("Ошибка входа.");
  });
});
