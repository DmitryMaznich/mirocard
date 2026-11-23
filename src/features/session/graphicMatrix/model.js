export const GRAPHIC_MATRIX_MODE = "graphic_matrix";

const practice = {
  rows: [["horizontal", 1], ["horizontal", 2]],
  columns: [["vertical", 1], ["vertical", 2]],
};
const independent = {
  rows: [["horizontal", 2], ["horizontal", 1], ["horizontal", 3], ["rising", 1]],
  columns: [["falling", 1], ["vertical", 2], ["vertical", 4], ["vertical", 1]],
};
const axes = { horizontal: 0, falling: 45, vertical: 90, rising: 135 };
const orientations = Object.entries(axes);
const minimumStroke = 20;
const incidentalMovement = 12;
const angleTolerance = 20;
const parallelSpacing = 10;
export const cellMargin = 7;

function arrangements(items) {
  return items.flatMap((_, offset) => {
    const rotated = [...items.slice(offset), ...items.slice(0, offset)];
    return items.length === 2 ? [rotated] : [rotated, [rotated[0], ...rotated.slice(1).reverse()]];
  });
}

export function generateGraphicMatrixTasks(boardSize, card) {
  if (!card) return [];
  const size = boardSize === "4x4" ? 4 : 2;
  const { rows, columns } = size === 4 ? independent : practice;
  // Begin with the teaching layout or the reference worksheet. Later cards
  // change which heading lines meet so the child applies the rule again.
  const rowOrders = arrangements(rows);
  const columnOrders = arrangements(columns);
  const layouts = columnOrders.flatMap((_, step) =>
    rowOrders.map((rowOrder, index) => ({
      type: GRAPHIC_MATRIX_MODE,
      conceptId: card.conceptId,
      card,
      rows: rowOrder,
      columns: columnOrders[(index + step) % columnOrders.length],
    })),
  );
  // Keep enough cards in the initial round for every standard prize threshold.
  return Array.from({ length: 16 }, (_, index) => ({ ...layouts[index % layouts.length] }));
}

export function sampleLines([orientation, count]) {
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

export function evaluateMatrixStroke(points, target, accepted) {
  if (points.length < 2) return { kind: "idle" };
  const [x0, y0] = points[0];
  if (points.every(([x, y]) => Math.hypot(x - x0, y - y0) < incidentalMovement)) return { kind: "idle" };
  if (points.some(isOutsideCell)) return { kind: "outside" };

  const [x1, y1] = points.at(-1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const span = Math.hypot(dx, dy);
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  if (span < minimumStroke && length < minimumStroke * 1.35) return { kind: "idle" };
  if (span < minimumStroke || length > span * 1.65 ||
      points.some(([x, y]) => Math.abs(dx * (y - y0) - dy * (x - x0)) > 12 * span)) return { kind: "shape" };

  const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 180) % 180;
  const axis = orientations.find(([, degrees]) => {
    const difference = Math.abs(angle - degrees);
    return Math.min(difference, 180 - difference) <= angleTolerance;
  });
  if (!axis) return { kind: "direction" };

  const [orientation, degrees] = axis;
  if (!target.counts[orientation]) return { kind: "direction" };
  const parallel = accepted.filter((stroke) => stroke.orientation === orientation);
  if (parallel.length >= target.counts[orientation]) return { kind: "extra" };
  const radians = degrees * Math.PI / 180;
  const lane = ((y0 + y1) * Math.cos(radians) - (x0 + x1) * Math.sin(radians)) / 2;
  if (parallel.some((stroke) => Math.abs(stroke.lane - lane) < parallelSpacing)) return { kind: "duplicate" };
  return { kind: "correct", stroke: { orientation, lane, points } };
}
