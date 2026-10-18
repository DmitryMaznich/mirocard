import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "./pageTask.js";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { getPathEndpoints } from "../propis/pathGeometry.js";

// Flags of variant-deck glyphs made from another source (tools/propis2/variants/bg/font_glyphs.py): `noOverrides` keeps this bank's
// per-letter fixes (glyphOverrides.js) off them, `noExit` (the pen ends on the letter's left, Boyan's Ф) leaves the next letter unjoined.
const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).glyphs;
const д = wide.find((g) => g.label === "д");
const ink = (map, text) => layoutWideLinesIntoRows([text], map, undefined, false, 1).placed[0].segments.flatMap((s) => s.trajectory?.strokes ?? []);

describe("variant glyph flags", () => {
  it("noOverrides: the д of another source is taken as it is (the bank's д gets its tail straightened)", () => {
    const own = buildGlyphMap({ wide }).get("д");
    const free = buildGlyphMap({ wide: wide.map((g) => (g === д ? { ...g, noOverrides: true } : g)) }).get("д");
    expect(own.strokes[0].d).not.toBe(д.strokes[0].d);
    expect(free.strokes[0].d).toBe(д.strokes[0].d);
  });

  it("noExit: the next letter is not joined to it and stands after its ink", () => {
    const plain = buildGlyphMap({ wide });
    const flagged = buildGlyphMap({ wide: wide.map((g) => (g.label === "н" ? { ...g, noExit: true } : g)) });
    const joined = ink(plain, "на");
    const apart = ink(flagged, "на");
    expect(joined.slice(1).some((s) => s.continuous)).toBe(true);
    expect(apart.slice(1).some((s) => s.continuous)).toBe(false);
    const nEnd = Math.max(...apart[0].d.match(/-?\d*\.?\d+/g).map(Number).filter((_, i) => i % 2 === 0));
    expect(getPathEndpoints(apart.at(-1).d).start[0]).toBeGreaterThan(nEnd);
  });
});
