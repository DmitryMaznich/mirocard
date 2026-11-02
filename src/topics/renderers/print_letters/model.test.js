import { describe, it, expect } from "vitest";
import topic from "../../../../tools/print_letters/topic.json";
import {
  blockCells, copiesPerRow, copyPlan, ladderRows, pageOverflows, rowCells, sheetCells, toggleElement,
} from "./model";

const letter = (id) => topic.cards.find((c) => c.id === id);

describe("print_letters model", () => {
  it("fits the block to the printable width of each format, in whole cells", () => {
    // A4: 210 − 2·5mm printer margin = 200mm = 40 cells, minus a cell of page padding each side.
    expect(sheetCells("a4").cols).toBe(38);
    expect(sheetCells("a5").cols).toBe(25);
    expect(blockCells("a4")).toBe(38);
    expect(rowCells("a4")).toBe(34);
    expect(rowCells("a5")).toBe(21);
  });

  it("places copies one blank cell apart, wide letters taking two cells", () => {
    expect(copiesPerRow(letter("Н"), "a4")).toBe(17);
    expect(copiesPerRow(letter("Ш"), "a4")).toBe(11);
    expect(copiesPerRow(letter("Н"), "a5")).toBe(11);
    expect(copiesPerRow(letter("Ш"), "a5")).toBe(7);
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

  it("plans each copy by support level", () => {
    const row = (support) => ({ elements: [0, 1], support });
    expect(copyPlan(row("dotted"), 3).map((p) => p.variant)).toEqual(["dotted", "dotted", "dotted"]);
    expect(copyPlan(row("starts"), 3).map((p) => p.variant)).toEqual(["solid", "starts", "starts"]);
    expect(copyPlan(row("sample"), 3).map((p) => p && p.variant)).toEqual(["solid", null, null]);
    const fade = copyPlan(row("fade"), 5).map((p) => p.opacity);
    expect(fade[0]).toBe(1);
    expect(fade[4]).toBeCloseTo(0.12);
    expect(fade).toEqual([...fade].sort((a, b) => b - a));
    expect(copyPlan({ elements: [], support: "dotted" }, 3)).toEqual([null, null, null]);
  });

  it("detects a page that no longer fits the sheet", () => {
    const block = { rows: ladderRows(letter("Ш")) }; // 7 rows → 22 cells tall
    expect(pageOverflows({ blocks: [block, block] }, "a4")).toBe(false);
    expect(pageOverflows({ blocks: [block, block] }, "a5")).toBe(true);
  });
});
