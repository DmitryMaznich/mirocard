// Duplicated (not imported) from tools/symmetry_draw/renderer.js — that file
// is a separately-built, eval'd-at-runtime IIFE outside the Vite build root
// with no ES module exports, so it cannot be imported from src/. Keep this
// file's logic in sync by hand if renderer.js's geometry ever changes.

export const DIRECTION = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  right: { col: 1, row: 0 },
  left: { col: -1, row: 0 },
  up_right: { col: 1, row: -1 },
  down_right: { col: 1, row: 1 },
  up_left: { col: -1, row: -1 },
  down_left: { col: -1, row: 1 },
};

export function commandEnd(start, command) {
  const direction = DIRECTION[command.direction];
  return { col: start.col + direction.col * command.cells, row: start.row + direction.row * command.cells };
}

export function dictationPath(start, commands) {
  const points = [{ col: start.col, row: start.row }];
  let current = { col: start.col, row: start.row };
  for (const command of commands) {
    current = commandEnd(current, command);
    points.push(current);
  }
  return points;
}

export function mirrorPaths(paths, axisCol) {
  return (paths ?? []).map((path) => path.map((point) => ({ col: 2 * axisCol - point.col, row: point.row })));
}

export function translatePaths(paths, axisCol) {
  return (paths ?? []).map((path) => path.map((point) => ({ col: point.col + axisCol, row: point.row })));
}

export function pathToD(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.col} ${point.row}`).join(" ");
}
