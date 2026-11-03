import { describe, it, expect } from "vitest";
import topic from "../../../../tools/print_letters/topic.json";
import {
  rowBesidePlate, blockHeightCells, blockCells, copiesPerRow, copyPlan, ladderRows, pageOverflows, rowCells, sheetCells, toggleElement,
} from "./model";

const letter = (id) => topic.cards.find((c) => c.id === id);

describe("print_letters model", () => {
  it("fits the block to the printable width of each format, in whole cells", () => {
    // A4: 210 − 2·5mm printer margin = 200mm = 40 cells, minus a cell of page padding each side.
    expect(sheetCells("a4").cols).toBe(38);
    expect(sheetCells("a5").cols).toBe(25);
    expect(blockCells("a4")).toBe(38);
    expect(rowCells("a4")).toBe(32);
    expect(rowCells("a5")).toBe(19);
    // rows below the letter plate use the block from edge to edge
    expect(rowCells("a4", false)).toBe(36);
    expect(rowCells("a5", false)).toBe(23);
  });

  it("places copies one blank cell apart, wide letters taking two cells", () => {
    expect(copiesPerRow(letter("Н"), "a4")).toBe(16);
    expect(copiesPerRow(letter("Ш"), "a4")).toBe(11);
    expect(copiesPerRow(letter("Н"), "a5")).toBe(10);
    expect(copiesPerRow(letter("Ш"), "a5")).toBe(6);
    expect(copiesPerRow(letter("Н"), "a4", false)).toBe(18);
    expect(copiesPerRow(letter("Ш"), "a4", false)).toBe(12);
  });

  it("indents only the rows beside the plate (the first two)", () => {
    expect([0, 1, 2, 3].map(rowBesidePlate)).toEqual([true, true, false, false]);
  });

  it("doubles everything at the large size, still on whole cells", () => {
    // Н 4 cells tall, 2 wide + 1 blank cell
    expect(copiesPerRow(letter("Н"), "a4", true, 4)).toBe(11);
    expect(copiesPerRow(letter("Н"), "a4", false, 4)).toBe(12);
    expect(copiesPerRow(letter("Ш"), "a4", false, 4)).toBe(7);
    // only the first row stands beside the 4-cell plate
    expect([0, 1].map((i) => rowBesidePlate(i, 4))).toEqual([true, false]);
    const rows = ladderRows(letter("Н")); // 6 rows
    expect(blockHeightCells({ rows })).toBe(19);
    expect(blockHeightCells({ rows, size: 4 })).toBe(31);
  });

  it("builds the ladder: elements add up, then the support fades, then blank", () => {
    const rows = ladderRows(letter("П"));
    expect(rows.map((r) => [r.elements.join(""), r.support])).toEqual([
      ["0", "dotted"],
      ["01", "dotted"],
      ["012", "dotted"],
      ["012", "fade"],
      ["012", "sample"],
      ["", "sample"],
    ]);
  });

  it("keeps toggled elements sorted and allows any number of them", () => {
    expect(toggleElement([2], 0)).toEqual([0, 2]);
    expect(toggleElement([0, 2], 2)).toEqual([0]);
    expect(toggleElement([0, 1], 2)).toEqual([0, 1, 2]);
  });

  it("starts every non-blank row with a sample, then gives less help by support level", () => {
    const row = (support) => ({ elements: [0, 1], support });
    const v = (support, n) => copyPlan(row(support), n).map((p) => p && p.variant);
    expect(v("dotted", 3)).toEqual(["sample", "dotted", "dotted"]);
    expect(v("starts", 3)).toEqual(["sample", "starts", "starts"]);
    expect(v("sample", 3)).toEqual(["sample", null, null]);
    expect(v("fade", 3)).toEqual(["sample", "trace", "trace"]);
    const fade = copyPlan(row("fade"), 6).slice(1).map((p) => p.opacity);
    expect(fade[0]).toBe(1);
    expect(fade[4]).toBeCloseTo(0.15);
    expect(fade).toEqual([...fade].sort((a, b) => b - a));
    expect(copyPlan({ elements: [], support: "dotted" }, 3)).toEqual([null, null, null]);
  });

  it("detects a page that no longer fits the sheet", () => {
    const block = { rows: ladderRows(letter("Ш")) }; // 7 rows → 22 cells tall
    expect(pageOverflows({ blocks: [block, block] }, "a4")).toBe(false);
    expect(pageOverflows({ blocks: [block, block] }, "a5")).toBe(true);
  });
});
