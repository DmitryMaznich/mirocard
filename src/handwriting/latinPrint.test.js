import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { layoutWideLinesIntoRows } from "./wordEngine.js";
import { snapXFor } from "./PrintPageView.jsx";
import { samplePath, toCubicPathD } from "./pathGeometry.js";

const segsFrom = (pts) => { const out = []; for (let i = 0; i + 3 < pts.length; i += 3) out.push(pts.slice(i, i + 4)); return out; };

// The English print letters (tools/handwriting/latin/print.json, docs/latin-letters.md step 3.4) in the engine, as the page lays them
// out: upright, apart, and not bent towards the next copy of the word.
const glyphs = JSON.parse(readFileSync("tools/handwriting/latin/print.json", "utf-8")).glyphs;
const style = JSON.parse(readFileSync("tools/propis2/languages.json", "utf-8")).languages.find((l) => l.id === "en").styles.find((s) => s.id === "print");
const map = buildGlyphMap({ wide: glyphs, meta: { script: style.script } });
const snap = snapXFor({ narrowRows: true, simpleGrid: "en_us", format: "a5" });
const layout = (text) => layoutWideLinesIntoRows([text], map, snap, true, 0.625).placed[0].segments.flatMap((sg) => sg.strokes);
const lastPoints = (d) => d.match(/-?\d*\.?\d+/g).map(Number).slice(-4);

