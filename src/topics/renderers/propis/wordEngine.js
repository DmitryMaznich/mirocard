import { getPathEndpoints, transformPathD, samplePath, findClosestApproach } from "./pathGeometry.js";
import { GUIDE_LINES, NATIVE_L3 } from "./propisRuling.js";

// Target distance between the previous letter's own baseline-contact point (last place its
// trajectory sits on the writing line) and the next letter's own baseline-contact point
// (first such place) — see getBaselineContacts below. NOT a target for the entry/exit
// *stroke* points, which vary far more per letter shape (в's stroke ends well short of
// where в's ink actually sits on the line) and produced wildly order-dependent gaps when
// used directly (e.g. "бв" vs "вб" looked nothing alike). Calibrated empirically: 34 (the
// letter-width norm for printed/disconnected letters) was measured, applied, and visibly
// too wide for this connected-cursive animation; 17 was chosen instead after comparing
// against a hand-picked "looks right" reference pair (в→б) — see
// docs/superpowers/plans/2026-08-07-propis-word-writing.md history for the discarded 34
// derivation, kept here only as a cautionary note against re-deriving it the same way.
export const LETTER_GAP = 17;

// Points within this margin of a letter's closest approach to the baseline are treated as
// part of its baseline-contact zone — needed because most letters never sample to a
// distance of exactly 0 (the sampled points hit close to, not exactly on, NATIVE_L3).
const BASELINE_CONTACT_TOLERANCE = 1.5;

// Fallback box width for a letter with no viewBox, and the unit every captured
// letter/connector's canvas already uses (tools/letter_capture/handwriting_capture.html).
const DEFAULT_LETTER_BOX_WIDTH = 100;

export function classifyLine(y) {
  let bestLine = GUIDE_LINES[0].line;
  let bestDist = Infinity;
  for (const g of GUIDE_LINES) {
    const dist = Math.abs(y - g.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestLine = g.line;
    }
  }
  return bestLine;
}

export function getConnectionInfo(item) {
  const strokes = item.strokes ?? [];
  if (strokes.length === 0) {
    throw new Error(`getConnectionInfo: item "${item.id}" has no strokes`);
  }
  const entry = getPathEndpoints(strokes[0].d);
  const exit = getPathEndpoints(strokes[strokes.length - 1].d);
  return {
    entryPoint: entry.start,
    exitPoint: exit.end,
    entryLine: classifyLine(entry.start[1]),
    exitLine: classifyLine(exit.end[1]),
  };
}

// A letter's exit/entry "type" (which numbered guide line its connecting stroke belongs
// to) is a fixed property of the letter itself, per Russian cursive methodology — б, в, ф
// all finish with the same loop-back-to-the-line hook regardless of which specific captured
// sample you look at. It is NOT reliably the guide line closest to where one particular
// hand-drawn sample's stroke happens to end: real captures vary (this exact б sample's own
// stroke ends at line 2, в's at line 3, purely from where each artist's pen lifted), so
// classifying by raw geometry alone put б and в in different connector buckets even though
// they take the same connector. Letters confirmed here override classifyLine's geometric
// guess; anything not listed falls back to it. Keyed by `label` (not `id`) to match how the
// rest of the engine identifies which character a card represents (see WriteWordsView's
// lettersByLabel) — test fixtures below intentionally omit `label` so they never collide
// with this table.
const EXIT_LINE_OVERRIDES = {
  "б": 5, "в": 5, "ф": 5, "о": 5, "э": 5, "ю": 5, "ь": 5, "ъ": 5,
};
const ENTRY_LINE_OVERRIDES = {
  "о": 3,
};

// getConnectionInfo plus the fixed per-letter type overrides above, applied only to
// entryLine/exitLine (the classification used to pick a connector) — entryPoint/exitPoint
// stay the letter's own real geometry either way, since bridges must still connect to
// where the pen actually is, not to an abstract type.
export function resolveConnectionInfo(item) {
  const info = getConnectionInfo(item);
  const label = item.label;
  return {
    ...info,
    entryLine: ENTRY_LINE_OVERRIDES[label] ?? info.entryLine,
    exitLine: EXIT_LINE_OVERRIDES[label] ?? info.exitLine,
  };
}

// Where a letter's trajectory last "sits" on the baseline before the previous letter's
// stroke lifts off (last), and where it first sits on the baseline as the next letter's
// stroke touches down (first) — this is what determines visual letter-to-letter spacing in
// connected cursive, independent of where the pen happens to actually start/end (which can
// be well above or below the line, mid-loop). Samples across ALL of the item's strokes in
// order, so "first" always comes from the first-drawn stroke and "last" from the last.
export function getBaselineContacts(item) {
  const strokes = item.strokes ?? [];
  if (strokes.length === 0) {
    throw new Error(`getBaselineContacts: item "${item.id}" has no strokes`);
  }
  const points = strokes.flatMap((s) => samplePath(s.d));
  return findClosestApproach(points, NATIVE_L3, BASELINE_CONTACT_TOLERANCE);
}

function translateStrokes(strokes, dx) {
  return strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx }) }));
}

function straightBridge(fromPoint, toPoint) {
  const x1 = fromPoint[0].toFixed(3);
  const y1 = fromPoint[1].toFixed(3);
  const x2 = toPoint[0].toFixed(3);
  const y2 = toPoint[1].toFixed(3);
  return { d: `M ${x1} ${y1} L ${x2} ${y2}` };
}

