import { describe, expect, it } from "vitest";
import { shouldRequestSessionStartPin } from "./sessionStartGate";

describe("shouldRequestSessionStartPin", () => {
  it("does not request a PIN when the video reward is disabled", () => {
    expect(shouldRequestSessionStartPin({ videoRewardEnabled: false })).toBe(false);
  });

  it("keeps the PIN gate for a video-reward session", () => {
    expect(shouldRequestSessionStartPin({ videoRewardEnabled: true })).toBe(true);
  });

  it("preserves existing PIN-exempt modes", () => {
    expect(shouldRequestSessionStartPin({ videoRewardEnabled: true, bypassPin: true })).toBe(false);
  });
});
