// Shows how a part is drawn: each subpath ("M…") is traced in order, like a pencil, then fills appear.
// The prefix is a real polyline of sampled points (not stroke-dashoffset, which misdrew on some
// Android Chrome builds in «Первые линии», docs/drawing-first-lines.md §18).
const NS = 'http://www.w3.org/2000/svg';
export const splitSubpaths = d => (d ?? '').trim().split(/(?=M)/).map(s => s.trim()).filter(Boolean);

let probe = null;
function measurer() {
  if (typeof document === 'undefined') return null;
  if (!probe?.isConnected) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
    probe = document.createElementNS(NS, 'path'); svg.append(probe); document.body.append(svg);
  }
  return typeof probe.getTotalLength === 'function' ? probe : null;
}
// [{ points: [{x,y}…], length }] per subpath, or null where the browser can't measure (tests).
export function sampleSubpaths(d, step = 2) {
  const path = measurer();
  if (!path) return null;
  try {
    return splitSubpaths(d).map(sub => {
      path.setAttribute('d', sub);
      const length = path.getTotalLength(), count = Math.max(2, Math.ceil(length / step));
      return { length, points: Array.from({ length: count + 1 }, (_, i) => { const p = path.getPointAtLength(length * i / count); return { x: p.x, y: p.y }; }) };
    });
  } catch { return null; }
}
// Each subpath takes time by its length; a short pause between them is the pencil lift.
export const LIFT_MS = 160;
export function timeline(subpaths, totalMs = 2200) {
  const total = subpaths.reduce((sum, s) => sum + s.length, 0) || 1;
  const drawing = Math.max(900, Math.min(totalMs, total * 9)) - LIFT_MS * (subpaths.length - 1);
  let at = 0;
  return subpaths.map(s => { const span = { start: at, ms: Math.max(120, drawing * s.length / total) }; at += span.ms + LIFT_MS; return span; });
}
export const timelineEnd = spans => spans.length ? spans.at(-1).start + spans.at(-1).ms : 0;
