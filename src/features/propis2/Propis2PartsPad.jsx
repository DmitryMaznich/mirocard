import { useMemo } from "react";
import { layoutWideLinesIntoRows } from "@/handwriting/wordEngine.js";
import { letterPieces, ownStrokes, splitIntoParts } from "@/handwriting/letterParts.js";
import { getPathEndpoints, samplePath, toCubicPathD } from "@/handwriting/pathGeometry.js";

// «Что пишем» / «Штрихи» (owner, 2026-11-21): the letter of a row with its parts to tap, on a white «cutting mat» with rulers and the
// copybook row's own lines. The letter is laid out by the engine exactly as the row writes it — fitted to the lines, stretched, slanted, its
// stems on the slant lines — in the row's own units (baseline 64, small letters 16…64, capitals from -32, tails to 112); every part has a
// colour and a numbered dot where the pen starts it; a part not written stays as a dotted trace of its colour, to be tapped back. No captions.
const COLORS = ["#f59e0b", "#2b8be0", "#ec5547", "#37a64a", "#8b5cf6", "#e3559c", "#0f9f91", "#c08a00"];
const BASE = 64, ZONE = 48; // the engine's row: baseline, small-letter height (wordEngine WIDE_BASELINE_Y, WIDE_ZONE_UNITS)
const LINES = { cap: BASE - 2 * ZONE, top: BASE - ZONE, mid: BASE - ZONE / 2, base: BASE, low: BASE + ZONE };
const Y0 = LINES.cap - 26, Y1 = LINES.low + 18; // the mat, top to bottom
const RULER = 12; // the rulers along the top and the left edge
const SLANT = Math.tan((25 * Math.PI) / 180); // the copybook slant: 65° from the horizontal
const CELL = 30; // the slant lines' step in the row (wordEngine CELL at scale 1)
const PX = 1.4; // px per row unit
// the row's slant grid: x of slant line k at height y, and the nearest line to a point (the engine's snap)
const slantX = (k, y) => k * CELL + (BASE - y) * SLANT;
const snapToSlant = (_r, x, y = BASE) => { const off = (BASE - y) * SLANT; return Math.round((x - off) / CELL) * CELL + off; };
const startOf = (d) => getPathEndpoints(d).start;

