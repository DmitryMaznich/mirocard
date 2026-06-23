// Coordinate system (viewBox 80×120):
//  y=0            top padding
//  y=WT (50) ─── top of рабочая строка  (x-height line)
//  y=BL (85) ─── baseline
//  y=120          bottom (descender zone)
//
// FS=56: slightly smaller than 64 to avoid right-side clipping on wide cursive
// glyphs (Ш, Щ, М, Ю, etc.).  TX shifts the anchor 4 units left of centre so
// the rightward lean of Primo doesn't push strokes past the viewBox edge.

const VB_W = 80;
const VB_H = 120;
const FS   = 56;   // font-size in SVG units (was 64; reduced to prevent clipping)
const BL   = 85;   // baseline y
const WT   = 50;   // top of рабочая строка
const TX   = 36;   // text anchor x (centre-of-card shifted 4 units left for cursive lean)

const C_BG   = "#fefef6";
const C_ZONE = "rgba(205,232,245,0.45)";   // upper / lower zone tint
const C_TOP  = "#9ecde8";                   // x-height line colour
const C_BASE = "#5bafd0";                   // baseline colour (darker)
const C_FONT = "#1d4ed8";                   // letter colour

export default function HandwrittenLetter({ letter, size = 100, className = "" }) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={size}
      height={Math.round(size * VB_H / VB_W)}
      className={className}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <rect x={0} y={0} width={VB_W} height={VB_H} fill={C_BG} />

      {/* upper zone tint (ascenders / capitals) */}
      <rect x={0} y={0} width={VB_W} height={WT} fill={C_ZONE} />

      {/* lower zone tint (descenders) */}
      <rect x={0} y={BL} width={VB_W} height={VB_H - BL} fill={C_ZONE} />

      {/* x-height line — top of рабочая строка */}
      <line x1={0} y1={WT} x2={VB_W} y2={WT} stroke={C_TOP}  strokeWidth={1.2} />

      {/* baseline */}
      <line x1={0} y1={BL} x2={VB_W} y2={BL} stroke={C_BASE} strokeWidth={1.8} />

      {/* letter anchored on baseline; TX shifted left so cursive lean stays within viewBox */}
      <text
        x={TX}
        y={BL}
        textAnchor="middle"
        fontFamily="Primo, cursive"
        fontSize={FS}
        fill={C_FONT}
      >
        {letter}
      </text>
    </svg>
  );
}
