import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { appendTile, dropTile, lineOwners, analyzePage, analyzeRow, duplicateRow, findUnsupported, moveRow, newPage, newRow, pageFromLines, pageFromMarked, newSet, pageToLines, pickFragment, rowToLine, setPageStarts, setToLines, ROWS_PER_PAGE, wrapPassage } from "./model.js";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
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

  it("wraps running text into rows that fit, writes each wrapped line once, drops nothing", () => {
    const text = "мама мыла раму папа читал книгу кот спит на окне";
    const lines = wrapPassage(text, map, "narrow");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(text);
    for (const l of lines) expect(analyzeRow(newRow({ text: l }), map, "narrow").overflow).toBe(false);
    const page = newPage("t", { rows: [newRow({ kind: "passage", text })] });
    const out = pageToLines(page, map);
    expect(out.every((l) => l.endsWith("#1"))).toBe(true);
    expect(out.map((l) => l.replace(/#1$/, "")).join(" ")).toBe(text);
    // a single wrapped word is not multiplied across the row
    const { placed } = layoutWideLinesIntoRows(["кот#1", "кот"], map, undefined, true, 0.5);
    expect(placed[0].word.split(/\s+/).length).toBe(1);
    expect(placed[1].word.split(/\s+/).length).toBeGreaterThan(1);
  });

  it("blank rows and the write-after option become empty ruled rows, numbered the same everywhere", () => {
    const rows = [newRow({ text: "Н", mark: "d" }), newRow({ kind: "blank" }), newRow({ text: "кот" })];
    expect(pageToLines(newPage("a", { rows }), map)).toEqual(["Н#d", "", "кот"]);
    expect(pageToLines(newPage("a", { rows, writeAfter: true }), map)).toEqual(["Н#d", "", "", "кот", ""]);
    const { placed } = layoutWideLinesIntoRows(["кот", "", "кот"], map, undefined, true, 0.5);
    expect(placed.map((p) => p.segments.length)).toEqual([1, 0, 1]);
  });

  it("builds a new editable page from the rows marked for repetition (copies, source untouched)", () => {
    const src = newPage("Урок", { rows: [newRow({ text: "а", marked: true }), newRow({ text: "б" }), newRow({ text: "в", marked: true })] });
    const next = pageFromMarked(src);
    expect(next.title).toBe("Урок: повторение");
    expect(next.rows.map((r) => r.text)).toEqual(["а", "в"]);
    expect(next.rows.every((r) => !r.marked)).toBe(true);
    expect(next.rows.map((r) => r.id).some((id) => src.rows.some((r) => r.id === id))).toBe(false);
    expect(src.rows.filter((r) => r.marked)).toHaveLength(2);
    expect(pageFromMarked(newPage("пусто"))).toBeNull();
  });

  it("picks the tapped word of a row (first word for a single word or an unmeasured tap)", () => {
    expect(pickFragment("кот", 500, map)).toBe("кот");
    expect(pickFragment("кот кот кот", 0, map)).toBe("кот");
    const line = "мама мыла раму";
    expect(pickFragment(line, 0, map)).toBe("мама");
    expect(pickFragment(line, 100000, map)).toBe("раму");
    expect(pickFragment("", 5, map)).toBe("");
  });

  it("a set pads every page to a whole screen page, so each page of the set starts a fresh page", () => {
    const a = newPage("A", { rows: [newRow({ text: "а" }), newRow({ text: "б" })] });
    const b = newPage("B", { rows: [newRow({ text: "в" })] });
    const long = newPage("L", { rows: Array.from({ length: ROWS_PER_PAGE + 3 }, (_, i) => newRow({ text: `к${i % 2 ? "о" : "а"}т` })) });
    const byId = new Map([a, b, long].map((p) => [p.id, p]));
    const set = newSet("S", { pageIds: [a.id, b.id, long.id, "gone"] });
    const lines = setToLines(set, byId, map);
    // A: 2 lines + padding to ROWS_PER_PAGE, B: 1 line + padding, L: no trailing padding (last page)
    expect(lines.slice(0, 2)).toEqual(["а", "б"]);
    expect(lines.slice(2, ROWS_PER_PAGE).every((l) => l === "")).toBe(true);
    expect(lines[ROWS_PER_PAGE]).toBe("в");
    expect(lines[ROWS_PER_PAGE * 2]).toBe("кат");
    expect(lines).toHaveLength(ROWS_PER_PAGE * 2 + ROWS_PER_PAGE + 3);
    expect(setPageStarts(set, byId, map)).toEqual([1, 2, 3, null]);
  });

  it("the set's ruling replaces the pages' own ruling", () => {
    const a = newPage("A", { ruling: "wide", rows: [newRow({ text: "молоко молоко молоко молоко молоко молоко молоко" })] });
    const byId = new Map([[a.id, a]]);
    const narrow = setToLines(newSet("n", { ruling: "narrow", pageIds: [a.id] }), byId, map);
    const wide = setToLines(newSet("w", { ruling: "wide", pageIds: [a.id] }), byId, map);
    expect(narrow).toEqual(wide); // a text row is the same line; only the wrapping (passage) would differ
  });

  it("drag and drop: a tile on a filled row replaces it, keeps its mark; below the page it fills the gap with blank rows", () => {
    const page = newPage("Д", { rows: [newRow({ text: "Н", mark: "d" }), newRow({ text: "Ю" })] });
    const a = dropTile(page, map, 0, { kind: "text", text: "К" });
    expect(pageToLines(a.page, map)).toEqual(["К#d", "Ю"]);
    expect(a.page.rows[0].id).toBe(page.rows[0].id);
    expect(a.rowId).toBe(page.rows[0].id);
    const b = dropTile(page, map, 4, { kind: "element", text: "г1" });
    expect(pageToLines(b.page, map)).toEqual(["Н#d", "Ю", "", "", "г1"]);
    expect(b.page.rows.find((r) => r.id === b.rowId).kind).toBe("element");
  });

  it("drag and drop onto an empty page and onto rows the engine added (writeAfter)", () => {
    const empty = newPage("П");
    const first = dropTile(empty, map, 0, { kind: "text", text: "а" });
    expect(first.page.rows).toHaveLength(1);
    expect(pageToLines(first.page, map)).toEqual(["а"]);

    const wa = { ...newPage("W", { rows: [newRow({ text: "а" }), newRow({ text: "б" })] }), writeAfter: true };
    expect(lineOwners(wa, map)).toEqual([0, null, 1, null]);
    const mid = dropTile(wa, map, 1, { kind: "text", text: "в" }); // the auto blank under "а": a new row goes there
    expect(pageToLines(mid.page, map)).toEqual(["а", "", "в", "", "б", ""]);
    const end = dropTile(wa, map, 9, { kind: "text", text: "г" }); // below: just appended, no gap filling
    expect(pageToLines(end.page, map).filter(Boolean)).toEqual(["а", "б", "г"]);
  });

  it("tap on a tile appends below the last row and drops rows without text", () => {
    const page = newPage("Т", { rows: [newRow({ text: "а" }), newRow({ text: "" })] });
    const r = appendTile(page, map, { kind: "text", text: "б" });
    expect(r.page.rows.map((x) => x.text)).toEqual(["а", "б"]);
    expect(pageToLines(r.page, map)).toEqual(["а", "б"]);
  });
});
