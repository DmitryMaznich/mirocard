import { describe, expect, it } from "vitest";
import { shouldClaimCatalogDeck } from "./catalogService";

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
