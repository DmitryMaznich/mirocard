// Drawing helpers shared by the Latin glyph sources (print.mjs, british.mjs): band units — band = 50, top line 0, x-line 50,
// baseline 100, bottom line 150; paths M / L / C in the writing direction.
export const r2 = (n) => Math.round(n * 100) / 100;
export const pt = (cx, cy, rx, ry, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
};

// Elliptic arc from angle a0 to a1 (degrees, screen coordinates: 0 = right, 90 = down; a1 > a0
// runs clockwise on screen, a1 < a0 counter-clockwise), as cubic segments of at most 90°.
export function arc(cx, cy, rx, ry, a0, a1, { move = true } = {}) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90));
  const step = (a1 - a0) / n;
  const k = (4 / 3) * Math.tan((step * Math.PI) / 180 / 4);
  const [sx, sy] = pt(cx, cy, rx, ry, a0);
  let d = move ? `M ${r2(sx)},${r2(sy)}` : "";
  for (let i = 0; i < n; i++) {
    const t0 = ((a0 + step * i) * Math.PI) / 180;
    const t1 = ((a0 + step * (i + 1)) * Math.PI) / 180;
    const p0 = [cx + rx * Math.cos(t0), cy + ry * Math.sin(t0)];
    const p1 = [cx + rx * Math.cos(t1), cy + ry * Math.sin(t1)];
    const c1 = [p0[0] - k * rx * Math.sin(t0), p0[1] + k * ry * Math.cos(t0)];
    const c2 = [p1[0] + k * rx * Math.sin(t1), p1[1] - k * ry * Math.cos(t1)];
    d += ` C ${r2(c1[0])},${r2(c1[1])} ${r2(c2[0])},${r2(c2[1])} ${r2(p1[0])},${r2(p1[1])}`;
  }
  return d.trim();
}
export const line = (...p) => p.map(([x, y], i) => `${i ? "L" : "M"} ${r2(x)},${r2(y)}`).join(" ");
export const dot = (x, y) => ({ d: `M ${x},${y} L ${x},${y + 0.5}`, name: "точка", dot: true });
export const s = (d, name) => ({ d, name });
