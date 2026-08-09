import { describe, it, expect } from "vitest";
import { getPathEndpoints, transformPathD, samplePath, findClosestApproach, getPathTangents } from "./pathGeometry.js";

// Real captured stroke, first M-only-then-C path from tools/propis/topic.json ("Б", stroke 0)
const REAL_STROKE_D =
  "M 31.58 45.29 C 30.54 47.86 31.46 46.75 28.46 52.99 C 25.46 59.23 16.40 77.37 13.57 82.74 " +
  "C 10.75 88.12 12.10 84.72 11.50 85.23 C 10.90 85.74 10.50 85.77 9.97 85.82 " +
  "C 9.44 85.86 8.76 85.80 8.32 85.50 C 7.88 85.19 7.49 84.64 7.34 83.99 " +
  "C 7.20 83.34 7.29 82.50 7.45 81.61 C 7.61 80.72 7.77 79.93 8.30 78.65 " +
  "C 8.83 77.38 9.70 75.57 10.63 73.95 C 11.57 72.33 12.60 70.53 13.93 68.94 " +
  "C 15.25 67.35 17.41 65.39 18.60 64.43 C 19.80 63.46 20.17 63.53 21.08 63.16 " +
  "C 21.99 62.80 22.84 62.51 24.09 62.23 C 25.33 61.95 27.22 61.57 28.57 61.46 " +
  "C 29.92 61.36 31.17 61.46 32.21 61.62 C 33.24 61.78 34.11 62.02 34.79 62.41 " +
  "C 35.48 62.80 35.97 63.36 36.30 63.95 C 36.64 64.55 36.76 65.14 36.81 65.97 " +
  "C 36.87 66.81 37.04 67.15 36.63 68.97 C 36.22 70.79 35.03 75.03 34.37 76.91 " +
  "C 33.71 78.79 33.34 79.18 32.66 80.25 C 31.99 81.33 30.92 82.63 30.31 83.34 " +
  "C 29.69 84.05 29.57 84.17 28.99 84.50 C 28.41 84.84 27.50 85.16 26.81 85.37 " +
  "C 26.12 85.59 25.80 85.84 24.85 85.80 C 23.91 85.77 21.96 85.40 21.14 85.16 " +
  "C 20.32 84.93 20.42 84.93 19.92 84.38 C 19.43 83.82 18.75 82.68 18.16 81.84";

describe("getPathEndpoints", () => {
  it("reads the start point from the M command", () => {
    const { start } = getPathEndpoints(REAL_STROKE_D);
    expect(start).toEqual([31.58, 45.29]);
  });

  it("reads the end point from the last C command's final coordinate pair", () => {
    const { end } = getPathEndpoints(REAL_STROKE_D);
    expect(end).toEqual([18.16, 81.84]);
  });

  it("handles a path with no C commands (M only)", () => {
    const { start, end } = getPathEndpoints("M 5 10");
    expect(start).toEqual([5, 10]);
    expect(end).toEqual([5, 10]);
  });
});

describe("transformPathD", () => {
  it("translates M and C coordinates by translateX/translateY", () => {
    const result = transformPathD("M 0 0 C 1 1 2 2 3 3", { translateX: 10, translateY: 5 });
    expect(result).toBe("M 10.000 5.000 C 11.000 6.000 12.000 7.000 13.000 8.000");
  });

  it("scales x (never y) by scaleX", () => {
    const result = transformPathD("M 0 0 C 1 1 2 2 3 3", { scaleX: 2 });
    expect(result).toBe("M 0.000 0.000 C 2.000 1.000 4.000 2.000 6.000 3.000");
  });

  it("defaults to identity when no options are given", () => {
    const result = transformPathD("M 1.5 2.5 C 3 3 4 4 5 5");
    expect(result).toBe("M 1.500 2.500 C 3.000 3.000 4.000 4.000 5.000 5.000");
  });

  it("round-trips getPathEndpoints after a pure translation", () => {
    const moved = transformPathD(REAL_STROKE_D, { translateX: 100 });
    const { start, end } = getPathEndpoints(moved);
    expect(start).toEqual([131.58, 45.29]);
    expect(end).toEqual([118.16, 81.84]);
  });
});

describe("samplePath", () => {
  it("includes the M point as the first sample", () => {
    const points = samplePath("M 5 10 C 6 11 7 12 8 13");
    expect(points[0]).toEqual([5, 10]);
  });

  it("ends exactly at the last C command's endpoint", () => {
    const points = samplePath("M 5 10 C 6 11 7 12 8 13");
    expect(points[points.length - 1]).toEqual([8, 13]);
  });

  it("for a collinear (straight-line) cubic, every sample lies on that line", () => {
    // p0=(0,84) p3=(20,92), control points collinear -> bezier(t) traces the straight line
    const points = samplePath("M 0 84 C 6.667 86.667 13.333 89.333 20 92", 10);
    for (const [x, y] of points) {
      const expectedY = 84 + (x / 20) * 8;
      expect(y).toBeCloseTo(expectedY, 1);
    }
  });
});

describe("getPathTangents", () => {
  it("points the start tangent from the start point toward the first C command's first control point", () => {
    const { startDir } = getPathTangents("M 0 0 C 3 4 8 8 10 10");
    expect(startDir).toEqual([3, 4]);
  });

  it("points the end tangent from the last C command's second control point toward the end point", () => {
    const { endDir } = getPathTangents("M 0 0 C 3 4 8 8 10 10");
    expect(endDir).toEqual([2, 2]); // end(10,10) - c2(8,8)
  });

  it("uses the second C segment's own control points across a multi-segment path", () => {
    const { startDir, endDir } = getPathTangents("M 0 0 C 1 0 2 0 3 0 C 3 1 3 4 5 5");
    expect(startDir).toEqual([1, 0]); // c1(1,0) - start(0,0), from the FIRST segment
    expect(endDir).toEqual([2, 1]); // end(5,5) - c2(3,4), from the LAST segment
  });

  it("falls back to the straight chord for a path with no C command", () => {
    const { startDir, endDir } = getPathTangents("M 0 0 L 4 3");
    expect(startDir).toEqual([4, 3]);
    expect(endDir).toEqual([4, 3]);
  });

  it("falls back to the chord when a control point exactly coincides with its own anchor", () => {
    // first control point == start point -> no direction of its own to contribute there
    const { startDir } = getPathTangents("M 0 0 C 0 0 5 5 10 10");
    expect(startDir).toEqual([10, 10]);
  });
});

describe("findClosestApproach", () => {
  it("returns the first and last points within tolerance of the closest approach to targetY", () => {
    const points = [[0, 80], [5, 85], [10, 88], [15, 91], [20, 96]];
    const result = findClosestApproach(points, 88, 3);
    expect(result.first).toEqual([5, 85]); // |85-88|=3, within tolerance of the exact-0 min
    expect(result.last).toEqual([15, 91]); // |91-88|=3, within tolerance
  });

  it("returns the same single point for first and last when only one point is near", () => {
    const points = [[0, 0], [1, 88], [2, 200]];
    const result = findClosestApproach(points, 88, 0);
    expect(result.first).toEqual([1, 88]);
    expect(result.last).toEqual([1, 88]);
  });

  it("generalizes to a trajectory that never exactly touches targetY", () => {
    const points = [[0, 60], [1, 70], [2, 76], [3, 70], [4, 60]];
    const result = findClosestApproach(points, 88, 5);
    // closest approach is y=76 (dist 12); tolerance 5 -> only the y=76 sample qualifies
    expect(result.first).toEqual([2, 76]);
    expect(result.last).toEqual([2, 76]);
  });
});
