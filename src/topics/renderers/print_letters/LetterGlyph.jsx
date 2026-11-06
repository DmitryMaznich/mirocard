import { useState, useRef, useEffect, useCallback } from "react";
import { letterCells } from "./model";

// Print palette, chosen to read the same on a colour and a black-and-white
// printer: the sample in dark navy (prints near-black), the tracing guide in
// a light grey-blue (prints light grey), the start dot green — "green = start
// here" is the usual handwriting-workbook convention, and in b/w it is still
// a solid dark dot.
export const INK = "#1f3a8a";
export const GUIDE = "#8fa3c8";
export const START = "#15803d";

const SAMPLE_DOT = 6.5; // the sample's start dot: small, plain — one per start point, shared starts too
const NUM_ROOM   = 13;  // room before the arrow's tail for the stroke's number
// Variant A (false): no numbers, like Ilyukhina's workbook — the order shows in the ladder; variant B
// (true): each stroke's number by its own arrow (owner to choose, 2026-11-03).
export const NUMBERS_BY_ARROWS = true;
const TINY       = 10;  // strokes shorter than this (Ё's dots) get no marks
const TIP_R      = 6;
const BASE_SPEED = 60;  // SVG units per second

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Start point, direction of the first segment, total length and a sampled outline of a stroke.
// Paths use M, L and C (straight lines and the cubic arcs of ovals and half-ovals); arcs are sampled
// so the length and the "does this start lie on an earlier stroke" test work for them too.
function strokeGeom(d) {
  const tokens = d.match(/[MLC]|-?\d*\.?\d+/g) || [];
  const pts = [];
  let dir = null;
  let cmd = "M";
  let cur = [0, 0];
  let k = 0;
  let curveFrom = -1;
  let curveTo = -1;
  const num = () => Number(tokens[k++]);
  const setDir = (to) => {
    if (dir) return;
    const len = Math.hypot(to[0] - cur[0], to[1] - cur[1]);
    if (len > 1e-6) dir = [(to[0] - cur[0]) / len, (to[1] - cur[1]) / len];
  };
  while (k < tokens.length) {
    if (/^[MLC]$/.test(tokens[k])) cmd = tokens[k++];
    if (cmd === "M") { cur = [num(), num()]; pts.push(cur); cmd = "L"; continue; }
    if (cmd === "L") { const to = [num(), num()]; setDir(to); pts.push(to); cur = to; continue; }
    if (cmd === "C") {
      if (curveFrom < 0) curveFrom = pts.length - 1;
      const c1 = [num(), num()], c2 = [num(), num()], to = [num(), num()];
      setDir(Math.hypot(c1[0] - cur[0], c1[1] - cur[1]) > 1e-6 ? c1 : c2);
      for (let t = 1; t <= 12; t++) {
        const u = t / 12, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, e = u ** 3;
        pts.push([a * cur[0] + b * c1[0] + c * c2[0] + e * to[0], a * cur[1] + b * c1[1] + c * c2[1] + e * to[1]]);
      }
      cur = to;
      curveTo = pts.length - 1;
      continue;
    }
    k++;
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  // the arc's own part (index range in pts) — a half-oval joins its stick with short straight pieces
  return { start: pts[0] ?? [0, 0], dir: dir ?? [0, 1], len, pts, curve: curveFrom >= 0 ? [curveFrom, curveTo] : null };
}

// Distance from point p to a polyline.
function distPolyline([px, py], pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))));
  }
  return best;
}
const nearPolyline = (p, pts, tol) => distPolyline(p, pts) < tol;

