// Gesture-matching math for DictationTask in tools/symmetry_draw/renderer.js.
// Duplicated inline in renderer.js (raw browser script inside the topic ZIP,
// no bundler pass, no imports) — keep both copies in sync.

export function distance(p, q) {
  return Math.hypot(p.col - q.col, p.row - q.row);
}

export function distanceToSegment(point, start, end) {
  const dx = end.col - start.col;
  const dy = end.row - start.row;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.col - start.col) * dx + (point.row - start.row) * dy) / lengthSquared));
  return distance(point, { col: start.col + dx * t, row: start.row + dy * t });
}

// A continuous drag: must start near `start` and end near `end`, staying
// close to the straight line between them the whole way.
export function isCorrectMove(points, start, end) {
  if (points.length < 2 || distance(points[0], start) > 0.55 || distance(points.at(-1), end) > 0.55) return false;
  return points.every((point) => distanceToSegment(point, start, end) <= 0.8);
}

// A tap (or short jitter) landing on the target, regardless of where it
// started - lets a child pick the next point directly instead of dragging a
// line all the way to it. Every recorded point must stay near `end`, which
// is what tells a genuine tap apart from a drag that merely passes near the
// target on its way through.
export function isCorrectTap(points, end, tolerance = 0.55) {
  if (!points.length) return false;
  return points.every((point) => distance(point, end) <= tolerance);
}
