import { describe, expect, it } from "vitest";
import { shouldShowSessionStreak } from "./SessionScreen";

describe("shouldShowSessionStreak", () => {
  it("shows stars for evaluated spatial modes with an active video reward", () => {
    expect(shouldShowSessionStreak({
      mode: { type: "spatial_recognize", evaluation: "auto" },
      renderer: "spatial_prepositions",
      rewardAvailable: true,
    })).toBe(true);
  });

  it("keeps the header minimal when the spatial reward is unavailable", () => {
    expect(shouldShowSessionStreak({
      mode: { type: "spatial_recognize", evaluation: "auto" },
      renderer: "spatial_prepositions",
      rewardAvailable: false,
    })).toBe(false);
  });

  it("does not show reward stars for unscored spatial modes", () => {
    expect(shouldShowSessionStreak({
      mode: { type: "spatial_introduction", evaluation: "none" },
      renderer: "spatial_prepositions",
      rewardAvailable: true,
    })).toBe(false);
  });
});
