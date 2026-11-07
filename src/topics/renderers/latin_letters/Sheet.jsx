import { CELL_MM, PAD_MM, shapeText } from "./model";

// One printable sheet of a «Латиница» notebook, drawn as ONE SVG in millimetres (viewBox = the
// printable area). The same drawing is the page on the canvas, the thumbnail and the PDF: the app's
// PDF maker (src/features/printLetters/printLettersPdf.js, passed as `makePdf`) turns every <svg>
// inside a `.pl-sheet` into vector PDF, its <text> into outlines.

export const INK = "#1f3a8a";     // sample — prints near-black
export const GUIDE = "#8fa3c8";   // dashed trace — prints light grey
export const START = "#15803d";   // start dot: green = start here
export const NUM = "#b91c1c";     // stroke order numbers
const RULE = "#9aa9bd";
const BASE = "#5b6b82";
const GRID = "#c9d7ea";

const firstPoint = (d) => (d.match(/-?\d*\.?\d+/g) ?? [0, 0]).slice(0, 2).map(Number);

// One copy of a text at (x, y = top line), as SVG elements. `kind`: sample | trace | fade | dots | blank.
function TextCopy({ text, x, y, kind, opacity = 1, layout: L, numbers = false, color }) {
  if (kind === "blank") return null;
  const { style, k } = L;
  const shaped = shapeText(text, style).glyphs.map(({ ch, x: ux }) => ({ ch, g: style.glyphs[ch], ux }));
  const inkW = kind === "sample" ? 0.55 : 0.42; // mm
  const out = [];
  shaped.forEach(({ ch, g, ux: gx }, gi) => {
    const tx = x + gx * k;
    const key = `${gi}-${ch}`;
    const strokes = g.strokes;
    if (kind !== "dots") {
      out.push(
        <g key={key} transform={`translate(${tx} ${y}) scale(${k})`} opacity={kind === "fade" ? opacity : 1}>
          {strokes.map((st, si) => (st.dot
            ? <circle key={si} cx={firstPoint(st.d)[0]} cy={firstPoint(st.d)[1]} r={(inkW * 0.9) / k} fill={color ?? (kind === "trace" ? GUIDE : INK)} />
            : <path key={si} d={st.d} fill="none" stroke={color ?? (kind === "trace" ? GUIDE : INK)} strokeWidth={inkW / k}
                strokeLinecap="round" strokeLinejoin="round" strokeDasharray={kind === "trace" ? `${1.1 / k} ${0.9 / k}` : undefined} />))}
        </g>,
      );
    }
    if (kind === "sample" || kind === "trace" || kind === "dots") {
      // strokes that start at the same point share one dot; on the sample its numbers read «1,2»
      const starts = [];
      strokes.forEach((st, si) => {
        if (st.dot && kind !== "dots") return;
        const [px, py] = firstPoint(st.d);
        const same = starts.find((p) => Math.hypot(p.px - px, p.py - py) < 3);
        if (same) same.nums.push(si + 1);
        else starts.push({ px, py, nums: [si + 1] });
      });
      starts.forEach(({ px, py, nums }, i) => {
        const cx = tx + px * k, cy = y + py * k;
        if (!(kind === "sample" && !numbers)) out.push(<circle key={`${key}-s${i}`} cx={cx} cy={cy} r={0.6} fill={START} />);
        if (kind === "sample" && numbers) {
          const label = nums.join(",");
          out.push(<text key={`${key}-n${i}`} x={cx - 0.9 - 1.05 * label.length} y={cy - 0.8} fontSize={1.9} fontWeight={800} fill={NUM}>{label}</text>);
        }
      });
    }
  });
  return <>{out}</>;
}

function Ruling({ row, L }) {
  const { style, k } = L;
  const lv = style.ruling.levels;
  return style.ruling.lines.map((ln) => {
    const yy = row.y + (lv[ln.at] - lv.top) * k;
    return (
      <line key={ln.at} x1={row.x} x2={row.x + row.w} y1={yy} y2={yy}
        stroke={ln.bold ? BASE : RULE} strokeWidth={ln.bold ? 0.3 : 0.18}
        strokeDasharray={ln.dashed ? "1.2 1" : undefined} />
    );
  });
}

function Plate({ row, L }) {
  const { plate } = row;
  const pad = L.band;
  return (
    <>
      <rect x={row.x} y={row.y} width={plate.w} height={L.rowH} rx={1.6} fill={plate.color} />
      <TextCopy text={plate.label} x={row.x + pad} y={row.y} kind="sample" layout={L} color="#ffffff" />
    </>
  );
}

function Grid({ w, h }) {
  const lines = [];
  for (let x = 0; x <= w + 1e-6; x += CELL_MM) lines.push(<line key={`v${x}`} x1={x} x2={x} y1={0} y2={h} />);
  for (let y = 0; y <= h + 1e-6; y += CELL_MM) lines.push(<line key={`h${y}`} x1={0} x2={w} y1={y} y2={y} />);
  return <g stroke={GRID} strokeWidth={0.15}>{lines}</g>;
}

export default function Sheet({ nb, L, page, pageNo, selectedBlockId, onSelectBlock, className = "" }) {
  const { w, h } = L;
  const sel = selectedBlockId ? page.rows.filter((r) => r.blockId === selectedBlockId) : [];
  return (
    <div className={`pl-sheet ll-sheet ${className}`} style={{ aspectRatio: `${w} / ${h}` }}>
      <svg viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" className="ll-sheet-svg">
        <rect x={0} y={0} width={w} height={h} fill="#ffffff" />
        {nb.paper === "cell" && <Grid w={w} h={h} />}
        {nb.nameLine !== false && (
          <g>
            <text x={PAD_MM} y={PAD_MM + 5.2} fontSize={3.4} fontWeight={800} fill="#334155">{nb.title || "Тетрадь"}</text>
            <text x={w - PAD_MM - 62} y={PAD_MM + 5.2} fontSize={3} fontWeight={600} fill="#475569">Name</text>
            <line x1={w - PAD_MM - 52} x2={w - PAD_MM} y1={PAD_MM + 5.6} y2={PAD_MM + 5.6} stroke="#94a3b8" strokeWidth={0.25} />
          </g>
        )}
        {sel.length > 0 && (
          <rect x={sel[0].x - 1.5} y={sel[0].y - 1.5} width={sel[0].w + 3} height={sel[sel.length - 1].y - sel[0].y + L.rowH + 3}
            rx={2} fill="#4a9b8f" opacity={0.08} stroke="#4a9b8f" strokeWidth={0.4} />
        )}
        {page.rows.map((row) => (
          <g key={row.rowId} onClick={onSelectBlock ? () => onSelectBlock(row.blockId) : undefined} style={onSelectBlock ? { cursor: "pointer" } : undefined}>
            {onSelectBlock && <rect x={row.x} y={row.y - L.band / 2} width={row.w} height={L.rowH + L.band} fill="transparent" />}
            {nb.paper !== "cell" && <Ruling row={row} L={L} />}
            {row.plate && <Plate row={row} L={L} />}
            {row.copies.map((c, i) => (
              <TextCopy key={i} text={c.text} x={c.x} y={row.y} kind={c.kind} opacity={c.opacity} layout={L} numbers={c.kind === "sample" && row.copies.length > 0 && c.text.length <= 2} />
            ))}
          </g>
        ))}
        {pageNo != null && <text x={w / 2} y={h - 1.6} fontSize={2.6} fill="#94a3b8" textAnchor="middle">{pageNo}</text>}
      </svg>
    </div>
  );
}
