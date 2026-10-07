// Use layout lengths, never a transform on a draggable ancestor: transforms
// would multiply dnd-kit's pointer displacement and break finger tracking.
export function lessonUnit(width, height) {
  return Math.min(1.65, Math.max(.7, Math.min(width / 390, height / 760)));
}

export function fitCoinBoard({ width, height, unit = 1 }) {
  const gap = 6 * unit;
  const availableHeight = Math.max(1, height - 52 * unit);
  // Reserve the same slots throughout the lesson. Adding a coin or exchanging
  // ten coins must never change the diameter of the board or supply objects.
  const tenCols = 3, oneCols = 5, tenRows = 3, oneRows = 4;
  return Math.max(1, Math.min(28 * unit,
    (width * .4 - 20 * unit - (tenCols - 1) * gap) / tenCols,
    (width * .6 - 20 * unit - (oneCols - 1) * gap) / oneCols,
    (availableHeight - (tenRows - 1) * gap) / tenRows / 2.1,
    (availableHeight - (oneRows - 1) * gap) / oneRows));
}
