import { describe, expect, it } from "vitest";
import { shouldPreferBundledRenderer, shouldShowSessionStreak } from "./SessionScreen";

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

describe("shouldPreferBundledRenderer", () => {
  it("does not let a legacy deck renderer override spatial prepositions", () => {
    expect(shouldPreferBundledRenderer("spatial_prepositions")).toBe(true);
  });

  it("keeps supporting dynamic renderers for other topics", () => {
    expect(shouldPreferBundledRenderer("flashcards")).toBe(false);
  });
  it('uses the current paper drawing flow with cached topic renderers', () => {
    expect(shouldPreferBundledRenderer('drawing', 'drawing_steps')).toBe(true);
    expect(shouldPreferBundledRenderer('drawing', 'drawing_first_lines')).toBe(false);
    expect(shouldPreferBundledRenderer('drawing', 'drawing_coloring')).toBe(false);
  });
});
