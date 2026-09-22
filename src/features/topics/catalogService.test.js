import { describe, expect, it } from "vitest";
import { getDeckDownloadUrl, isLocalModeProfile, shouldClaimCatalogDeck, isFreeStaticInstall } from "./catalogService";

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

describe("isFreeStaticInstall", () => {
  const paid = { access: "paid", url: "./decks/foo.zip" };
  const free = { access: "free", url: "./decks/foo.zip" };

  it("is true for a genuinely free entry regardless of who's asking", () => {
    expect(isFreeStaticInstall(free)).toBe(true);
  });

  it("is false for a paid entry on a signed-in account", () => {
    expect(isFreeStaticInstall(paid)).toBe(false);
  });

  // Regression guard for a real paywall-bypass bug: local mode used to be
  // waved through paid entries as if they were free, purely because it has
  // no account to gate against. It must stay locked instead -- local mode
  // has no way to hold a paid entitlement, so treating "no account" as
  // "free access" handed out every paid deck to anyone using local mode.
  it("is false for a paid entry even with no account at all (local mode)", () => {
    expect(isFreeStaticInstall(paid, null, null)).toBe(false);
  });

  it("is false without a static url to download from", () => {
    expect(isFreeStaticInstall({ access: "paid" })).toBe(false);
  });
});

describe("getDeckDownloadUrl", () => {
  it("cache-busts the unversioned download endpoint", () => {
    expect(getDeckDownloadUrl("symmetry_draw", 123)).toBe(
      "/api/decks/symmetry_draw/download?_refresh=123",
    );
  });

  it("encodes a topic id before placing it in the URL", () => {
    expect(getDeckDownloadUrl("topic/a", 456)).toBe(
      "/api/decks/topic%2Fa/download?_refresh=456",
    );
  });
});
