export const GRAPHIC_MATRIX_MODE = "graphic_matrix";

const practice = {
  rows: [["horizontal", 1], ["horizontal", 2]],
  columns: [["vertical", 1], ["vertical", 2]],
};
const independentRows = [
  [["horizontal", 2], ["horizontal", 1], ["horizontal", 3], ["rising", 1]],
  [["horizontal", 1], ["horizontal", 3], ["rising", 2], ["rising", 3]],
  [["horizontal", 2], ["rising", 1], ["rising", 3], ["topLeft", 1]],
  [["horizontal", 1], ["horizontal", 3], ["rising", 2], ["bottomRight", 1]],
];
const independentColumns = [
  [["falling", 1], ["vertical", 2], ["vertical", 4], ["vertical", 1]],
  [["vertical", 1], ["vertical", 3], ["falling", 2], ["falling", 3]],
  [["vertical", 2], ["vertical", 3], ["falling", 1], ["topRight", 1]],
  [["vertical", 1], ["falling", 2], ["falling", 3], ["bottomLeft", 1]],
  [["vertical", 2], ["vertical", 3], ["falling", 1], ["falling", 2]],
];
// Use different lanes for opposing corner samples, so their arms never
// coincide when they are drawn together in a cell.
const corners = {
  topLeft: [[73, 18], [18, 18], [18, 73]],
  topRight: [[32, 25], [75, 25], [75, 68]],
  bottomLeft: [[68, 75], [25, 75], [25, 32]],
  bottomRight: [[27, 82], [82, 82], [82, 27]],
};
const cornerByArms = {
  "right:down": "topLeft",
  "left:down": "topRight",
  "right:up": "bottomLeft",
  "left:up": "bottomRight",
};
const axes = { horizontal: 0, falling: 45, vertical: 90, rising: 135 };
const orientations = Object.entries(axes);
const minimumStroke = 20;
const incidentalMovement = 12;
const angleTolerance = 20;
const parallelSpacing = 10;
export const cellMargin = 7;

const roundSize = 16;

function rotate(items, offset) {
  const split = offset % items.length;
  return [...items.slice(split), ...items.slice(0, split)];
}

function headingsForCard(boardSize, index) {
  if (boardSize !== "4x4") {
    return { rows: rotate(practice.rows, index), columns: rotate(practice.columns, index) };
  }
  // Keep the opening card on the reference layout. Change both sets after
  // every card, including the transition from the last card back to the first.
  const rowSet = index % independentRows.length;
  const columnSet = (index + Math.floor(index / independentColumns.length)) % independentColumns.length;
  const rotation = Math.floor(index / independentRows.length);
  return {
    rows: rotate(independentRows[rowSet], rotation),
    columns: rotate(independentColumns[columnSet], rotation + index),
  };
}

export function generateGraphicMatrixTasks(boardSize, card) {
  if (!card) return [];
  // A round leaves enough cards for even the longest standard reward series.
  return Array.from({ length: roundSize }, (_, index) => ({
    type: GRAPHIC_MATRIX_MODE,
    conceptId: card.conceptId,
    card,
    ...headingsForCard(boardSize, index),
  }));
}

export function sampleLines([orientation, count]) {
  if (Object.hasOwn(corners, orientation)) return [corners[orientation]];
  const angle = axes[orientation] * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return Array.from({ length: count }, (_, index) => {
    const offset = (index - (count - 1) / 2) * 16;
    const x = 50 - offset * sin;
    const y = 50 + offset * cos;
    return [[x - 29 * cos, y - 29 * sin], [x + 29 * cos, y + 29 * sin]];
  });
}

export function matrixCellTargets(rows, columns) {
  return rows.flatMap((row, rowIndex) =>
    columns.map((column, columnIndex) => ({
      row: rowIndex,
      column: columnIndex,
      counts: Object.fromEntries([row, column]),
      total: row[1] + column[1],
    })),
  );
}

export function pathData(points) {
  return "M" + points.map(([x, y]) => `${x} ${y}`).join("L");
}

export function isOutsideCell([x, y]) {
  return x < -cellMargin || x > 100 + cellMargin || y < -cellMargin || y > 100 + cellMargin;
}

function measureSegment(points, start, end) {
  const [x0, y0] = points[start];
  const [x1, y1] = points[end];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const span = Math.hypot(dx, dy);
  let length = 0;
  let deviation = 0;
  let farthest = start;
  for (let i = start + 1; i <= end; i += 1) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (!span) continue;
    const offset = Math.abs(dx * (points[i][1] - y0) - dy * (points[i][0] - x0)) / span;
    if (offset > deviation) {
      deviation = offset;
      farthest = i;
    }
  }
  return { dx, dy, span, length, deviation, farthest };
}

function armDirection(dx, dy) {
  if (Math.abs(dy) <= Math.abs(dx) * 0.45) return dx > 0 ? "right" : "left";
  if (Math.abs(dx) <= Math.abs(dy) * 0.45) return dy > 0 ? "down" : "up";
  return null;
}

function cornerOrientation(points, farthest) {
  if (farthest === 0 || farthest >= points.length - 1) return null;
  const first = measureSegment(points, 0, farthest);
  const second = measureSegment(points, farthest, points.length - 1);
  const validArm = ({ span, length, deviation }) => span >= 16 && length <= 1.35 * span && deviation <= 8;
  if (!validArm(first) || !validArm(second)) return null;
  let horizontal = armDirection(-first.dx, -first.dy);
  let vertical = armDirection(second.dx, second.dy);
  if (horizontal === "up" || horizontal === "down") [horizontal, vertical] = [vertical, horizontal];
  return cornerByArms[`${horizontal}:${vertical}`] ?? null;
}

function checkCounts(orientation, lane, points, target, accepted) {
  if (!target.counts[orientation]) return { kind: "direction" };
  const parallel = accepted.filter((stroke) => stroke.orientation === orientation);
  if (parallel.length >= target.counts[orientation]) return { kind: "extra" };
  if (lane !== null && parallel.some((stroke) => Math.abs(stroke.lane - lane) < parallelSpacing)) {
    return { kind: "duplicate" };
  }
  return { kind: "correct", stroke: { orientation, lane, points } };
}

export function evaluateMatrixStroke(points, target, accepted) {
  if (points.length < 2) return { kind: "idle" };
  const [x0, y0] = points[0];
  if (points.every(([x, y]) => Math.hypot(x - x0, y - y0) < incidentalMovement)) return { kind: "idle" };
  if (points.some(isOutsideCell)) return { kind: "outside" };

  const { dx, dy, span, length, deviation, farthest } = measureSegment(points, 0, points.length - 1);
  if (span < minimumStroke && length < minimumStroke * 1.35) return { kind: "idle" };
  if (span < minimumStroke || length > span * 1.65 || deviation > 12) {
    const corner = cornerOrientation(points, farthest);
    if (!corner || !Object.keys(target.counts).some((shape) => Object.hasOwn(corners, shape))) return { kind: "shape" };
    return checkCounts(corner, null, points, target, accepted);
  }

  const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 180) % 180;
  const axis = orientations.find(([, degrees]) => {
    const difference = Math.abs(angle - degrees);
    return Math.min(difference, 180 - difference) <= angleTolerance;
  });
  if (!axis) return { kind: "direction" };

  const [orientation, degrees] = axis;
  const radians = degrees * Math.PI / 180;
  const lane = (y0 + dy / 2) * Math.cos(radians) - (x0 + dx / 2) * Math.sin(radians);
  return checkCounts(orientation, lane, points, target, accepted);
}
