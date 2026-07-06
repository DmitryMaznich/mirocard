import { describe, it, expect } from "vitest";
import { pickDistractorLetters, CONFUSION_PAIRS } from "./phoneticDistractors";

describe("pickDistractorLetters", () => {
  it("returns exactly `count` letters", () => {
    expect(pickDistractorLetters("б", 2)).toHaveLength(2);
  });

  it("never includes the target letter itself", () => {
    for (let i = 0; i < 20; i++) {
      expect(pickDistractorLetters("с", 2)).not.toContain("с");
    }
  });

  it("includes the confusion-pair letter when exactly one exists", () => {
    // б has exactly one confusable letter in the dictionary: п
    expect(pickDistractorLetters("б", 2)).toContain("п");
  });

  it("falls back to random letters when target has no confusion-pair entry", () => {
    expect(CONFUSION_PAIRS.м).toBeUndefined();
    const result = pickDistractorLetters("м", 2);
    expect(result).toHaveLength(2);
    expect(result).not.toContain("м");
  });

  it("returns no duplicate letters", () => {
    const result = pickDistractorLetters("з", 3);
    expect(new Set(result).size).toBe(result.length);
  });
});
