import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { layoutWideLinesIntoRows } from "./wordEngine.js";
import { samplePath } from "./pathGeometry.js";

// Writing without joins (docs/latin-letters.md, step 3.3): meta.script.joins === false — every letter of a word stands apart, after the
// ink of the one before at script.letterGap, and no connector is drawn. Tried on the Russian letters: the flag is the style's, not the
// alphabet's.
const wide = JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8"));
const map = (script) => buildGlyphMap({ wide: wide.glyphs, meta: script ? { script } : {} });
const row = (m, text, scale = 0.5) => layoutWideLinesIntoRows([text], m, undefined, false, scale).placed[0];
const strokesOf = (r) => r.segments.flatMap((sg) => sg.strokes);
const own = (label) => wide.glyphs.find((g) => g.label === label).strokes.length;
const inkX = (stroke) => samplePath(stroke.d, 60).map((p) => p[0]);

describe("writing without joins (script.joins === false)", () => {
  it("no letter touches the next: the cursive word joins them, the print one leaves the gap between every pair", () => {
    const scale = 0.5;
    // «мама»: one stroke per letter in the capture (the connectors are part of the letters' strokes when joined)
    const gaps = (r) => { const st = strokesOf(r); return st.slice(1).map((sx, i) => Math.min(...inkX(sx)) - Math.max(...inkX(st[i]))); };
    expect(own("м") + own("а")).toBe(2);
    const joined = gaps(row(map(), "мама", scale));
    const apart = gaps(row(map({ joins: false, letterGap: 20 }), "мама", scale));
    expect(Math.max(...joined)).toBeLessThan(1); // joined: every letter reaches the next
    expect(apart.length).toBe(3);
    for (const g of apart) expect(g).toBeCloseTo(20 * scale, 0);
  });

  it("each letter stands after the ink of the one before, the gap as asked", () => {
    const scale = 0.5;
    for (const gap of [12, 30]) {
      // («ии» would not do: the bank has it as ONE composed letter)
      const strokes = strokesOf(row(map({ joins: false, letterGap: gap }), "ам", scale));
      const first = strokes.slice(0, own("а")), second = strokes.slice(own("а"));
      const right = Math.max(...first.flatMap(inkX)), left = Math.min(...second.flatMap(inkX));
      expect(left - right).toBeCloseTo(gap * scale, 0);
    }
  });

  it("`spaceAboveBase` (the British f): the gap before the letter is measured from its ink above the baseline, not from a tail under it", () => {
    const scale = 0.5;
    const gap = 20;
    // у: its tail reaches left under the line; flagged, the gap is from the left of its cup instead
    const plain = map({ joins: false, letterGap: gap });
    const flagged = buildGlyphMap({ wide: wide.glyphs.map((g) => (g.label === "у" ? { ...g, spaceAboveBase: true } : g)), meta: { script: { joins: false, letterGap: gap } } });
    const leftOf = (m, below) => {
      const st = strokesOf(row(m, "ау", scale));
      const right = Math.max(...st.slice(0, own("а")).flatMap(inkX));
      const pts = st.slice(own("а")).flatMap((s) => samplePath(s.d, 60));
      const base = Math.max(...st.slice(0, own("а")).flatMap((s) => samplePath(s.d, 60).map((p) => p[1])));
      return Math.min(...pts.filter((p) => below || p[1] <= base + 0.5).map((p) => p[0])) - right;
    };
    expect(leftOf(plain, true)).toBeCloseTo(gap * scale, 0); // the whole ink
    expect(leftOf(flagged, false)).toBeCloseTo(gap * scale, 0); // the ink above the line
    expect(leftOf(flagged, true)).toBeLessThan(gap * scale); // ...its tail closer
  });

  it("a composed letter stays whole: the hooks of ш keep touching, the letters around it stand apart", () => {
    const scale = 0.5;
    const apartMap = map({ joins: false, letterGap: 20 });
    const gapsOf = (st) => st.slice(1).map((sx, i) => Math.min(...inkX(sx)) - Math.max(...inkX(st[i])));
    const sh = strokesOf(row(apartMap, "ш", scale));
    expect(sh.length).toBe(strokesOf(row(map(), "ш", scale)).length);
    for (const g of gapsOf(sh)) expect(g).toBeLessThan(1); // its pieces join
    const word = strokesOf(row(apartMap, "иши", scale));
    expect(word.length).toBe(sh.length + 2 * own("и"));
    const g = gapsOf(word);
    expect(g[0]).toBeCloseTo(20 * scale, 0); // и | ш
    expect(g[g.length - 1]).toBeCloseTo(20 * scale, 0); // ш | и
  });

  it("without the flag the cursive layout is untouched", () => {
    for (const text of ["мама мыла раму", "Друг дуб", "щука, ёж"]) {
      expect(JSON.stringify(row(map({ joins: true }), text))).toBe(JSON.stringify(row(map(), text)));
    }
  });
});
