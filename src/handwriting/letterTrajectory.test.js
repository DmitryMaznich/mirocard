import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { letterPaths, letterMoves, segmentShare } from "./letterParts.js";
import { samplePath, toCubicPathD } from "./pathGeometry.js";

const wide = JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8")).glyphs;
const spec = JSON.parse(readFileSync("tools/handwriting/cyrillic/letter_elements.json", "utf-8")).letters;
const glyph = (ch) => ({ ...wide.find((g) => g.label === ch || g.aliases?.includes(ch)), trajectory: spec[ch] });
const endOf = (d) => d.trim().split(/\s+/).slice(-2).map(Number);
const startOf = (d) => d.trim().split(/\s+/).slice(1, 3).map(Number);
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.6;

describe("р: the stick, the retrace up it, the hook (owner 2026-11-19)", () => {
  const r = glyph("р");
  it("every letter in letter_elements.json is in wide.json, its element names match its ink pieces", () => {
    for (const ch of Object.keys(spec)) {
      const ink = letterPaths(glyph(ch)).filter((p) => p.kind === "ink");
      expect(ink.length, ch).toBe(spec[ch].elements.length);
    }
  });
  it("the retrace runs from the foot of the stick to where the hook begins", () => {
    const paths = letterPaths(r);
    expect(paths.map((p) => p.kind)).toEqual(["ink", "retrace", "ink"]);
    expect(paths[1].from).toBeCloseTo(segmentShare(r.strokes[0].d, 1), 6);
    const moves = letterMoves(r, "joined");
    expect(near(startOf(moves[1].d), [88.86, 114])).toBe(true);
    expect(endOf(moves[1].d)[1]).toBeCloseTo(36, 1); // up the stick to the middle dashed line, where the hook begins
  });
  it("joined: one start dot, stick → retrace → hook, no jump", () => {
    const m = letterMoves(r, "joined");
    expect(m.map((x) => x.kind)).toEqual(["ink", "retrace", "ink"]);
    expect(m.filter((x) => x.startDot).length).toBe(1);
  });
  it("lifted: stick, the pen lifted at its foot and put down at the hook's start, the hook from its own dot", () => {
    const m = letterMoves(r, "lifted");
    expect(m.map((x) => x.kind)).toEqual(["ink", "lift", "ink"]);
    expect(m.filter((x) => x.startDot).length).toBe(2);
    expect(near(m[1].from, [88.86, 114])).toBe(true);
    expect(m[1].to[1]).toBeCloseTo(36, 1);
  });
  it("the hook begins and ends on the middle dashed line, like a г", () => {
    const hook = letterMoves(r, "lifted")[2].d;
    expect(startOf(hook)[1]).toBeCloseTo(36, 1);
    expect(endOf(hook)[1]).toBeCloseTo(36, 1);
  });
  it("the elements are the same ink in both techniques", () => {
    const ink = (t) => letterMoves(r, t).filter((x) => x.kind === "ink").map((x) => x.d);
    expect(ink("lifted")).toEqual(ink("joined"));
  });
  it("a letter with nothing marked is one element, written as captured", () => {
    const m = letterMoves({ ...wide.find((g) => g.label === "о") }, "lifted");
    expect(m.length).toBe(1);
  });
});

describe("п: like р, the stick down to the baseline", () => {
  const p = glyph("п");
  it("joined: stick, back up it to the middle line, the hook; lifted: the hook from its own dot on the middle line", () => {
    expect(letterMoves(p, "joined").map((x) => x.kind)).toEqual(["ink", "retrace", "ink"]);
    const m = letterMoves(p, "lifted");
    expect(m.map((x) => x.kind)).toEqual(["ink", "lift", "ink"]);
    expect(startOf(m[2].d)[1]).toBeCloseTo(36, 1);
    expect(endOf(m[0].d)[1]).toBeCloseTo(60.18, 1);
  });
});

describe("и: two sticks rounded at the bottom; the pen goes up the line of the second one (owner 2026-11-19)", () => {
  const i = glyph("и");
  it("the first element ends on the middle line, the second starts at the top line", () => {
    const m = letterMoves(i, "lifted");
    expect(m.map((x) => x.kind)).toEqual(["ink", "lift", "ink"]);
    expect(endOf(m[0].d)[1]).toBeCloseTo(36, 1);
    expect(startOf(m[2].d)[1]).toBeCloseTo(10, 1);
    expect(m.filter((x) => x.startDot).length).toBe(2);
  });
  it("joined: the way up from the middle line runs along the second stick, one start dot", () => {
    const m = letterMoves(i, "joined");
    expect(m.map((x) => x.kind)).toEqual(["ink", "retrace", "ink"]);
    expect(m.filter((x) => x.startDot).length).toBe(1);
    expect(near(endOf(m[1].d), [155.35, 10])).toBe(true);
  });
});

// the elements of a letter stand on the same lines (owner, 2026-11-19: «у обоих штрихов верхние и нижние точки должны быть на одной линии»)
describe("the elements stand on the same lines", () => {
  const ys = (d) => samplePath(toCubicPathD(d), 60).map((q) => q[1]);
  const ink = (ch) => letterMoves(glyph(ch), "lifted").filter((x) => x.kind === "ink").map((x) => ys(x.d));
  it("и: both sticks from the top line, both roundings equally low", () => {
    const [a, b] = ink("и");
    expect(Math.min(...a)).toBeCloseTo(10, 1);
    expect(Math.min(...b)).toBeCloseTo(10, 1);
    expect(Math.max(...a)).toBeCloseTo(Math.max(...b), 1);
  });
  it("п, р: the hook as high as the stick", () => {
    for (const ch of ["п", "р"]) {
      const [stick, hook] = ink(ch);
      expect(Math.min(...hook), ch).toBeCloseTo(Math.min(...stick), 1);
    }
  });
});

