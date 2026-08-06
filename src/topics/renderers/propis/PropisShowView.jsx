import { useRef, useEffect, useCallback } from "react";

// Real Russian school "пропись" geometry.
// Page size/diagonal-guide spacing/angle match make_lined_paper_landscape_standard.py
// (an A4-landscape two-page spread is two of these A5 pages side by side).
// The vertical ruling per row is NOT that script's generic narrow/wide alternation —
// it's the actual letter-formation "2:1:2" propis system every captured letter is
// drawn against (written_letters/letterPaths.js, tools/letter_capture): a 150-unit
// cell with guides at L1=10, L2=62, L3=88 (baseline, bold), L4=140. One cell = one row.
const PAGE_W_MM = 148.5;
const PAGE_H_MM = 210;
const UNIT_H    = 150;  // letter/row coordinate system height, in font units
const L1 = 10, L2 = 62, L3 = 88, L4 = 140; // propis 2:1:2 — matches written_letters/letterPaths.js
const LINE_MM   = 12;   // one working row, real-world height (Russian school standard)
const DIAGONAL_MM = 20; // "стандарт российских школ"
const ANGLE_FROM_HORIZONTAL_DEG = 65;
const MARGIN_MM = 15;   // red margin line from the left edge

const INK_COLOR = "#1d4ed8";
const NIB_COLOR = "#fbbf24";
const STROKE_W  = 8;
const TIP_R     = 4.5;
const SPEED     = 48; // font-units/sec — gentle pace for a continuously looping demo

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

const ROW_COUNT = Math.floor(PAGE_H_MM / LINE_MM);

function buildHorizontalLines() {
  const toMm = (u) => (u / UNIT_H) * LINE_MM;
  const guides = [
    { u: L1, bold: false },
    { u: L2, bold: false },
    { u: L3, bold: true }, // baseline
    { u: L4, bold: false },
  ];
  const lines = [];
  for (let row = 0; row < ROW_COUNT; row++) {
    for (const g of guides) lines.push({ y: row * LINE_MM + toMm(g.u), bold: g.bold });
  }
  return lines;
}

function buildDiagonalLines() {
  const angleRad = ((90 - ANGLE_FROM_HORIZONTAL_DEG) * Math.PI) / 180;
  const dx = PAGE_H_MM * Math.tan(angleRad);
  const lines = [];
  for (let x = -dx; x < PAGE_W_MM + dx; x += DIAGONAL_MM) {
    lines.push({ x1: x, x2: x + dx });
  }
  return lines;
}

const H_LINES = buildHorizontalLines();
const D_LINES = buildDiagonalLines();

// ── One row's animated sample, looping forever ─────────────────────────────
function LoopingLetterCell({ item, rowIndex }) {
  const gRef      = useRef(null);
  const rafRef    = useRef(null);
  const timersRef = useRef([]);
  const lens      = useRef([]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return undefined;

    const paths = g.querySelectorAll("[data-pr-anim]");
    lens.current = Array.from(paths).map((el) => {
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", len);
      el.setAttribute("stroke-dashoffset", len);
      return len;
    });

    const startDelay = 200 + rowIndex * 180; // gentle wave across rows instead of a unison flash
    const t = setTimeout(() => loopPlay(g), startDelay);
    timersRef.current.push(t);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, stop]);

  function loopPlay(g) {
    const paths = g.querySelectorAll("[data-pr-anim]");
    paths.forEach((el, i) => el.setAttribute("stroke-dashoffset", lens.current[i]));
    const tip = g.querySelector("[data-pr-tip]");
    if (tip) tip.setAttribute("opacity", "0");

    const PAUSE      = 260;
    const LOOP_PAUSE  = 1100;

    function runStroke(i) {
      if (i >= item.strokes.length) {
        if (tip) tip.setAttribute("opacity", "0");
        const t = setTimeout(() => loopPlay(g), LOOP_PAUSE);
        timersRef.current.push(t);
        return;
      }
      const t = setTimeout(() => {
        animStroke(g, i, tip, () => {
          const t2 = setTimeout(() => runStroke(i + 1), PAUSE);
          timersRef.current.push(t2);
        });
      }, PAUSE);
      timersRef.current.push(t);
    }

    runStroke(0);
  }

  function animStroke(g, idx, tip, onDone) {
    const el = g.querySelector(`[data-pr-anim="${idx}"]`);
    if (!el) { onDone(); return; }
    const len = lens.current[idx];
    const dur = (len / SPEED) * 1000;
    const t0  = performance.now();

    function frame(now) {
      const raw   = Math.min((now - t0) / dur, 1);
      const eased = easeInOut(raw);
      el.setAttribute("stroke-dashoffset", len * (1 - eased));
      const pt = el.getPointAtLength(eased * len);
      if (tip) {
        tip.setAttribute("cx", pt.x);
        tip.setAttribute("cy", pt.y);
        tip.setAttribute("opacity", "0.9");
      }
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        el.setAttribute("stroke-dashoffset", 0);
        if (tip) tip.setAttribute("opacity", "0");
        onDone();
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  const [vbMinX, vbMinY, , vbH] = (item.viewBox || "0 0 100 150").split(" ").map(Number);
  const scale = LINE_MM / vbH; // item height always maps to exactly one propis row

  return (
    <g ref={gRef} transform={`scale(${scale}) translate(${-vbMinX} ${-vbMinY})`}>
      {item.strokes.map((s, i) => (
        <path key={`g${i}`} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={STROKE_W}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
      ))}
      {item.strokes.map((s, i) => (
        <path key={`a${i}`} data-pr-anim={i} d={s.d} fill="none" stroke={INK_COLOR}
          strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <circle data-pr-tip r={TIP_R} cx="0" cy="0" fill={NIB_COLOR} opacity="0" />
    </g>
  );
}

// ── Main view: one full propis page, fullscreen, no scroll ────────────────
export default function PropisShowView({ task, onAdvance, onClose }) {
  const items = task?.items ?? [];

  const rows = Array.from({ length: ROW_COUNT }, (_, i) => ({
    index: i,
    item: items.length ? items[i % items.length] : null,
  }));

  return (
    <div className="propis-stage">
      <svg
        className="propis-page-svg"
        viewBox={`0 0 ${PAGE_W_MM} ${PAGE_H_MM}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0" y="0" width={PAGE_W_MM} height={PAGE_H_MM} className="propis-paper" />

        {H_LINES.map((l, i) => (
          <line key={`h${i}`} x1={0} y1={l.y} x2={PAGE_W_MM} y2={l.y}
            className={l.bold ? "propis-line-bold" : "propis-line-thin"} />
        ))}
        {D_LINES.map((l, i) => (
          <line key={`d${i}`} x1={l.x1} y1={0} x2={l.x2} y2={PAGE_H_MM} className="propis-line-diag" />
        ))}
        <line x1={MARGIN_MM} y1={0} x2={MARGIN_MM} y2={PAGE_H_MM} className="propis-line-red" />

        {rows.map((row) => row.item && (
          <g key={row.index} transform={`translate(${MARGIN_MM} ${row.index * LINE_MM})`}>
            <LoopingLetterCell item={row.item} rowIndex={row.index} />
          </g>
        ))}
      </svg>

      {items.length === 0 && (
        <div className="propis-empty-hint">
          Для этого занятия не выбрано ни одной буквы или элемента.
        </div>
      )}

      <div className="propis-controls">
        <button type="button" className="propis-ctrl-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        <button type="button" className="propis-ctrl-btn propis-ctrl-btn--done" onClick={onAdvance}>
          Завершить
        </button>
      </div>
    </div>
  );
}
