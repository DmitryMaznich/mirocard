import { describe, expect, it } from "vitest";
import { isLocalModeProfile, shouldClaimCatalogDeck } from "./catalogService";

describe("shouldClaimCatalogDeck", () => {
  it("does not require a token to install a free deck in local mode", () => {
    expect(shouldClaimCatalogDeck({ access: "free" }, null)).toBe(false);
    expect(shouldClaimCatalogDeck({}, null)).toBe(false);
  });

  it("does not make a free static download depend on account confirmation", () => {
    expect(shouldClaimCatalogDeck({ access: "free" }, "token-1")).toBe(false);
  });

  it("keeps claims for restricted installs", () => {
    expect(shouldClaimCatalogDeck({ access: "paid" })).toBe(true);
  });
});

describe("isLocalModeProfile", () => {
  it("recognizes the tokenless local profile without confusing a signed-in adult", () => {
    expect(isLocalModeProfile({ email: "local" }, null)).toBe(true);
    expect(isLocalModeProfile({ email: "adult@example.test" }, null)).toBe(false);
    expect(isLocalModeProfile({ email: "local" }, "token-1")).toBe(false);
  });
});
