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

export function recognizeSign(strokes) {
  if (!strokes || strokes.length === 0) return null;

  if (strokes.length === 2) {
    if (isFlatBar(boundsOf(strokes[0])) && isFlatBar(boundsOf(strokes[1]))) return "=";
    return "?";
  }

  if (strokes.length === 1) {
    return findVertex(strokes[0]) ?? "?";
  }

  return "?";
}
