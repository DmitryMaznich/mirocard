import { describe, it, expect } from "vitest";
import { recognizeSign } from "./signRecognition";

// Builds a point array by linear-interpolating between waypoints, so tests
// can describe a stroke as a few key coordinates instead of hand-writing
// every sampled point.
function stroke(waypoints, pointsPerSegment = 8) {
  const pts = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [x1, y1] = waypoints[i];
    const [x2, y2] = waypoints[i + 1];
    for (let t = 0; t < pointsPerSegment; t++) {
      const f = t / pointsPerSegment;
      pts.push({ x: x1 + (x2 - x1) * f, y: y1 + (y2 - y1) * f });
    }
  }
  pts.push(waypoints[waypoints.length - 1].map ? { x: waypoints.at(-1)[0], y: waypoints.at(-1)[1] } : waypoints.at(-1));
  return pts;
}

describe("recognizeSign", () => {
  it("recognizes a clean '<' (vertex centered, wide overshoot)", () => {
    const s = stroke([[80, 40], [20, 150], [80, 260]]);
    expect(recognizeSign([s])).toBe("<");
  });

  it("recognizes a clean '>' (vertex centered, wide overshoot)", () => {
    const s = stroke([[20, 40], [80, 150], [20, 260]]);
    expect(recognizeSign([s])).toBe(">");
  });

  it("recognizes a clean '=' as two flat strokes", () => {
    const top    = stroke([[40, 100], [200, 100]]);
    const bottom = stroke([[40, 180], [200, 180]]);
    expect(recognizeSign([top, bottom])).toBe("=");
  });

  it("tolerates a small/shaky '<' with modest overshoot (a wobbly child hand)", () => {
    // Total horizontal span only 40px, overshoot past the vertex just 10px —
    // would fail a fixed 20px-overshoot threshold but is a legible '<'.
    const s = stroke([[100, 60], [60, 150], [100, 240]]);
    expect(recognizeSign([s])).toBe("<");
  });

  it("tolerates a vertex close to the start/end of the stroke (quick gesture)", () => {
    // Vertex sits very early in the point sequence — a fast stroke sampled
    // with few points before/after the turn.
    const s = stroke([[90, 50], [30, 130]], 2).concat(stroke([[30, 130], [90, 250]], 20));
    expect(recognizeSign([s])).toBe("<");
  });

  it("recognizes a short stroke with few sampled points", () => {
    const s = [{ x: 90, y: 40 }, { x: 30, y: 150 }, { x: 90, y: 260 }];
    expect(recognizeSign([s])).toBe("<");
  });

  it("does not mistake two near-square strokes for '='", () => {
    const square1 = [{ x: 40, y: 100 }, { x: 55, y: 115 }, { x: 40, y: 130 }];
    const square2 = [{ x: 40, y: 180 }, { x: 55, y: 195 }, { x: 40, y: 210 }];
    expect(recognizeSign([square1, square2])).toBe("?");
  });

  it("returns '?' for an ambiguous scribble with no clear vertex", () => {
    const s = stroke([[40, 40], [90, 90], [140, 40], [190, 90]]);
    expect(recognizeSign([s])).toBe("?");
  });

  it("returns null for no strokes", () => {
    expect(recognizeSign([])).toBe(null);
  });
});
