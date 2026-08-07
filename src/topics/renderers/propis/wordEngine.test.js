import { describe, it, expect } from "vitest";
import { classifyLine, getConnectionInfo, buildWordTrajectory } from "./wordEngine.js";

const LETTER_A = {
  id: "а",
  type: "letter",
  strokes: [{ d: "M 10 75 C 12 74 14 74 16 75 C 18 76 20 76 22 75" }],
};

// Entry point deliberately near line 2 (y=36) instead of line 4 (y=75), like real б/в do.
const LETTER_B_HIGH_ENTRY = {
  id: "б",
  type: "letter",
  strokes: [{ d: "M 10 37 C 12 50 14 60 16 75 C 18 78 20 78 22 75" }],
};

describe("classifyLine", () => {
  it("picks line 4 (y=75) for a point exactly on it", () => {
    expect(classifyLine(75)).toBe(4);
  });

  it("picks line 1 (y=10) for a point near the top", () => {
    expect(classifyLine(11)).toBe(1);
  });

  it("picks line 7 (y=140) for a point near the bottom", () => {
    expect(classifyLine(139)).toBe(7);
  });

  it("picks the nearer of two adjacent lines for a midpoint-ish value", () => {
    // Between line 3 (y=62) and line 4 (y=75): 65 is closer to 62.
    expect(classifyLine(65)).toBe(3);
  });
});

describe("getConnectionInfo", () => {
  it("reads entry point + line from the first point of the first stroke", () => {
    const info = getConnectionInfo(LETTER_A);
    expect(info.entryPoint).toEqual([10, 75]);
    expect(info.entryLine).toBe(4);
  });

  it("reads exit point + line from the last point of the last stroke", () => {
    const info = getConnectionInfo(LETTER_A);
    expect(info.exitPoint).toEqual([22, 75]);
    expect(info.exitLine).toBe(4);
  });

  it("classifies a high entry point to a different line", () => {
    const info = getConnectionInfo(LETTER_B_HIGH_ENTRY);
    expect(info.entryLine).toBe(2);
  });

  it("throws a clear error for an item with no strokes", () => {
    expect(() => getConnectionInfo({ id: "x", strokes: [] })).toThrow(/x/);
  });
});

describe("buildWordTrajectory", () => {
  const letters = new Map([
    ["а", LETTER_A],
    ["б", LETTER_B_HIGH_ENTRY],
  ]);

  it("throws naming the missing letter when the word contains an uncaptured letter", () => {
    expect(() => buildWordTrajectory("х", letters, new Map())).toThrow(/х/);
  });

  it("returns just the one letter's strokes for a single-letter word, no bridge", () => {
    const result = buildWordTrajectory("а", letters, new Map());
    expect(result.strokes).toHaveLength(1);
    // translateStrokes always runs through transformPathD (even at dx=0), which reformats
    // every coordinate via toFixed(3) — same points as LETTER_A.strokes[0].d, different string.
    expect(result.strokes[0].d).toBe(
      "M 10.000 75.000 C 12.000 74.000 14.000 74.000 16.000 75.000 C 18.000 76.000 20.000 76.000 22.000 75.000"
    );
  });

  it("inserts a straight M/L bridge for a same-line transition with no connector needed", () => {
    const result = buildWordTrajectory("аа", letters, new Map());
    expect(result.strokes).toHaveLength(3); // letter, bridge, letter
    expect(result.strokes[1].d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  });

  it("offsets the second letter's strokes by one slot width (100 units)", () => {
    const result = buildWordTrajectory("аа", letters, new Map());
    expect(result.strokes[2].d).toContain("110.000"); // second а's M x=10 + 100
  });

  it("uses a matching connector's (translated + x-scaled) strokes when lines differ", () => {
    const connector = {
      id: "conn_4_2",
      type: "connector",
      fromLine: 4,
      toLine: 2,
      strokes: [{ d: "M 0 75 C 1 60 2 50 3 37" }],
    };
    const connectors = new Map([["4_2", connector]]);
    const result = buildWordTrajectory("аб", letters, connectors);
    expect(result.strokes).toHaveLength(3); // letter а, connector bridge, letter б
    expect(result.strokes[1].d).not.toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
    expect(result.strokes[1].d.startsWith("M 22.000")).toBe(true); // connector start snapped to а's exit point
  });

  it("falls back to a straight bridge when the needed connector is missing", () => {
    const result = buildWordTrajectory("аб", letters, new Map());
    expect(result.strokes).toHaveLength(3);
    expect(result.strokes[1].d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  });

  it("reports total width as letterCount * 100 and a matching viewBox", () => {
    const result = buildWordTrajectory("баба", new Map([["б", LETTER_B_HIGH_ENTRY], ["а", LETTER_A]]), new Map());
    expect(result.totalWidthUnits).toBe(400);
    expect(result.viewBox).toBe("0 0 400 150");
  });

  it("returns empty output for an empty word", () => {
    const result = buildWordTrajectory("", letters, new Map());
    expect(result.strokes).toEqual([]);
    expect(result.totalWidthUnits).toBe(0);
  });
});
