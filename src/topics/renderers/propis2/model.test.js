import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MARGINS, pageMargin, rowMaxX, clearPage, isLocked, pageFromPreset, presetFromPage, replaceSymbol, selectRowAt, findOutsideRow, appendTile, dropTile, lineOwners, analyzePage, analyzeRow, duplicateRow, findUnsupported, moveRow, newPage, newRow, pageFromLines, pageFromMarked, newSet, pageToLines, pickFragment, rowToLine, setPageStarts, setToLines, ROWS_PER_PAGE, wrapPassage } from "./model.js";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { buildGlyphMap } from "./pageTask.js";

function record() {
  const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
  const elements = JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements;
  return { wide: wide.glyphs, wideSheets: wide.sheets, elements, wideElementRepeat: wide.elementRepeat };
}
const map = buildGlyphMap(record());

describe("propis2 model", () => {
  it("turns rows into engine lines, an empty row is an empty ruled row, marks are kept", () => {
    const page = newPage("Т", { rows: [newRow({ text: " Н " , mark: "d" }), newRow({ text: "" }), newRow({ text: "кот" })] });
    expect(pageToLines(page)).toEqual(["Н#d", "", "кот"]);
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
    expect(findUnsupported("кот@", map)).toEqual(["@"]);
    expect(findUnsupported("a1", map)).toContain("a");
    expect(analyzeRow(newRow({ text: "кот~" }), map).unsupported).toEqual(["~"]);
    expect(analyzeRow(newRow({ text: "" }), map).empty).toBe(true);
  });

  it("flags a row that is too wide for the line", () => {
    expect(analyzeRow(newRow({ text: "кот" }), map, "narrow").overflow).toBe(false);
    expect(analyzeRow(newRow({ text: "молоко молоко молоко молоко молоко молоко" }), map, "narrow").overflow).toBe(true);
    const page = newPage("p", { rows: [newRow({ text: "кот" }), newRow({ text: "кот@" })] });
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

  it("punctuation: supported, stands after the word and is not joined to the last letter", () => {
    expect(findUnsupported("кот. Кот, кот! кот?", map)).toEqual([]);
    const lay = (line) => layoutWideLinesIntoRows([line], map, undefined, false, 0.5).placed[0].segments[0];
    const word = lay("кот");
    const marked = lay("кот.");
    expect(marked.strokes.length).toBe(word.strokes.length + 1);
    // no connector (transition) is added for the dot: the pen lifts, so the animation gains exactly one stroke
    expect(marked.trajectory.strokes.length).toBe(word.trajectory.strokes.length + 1);
    expect(marked.width).toBeGreaterThan(word.width);
    for (const mark of [",", "!", "?"]) expect(lay(`кот${mark}`).strokes.length).toBeGreaterThan(word.strokes.length);
  });

  it("wide ruling: only letters inside the row; capitals, б в д з р у ф ц щ and ! ? are outside, . , are fine", () => {
    expect(findOutsideRow("мама ими кот. нет,", map)).toEqual([]);
    expect(findOutsideRow("Мама", map)).toEqual(["М"]);
    expect(findOutsideRow("рыба", map).sort()).toEqual(["б", "р"].sort());
    expect(findOutsideRow("как!", map)).toEqual(["!"]);
    expect(findOutsideRow("кто?", map)).toEqual(["?"]);
    const bad = newRow({ text: "Фея" });
    expect(analyzeRow(bad, map, "wide").outside).toEqual(["Ф"]);
    expect(analyzeRow(bad, map, "narrow").outside).toEqual([]);
    const page = newPage("w", { ruling: "wide", rows: [newRow({ text: "мама" }), bad] });
    expect(analyzePage(page, map).problems).toBe(1);
  });

  it("tap on the sheet: an existing row is selected, an empty place gets a new row (blank rows fill the gap)", () => {
    const page = newPage("T", { rows: [newRow({ text: "а" })] });
    const same = selectRowAt(page, map, 0);
    expect(same.page).toBe(page);
    expect(same.rowId).toBe(page.rows[0].id);
    const below = selectRowAt(page, map, 3);
    expect(below.page.rows).toHaveLength(4);
    expect(below.page.rows.slice(1, 3).every((r) => r.kind === "blank")).toBe(true);
    expect(below.page.rows[3].id).toBe(below.rowId);
    expect(lineOwners(below.page, map)[3]).toBe(3); // the empty row stands on the row that was tapped
    // an empty page: the first tap on the first row selects the page's own empty row
    const empty = newPage("E");
    const first = selectRowAt(empty, map, 0);
    expect(first.rowId).toBe(empty.rows[0].id);
    // the writing space under a "write after" row is not a row: nothing is selected, nothing is added
    const wa = { ...newPage("W", { rows: [newRow({ text: "а" })] }), writeAfter: true };
    const under = selectRowAt(wa, map, 1);
    expect(under.page).toBe(wa);
    expect(under.rowId).toBeNull();
    // and below it a new row appears on the tapped place
    const beyond = selectRowAt(wa, map, 4);
    expect(lineOwners(beyond.page, map)[4]).toBe(beyond.page.rows.length - 1);
  });
});

describe("row params -> engine flags", () => {
  const row = (p) => newRow({ text: "и", ...p });
  it("defaults add no flags; legacy marks keep working", () => {
    expect(rowToLine(row({}))).toBe("и");
    expect(rowToLine(row({ mark: "c" }))).toBe("и#c");
    expect(rowToLine(row({ mark: "d" }))).toBe("и#d");
  });
  it("repeat, dots and copies style translate", () => {
    expect(rowToLine(row({ repeat: "one", dots: "none" }))).toBe("и#1#c");
    expect(rowToLine(row({ repeat: "fade", dots: "one", copies: "solid" }))).toBe("и#f#o#s");
    expect(rowToLine(row({ repeat: "one" }))).toBe("и#1#d");
  });
});

describe("engine row flags", () => {
  const seg = (line) => layoutWideLinesIntoRows([line], map).placed[0].segments[0];
  it("fade lowers copy opacity along the row and reaches zero by the middle", () => {
    const ops = seg("и и#f").strokes.slice(1).map((s) => s.opacity);
    expect(ops.length).toBeGreaterThan(3);
    for (let i = 1; i < ops.length; i++) expect(ops[i]).toBeLessThanOrEqual(ops[i - 1]);
    expect(ops[0]).toBeLessThan(1);
    expect(ops.at(-1)).toBe(0);
    expect(seg("и и#f").strokes.some((s) => "copyX" in s)).toBe(false);
  });
  it("flat by default, solid copies are not dashed", () => {
    expect(new Set(seg("и и").strokes.slice(1).map((s) => s.opacity)).size).toBe(1);
    const solid = seg("и и#s").strokes.slice(1);
    expect(solid.every((s) => !s.dashed && s.opacity < 0.6)).toBe(true);
  });
  it("dots: all copies / sample only / none", () => {
    expect(seg("и и").startPoints.length).toBeGreaterThan(2);
    expect(seg("и и#o").startPoints).toHaveLength(1);
    expect(seg("и и#c").startPoints).toHaveLength(0);
  });
});

describe("presets", () => {
  it("a page from a preset is locked, with fresh row ids and the preset's options; clearing opens it", () => {
    const src = newPage("Урок", { ruling: "wide", rows: [newRow({ text: "и", repeat: "fade", dots: "one" }), newRow({ text: "ини" })] });
    const ps = presetFromPage(src, "Мой");
    expect(ps.title).toBe("Мой");
    const page = pageFromPreset(ps);
    expect(isLocked(page)).toBe(true);
    expect(page.ruling).toBe("wide");
    expect(page.rows.map((r) => r.id)).not.toContain(src.rows[0].id);
    expect(page.rows[0]).toMatchObject({ text: "и", repeat: "fade", dots: "one" });
    const cleared = clearPage(page);
    expect(isLocked(cleared)).toBe(false);
    expect(cleared.rows).toHaveLength(1);
    expect(cleared.rows[0].text).toBe("");
  });
  it("on a locked page a symbol replaces the row's text and never adds rows", () => {
    const page = pageFromPreset(presetFromPage(newPage("x", { rows: [newRow({ text: "и" })] })));
    const id = page.rows[0].id;
    const next = replaceSymbol(page, id, { kind: "letter", text: "м" });
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].text).toBe("м");
    expect(replaceSymbol(page, "nope", { kind: "letter", text: "м" })).toBe(page);
  });
});

describe("margins", () => {
  it("a margin narrows the row by 15 mm and alternates; no margin keeps the full width", () => {
    expect(MARGINS.map((m) => m.id)).toEqual(["off", "left", "right"]);
    expect(pageMargin(newPage())).toBe("off");
    expect(rowMaxX(newPage("x", { margin: "left" }))).toBe(rowMaxX(newPage()) - 90);
    expect(rowMaxX(newPage("x", { margin: "right" }))).toBe(rowMaxX(newPage("x", { margin: "left" })));
  });
  it("fewer copies fit on a narrower row", () => {
    const full = layoutWideLinesIntoRows(["и и"], map, undefined, true, 1).placed[0].segments[0].strokes.length;
    const narrow = layoutWideLinesIntoRows(["и и"], map, undefined, true, 1, rowMaxX(newPage("x", { margin: "left" }))).placed[0].segments[0].strokes.length;
    expect(narrow).toBeLessThan(full);
  });
  it("the margin survives a preset", () => {
    expect(pageFromPreset(presetFromPage(newPage("x", { margin: "right", rows: [newRow({ text: "и" })] }))).margin).toBe("right");
  });
});
