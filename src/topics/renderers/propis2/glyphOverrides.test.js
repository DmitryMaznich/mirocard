import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "./pageTask.js";
import { markStem } from "./glyphOverrides.js";
import { wideGlyphLocal } from "../propis/wordEngine.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).glyphs;
const pts = (d) => (String(d).match(/-?\d*\.?\d+/g) ?? []).map(Number);

describe("ъ stands by its stem (stemOnLine)", () => {
  const map = buildGlyphMap({ wide });
  const yer = map.get("ъ");
  it("the shape and the size of the letter are the captured ones", () => {
    const raw = wide.find((g) => g.label === "ъ");
    expect(yer.strokes[0].d).toBe(raw.strokes[0].d);
  });
  it("the anchor is the top of the stem (the start of its first long straight segment)", () => {
    expect(yer.stemAnchor[0]).toBeCloseTo(164.35, 1);
    expect(yer.stemAnchor[1]).toBeCloseTo(10, 1);
  });
  it("the line through the stem lies 0.56 of a cell (30 units, x1.806 stretch) right of the start's line, in the layout's units", () => {
    const l = wideGlyphLocal(yer, 1);
    expect(l.stemDx).toBeGreaterThan(14);
    expect(l.stemDx).toBeLessThan(19);
    // narrow rows: scaled with the letter
    expect(wideGlyphLocal(yer, 0.6).stemDx / l.stemDx).toBeCloseTo(0.6, 1);
  });
  it("other letters are snapped by their start as before", () => {
    for (const lab of ["ь", "н", "к", "у", "о"]) expect(wideGlyphLocal(map.get(lab), 1).stemDx).toBe(0);
  });
  it("a glyph without a long straight segment gets no anchor", () => {
    const g = { strokes: [{ d: "M 0 0 L 1 1 Q 2 2 3 3" }] };
    expect(markStem(g)).toBe(g);
    expect(pts(g.strokes[0].d).length).toBeGreaterThan(0);
  });
});
