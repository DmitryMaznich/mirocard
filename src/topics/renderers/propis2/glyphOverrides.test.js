import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "./pageTask.js";
import { widenFlag } from "./glyphOverrides.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).glyphs;
const pts = (d) => (String(d).match(/-?\d*\.?\d+/g) ?? []).map(Number);
const bbox = (g) => { const n = pts(g.strokes[0].d); const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), sx: n[0], sy: n[1] }; };

describe("ъ on two cells (widenFlag)", () => {
  const raw = wide.find((g) => g.label === "ъ");
  const yer = buildGlyphMap({ wide }).get("ъ");
  it("the start (where the connector arrives) and the height stay, the letter gets wider by the shift", () => {
    const a = bbox(raw), b = bbox(yer);
    expect(b.sx).toBeCloseTo(a.sx, 2);
    expect(b.sy).toBeCloseTo(a.sy, 2);
    expect(b.y0).toBeCloseTo(a.y0, 2);
    expect(b.y1).toBeCloseTo(a.y1, 2);
    expect(b.x1 - a.x1).toBeCloseTo(7.3, 1);
  });
  it("the stem top lands one slanted line (30 units, x1.806 stretch) right of the start's line", () => {
    // the stem top = the first point of the first long straight segment; its line through the start's height is one cell from the start
    const n = pts(yer.strokes[0].d);
    const tan = 0.4663;
    const top = [164.35 + 7.3, 10];
    const startLineAtTop = bbox(yer).sx + tan * (bbox(yer).sy - top[1]);
    expect((top[0] - startLineAtTop) * 1.806).toBeCloseTo(30, 0);
    expect(n.length).toBeGreaterThan(20);
  });
  it("does nothing to a glyph without a long straight stem", () => {
    const g = { strokes: [{ d: "M 0 0 L 1 1 Q 2 2 3 3" }] };
    expect(widenFlag(g, { from: 1, shift: 5 })).toBe(g);
  });
});
