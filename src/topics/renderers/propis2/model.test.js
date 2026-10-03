import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { analyzePage, analyzeRow, duplicateRow, findUnsupported, moveRow, newPage, newRow, pageFromLines, pageToLines, rowToLine } from "./model.js";
import { buildGlyphMap } from "./pageTask.js";

function record() {
  const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
  const elements = JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements;
  return { wide: wide.glyphs, wideSheets: wide.sheets, elements, wideElementRepeat: wide.elementRepeat };
}
const map = buildGlyphMap(record());

describe("propis2 model", () => {
  it("turns rows into engine lines, dropping empty rows and keeping marks", () => {
    const page = newPage("Т", { rows: [newRow({ text: " Н " , mark: "d" }), newRow({ text: "" }), newRow({ text: "кот" })] });
    expect(pageToLines(page)).toEqual(["Н#d", "кот"]);
    expect(rowToLine(newRow({ text: "а  б", mark: "c" }))).toBe("а б#c");
  });

  it("round-trips a ready sheet through pageFromLines/pageToLines", () => {
    const lines = record().wideSheets.page18;
    const page = pageFromLines("Н Ю К", lines, "narrow", new Set());
    expect(page.rows.map((r) => r.mark)).toEqual(["d", "c", "d", "c", "d", "c"]);
    expect(pageToLines(page)).toEqual(lines);
  });

  it("recognises element rows when they are known element ids", () => {
    const page = pageFromLines("э", ["5 5", "кот"], "narrow", new Set(["5 5"]));
    expect(page.rows[0].kind).toBe("element");
    expect(page.rows[1].kind).toBe("text");
  });

  it("moves and duplicates rows", () => {
    const rows = [newRow({ text: "а" }), newRow({ text: "б" }), newRow({ text: "в" })];
    expect(moveRow(rows, 0, 1).map((r) => r.text)).toEqual(["б", "а", "в"]);
    expect(moveRow(rows, 0, -1)).toBe(rows);
    const dup = duplicateRow(rows, 1);
    expect(dup.map((r) => r.text)).toEqual(["а", "б", "б", "в"]);
    expect(new Set(dup.map((r) => r.id)).size).toBe(4);
  });

  it("reports characters without a glyph instead of dropping them silently", () => {
    expect(findUnsupported("кот", map)).toEqual([]);
    expect(findUnsupported("кот!", map)).toEqual(["!"]);
    expect(findUnsupported("a1", map)).toContain("a");
    expect(analyzeRow(newRow({ text: "кот?" }), map).unsupported).toEqual(["?"]);
    expect(analyzeRow(newRow({ text: "" }), map).empty).toBe(true);
  });

  it("flags a row that is too wide for the line", () => {
    expect(analyzeRow(newRow({ text: "кот" }), map, "narrow").overflow).toBe(false);
    expect(analyzeRow(newRow({ text: "молоко молоко молоко молоко молоко молоко" }), map, "narrow").overflow).toBe(true);
    const page = newPage("p", { rows: [newRow({ text: "кот" }), newRow({ text: "кот!" })] });
    expect(analyzePage(page, map).problems).toBe(1);
  });
});
