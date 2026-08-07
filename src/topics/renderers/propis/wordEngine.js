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

// Snaps the connector's own start point onto fromPoint and its own end point onto
// toPoint. Only x is rescaled (the connector's own shape/height is authored to already
// match its fromLine/toLine y values) — y is only translated, per the design spec.
function fitConnectorStrokes(connector, fromPoint, toPoint) {
  const info = getConnectionInfo(connector);
  const connStart = info.entryPoint;
  const connEnd = info.exitPoint;
  const dx = connEnd[0] - connStart[0];
  const scaleX = dx === 0 ? 1 : (toPoint[0] - fromPoint[0]) / dx;
  const translateX = fromPoint[0] - scaleX * connStart[0];
  const translateY = fromPoint[1] - connStart[1];
  return connector.strokes.map((s) => ({
    d: transformPathD(s.d, { scaleX, translateX, translateY }),
  }));
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
  let prevExitLine = null;
  let prevExitPointWorld = null;
  let prevExitContactX = null;
  let rightEdge = 0;

  chars.forEach((ch) => {
    const letter = lettersByLabel.get(ch);
    if (!letter) {
      throw new Error(`buildWordTrajectory: letter "${ch}" is not in the letter library`);
    }
    const info = getConnectionInfo(letter);
    const contacts = getBaselineContacts(letter);
    // First letter starts at 0; every next letter is placed so its own baseline-contact
    // point lands exactly LETTER_GAP after the previous letter's own baseline-contact
    // point. The bridge itself still connects the real entry/exit *stroke* points below —
    // placement and bridge-drawing intentionally use two different reference points.
    const offset = prevExitContactX !== null ? prevExitContactX + LETTER_GAP - contacts.first[0] : 0;
    const entryPointWorld = [info.entryPoint[0] + offset, info.entryPoint[1]];
    const exitPointWorld = [info.exitPoint[0] + offset, info.exitPoint[1]];

    if (prevExitPointWorld) {
      if (prevExitLine === info.entryLine) {
        strokes.push(straightBridge(prevExitPointWorld, entryPointWorld));
      } else {
        const connector = connectorsByKey.get(`${prevExitLine}_${info.entryLine}`);
        if (connector) {
          strokes.push(...fitConnectorStrokes(connector, prevExitPointWorld, entryPointWorld));
        } else {
          strokes.push(straightBridge(prevExitPointWorld, entryPointWorld));
        }
      }
    }

    strokes.push(...translateStrokes(letter.strokes, offset));
    prevExitLine = info.exitLine;
    prevExitPointWorld = exitPointWorld;
    prevExitContactX = contacts.last[0] + offset;
    rightEdge = Math.max(rightEdge, offset + letterBoxWidth(letter));
  });

  return { strokes, totalWidthUnits: rightEdge, viewBox: `0 0 ${rightEdge} 150` };
}
