import { useId, useRef, useState } from "react";

// «Расставь по порядку»'s hint: a number line shaped as a wedge. Magnitude
// shows three times over — the place on the line, the wedge's thickness and
// the size of the number above the slider — so a child who doesn't yet read
// "further right = more" still sees it in the thickness and the digits.
// The wedge turns with the task: «от меньшего к большему» has its thin end
// on the left, «от большего к меньшему» on the right, so it reads in the
// same direction as the slots above it.
//
// Flags: whenever the slider passes over one of the task's numbers, a flag
// with that number stays above the wedge — the child finds where each
// number lives by moving the slider, the screen never places them for him
// (owner's call, 2026-11-01, replacing the earlier "not tied to the task at
// all" rule). It still answers nothing: the tiles are dragged by hand.
//
// Drawn in a fixed 360-wide viewBox and scaled by CSS, so it fits the slot
// grid's width on any screen.

const W = 360;
const PAD = 16;
const THIN = 4;
const THICK = 30;
const NUM_BASELINE = 40;      // the number's row, above every flag
const FLAG_ROW = 24;          // a flag too close to another goes one row up
const FLAG_GAP_X = 32;
const BELOW = 30;             // ticks and their labels

export function wedgeTicks(min, max) {
  const span = max - min;
  const step = span <= 20 ? 1 : span <= 200 ? 10 : 100;
  const labelEvery = span <= 10 ? 1 : span <= 20 ? 5 : step;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    ticks.push({ value: v, major: v % labelEvery === 0 || v === min });
  }
  return ticks;
}

// Row for each flag in the order found: the lowest row where no flag
// already sits within FLAG_GAP_X.
export function flagRows(xs) {
  const placed = [];
  return xs.map((x) => {
    let row = 0;
    while (placed.some((p) => p.row === row && Math.abs(p.x - x) < FLAG_GAP_X)) row++;
    placed.push({ x, row });
    return row;
  });
}

export default function WedgeScale({ min, max, direction, numbers = [] }) {
  const asc = direction !== "desc";
  const span = Math.max(1, max - min);
  const [value, setValue] = useState(asc ? min : max);
  const [found, setFound] = useState([]);
  const prevRef = useRef(value);
  const draggingRef = useRef(false);
  const gradId = useId().replace(/:/g, "");

  const xOf = (v) => {
    const r = (v - min) / span;
    return asc ? PAD + r * (W - 2 * PAD) : W - PAD - r * (W - 2 * PAD);
  };
  const hOf = (v) => THIN + (THICK - THIN) * (v - min) / span;

  // Every task number between the previous and the new value gets a flag:
  // a quick finger skips values, and a skipped number must not lose its flag.
  function moveTo(v) {
    const next = Math.min(max, Math.max(min, v));
    const lo = Math.min(prevRef.current, next);
    const hi = Math.max(prevRef.current, next);
    prevRef.current = next;
    setValue(next);
    setFound((prev) => {
      const add = numbers.filter((n) => n >= lo && n <= hi && !prev.includes(n)).sort((a, b) => a - b);
      return add.length ? [...prev, ...add] : prev;
    });
  }

  function fromClientX(el, clientX) {
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const x = ((clientX - rect.left) / rect.width) * W;
    const r = Math.min(1, Math.max(0, (x - PAD) / (W - 2 * PAD)));
    moveTo(Math.round(min + (asc ? r : 1 - r) * span));
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    fromClientX(e.currentTarget, e.clientX);
  }
  function onPointerMove(e) {
    if (draggingRef.current) fromClientX(e.currentTarget, e.clientX);
  }
  function onPointerUp(e) {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }
  function onKeyDown(e) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    moveTo(value + d * (asc ? 1 : -1));
  }

  const rows = flagRows(found.map(xOf));
  const maxRow = rows.length ? Math.max(...rows) : 0;
  const base = NUM_BASELINE + 6 + 30 + THICK + maxRow * FLAG_ROW;
  const height = base + BELOW;

  const ticks = wedgeTicks(min, max);
  const labelled = ticks.filter((t) => t.major);
  // The far end gets its own label unless it would crowd the last one.
  const last = labelled[labelled.length - 1];
  const endLabel = last && last.value !== max && Math.abs(xOf(max) - xOf(last.value)) >= 22 ? max : null;

  const narrowX = asc ? PAD : W - PAD;
  const wideX = asc ? W - PAD : PAD;
  const x = xOf(value);
  const h = hOf(value);
  const numSize = 18 + 30 * (value - min) / span;   // 18 → 48: a bigger number is written bigger

  return (
    <div
      className="apply-wedge"
      role="slider"
      tabIndex={0}
      aria-label="Шкала чисел"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${W} ${height}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1={asc ? 0 : 1} x2={asc ? 1 : 0} y1="0" y2="0">
            <stop offset="0" stopColor="#dbeafe" />
            <stop offset="1" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <polygon
          className="apply-wedge-body"
          points={`${narrowX},${base - THIN} ${wideX},${base - THICK} ${wideX},${base} ${narrowX},${base}`}
          fill={`url(#${gradId})`}
        />
        {ticks.map((t) => (
          <line key={t.value} className="apply-wedge-tick" x1={xOf(t.value)} x2={xOf(t.value)} y1={base + 2} y2={base + (t.major ? 10 : 6)} strokeWidth={t.major ? 1.6 : 1} />
        ))}
        {[...labelled.map((t) => t.value), ...(endLabel != null ? [endLabel] : [])].map((v) => (
          <text key={`l${v}`} className="apply-wedge-label" x={xOf(v)} y={base + 24} textAnchor="middle">{v}</text>
        ))}
        {/* Higher rows first, so a lower flag's box covers the pole of the
            flag stacked above it instead of the pole crossing its number. */}
        {found.map((n, i) => ({ n, row: rows[i] })).sort((a, b) => b.row - a.row).map(({ n, row }) => {
          const fx = xOf(n);
          const top = base - hOf(n);
          const lift = row * FLAG_ROW;
          return (
            <g key={n} className="apply-wedge-flag">
              <line x1={fx} x2={fx} y1={top} y2={top - 12 - lift} />
              <rect x={fx - 15} y={top - 30 - lift} width="30" height="20" rx="6" />
              <text x={fx} y={top - 15 - lift} textAnchor="middle">{n}</text>
            </g>
          );
        })}
        <line className="apply-wedge-guide" x1={x} x2={x} y1={NUM_BASELINE + 6} y2={base} />
        <circle className="apply-wedge-thumb" cx={x} cy={base - h / 2} r="13" />
        <text className="apply-wedge-value" x={Math.min(W - 12, Math.max(12, x))} y={NUM_BASELINE} textAnchor="middle" fontSize={numSize.toFixed(1)}>{value}</text>
      </svg>
    </div>
  );
}
