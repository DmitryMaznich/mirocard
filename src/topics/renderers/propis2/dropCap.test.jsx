import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import PrintPageView from "../propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "./pageTask.js";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { newRow, newPage, pageToLines, withRowDrop, pageHasDropRows, dropReserve, dropIndent, lineOwners, duplicateRow } from "./model.js";
import { caretAtLineStart, caretAtLineEnd } from "./fieldText.js";
import { caretOnSheet } from "./caret.js";
import { dropGeometry, dropLetters, suggestDrop, DROP_FRAME_MM, DROP_MAX_WIDTH, DROP_ROW_INDENT_CELLS } from "./dropCap.js";
import { mmToNativeUnits } from "../propis/propisRuling.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
const elements = JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements;
const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
const topicRecord = { ...topic, wide: wide.glyphs, wideSheets: wide.sheets, elements, wideElementRepeat: wide.elementRepeat };
const glyphMap = buildGlyphMap(topicRecord);

const pageOf = (rows, patch = {}) => newPage("t", { rows, ...patch });
const rowsOf = (...specs) => specs.map(([text, drop, kind]) => newRow({ text, kind: kind ?? "text", ...(drop ? { drop } : {}) }));

describe("the printed letter of a row (a «буквица»)", () => {
  it("the first line of a row carries it as the flag #bX; a blank row and a passage too", () => {
    const lines = pageToLines(pageOf(rowsOf(["и и", "И"], ["", "Ж", "blank"], ["Иван идёт домой", "Д", "passage"])), glyphMap);
    expect(lines[0]).toMatch(/#bИ$/);
    expect(lines[1]).toBe("#bЖ");
    expect(lines[2]).toMatch(/#1.*#bД$|#1#bД$/);
  });

  it("every row that was given a letter carries it (what is set is what is seen)", () => {
    const lines = pageToLines(pageOf(rowsOf(["и", "И"], ["иду", "И"], ["жук", "Ж"], ["иду", null])), glyphMap);
    expect(lines.map((l) => /#b(.)/.exec(l)?.[1] ?? null)).toEqual(["И", "И", "Ж", null]);
  });

  it("a copy of a row (Дубль) does not carry the letter: it is another row of the same letter without a frame of its own", () => {
    const rows = rowsOf(["и и", "И"]);
    const next = duplicateRow(rows, 0);
    expect(next).toHaveLength(2);
    expect(next[0].drop).toBe("И");
    expect("drop" in next[1]).toBe(false);
    expect("dropSide" in next[1]).toBe(false);
    expect(next[1].text).toBe("и и");
  });

  it("a row without a letter gives the same line as before (no flag)", () => {
    expect(pageToLines(pageOf(rowsOf(["и и", null])), glyphMap)).toEqual(pageToLines(pageOf([newRow({ text: "и и" })]), glyphMap));
  });

  it("the engine keeps the letter on the placed row and draws the same ink with it or without it", () => {
    const withFlag = layoutWideLinesIntoRows(["и и#bИ"], glyphMap, undefined, true, 0.5).placed[0];
    const without = layoutWideLinesIntoRows(["и и"], glyphMap, undefined, true, 0.5).placed[0];
    expect(withFlag.drop).toBe("И");
    expect(without.drop).toBeUndefined();
    expect(JSON.stringify(withFlag.segments)).toBe(JSON.stringify(without.segments));
  });
});

describe("the letter and the margin are independent", () => {
  it("putting a letter on a row or taking it off changes nothing but the row", () => {
    const page = pageOf(rowsOf(["и", null], ["ж", null]));
    const a = withRowDrop(page, page.rows[0].id, "И");
    expect(a.rows[0].drop).toBe("И");
    expect(a.rows[0].dropSide).toBe("left");
    expect(withRowDrop(page, page.rows[0].id, "И", "right").rows[0].dropSide).toBe("right");
    expect(a.rows[1]).toEqual(page.rows[1]);
    expect(a.margin).toBe(page.margin); // the margin is the adult's: never switched on for a letter
    expect(a.marginAuto).toBeUndefined();
    const b = withRowDrop(a, a.rows[0].id, null);
    expect(b.rows.some((r) => "drop" in r || "dropSide" in r)).toBe(false);
  });

  it("with a margin the letter stands in it and the row is written as before", () => {
    const page = pageOf(rowsOf(["и и", "И"]), { margin: "left" });
    expect(pageToLines(page, glyphMap)[0]).toBe(`${pageToLines(pageOf(rowsOf(["и и", null]), { margin: "left" }), glyphMap)[0]}#bИ`);
    expect(dropReserve(page, 0)).toBe(0);
    // ...on whichever side it was put: a margin takes the letter, the row is not narrowed
    const right = pageOf([newRow({ text: "и и", drop: "И", dropSide: "right" })], { margin: "right" });
    expect(pageToLines(right, glyphMap)[0]).toMatch(/#BИ$/);
    expect(pageToLines(right, glyphMap)[0]).not.toContain("#w");
  });

  it("without a margin a LEFT letter moves the ink of its row in, a RIGHT one ends the row earlier; the rows below are written edge to edge", () => {
    const page = pageOf([newRow({ text: "и и", drop: "И" }), newRow({ text: "иду" }), newRow({ text: "жук", drop: "Ж", dropSide: "right" })]);
    expect(dropReserve(page, 0)).toBe(DROP_ROW_INDENT_CELLS);
    expect(dropIndent(page, 0)).toBe(DROP_ROW_INDENT_CELLS);
    expect(dropReserve(page, 1)).toBe(0);
    expect(dropReserve(page, 2)).toBe(DROP_ROW_INDENT_CELLS);
    expect(dropIndent(page, 2)).toBe(0); // the ink of a right-letter row starts where it always does
    const lines = pageToLines(page, glyphMap);
    expect(lines[0]).toContain(`#i${DROP_ROW_INDENT_CELLS}`);
    expect(lines[0]).toMatch(/#bИ$/);
    expect(lines[1]).not.toMatch(/#[ibwB]/);
    expect(lines[2]).toContain(`#w${DROP_ROW_INDENT_CELLS}`);
    expect(lines[2]).not.toContain("#i");
    expect(lines[2]).toMatch(/#BЖ$/);
  });

  it("the engine ends a RIGHT-letter row earlier: the copies of the row stop that many cells before the usual edge", () => {
    const snap = (rowIndex, x) => x;
    const rightmost = (line) => Math.max(...layoutWideLinesIntoRows([line], glyphMap, snap, true, 0.5, 400).placed[0].segments.flatMap((sg) => sg.strokes.flatMap((st) => (String(st.d).match(/-?\d*\.?\d+/g) ?? []).filter((_, i) => i % 2 === 0).map(Number))));
    const full = rightmost("и и");
    const cut = rightmost(`и и#w${DROP_ROW_INDENT_CELLS}`);
    expect(cut).toBeLessThan(full);
    expect(cut).toBeLessThanOrEqual(400 - DROP_ROW_INDENT_CELLS * 15 + 1);
    const left = rightmost(`и и#i${DROP_ROW_INDENT_CELLS}`);
    expect(left).toBeLessThanOrEqual(400 + 1); // a LEFT letter moves the start in, and the copies still stop at the edge
  });

  it("the engine tells the side of the letter", () => {
    expect(layoutWideLinesIntoRows(["и#bИ"], glyphMap, undefined, true, 0.5).placed[0].dropSide).toBe("left");
    expect(layoutWideLinesIntoRows(["и#BИ"], glyphMap, undefined, true, 0.5).placed[0].dropSide).toBe("right");
  });

  it("the ink of the row really starts further in, by whole slant cells (it stays on the lines)", () => {
    const snap = (rowIndex, x) => x; // any grid: the shift is the same whatever the lines are
    const base = layoutWideLinesIntoRows(["иду"], glyphMap, snap, true, 0.5).placed[0].segments[0].strokes[0].d;
    const moved = layoutWideLinesIntoRows([`иду#i${DROP_ROW_INDENT_CELLS}`], glyphMap, snap, true, 0.5).placed[0].segments[0].strokes[0].d;
    const x0 = Number(/M ([\d.-]+)/.exec(base)[1]);
    const x1 = Number(/M ([\d.-]+)/.exec(moved)[1]);
    expect(x1 - x0).toBeCloseTo(DROP_ROW_INDENT_CELLS * 15, 1);
  });

  it("a running text with a letter wraps with the shifted first line, and the caret stands after the ink (not under the frame)", () => {
    const page = pageOf(rowsOf(["Иван идёт домой и несёт большой арбуз с рынка", "И", "passage"]));
    const owners = lineOwners(page, glyphMap);
    expect(owners.length).toBeGreaterThan(0);
    const spot = caretOnSheet({ page, glyphMap, owners, rowIndex: 0, line: page.rows[0].text, offset: 0, codes: new Map() });
    const free = caretOnSheet({ page: { ...page, rows: [{ ...page.rows[0], drop: undefined }] }, glyphMap, owners, rowIndex: 0, line: page.rows[0].text, offset: 0, codes: new Map() });
    expect(spot.x - free.x).toBeGreaterThan(DROP_ROW_INDENT_CELLS * 15 * 0.8);
  });

  it("only the narrow ruling of the methodology paper takes letters", () => {
    expect(pageHasDropRows(pageOf([], { ruling: "narrow" }))).toBe(true);
    expect(pageHasDropRows(pageOf([], { ruling: "wide" }))).toBe(false);
    expect(pageHasDropRows(pageOf([], { ruling: "narrow", gridKind: "square", grid: "square" }))).toBe(false);
  });
});

describe("where the caret may put a letter", () => {
  it("a RIGHT letter goes at the end of a line (an empty row is both its start and its end)", () => {
    const text = "и и и\nжук\n\nщука";
    expect(caretAtLineEnd(text, 5)).toBe(true);
    expect(caretAtLineEnd(text, 9)).toBe(true);
    expect(caretAtLineEnd(text, 10)).toBe(true); // the empty row
    expect(caretAtLineEnd(text, text.length)).toBe(true);
    expect(caretAtLineEnd(text, 3)).toBe(false);
    expect(caretAtLineEnd(text, 6)).toBe(false);
    expect(caretAtLineStart(text, 10) && caretAtLineEnd(text, 10)).toBe(true);
  });

  it("only at the start of a line of the field text", () => {
    const text = "и и и\nжук\n\nщука";
    expect(caretAtLineStart(text, 0)).toBe(true); // the start of the field
    expect(caretAtLineStart(text, 6)).toBe(true); // after the first newline: the start of «жук»
    expect(caretAtLineStart(text, 3)).toBe(false); // mid-row
    expect(caretAtLineStart(text, 5)).toBe(false); // at the end of a row
    expect(caretAtLineStart(text, 10)).toBe(true); // an empty row
    expect(caretAtLineStart(text, 11)).toBe(true); // «щука»
    expect(caretAtLineStart(text, 13)).toBe(false);
    expect(caretAtLineStart("", 0)).toBe(true);
  });
});

describe("the frame on the sheet", () => {
  const render = (margin, lines = ["и и#bИ", "жук#bЖ"]) =>
    renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord, lines, narrowRows: true, grid: "dense", margin })} bare />);

  it("stands in the margin with a margin on and at the start of its row without one", () => {
    expect(render("left").match(/data-drop="/g)?.length).toBe(2);
    const off = render("off", ["и#bИ"]);
    expect(off.match(/data-drop="/g)?.length).toBe(1);
    const [x] = /<g data-drop="И" data-drop-side="[a-z]+"><rect x="([\d.-]+)"/.exec(off).slice(1).map(Number);
    const inMargin = /<g data-drop="И" data-drop-side="[a-z]+"><rect x="([\d.-]+)"/.exec(render("left", ["и#bИ"]));
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(Number(inMargin[1]) + 60); // by the left edge of the content, not far in
  });

  it("the frame is 8 mm square and its lower edge lies on the baseline of the row", () => {
    const html = render("left", ["и#bИ"]);
    const rect = /<g data-drop="И" data-drop-side="[a-z]+"><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/.exec(html);
    const [x, y, w, h] = rect.slice(1).map(Number);
    expect(w).toBeCloseTo(mmToNativeUnits(DROP_FRAME_MM), 1);
    expect(h).toBeCloseTo(w, 1);
    // the baseline of the first narrow row: the bold line drawn at the same y
    const base = y + h;
    expect(html).toContain(`y1="${+base.toFixed(3)}"`.replace(/\.?0+"$/, '"'));
  });

  it("a RIGHT letter without a margin stands at the right end of the row, at the right edge of the ink; the × is drawn only where the editor asks for it", () => {
    const left = render("off", ["и#bИ"]);
    const right = render("off", ["и#BИ#w5"]);
    expect(right).toContain('data-drop-side="right"');
    const xl = Number(/<g data-drop="И"[^>]*><rect x="([\d.-]+)"/.exec(left)[1]);
    const xr = Number(/<g data-drop="И"[^>]*><rect x="([\d.-]+)"/.exec(right)[1]);
    expect(xr).toBeGreaterThan(xl + 300); // at the other end of the sheet
    expect(right).not.toContain("data-drop-remove");
    const withCross = renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord, lines: ["и#BИ#w5"], narrowRows: true, grid: "dense", margin: "off" })} bare onDropRemove={() => {}} />);
    expect(withCross).toContain("data-drop-remove");
  });

  it("with a margin the letter stands in it, whichever end it was put at", () => {
    const inLeft = render("left", ["и#bИ"]);
    const rightWithLeftMargin = render("left", ["и#BИ"]);
    const x = (h) => Number(/<g data-drop="И"[^>]*><rect x="([\d.-]+)"/.exec(h)[1]);
    expect(x(rightWithLeftMargin)).toBeCloseTo(x(inLeft), 1);
  });

  it("sits in the middle of the margin zone, the zone between the page edge and the red line", () => {
    const html = render("left", ["и#bИ"]);
    const [x, , w] = /<g data-drop="И" data-drop-side="[a-z]+"><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)"/.exec(html).slice(1).map(Number);
    const line = Number(/<line x1="([\d.]+)" y1="0" x2="\1" y2="[\d.]+" stroke="#c0392b"/.exec(html)[1]);
    expect(x + w / 2).toBeCloseTo(line / 2, 0);
  });
});

describe("the letter in its frame", () => {
  it("wide capitals are fitted into the frame, the others stand at the same size", () => {
    const frame = mmToNativeUnits(DROP_FRAME_MM);
    const ws = (l) => { const g = dropGeometry(l); return g.fontSize; };
    expect(ws("И")).toBe(ws("А"));
    for (const l of "ЖШЩЮ") expect(ws(l)).toBeLessThan(ws("И"));
    for (const l of dropLetters(topicRecord, glyphMap)) expect(dropGeometry(l).fontSize * 1.2).toBeLessThanOrEqual(frame * 10); // sane
    expect(dropGeometry("Щ").capHeight).toBeLessThan(frame * 0.6);
    expect(DROP_MAX_WIDTH).toBeLessThan(1);
  });

  it("offers the capitals of the alphabet (no Ъ Ы Ь) and hints the first letter of the row", () => {
    const letters = dropLetters(topicRecord, glyphMap);
    expect(letters).toContain("А");
    expect(letters).toContain("Я");
    for (const l of "ЪЫЬ") expect(letters).not.toContain(l);
    expect(suggestDrop({ text: "иду" }, letters)).toBe("И");
    expect(suggestDrop({ text: "э-дуга" }, letters)).toBe("Э");
    expect(suggestDrop({ text: "5" }, letters)).toBeNull();
    expect(suggestDrop({ text: "" }, letters)).toBeNull();
  });
});
