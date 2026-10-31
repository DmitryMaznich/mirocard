import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { samplePath } from "../propis/pathGeometry.js";
import { withGlyphOverrides } from "./glyphOverrides.js";

// meta.script.growJoins (the Kazakh variant): what the grid nudges cannot close between a connector and the next letter is closed by a straight piece
const wide = withGlyphOverrides(JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).glyphs);
const mapOf = (script) => { const m = new Map(wide.map((g) => [g.label, g])); for (const g of wide) for (const a of g.aliases ?? []) m.set(a, g); if (script) m.script = script; return m; };
const labels = [..."абвгдежзийклмнопрстуфхцчщъьэюя"].filter((c) => wide.find((g) => g.label === c && g.strokes) || wide.find((g) => g.aliases?.includes(c) && g.strokes));
const gapBetween = (map, a, b) => {
  const { placed } = layoutWideLinesIntoRows([a + b], map, undefined, false, 1);
  const st = placed[0].segments[0].strokes;
  const gB = map.get(b); const nB = Math.max(1, gB.strokes.length - (Number.isInteger(gB.tailStroke) ? 1 : 0));
  let best = Infinity;
  for (const s of st.slice(0, st.length - nB)) for (const q of samplePath(s.d, 80)) for (const s2 of st.slice(st.length - nB)) for (const r of samplePath(s2.d, 80)) best = Math.min(best, Math.hypot(q[0] - r[0], q[1] - r[1]));
  return best;
};

describe("meta.script.growJoins", () => {
  it("closes a gap that stays without the flag, and leaves the ones that were closed alone", () => {
    const plain = mapOf(null), grown = mapOf({ growJoins: true });
    let found = null;
    outer: for (const a of labels) for (const b of labels) { const g = gapBetween(plain, a, b); if (g > 2 && g < 20) { found = [a, b, g]; break outer; } }
    expect(found, "the Russian bank has a pair with a visible gap").not.toBeNull();
    const [a, b] = found;
    expect(gapBetween(grown, a, b)).toBeLessThan(0.8);
    for (const [x, y] of [["и", "н"], ["о", "н"], ["т", "и"]]) expect(gapBetween(grown, x, y)).toBeCloseTo(gapBetween(plain, x, y), 0);
  });
  it("does nothing without the flag (the Russian deck is unchanged)", () => {
    const plain = mapOf(null), other = mapOf({ slantDeg: 65 });
    for (const [x, y] of [["о", "л"], ["и", "я"]]) expect(gapBetween(other, x, y)).toBeCloseTo(gapBetween(plain, x, y), 3);
  });
});