// A thin red arrow beside a stroke, showing which way to write it (owner, 2026-11-03: «красные
// тонкие стрелки… с хвостом и крошечным наконечником»): it runs parallel to the stroke, ARROW_GAP
// units off it on the side away from the letter's centre, along the middle of a straight line (from
// 30% to 70% of it) or near the start of an arc (8–40%, where the direction is decided), and ends
// in a small open «V» head.
const ARROW = "#dc2626";
// Off the stroke's axis: half the sample's width (9 → 4.5) + a clear gap of about one stroke width
// (owner, 2026-11-06: in the PDF the arrows and numbers sat too close, ARROW_GAP was 9). Where the far
// arrow or its number would come near another stroke (Ё's dots, М's middle, Ж's slants), the letter
// steps down through ARROW_GAPS, the last one being the old distance.
const ARROW_GAP = 18;
const ARROW_GAPS = [18, 14, 9];
const ARROW_CLEAR = 8.5; // arrow line to another stroke's axis: its half width 4.5 + the arrow's 1.2 + air
const NUM_CLEAR = 13;    // a number's centre to another stroke's axis (the digit is ~10 units across)
const ARROW_HEAD = 5.5;
const ARROW_MIN = 30; // shorter strokes (Ц's tail, Д's feet, Ё's dots, Й's breve) get none
function guideArrow(g, cx, cy, arc, skip = 0, numRoom = 0, early = false, others = [], win = null, gap = ARROW_GAP) {
  const { pts } = g;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const t = (s - cum[i - 1]) / seg;
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    return { p: [ax + (bx - ax) * t, ay + (by - ay) * t], d: [(bx - ax) / len, (by - ay) / len] };
  };
  // start past the numbered start dot (`skip` along the stroke), so the dot never hides the tail
  const bent = !arc && pts.length > 2;
  // `early`: the stroke's middle is a crossing (Ж, Х) — the arrow goes before it, not into the knot
  const lo = arc || early ? 0.08 : bent ? 0.15 : 0.3;
  const hi = arc || early ? 0.4 : bent ? 0.85 : 0.7;
  let s0 = Math.min(Math.max((win ? win[0] : lo) * L, skip + numRoom), L * 0.7);
  let s1 = Math.min(Math.max((win ? win[1] : hi) * L, s0 + 20), L - 3);
  // an arc: the arrow runs over its curved part only (not the short straight pieces of a half-oval),
  // from near its start, and stays OUTSIDE it — «outside» measured from the arc's own centre (the
  // middle of its curve), never from the letter's: Б's, Р's half-ovals sit across the letter's centre
  let ac = null;
  if (arc && g.curve) {
    const [ci, cj] = g.curve;
    const c0 = cum[ci], c1 = cum[cj], cl = c1 - c0;
    s0 = Math.max(c0 + 0.06 * cl, Math.min(skip + numRoom, c0 + 0.3 * cl));
    s1 = Math.max(s0 + 20, c0 + (cl > 220 ? 0.32 : 0.5) * cl);
    s1 = Math.min(s1, c1 - 2);
    const cp = pts.slice(ci, cj + 1);
    ac = [cp.reduce((a, q) => a + q[0], 0) / cp.length, cp.reduce((a, q) => a + q[1], 0) / cp.length];
  }
  const mid = at((s0 + s1) / 2);
  // the outer side: the normal pointing away from the letter's centre (a centred stroke — Н's bar,
  // Ж's stick — gets it above / to the right)
  let n = [-mid.d[1], mid.d[0]];
  const [ocx, ocy] = ac ?? [cx, cy];
  const away = (mid.p[0] + n[0] - ocx) ** 2 + (mid.p[1] + n[1] - ocy) ** 2 - ((mid.p[0] - n[0] - ocx) ** 2 + (mid.p[1] - n[1] - ocy) ** 2);
  // a stroke through the centre (Х, Ж's slants) has no clear outer side: take the side with more room
  // from the other strokes
  if (!ac && Math.abs(away) < 0.5 && others.length) {
    const room = (sg) => {
      const q = [mid.p[0] + sg * n[0] * gap, mid.p[1] + sg * n[1] * gap];
      return Math.min(...others.map((pts) => distPolyline(q, pts)));
    };
    if (room(-1) > room(1)) n = [-n[0], -n[1]];
  } else if (away < -1e-6 || (Math.abs(away) <= 1e-6 && (n[1] > 0 || (n[1] === 0 && n[0] < 0)))) n = [-n[0], -n[1]];
  // A bent stroke (Ж's «уголок»: two straight pieces in one movement) gets an arrow that bends with
  // it, on the inner side of the angle (the open side, away from the stick): each piece offset
  // towards the chord between the stroke's ends, the pieces joined at a mitred corner.
  if (!arc && pts.length > 2) {
    const verts = [at(s0).p, ...pts.filter((_, i) => cum[i] > s0 && cum[i] < s1), at(s1).p];
    const chordMid = [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2];
    const segN = [];
    for (let k = 1; k < verts.length; k++) {
      const [ax, ay] = verts[k - 1], [bx, by] = verts[k];
      const l = Math.hypot(bx - ax, by - ay) || 1;
      let m = [-(by - ay) / l, (bx - ax) / l];
      const mid = [(ax + bx) / 2, (ay + by) / 2];
      if ((chordMid[0] - mid[0]) * m[0] + (chordMid[1] - mid[1]) * m[1] < 0) m = [-m[0], -m[1]];
      segN.push(m);
    }
    const off = verts.map((v, k) => {
      if (k === 0) return [v[0] + segN[0][0] * gap, v[1] + segN[0][1] * gap];
      if (k === verts.length - 1) { const m = segN[segN.length - 1]; return [v[0] + m[0] * gap, v[1] + m[1] * gap]; }
      const [a, b] = [segN[k - 1], segN[k]];
      const bis = [a[0] + b[0], a[1] + b[1]];
      const bl = Math.hypot(bis[0], bis[1]) || 1;
      const u = [bis[0] / bl, bis[1] / bl];
      const scale = gap / Math.max(0.3, u[0] * a[0] + u[1] * a[1]);
      return [v[0] + u[0] * scale, v[1] + u[1] * scale];
    });
    const [ex, ey] = off[off.length - 1];
    const [px, py] = off[off.length - 2];
    const dl = Math.hypot(ex - px, ey - py) || 1;
    const [dx, dy] = [(ex - px) / dl, (ey - py) / dl];
    const head = (sgn) => {
      const a = (sgn * 28 * Math.PI) / 180;
      const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
      return [ex - rx * ARROW_HEAD, ey - ry * ARROW_HEAD];
    };
    const f = (v) => Math.round(v * 100) / 100;
    const [h1, h2] = [head(1), head(-1)];
    const nq = at(Math.max(0, s0 - numRoom * 0.55));
    const num = [nq.p[0] + segN[0][0] * gap, nq.p[1] + segN[0][1] * gap];
    return { d: `M${off.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}M${f(h1[0])} ${f(h1[1])}L${f(ex)} ${f(ey)}L${f(h2[0])} ${f(h2[1])}`, num, line: off };
  }
  const steps = arc ? 10 : 1;
  const line = [];
  for (let k = 0; k <= steps; k++) {
    const q = at(s0 + ((s1 - s0) * k) / steps);
    // along an arc every point takes the normal pointing away from the letter's centre — the arrow
    // follows the curve outside it without kinks
    const nn = arc ? (() => {
      const m = [-q.d[1], q.d[0]];
      const [ox, oy] = ac ?? [cx, cy];
      const out = (q.p[0] + m[0] - ox) ** 2 + (q.p[1] + m[1] - oy) ** 2 >= (q.p[0] - m[0] - ox) ** 2 + (q.p[1] - m[1] - oy) ** 2;
      return out ? m : [-m[0], -m[1]];
    })() : n;
    line.push([q.p[0] + nn[0] * gap, q.p[1] + nn[1] * gap]);
  }
  const [ex, ey] = line[line.length - 1];
  const [px, py] = line[line.length - 2];
  const dl = Math.hypot(ex - px, ey - py) || 1;
  const [dx, dy] = [(ex - px) / dl, (ey - py) / dl];
  const head = (sgn) => {
    const a = (sgn * 28 * Math.PI) / 180;
    const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
    return [ex - rx * ARROW_HEAD, ey - ry * ARROW_HEAD];
  };
  const f = (v) => Math.round(v * 100) / 100;
  const [h1, h2] = [head(1), head(-1)];
  // the stroke's number, if wanted, stands just before the arrow's tail, on the same side
  const nq = at(Math.max(0, s0 - numRoom * 0.55));
  const num = [nq.p[0] + n[0] * gap, nq.p[1] + n[1] * gap];
  return { d: `M${line.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}M${f(h1[0])} ${f(h1[1])}L${f(ex)} ${f(ey)}L${f(h2[0])} ${f(h2[1])}`, num, line };
}

