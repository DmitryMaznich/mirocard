import { describe, it, expect } from "vitest";
import { gradeStrokes, gradeText, gradeWriteMs, GRADE_DIGITS, GRADE_SIGNS } from "./gradeMark.js";

describe("the dictation mark written in red", () => {
  it("every mark 1–5 with +, − or nothing has finite strokes inside its box", () => {
    for (const n of GRADE_DIGITS) for (const sign of GRADE_SIGNS) {
      const { w, h, strokes } = gradeStrokes({ n, sign });
      expect(strokes.length).toBeGreaterThanOrEqual(2); // digit + underline at least
      expect(w).toBeGreaterThan(50);
      expect(h).toBeGreaterThan(100);
      for (const s of strokes) {
        expect(s.d).not.toMatch(/NaN|undefined/);
        const xs = s.d.match(/-?\d+\.?\d*/g).map(Number).filter((_, i) => i % 2 === 0);
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1);
        expect(Math.max(...xs)).toBeLessThanOrEqual(w + 1);
      }
    }
  });
  it("a plus adds two strokes, a minus one; the text and the time are sane", () => {
    const base = gradeStrokes({ n: 3, sign: "" }).strokes.length;
    expect(gradeStrokes({ n: 3, sign: "+" }).strokes.length).toBe(base + 2);
    expect(gradeStrokes({ n: 3, sign: "−" }).strokes.length).toBe(base + 1);
    expect(gradeText({ n: 5, sign: "−" })).toBe("5−");
    expect(gradeWriteMs({ n: 5, sign: "+" })).toBeGreaterThan(gradeWriteMs({ n: 5, sign: "" }));
  });
});
