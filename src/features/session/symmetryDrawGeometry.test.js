import { describe, it, expect } from "vitest";
import { dictationPath, mirrorPaths, translatePaths, pathToD, commandEnd } from "./symmetryDrawGeometry";

describe("commandEnd", () => {
  it("walks a single orthogonal move", () => {
    expect(commandEnd({ col: 2, row: 2 }, { direction: "right", cells: 3 })).toEqual({ col: 5, row: 2 });
  });
  it("walks a diagonal move", () => {
    expect(commandEnd({ col: 5, row: 5 }, { direction: "up_left", cells: 2 })).toEqual({ col: 3, row: 3 });
  });
});

describe("dictationPath", () => {
  it("builds the full polyline from start through all commands", () => {
    const points = dictationPath({ col: 1, row: 1 }, [
      { direction: "right", cells: 3 },
      { direction: "down", cells: 2 },
    ]);
    expect(points).toEqual([
      { col: 1, row: 1 },
      { col: 4, row: 1 },
      { col: 4, row: 3 },
    ]);
  });

  it("returns just the start point when there are no commands", () => {
    expect(dictationPath({ col: 0, row: 0 }, [])).toEqual([{ col: 0, row: 0 }]);
  });
});

describe("mirrorPaths", () => {
  it("reflects points across the axis column", () => {
    const result = mirrorPaths([[{ col: 2, row: 3 }, { col: 4, row: 5 }]], 5);
    expect(result).toEqual([[{ col: 8, row: 3 }, { col: 6, row: 5 }]]);
  });
  it("returns an empty array for undefined input", () => {
    expect(mirrorPaths(undefined, 5)).toEqual([]);
  });
});

describe("translatePaths", () => {
  it("shifts points right by the axis column", () => {
    const result = translatePaths([[{ col: 2, row: 3 }]], 5);
    expect(result).toEqual([[{ col: 7, row: 3 }]]);
  });
});

describe("pathToD", () => {
  it("builds an SVG path with M for the first point and L for the rest", () => {
    expect(pathToD([{ col: 1, row: 1 }, { col: 4, row: 1 }, { col: 4, row: 3 }])).toBe("M 1 1 L 4 1 L 4 3");
  });
});