// A hand-captured connector's own start point moves to `anchor` — translation only, never
// rescaled. The connector's own drawn length and shape ARE the correct distance and shape
// for this letter's exit type; stretching it to hit some independently computed target
// point (the earlier approach) defeats the point of having a real captured connector at
// all. Returns the translated strokes plus where its own end point landed, which becomes
// the anchor the next letter (or, once one exists, that letter's own entry connector)
// attaches to in turn.
function placeExitConnector(connector, anchor) {
  const info = getConnectionInfo(connector);
  const dx = anchor[0] - info.entryPoint[0];
  const dy = anchor[1] - info.entryPoint[1];
  return {
    strokes: connector.strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx, translateY: dy }) })),
    endPoint: [info.exitPoint[0] + dx, info.exitPoint[1] + dy],
  };
}

// A captured exit connector is keyed by the letter type it attaches to, always ending on
// line 4 (see propisRuling.js's NATIVE_NARROW_MID — the height most letters naturally sit
// at, so it's the universal hand-off point). An entry connector is the mirror case, keyed
// `4_${entryType}` — for letters like о that need their own lead-in stroke from that
// hand-off point rather than starting cold.
function findExitConnector(connectorsByKey, exitType) {
  return connectorsByKey.get(`${exitType}_4`);
}

function findEntryConnector(connectorsByKey, entryType) {
  return connectorsByKey.get(`4_${entryType}`);
}

// Mirrors placeExitConnector: translate-only, anchored by its own END point instead — an
// entry connector leads INTO the next letter, so its end lands on that letter's own raw
// entry point (in the letter's local, pre-placement coordinates) and its start is wherever
// that naturally puts it, which is what an incoming exit connector then attaches to.
function placeEntryConnectorLocal(connector, letterRawEntryPoint) {
  const info = getConnectionInfo(connector);
  const dx = letterRawEntryPoint[0] - info.exitPoint[0];
  const dy = letterRawEntryPoint[1] - info.exitPoint[1];
  return {
    strokes: connector.strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx, translateY: dy }) })),
    startPoint: [info.entryPoint[0] + dx, info.entryPoint[1] + dy],
  };
}

function letterBoxWidth(letter) {
  const parts = (letter.viewBox || "").split(" ");
  const w = Number(parts[2]);
  return Number.isFinite(w) && w > 0 ? w : DEFAULT_LETTER_BOX_WIDTH;
}

export function buildWordTrajectory(word, lettersByLabel, connectorsByKey) {
  const chars = Array.from(word);
  if (chars.length === 0) {
    return { strokes: [], totalWidthUnits: 0, viewBox: "0 0 0 150" };
  }

  const strokes = [];
  let prev = null; // { exitLine, exitPointWorld, baselineContactWorld }
  let rightEdge = 0;

  chars.forEach((ch) => {
    const letter = lettersByLabel.get(ch);
    if (!letter) {
      throw new Error(`buildWordTrajectory: letter "${ch}" is not in the letter library`);
    }
    const info = resolveConnectionInfo(letter);
    const contacts = getBaselineContacts(letter);

    let offset;

    if (!prev) {
      offset = 0;
    } else {
      const exitConnector = findExitConnector(connectorsByKey, prev.exitLine);
      if (exitConnector) {
        // Real captured connector: place it as-is against where the previous letter
        // actually sits on the baseline — no LETTER_GAP involved, the connector's own
        // length is the distance (see placeExitConnector).
        const placed = placeExitConnector(exitConnector, prev.baselineContactWorld);
        strokes.push(...placed.strokes);

        const entryConnector = findEntryConnector(connectorsByKey, info.entryLine);
        if (entryConnector) {
          // This letter needs its own lead-in stroke too: chain it directly onto the
          // exit connector's own end (both translate-only — the two pieces meet
          // wherever they naturally do, never stretched to force an exact join), then
          // place the letter so its raw entry point lands at the lead-in's own end.
          // X-only frame shift, matching every other letter placement in this function —
          // placeEntryConnectorLocal already anchored the connector's own end to this
          // letter's real entry point in both axes, so shifting the whole local group by
          // dx alone keeps that relationship intact; only the join to the exit connector's
          // end is allowed the same small vertical give every other transition already has.
          const localEntry = placeEntryConnectorLocal(entryConnector, info.entryPoint);
          const dx = placed.endPoint[0] - localEntry.startPoint[0];
          strokes.push(...localEntry.strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx }) })));
          offset = dx;
        } else {
          offset = placed.endPoint[0] - info.entryPoint[0];
        }
      } else {
        // No captured connector for this letter's exit type yet: fall back to the
        // baseline-contact-based LETTER_GAP norm, bridged with a plain straight stroke
        // between the real entry/exit *points* (not the baseline-contact points).
        offset = prev.baselineContactWorld[0] + LETTER_GAP - contacts.first[0];
        const entryPointWorld = [info.entryPoint[0] + offset, info.entryPoint[1]];
        strokes.push(straightBridge(prev.exitPointWorld, entryPointWorld));
      }
    }

    strokes.push(...translateStrokes(letter.strokes, offset));
    prev = {
      exitLine: info.exitLine,
      exitPointWorld: [info.exitPoint[0] + offset, info.exitPoint[1]],
      baselineContactWorld: [contacts.last[0] + offset, contacts.last[1]],
    };
    rightEdge = Math.max(rightEdge, offset + letterBoxWidth(letter));
  });

  return { strokes, totalWidthUnits: rightEdge, viewBox: `0 0 ${rightEdge} 150` };
}
