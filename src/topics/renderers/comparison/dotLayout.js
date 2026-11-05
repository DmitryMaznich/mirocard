// Where the dots of «Сравни и нажми» lie when they are not in plain rows
// (the «Как лежат точки» setting: rows → scatter → lure).
//
// Every position is a fraction of a square field: { x, y } is the centre,
// d the diameter. The screen turns them into percentages, so the same layout
// works on a 100px phone card and a 260px tablet card.
//
// rand is injectable so tests can pin a layout; the screen uses Math.random.

export const DOT_LAYOUTS = ["rows", "scatter", "lure"];

// Same size on both sides of a task, from the bigger count: few dots are big,
// many are smaller, up to 20 still fit without touching.
export function baseDotSize(n) {
  return Math.min(0.2, 0.62 / Math.sqrt(Math.max(1, n)));
}

// Rows of five, centred — what the child sees after a mistake.
function rowsFit(n) {
  const perRow = Math.min(5, n);
  const rows = Math.ceil(n / perRow);
  return Math.min(0.86 / (perRow + (perRow - 1) * 0.3), 0.86 / (rows + (rows - 1) * 0.3));
}

export function rowsLayout(n, d) {
  if (n <= 0) return [];
  const perRow = Math.min(5, n);
  const rows = Math.ceil(n / perRow);
  const size = Math.min(d, rowsFit(n));
  const step = size * 1.3;
  const totalH = rows * size + (rows - 1) * size * 0.3;
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - r * perRow);
    const c = i % perRow;
    const rowW = inRow * size + (inRow - 1) * size * 0.3;
    out.push({ x: 0.5 - rowW / 2 + size / 2 + c * step, y: 0.5 - totalH / 2 + size / 2 + r * step, d: size });
  }
  return out;
}

// Both sides in rows with ONE dot size (the hint after a mistake): the size
// that fits the bigger count, so neither side looks bigger by its dots.
export function rowsPair(left, right) {
  const d = Math.min(baseDotSize(Math.max(left, right)), rowsFit(Math.max(left, right, 1)));
  return { left: rowsLayout(left, d), right: rowsLayout(right, d) };
}

// Random, non-touching positions inside region (a square part of the field).
// If n dots of size d don't fit, they get a little smaller and try again.
export function scatterLayout(n, d, region = { x: 0, y: 0, s: 1 }, rand = Math.random) {
  if (n <= 0) return [];
  let size = d;
  for (let attempt = 0; attempt < 40; attempt++) {
    const pts = [];
    let tries = 0;
    while (pts.length < n && tries < 4000) {
      tries++;
      const x = region.x + size / 2 + rand() * (region.s - size);
      const y = region.y + size / 2 + rand() * (region.s - size);
      if (pts.every((p) => Math.hypot(p.x - x, p.y - y) >= size * 1.22)) pts.push({ x, y, d: size });
    }
    if (pts.length === n) return pts;
    size *= 0.93;
  }
  return rowsLayout(n, size);
}

// Both sides of one task. On a lure task the side with fewer dots is drawn
// big and spread over the whole card, the side with more is small and
// huddled; on an equal lure task one side (either) looks bigger.
export function buildDotLayout(left, right, layout, lure, rand = Math.random) {
  const d = baseDotSize(Math.max(left, right));
  if (layout === "scatter" || (layout === "lure" && !lure)) {
    return { left: scatterLayout(left, d, undefined, rand), right: scatterLayout(right, d, undefined, rand) };
  }
  if (layout !== "lure") return rowsPair(left, right);

  const bigLeft = left === right ? rand() < 0.5 : left < right;
  const nBig = bigLeft ? left : right;
  const nSmall = bigLeft ? right : left;
  const big = scatterLayout(nBig, Math.min(0.26, 0.7 / Math.sqrt(nBig)), undefined, rand);
  const s = nSmall > 10 ? 0.62 : 0.5;
  const region = { x: rand() * (1 - s), y: rand() * (1 - s), s };
  const small = scatterLayout(nSmall, nSmall > 10 ? 0.075 : 0.085, region, rand);
  return bigLeft ? { left: big, right: small } : { left: small, right: big };
}
