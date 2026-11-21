import { useMemo } from "react";
import { layoutWideLinesIntoRows } from "@/handwriting/wordEngine.js";
import { letterPieces, splitIntoParts } from "@/handwriting/letterParts.js";
import { getPathEndpoints, samplePath, toCubicPathD } from "@/handwriting/pathGeometry.js";

// «Что пишем» / «Штрихи» (owner, 2026-11-21): the letter of a row with its parts to tap, on a «cutting mat» — a dark board with rulers and
// the copybook's own lines, not a grid. The letter is laid out by the engine exactly as the row writes it (fitted to the lines, stretched,
// slanted — the raw capture looked distorted); every part has a colour and a numbered dot where the pen starts it; a part not written stays
// as a faint dotted trace of its colour, to be tapped back. No captions (owner, 2026-11-16).
const COLORS = ["#ffb938", "#4fc3ff", "#ff7a6b", "#8fe05a", "#c39bff", "#ff8fcf", "#3ee0c8", "#ffd85e"];
const Y0 = -66, Y1 = 132; // the mat, top to bottom, in row units: the capital line (-42) and the long tails (114) with room around
const RULER = 13; // the rulers along the top and the left edge
const SLANT = Math.tan((25 * Math.PI) / 180); // the copybook slant (wordEngine WIDE_JOIN_TAN)
const PX = 1.32; // px per row unit
const LINES = [-42, 10, 36, 62, 114];

const startOf = (d) => getPathEndpoints(d).start;

