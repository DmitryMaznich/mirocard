import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { methodNotebooks, kitToLibraryItems, PAGE_FORMATS, pageFormat, pageAspect, rowsPerPage, MARGINS, pageMargin, rowMaxX, rowParams, multipliesByDefault, clearPage, isLocked, pageFromPreset, presetFromPage, replaceSymbol, selectRowAt, findOutsideRow, appendTile, dropTile, lineOwners, analyzePage, analyzeRow, duplicateRow, findUnsupported, moveRow, newPage, newRow, pageFromLines, pageFromMarked, newSet, pageToLines, pickFragment, rowToLine, setPageStarts, setToLines, ROWS_PER_PAGE, wrapPassage } from "./model.js";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { buildGlyphMap } from "./pageTask.js";

function record() {
  const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
  const elements = JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements;
  return { wide: wide.glyphs, wideSheets: wide.sheets, elements, wideElementRepeat: wide.elementRepeat };
}
const map = buildGlyphMap(record());

// rows as the ready sheets / older pages have them: no explicit repeat, the engine's own rule
const oldRow = (patch = {}) => newRow({ repeat: "auto", ...patch });

describe("propis2 model", () => {
  it("turns rows into engine lines, an empty row is an empty ruled row, marks are kept", () => {
    const page = newPage("Т", { rows: [oldRow({ text: " Н " , mark: "d" }), oldRow({ text: "" }), oldRow({ text: "кот" })] });
    expect(pageToLines(page)).toEqual(["Н#d", "", "кот"]);
    expect(rowToLine(oldRow({ text: "а  б", mark: "c" }))).toBe("а _1 б#c");
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
    const rows = [oldRow({ text: "а" }), oldRow({ text: "б" }), oldRow({ text: "в" })];
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
    expect(analyzeRow(oldRow({ text: "кот~" }), map).unsupported).toEqual(["~"]);
    expect(analyzeRow(oldRow({ text: "" }), map).empty).toBe(true);
  });

  it("flags a row that is too wide for the line", () => {
    expect(analyzeRow(oldRow({ text: "кот" }), map, "narrow").overflow).toBe(false);
    expect(analyzeRow(oldRow({ text: "молоко молоко молоко молоко молоко молоко" }), map, "narrow").overflow).toBe(true);
    const page = newPage("p", { rows: [oldRow({ text: "кот" }), oldRow({ text: "кот@" })] });
    expect(analyzePage(page, map).problems).toBe(1);
  });

  it("wraps running text into rows that fit, writes each wrapped line once, drops nothing", () => {
    const text = "мама мыла раму папа читал книгу кот спит на окне";
    const lines = wrapPassage(text, map, "narrow");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(text);
    for (const l of lines) expect(analyzeRow(oldRow({ text: l }), map, "narrow").overflow).toBe(false);
    const page = newPage("t", { rows: [oldRow({ kind: "passage", text })] });
    const out = pageToLines(page, map);
    expect(out.every((l) => l.endsWith("#1"))).toBe(true);
    expect(out.map((l) => l.replace(/#1$/, "")).join(" ")).toBe(text);
    // a single wrapped word is not multiplied across the row
    const { placed } = layoutWideLinesIntoRows(["кот#1", "кот"], map, undefined, true, 0.5);
    expect(placed[0].word.split(/\s+/).length).toBe(1);
    expect(placed[1].word.split(/\s+/).length).toBeGreaterThan(1);
  });

  it("blank rows and the write-after option become empty ruled rows, numbered the same everywhere", () => {
    const rows = [oldRow({ text: "Н", mark: "d" }), oldRow({ kind: "blank" }), oldRow({ text: "кот" })];
    expect(pageToLines(newPage("a", { rows }), map)).toEqual(["Н#d", "", "кот"]);
    expect(pageToLines(newPage("a", { rows, writeAfter: true }), map)).toEqual(["Н#d", "", "", "кот", ""]);
    const { placed } = layoutWideLinesIntoRows(["кот", "", "кот"], map, undefined, true, 0.5);
    expect(placed.map((p) => p.segments.length)).toEqual([1, 0, 1]);
  });

  it("builds a new editable page from the rows marked for repetition (copies, source untouched)", () => {
    const src = newPage("Урок", { rows: [oldRow({ text: "а", marked: true }), oldRow({ text: "б" }), oldRow({ text: "в", marked: true })] });
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
    const RPP = rowsPerPage(newPage("x", { ruling: "narrow" })); // 17 rows on the narrow ruling
    const a = newPage("A", { rows: [oldRow({ text: "а" }), oldRow({ text: "б" })] });
    const b = newPage("B", { rows: [oldRow({ text: "в" })] });
    const long = newPage("L", { rows: Array.from({ length: RPP + 3 }, (_, i) => oldRow({ text: `к${i % 2 ? "о" : "а"}т` })) });
    const byId = new Map([a, b, long].map((p) => [p.id, p]));
    const set = newSet("S", { pageIds: [a.id, b.id, long.id, "gone"] });
    const lines = setToLines(set, byId, map);
    // A: 2 lines + padding to RPP, B: 1 line + padding, L: no trailing padding (last page)
    expect(lines.slice(0, 2)).toEqual(["а", "б"]);
    expect(lines.slice(2, RPP).every((l) => l === "")).toBe(true);
    expect(lines[RPP]).toBe("в");
    expect(lines[RPP * 2]).toBe("кат");
    expect(lines).toHaveLength(RPP * 2 + RPP + 3);
    expect(setPageStarts(set, byId, map)).toEqual([1, 2, 3, null]);
  });

  it("the set's ruling replaces the pages' own ruling", () => {
    const a = newPage("A", { ruling: "wide", rows: [oldRow({ text: "молоко молоко молоко молоко молоко молоко молоко" })] });
    const byId = new Map([[a.id, a]]);
    const narrow = setToLines(newSet("n", { ruling: "narrow", pageIds: [a.id] }), byId, map);
    const wide = setToLines(newSet("w", { ruling: "wide", pageIds: [a.id] }), byId, map);
    expect(narrow).toEqual(wide); // a text row is the same line; only the wrapping (passage) would differ
  });

  it("drag and drop: a tile on a filled row replaces it, keeps its mark; below the page it fills the gap with blank rows", () => {
    const page = newPage("Д", { rows: [oldRow({ text: "Н", mark: "d" }), oldRow({ text: "Ю" })] });
    const a = dropTile(page, map, 0, { kind: "text", text: "К" });
    expect(pageToLines(a.page, map)).toEqual(["К#d", "Ю"]);
    expect(a.page.rows[0].id).toBe(page.rows[0].id);
    expect(a.rowId).toBe(page.rows[0].id);
    const b = dropTile(page, map, 4, { kind: "element", text: "г1" });
    expect(pageToLines(b.page, map)).toEqual(["Н#d", "Ю", "", "", "г1#r"]);
    expect(b.page.rows.find((r) => r.id === b.rowId).kind).toBe("element");
  });

  it("drag and drop onto an empty page and onto rows the engine added (writeAfter)", () => {
    const empty = newPage("П");
    const first = dropTile(empty, map, 0, { kind: "text", text: "а" });
    expect(first.page.rows).toHaveLength(1);
    expect(pageToLines(first.page, map)).toEqual(["а#r"]);

    const wa = { ...newPage("W", { rows: [oldRow({ text: "а" }), oldRow({ text: "б" })] }), writeAfter: true };
    expect(lineOwners(wa, map)).toEqual([0, null, 1, null]);
    const mid = dropTile(wa, map, 1, { kind: "text", text: "в" }); // the auto blank under "а": a new row goes there
    expect(pageToLines(mid.page, map)).toEqual(["а", "", "в#r", "", "б", ""]);
    const end = dropTile(wa, map, 9, { kind: "text", text: "г" }); // below: just appended, no gap filling
    expect(pageToLines(end.page, map).filter(Boolean)).toEqual(["а", "б", "г#r"]);
  });

  it("tap on a tile appends below the last row and drops rows without text", () => {
    const page = newPage("Т", { rows: [oldRow({ text: "а" }), oldRow({ text: "" })] });
    const r = appendTile(page, map, { kind: "text", text: "б" });
    expect(r.page.rows.map((x) => x.text)).toEqual(["а", "б"]);
    expect(pageToLines(r.page, map)).toEqual(["а", "б#r"]);
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
    const bad = oldRow({ text: "Фея" });
    expect(analyzeRow(bad, map, "wide").outside).toEqual(["Ф"]);
    expect(analyzeRow(bad, map, "narrow").outside).toEqual([]);
    const page = newPage("w", { ruling: "wide", rows: [oldRow({ text: "мама" }), bad] });
    expect(analyzePage(page, map).problems).toBe(1);
  });

  it("tap on the sheet: an existing row is selected, an empty place gets a new row (blank rows fill the gap)", () => {
    const page = newPage("T", { rows: [oldRow({ text: "а" })] });
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
    const wa = { ...newPage("W", { rows: [oldRow({ text: "а" })] }), writeAfter: true };
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
  it("a new row repeats across the row with a dot at every copy; old rows keep the sheet's marks", () => {
    expect(rowToLine(row({}))).toBe("и#r");
    expect(rowToLine(newRow({ text: "и", repeat: "auto", mark: "c" }))).toBe("и#c");
    expect(rowToLine(newRow({ text: "и", repeat: "auto", mark: "d" }))).toBe("и#d");
    expect(rowToLine(newRow({ text: "и", repeat: "auto" }))).toBe("и");
    expect(rowParams({ text: "и", mark: "c" })).toMatchObject({ repeat: "auto", dots: "none" });
  });
  it("repeat, dots and copies style translate", () => {
    expect(rowToLine(row({ repeat: "one", dots: "none" }))).toBe("и#1#c");
    expect(rowToLine(row({ repeat: "one", dots: "one" }))).toBe("и#1#o");
    expect(rowToLine(row({ repeat: "one" }))).toBe("и#r#x"); // the sample alone, dots mark every place the child starts
    expect(rowToLine(row({ repeat: "fade", dots: "one", copies: "solid" }))).toBe("и#f#o#s");
    expect(rowToLine(row({ repeat: "all", dots: "none" }))).toBe("и#r#c");
  });
  it("an explicit dots choice on an old row replaces its mark", () => {
    expect(rowToLine(newRow({ text: "и", repeat: "auto", mark: "d", dots: "none" }))).toBe("и#c");
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

describe("page formats", () => {
  it("A5 is the default; A4 has more rows and a wider line, the margin still takes 15 mm", () => {
    expect(PAGE_FORMATS.map((f) => f.id)).toEqual(["a5", "a4"]);
    const a5 = newPage("x");
    const a4 = newPage("x", { format: "a4" });
    expect(pageFormat(a5)).toBe("a5");
    expect(rowsPerPage(a5)).toBe(17); // narrow: all 17 ruling rows of the printed notebook
    expect(rowsPerPage(a4)).toBe(24);
    expect(rowsPerPage(newPage("x", { ruling: "wide" }))).toBe(16); // wide: the first ruling row is the top edge of the first band
    expect(rowsPerPage(newPage("x", { ruling: "wide", format: "a4" }))).toBe(23);
    expect(pageAspect(a4)).toBeCloseTo(210 / 297, 5);
    expect(rowMaxX(a4)).toBeGreaterThan(rowMaxX(a5) + 300);
    expect(rowMaxX(newPage("x", { format: "a4", margin: "left" }))).toBe(rowMaxX(a4) - 90);
  });
  it("sets pad pages to whole A4 pages", () => {
    const a = newPage("a", { format: "a4", rows: [newRow({ text: "и" })] });
    const b = newPage("b", { format: "a4", rows: [newRow({ text: "м" })] });
    const lines = setToLines(newSet("s", { pageIds: [a.id, b.id] }), new Map([[a.id, a], [b.id, b]]), map);
    expect(lines.length).toBe(rowsPerPage(a) + 1);
  });
});

describe("row options act on a single symbol and on mixed rows", () => {
  const seg = (line) => layoutWideLinesIntoRows([line], map, undefined, true, 1).placed[0].segments[0];
  it("a single letter is multiplied across the row (all) and fades (fade); «one» stays single", () => {
    expect(seg("и").strokes.length).toBe(1);
    expect(seg("и#r").strokes.length).toBeGreaterThan(5);
    const ops = seg("и#f").strokes.slice(1).map((s) => s.opacity);
    expect(ops.length).toBeGreaterThan(5);
    expect(ops[0]).toBeLessThan(1);
    expect(ops.at(-1)).toBe(0);
    expect(seg("и#1").strokes.length).toBe(1);
  });
  it("a mixed sequence repeats as a whole", () => {
    const toks = layoutWideLinesIntoRows(["и м#r"], map, undefined, true, 1).placed[0];
    expect(toks.segments[0].strokes.length).toBeGreaterThan(6);
  });
  it("dots «all» with a single sample: no copies drawn, a dot at every place across the row", () => {
    const s = seg("и#r#x");
    expect(s.strokes.length).toBe(1);
    expect(s.strokes.some((st) => st.dashed)).toBe(false);
    expect(s.startPoints.length).toBe(seg("и#r").startPoints.length);
    expect(s.startPoints.length).toBeGreaterThan(5);
  });
  it("dots «sample only» and «none» on a multiplied row", () => {
    expect(seg("и#r#o").startPoints).toHaveLength(1);
    expect(seg("и#r#c").startPoints).toHaveLength(0);
  });
  it("solid copies are not dashed, also while fading", () => {
    const st = seg("и#f#s").strokes.slice(1);
    expect(st.every((x) => !x.dashed)).toBe(true);
    expect(st[0].opacity).toBeLessThan(1);
  });
  it("what the sheet's own rule multiplies is shown as «all», the rest as «one»", () => {
    expect(multipliesByDefault("мама", map)).toBe(true);
    expect(multipliesByDefault("и и", map)).toBe(true);
    expect(multipliesByDefault("и", map)).toBe(false);
    expect(multipliesByDefault("и м", map)).toBe(false);
  });
});

describe("spaces before running text", () => {
  it("leading spaces become an indent flag on the first line only", () => {
    const rows = [newRow({ kind: "passage", text: "   мама мыла раму" })];
    const lines = pageToLines({ ...newPage("x"), rows }, map);
    expect(lines[0]).toMatch(/#1#i3$/);
    const wrapped = pageToLines({ ...newPage("x"), rows: [newRow({ kind: "passage", text: "  " + Array(40).fill("мама").join(" ") })] }, map);
    expect(wrapped.length).toBeGreaterThan(1);
    expect(wrapped[0]).toMatch(/#i2$/);
    expect(wrapped[1]).not.toMatch(/#i/);
  });
  it("the engine starts the row that many slant cells in", () => {
    const x0 = (line) => {
      const st = layoutWideLinesIntoRows([line], map, undefined, true, 1).placed[0].segments[0].startPoints[0];
      return st[0];
    };
    const shift = x0("и#1#i3") - x0("и#1");
    expect(shift).toBeGreaterThan(80);
    expect(Math.abs(shift - 3 * 30)).toBeLessThan(2);
  });
});

describe("extra spaces between words of running text", () => {
  const x1 = (line) => layoutWideLinesIntoRows([line], map, undefined, true, 1).placed[0].segments[0].startPoints.map((p) => p[0]);
  it("every space beyond the first adds a slant cell; the first one is the usual gap", () => {
    expect(wrapPassage("мама мыла", map, "wide")).toEqual(["мама мыла"]);
    expect(wrapPassage("мама  мыла", map, "wide")).toEqual(["мама _1 мыла"]);
    expect(wrapPassage("мама    мыла раму", map, "narrow")).toEqual(["мама _3 мыла раму"]);
    expect(wrapPassage("   мама мыла", map, "wide")).toEqual(["мама мыла"]); // leading spaces are the indent
  });
  it("the engine moves the next word right by that many cells", () => {
    const gap = (line) => { const [a, b] = x1(line); return b - a; };
    // (the plain gap itself is kept at a visible minimum, so extra cells are compared with each other)
    expect(gap("мама _3 мыла#1") - gap("мама _1 мыла#1")).toBeCloseTo(60, 0);
  });
  it("a tap on the row still finds the words, not the spacers", () => {
    expect(pickFragment("мама _2 мыла", 5, map, "wide")).toBe("мама");
  });
  it("the row's lines carry the spacers into the page", () => {
    const rows = [newRow({ kind: "passage", text: "мама   мыла" })];
    expect(pageToLines({ ...newPage("x", { ruling: "wide" }), rows }, map)[0]).toMatch(/^мама _2 мыла#1$/);
  });
});

describe("long text wraps by the grid the page is drawn with", () => {
  it("no wrapped line is wider than the row, whatever the slant frequency, ruling and margin", async () => {
    const { snapXFor } = await import("../propis/PrintPageView.jsx");
    const text = "мама мыла раму и  пошла  гулять в лес  собирать грибы и ягоды, а потом пришла домой и стала варить кашу для всей большой семьи";
    for (const ruling of ["narrow", "wide"]) for (const grid of ["regular", "dense"]) for (const margin of ["off", "left"]) {
      const page = newPage("p", { ruling, grid, margin, rows: [newRow({ kind: "passage", text })] });
      const snap = snapXFor({ narrowRows: ruling === "narrow", simpleGrid: grid, margin, format: "a5" });
      const lines = pageToLines(page, map);
      expect(lines.length).toBeGreaterThan(1);
      lines.forEach((l, i) => {
        for (const idx of [i, i + 16]) {
          const { placed } = layoutWideLinesIntoRows([l], map, (r, x, y) => snap(idx, x, y), false, ruling === "narrow" ? 0.5 : 1);
          expect(placed[0].segments[0].width, `${ruling} ${grid} ${margin} row ${idx}`).toBeLessThanOrEqual(rowMaxX(page));
        }
      });
    }
  });
});

describe("«Методика» kits (kits.json, built from the v1 notebooks' content lists)", () => {
  const kits = JSON.parse(readFileSync("src/topics/renderers/propis2/kits.json", "utf-8")).kits;
  it("the notebooks are there, every page fits one page and every letter has a glyph", () => {
    expect(kits.map((k) => k.id)).toEqual(["letters-1", "letters-2", "syllables", "words-1", "words-2", "texts"]);
    for (const k of kits) {
      expect(k.pages.length, k.id).toBeGreaterThan(5);
      for (const pg of k.pages) {
        expect(pg.rows.length, `${k.id} ${pg.title}`).toBeLessThanOrEqual(17);
        for (const r of pg.rows) expect(findUnsupported(r.text, map), `${k.id} «${r.text}»`).toEqual([]);
      }
    }
  });
  it("a kit becomes a set of locked pages that belong to it", () => {
    const { set, pages } = kitToLibraryItems(kits[0]);
    expect(set.pageIds).toHaveLength(kits[0].pages.length);
    expect(pages.every((p) => p.locked && p.kitId === set.id && p.ruling === "narrow" && p.margin === "left")).toBe(true);
    expect(new Set(pages.flatMap((p) => p.rows.map((r) => r.id))).size).toBe(pages.reduce((n, p) => n + p.rows.length, 0));
    expect(pageToLines(pages[0], map)[0]).toMatch(/^и#f/);
  });
  it("letter pages: practice with fading copies, then independent writing with a sample at the start", () => {
    const first = kits[0].pages;
    expect(first[0].title).toContain("И и"); // a pair: the capital first, then the lowercase
    expect(first[0].rows[0]).toMatchObject({ text: "и", repeat: "fade" });
    expect(first[0].rows[3]).toMatchObject({ text: "И  и", asText: false, gap: 2 });
    expect(first[1].rows[0]).toMatchObject({ text: "и", repeat: "one", dots: "one" });
    const last = kits[1].pages.at(-1);
    expect(last.rows.every((r) => !/[ЁЙЫ]/.test(r.text))).toBe(true); // no capital glyph for those: lowercase only
  });
});

describe("the connector to the next letter is not part of о б ю э ф в", () => {
  const strokes = (line) => layoutWideLinesIntoRows([line], map, undefined, false, 1).placed[0].segments[0].strokes.length;
  it("written alone these letters have no connector; with a letter after them they get it", () => {
    for (const L of ["о", "б", "ю", "э", "ф", "в"]) {
      expect(strokes(`${L}и`) - strokes(L), L).toBe(2); // и itself + the connector
    }
  });
  it("letters whose final hook is their own stroke keep it alone and add nothing when followed", () => {
    for (const L of ["г", "п", "т", "и", "н", "к", "л", "м", "я", "ш", "с", "х", "ж"]) { // с х ж: the same curve, but it is part of the letter
      expect(strokes(`${L}и`) - strokes(L), L).toBe(1);
    }
  });
  it("the capitals that already had a separate connector are unchanged", () => {
    for (const L of ["Г", "Р", "О", "Б", "Ю", "Э"]) expect(strokes(`${L}и`) - strokes(L), L).toBe(2);
  });

});

describe("pairs «Аа»: capital first, a gap inside the pair, a bigger one between pairs", () => {
  const xs = (line) => layoutWideLinesIntoRows([line], map, undefined, true, 0.5).placed[0].segments[0].startPoints.map((p) => p[0]);
  it("extra spaces of a sample row become slant cells", () => {
    expect(rowToLine(newRow({ text: "И  и", repeat: "one", dots: "none" }))).toBe("И _1 и#1#c");
    expect(rowToLine(newRow({ text: "И   и", repeat: "all", gap: 2 }))).toBe("И _2 и#r#g2");
  });
  it("the units of a multiplied row are told apart by the unit gap", () => {
    const plain = xs("И _1 и#r");
    const apart = xs("И _1 и#r#g2");
    expect(plain.length).toBeGreaterThan(5);
    // within a pair the same distance, the next pair starts 2 cells (30 units at the narrow scale) later each time
    expect(apart[1] - apart[0]).toBeCloseTo(plain[1] - plain[0], 0);
    expect(apart[2] - apart[1]).toBeGreaterThan(plain[2] - plain[1] + 20);
  });
});

describe("fade copies", () => {
  it("the connector inside a faded copy fades with it (never stays at full opacity)", () => {
    const seg = layoutWideLinesIntoRows(["ба#f"], map, undefined, true, 0.5).placed[0].segments[0];
    const copies = seg.strokes.filter((s) => s.opacity !== undefined);
    expect(copies.length).toBeGreaterThan(3);
    expect(copies.every((s) => s.opacity >= 0 && s.opacity <= 1)).toBe(true);
    // the last copies are fully faded, connector included
    expect(copies.slice(-3).every((s) => s.opacity === 0)).toBe(true);
  });

  it("the methodology workbook: part 1 (part1, page3..7) is on the WIDE ruling, part 2 (part2, page8..18) on the NARROW one, every sheet is there", () => {
    const rec = record();
    const labels = new Set([...rec.elements.map((e) => e.id), ...rec.wide.filter((g) => g.kind === "element").map((g) => g.label)]);
    const [one, two] = methodNotebooks(rec.wideSheets, labels);
    expect(one.page.ruling).toBe("wide");
    expect(two.page.ruling).toBe("narrow");
    expect(one.pages.map((p) => p.title)).toEqual(["Лист 1", "Лист с л, м, я", "Лист с о", "Лист с а, ю, с", "Лист с е, ё, э, х, ж", "Лист с ч, ь, ы, ъ"]);
    expect(two.pages).toHaveLength(12);
    expect(two.pages.at(-1).title).toBe("Заглавные Н, Ю, К");
    // the rows are the transcribed workbook rows: nothing lost
    expect(one.pages[1].rows.map((r) => r.text)).toEqual(rec.wideSheets.page3.map((l) => l.replace(/#[dc]$/, "")));
    const { set, pages } = kitToLibraryItems(one);
    expect(set.ruling).toBe("wide");
    expect(pages.every((p) => p.ruling === "wide" && p.locked)).toBe(true);
  });

describe("words never touch", () => {
  const inkEnds = (line) => {
    const xs = (d) => (d.match(/-?\d+\.?\d*/g) || []).map(Number).filter((_, i) => i % 2 === 0);
    const seg = (l) => layoutWideLinesIntoRows([l + "#1"], map, undefined, false, 0.5).placed[0].segments[0];
    const [a, b] = line.split(" ");
    const first = seg(a);
    const both = seg(line);
    const aMax = Math.max(...first.strokes.flatMap((s) => xs(s.d)));
    const bMin = Math.min(...both.strokes.slice(first.strokes.length).flatMap((s) => xs(s.d)));
    return bMin - aMax;
  };
  it("a word whose first letter has its ink left of its start point (с а о д) keeps a visible gap from the word before", () => {
    for (const pair of ["любит спать", "ест спать", "мят спать", "в стол", "и дом", "тепло и", "кот отдых"]) expect(inkEnds(pair), pair).toBeGreaterThanOrEqual(12);
  });
  it("signs repeated in a row keep their measured step", () => {
    const strokes = layoutWideLinesIntoRows(["с с с"], map, undefined, true, 0.5).placed[0].segments[0].strokes;
    expect(strokes.length).toBeGreaterThan(5);
  });
});

describe("capital У joins like о", () => {
  const seg = (l) => layoutWideLinesIntoRows([l + "#1"], map, undefined, false, 0.5).placed[0].segments[0];
  const nums = (d) => (d.match(/-?\d+\.?\d*/g) || []).map(Number);
  const cubics = (st) => (st.d.match(/C/g) || []).length;
  it("the letter is whole with its hook (the hook is a stroke of the letter, not a connector); the connector is a stroke of its own", () => {
    const alone = seg("У");
    const joined = seg("Ут");
    expect(joined.strokes[0].d).toBe(alone.strokes[0].d); // not cut
    expect(cubics(joined.strokes[1])).toBeLessThanOrEqual(2);
    expect(joined.strokes.length).toBe(alone.strokes.length + 1 + seg("т").strokes.length);
    expect(seg("У").strokes.length).toBe(alone.strokes.length); // nothing added without a following letter
  });
  it("the connector leaves the LOWEST point of the letter and rises to the right", () => {
    const joined = seg("Ут");
    const body = nums(joined.strokes[0].d);
    let low = -Infinity;
    for (let i = 1; i < body.length; i += 2) low = Math.max(low, body[i]);
    const conn = nums(joined.strokes[1].d);
    expect(conn[1]).toBeCloseTo(low, 0);
    expect(conn[conn.length - 2]).toBeGreaterThan(conn[0] + 15);
    expect(conn[conn.length - 1]).toBeLessThan(conn[1] - 10);
  });
  it("arrives at the same grid point as the exit of Ч (У starts like Ч): the end of every connector of this kind", () => {
    const endOf = (st) => { const n = nums(st.d); return [n[n.length - 2], n[n.length - 1]]; };
    const u = seg("Ут");
    const ch = seg("Чт");
    const uEnd = endOf(u.strokes[1]);
    const chExit = endOf(ch.strokes[ch.strokes.length - 1 - seg("т").strokes.length]); // the last stroke of Ч itself is its exit
    expect(uEnd[0]).toBeCloseTo(chExit[0], 0);
    expect(uEnd[1]).toBeCloseTo(chExit[1], 0);
  });
});
});

describe("running text writes a repeated word in full", () => {
  it("a word that occurs twice in a once-written row is not a dashed copy", () => {
    const { placed } = layoutWideLinesIntoRows(["я не но я#1", "я я"], map, undefined, true, 0.5);
    const dashedIn = (r) => placed[r].segments.flatMap((s) => s.strokes).filter((st) => st.dashed).length;
    expect(dashedIn(0)).toBe(0);
    expect(dashedIn(1)).toBeGreaterThan(0); // a sample row keeps its copies
  });
});

describe("digits and signs (captured 2026-10-06)", () => {
  it("are glyphs of their own (№-labels), never joined, never reported as unsupported, and do not clash with elements 5-8", () => {
    expect(findUnsupported("№1№5 №+ №= №- №< №> №0", map)).toEqual([]);
    expect(map.get("5").kind).toBe("element"); // the methodology element keeps its name
    expect(map.get("№5").kind).toBe("digit");
    // as tall as a capital letter: on the wide ruling they leave the band like capitals do
    expect(findOutsideRow("№1 №5", map)).toEqual(["№1", "№5"]);
    expect(findOutsideRow("мама", map)).toEqual([]);
    const { placed } = layoutWideLinesIntoRows(["№2 №+ №3 №= №5#1"], map, undefined, true, 0.5);
    expect(placed[0].segments[0].strokes.length).toBeGreaterThan(5);
  });
});