describe("English print letters in the propis2 engine", () => {
  it("has all 52 letters", () => {
    const labels = new Set(glyphs.map((g) => g.label));
    for (const ch of "abcdefghijklmnopqrstuvwxyz") {
      expect(labels.has(ch)).toBe(true);
      expect(labels.has(ch.toUpperCase())).toBe(true);
    }
  });

  it("the style writes apart, upright, on the American four-line paper", () => {
    expect(style.script.joins).toBe(false);
    expect(style.script.slantDeg).toBeUndefined();
    expect(style.papers[0]).toBe("en_us");
  });

  it("the legs of n h m end straight down on the baseline, in every copy of the row", () => {
    for (const ch of ["n", "h", "m"]) {
      const strokes = layout(`${ch}${ch.toUpperCase()}`); // a row of copies: «nN nN nN …»
      const legs = strokes.filter((s) => s.d.includes("C") && lastPoints(s.d)[3] === 64);
      expect(legs.length).toBeGreaterThan(2);
      for (const s of legs) {
        const [x0, , x1] = lastPoints(s.d);
        expect(Math.abs(x1 - x0), `${ch}: ${s.d}`).toBeLessThan(0.01);
      }
    }
  });

  it("the draft English is in the test copy only, never in the deck everyone gets", async () => {
    const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf-8"));
    const deck = async (id) => {
      const e = catalog.decks.find((d) => d.id === id);
      const zip = await JSZip.loadAsync(readFileSync(`public/decks/${e.url.replace("./decks/", "")}`));
      return { entry: e, topic: JSON.parse(await zip.file("topic.json").async("string")) };
    };
    const prod = await deck("propis2");
    expect(prod.entry.status).toBe("release");
    expect(prod.topic.languages.map((l) => l.id)).not.toContain("en");
    const test = await deck("propis2_lang");
    expect(test.entry.status).toBe("individual");
    const en = test.topic.languages.find((l) => l.id === "en");
    expect(en.status).toBe("draft");
    // 52 letters + 0–9 and + − = < > (as «№…») + the hyphen + . , ? ! — all upright, none borrowed from the Russian cursive
    for (const id of ["print", "british"]) {
      const g = en.styles.find((s) => s.id === id).glyphs;
      expect(g).toHaveLength(72);
      for (const label of ["№0", "№9", "№+", "№=", "-", ".", "?", "!"]) expect(g.find((x) => x.label === label)?.upright, `${id} ${label}`).toBe(true);
    }
  });
  it("British letters: the Nelson proportions — ascenders 0.74, descenders 0.72 of the x-height, capitals as tall as the ascenders", () => {
    const gb = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs;
    const ys = (ch) => gb.find((g) => g.label === ch).strokes.flatMap((st) => st.d.match(/-?\d*\.?\d+/g).map(Number).filter((_, i) => i % 2 === 1));
    const top = (ch) => Math.min(...ys(ch)), bottom = (ch) => Math.max(...ys(ch));
    const X = 52, BASE = 62; // the capture frame: x-height, baseline
    expect((BASE - X - top("l")) / X).toBeCloseTo(0.74, 2); // the ascender above the x-line
    expect((bottom("p") - BASE) / X).toBeCloseTo(0.72, 2);  // the descender below the baseline
    expect(top("H")).toBeCloseTo(top("l"), 1);              // a capital as tall as an ascender
    // the exit flick: l ends to the right of its stem, rising
    const l = gb.find((g) => g.label === "l").strokes[0].d.match(/-?\d*\.?\d+/g).map(Number);
    expect(l[l.length - 2]).toBeGreaterThan(l[0] + 10);
    expect(l[l.length - 1]).toBeLessThan(BASE);
  });
  it("the style's own digits win over the bank's cursive ones; Russian keeps the cursive", () => {
    expect(map.get("№5").sourceLabel).toBe("print-5");
    expect(map.get("№+").upright).toBe(true);
    const ru = buildGlyphMap({ wide: JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8")).glyphs, meta: {} });
    expect(ru.get("№5").upright).toBeUndefined();
    expect(ru.get("№5").sourceLabel).toMatch(/захват/);
  });
  it("British letters traced by the owner stand on the lines (tidy_capture.py, 2026-11-08)", () => {
    const traced = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs.filter((g) => g.sourceLabel.startsWith("british-capture-"));
    expect(traced.map((g) => g.label).sort().join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");
    const ys = (g) => g.strokes.filter((st) => st.name !== "точка").flatMap((st) => samplePath(toCubicPathD(st.d), 60).map((p) => p[1]));
    for (const g of traced) {
      const [top, bottom] = [Math.min(...ys(g)), Math.max(...ys(g))];
      // x-line 10, baseline 62, ascenders 0.74 and descenders 0.72 of the x-height (52) in the pupil books' proportions
      // capitals as tall as the ascenders, scaled whole
      if ("bdhkl".includes(g.label) || /[A-Z]/.test(g.label)) expect(top, g.label).toBeCloseTo(10 - 52 * 0.74, 0);
      else if (g.label === "t") expect(top).toBeLessThan(0);
      else if (g.label !== "f") expect(top, g.label).toBeCloseTo(10, 0);
      if ("gjpqy".includes(g.label)) expect(bottom, g.label).toBeCloseTo(62 + 52 * 0.72, 0);
      else if (g.label !== "f") expect(bottom, g.label).toBeLessThan(63); // round letters (G, O) may dip a little under it
    }
  });
  it("British a d g q have one bowl — g's — and differ only in their endings (owner, 2026-11-08)", () => {
    const glyphs = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs;
    // the bowl relative to the pen's start (each glyph is moved to start its ink at x = 0, and g's tail reaches left of its bowl)
    const bowl = (label) => {
      const n = glyphs.find((g) => g.label === label).strokes[0].d.match(/-?\d*\.?\d+/g).map(Number).slice(0, 2 + 4 * 6);
      return n.map((v, i) => v - n[i % 2]);
    };
    const g = bowl("g");
    for (const label of "adq") bowl(label).forEach((v, i) => expect(v, `${label} [${i}]`).toBeCloseTo(g[i], 2));
  });
  it("British: a round bottom is never drawn straight — a level line on the baseline only in B D E L Z z (owner, 2026-11-08)", () => {
    const glyphs = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs.filter((g) => g.sourceLabel.startsWith("british-capture-"));
    const flat = [];
    for (const g of glyphs) for (const st of g.strokes) {
      const n = st.d.match(/-?\d*\.?\d+/g).map(Number);
      for (let i = 0; i + 7 < n.length; i += 6) {
        const ys = [n[i + 1], n[i + 3], n[i + 5], n[i + 7]];
        if (ys.every((y) => Math.abs(y - 62) < 1e-6) && Math.abs(n[i + 6] - n[i]) > 1) flat.push(g.label);
      }
    }
    expect([...new Set(flat)].sort().join("")).toBe("BDELZz");
  });
  it("British b: the bowl is the middle line of the Nelson stroke (owner, 2026-11-08: «подтянуть овал к линии оригинала»)", () => {
    const b = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs.find((g) => g.label === "b");
    const pts = samplePath(toCubicPathD(b.strokes[0].d), 60);
    const stem = pts[0][0];
    const bowl = pts.filter((p) => p[1] > 9 && p[0] > stem + 1);
    // measured on the underlay: the bowl's middle line reaches 18.1 tool units right of the stem (x 2 in the engine), its top 0.25 under
    // the x-line (0.5 in the engine), its bottom 0.38 under the baseline -- Nelson's own, not pulled onto the lines
    expect(Math.max(...bowl.map((p) => p[0])) - stem).toBeCloseTo(36.2, 0);
    expect(Math.min(...bowl.map((p) => p[1]))).toBeCloseTo(10.5, 0);
    expect(pts[pts.length - 1][0]).toBeCloseTo(stem, 1); // it ends in the stem
    expect(pts[pts.length - 1][1]).toBeCloseTo(47.1, 0); // ... where the original's line comes back into it (as p's)
  });
  it("British p: the bowl is the middle line of the Nelson stroke, leaving and rejoining the stem where the original does (owner, 2026-11-08)", () => {
    const p = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs.find((g) => g.label === "p");
    const stem = samplePath(toCubicPathD(p.strokes[0].d), 10)[0][0];
    const bowl = samplePath(toCubicPathD(p.strokes[1].d), 60);
    // measured on the underlay (tool units x 2): the middle line reaches 19.3 right of the stem, its top 0.4 under the x-line, its bottom
    // 0.3 under the baseline; it leaves the stem 9.6 under the x-line and comes back 6.9 above the baseline (the variant the owner chose)
    expect(Math.max(...bowl.map((q) => q[0])) - stem).toBeCloseTo(38.6, 0);
    expect(Math.min(...bowl.map((q) => q[1]))).toBeCloseTo(10.8, 0);
    expect(Math.max(...bowl.map((q) => q[1]))).toBeCloseTo(62.6, 0);
    expect(bowl[0][0]).toBeCloseTo(stem, 1);
    expect(bowl[bowl.length - 1][0]).toBeCloseTo(stem, 1);
    expect(bowl[0][1]).toBeCloseTo(29.2, 0);
    expect(bowl[bowl.length - 1][1]).toBeCloseTo(48.2, 0);
  });
  it("British f: the bar is one simple arc, its ends on the x-line, sagging in the middle as Nelson's (owner, 2026-11-08)", () => {
    const f = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs.find((g) => g.label === "f");
    const bar = f.strokes[1].d.match(/-?\d*\.?\d+/g).map(Number);
    expect(bar.length).toBe(8);                 // one cubic
    expect(bar[1]).toBeCloseTo(10, 1);          // the ends on the x-line
    expect(bar[7]).toBeCloseTo(10, 1);
    const mid = samplePath(toCubicPathD(f.strokes[1].d), 40)[20][1];
    expect(mid - 10).toBeGreaterThan(5);        // a real sag (Nelson: 0.12 of the x-height = 6.2 here; the hand's 7.4)
    expect(mid - 10).toBeLessThan(9);
  });
  it("British k: the owner's own path — the loop turns where the hand turned, the leg starts from that turn (2026-11-08)", () => {
    const k = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs.find((g) => g.label === "k");
    const n = k.strokes[0].d.match(/-?\d*\.?\d+/g).map(Number);
    const pts = []; for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
    const stem = pts[0][0];
    // the turn: a segment end in the x band, coming from the left-going loop and going on down to the right (the leg)
    const ends = []; for (let i = 3; i + 3 < pts.length; i += 3) ends.push(i);
    const t = ends.find((i) => pts[i][1] > 20 && pts[i][1] < 50 && pts[i - 1][0] > pts[i][0] && pts[i + 3][0] > pts[i][0] && pts[i + 3][1] > pts[i][1]);
    expect(t, "the loop's turn").toBeDefined();
    expect(pts[t][0] - stem).toBeCloseTo(7, 0);   // 3.5 tool units right of the stem (Nelson's: 3.6)
    expect(pts[t + 1][0]).toBeGreaterThan(pts[t][0]); // no hook: the leg leaves the turn straight away to the right
    // «заключительный элемент сначала чуть выше, потом плавно загибается вниз»: the leg leaves the turn nearly level
    expect((pts[t + 1][1] - pts[t][1]) / (pts[t + 1][0] - pts[t][0])).toBeLessThan(0.5);
    // «от низа стойки идёт слегка по параболе»: the rise from the stem's foot to the loop's top bends -- not a straight line
    const segs = segsFrom(pts);
    const f0 = segs.findIndex((sg) => Math.abs(sg[0][0] - stem) < 1e-6 && Math.abs(sg[0][1] - 62) < 1e-6 && sg[3][1] < 62);
    const top = segs.findIndex((sg, i) => i > f0 && Math.abs(sg[3][1] - 10) < 0.5);
    const rise = segs.slice(f0, top + 1).flatMap((sg) => samplePath(toCubicPathD(`M ${sg[0].join(" ")} C ${sg.slice(1).flat().join(" ")}`), 20));
    const [p0, p1] = [rise[0], rise[rise.length - 1]];
    const dev = (q) => Math.abs((p1[0] - p0[0]) * (q[1] - p0[1]) - (p1[1] - p0[1]) * (q[0] - p0[0])) / Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    expect(Math.max(...rise.map(dev))).toBeGreaterThan(2);
  });
  it("British g and y end with j's hook (owner, 2026-11-08)", () => {
    const glyphs = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs;
    // the hook: the last two cubics, relative to where the pen leaves the upright stem
    const hook = (label) => {
      const n = glyphs.find((g) => g.label === label).strokes[0].d.match(/-?\d*\.?\d+/g).map(Number);
      const tail = n.slice(n.length - 14); // the start point of the hook + 2 cubics
      return tail.map((v, i) => v - tail[i % 2]);
    };
    const j = hook("j");
    for (const label of "gy") hook(label).forEach((v, i) => expect(v, `${label} [${i}]`).toBeCloseTo(j[i], 1));
  });
  it("British D: the belly is one smooth arc — two ellipse quarters between the top and bottom bars (owner, 2026-11-09)", () => {
    const D = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs.find((g) => g.label === "D");
    const n = D.strokes[1].d.match(/-?\d*\.?\d+/g).map(Number);
    const segs = segsFrom(Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]]));
    expect(segs.length).toBe(4); // top bar, two quarters, bottom bar
    const [q1, q2] = [segs[1], segs[2]];
    expect(q1[1][1]).toBeCloseTo(q1[0][1], 6);   // leaves the top bar level
    expect(q1[2][0]).toBeCloseTo(q1[3][0], 6);   // upright at the right side
    expect(q2[1][0]).toBeCloseTo(q2[0][0], 6);   // ... going on upright
    expect(q2[2][1]).toBeCloseTo(q2[3][1], 6);   // into the bottom bar level
  });
  it("British B: the lower belly is the bigger one, as Nelson's (owner, 2026-11-09)", () => {
    const B = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs.find((g) => g.label === "B");
    const stem = samplePath(toCubicPathD(B.strokes[0].d), 4)[0][0];
    const pts = samplePath(toCubicPathD(B.strokes[1].d), 40);
    const bar = pts.filter((q) => q[0] < stem + 6 && q[1] > 0 && q[1] < 40)[0][1]; // the middle bar near the stem
    const right = (lo, hi) => Math.max(...pts.filter((q) => q[1] > lo && q[1] < hi).map((q) => q[0])) - stem;
    // measured on the underlay (tool units x the capital scale 1.871): the middle bar 0.7 above the x-line, bellies 24.4 / 26.2 wide
    expect(bar).toBeLessThan(62 + (62 - 88) * 2 * (1 + 0.74) / (1 + 0.86)); // above the x-line as a capital is scaled (13.35)
    expect(right(bar + 1, 62) - right(-30, bar - 1)).toBeGreaterThan(2.5);
  });
  it("British n and m: the arches are the middle line of Nelson's stroke (owner, 2026-11-09)", () => {
    const glyphs = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs;
    // the upright stretches of the path (the stems) relative to the first: Nelson's, measured on the thinned underlay (x 2)
    const uprights = (label) => {
      const n = glyphs.find((g) => g.label === label).strokes[0].d.match(/-?\d*\.?\d+/g).map(Number);
      const pts = Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]]);
      const xs = segsFrom(pts).filter((sg) => sg.every((q) => Math.abs(q[0] - sg[0][0]) < 1e-6) && Math.abs(sg[3][1] - sg[0][1]) > 8).map((sg) => sg[0][0]);
      return [...new Set(xs.map((x) => Math.round((x - xs[0]) * 10) / 10))];
    };
    const near = (got, want) => { expect(got.length).toBe(want.length); got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 0)); };
    near(uprights("n"), [0, 35.6]);
    near(uprights("m"), [0, 35.8, 70.2]);
    // «отрыв от левой вертикальной чуть раньше»: the arch leaves the left stem where Nelson's does -- the middle of the arch's stroke
    // next to the stem, ~76 in the tool (the hand left at 74.5) = 62 + (76 - 88) * 2 here -- and at an angle, not along the stem
    for (const label of "nm") {
      const n = glyphs.find((g) => g.label === label).strokes[0].d.match(/-?\d*\.?\d+/g).map(Number);
      const segs = segsFrom(Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]]));
      const up = segs[1], arch = segs[2]; // the retrace up the left stem, then the arch
      expect(up[3][1], label).toBeGreaterThan(36); expect(up[3][1], label).toBeLessThan(40);
      expect(arch[1][0] - arch[0][0], label).toBeGreaterThan(2); // leaves at an angle: the first handle already off the stem
    }
  });
});
