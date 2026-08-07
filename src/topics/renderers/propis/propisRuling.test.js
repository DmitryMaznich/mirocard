import { describe, it, expect } from "vitest";
import { GUIDE_LINES, NATIVE_L1, NATIVE_L2, NATIVE_L3, NATIVE_L4, NATIVE_TOP_MID, NATIVE_BOT_MID, NATIVE_NARROW_MID, LETTER_BASELINE_UNIT } from "./propisRuling.js";

describe("GUIDE_LINES", () => {
  it("has 7 lines numbered 1-7 in strictly increasing y order", () => {
    expect(GUIDE_LINES.map((g) => g.line)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (let i = 1; i < GUIDE_LINES.length; i += 1) {
      expect(GUIDE_LINES[i].y).toBeGreaterThan(GUIDE_LINES[i - 1].y);
    }
  });

  it("matches the exact y values used in handwriting_capture.html's drawRuling()", () => {
    expect(NATIVE_L1).toBe(10);
    expect(NATIVE_TOP_MID).toBe(36);
    expect(NATIVE_L2).toBe(62);
    expect(NATIVE_NARROW_MID).toBe(75);
    expect(NATIVE_L3).toBe(88);
    expect(NATIVE_BOT_MID).toBe(110);
    expect(NATIVE_L4).toBe(140);
  });

  it("NATIVE_L3 is the same baseline value as the existing LETTER_BASELINE_UNIT constant", () => {
    expect(NATIVE_L3).toBe(LETTER_BASELINE_UNIT);
  });
});
