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

// The sparse slant and «без наклонных» (owner, 2026-10-25: «чтобы ... слева начиналось на одной позиции»): the narrow rows' hidden grid
// is laid per row, so a row's first letter stands at the same x on every row and page; the dense slant keeps its page-long lines.
describe("narrow rows: first letter at one place", () => {
  for (const simpleGrid of ["regular", "none"]) {
    it(`${simpleGrid}: same snapped x on every row`, () => {
      const snap = snapXFor({ narrowRows: true, simpleGrid, margin: "left", format: "a5", narrow17: true });
      for (const x of [3, 20]) {
        const xs = Array.from({ length: 40 }, (_, r) => snap(r, x, 40));
        for (const v of xs) expect(v).toBeCloseTo(xs[0], 9);
      }
    });
  }
  it("dense: still follows the page-long slant lines", () => {
    const snap = snapXFor({ narrowRows: true, simpleGrid: "dense", margin: "left", format: "a5", narrow17: true });
    const xs = Array.from({ length: 8 }, (_, r) => snap(r, 20, 40));
    expect(new Set(xs.map((v) => v.toFixed(3))).size).toBeGreaterThan(1);
  });
});
