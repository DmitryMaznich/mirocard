// Minimal SVG path helpers for propis stroke data — only M (moveto) and C (cubic bezier)
// commands ever appear in captured strokes (see handwriting_capture.html's pipeline
// comment: EMA -> RDP -> Hermite -> cubic Bézier -> strokes:[{d}]).

const TOKEN_RE = /[MC]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g;

export function getPathEndpoints(d) {
  const tokens = d.match(TOKEN_RE) || [];
  let i = 0;
  let cmd = null;
  let start = null;
  let end = null;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "M" || t === "C") {
      cmd = t;
      i += 1;
      continue;
    }
    if (cmd === "M") {
      const x = parseFloat(tokens[i]);
      const y = parseFloat(tokens[i + 1]);
      i += 2;
      if (!start) start = [x, y];
      end = [x, y];
    } else if (cmd === "C") {
      const x = parseFloat(tokens[i + 4]);
      const y = parseFloat(tokens[i + 5]);
      i += 6;
      end = [x, y];
    } else {
      i += 1;
    }
  }

  return { start, end };
}

function bezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
  const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
}

// Flattens a path into an ordered list of points (including the M point), by sampling
// each C segment at `samplesPerSegment` steps. Used to find where a curve passes near a
// given y (e.g. a baseline), which the path's own M/C endpoints don't reliably tell you —
// a stroke can dip close to a line in the middle of a segment without either endpoint
// landing there.
export function samplePath(d, samplesPerSegment = 100) {
  const tokens = d.match(TOKEN_RE) || [];
  let i = 0;
  let cmd = null;
  let cur = null;
  const points = [];

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "M" || t === "C") {
      cmd = t;
      i += 1;
      continue;
    }
    if (cmd === "M") {
      cur = [parseFloat(tokens[i]), parseFloat(tokens[i + 1])];
      i += 2;
      points.push(cur);
    } else if (cmd === "C") {
      const p1 = [parseFloat(tokens[i]), parseFloat(tokens[i + 1])];
      const p2 = [parseFloat(tokens[i + 2]), parseFloat(tokens[i + 3])];
      const p3 = [parseFloat(tokens[i + 4]), parseFloat(tokens[i + 5])];
      for (let k = 1; k <= samplesPerSegment; k += 1) {
        points.push(bezierPoint(cur, p1, p2, p3, k / samplesPerSegment));
      }
      cur = p3;
      i += 6;
    } else {
      i += 1;
    }
  }

  return points;
}

// Among a list of [x,y] points, finds the first and last ones within `toleranceMargin` of
// the closest approach to targetY. Generalizes "does this trajectory touch targetY" (exact
// touch = distance 0, always within any positive tolerance) to trajectories that only come
// near it without ever crossing exactly.
//
// `last` is the trajectory's own LAST genuine local minimum of distance-to-targetY — a real
// valley, strictly closer than both its immediate neighbors — not simply "closest point
// anywhere" (global-minimum tolerance band) and not simply "the stroke's raw final point"
// either. ф is why both simpler approaches fail: its stroke is a loop, then a descender
// dipping well past the baseline, then a second loop — the descender's own ascent happens to
// swing closer to the baseline than the second loop's true bottom does, so a global-minimum
// band picks a point mid-descender instead of where the pen actually finishes (confirmed
// 2026-08-12 on "фото": exit connector anchored on the descender's ascent instead of the
// second loop, producing a stray flick and a gap). But the raw final point is ALSO wrong:
// ф's stroke keeps trending toward the baseline right up to where it's captured stopping,
// without ever truly turning around after the second loop's own bottom — so "last point,
// period" just re-lands past that bottom, on the loop's far/rising side, too close to line 4
// for the connector's own rescale math (produces a squished, curled stub instead of a loop).
// The real "last local minimum" is that second loop's own bottom: strictly requiring a
// right-hand neighbor to compare against (so the trajectory's raw endpoint can never
// trivially "win" just because it has no successor) finds exactly that point instead.
export function findClosestApproach(points, targetY, toleranceMargin = 1.5) {
  let minDist = Infinity;
  for (const p of points) minDist = Math.min(minDist, Math.abs(p[1] - targetY));
  const tol = minDist + toleranceMargin;
  const near = points.filter((p) => Math.abs(p[1] - targetY) <= tol);

  // A local minimum only counts as THIS approach if it's still within the caller's own
  // tolerance band — not some unrelated excursion toward a different guide line entirely
  // (б's own stroke swings back up near the TOP of the letter box after its baseline touch;
  // an unbounded search would find that far excursion's own local minimum and call it
  // "closest approach to the baseline", which it isn't).
  const dist = (i) => Math.abs(points[i][1] - targetY);
  let lastLocalMinIdx = null;
  for (let i = points.length - 2; i >= 1; i--) {
    if (dist(i) > tol) continue;
    if (dist(i) <= dist(i - 1) && dist(i) <= dist(i + 1)) {
      lastLocalMinIdx = i;
      break;
    }
  }
  // No interior local minimum near targetY at all (the trajectory approaches targetY
  // monotonically the whole way, e.g. every simple single-loop letter) — the raw endpoint is
  // genuinely correct in that case, same as the old behavior.
  if (lastLocalMinIdx === null) lastLocalMinIdx = points.length - 1;

  return { first: near[0], last: points[lastLocalMinIdx] };
}

export function transformPathD(d, { scaleX = 1, scaleY = 1, translateX = 0, translateY = 0 } = {}) {
  const tokens = d.match(TOKEN_RE) || [];
  const tx = (x) => (x * scaleX + translateX).toFixed(3);
  const ty = (y) => (y * scaleY + translateY).toFixed(3);

  let out = "";
  let i = 0;
  let cmd = null;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "M" || t === "C") {
      cmd = t;
      out += (out ? " " : "") + t;
      i += 1;
      continue;
    }
    if (cmd === "M") {
      out += " " + tx(parseFloat(tokens[i])) + " " + ty(parseFloat(tokens[i + 1]));
      i += 2;
    } else if (cmd === "C") {
      out +=
        " " + tx(parseFloat(tokens[i])) + " " + ty(parseFloat(tokens[i + 1])) +
        " " + tx(parseFloat(tokens[i + 2])) + " " + ty(parseFloat(tokens[i + 3])) +
        " " + tx(parseFloat(tokens[i + 4])) + " " + ty(parseFloat(tokens[i + 5]));
      i += 6;
    } else {
      i += 1;
    }
  }

  return out;
}