export default function Propis2PartsPad({ glyph, text, map, keep, onToggle }) {
  const lay = useMemo(() => {
    // the letter as the row places it; a letter the row writes in other strokes than its glyph's — the raw glyph, as before
    let placed = null;
    try {
      const seg = layoutWideLinesIntoRows([`${text}#1#c`], map, snapToSlant).placed[0]?.segments?.[0];
      const st = (seg?.strokes ?? []).filter((s) => !s.dashed && !s.join);
      // (a letter alone has no join: its exit stroke — `tailStroke`, б Б Г Р Ф Э Ю — is left out by the row)
      if (st.length === glyph.strokes.length || st.length === ownStrokes(glyph).length) placed = st;
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
    const mid = (minX + maxX) / 2, half = Math.max(66, (maxX - minX) / 2 + 30);
    return { strokes, parts, x0: mid - half - RULER, x1: mid + half };
  }, [glyph, text, map]);

  const { strokes, parts, x0, x1 } = lay;
  const w = x1 - x0, h = Y1 - Y0;
  const on = new Set(keep);
  const tickX = [];
  for (let x = Math.ceil((x0 + RULER) / 5) * 5; x < x1; x += 5) tickX.push(x);
  const tickY = [];
  for (let y = Math.ceil((Y0 + RULER) / 4) * 4; y < Y1; y += 4) tickY.push(y);
  const ks = [];
  for (let k = Math.floor((x0 - (BASE - Y1) * SLANT) / CELL) - 1; slantX(k, Y1) < x1 + CELL; k += 1) ks.push(k);
  const id = `p2pp-${glyph.label.codePointAt(0)}`;
  const hl = (y, props) => <line x1={x0} y1={y} x2={x1} y2={y} vectorEffect="non-scaling-stroke" {...props} />;
  return (
    <svg className="p2-partpad" viewBox={`${x0} ${Y0} ${w} ${h}`} width={Math.round(w * PX)} height={Math.round(h * PX)}
      aria-label={`Буква ${glyph.label}: нажмите на штрих, чтобы писать или не писать его`}>
      <defs>
        <clipPath id={`${id}-c`}><rect x={x0 + RULER} y={Y0 + RULER} width={w - RULER} height={h - RULER} /></clipPath>
        <pattern id={`${id}-dots`} width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="0.55" fill="#9aa6b2" fillOpacity="0.45" /></pattern>
      </defs>
      <rect x={x0} y={Y0} width={w} height={h} rx={8} fill="#fbfbf9" />
      <rect x={x0} y={Y0} width={w} height={h} rx={8} fill={`url(#${id}-dots)`} />
      <g clipPath={`url(#${id}-c)`}>
        {ks.map((k) => <line key={`s${k}`} x1={slantX(k, Y1)} y1={Y1} x2={slantX(k, Y0)} y2={Y0} stroke="#93a3b5" strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {/* the row's lines as on the sheet: the capitals' dashed line, the top of the small letters, the dashed middle, the bold baseline, the tails' dashed line */}
        {hl(LINES.cap, { stroke: "#e57d7a", strokeWidth: 1, strokeDasharray: "4 3" })}
        {hl(LINES.top, { stroke: "#55606c", strokeWidth: 1.2 })}
        {hl(LINES.mid, { stroke: "#e57d7a", strokeWidth: 1, strokeDasharray: "4 3" })}
        {hl(LINES.base, { stroke: "#2f3842", strokeWidth: 2 })}
        {hl(LINES.low, { stroke: "#e57d7a", strokeWidth: 1, strokeDasharray: "4 3" })}
        {/* the whole letter, faint — its join to the next letter is no part of it */}
        {strokes.map((st, i) => <path key={`w${i}`} d={st.d} fill="none" stroke="#1f2a37" strokeOpacity={0.1} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />)}
        {parts.map((p, i) => (on.has(i)
          ? <path key={`p${i}`} d={p.d} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" className="p2-partpad-ink" />
          : <path key={`p${i}`} d={p.d} fill="none" stroke={COLORS[i % COLORS.length]} strokeOpacity={0.55} strokeWidth={3} strokeDasharray="0.1 6.5" strokeLinecap="round" strokeLinejoin="round" />))}
        {parts.map((p, i) => p.start && (
          <g key={`d${i}`} transform={`translate(${p.start[0]} ${p.start[1]})`} className="p2-partpad-dot" pointerEvents="none">
            <circle r={7.2} fill={on.has(i) ? COLORS[i % COLORS.length] : "#fff"} stroke={on.has(i) ? "#fff" : COLORS[i % COLORS.length]} strokeWidth={1.8} />
            <text y={3.3} textAnchor="middle" fontSize={9.5} fontWeight={800} fontFamily="Nunito, system-ui, sans-serif" fill={on.has(i) ? "#fff" : COLORS[i % COLORS.length]}>{i + 1}</text>
          </g>
        ))}
        {parts.map((p, i) => (
          <path key={`h${i}`} d={p.d} fill="none" stroke="transparent" strokeWidth={20} strokeLinecap="round" className="p2-partpad-hit" role="button" tabIndex={0}
            aria-label={`Часть ${i + 1}: ${on.has(i) ? "пишем" : "не пишем"}`} aria-pressed={on.has(i)} onClick={() => onToggle(i)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(i); } }} />
        ))}
      </g>
      {/* the rulers: ticks every 5 (across) / 4 (down) units, longer every fifth; the row's lines marked on the left one */}
      <rect x={x0} y={Y0} width={w} height={RULER} fill="#eef0ec" />
      <rect x={x0} y={Y0} width={RULER} height={h} fill="#eef0ec" />
      {tickX.map((x, i) => <line key={`tx${x}`} x1={x} y1={Y0 + RULER} x2={x} y2={Y0 + RULER - (Math.round(x / 5) % 5 === 0 ? 6 : 3)} stroke="#6b7682" strokeWidth={1} vectorEffect="non-scaling-stroke" data-i={i} />)}
      {tickY.map((y) => <line key={`ty${y}`} x1={x0 + RULER} y1={y} x2={x0 + RULER - (Math.round(y / 4) % 5 === 0 ? 6 : 3)} y2={y} stroke="#6b7682" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      {Object.values(LINES).map((y) => <path key={`m${y}`} d={`M ${x0 + RULER} ${y} l -5.5 -3.2 v 6.4 z`} fill={y === BASE ? "#2f3842" : "#e57d7a"} />)}
      <line x1={x0 + RULER} y1={Y0} x2={x0 + RULER} y2={Y1} stroke="#c9cfc8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line x1={x0} y1={Y0 + RULER} x2={x1} y2={Y0 + RULER} stroke="#c9cfc8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <rect x={x0 + 0.5} y={Y0 + 0.5} width={w - 1} height={h - 1} rx={8} fill="none" stroke="#d5dad3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
