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
  it("the shape and the size of the letter are the captured ones, only its start is lower on the same opening line (a quarter of the row below the top)", () => {
    const raw = wide.find((g) => g.label === "ъ");
    const [rx, ry] = pts(raw.strokes[0].d), [nx, ny] = pts(yer.strokes[0].d);
    expect(ny - ry).toBeCloseTo(7, 1);
    expect(ny).toBeCloseTo(10 + 0.25 * 50, 0);
    expect(nx).toBeLessThan(rx);
    // everything after the opening line, up to the end of the one turn of the belly, is the captured path
    const b0 = yer.strokes[0].d;
    expect(raw.strokes[0].d.slice(raw.strokes[0].d.indexOf("L")).startsWith(b0.slice(b0.indexOf("L"), b0.lastIndexOf(" L ")))).toBe(true);
    // the opening line keeps the direction of the captured one (the kink at the start of the flag is taken out by the connector, not by the flag)
    const [x1, y1] = pts(raw.strokes[0].d).slice(2, 4);
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
  it("one turn of the belly: the letter ends at the foot of the stem; the connector is a stroke of its own that REPLAYS the bottom (a second pass exactly on the first)", () => {
    expect(yer.strokes.length).toBe(2);
    const body = yer.strokes[0].d, tail = yer.strokes[1].d;
    const foot = "143.47 54.78";
    expect(body.endsWith(`L ${foot}`)).toBe(true);
    expect(tail.startsWith(`M ${foot}`)).toBe(true);
    // the commands of the tail up to its last cubic are the commands of the first pass: same numbers, so the same line
    const bottom = tail.slice(tail.indexOf(foot) + foot.length, tail.lastIndexOf(" C "));
    expect(body.slice(body.indexOf(foot) + foot.length).startsWith(bottom)).toBe(true);
    expect(bottom.length).toBeGreaterThan(80);
  });
  it("variant 1: with no letter after it ъ is the body only; variant 2: with a letter after it the connector follows", () => {
    const alone = layoutWideLinesIntoRows(["ъ"], map, snap, false, 1).placed[0].segments[0];
    const before = layoutWideLinesIntoRows(["ъе"], map, snap, false, 1).placed[0].segments[0];
    expect(alone.strokes.length).toBe(1);
    expect(before.strokes.length).toBeGreaterThanOrEqual(3);
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
