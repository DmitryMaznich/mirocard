import { getPathEndpoints, transformPathD } from "./pathGeometry.js";
import { GUIDE_LINES } from "./propisRuling.js";

const SLOT_WIDTH = 100; // matches the fixed per-letter slot already used in the capture tool

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

export function buildWordTrajectory(word, lettersByLabel, connectorsByKey) {
  const chars = Array.from(word);
  if (chars.length === 0) {
    return { strokes: [], totalWidthUnits: 0, viewBox: "0 0 0 150" };
  }

  const strokes = [];
  let prevExitLine = null;
  let prevExitPointWorld = null;

  chars.forEach((ch, index) => {
    const letter = lettersByLabel.get(ch);
    if (!letter) {
      throw new Error(`buildWordTrajectory: letter "${ch}" is not in the letter library`);
    }
    const offset = index * SLOT_WIDTH;
    const info = getConnectionInfo(letter);
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
  });

  const totalWidthUnits = chars.length * SLOT_WIDTH;
  return { strokes, totalWidthUnits, viewBox: `0 0 ${totalWidthUnits} 150` };
}
