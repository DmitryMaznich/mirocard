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

export function commandsToPath(start, commands) {
  const points = [{ col: start.col, row: start.row }];
  let current = { col: start.col, row: start.row };
  for (const command of commands) {
    const direction = DIRECTION[command.direction];
    if (!direction) {
      throw new Error(`Unknown direction: ${command.direction}`);
    }
    current = {
      col: current.col + direction.col * command.cells,
      row: current.row + direction.row * command.cells,
    };
    points.push(current);
  }
  return points;
}
