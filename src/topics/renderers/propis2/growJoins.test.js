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

import { getPathEndpoints } from "../propis/pathGeometry.js";

const tailEndY = (map, word) => {
  const { placed } = layoutWideLinesIntoRows([word], map, undefined, false, 1);
  const st = placed[0].segments[0].strokes;
  return getPathEndpoints(st[1].d).end[1]; // о: body, connector, then the next letter
};

describe("meta.script.growJoins", () => {
  it("carries the connector up to the start of the next letter (top of the stem of и п р)", () => {
    const plain = mapOf(null), grown = mapOf({ growJoins: true });
    for (const next of ["и", "п", "н"]) expect(tailEndY(grown, "о" + next)).toBeLessThan(tailEndY(plain, "о" + next) - 5);
  });
  it("reaches the start of л м я when the connector stops a hair short", () => {
    const plain = mapOf(null), grown = mapOf({ growJoins: true });
    for (const y of ["л", "м", "я"]) expect(gapBetween(grown, "и", y)).toBeLessThanOrEqual(gapBetween(plain, "и", y));
  });
  it("does nothing without the flag (the Russian deck is unchanged)", () => {
    const plain = mapOf(null), other = mapOf({ slantDeg: 65 });
    for (const [x, y] of [["о", "л"], ["и", "я"]]) expect(gapBetween(other, x, y)).toBeCloseTo(gapBetween(plain, x, y), 3);
  });
});

describe("meta.script.topJoins", () => {
  const exitEnd = (map, word) => {
    const { placed } = layoutWideLinesIntoRows([word], map, undefined, false, 1);
    const st = placed[0].segments[0].strokes;
    return { end: getPathEndpoints(st[0].d).end, next: getPathEndpoints(st[1].d).start };
  };
  it("takes the exit of п и н … up to the top point of a letter that starts at the top, the letter standing where it stood", () => {
    const plain = mapOf(null), top = mapOf({ topJoins: true });
    for (const w of ["пи", "ин", "пр", "ит"]) {
      const a = exitEnd(plain, w), b = exitEnd(top, w);
      expect(b.end[1]).toBeLessThan(a.end[1] - 5);          // ends high, at the start of the next letter
      expect(Math.hypot(b.end[0] - b.next[0], b.end[1] - b.next[1])).toBeLessThan(0.5);
      expect(b.next[0]).toBeCloseTo(a.next[0], 3);            // the distance is the one of the Russian deck
    }
  });
  it("leaves the joins to letters that start at the middle line (о а д …) as they are", () => {
    const plain = mapOf(null), top = mapOf({ topJoins: true });
    for (const w of ["по", "иа", "нд"]) expect(exitEnd(top, w).end[1]).toBeCloseTo(exitEnd(plain, w).end[1], 3);
  });
});
