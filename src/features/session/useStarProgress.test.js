import { describe, expect, it } from "vitest";
import { computeStreakProgress, computeDisplayStars } from "./useStarProgress";

describe("computeStreakProgress", () => {
  it("returns 0 lit stars at streak 0", () => {
    const r = computeStreakProgress({ streakCount: 0, available: true });
    expect(r.litStars).toBe(0);
  });

  it("maps streakCount directly to litStars", () => {
    expect(computeStreakProgress({ streakCount: 1, available: true }).litStars).toBe(1);
    expect(computeStreakProgress({ streakCount: 3, available: true }).litStars).toBe(3);
    expect(computeStreakProgress({ streakCount: 5, available: true }).litStars).toBe(5);
  });

  it("caps at 5 stars", () => {
    expect(computeStreakProgress({ streakCount: 10, available: true }).litStars).toBe(5);
  });

  it("never goes below 0", () => {
    expect(computeStreakProgress({ streakCount: -1, available: true }).litStars).toBe(0);
  });

  it("passes through available flag", () => {
    expect(computeStreakProgress({ streakCount: 5, available: false }).available).toBe(false);
    expect(computeStreakProgress({ streakCount: 5, available: true }).available).toBe(true);
  });
});

describe("computeDisplayStars", () => {
  it("returns 0 at session start", () => {
    expect(computeDisplayStars({ correctCount: 0, total: 10 })).toBe(0);
  });

  it("lights stars proportionally to correct answers", () => {
    expect(computeDisplayStars({ correctCount: 4, total: 10 })).toBe(2);
    expect(computeDisplayStars({ correctCount: 8, total: 10 })).toBe(4);
    expect(computeDisplayStars({ correctCount: 10, total: 10 })).toBe(5);
  });

  it("incorrect answers reduce stars", () => {
    expect(computeDisplayStars({ correctCount: 6, incorrectCount: 2, total: 10 })).toBe(2);
  });

  it("never exceeds 5", () => {
    expect(computeDisplayStars({ correctCount: 100, total: 10 })).toBe(5);
  });

  it("never goes below 0", () => {
    expect(computeDisplayStars({ correctCount: 2, incorrectCount: 10, total: 10 })).toBe(0);
  });
});
