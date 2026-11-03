import { describe, it, expect } from "vitest";
import topic from "../../../../tools/print_letters/topic.json";
import {
  paperOf, isRuled, rowBesidePlate, rowStartCells, blockHeightCells, blockCells, copiesPerRow, copyPlan, ladderRows, pageOverflows, rowCells, sheetCells, toggleElement,
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

  it("places one copy per letter-cell (2 of our cells); wide letters take two thirds of it", () => {
    expect(copiesPerRow(letter("Н"), "a4")).toBe(16);
    expect(copiesPerRow(letter("Ш"), "a4")).toBe(16);
    expect(copiesPerRow(letter("Н"), "a5")).toBe(10);
    expect(copiesPerRow(letter("Ш"), "a5")).toBe(9);
    expect(copiesPerRow(letter("Н"), "a4", false)).toBe(18);
    expect(copiesPerRow(letter("Ш"), "a4", false)).toBe(18);
  });

  it("indents only the rows beside the plate (the first two)", () => {
    expect([0, 1, 2, 3].map(rowBesidePlate)).toEqual([true, true, false, false]);
  });

  it("doubles everything at the large size, still on whole cells", () => {
    // Н 4 cells tall, 2 wide + 1 blank cell
    expect(copiesPerRow(letter("Н"), "a4", true, 4)).toBe(8);
    expect(copiesPerRow(letter("Н"), "a4", false, 4)).toBe(9);
    expect(copiesPerRow(letter("Ш"), "a4", false, 4)).toBe(9);
    // only the first row stands beside the 4-cell plate
    expect([0, 1].map((i) => rowBesidePlate(i, 4))).toEqual([true, false]);
    const rows = ladderRows(letter("Н")); // 6 rows
    expect(blockHeightCells({ rows })).toBe(19);
    expect(blockHeightCells({ rows, size: 4 })).toBe(31);
    // on линейка the ruling sets the size: a large block is drawn at the normal size
    expect(blockHeightCells({ rows, size: 4 }, "line")).toBe(19);
  });

  it("knows the three papers; old drafts' «line3»/«line2» read as the one ruling", () => {
    expect(paperOf({ paper: "line3" })).toBe("line");
    expect(paperOf({ paper: "line2" })).toBe("line");
    expect(paperOf({ paper: "bigcell" })).toBe("bigcell");
    expect(paperOf({})).toBe("cell");
    expect([isRuled("cell"), isRuled("bigcell"), isRuled("line")]).toEqual([false, false, true]);
  });

  it("on the 1cm big cell every gap is a whole big cell, so all edges fall on 1cm lines", () => {
    // block left edge at 5mm, big lines every 10mm from 5mm: starts must be even numbers of our cells
    expect(rowStartCells(true, "bigcell")).toBe(6);
    expect(rowStartCells(false, "bigcell")).toBe(2);
    expect(rowCells("a4", false, "bigcell")).toBe(34);
    expect(copiesPerRow(letter("Н"), "a4", false, 2, "bigcell")).toBe(17);
    // rows every other big row: 2 blank + 2 letter per row, 2 blank under the block
    const rows = ladderRows(letter("Н")); // 6 rows
    expect(blockHeightCells({ rows }, "bigcell")).toBe(26);
    expect(blockHeightCells({ rows, size: 4 }, "bigcell")).toBe(26); // one letter = one big cell, always
    expect([0, 1].map((i) => rowBesidePlate(i, 2, "bigcell"))).toEqual([true, false]);
  });;

  it("follows Ilyukhina's stroke order: Г stick first, П and Ш in two strokes, Н both sticks then the bar", () => {
    const names = (id) => letter(id).strokes.map((s) => s.name);
    expect(names("Г")).toEqual(["палочка", "верхняя черта"]);
    expect(names("П")).toEqual(["левая палочка", "верх и правая палочка"]);
    expect(names("Н")).toEqual(["левая палочка", "правая палочка", "перекладина"]);
    expect(names("Ш")).toEqual(["левая палочка, низ и правая палочка", "средняя палочка"]);
    expect([letter("Т").wide, letter("Ш").wide, letter("Н").wide]).toEqual([true, true, undefined]);
  });

  it("builds the ladder: elements add up, then the support fades, then blank", () => {
    const rows = ladderRows(letter("Н"));
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
    const block = { rows: ladderRows(letter("Н")) }; // 6 rows → 19 cells tall
    expect(pageOverflows({ blocks: [block, block] }, "a4")).toBe(false);
    expect(pageOverflows({ blocks: [block, block] }, "a5")).toBe(true);
  });;
});
