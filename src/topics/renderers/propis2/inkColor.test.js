// «Цвет пера» (owner, 2026-11-27): a row's pen colour reaches the laid-out row; blue is no flag at all; the colour is the line's last flag
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "./pageTask.js";
import { pageToLines, newPage, newRow, rowSetting, mixedRowSettings, INHERITED_ROW_KEYS } from "./model.js";
import { layoutWideLinesIntoRows } from "../../../handwriting/wordEngine.js";
import { INK_COLORS, inkColorOf, INK_COLOR } from "../../../handwriting/propisRuling.js";

const wide = JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8"));
const map = buildGlyphMap({ wide: wide.glyphs });

describe("pen colour of a row", () => {
  it("a coloured row ends its line with #n<id>, a blue one has no flag", () => {
    const page = newPage("t", { rows: [newRow({ text: "мама", ink: "black" }), newRow({ text: "папа" }), newRow({ text: "кот", ink: "blue" })] });
    const lines = pageToLines(page, map);
    expect(lines[0]).toMatch(/#nblack$/);
    expect(lines.slice(1).some((l) => l.includes("#n"))).toBe(false);
  });
  it("the engine takes the flag off: the row is laid out as without it and carries `ink`", () => {
    const plain = layoutWideLinesIntoRows(["мама"], map, undefined).placed[0];
    const inked = layoutWideLinesIntoRows(["мама#ngreen"], map, undefined).placed[0];
    expect(inked.ink).toBe("green");
    expect(JSON.stringify(inked.segments)).toBe(JSON.stringify(plain.segments));
    expect(plain.ink).toBeUndefined();
  });
  it("the colour comes after the other flags (a style row) and the rows keep their own", () => {
    const res = layoutWideLinesIntoRows(["мама#1#c#nviolet", "папа"], map, undefined).placed;
    expect(res.map((r) => r.ink)).toEqual(["violet", undefined]);
  });
  it("the setting as the panel shows it; a new row takes the colour of the row above; mixed on the page", () => {
    expect(rowSetting({ text: "a" }, "ink")).toBe("blue");
    expect(rowSetting({ text: "a", ink: "black" }, "ink")).toBe("black");
    expect(INHERITED_ROW_KEYS).toContain("ink");
    expect(mixedRowSettings([{ kind: "text", text: "a", ink: "black" }, { kind: "text", text: "b" }], map).ink).toBe(true);
  });
  it("no red in the palette (the start dots and the margin are red); an unknown id draws blue", () => {
    expect(Object.keys(INK_COLORS)).toEqual(["blue", "black", "green", "violet"]);
    expect(inkColorOf("red")).toBe(INK_COLOR);
  });
});
