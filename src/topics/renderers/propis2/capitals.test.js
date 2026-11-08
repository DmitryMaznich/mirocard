import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "./pageTask.js";
import { layoutWideLinesIntoRows } from "../../../handwriting/wordEngine.js";
import { snapXFor } from "../../../handwriting/PrintPageView.jsx";
import { TEXT_ROW_WIDE_DIAGONAL_SPACING } from "../../../handwriting/propisRuling.js";
import { samplePath } from "../../../handwriting/pathGeometry.js";

const wide = JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8"));
const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
const map = buildGlyphMap({ ...topic, wide: wide.glyphs, wideSheets: wide.sheets, elements: [], wideElementRepeat: wide.elementRepeat });
const CELL = TEXT_ROW_WIDE_DIAGONAL_SPACING * 0.5; // the narrow ruling
const snap = snapXFor({ narrowRows: true, simpleGrid: "dense", margin: "off", format: "a5", narrow17: true });
const lay = (word) => layoutWideLinesIntoRows([`${word}#1`], map, snap, false, 0.5).placed[0].segments[0];

const ink = (seg) => {
  let min = Infinity, max = -Infinity;
  for (const s of seg.strokes) for (const [x] of samplePath(s.d, 40)) { min = Math.min(min, x); max = Math.max(max, x); }
  return [min, max];
};

describe("capitals one after another are written apart (owner, 2026-11-01)", () => {
  for (const word of ["СССР", "МХАТ", "КГБ", "НТВ", "ИВАН"]) {
    it(`${word}: every capital has its own start dots and the letters stand about one cell apart`, () => {
      const letters = [...word].map((ch) => lay(ch));
      const whole = lay(word);
      // each capital keeps the start dots it has alone: nothing is joined to the previous letter
      expect(whole.startPoints.length).toBe(letters.reduce((n, l) => n + l.startPoints.length, 0));
      // the whole word is the letters + (n-1) gaps of ~one cell between the ink (a joined word would be tighter or longer by connectors)
      const [lo, hi] = ink(whole);
      const sum = letters.reduce((n, l) => { const [a, b] = ink(l); return n + (b - a); }, 0);
      const gaps = (hi - lo) - sum;
      expect(gaps).toBeGreaterThan(0);
      expect(gaps).toBeLessThanOrEqual((word.length - 1) * CELL * 2.5);
    });
  }

  it("a capital before a lowercase letter still joins it, and lowercase letters among themselves: only one start dot for «Иван»", () => {
    expect(lay("Иван").startPoints.length).toBe(1);
    expect(lay("иван").startPoints.length).toBe(1);
  });

  it("«КГБшник»: the capitals are apart, the lowercase tail joins its capital (fewer dots than letters written alone)", () => {
    const alone = [..."КГБшник"].reduce((n, ch) => n + lay(ch).startPoints.length, 0);
    const kgb = lay("КГБ").startPoints.length;
    const word = lay("КГБшник").startPoints.length;
    expect(word).toBeGreaterThanOrEqual(kgb);
    expect(word).toBeLessThan(alone);
  });
});
