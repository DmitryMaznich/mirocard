import { describe, it, expect } from "vitest";
import { transformPathD, getPathEndpoints } from "./pathGeometry.js";
import { classifyLine, getConnectionInfo, resolveConnectionInfo, getBaselineContacts, buildWordTrajectory } from "./wordEngine.js";
import { GUIDE_LINES } from "./propisRuling.js";

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

describe("buildWordTrajectory — no captured connector on either side", () => {
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

  it("snaps the next letter's own entry point exactly onto the previous letter's own exit point — no bridge stroke, no gap", () => {
    const result = buildWordTrajectory("аа", letters, new Map());
    expect(result.strokes).toHaveLength(2); // letter, letter — nothing drawn in between
    const firstExit = getPathEndpoints(result.strokes[0].d).end;
    const secondEntry = getPathEndpoints(result.strokes[1].d).start;
    expect(secondEntry[0]).toBeCloseTo(firstExit[0], 6);
    expect(secondEntry[1]).toBeCloseTo(firstExit[1], 6);
  });

  it("snaps exactly regardless of letter order — no fixed-gap norm involved", () => {
    // Regression case for the original bug report: with the old entry/exit *stroke*-point
    // gap norm, "аб" and "ба" produced very different-looking gaps depending on order. Exact
    // snapping sidesteps this entirely: whichever letter comes second, its own entry point
    // always lands exactly on the previous letter's own exit point.
    const forward = buildWordTrajectory("аб", letters, new Map());
    const forwardExit = getPathEndpoints(forward.strokes[0].d).end;
    const forwardEntry = getPathEndpoints(forward.strokes[1].d).start;
    expect(forwardEntry[0]).toBeCloseTo(forwardExit[0], 6);
    expect(forwardEntry[1]).toBeCloseTo(forwardExit[1], 6);

    const backward = buildWordTrajectory("ба", letters, new Map());
    const backwardExit = getPathEndpoints(backward.strokes[0].d).end;
    const backwardEntry = getPathEndpoints(backward.strokes[1].d).start;
    expect(backwardEntry[0]).toBeCloseTo(backwardExit[0], 6);
    expect(backwardEntry[1]).toBeCloseTo(backwardExit[1], 6);
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

  it("places the connector's near end on the previous letter's baseline-contact point (X translated, Y unchanged there)", () => {
    const connectors = new Map([["2_4", [EXIT_CONNECTOR_2]]]);
    const result = buildWordTrajectory(WORD, letters, connectors);

    const exit2Contacts = getBaselineContacts(LETTER_EXIT_2);
    const connectorStart = getPathEndpoints(result.strokes[1].d).start;

    expect(result.strokes).toHaveLength(3); // letter, connector, letter — no bridge
    expect(connectorStart[0]).toBeCloseTo(exit2Contacts.last[0], 3);
    expect(connectorStart[1]).toBeCloseTo(exit2Contacts.last[1], 3);
  });

  it("rescales the connector's Y so its far end lands exactly on its own canonical toLine, regardless of where the near-end anchor sits", () => {
    const connectors = new Map([["2_4", [EXIT_CONNECTOR_2]]]);
    const result = buildWordTrajectory(WORD, letters, connectors);

    const connectorEnd = getPathEndpoints(result.strokes[1].d).end;
    const canonicalY = GUIDE_LINES.find((g) => g.line === EXIT_CONNECTOR_2.toLine).y;
    expect(connectorEnd[1]).toBeCloseTo(canonicalY, 3);
  });

  it("snaps the next letter's own entry point exactly onto the connector's translated end (both axes)", () => {
    const connectors = new Map([["2_4", [EXIT_CONNECTOR_2]]]);
    const result = buildWordTrajectory(WORD, letters, connectors);

    const connectorEnd = getPathEndpoints(result.strokes[1].d).end;
    const letterEntry = getPathEndpoints(result.strokes[2].d).start;
    expect(letterEntry[0]).toBeCloseTo(connectorEnd[0], 6);
    expect(letterEntry[1]).toBeCloseTo(connectorEnd[1], 6);
  });

  it("snaps the next letter directly onto the previous letter's own exit point when no exit connector matches", () => {
    const result = buildWordTrajectory(WORD, letters, new Map());
    expect(result.strokes).toHaveLength(2); // letter, letter — nothing drawn in between
    const exit = getPathEndpoints(result.strokes[0].d).end;
    const entry = getPathEndpoints(result.strokes[1].d).start;
    expect(entry[0]).toBeCloseTo(exit[0], 6);
    expect(entry[1]).toBeCloseTo(exit[1], 6);
  });
});

describe("buildWordTrajectory — entry connectors chained after exit connectors", () => {
  const PREV_LETTER = { id: "prev", label: "в", strokes: [{ d: "M 10 70 C 12 71 14 72 16 73" }] };
  const NEXT_LETTER = { id: "next", label: "о", strokes: [{ d: "M 50 60 C 52 61 54 62 56 63" }] };
  // Non-zero own Y-span (87 -> 75), matching a real captured exit connector — a flat (zero
  // Y-span) fixture can't exercise placeExitConnector's rescale at all (nothing to scale),
  // which is exactly the trap the very first version of this fixture fell into.
  const EXIT_CONNECTOR = { id: "conn_5_4", type: "connector", fromLine: 5, toLine: 4, strokes: [{ d: "M 0 87 C 2 84 4 80 6 75" }] };
  const ENTRY_CONNECTOR = { id: "conn_4_3", type: "connector", fromLine: 4, toLine: 3, strokes: [{ d: "M 20 75 C 22 70 24 65 26 60" }] };
  const letters = new Map([["в", PREV_LETTER], ["о", NEXT_LETTER]]);
  const connectors = new Map([["5_4", [EXIT_CONNECTOR]], ["4_3", [ENTRY_CONNECTOR]]]);

  it("uses both connectors when the previous letter's exit type and this letter's entry type each have one", () => {
    const result = buildWordTrajectory("во", letters, connectors);
    // prev letter, exit connector, entry connector, next letter — no bridge in between.
    expect(result.strokes).toHaveLength(4);
  });

  it("chains the exit connector's own end directly into the entry connector's own start, exactly, both axes", () => {
    const result = buildWordTrajectory("во", letters, connectors);
    const exitEnd = getPathEndpoints(result.strokes[1].d).end;
    const entryStart = getPathEndpoints(result.strokes[2].d).start;
    expect(entryStart[0]).toBeCloseTo(exitEnd[0], 6);
    expect(entryStart[1]).toBeCloseTo(exitEnd[1], 6);
  });

  it("places the next letter's own raw entry point exactly at the entry connector's translated end", () => {
    const result = buildWordTrajectory("во", letters, connectors);
    const entryConnectorEnd = getPathEndpoints(result.strokes[2].d).end;
    const letterStart = getPathEndpoints(result.strokes[3].d).start;
    expect(letterStart[0]).toBeCloseTo(entryConnectorEnd[0], 6);
    expect(letterStart[1]).toBeCloseTo(entryConnectorEnd[1], 6);
  });

  it("keeps both connector pieces at their own authored X-length (X is still translate-only)", () => {
    const result = buildWordTrajectory("во", letters, connectors);

    const placedExit = getPathEndpoints(result.strokes[1].d);
    const ownExit = getPathEndpoints(EXIT_CONNECTOR.strokes[0].d);
    expect(placedExit.end[0] - placedExit.start[0]).toBeCloseTo(ownExit.end[0] - ownExit.start[0], 6);

    const placedEntry = getPathEndpoints(result.strokes[2].d);
    const ownEntry = getPathEndpoints(ENTRY_CONNECTOR.strokes[0].d);
    expect(placedEntry.end[0] - placedEntry.start[0]).toBeCloseTo(ownEntry.end[0] - ownEntry.start[0], 6);
  });

  it("lands the exit connector's end and the entry connector's start exactly on their shared canonical line (both are toLine/fromLine 4)", () => {
    const result = buildWordTrajectory("во", letters, connectors);
    const canonicalLine4 = GUIDE_LINES.find((g) => g.line === 4).y;

    const exitEnd = getPathEndpoints(result.strokes[1].d).end;
    const entryStart = getPathEndpoints(result.strokes[2].d).start;
    expect(exitEnd[1]).toBeCloseTo(canonicalLine4, 3);
    expect(entryStart[1]).toBeCloseTo(canonicalLine4, 3);
  });
});

describe("buildWordTrajectory — entry connector fires even without a matching exit connector", () => {
  // Regression case: б/а/о/ф each have their own entry connector (line 4 → line 3), but an
  // earlier implementation only ever looked up the entry connector *inside* the branch where
  // the previous letter's own exit connector was found — so following a letter with no
  // captured exit type (e.g. "д", which has no EXIT_LINE_OVERRIDES entry) silently skipped
  // the entry connector entirely.
  const PREV_LETTER = { id: "prev2", label: "в", strokes: [{ d: "M 10 70 C 12 71 14 72 16 73" }] };
  const NEXT_LETTER = { id: "next2", label: "о", strokes: [{ d: "M 50 60 C 52 61 54 62 56 63" }] };
  const ENTRY_CONNECTOR = { id: "conn_4_3", type: "connector", fromLine: 4, toLine: 3, strokes: [{ d: "M 20 75 C 22 70 24 65 26 60" }] };
  const letters = new Map([["в", PREV_LETTER], ["о", NEXT_LETTER]]);
  // Deliberately no "5_4" exit connector registered — "в" overrides to exitLine 5 in
  // production, but nothing here can satisfy findExitConnector for it.
  const connectorsNoExit = new Map([["4_3", [ENTRY_CONNECTOR]]]);

  it("still attaches the entry connector as a lead-in, snapped directly onto the previous letter's own exit point", () => {
    const result = buildWordTrajectory("во", letters, connectorsNoExit);
    // prev letter, entry connector, next letter — no bridge in between.
    expect(result.strokes).toHaveLength(3);
  });

  it("chains the previous letter's own exit point into the entry connector's start with no gap", () => {
    const result = buildWordTrajectory("во", letters, connectorsNoExit);
    const prevExit = getPathEndpoints(result.strokes[0].d).end;
    const entryStart = getPathEndpoints(result.strokes[1].d).start;
    expect(entryStart[0]).toBeCloseTo(prevExit[0], 6);
    expect(entryStart[1]).toBeCloseTo(prevExit[1], 6);
  });

  it("places the next letter's own raw entry point exactly at the entry connector's translated end", () => {
    const result = buildWordTrajectory("во", letters, connectorsNoExit);
    const entryConnectorEnd = getPathEndpoints(result.strokes[1].d).end;
    const letterStart = getPathEndpoints(result.strokes[2].d).start;
    expect(letterStart[0]).toBeCloseTo(entryConnectorEnd[0], 6);
    expect(letterStart[1]).toBeCloseTo(entryConnectorEnd[1], 6);
  });
});

describe("buildWordTrajectory — multiple connectors sharing the same line pair (forLetters)", () => {
  // Both б (LOWER_ENTRY, entry connector 4→3) and и (a straight-diagonal-entry letter, also
  // classifies to entryLine 3 via its own raw entry point) can need an entry connector on
  // the same "4_3" key — real production case: о/а/б/ф's looping entry connector vs a
  // straight one captured for и/к/у/etc. `forLetters` on the card disambiguates which one
  // a given destination letter gets.
  const PREV_LETTER = { id: "prev3", label: "в", strokes: [{ d: "M 10 70 C 12 71 14 72 16 73" }] };
  const LETTER_B = { id: "б3", label: "б", strokes: [{ d: "M 50 62 C 52 63 54 64 56 65" }] };
  const LETTER_I = { id: "и3", label: "и", strokes: [{ d: "M 60 62 C 62 63 64 64 66 65" }] };
  const letters = new Map([["в", PREV_LETTER], ["б", LETTER_B], ["и", LETTER_I]]);

  const LOOPING_ENTRY = { id: "conn_4_3", type: "connector", fromLine: 4, toLine: 3, strokes: [{ d: "M 20 75 C 22 70 24 65 26 60" }] };
  const STRAIGHT_ENTRY = {
    id: "conn_4_3_straight", type: "connector", fromLine: 4, toLine: 3, forLetters: ["и"],
    strokes: [{ d: "M 30 75 L 34 62" }],
  };
  const connectors = new Map([["4_3", [LOOPING_ENTRY, STRAIGHT_ENTRY]]]);

  // X-span alone is enough to tell the two connector shapes apart (4 vs 6 units) and, unlike
  // Y-span, is unaffected by placeEntryConnectorLocal's Y-rescale (see wordEngine.js) — using
  // it here keeps this test about *which card got picked*, not about the Y-correction that's
  // covered separately above.
  it("gives a letter in forLetters the dedicated connector", () => {
    const result = buildWordTrajectory("ви", letters, connectors);
    const placedEntry = getPathEndpoints(result.strokes[1].d);
    const ownStraight = getPathEndpoints(STRAIGHT_ENTRY.strokes[0].d);
    expect(placedEntry.end[0] - placedEntry.start[0]).toBeCloseTo(ownStraight.end[0] - ownStraight.start[0], 6);
  });

  it("falls back to the connector with no forLetters for any other letter at the same key", () => {
    const result = buildWordTrajectory("вб", letters, connectors);
    const placedEntry = getPathEndpoints(result.strokes[1].d);
    const ownLooping = getPathEndpoints(LOOPING_ENTRY.strokes[0].d);
    expect(placedEntry.end[0] - placedEntry.start[0]).toBeCloseTo(ownLooping.end[0] - ownLooping.start[0], 6);
  });
});

describe("buildWordTrajectory — dual-nature letter (о) connection variants", () => {
  // "б" is both an EXIT_LINE_OVERRIDES letter (upper-exit) and a LOWER_ENTRY_LETTERS letter
  // — real production classification, not a test-only fixture, since resolveVariant reads
  // EXIT_LINE_OVERRIDES directly (see wordEngine.js).
  const LETTER_B = { id: "б", label: "б", strokes: [{ d: "M 10 70 C 12 71 14 72 16 73" }] };
  // "е" is a MIDDLE_ENTRY_LETTERS letter (simplifies to "upper" — no middle-exit variant
  // captured yet).
  const LETTER_E = { id: "е", label: "е", strokes: [{ d: "M 50 60 C 52 61 54 62 56 63" }] };
  const O_PLAIN = { id: "о", label: "о", strokes: [{ d: "M 20 68 C 22 69 24 70 26 71" }] };
  const O_FIRST_LOWER = {
    id: "о_first_l", label: "о_first_l", variantOf: "о", position: "first", exitType: "lower",
    strokes: [{ d: "M 30 65 C 32 66 34 67 36 68" }],
  };
  const O_MIDDLE_UU = {
    id: "о_middle_uu", label: "о_middle_uu", variantOf: "о", position: "middle", entryType: "upper", exitType: "upper",
    strokes: [{ d: "M 40 64 C 42 65 44 66 46 67" }],
  };
  const letters = new Map([
    ["б", LETTER_B], ["е", LETTER_E], ["о", O_PLAIN],
    ["о_first_l", O_FIRST_LOWER], ["о_middle_uu", O_MIDDLE_UU],
  ]);

  it("picks the first-position variant matching the next letter's height group", () => {
    // "об": о is first, followed by "б" (LOWER_ENTRY_LETTERS) -> exitType "lower".
    const result = buildWordTrajectory("об", letters, new Map());
    expect(result.strokes[0].d).toBe(
      transformPathD(O_FIRST_LOWER.strokes[0].d, { translateX: 0, translateY: 0 })
    );
  });

  it("picks the middle-position variant matching both neighbors", () => {
    // "бое": о is in the middle, preceded by "б" (EXIT_LINE_OVERRIDES -> entryType "upper")
    // and followed by "е" (MIDDLE_ENTRY_LETTERS, simplified to exitType "upper").
    const result = buildWordTrajectory("бое", letters, new Map());
    const oStroke = getPathEndpoints(result.strokes[1].d);
    const ownO = getPathEndpoints(O_MIDDLE_UU.strokes[0].d);
    // Confirms the MIDDLE_UU variant's own shape was used (same length), not plain O_PLAIN.
    expect(oStroke.end[0] - oStroke.start[0]).toBeCloseTo(ownO.end[0] - ownO.start[0], 6);
  });

  it("falls back to the plain isolated card when no matching variant is captured", () => {
    // "ои": о is first, followed by "и" (UPPER_ENTRY_LETTERS) -> exitType "upper", but only
    // a "lower" first-variant exists here — must not throw, must use O_PLAIN instead.
    const LETTER_I = { id: "и", label: "и", strokes: [{ d: "M 60 60 C 62 61 64 62 66 63" }] };
    const withI = new Map(letters).set("и", LETTER_I);
    const result = buildWordTrajectory("ои", withI, new Map());
    const oStroke = getPathEndpoints(result.strokes[0].d);
    const ownPlain = getPathEndpoints(O_PLAIN.strokes[0].d);
    expect(oStroke.end[0] - oStroke.start[0]).toBeCloseTo(ownPlain.end[0] - ownPlain.start[0], 6);
  });

  it("does not touch a non-dual-nature letter's own connection logic at all", () => {
    // No variant exists for "б" or "е" themselves (only "о" has any variantOf cards) — this
    // just confirms buildVariantIndex ignores cards without variantOf without erroring.
    expect(() => buildWordTrajectory("бе", letters, new Map())).not.toThrow();
  });

  // "г" is a MIDDLE_ENTRY_LETTERS letter and not in EXIT_LINE_OVERRIDES -> its exit always
  // resolves to entryType "lower" for whatever dual-nature letter follows it.
  const LETTER_G = { id: "г", label: "г", strokes: [{ d: "M 5 70 C 7 71 9 72 11 73" }] };

  it("picks the last-position variant matching the preceding letter's exit type", () => {
    const O_LAST_LOWER = {
      id: "о_last_l", label: "о_last_l", variantOf: "о", position: "last", entryType: "lower",
      strokes: [{ d: "M 70 65 C 72 66 74 67 76 68" }],
    };
    const withLast = new Map(letters).set("г", LETTER_G).set("о_last_l", O_LAST_LOWER);
    // "го": о is last, preceded by "г" (not in EXIT_LINE_OVERRIDES) -> entryType "lower".
    const result = buildWordTrajectory("го", withLast, new Map());
    const oStroke = getPathEndpoints(result.strokes[result.strokes.length - 1].d);
    const ownLast = getPathEndpoints(O_LAST_LOWER.strokes[0].d);
    expect(oStroke.end[0] - oStroke.start[0]).toBeCloseTo(ownLast.end[0] - ownLast.start[0], 6);
  });

  it("prefers a dual-exit variant over the upper/lower bucket when the next letter is itself dual-nature", () => {
    const O_MIDDLE_LOWER_UPPER = {
      id: "о_middle_lu", label: "о_middle_lu", variantOf: "о", position: "middle", entryType: "lower", exitType: "upper",
      strokes: [{ d: "M 80 65 C 82 66 84 67 86 68" }],
    };
    const O_MIDDLE_LOWER_DUAL = {
      id: "о_middle_ld", label: "о_middle_ld", variantOf: "о", position: "middle", entryType: "lower", exitType: "dual",
      strokes: [{ d: "M 90 65 C 92 66 94 67 96 68" }],
    };
    const withBoth = new Map(letters)
      .set("г", LETTER_G)
      .set("о_middle_lu", O_MIDDLE_LOWER_UPPER)
      .set("о_middle_ld", O_MIDDLE_LOWER_DUAL);
    // "гоо": first о is middle, preceded by "г" (entryType "lower"), followed by another "о"
    // (dual-nature) -> must pick the dedicated dual-exit card, not the generic upper-exit one.
    const result = buildWordTrajectory("гоо", withBoth, new Map());
    const firstOStroke = getPathEndpoints(result.strokes[1].d);
    const ownDual = getPathEndpoints(O_MIDDLE_LOWER_DUAL.strokes[0].d);
    expect(firstOStroke.end[0] - firstOStroke.start[0]).toBeCloseTo(ownDual.end[0] - ownDual.start[0], 6);
  });

  it("falls back to the upper/lower bucket when no dual-exit variant is captured", () => {
    const O_MIDDLE_LOWER_UPPER = {
      id: "о_middle_lu", label: "о_middle_lu", variantOf: "о", position: "middle", entryType: "lower", exitType: "upper",
      strokes: [{ d: "M 80 65 C 82 66 84 67 86 68" }],
    };
    const withLu = new Map(letters).set("г", LETTER_G).set("о_middle_lu", O_MIDDLE_LOWER_UPPER);
    // Same "гоо" shape, but no о_middle_ld captured here -> falls through to о_middle_lu.
    const result = buildWordTrajectory("гоо", withLu, new Map());
    const firstOStroke = getPathEndpoints(result.strokes[1].d);
    const ownLu = getPathEndpoints(O_MIDDLE_LOWER_UPPER.strokes[0].d);
    expect(firstOStroke.end[0] - firstOStroke.start[0]).toBeCloseTo(ownLu.end[0] - ownLu.start[0], 6);
  });
});
