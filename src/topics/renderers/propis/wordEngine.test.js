import { describe, it, expect } from "vitest";
import { transformPathD, getPathEndpoints } from "./pathGeometry.js";
import { classifyLine, getConnectionInfo, resolveConnectionInfo, getBaselineContacts, buildWordTrajectory, LETTER_GAP } from "./wordEngine.js";

const LETTER_A = {
  id: "а",
  type: "letter",
  viewBox: "0 0 100 150",
  strokes: [{ d: "M 10 75 C 12 74 14 74 16 75 C 18 76 20 76 22 75" }],
};

// Entry point deliberately near line 2 (y=36) instead of line 4 (y=75), like real б/в do.
const LETTER_B_HIGH_ENTRY = {
  id: "б",
  type: "letter",
  viewBox: "0 0 100 150",
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

describe("resolveConnectionInfo", () => {
  it("overrides exitLine for a letter in the fixed type table, ignoring this sample's own geometry", () => {
    // This stroke's own exit y=75 would geometrically classify to line 4, but "б" is a
    // fixed-type letter (line 5) regardless of where any one captured sample happens to end.
    const item = { id: "custom", label: "б", strokes: [{ d: "M 10 75 C 12 74 14 74 16 75 C 18 76 20 76 22 75" }] };
    expect(resolveConnectionInfo(item).exitLine).toBe(5);
  });

  it("falls back to geometric classification for a letter with no override", () => {
    const item = { id: "custom", label: "щ", strokes: [{ d: "M 10 75 C 12 74 14 74 16 75 C 18 76 20 76 22 75" }] };
    expect(resolveConnectionInfo(item).exitLine).toBe(4);
  });

  it("falls back to geometric classification when the item has no label at all", () => {
    expect(resolveConnectionInfo(LETTER_B_HIGH_ENTRY).exitLine).toBe(classifyLine(75));
  });

  it("leaves the real entry/exit points unaffected by the override", () => {
    const item = { id: "custom", label: "б", strokes: [{ d: "M 10 75 C 12 74 14 74 16 75 C 18 76 20 76 22 75" }] };
    expect(resolveConnectionInfo(item).exitPoint).toEqual([22, 75]);
  });
});

describe("getBaselineContacts", () => {
  // Both strokes are collinear cubics (bezier(t) traces a straight line), so their exact
  // baseline (y=88) crossing is easy to know: stroke 1 crosses at x=10, stroke 2 at x=90.
  const TWO_STROKE_ITEM = {
    id: "x",
    strokes: [
      { d: "M 0 84 C 6.667 86.667 13.333 89.333 20 92" },
      { d: "M 80 84 C 86.667 86.667 93.333 89.333 100 92" },
    ],
  };

  it("finds 'first' from the first-drawn stroke and 'last' from the last-drawn stroke", () => {
    const contacts = getBaselineContacts(TWO_STROKE_ITEM);
    expect(contacts.first[0]).toBeGreaterThanOrEqual(5);
    expect(contacts.first[0]).toBeLessThanOrEqual(15);
    expect(contacts.last[0]).toBeGreaterThanOrEqual(85);
    expect(contacts.last[0]).toBeLessThanOrEqual(95);
  });

  it("throws a clear error for an item with no strokes", () => {
    expect(() => getBaselineContacts({ id: "x", strokes: [] })).toThrow(/x/);
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

  it("places each letter so consecutive baseline-contact points are exactly LETTER_GAP apart, in either order", () => {
    // This is the regression case for the original bug report: with the old entry/exit
    // *stroke*-point-based placement, "аб" and "ба" produced very different-looking gaps
    // depending on order (a real letter pair showed 78.9 one way, 16.4 the other).
    // Baseline-contact-based placement must give the exact same LETTER_GAP either way.
    const aContacts = getBaselineContacts(LETTER_A);
    const bContacts = getBaselineContacts(LETTER_B_HIGH_ENTRY);

    const forward = buildWordTrajectory("аб", letters, new Map());
    const expectedOffsetB = aContacts.last[0] + LETTER_GAP - bContacts.first[0];
    expect(forward.strokes[forward.strokes.length - 1].d).toBe(
      transformPathD(LETTER_B_HIGH_ENTRY.strokes[0].d, { translateX: expectedOffsetB })
    );

    const backward = buildWordTrajectory("ба", letters, new Map());
    const expectedOffsetA = bContacts.last[0] + LETTER_GAP - aContacts.first[0];
    expect(backward.strokes[backward.strokes.length - 1].d).toBe(
      transformPathD(LETTER_A.strokes[0].d, { translateX: expectedOffsetA })
    );
  });

  it("falls back to a straight bridge when no exit connector matches the previous letter's type", () => {
    const result = buildWordTrajectory("аб", letters, new Map());
    expect(result.strokes).toHaveLength(3);
    expect(result.strokes[1].d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  });

  it("reports a viewBox exactly matching totalWidthUnits, wide enough for the whole word", () => {
    const result = buildWordTrajectory("баба", new Map([["б", LETTER_B_HIGH_ENTRY], ["а", LETTER_A]]), new Map());
    expect(result.viewBox).toBe(`0 0 ${result.totalWidthUnits} 150`);
    expect(result.totalWidthUnits).toBeGreaterThan(100); // more than one letter's own box, for a 4-letter word
  });

  it("returns empty output for an empty word", () => {
    const result = buildWordTrajectory("", letters, new Map());
    expect(result.strokes).toEqual([]);
    expect(result.totalWidthUnits).toBe(0);
  });
});

describe("buildWordTrajectory — exit connectors (real, hand-drawn, never rescaled)", () => {
  // Exits at y=36 -> geometric exitLine 2 (not 4 — a real exit connector's key never ends
  // up "4_4", since exitLine=4 is the ordinary default that never needs a connector at
  // all; picking a non-4 exit type here also avoids colliding with the "4_${entryType}"
  // entry-connector key format tested separately below).
  const EXIT_2_KEY = "x"; // plain ASCII, deliberately distinct from any real Cyrillic label
  const LETTER_EXIT_2 = {
    id: EXIT_2_KEY, label: EXIT_2_KEY,
    strokes: [{ d: "M 10 75 C 12 60 14 48 16 36" }],
  };
  const letters = new Map([[LETTER_A.id, LETTER_A], [EXIT_2_KEY, LETTER_EXIT_2]]);
  const EXIT_CONNECTOR_2 = {
    id: "conn_2_4",
    type: "connector",
    fromLine: 2,
    toLine: 4,
    strokes: [{ d: "M 0 36 C 5 45 10 60 15 75" }],
  };
  const WORD = EXIT_2_KEY + LETTER_A.id;

  it("places the connector translated (never rescaled) so its own start lands on the previous letter's baseline-contact point", () => {
    const connectors = new Map([["2_4", EXIT_CONNECTOR_2]]);
    const result = buildWordTrajectory(WORD, letters, connectors);

    const exit2Contacts = getBaselineContacts(LETTER_EXIT_2);
    const connInfo = getConnectionInfo(EXIT_CONNECTOR_2);
    const dx = exit2Contacts.last[0] - connInfo.entryPoint[0];
    const dy = exit2Contacts.last[1] - connInfo.entryPoint[1];

    // letter, connector, residual bridge (closes the connector-to-letter gap), letter — the
    // letter itself never moves vertically (see wordEngine.js's residualBridge comment: doing
    // so used to make a repeated exit type drift a little taller/shorter on every occurrence).
    expect(result.strokes).toHaveLength(4);
    expect(result.strokes[1].d).toBe(
      transformPathD(EXIT_CONNECTOR_2.strokes[0].d, { translateX: dx, translateY: dy })
    );
  });

  it("keeps the next letter at its own native height and bridges the leftover gap instead of moving it", () => {
    const connectors = new Map([["2_4", EXIT_CONNECTOR_2]]);
    const result = buildWordTrajectory(WORD, letters, connectors);

    const exit2Contacts = getBaselineContacts(LETTER_EXIT_2);
    const connInfo = getConnectionInfo(EXIT_CONNECTOR_2);
    const dx = exit2Contacts.last[0] - connInfo.entryPoint[0];
    const dy = exit2Contacts.last[1] - connInfo.entryPoint[1];
    const connectorEnd = [connInfo.exitPoint[0] + dx, connInfo.exitPoint[1] + dy];

    const aEntry = getConnectionInfo(LETTER_A).entryPoint;
    const expectedDx = connectorEnd[0] - aEntry[0];
    // The letter is shifted horizontally only — its own native y is untouched.
    expect(result.strokes[3].d).toBe(
      transformPathD(LETTER_A.strokes[0].d, { translateX: expectedDx, translateY: 0 })
    );

    // The residual bridge (strokes[2]) exactly closes the gap: starts where the connector
    // ends, ends exactly where the (horizontally shifted) letter's own entry point is.
    const bridgeEnds = getPathEndpoints(result.strokes[2].d);
    expect(bridgeEnds.start[0]).toBeCloseTo(connectorEnd[0], 3);
    expect(bridgeEnds.start[1]).toBeCloseTo(connectorEnd[1], 3);
    expect(bridgeEnds.end[0]).toBeCloseTo(aEntry[0] + expectedDx, 6);
    expect(bridgeEnds.end[1]).toBeCloseTo(aEntry[1], 6);
  });

  it("does not touch the connector at all when no exit connector matches this letter's type", () => {
    const result = buildWordTrajectory(WORD, letters, new Map());
    expect(result.strokes).toHaveLength(3);
    expect(result.strokes[1].d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/); // plain straight bridge instead
  });
});

describe("buildWordTrajectory — entry connectors chained after exit connectors", () => {
  const PREV_LETTER = { id: "prev", label: "в", strokes: [{ d: "M 10 70 C 12 71 14 72 16 73" }] };
  const NEXT_LETTER = { id: "next", label: "о", strokes: [{ d: "M 50 60 C 52 61 54 62 56 63" }] };
  const EXIT_CONNECTOR = { id: "conn_5_4", type: "connector", fromLine: 5, toLine: 4, strokes: [{ d: "M 0 75 C 2 74 4 74 6 75" }] };
  const ENTRY_CONNECTOR = { id: "conn_4_3", type: "connector", fromLine: 4, toLine: 3, strokes: [{ d: "M 20 75 C 22 70 24 65 26 60" }] };
  const letters = new Map([["в", PREV_LETTER], ["о", NEXT_LETTER]]);
  const connectors = new Map([["5_4", EXIT_CONNECTOR], ["4_3", ENTRY_CONNECTOR]]);

  it("uses both connectors when the previous letter's exit type and this letter's entry type each have one", () => {
    const result = buildWordTrajectory("во", letters, connectors);
    // prev letter, exit connector, residual bridge (closes the exit-to-entry-connector gap),
    // entry connector, next letter.
    expect(result.strokes).toHaveLength(5);
  });

  it("chains the exit connector's own end into the entry connector's own start with no gap, via a residual bridge", () => {
    const result = buildWordTrajectory("во", letters, connectors);
    const exitEnd = getPathEndpoints(result.strokes[1].d).end;
    const bridge = getPathEndpoints(result.strokes[2].d);
    const entryStart = getPathEndpoints(result.strokes[3].d).start;

    // The residual bridge exactly closes both ends of the gap (both axes) — it starts
    // exactly where the exit connector ends and ends exactly where the entry connector
    // (already translated into place) starts.
    expect(bridge.start[0]).toBeCloseTo(exitEnd[0], 6);
    expect(bridge.start[1]).toBeCloseTo(exitEnd[1], 6);
    expect(bridge.end[0]).toBeCloseTo(entryStart[0], 6);
    expect(bridge.end[1]).toBeCloseTo(entryStart[1], 6);
  });

  it("places the next letter's own raw entry point exactly at the entry connector's translated end", () => {
    const result = buildWordTrajectory("во", letters, connectors);
    const entryConnectorEnd = getPathEndpoints(result.strokes[3].d).end;
    const letterStart = getPathEndpoints(result.strokes[4].d).start;
    expect(letterStart[0]).toBeCloseTo(entryConnectorEnd[0], 6);
    expect(letterStart[1]).toBeCloseTo(entryConnectorEnd[1], 6);
  });

  it("keeps the next letter at its own native height — never shifted vertically by the connector chain", () => {
    const result = buildWordTrajectory("во", letters, connectors);
    const letterStart = getPathEndpoints(result.strokes[4].d).start;
    const nativeY = getPathEndpoints(NEXT_LETTER.strokes[0].d).start[1];
    expect(letterStart[1]).toBeCloseTo(nativeY, 6);
  });

  it("keeps both connector pieces at their own authored length — never rescaled", () => {
    const result = buildWordTrajectory("во", letters, connectors);

    const placedExit = getPathEndpoints(result.strokes[1].d);
    const ownExit = getPathEndpoints(EXIT_CONNECTOR.strokes[0].d);
    expect(placedExit.end[0] - placedExit.start[0]).toBeCloseTo(ownExit.end[0] - ownExit.start[0], 6);

    const placedEntry = getPathEndpoints(result.strokes[3].d);
    const ownEntry = getPathEndpoints(ENTRY_CONNECTOR.strokes[0].d);
    expect(placedEntry.end[0] - placedEntry.start[0]).toBeCloseTo(ownEntry.end[0] - ownEntry.start[0], 6);
  });
});