export default function Propis2PartsPad({ glyph, text, map, keep, onToggle }) {
  const lay = useMemo(() => {
    // the letter as the row places it; a letter the row writes in other strokes than its glyph's — the raw glyph, as before
    let placed = null;
    try {
      const seg = layoutWideLinesIntoRows([`${text}#1#c`], map, (_r, x) => x).placed[0]?.segments?.[0];
      const st = (seg?.strokes ?? []).filter((s) => !s.dashed && !s.join);
      if (st.length === glyph.strokes.length) placed = st;
    } catch { placed = null; }
    const strokes = placed ?? glyph.strokes;
    const n = letterPieces(glyph).length;
    const parts = Array.from({ length: n }, (_, i) => {
      const hidden = new Set(Array.from({ length: n }, (_, k) => k).filter((k) => k !== i));
      const ds = splitIntoParts(strokes, glyph, hidden).filter((s) => !s.hidden).map((s) => s.d);
      return { d: ds.join(" "), start: ds.length ? startOf(ds[0]) : null };
    });
    const pts = strokes.flatMap((s) => samplePath(toCubicPathD(s.d), 40));
    const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0]));
    const mid = (minX + maxX) / 2, half = Math.max(70, (maxX - minX) / 2 + 34);
    return { strokes, parts, x0: mid - half - RULER, x1: mid + half };
  }, [glyph, text, map]);

  const { strokes, parts, x0, x1 } = lay;
  const w = x1 - x0, h = Y1 - Y0;
  const on = new Set(keep);
  const tickX = [];
  for (let x = Math.ceil((x0 + RULER) / 5) * 5; x < x1; x += 5) tickX.push(x);
  const tickY = [];
  for (let y = Math.ceil((Y0 + RULER) / 5) * 5; y < Y1; y += 5) tickY.push(y);
  // slanted guides every 26 units, as the copybook's slant lines
  const slants = [];
  for (let x = Math.floor((x0 - h * SLANT) / 26) * 26; x < x1 + h * SLANT; x += 26) slants.push(x);
  const clip = `p2pp-${glyph.label}`;
  return (
    <svg className="p2-partpad" viewBox={`${x0} ${Y0} ${w} ${h}`} width={Math.round(w * PX)} height={Math.round(h * PX)}
      aria-label={`Буква ${glyph.label}: нажмите на штрих, чтобы писать или не писать его`}>
      <defs>
        <linearGradient id={`${clip}-mat`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d4a42" />
          <stop offset="1" stopColor="#123530" />
        </linearGradient>
        <clipPath id={`${clip}-c`}><rect x={x0 + RULER} y={Y0 + RULER} width={w - RULER} height={h - RULER} /></clipPath>
      </defs>
      <rect x={x0} y={Y0} width={w} height={h} rx={9} fill={`url(#${clip}-mat)`} />
      <g clipPath={`url(#${clip}-c)`}>
        {slants.map((x) => <line key={`s${x}`} x1={x} y1={62} x2={x + (62 - Y0) * SLANT} y2={Y0} stroke="#fff" strokeOpacity={0.07} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {slants.map((x) => <line key={`t${x}`} x1={x} y1={62} x2={x - (Y1 - 62) * SLANT} y2={Y1} stroke="#fff" strokeOpacity={0.07} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {/* the copybook's lines: capital line, top and middle of the small letters, the baseline (strong), the tails' line */}
        {[[-42, 0.22], [10, 0.4], [114, 0.22]].map(([y, o]) => <line key={`l${y}`} x1={x0} y1={y} x2={x1} y2={y} stroke="#fff" strokeOpacity={o} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        <line x1={x0} y1={36} x2={x1} y2={36} stroke="#ff9d8f" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
        <line x1={x0} y1={62} x2={x1} y2={62} stroke="#fff" strokeOpacity={0.75} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        {/* the whole letter, faint — its join to the next letter is no part of it */}
        {strokes.map((s, i) => <path key={`w${i}`} d={s.d} fill="none" stroke="#fff" strokeOpacity={0.14} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />)}
        {parts.map((p, i) => (on.has(i)
          ? <path key={`p${i}`} d={p.d} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" className="p2-partpad-ink" />
          : <path key={`p${i}`} d={p.d} fill="none" stroke={COLORS[i % COLORS.length]} strokeOpacity={0.45} strokeWidth={3.2} strokeDasharray="0.1 7" strokeLinecap="round" strokeLinejoin="round" />))}
        {parts.map((p, i) => p.start && (
          <g key={`d${i}`} transform={`translate(${p.start[0]} ${p.start[1]})`} className="p2-partpad-dot" pointerEvents="none">
            <circle r={7.5} fill={on.has(i) ? COLORS[i % COLORS.length] : "#123530"} stroke={on.has(i) ? "#fff" : COLORS[i % COLORS.length]} strokeWidth={1.8} />
            <text y={3.3} textAnchor="middle" fontSize={9.5} fontWeight={800} fontFamily="Nunito, system-ui, sans-serif" fill={on.has(i) ? "#123530" : COLORS[i % COLORS.length]}>{i + 1}</text>
          </g>
        ))}
        {parts.map((p, i) => (
          <path key={`h${i}`} d={p.d} fill="none" stroke="transparent" strokeWidth={20} strokeLinecap="round" className="p2-partpad-hit" role="button" tabIndex={0}
            aria-label={`Часть ${i + 1}: ${on.has(i) ? "пишем" : "не пишем"}`} aria-pressed={on.has(i)} onClick={() => onToggle(i)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(i); } }} />
        ))}
      </g>
      {/* the rulers: a tick every 5 units, longer every 25 */}
      <rect x={x0} y={Y0} width={w} height={RULER} fill="#0d2925" />
      <rect x={x0} y={Y0} width={RULER} height={h} fill="#0d2925" />
      {tickX.map((x) => <line key={`tx${x}`} x1={x} y1={Y0 + RULER} x2={x} y2={Y0 + RULER - (x % 25 === 0 ? 7 : 3.5)} stroke="#9fd8cc" strokeOpacity={x % 25 === 0 ? 0.9 : 0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      {tickY.map((y) => <line key={`ty${y}`} x1={x0 + RULER} y1={y} x2={x0 + RULER - (y % 25 === 0 ? 7 : 3.5)} y2={y} stroke="#9fd8cc" strokeOpacity={y % 25 === 0 ? 0.9 : 0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      {/* the copybook's lines marked on the left ruler, in gold */}
      {LINES.map((y) => <path key={`m${y}`} d={`M ${x0 + RULER} ${y} l -6 -3.5 v 7 z`} fill="#ffd27a" />)}
      <rect x={x0} y={Y0} width={RULER} height={RULER} fill="#0a211e" />
      <rect x={x0 + 0.5} y={Y0 + 0.5} width={w - 1} height={h - 1} rx={9} fill="none" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
