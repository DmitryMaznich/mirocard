import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { layoutWideLinesIntoRows } from "./wordEngine.js";
import { getPathEndpoints, samplePath } from "./pathGeometry.js";

// The Nelson joins (docs/latin-letters.md, owner 2026-11-09): the style «Британские соединённые» of «Прописи: латиница» writes the
// British letters as drawn and joins them by script.joinRules — a stroke of its own from the end of one letter to the next.
const glyphs = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs;
const en = JSON.parse(readFileSync("tools/propis2/languages.json", "utf-8")).languages.find((l) => l.id === "en");
const style = (id) => en.styles.find((s) => s.id === id);
const map = (id) => buildGlyphMap({ wide: glyphs, meta: { script: style(id).script } });
const row = (id, text) => layoutWideLinesIntoRows([text], map(id), undefined, false, 0.5).placed[0].segments.flatMap((sg) => sg.strokes);
const joinsOf = (text) => row("british_joined", text).filter((s) => s.join);

describe("Nelson joins (script.joinRules)", () => {
  it("the style is the British letters with the joining rules; the apart style has none", () => {
    expect(style("british_joined").glyphsFile).toBe(style("british").glyphsFile);
    expect(style("british").script.joinRules).toBeUndefined();
    expect(row("british", "in am").some((s) => s.join)).toBe(false);
  });

  it("the four joins and the break letters, as the Nelson table: in am · ab ch · oa wo · wh ob · bigger", () => {
    for (const w of ["in", "am", "ab", "ch", "oa", "wo", "wh", "ob"]) expect(joinsOf(w), w).toHaveLength(1);
    // b and g are break letters: «bigger» joins i-g, e-r only (b-i, g-g, g-e not)
    expect(joinsOf("bigger")).toHaveLength(2);
    // no join to or from z, none after the other break letters, none from a capital
    for (const w of ["az", "za", "by", "jo", "pa", "qu", "xa", "ya", "Th"]) expect(joinsOf(w), w).toHaveLength(0);
    expect(joinsOf("The quick brown fox")).toHaveLength(1 + 3 + 3 + 2); // he · ui ic ck · ro ow wn · fo ox
  });

  it("a join runs from the end of one letter to the next one, which keeps its own strokes", () => {
    const st = row("british_joined", "in");
    const ownI = glyphs.find((g) => g.label === "i").strokes.length, ownN = glyphs.find((g) => g.label === "n").strokes.length;
    expect(st).toHaveLength(ownI + 1 + ownN);
    const join = st.find((s) => s.join);
    const i = st[0], n = st[ownI + 1];
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01;
    expect(near(getPathEndpoints(join.d).start, getPathEndpoints(i.d).end)).toBe(true); // from i's flick
    expect(near(getPathEndpoints(join.d).end, getPathEndpoints(n.d).start)).toBe(true); // to the top of n
    // it rises: at the Nelson angle at least, never steeper than `run` allows
    const [a, b] = [getPathEndpoints(join.d).start, getPathEndpoints(join.d).end];
    expect(b[1]).toBeLessThan(a[1]);
    expect((b[0] - a[0]) / (a[1] - b[1])).toBeGreaterThanOrEqual(style("british_joined").script.joinRules.run - 1e-3);
  });

  it("a join to a tall letter comes to its stem's middle, at the x-line, as to a letter of the x-height (ab as an, ch as cn, wh as wn)", () => {
    const end = (w) => getPathEndpoints(row("british_joined", w).find((s) => s.join).d).end;
    for (const [tall, short] of [["ab", "an"], ["ch", "cn"], ["it", "in"], ["af", "an"]]) {
      expect(end(tall)[1], tall).toBeCloseTo(end(short)[1], 1);
    }
    // ...but a LEVEL join rises to the top of the tall letter (Nelson's guide: w's top, then up to the top of h)
    for (const [tall, short] of [["wh", "wn"], ["ob", "on"], ["ol", "on"]]) expect(end(tall)[1], tall).toBeLessThan(end(short)[1] - 10);
  });

  it("a level join to a letter of the x-height sags between the two tops, the letters half the x-height apart (Nelson's o–a, w–o)", () => {
    for (const w of ["oa", "wo", "ri", "on", "fo"]) {
      const j = row("british_joined", w).find((s) => s.join);
      const n = j.d.match(/-?\d*\.?\d+/g).map(Number); // M p0 C c1 c2 p3
      const [y0, y1, y2, y3] = [n[1], n[3], n[5], n[7]];
      expect(Math.min(y1, y2), w).toBeGreaterThan(Math.max(y0, y3)); // both controls under both ends: a sag
    }
  });

  it("r joins from the end of its arch (its little wave is not written before a join), into e at the middle of its bar (Nelson's grey)", () => {
    const rOwn = glyphs.find((g) => g.label === "r").strokes[0].d.match(/C/g).length;
    const ro = row("british_joined", "ro");
    expect(ro[0].d.match(/C/g)).toHaveLength(rOwn - 2); // the wave after the arch: gone
    expect(row("british_joined", "r")[0].d.match(/C/g)).toHaveLength(rOwn); // alone, r keeps it
    const re = row("british_joined", "re");
    const join = re.find((s) => s.join), e = re[re.indexOf(join) + 1];
    const nRow = row("british_joined", "n")[0];
    const ys = nRow.d.match(/-?\d*\.?\d+/g).map(Number).filter((_, k) => k % 2 === 1);
    const [top, base] = [Math.min(...ys), Math.max(...ys)];
    const end = getPathEndpoints(join.d).end;
    expect((end[1] - top) / (base - top)).toBeCloseTo(0.5, 1); // into the middle of the x-height
    expect(getPathEndpoints(e.d).start).toEqual(end); // e goes on from there: its bar rebuilt from the join, level (Nelson's «cream», «grey»)
    const eN = e.d.match(/-?\d*\.?\d+/g).map(Number);
    expect(eN[3]).toBeCloseTo(eN[1], 6); // its bar leaves level
    expect(eN[0]).toBeLessThanOrEqual(Math.min(...samplePath(e.d, 80).map((q) => q[0])) + 0.5); // ...from the left side of the letter
  });

  it("a diagonal join into e runs on as e's bar: from the bottom of the letter before (its flick not written) up to e's loop (Nelson's lelele)", () => {
    const lOwn = glyphs.find((g) => g.label === "l").strokes[0].d.match(/C/g).length;
    const eOwn = glyphs.find((g) => g.label === "e").strokes[0].d.match(/C/g).length;
    const le = row("british_joined", "le");
    const join = le.find((s) => s.join), l = le[0], e = le[le.indexOf(join) + 1];
    expect(l.d.match(/C/g)).toHaveLength(lOwn - 1); // l's flick
    expect(e.d.match(/C/g)).toHaveLength(eOwn - 1); // e's own bar
    expect(getPathEndpoints(join.d).start).toEqual(getPathEndpoints(l.d).end);
    expect(getPathEndpoints(e.d).start).toEqual(getPathEndpoints(join.d).end);
  });

  it("f joins from its bar, s from the bottom of its curve", () => {
    const fo = row("british_joined", "fo");
    const bar = fo[1], join = fo.find((s) => s.join);
    expect(Math.hypot(...[0, 1].map((k) => getPathEndpoints(join.d).start[k] - getPathEndpoints(bar.d).end[k]))).toBeLessThan(0.01);
    const sa = row("british_joined", "sa");
    const s = sa[0], js = sa.find((x) => x.join);
    const bottom = Math.max(...s.d.match(/-?\d*\.?\d+/g).map(Number).filter((_, k) => k % 2 === 1));
    expect(getPathEndpoints(js.d).start[1]).toBeGreaterThan(bottom - 1); // (sampled on the curve: within a hair of its lowest control)
  });
});
