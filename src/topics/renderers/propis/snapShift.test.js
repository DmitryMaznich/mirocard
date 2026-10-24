import { describe, expect, it } from "vitest";
import { snapXFor } from "./PrintPageView.jsx";

// A run of a notebook on several papers that starts on an odd page: its pages are drawn as odd ones (the slant grid shifted by a page
// width, the margin on the other side), so its letters must snap as on an odd page too (owner, 2026-10-24: on the dense slant the letters
// of such a page stood between the lines, 1.5 mm off).
describe("snapXFor pageShift", () => {
  const args = { narrowRows: false, simpleGrid: "dense", margin: "left", format: "a5", narrow17: false };
  const even = snapXFor(args);
  const odd = snapXFor({ ...args, pageShift: 1 });
  it("row 0 of a run starting on an odd page snaps as the first row of the next page", () => {
    // the wide ruling has 16 rows on a page: row 16 is the first row of page 2
    for (const x of [3, 47.5, 120]) for (const y of [16, 40, 64]) expect(odd(0, x, y)).toBeCloseTo(even(16, x, y), 9);
    expect(odd(0, 47.5, 40)).not.toBeCloseTo(even(0, 47.5, 40), 3);
  });
  it("is cached per parity (the layout keeps finished rows per snap function)", () => {
    expect(snapXFor({ ...args, pageShift: 1 })).toBe(odd);
    expect(snapXFor({ ...args, pageShift: 2 })).toBe(even);
    expect(odd.cacheable).toBe(true);
  });
});
