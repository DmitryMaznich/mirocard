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

function translateStrokes(strokes, dx, dy = 0) {
  return strokes.map((s) => ({ d: transformPathD(s.d, { translateX: dx, translateY: dy }) }));
}

// Marks strokes as part of one continuous pen motion with whatever comes immediately
// before them — the animation player (useLoopingStrokes) skips its usual inter-stroke
// pause for these, since a real connecting stroke between letters in a word is never a
// pen-lift the way a letter's own separate strokes are (e.g. "Б"'s crossbar, which stays
// unmarked and keeps the normal pause).
function markContinuous(strokes) {
  return strokes.map((s) => ({ ...s, continuous: true }));
}

function straightBridge(fromPoint, toPoint) {
  const x1 = fromPoint[0].toFixed(3);
  const y1 = fromPoint[1].toFixed(3);
  const x2 = toPoint[0].toFixed(3);
  const y2 = toPoint[1].toFixed(3);
  return { d: `M ${x1} ${y1} L ${x2} ${y2}` };
}

// Below this distance a residual bridge (see below) would be an invisible/degenerate
// sliver — skip it rather than push a near-zero-length path (getTotalLength() near 0
// makes the animation's duration computation degenerate).
const RESIDUAL_EPSILON = 0.05;

// A captured connector's own shape is fixed (translate-only, never rescaled — see
// placeExitConnector above), so translating it can make ONE of its two ends land exactly
// on its target point, but generally not both: the vector between "where the previous
// piece ends" and "where the next piece/letter naturally starts" varies per letter pair,
// while the connector's own start-to-end vector does not. The remaining few units of
// mismatch are drawn as a short straight connecting stroke — the same technique already
// used when no captured connector exists at all (see the LETTER_GAP fallback below) —
// instead of closing the gap by shifting the letter itself. Shifting the letter was tried
// first and seemed cleaner for a single junction, but it makes each letter's vertical
// position depend on the previous one's, and a repeated exit type (e.g. plain "бббб")
// then drifts the same few units taller or shorter on every single occurrence, visibly
// climbing or sinking across the word. A letter's own vertical position must stay fixed —
// only its horizontal placement (dx) and the short connecting strokes around it move.
function residualBridge(fromPoint, toPoint) {
  const dx = toPoint[0] - fromPoint[0];
  const dy = toPoint[1] - fromPoint[1];
  if (Math.hypot(dx, dy) < RESIDUAL_EPSILON) return [];
  return [{ ...straightBridge(fromPoint, toPoint), continuous: true }];
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

    // A letter's own vertical position is always its native, as-captured height — never
    // shifted by connector placement (see residualBridge above for why). Only dx moves.
    let dx = 0;
    const bridging = !!prev; // was anything (connector or straight bridge) placed before this letter?

    if (prev) {
      const exitConnector = findExitConnector(connectorsByKey, prev.exitLine);
      if (exitConnector) {
        // Real captured connector: place it as-is against where the previous letter
        // actually sits on the baseline — no LETTER_GAP involved, the connector's own
        // length is the distance (see placeExitConnector).
        const placed = placeExitConnector(exitConnector, prev.baselineContactWorld);
        strokes.push(...markContinuous(placed.strokes));

        const entryConnector = findEntryConnector(connectorsByKey, info.entryLine);
        if (entryConnector) {
          // This letter needs its own lead-in stroke too. placeEntryConnectorLocal already
          // anchored the connector's own end to this letter's real (unshifted) entry point,
          // so the local group only needs a horizontal shift to bring its own start near
          // the exit connector's end — any leftover vertical gap is closed by a short
          // residual bridge, not by moving the letter (see residualBridge above).
          const localEntry = placeEntryConnectorLocal(entryConnector, info.entryPoint);
          dx = placed.endPoint[0] - localEntry.startPoint[0];
          const shiftedStart = [localEntry.startPoint[0] + dx, localEntry.startPoint[1]];
          strokes.push(...residualBridge(placed.endPoint, shiftedStart));
          strokes.push(...markContinuous(translateStrokes(localEntry.strokes, dx, 0)));
        } else {
          // No lead-in needed: shift the letter horizontally to meet the connector's end,
          // then close any remaining vertical gap with a short residual bridge.
          dx = placed.endPoint[0] - info.entryPoint[0];
          const shiftedEntryPoint = [info.entryPoint[0] + dx, info.entryPoint[1]];
          strokes.push(...residualBridge(placed.endPoint, shiftedEntryPoint));
        }
      } else {
        // No captured connector for this letter's exit type yet: fall back to the
        // baseline-contact-based LETTER_GAP norm, bridged with a plain straight stroke
        // between the real entry/exit *points* (not the baseline-contact points). Purely
        // horizontal, same as the letter placement it feeds.
        dx = prev.baselineContactWorld[0] + LETTER_GAP - contacts.first[0];
        const entryPointWorld = [info.entryPoint[0] + dx, info.entryPoint[1]];
        strokes.push({ ...straightBridge(prev.exitPointWorld, entryPointWorld), continuous: true });
      }
    }

    const placedLetterStrokes = translateStrokes(letter.strokes, dx, 0);
    // Only the letter's own FIRST stroke continues the incoming connector/bridge without a
    // pause — any further strokes of this same letter (e.g. "Б"'s separate crossbar) are a
    // genuine pen-lift and keep the normal pause between them.
    if (bridging && placedLetterStrokes.length > 0) {
      placedLetterStrokes[0] = { ...placedLetterStrokes[0], continuous: true };
    }
    strokes.push(...placedLetterStrokes);

    prev = {
      exitLine: info.exitLine,
      exitPointWorld: [info.exitPoint[0] + dx, info.exitPoint[1]],
      baselineContactWorld: [contacts.last[0] + dx, contacts.last[1]],
    };
    rightEdge = Math.max(rightEdge, dx + letterBoxWidth(letter));
  });

  return { strokes, totalWidthUnits: rightEdge, viewBox: `0 0 ${rightEdge} 150` };
}
