import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "./pageTask.js";
import { newPage, newRow, pageToLines } from "./model.js";
import { fieldFromRows, insertToken, inferRowKind, rowIdAtCaret, rowsFromField } from "./fieldText.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
const elements = JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements;
const map = buildGlyphMap({ wide: wide.glyphs, elements, wideElementRepeat: wide.elementRepeat ?? {} });
const page = newPage("p");

describe("field text <-> rows", () => {
  it("each line is a row; the field starts at the chosen row and shows the tail only", () => {
    const rows = [newRow({ text: "а" }), newRow({ text: "б" }), newRow({ kind: "blank" }), newRow({ text: "в" }), newRow({ text: "" })];
    expect(fieldFromRows(rows, 0)).toBe("а\nб\n\nв");
    expect(fieldFromRows(rows, 1)).toBe("б\n\nв");
    expect(fieldFromRows(rows, 3)).toBe("в");
  });

  it("typing from an empty field appends rows below the last one; Enter makes the next row; no row from nothing", () => {
    const rows = [newRow({ text: "а" }), newRow({ text: "" })];
    expect(rowsFromField({ rows, startId: null, value: "", glyphMap: map, page }).rows).toBe(rows);
    const r = rowsFromField({ rows, startId: null, value: "и\nм\nмама", glyphMap: map, page });
    expect(r.rows.map((x) => x.text)).toEqual(["а", "и", "м", "мама"]);
    expect(r.firstId).toBe(r.rows[1].id);
  });

  it("editing from a chosen row rewrites that tail only and keeps ids and options of the rows that stay", () => {
    const rows = [newRow({ text: "а" }), newRow({ text: "б", repeat: "fade" }), newRow({ text: "в" })];
    const r = rowsFromField({ rows, startId: rows[1].id, value: "бб\nв\nг", glyphMap: map, page });
    expect(r.rows.map((x) => x.text)).toEqual(["а", "бб", "в", "г"]);
    expect(r.rows[0]).toBe(rows[0]);
    expect(r.rows[1].id).toBe(rows[1].id);
    expect(r.rows[1].repeat).toBe("fade");
    // a new line takes the options of the row above it
    expect(r.rows[3].repeat).toBe(r.rows[2].repeat);
    // deleting lines removes the rows
    expect(rowsFromField({ rows, startId: rows[1].id, value: "б", glyphMap: map, page }).rows.map((x) => x.text)).toEqual(["а", "б"]);
  });

  it("a new line copies the options of the row above (fade stays fade)", () => {
    const rows = [newRow({ text: "и", repeat: "fade", dots: "one" })];
    const r = rowsFromField({ rows, startId: rows[0].id, value: "и\nм", glyphMap: map, page });
    expect(r.rows[1]).toMatchObject({ text: "м", repeat: "fade", dots: "one" });
  });

  it("an empty line is a blank writing row", () => {
    const rows = [newRow({ text: "а" })];
    const r = rowsFromField({ rows, startId: rows[0].id, value: "а\n\nб", glyphMap: map, page });
    expect(r.rows.map((x) => x.kind)).toEqual(["text", "blank", "text"]);
    expect(pageToLines({ ...page, rows: r.rows }, map).slice(0, 3).map((l) => l.replace(/(#\w)+$/, ""))).toEqual(["а", "", "б"]);
  });

  it("running text: any space makes the row text (leading and trailing too); an own choice wins", () => {
    expect(inferRowKind("мама", map, page)).toBe("text");
    expect(inferRowKind("м", map, page)).toBe("text");
    expect(inferRowKind("мама ", map, page)).toBe("passage");
    expect(inferRowKind("и м", map, page)).toBe("passage");
    expect(inferRowKind(" м", map, page)).toBe("passage"); // a leading space too: the text starts further right
    expect(inferRowKind("   мама", map, page)).toBe("passage");
    expect(inferRowKind("мама мыла раму", map, page, false)).toBe("text");
    expect(inferRowKind("мама", map, page, true)).toBe("passage");
    expect(inferRowKind("   ", map, page)).toBe("blank");
  });

  it("the caret's line is the row it stands in", () => {
    const rows = [newRow({ text: "а" }), newRow({ text: "б" }), newRow({ text: "в" })];
    expect(rowIdAtCaret(rows, rows[1].id, "б\nв", 0)).toBe(rows[1].id);
    expect(rowIdAtCaret(rows, rows[1].id, "б\nв", 2)).toBe(rows[2].id);
  });

  it("an element id goes in at the caret as a word of its own, mid-line too", () => {
    expect(insertToken("", 0, "г1")).toEqual({ value: "г1", caret: 2 });
    expect(insertToken("кот", 3, "г1")).toEqual({ value: "кот г1", caret: 6 });
    expect(insertToken("кот мама", 3, "г1")).toEqual({ value: "кот г1 мама", caret: 6 });
    expect(insertToken("а\nб", 1, "г1").value).toBe("а г1\nб");
    expect(insertToken("а\n\nб", 2, "г1").value).toBe("а\nг1\nб");
  });

  it("an element inside running text is laid out as a word of the text", () => {
    const rows = [newRow({ text: "кот г1 мама", kind: "passage" })];
    const lines = pageToLines({ ...page, rows }, map);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join(" ")).toContain("г1");
  });

  it("Enter in the middle of a row, or a deleted line, does not push the rows below out of step with their options", () => {
    const rows = [newRow({ text: "аа", repeat: "one" }), newRow({ text: "бб", repeat: "fade" }), newRow({ text: "вв", repeat: "all", dots: "none" })];
    const id = (r) => r.id;
    const split = rowsFromField({ rows, startId: rows[0].id, value: "а\nа\nбб\nвв", glyphMap: map, page }).rows;
    expect(split.map((r) => r.text)).toEqual(["а", "а", "бб", "вв"]);
    expect(split[2].id).toBe(rows[1].id);
    expect(split[2].repeat).toBe("fade");
    expect(split[3].id).toBe(rows[2].id);
    expect(split[3].dots).toBe("none");
    expect(split[0].id).toBe(rows[0].id);
    expect(split[1].repeat).toBe("one"); // the new line takes the options of the row above
    const gone = rowsFromField({ rows, startId: rows[0].id, value: "аа\nвв", glyphMap: map, page }).rows;
    expect(gone.map(id)).toEqual([rows[0].id, rows[2].id]);
    expect(gone[1].dots).toBe("none");
  });
});

describe("elements in curly braces", () => {
  it("shows whole-word element ids as {code} and turns the codes back into ids", async () => {
    const { bracesIn, bracesOut } = await import("./fieldText.js");
    const codes = new Map([["5", "э1"], ["01_pryamaya_liniya", "э2"]]);
    expect(bracesIn("5 мама 55\n01_pryamaya_liniya 5", codes)).toBe("{э1} мама 55\n{э2} {э1}");
    expect(bracesOut("{э1} мама 55\n{э2} {э1}", codes)).toBe("5 мама 55\n01_pryamaya_liniya 5");
    expect(bracesOut("{5} {zzz}", codes)).toBe("5 zzz");
    expect(bracesIn("мама", new Map())).toBe("мама");
  });
});
