import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { letterPaths, letterMoves, segmentShare } from "./letterParts.js";

const wide = JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8")).glyphs;
const spec = JSON.parse(readFileSync("tools/handwriting/cyrillic/letter_elements.json", "utf-8")).letters;
const glyph = (ch) => ({ ...wide.find((g) => g.label === ch), trajectory: spec[ch] });
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
    expect(near(endOf(moves[1].d), [120.16, 46.87])).toBe(true);
  });
  it("joined: one start dot, stick → retrace → hook, no jump", () => {
    const m = letterMoves(r, "joined");
    expect(m.map((x) => x.kind)).toEqual(["ink", "retrace", "ink"]);
    expect(m.filter((x) => x.startDot).length).toBe(1);
  });
  it("lifted: stick, a jump from its foot up to the hook's start, the hook from its own dot", () => {
    const m = letterMoves(r, "lifted");
    expect(m.map((x) => x.kind)).toEqual(["ink", "jump", "ink"]);
    expect(m.filter((x) => x.startDot).length).toBe(2);
    expect(near(m[1].from, [88.86, 114])).toBe(true);
    expect(near(m[1].to, [120.16, 46.87])).toBe(true);
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
