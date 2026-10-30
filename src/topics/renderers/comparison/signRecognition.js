// Logical coordinate space that strokes/recognition always work in,
// independent of the canvas's actual physical size or pixel density.
export const DRAW_SPACE = 300;

const MIN_STROKE_POINTS = 3;

function boundsOf(stroke) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  stroke.forEach((p) => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  });
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

// A "flat bar" — one stroke of an "=" sign. Ratio loosened from a stricter
// value so a slightly wobbly hand (vertical jitter while dragging sideways)
// still qualifies instead of falling through to "?".
function isFlatBar(bounds) {
  return bounds.width > bounds.height * 1.25 && bounds.width > 10;
}

// Detects the vertex (turning point) of a "<"/">" stroke. Tolerant of:
// - a short/fast gesture with only a handful of sampled points
// - the vertex sitting close to the very start or end of the stroke
// - a small overall stroke, where a fixed pixel overshoot would be too strict
function findVertex(stroke) {
  if (stroke.length < MIN_STROKE_POINTS) return null;
  let minX = Infinity, maxX = -Infinity, minIdx = -1, maxIdx = -1;
  stroke.forEach((p, i) => {
    if (p.x < minX) { minX = p.x; minIdx = i; }
    if (p.x > maxX) { maxX = p.x; maxIdx = i; }
  });
  const span      = Math.max(maxX - minX, 1);
  const overshoot = Math.max(8, span * 0.08);
  const startX    = stroke[0].x;
  const endX      = stroke[stroke.length - 1].x;
  const inMiddle  = (idx) => idx > stroke.length * 0.05 && idx < stroke.length * 0.95;

  if (inMiddle(minIdx) && startX > minX + overshoot && endX > minX + overshoot) return "<";
  if (inMiddle(maxIdx) && startX < maxX - overshoot && endX < maxX - overshoot) return ">";
  return null;
}

// One flat bar may be the first half of «=» — the pad then waits longer for
// the second one instead of reading the bar alone as an unknown sign.
export function mayBeHalfOfEqual(strokes) {
  return strokes?.length === 1 && strokes[0].length > 0 && isFlatBar(boundsOf(strokes[0]));
}

// Two strokes that meet end to end, as one line through the meeting point.
// Null when no ends come close enough to be the same corner.
function joinAtCorner(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const all = boundsOf([...a, ...b]);
  const near = Math.max(30, Math.max(all.width, all.height) * 0.25);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const [a0, a1, b0, b1] = [a[0], a.at(-1), b[0], b.at(-1)];
  const options = [
    [dist(a0, b0), () => [...a].reverse().concat(b)],
    [dist(a0, b1), () => b.concat(a)],
    [dist(a1, b0), () => a.concat(b)],
    [dist(a1, b1), () => a.concat([...b].reverse())],
  ];
  const [gap, join] = options.reduce((best, o) => (o[0] < best[0] ? o : best));
  if (gap > near) return null;
  // The arms of a corner spread apart; two bars of «=» stay about as far
  // apart at the other end as at the near one.
  const line = join();
  const spread = dist(line[0], line.at(-1));
  return spread > Math.max(2 * gap, near) ? line : null;
}

export function recognizeSign(strokes) {
  if (!strokes || strokes.length === 0) return null;

  if (strokes.length === 2) {
    // Many children draw «<» as two lines meeting in the corner. Checked
    // before «=»: two slanted arms are each wide enough to pass as a bar.
    const joined = joinAtCorner(strokes[0], strokes[1]);
    const chevron = joined && findVertex(joined);
    if (chevron) return chevron;
    if (isFlatBar(boundsOf(strokes[0])) && isFlatBar(boundsOf(strokes[1]))) return "=";
    return "?";
  }

  if (strokes.length === 1) {
    return findVertex(strokes[0]) ?? "?";
  }

  return "?";
}
