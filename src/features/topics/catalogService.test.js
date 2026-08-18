import { describe, expect, it } from "vitest";
import { isLocalModeProfile, shouldClaimCatalogDeck } from "./catalogService";

describe("shouldClaimCatalogDeck", () => {
  it("does not require a token to install a free deck in local mode", () => {
    expect(shouldClaimCatalogDeck({ access: "free" }, null)).toBe(false);
    expect(shouldClaimCatalogDeck({}, null)).toBe(false);
  });

  it("keeps claims for signed-in and restricted installs", () => {
    expect(shouldClaimCatalogDeck({ access: "free" }, "token-1")).toBe(true);
    expect(shouldClaimCatalogDeck({ access: "paid" }, null)).toBe(true);
  });
});

describe("isLocalModeProfile", () => {
  it("recognizes the tokenless local profile without confusing a signed-in adult", () => {
    expect(isLocalModeProfile({ email: "local" }, null)).toBe(true);
    expect(isLocalModeProfile({ email: "adult@example.test" }, null)).toBe(false);
    expect(isLocalModeProfile({ email: "local" }, "token-1")).toBe(false);
  });
});
