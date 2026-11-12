// Keep small hand tremor out of the assessment. Check the actual trace rather
// than pointer-event count or velocity; lifts never add imaginary connecting lines.
export const STRAIGHTNESS = Object.freeze({ noise: 18, maxLengthRatio: 1.6, excess: 100 });

function segmentDistanceSquared(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
}

// Iterative Ramer–Douglas–Peucker: tolerance is in lesson coordinates, so the
// same imperfect line has the same verdict on a phone and on a tablet.
function smoothedLength(points, realEdges) {
  const end = points.length - 1;
  if (end < 1) return 0;
  const keep = new Uint8Array(end + 1);
  keep[0] = keep[end] = 1;
  const pending = [[0, end]];
  while (pending.length) {
    const [a, b] = pending.pop();
    let farthest = -1, maxDistance = STRAIGHTNESS.noise ** 2;
    for (let i = a + 1; i < b; i++) {
      const d = segmentDistanceSquared(points[i], points[a], points[b]);
      if (d > maxDistance) { maxDistance = d; farthest = i; }
    }
    if (farthest >= 0) {
      keep[farthest] = 1;
      pending.push([a, farthest], [farthest, b]);
    }
  }
  let length = 0, previous = points[0], sampled = 0, drawn = 0;
  for (let i = 1; i <= end; i++) {
    const step = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    sampled += step;
    if (realEdges[i]) drawn += step;
    if (keep[i]) {
      // Smooth across lifts too, but exclude the share belonging to an undrawn jump.
      length += Math.hypot(points[i].x - previous.x, points[i].y - previous.y) * (sampled ? drawn / sampled : 0);
      previous = points[i]; sampled = drawn = 0;
    }
  }
  return length;
}

export function hasExcessiveWandering(strokes, advance) {
  const points = [], realEdges = [];
  for (const stroke of strokes) {
    const end = stroke.failedFrom ?? stroke.points.length - 1;
    if (end < 1) continue;
    for (let i = 0; i <= end; i++) {
      points.push(stroke.points[i]); realEdges.push(i > 0);
    }
  }
  const length = smoothedLength(points, realEdges);
  return length - advance > STRAIGHTNESS.excess && length > Math.max(1, advance) * STRAIGHTNESS.maxLengthRatio;
}
