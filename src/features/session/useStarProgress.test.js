import { describe, expect, it } from "vitest";
import { computeStarProgress, thresholdToStars } from "./useStarProgress";

describe("thresholdToStars", () => {
  it("maps <=70 to 3 stars", () => {
    expect(thresholdToStars(70)).toBe(3);
    expect(thresholdToStars(50)).toBe(3);
  });
  it("maps 71-80 to 4 stars", () => {
    expect(thresholdToStars(80)).toBe(4);
    expect(thresholdToStars(75)).toBe(4);
  });
  it("maps >80 to 5 stars", () => {
    expect(thresholdToStars(90)).toBe(5);
    expect(thresholdToStars(95)).toBe(5);
  });
});

describe("computeStarProgress", () => {
  it("returns 0 lit stars at session start", () => {
    const r = computeStarProgress({ correctCount: 0, total: 10, rewardThreshold: 80, available: true });
    expect(r.litStars).toBe(0);
    expect(r.videoUnlocked).toBe(false);
  });

  it("lights stars proportionally to correct answers", () => {
    expect(computeStarProgress({ correctCount: 4, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(2);
    expect(computeStarProgress({ correctCount: 8, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(4);
    expect(computeStarProgress({ correctCount: 10, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(5);
  });

  it("unlocks video when litStars >= thresholdStars", () => {
    const r = computeStarProgress({ correctCount: 8, total: 10, rewardThreshold: 80, available: true });
    expect(r.thresholdStars).toBe(4);
    expect(r.videoUnlocked).toBe(true);
  });

  it("does not unlock when litStars is one below threshold", () => {
    const r = computeStarProgress({ correctCount: 7, total: 10, rewardThreshold: 80, available: true });
    expect(r.litStars).toBe(3);
    expect(r.videoUnlocked).toBe(false);
  });

  it("does not unlock when available is false", () => {
    const r = computeStarProgress({ correctCount: 10, total: 10, rewardThreshold: 80, available: false });
    expect(r.videoUnlocked).toBe(false);
  });

  it("handles small card counts without division errors", () => {
    expect(computeStarProgress({ correctCount: 2, total: 3, rewardThreshold: 70, available: true }).litStars).toBe(3);
  });

  it("does not exceed 5 stars", () => {
    expect(computeStarProgress({ correctCount: 100, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(5);
  });

  it("incorrect answers reduce lit stars", () => {
    // 6 correct, 0 wrong → 3 stars; 6 correct, 2 wrong → net 4 → 2 stars
    expect(computeStarProgress({ correctCount: 6, incorrectCount: 0, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(3);
    expect(computeStarProgress({ correctCount: 6, incorrectCount: 2, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(2);
  });

  it("stars never go below 0", () => {
    expect(computeStarProgress({ correctCount: 2, incorrectCount: 10, total: 10, rewardThreshold: 80, available: true }).litStars).toBe(0);
  });

  it("video locks if wrong answers drop litStars below threshold", () => {
    // 8 correct unlocks at threshold 80 (4 stars needed), but 2 wrong makes net 6 → 3 stars → locked
    const r = computeStarProgress({ correctCount: 8, incorrectCount: 2, total: 10, rewardThreshold: 80, available: true });
    expect(r.litStars).toBe(3);
    expect(r.videoUnlocked).toBe(false);
  });
});
