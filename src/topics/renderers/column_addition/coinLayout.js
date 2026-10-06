// Use layout lengths, never a transform on a draggable ancestor: transforms
// would multiply dnd-kit's pointer displacement and break finger tracking.
export function lessonUnit(width, height) {
  return Math.min(1.65, Math.max(.7, Math.min(width / 390, height / 560)));
}

export function fitCoinBoard({ width, height, tens, ones, unit = 1 }) {
  const gap = 6 * unit;
  const availableHeight = Math.max(1, height - 52 * unit);
  const tenCols = Math.min(3, Math.max(1, tens));
  const oneCols = Math.min(5, Math.max(1, ones));
  const tenRows = Math.max(1, Math.ceil(tens / tenCols));
  const oneRows = Math.max(1, Math.ceil(ones / oneCols));
  return Math.max(1, Math.min(34 * unit,
    (width * .4 - 20 * unit - (tenCols - 1) * gap) / tenCols / (34 / 30),
    (width * .6 - 20 * unit - (oneCols - 1) * gap) / oneCols,
    (availableHeight - (tenRows - 1) * gap) / tenRows / 2.1,
    (availableHeight - (oneRows - 1) * gap) / oneRows));
}
