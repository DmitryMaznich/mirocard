import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { layoutWideLinesIntoRows, WIDE_ZONE_UNITS } from "./wordEngine.js";
import { getPathEndpoints, samplePath } from "./pathGeometry.js";
import { scriptKey, scriptPointMap } from "./scriptGeometry.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
const rec = (script) => ({ wide: wide.glyphs, meta: script ? { script } : {} });
const BG = { slantDeg: 76 };
const BASE = 64; // wordEngine WIDE_BASELINE_Y
const row = (map, text, scale = 0.5) => layoutWideLinesIntoRows([text], map, undefined, false, scale).placed[0];
const strokesOf = (r) => r.segments.flatMap((s) => s.trajectory?.strokes ?? s.strokes);

describe("scriptGeometry: a deck's own slant and heights", () => {
  it("the Russian copybook (no script, or the defaults) changes nothing", () => {
    expect(scriptKey(undefined)).toBeNull();
    expect(scriptKey({ slantDeg: 65, upper: 1, lower: 1 })).toBeNull();
    const ru = buildGlyphMap(rec());
    expect(ru.script).toBeUndefined();
  });

  it("a 65deg line through the baseline becomes a 76deg one; the baseline and the lowercase band stay", () => {
    const fn = scriptPointMap(BG, { baseline: BASE, xHeight: 24 });
    const h = 40, t65 = Math.tan((25 * Math.PI) / 180), t76 = Math.tan((14 * Math.PI) / 180);
    const [x, y] = fn(100 + h * t65, BASE - h);
    expect(y).toBeCloseTo(BASE - h);
    expect(x).toBeCloseTo(100 + h * t76);
    expect(fn(100, BASE)).toEqual([100, BASE]);
  });

  it("upper / lower stretch only the parts above and below the lowercase band", () => {
    const fn = scriptPointMap({ upper: 1.5, lower: 1.5 }, { baseline: BASE, xHeight: 24 });
    expect(fn(0, BASE - 24)[1]).toBeCloseTo(BASE - 24);
    expect(fn(0, BASE - 48)[1]).toBeCloseTo(BASE - 24 - 36);
    expect(fn(0, BASE + 10)[1]).toBeCloseTo(BASE + 15);
  });

  it("a variant deck's rows are the Russian rows with every point mapped, and the pen path stays one joined line", () => {
    const ru = buildGlyphMap(rec());
    const bg = buildGlyphMap(rec(BG));
    expect(bg.script).toEqual(BG);
    for (const scale of [1, 0.5]) {
      const fn = scriptPointMap(BG, { baseline: BASE, xHeight: WIDE_ZONE_UNITS * scale });
      const a = strokesOf(row(ru, "мама шла", scale));
      const b = strokesOf(row(bg, "мама шла", scale));
      expect(b).toHaveLength(a.length);
      const start = getPathEndpoints(a[0].d).start;
      const moved = fn(start[0], start[1]);
      const got = getPathEndpoints(b[0].d).start;
      expect(got[0]).toBeCloseTo(moved[0], 2);
      expect(got[1]).toBeCloseTo(moved[1], 2);
      // where the Russian pen goes on without lifting, the Bulgarian one does too
      for (let i = 1; i < b.length; i += 1) {
        if (!b[i].continuous) continue;
        const end = getPathEndpoints(b[i - 1].d).end, next = getPathEndpoints(b[i].d).start;
        expect(Math.hypot(end[0] - next[0], end[1] - next[1])).toBeLessThan(0.01);
      }
    }
  });

  it("the stems of и stand at 76deg (the Russian ones at 65deg)", () => {
    // the slant of the pen where it runs straightest down: the angle most of the steep pieces of the path share
    const slant = (map) => {
      const pts = strokesOf(row(map, "и", 1)).flatMap((s) => samplePath(s.d, 20));
      const angles = [];
      for (let i = 1; i < pts.length; i += 1) {
        const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
        if (Math.hypot(dx, dy) < 0.05 || Math.abs(dy) < Math.abs(dx)) continue;
        angles.push((Math.atan2(Math.abs(dy), dy > 0 ? -dx : dx) * 180) / Math.PI);
      }
      angles.sort((a, b) => a - b);
      return angles[Math.floor(angles.length / 2)];
    };
    expect(slant(buildGlyphMap(rec()))).toBeCloseTo(65, -0.5);
    expect(slant(buildGlyphMap(rec(BG)))).toBeCloseTo(76, -0.5);
  });
});