// Glyph geometry lives directly on the notebook grid (tools/print_letters/
// topic.json): 1 cell = 50 units, a letter is 2 cells tall (y 0..100) and
// `cells` wide (most letters 1 cell, wide ones like Ш — 2). Its viewBox is
// exactly that box, so every stroke that sits on a cell boundary in the data
// lands on a printed grid line — no cropping, no per-axis stretching, and the
// same proportions everywhere the letter is drawn (rows, label tile).
export const UNITS_PER_CELL = 50;

export function letterFrame(letter) {
  return [0, 0, letterCells(letter) * UNITS_PER_CELL, 2 * UNITS_PER_CELL];
}

// One printed letter (or a subset of its elements). Variants:
//   sample — solid ink with the motor plan: an arrow at the end of each
//            element, a green dot where it starts, and its number (when the
//            row has more than one element, numbered by the element's place
//            in the whole letter, `stroke.n`). Tap plays the stroke order.
//   dotted — light dotted guide to trace over.
//   trace  — light solid guide (faded copies; `opacity` per copy).
//   starts — only the green start dot over a faint trace of the element.
//   plain  — solid strokes in `color`, no marks (label tile, panel header).
// `dots` (sample, dotted, trace): a green dot where each stroke starts — numbered on the sample,
// plain on a contour; false hides them (the row's «точки» option, model.js copyPlan).
export default function LetterGlyph({
  letter,
  frame,          // [x, y, w, h] — the WHOLE letter's grid box; see letterFrame()
  heightMm,
  widthMm,
  variant  = "plain",
  color,
  opacity  = 1,
  tappable = false,
  weight,         // stroke width override in glyph units (bold letter on the plate)
  label,
  dots,           // start dots on/off; default: on for sample and starts, off for contours
  arrows = true,  // the sample's red direction arrows (the row's «Стрелки» option)
  numbers = NUMBERS_BY_ARROWS, // the strokes' numbers beside their arrows (variant B) or none (A, as in Ilyukhina)
  hintStart = null, // [x, y]: a green dot where a stroke that is NOT drawn starts («Допиши штрих», tasks.js)
}) {
  const { strokes = [] } = letter;
  const [vbX, vbY, vbW, vbH] = frame ?? letterFrame(letter);
  const wMm = widthMm ?? (heightMm * vbW) / vbH;
  const geoms = strokes.map((s) => strokeGeom(s.d));
  const markable = geoms.map((g) => g.len >= TINY);
  const showDots = dots ?? (variant === "sample" || variant === "starts");
  // Start marks stand EXACTLY where their strokes start (owner, 2026-11-03: «точки часто не на
  // началах штрихов» — a start shared with an earlier stroke used to be moved along its line). Strokes
  // that start at the same point share one mark: a pill with their numbers in order («1 2» at Г's
  // corner) — start here, first this stroke, then that one.
  const starts = [];
  geoms.forEach((g, i) => {
    if (!markable[i]) return;
    const hit = starts.find((st) => Math.hypot(st.p[0] - g.start[0], st.p[1] - g.start[1]) < 1.5);
    if (hit) hit.idx.push(i);
    else starts.push({ p: g.start, idx: [i] });
  });

  // The direction arrows of the sample (see guideArrow): beside each stroke, on the letter's outer
  // side, so they never sit on another stroke.
  const [cx, cy] = [vbX + vbW / 2, vbY + vbH / 2];
  // Sample: a small plain dot at each start point; the arrow beside each stroke, and (variant B) the
  // stroke's number just before the arrow — each stroke has its own arrow, so shared starts never
  // pile numbers up.
  const showNumbers = variant === "sample" && numbers && markable.filter(Boolean).length > 1;
  const guides = variant === "sample" && (arrows || showNumbers) ? geoms.map((g, i) => {
    if (!markable[i]) return null;
    if (g.len < ARROW_MIN) {
      // a short stroke (Ц's tail, Д's feet) has no room for an arrow, but keeps its number: beside its
      // middle, on the side away from the letter's centre
      if (!showNumbers) return null;
      const m = [(g.start[0] + (g.pts[g.pts.length - 1]?.[0] ?? g.start[0])) / 2, (g.start[1] + (g.pts[g.pts.length - 1]?.[1] ?? g.start[1])) / 2];
      let nn = [-g.dir[1], g.dir[0]];
      if ((m[0] + nn[0] - cx) ** 2 + (m[1] + nn[1] - cy) ** 2 < (m[0] - nn[0] - cx) ** 2 + (m[1] - nn[1] - cy) ** 2) nn = [-nn[0], -nn[1]];
      return { d: null, num: [m[0] + nn[0] * (ARROW_GAP + 1), m[1] + nn[1] * (ARROW_GAP + 1)] };
    }
    const skip = showDots ? SAMPLE_DOT + 3 : 0;
    const mid = g.pts.length === 2 ? [(g.pts[0][0] + g.pts[1][0]) / 2, (g.pts[0][1] + g.pts[1][1]) / 2] : null;
    const crossed = mid && geoms.some((o, j) => j !== i && nearPolyline(mid, o.pts, 4));
    const others = geoms.filter((_, j) => j !== i).map((o) => o.pts);
    const isArc = /C/.test(strokes[i].d);
    // an arrow that touches another stroke (Ф's stick runs through the oval) looks for a clear stretch
    // of its own stroke — nearer the end, then nearer the start
    const clear = (gd, near = 4.5) => {
      if (!gd?.line) return true;
      for (let k = 1; k < gd.line.length; k++) {
        const [a, b] = [gd.line[k - 1], gd.line[k]];
        for (let t = 0; t <= 1.0001; t += 0.1) {
          const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          if (others.some((pts) => distPolyline(q, pts) <= near)) return false;
        }
      }
      return true;
    };
    // the far gap only where the arrow and its number keep clear of the other strokes; else the next
    const roomy = (gd) => clear(gd, ARROW_CLEAR) && (!showNumbers || others.every((pts) => distPolyline(gd.num, pts) >= NUM_CLEAR));
    const room = showNumbers ? NUM_ROOM : 0;
    for (const gap of ARROW_GAPS.slice(0, -1)) {
      const gd = guideArrow(g, cx, cy, isArc, skip, room, crossed, others, null, gap);
      if (roomy(gd)) return gd;
    }
    const last = ARROW_GAPS[ARROW_GAPS.length - 1];
    const first = guideArrow(g, cx, cy, isArc, skip, room, crossed, others, null, last);
    if (isArc || clear(first)) return first;
    for (const w of [[0.62, 0.94], [0.08, 0.38]]) {
      const alt = guideArrow(g, cx, cy, false, skip, room, false, others, w, last);
      if (clear(alt)) return alt;
    }
    return first;
  }) : [];

  const svgRef     = useRef(null);
  const rafRef     = useRef(null);
  const timersRef  = useRef([]);
  const strokeLens = useRef([]);
  const [active, setActive]   = useState(-1);
  const [tipPos, setTipPos]   = useState(null);
  const [playing, setPlaying] = useState(false);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    strokeLens.current = Array.from(svg.querySelectorAll("[data-lg-anim]")).map((el) => {
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", len);
      el.setAttribute("stroke-dashoffset", len);
      return len;
    });
    return cleanup;
  }, [letter.id, cleanup]);

  function play() {
    cleanup();
    setPlaying(true);
    setTipPos(null);
    const svg = svgRef.current;
    svg?.querySelectorAll("[data-lg-anim]").forEach((el, i) => el.setAttribute("stroke-dashoffset", strokeLens.current[i]));
    const pause = 300;
    function runStroke(i) {
      if (i >= strokes.length) { setActive(-1); setTipPos(null); setPlaying(false); return; }
      setActive(i);
      const t = setTimeout(() => animStroke(i, () => {
        const t2 = setTimeout(() => runStroke(i + 1), pause);
        timersRef.current.push(t2);
      }), pause);
      timersRef.current.push(t);
    }
    const t0 = setTimeout(() => runStroke(0), 150);
    timersRef.current.push(t0);
  }

  function animStroke(idx, onDone) {
    const el = svgRef.current?.querySelector(`[data-lg-anim="${idx}"]`);
    if (!el) { onDone(); return; }
    const len = strokeLens.current[idx];
    const dur = (len / BASE_SPEED) * 1000;
    const t0 = performance.now();
    function step(now) {
      const raw = Math.min((now - t0) / dur, 1);
      const eased = easeInOut(raw);
      el.setAttribute("stroke-dashoffset", len * (1 - eased));
      const pt = el.getPointAtLength(eased * len);
      setTipPos({ x: pt.x, y: pt.y });
      if (raw < 1) rafRef.current = requestAnimationFrame(step);
      else { el.setAttribute("stroke-dashoffset", 0); setTipPos(null); onDone(); }
    }
    rafRef.current = requestAnimationFrame(step);
  }

  const ink = color ?? (variant === "sample" || variant === "plain" ? INK : GUIDE);
  const strokeW = weight ?? (variant === "dotted" ? 7 : variant === "starts" ? 5 : 9);
  const canPlay = tappable && variant === "sample";

  return (
    <svg
      ref={svgRef}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      width={`${wMm}mm`}
      height={`${heightMm}mm`}
      className={`pl-glyph pl-glyph--${variant}${canPlay ? " pl-glyph--tappable" : ""}`}
      style={{ display: "block", flexShrink: 0, width: `${wMm}mm`, height: `${heightMm}mm`, opacity, cursor: canPlay ? "pointer" : undefined, overflow: "visible" }}
      onClick={canPlay && !playing ? play : undefined}
      role={canPlay ? "button" : "img"}
      aria-label={label ? `Буква ${label}` : undefined}
    >

      {strokes.map((s, i) => (
        <path
          key={`s${i}`}
          d={s.d}
          fill="none"
          stroke={ink}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={variant === "dotted" ? "1 10" : undefined}
          opacity={variant === "starts" ? 0.3 : 1}
        />
      ))}

      {arrows && guides.map((gd, i) => gd?.d && (
        <path key={`g${i}`} d={gd.d} fill="none" stroke={ARROW} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />
      ))}
      {showNumbers && guides.map((gd, i) => gd && (
        <text key={`n${i}`} x={gd.num[0]} y={gd.num[1] + 5} textAnchor="middle" fontSize={15} fontWeight="900" fontFamily="Nunito, sans-serif"
          fill={START} stroke="#ffffff" strokeWidth={3} paintOrder="stroke" style={{ pointerEvents: "none" }}>
          {strokes[i].n ?? i + 1}
        </text>
      ))}

      {canPlay && strokes.map((s, i) => (
        <path key={`a${i}`} data-lg-anim={i} d={s.d} fill="none" stroke={START} strokeWidth={9}
          strokeLinecap="round" strokeLinejoin="round" opacity={playing ? 1 : 0} />
      ))}

      {/* Start marks. With several elements the green start dot carries the
          element's number (its place in the whole letter): the number sits ON
          the element it belongs to, never floating in the blank cell between
          rows where it could be read as part of the row above. */}
      {showDots && variant !== "plain" && starts.map((st, k) => {
        const [mx, my] = st.p;
        const on = st.idx.includes(active);
        // the same small dot on the sample and on the contours (Ilyukhina's contours have small dots too)
        return variant === "sample"
          ? <circle key={`d${k}`} cx={mx} cy={my} r={SAMPLE_DOT} fill={START} stroke={on ? INK : "#ffffff"} strokeWidth={on ? 3 : 1.5} style={{ pointerEvents: "none" }} />
          : <circle key={`d${k}`} cx={mx} cy={my} r={SAMPLE_DOT} fill={START} />;
      })}

      {hintStart && <circle cx={hintStart[0]} cy={hintStart[1]} r={SAMPLE_DOT} fill={START} style={{ pointerEvents: "none" }} />}

      {tipPos && <circle cx={tipPos.x} cy={tipPos.y} r={TIP_R} fill={START} />}
    </svg>
  );
}
