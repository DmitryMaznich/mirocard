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
export function findClosestApproach(points, targetY, toleranceMargin = 1.5) {
  let minDist = Infinity;
  for (const p of points) minDist = Math.min(minDist, Math.abs(p[1] - targetY));
  const tol = minDist + toleranceMargin;
  const near = points.filter((p) => Math.abs(p[1] - targetY) <= tol);
  return { first: near[0], last: near[near.length - 1] };
}

export function transformPathD(d, { scaleX = 1, translateX = 0, translateY = 0 } = {}) {
  const tokens = d.match(TOKEN_RE) || [];
  const tx = (x) => (x * scaleX + translateX).toFixed(3);
  const ty = (y) => (y + translateY).toFixed(3);

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
