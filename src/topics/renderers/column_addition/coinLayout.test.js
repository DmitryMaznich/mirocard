import { describe, expect, it } from "vitest";
import { fitCoinBoard, lessonUnit } from "./coinLayout.js";

describe("coin layout in the available lesson space", () => {
  it("uses height as well as width, including a short landscape lesson", () => {
    expect(lessonUnit(390, 760)).toBe(1);
    expect(lessonUnit(390, 570)).toBe(.75);
    expect(lessonUnit(780, 300)).toBe(.7);
  });
  it.each([
    [296, 193, 3, 19, .8],
    [338, 210, 9, 9, .92],
    [338, 190, 8, 19, .92],
    // Android portrait widths can vary with display zoom. These are review
    // budgets after browser/session controls, not physical screen pixels.
    [360, 210, 8, 19, lessonUnit(384, 500)],
    [388, 240, 9, 9, lessonUnit(412, 600)],
    [388, 210, 8, 19, lessonUnit(412, 460)],
    [660, 480, 9, 19, 1.4],
  ])("fits every object at %ipx × %ipx, %i stacks and %i coins", (width, height, tens, ones, unit) => {
    const size = fitCoinBoard({ width, height, tens, ones, unit });
    const stackWidth = size, stackHeight = size * 2.1;
    const stackRows = Math.ceil(tens / 3), coinRows = Math.ceil(ones / 5), gap = 6 * unit;
    expect(size).toBeGreaterThan(18);
    expect(size).toBeLessThanOrEqual(28 * unit);
    expect(stackWidth * Math.min(tens, 3) + gap * (Math.min(tens, 3) - 1)).toBeLessThanOrEqual(width * .4 - 20 * unit + .01);
    expect(size * Math.min(ones, 5) + gap * (Math.min(ones, 5) - 1)).toBeLessThanOrEqual(width * .6 - 20 * unit + .01);
    expect(stackHeight * stackRows + gap * (stackRows - 1)).toBeLessThanOrEqual(height - 52 * unit + .01);
    expect(size * coinRows + gap * (coinRows - 1)).toBeLessThanOrEqual(height - 52 * unit + .01);
  });
  it("keeps one diameter for empty, partially filled and grouped boards", () => {
    const viewport = { width: 360, height: 240.4, unit: 1 };
    const sizes = [{ tens: 0, ones: 0 }, { tens: 0, ones: 1 }, { tens: 0, ones: 13 }, { tens: 1, ones: 3 }, { tens: 9, ones: 19 }]
      .map((counts) => fitCoinBoard({ ...viewport, ...counts }));
    expect(new Set(sizes).size).toBe(1);
    expect(sizes[0]).toBe(28);
  });
});
