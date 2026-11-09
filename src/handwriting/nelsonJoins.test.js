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
    for (const [tall, short] of [["ab", "an"], ["ch", "cn"], ["it", "in"]]) {
      expect(end(tall)[1], tall).toBeCloseTo(end(short)[1], 1);
    }
    // ...but a LEVEL join rises to the top of the tall letter (Nelson's guide: w's top, then up to the top of h)
    for (const [tall, short] of [["wh", "wn"], ["ob", "on"], ["ol", "on"]]) expect(end(tall)[1], tall).toBeLessThan(end(short)[1] - 10);
  });

  it("a level join to a letter of the x-height sags between the two tops, the letters half the x-height apart (Nelson's o–a, w–o)", () => {
    for (const w of ["oa", "wo", "ri", "on"]) { // (not from f: its bar lies on the x-line, levelSagFrom f 0)
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

  it("a diagonal join into e: from the bottom of the letter before up into the loop's right side, the loop round over the top (le)", () => {
    const lOwn = glyphs.find((g) => g.label === "l").strokes[0].d.match(/C/g).length;
    const eOwn = glyphs.find((g) => g.label === "e").strokes[0].d.match(/C/g).length;
    const le = row("british_joined", "le");
    const join = le.find((s) => s.join), l = le[0], e = le[le.indexOf(join) + 1];
    expect(l.d.match(/C/g)).toHaveLength(lOwn - 1); // l's flick
    expect(e.d.match(/C/g)).toHaveLength(eOwn - 1); // no bar: right side → top → left side, then e's own
    expect(getPathEndpoints(join.d).start).toEqual(getPathEndpoints(l.d).end);
    const [je, es] = [getPathEndpoints(join.d).end, getPathEndpoints(e.d).start];
    expect(Math.hypot(je[0] - es[0], je[1] - es[1])).toBeLessThan(0.01);
    const jn = join.d.match(/-?\d*\.?\d+/g).map(Number), en2 = e.d.match(/-?\d*\.?\d+/g).map(Number);
    const a = Math.atan2(jn[7] - jn[5], jn[6] - jn[4]), b = Math.atan2(en2[3] - en2[1], en2[2] - en2[0]);
    expect(Math.abs(a - b)).toBeLessThan(0.05); // smooth where the join meets the loop
    expect(en2[3]).toBeLessThan(en2[1]); // going up there
  });

  it("f's bar runs on level into the next letter, no sag, the letters close (Nelson's «from»)", () => {
    const j = row("british_joined", "fr").find((s) => s.join);
    const n = j.d.match(/-?\d*\.?\d+/g).map(Number);
    expect(Math.max(n[3], n[5])).toBeLessThanOrEqual(Math.max(n[1], n[7]) + 0.01); // no control under the ends: no sag
    // from the cut (0.1 of the x-height past f's stem) to r's stem top 0.7 past it (Nelson's «from»: 0.76)
    expect((n[6] - n[0]) / 24).toBeCloseTo(0.6, 1);
  });

  it("f's bar stops just past its stem before a join, the next letter close by (Nelson's «football», «fantastic»)", () => {
    const fOwn = glyphs.find((g) => g.label === "f").strokes[1].d;
    const fo = row("british_joined", "fo");
    const bar = fo[1], join = fo.find((s) => s.join);
    const barEnd = getPathEndpoints(bar.d).end, stemX = getPathEndpoints(fo[0].d).start[0];
    expect(getPathEndpoints(join.d).start).toEqual(barEnd);
    const xs = (d) => d.match(/-?\d*\.?\d+/g).map(Number).filter((_, k) => k % 2 === 0);
    expect(Math.max(...xs(bar.d)) - Math.min(...xs(bar.d))).toBeLessThan(Math.max(...xs(fOwn)) - Math.min(...xs(fOwn))); // shorter than alone
    expect(barEnd[0]).toBeLessThan(stemX); // (the stem of f is on the left of its hook's start)
  });

  it("a diagonal join into f flows up into its stem just above the x-line, f standing by its stem as l does (Nelson's «if», «ef»)", () => {
    const stemX = (r) => getPathEndpoints(r.find((s) => s.join).d).end[0];
    const ef = row("british_joined", "ef"), el = row("british_joined", "el");
    const jf = ef.find((s) => s.join).d.match(/-?\d*\.?\d+/g).map(Number);
    expect(jf[7]).toBeLessThan(getPathEndpoints(el.find((s) => s.join).d).end[1] - 1); // above where l's join meets
    expect(Math.abs(jf[4] - jf[6])).toBeLessThan(1); // arrives upright, along the stem
    expect(Math.abs(stemX(ef) - stemX(el))).toBeLessThan(2); // f's stem where l's is
  });

  it("f before an oval: the oval tucks in close under the bar, the join leaves the bar level and runs into the oval's arc (Nelson's «fantastic»)", () => {
    const fa = row("british_joined", "fa"), fr = row("british_joined", "fr");
    const join = fa.find((s) => s.join), n = join.d.match(/-?\d*\.?\d+/g).map(Number);
    expect(n[3]).toBeCloseTo(n[1], 6); // leaves level: on from the bar's lowest point
    const a = fa[fa.indexOf(join) + 1];
    const aLeft = Math.min(...a.d.match(/-?\d*\.?\d+/g).map(Number).filter((_, k) => k % 2 === 0));
    expect((aLeft - n[0]) / 24).toBeCloseTo(0.3, 1); // a's left side 0.3 of the x-height after f's stem
    expect(getPathEndpoints(join.d).end[0]).toBeLessThan(getPathEndpoints(fr.find((s) => s.join).d).end[0]); // closer than r
  });

  it("after s the next letter stands clear of it; a join up to the x-line leaves from under s, level, and bends up to the letter's top (Nelson's «spin»)", () => {
    const xs = (d) => d.match(/-?\d*\.?\d+/g).map(Number).filter((_, k) => k % 2 === 0);
    const lowest = (d) => samplePath(d, 160).reduce((m, q) => (q[1] > m[1] ? q : m));
    for (const w of ["sp", "sa", "sn", "si"]) {
      const r = row("british_joined", w), j = r.findIndex((s) => s.join);
      const gap = Math.min(...r.slice(j + 1).flatMap((s) => xs(s.d))) - Math.max(...r.slice(0, j).flatMap((s) => xs(s.d)));
      expect(gap / 24, w).toBeCloseTo(style("british_joined").script.joinRules.edgeFrom.s, 1); // (x-height 24 at this scale)
      const n = r[j].d.match(/-?\d*\.?\d+/g).map(Number);
      expect(n[1], w).toBeCloseTo(lowest(r[0].d)[1], 1); // from under s
      expect(n[3], w).toBeCloseTo(n[1], 6); // leaving level
      if (w === "sa") continue;
      // a parabola: its first handle far along, level; it arrives steeper than its chord
      expect((n[2] - n[0]) / (n[6] - n[0]), w).toBeGreaterThan(0.6);
      expect((n[6] - n[4]) / (n[5] - n[7]), w).toBeLessThan((n[6] - n[0]) / (n[1] - n[7]));
    }
  });

  it("level joins into f (o–f, f–f) run into its stem just above the x-line, not up to its top; the two f's tails clear (Nelson's «offer»)", () => {
    const r = row("british_joined", "off"), js = r.filter((s) => s.join);
    expect(js).toHaveLength(2);
    for (const j of js) {
      const e = getPathEndpoints(j.d).end;
      expect(e[1]).toBeLessThan(40); // above the x-line (40 at this scale) …
      expect(e[1]).toBeGreaterThan(40 - 0.25 * 24); // … only just: not up to f's top
    }
    const stems = js.map((j) => getPathEndpoints(j.d).end[0]);
    expect((stems[1] - stems[0]) / 24).toBeGreaterThan(0.8); // stem to stem: f's tail (0.7 wide) clear of the f before
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
