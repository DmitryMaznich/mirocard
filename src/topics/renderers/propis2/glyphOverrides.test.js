import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "./pageTask.js";
import { markStem } from "./glyphOverrides.js";
import { wideGlyphLocal, layoutWideLinesIntoRows } from "../propis/wordEngine.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).glyphs;
const pts = (d) => (String(d).match(/-?\d*\.?\d+/g) ?? []).map(Number);

describe("ъ stands by its stem (stemOnLine)", () => {
  const map = buildGlyphMap({ wide });
  const yer = map.get("ъ");
  it("the flag and the stem are the captured ones, only the start is lower on the same opening line (a quarter of the row below the top)", () => {
    const raw = wide.find((g) => g.label === "ъ");
    const [rx, ry] = pts(raw.strokes[0].d), [nx, ny] = pts(yer.strokes[0].d);
    expect(ny - ry).toBeCloseTo(7, 1);
    expect(ny).toBeCloseTo(10 + 0.25 * 50, 0);
    expect(nx).toBeLessThan(rx);
    // everything from the opening line to the top of the stem (the captured flag) is the captured path
    const rd = raw.strokes[0].d, nd = yer.strokes[0].d;
    const flag = (d) => d.slice(d.indexOf("L"), d.indexOf("L 164.3") + 12);
    expect(flag(nd)).toBe(flag(rd));
    // the opening line keeps the direction of the captured one (the kink at the start of the flag is taken out by the connector, not by the flag)
    const [x1, y1] = pts(rd).slice(2, 4);
    expect((x1 - nx) / (ny - y1)).toBeCloseTo((x1 - rx) / (ry - y1), 2);
  });
  it("the anchor is the top of the stem (the start of its first long straight segment)", () => {
    expect(yer.stemAnchor[0]).toBeCloseTo(164.35, 1);
    expect(yer.stemAnchor[1]).toBeCloseTo(10, 1);
  });
  it("the line through the stem lies 0.56 of a cell (30 units, x1.806 stretch) right of the start's line, in the layout's units", () => {
    const l = wideGlyphLocal(yer, 1);
    expect(l.stemDx).toBeGreaterThan(14);
    expect(l.stemDx).toBeLessThan(19);
    // narrow rows: scaled with the letter
    expect(wideGlyphLocal(yer, 0.6).stemDx / l.stemDx).toBeCloseTo(0.6, 1);
  });
  const S = 30, tan = Math.tan((25 * Math.PI) / 180);
  const snap = (_r, x, y) => Math.round((x + y * tan) / S) * S - y * tan;
  it("alone, its STEM is on a line of the grid (the point stemDx right of the start)", () => {
    const seg = layoutWideLinesIntoRows(["ъ"], map, snap, false, 1).placed[0].segments[0];
    const [sx, sy] = seg.startPoints[0];
    const k = (sx + wideGlyphLocal(yer, 1).stemDx + sy * tan) / S;
    expect(Math.abs(k - Math.round(k))).toBeLessThan(0.01);
  });
  it("after a letter that joins it the connector is not flatter than the join angle: ъ stands at least as close as without snapNotRight", () => {
    const plain = buildGlyphMap({ wide: wide.map((g) => (g.label === "ъ" ? { ...g, noOverrides: true } : g)) });
    const noLeft = new Map(map); noLeft.set("ъ", { ...yer, snapNotRight: undefined });
    const w = (m) => layoutWideLinesIntoRows(["съ"], m, snap, false, 1).placed[0].segments[0].width;
    expect(w(map)).toBeLessThanOrEqual(w(noLeft));
    expect(plain.get("ъ").stemAnchor).toBeUndefined();
  });
  it("the stem runs into the belly of в (reduced) on the stem's own line, and the belly is half a row high", () => {
    const d = yer.strokes[0].d;
    const n = pts(d);
    // the stem ends on the line x + tan·y = U (the line through the top of the stem)
    const U = 164.35 + tan * 10;
    const m = d.match(/L 164\.35 10\.00 L (-?[\d.]+) (-?[\d.]+)/);
    expect(m).not.toBeNull();
    const [sx, sy] = [Number(m[1]), Number(m[2])];
    expect(sx + tan * sy).toBeCloseTo(U, 0);
    // the belly spans half the row: from the middle (36) to the baseline (62)
    const ys = pts(d.slice(d.indexOf(m[0]) + m[0].length)).filter((_, i) => i % 2);
    expect(Math.min(...ys)).toBeCloseTo(36, 0);
    expect(Math.max(...ys)).toBeCloseTo(62, 0);
    expect(n.length).toBeGreaterThan(60);
  });
  it("a second pass exactly on the first: the connector begins with the same cubic as the first pass of the bottom of the belly", () => {
    const loc = wideGlyphLocal(yer, 1);
    const body = pts(loc.strokes[0].d), tail = pts(loc.tail.d);
    // the body ends where the tail begins (one turn: the end of a letter nothing follows)
    expect(body.slice(-2)).toEqual(tail.slice(0, 2));
    // the first cubic of the tail is the cubic of the body that starts at that point the first time (same numbers = the same line)
    const at = (() => { for (let i = 0; i + 1 < body.length - 2; i += 2) if (Math.abs(body[i] - tail[0]) < 1e-2 && Math.abs(body[i + 1] - tail[1]) < 1e-2) return i; return -1; })();
    expect(at).toBeGreaterThan(0);
    tail.slice(2, 8).forEach((v, k) => expect(v).toBeCloseTo(body[at + 2 + k], 1));
  });
  it("variant 1: with no letter after it ъ is the body only; variant 2: with a letter after it the connector follows", () => {
    const alone = layoutWideLinesIntoRows(["ъ"], map, snap, false, 1).placed[0].segments[0];
    const before = layoutWideLinesIntoRows(["ъе"], map, snap, false, 1).placed[0].segments[0];
    expect(alone.strokes.length).toBe(1);
    expect(before.strokes.length).toBeGreaterThanOrEqual(3);
  });
  it("variant 2 in a word: the second pass over the bottom stays on the first (the rise of the next letter does not drag it: tailNoAlign)", () => {
    for (const next of ["е", "и", "л", "н"]) {
      const ds = layoutWideLinesIntoRows([`ъ${next}`], map, snap, false, 1).placed[0].segments[0].strokes.map((st) => st.d ?? st);
      const body = pts(ds[0]), tail = pts(ds[1]);
      let at = -1;
      for (let i = 0; i + 1 < body.length - 2; i += 2) if (Math.abs(body[i] - tail[0]) < 1e-2 && Math.abs(body[i + 1] - tail[1]) < 1e-2) { at = i; break; }
      expect(at, next).toBeGreaterThan(0);
      tail.slice(2, 8).forEach((v, k) => expect(v, next).toBeCloseTo(body[at + 2 + k], 1));
    }
  });
  it("the connector of the letter before enters the flag along the flag's own direction: no kink (joinArrive)", () => {
    const num = (str) => (String(str).match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const ang = (v) => (Math.atan2(-v[1], v[0]) * 180) / Math.PI;
    for (const prev of ["с", "о", "н", "и", "л", "м", "т", "а", "е", "в", "ю", "ф", "б"]) {
      const ds = layoutWideLinesIntoRows([`${prev}ъ`], map, snap, false, 1).placed[0].segments[0].strokes.map((st) => st.d ?? st);
      const a = num(ds[ds.length - 2]), b = num(ds[ds.length - 1]), n = a.length;
      expect(Math.abs(ang([a[n - 2] - a[n - 4], a[n - 1] - a[n - 3]]) - ang([b[6] - b[0], b[7] - b[1]])), prev).toBeLessThan(1);
    }
  });
  it("other letters are snapped by their start as before", () => {
    for (const lab of ["ь", "н", "к", "у", "о"]) expect(wideGlyphLocal(map.get(lab), 1).stemDx).toBe(0);
  });
  it("a glyph without a long straight segment gets no anchor", () => {
    const g = { strokes: [{ d: "M 0 0 L 1 1 Q 2 2 3 3" }] };
    expect(markStem(g)).toBe(g);
    expect(pts(g.strokes[0].d).length).toBeGreaterThan(0);
  });
});
