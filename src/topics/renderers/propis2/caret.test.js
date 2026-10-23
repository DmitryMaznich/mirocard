import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { buildGlyphMap } from "./pageTask.js";
import { lineOwners, newPage, newRow, pageRuling, pageSnap, pageToLines, rowMaxX } from "./model.js";
import { bracesIn, fieldFromRows } from "./fieldText.js";
import { caretFromSheet, caretOnSheet } from "./caret.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
const elements = JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements;
const map = buildGlyphMap({ wide: wide.glyphs, wideSheets: wide.sheets, elements, wideElementRepeat: wide.elementRepeat });

const CODES = new Map([["заборчик", "э1"]]);
// the page as the editor's preview lays it out (the whole page in one go, every row on its own row of the sheet)
const drawn = (page) => layoutWideLinesIntoRows(pageToLines(page, map), map, pageSnap(page), true, pageRuling(page) === "narrow" ? 0.5 : 1, rowMaxX(page)).placed;
const setup = (rows, patch = {}) => {
  const page = newPage("т", { ruling: "narrow", grid: "dense", margin: "left", rows, ...patch });
  return { page, owners: lineOwners(page, map), lines: bracesIn(fieldFromRows(page.rows, 0, true), CODES).split("\n") };
};

describe("the caret on the sheet", () => {
  it("at the end of a written-once row it stands right at the end of the ink the page draws, on every row of the sheet", () => {
    const rows = ["мама", "кот", "щука", "Ира", "дом"].map((text) => newRow({ text, repeat: "one", dots: "none" }));
    for (const patch of [{}, { ruling: "wide" }, { grid: "regular" }, { margin: "off" }]) {
      const { page, owners, lines } = setup([newRow({ kind: "blank" }), newRow({ kind: "blank" }), ...rows], patch);
      if (patch.ruling === "wide") page.rows = page.rows.map((r) => (r.text === "щука" || r.text === "Ира" || r.text === "дом" ? { ...r, text: "лис" } : r));
      const placed = drawn(page);
      page.rows.forEach((r, i) => {
        if (r.kind === "blank") return;
        const spot = caretOnSheet({ page, glyphMap: map, owners: lineOwners(page, map), rowIndex: i, line: r.text, offset: r.text.length });
        const row = placed.find((p) => p.rowIndex === spot.abs);
        expect(spot.x, `${JSON.stringify(patch)} «${r.text}»`).toBeCloseTo(row.segments[0].width, 3);
      });
      void owners; void lines;
    }
  });
  it("moves right letter by letter, and a tap is mapped back to the nearest letter boundary", () => {
    const { page, owners, lines } = setup([newRow({ text: "молоко", repeat: "all" })]);
    const xs = [...Array(7).keys()].map((off) => caretOnSheet({ page, glyphMap: map, owners, rowIndex: 0, line: lines[0], offset: off }).x);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    for (let off = 0; off <= 6; off += 1) {
      expect(caretFromSheet({ page, glyphMap: map, owners, abs: 0, x: xs[off] + 0.5, lines })).toEqual({ rowIndex: 0, offset: off });
    }
  });
  it("in running text it follows the wrapping: the end of each wrapped line is the end of its ink on its own sheet row", () => {
    const text = "Мама мыла раму. Кот спит на окне, а пёс гуляет во дворе с мячом.";
    for (const writeAfter of [false, true]) {
      const { page, owners, lines } = setup([newRow({ kind: "blank" }), newRow({ kind: "passage", text })], { writeAfter });
      const placed = drawn(page);
      const textRows = placed.filter((p) => owners[p.rowIndex] === 1 && p.segments[0]?.width);
      expect(textRows.length).toBeGreaterThan(1);
      // the caret right after the last word of each wrapped line
      let off = 0;
      for (const p of textRows) {
        const words = p.word.replace(/#.*$/, "").split(" ").filter((t) => !/^_\d+$/.test(t));
        off = text.indexOf(words.at(-1), off) + words.at(-1).length;
        const spot = caretOnSheet({ page, glyphMap: map, owners, rowIndex: 1, line: lines[1], offset: off });
        expect(spot.abs).toBe(p.rowIndex);
        expect(spot.x).toBeCloseTo(p.segments[0].width, 3);
        expect(caretFromSheet({ page, glyphMap: map, owners, abs: p.rowIndex, x: spot.x, lines })).toEqual({ rowIndex: 1, offset: off });
      }
    }
  });
  it("an empty row: the caret at its start; digits and element codes count as the rows keep them", () => {
    const { page, owners, lines } = setup([newRow({ kind: "blank" }), newRow({ text: "№1№2", repeat: "one", dots: "none" }), newRow({ kind: "element", text: "заборчик", repeat: "one" })]);
    const empty = caretOnSheet({ page, glyphMap: map, owners, rowIndex: 0, line: "", offset: 0 });
    expect(empty.abs).toBe(0);
    expect(empty.x).toBeGreaterThan(0);
    expect(lines[1]).toBe("12");
    const placed = drawn(page);
    expect(caretOnSheet({ page, glyphMap: map, owners, rowIndex: 1, line: "12", offset: 2, codes: CODES }).x).toBeCloseTo(placed.find((p) => p.rowIndex === 1).segments[0].width, 3);
    // an element is one symbol: the caret is before or after it, never inside its code
    expect(lines[2]).toBe("{э1}");
    const after = caretOnSheet({ page, glyphMap: map, owners, rowIndex: 2, line: lines[2], offset: 4, codes: CODES });
    expect(after.x).toBeGreaterThan(caretOnSheet({ page, glyphMap: map, owners, rowIndex: 2, line: lines[2], offset: 0, codes: CODES }).x);
    expect([0, 4]).toContain(caretFromSheet({ page, glyphMap: map, owners, abs: 2, x: after.x - 3, lines, codes: CODES }).offset);
  });
});
