// The writing geometry of a glyph bank whose school copybook differs from the Russian one (docs/propis2-variants.md): another slant
// (Bulgarian copybooks: 76deg, the Russian one 65deg) and other heights of the parts above and below the lowercase band (Bulgarian
// capitals and ascenders are 2.5 lowercase heights, ours 2). The bank's own geometry is never changed: a row is laid out, snapped and
// joined exactly as for the Russian copybook, then the finished ink of the row is mapped as one piece about the row's own baseline:
// unslanted to the vertical, the zone above the lowercase band stretched by `upper` and the one below it by `lower`, leaned again at
// `slantDeg`. The lowercase band itself does not move vertically and the map is continuous, so every join stays joined.
// `script` (a deck's meta.script): { slantDeg, upper, lower }, all optional; none / all defaults = the Russian copybook, nothing done.
// (`exactJoins`, read by wordEngine: the next letter starts exactly at the previous one's exit end, no grid snap, no tail nudging.)
export const RU_SLANT_DEG = 65;

const tanFromVertical = (deg) => Math.tan(((90 - deg) * Math.PI) / 180);

// null when the script changes nothing (no work at all for the Russian decks)
export function scriptKey(script) {
  if (!script) return null;
  const slant = script.slantDeg ?? RU_SLANT_DEG, upper = script.upper ?? 1, lower = script.lower ?? 1;
  if (slant === RU_SLANT_DEG && upper === 1 && lower === 1) return null;
  return `${slant}|${upper}|${lower}`;
}

// (x, y) -> [x, y] in row-local units: `baseline` and `xHeight` of the row as laid out (y grows downwards)
export function scriptPointMap(script, { baseline, xHeight }) {
  const t0 = tanFromVertical(RU_SLANT_DEG);
  const t1 = tanFromVertical(script?.slantDeg ?? RU_SLANT_DEG);
  const upper = script?.upper ?? 1, lower = script?.lower ?? 1;
  const top = baseline - xHeight;
  return (x, y) => {
    const upright = x - (baseline - y) * t0;
    const y2 = y < top ? top - (top - y) * upper : y > baseline ? baseline + (y - baseline) * lower : y;
    return [upright + (baseline - y2) * t1, y2];
  };
}

const NUM = /-?\d*\.?\d+(?:[eE][+-]?\d+)?/g;
// Every coordinate pair of a path (M / C / L, as the layout writes them) through `fn`.
export function mapPathD(d, fn) {
  const nums = String(d).match(NUM) ?? [];
  let i = 0;
  let pending = null;
  return String(d).replace(NUM, () => {
    const k = i++;
    if (k % 2 === 0) { pending = fn(Number(nums[k]), Number(nums[k + 1])); return round(pending[0]); }
    return round(pending[1]);
  });
}
const round = (v) => String(Number(v.toFixed(3)));

const mapStrokes = (strokes, fn) => strokes?.map((s) => (s?.d ? { ...s, d: mapPathD(s.d, fn) } : s));
const mapPoints = (pts, fn) => pts?.map((p) => (Array.isArray(p) ? fn(p[0], p[1]) : p));
function mapArrow(a, fn) {
  if (!a) return a;
  if (a.long) return { ...a, d: mapPathD(a.d, fn), head: mapPathD(a.head, fn) };
  if (!a.point) return a;
  // a short arrow: its point moves, its direction turns with the map (a short step along it, mapped)
  const rad = ((a.angleDeg ?? 0) * Math.PI) / 180;
  const p = fn(a.point[0], a.point[1]);
  const q = fn(a.point[0] + Math.cos(rad), a.point[1] + Math.sin(rad));
  return { ...a, point: p, angleDeg: (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI };
}

// A laid-out row (wordEngine layoutWideLinesIntoRows) with all its ink mapped; widths and positions along the row stay.
export function mapRowInk(row, fn) {
  return {
    ...row,
    segments: row.segments.map((seg) => ({
      ...seg,
      strokes: mapStrokes(seg.strokes, fn),
      startPoints: mapPoints(seg.startPoints, fn),
      directionArrows: seg.directionArrows?.map((a) => mapArrow(a, fn)),
      repeatChain: seg.repeatChain?.map((c) => ({ ...c, strokes: mapStrokes(c.strokes, fn), startPoints: mapPoints(c.startPoints, fn) })),
      trajectory: seg.trajectory ? { ...seg.trajectory, strokes: mapStrokes(seg.trajectory.strokes, fn) } : seg.trajectory,
    })),
  };
}
