// Coordinate system (viewBox 80×120):
//  y=0            top padding
//  y=WT (50) ─── top of рабочая строка  (x-height line)
//  y=BL (85) ─── baseline
//  y=120          bottom (descender zone)
//
// FS=64 targets Primo's x-height ≈ BL-WT (x-height ≈ 55 % of em).
// Tune FS / BL / WT if the letter doesn't fill the strip correctly.

const VB_W = 80;
const VB_H = 120;
const FS   = 64;   // font-size in SVG units
const BL   = 85;   // baseline y
const WT   = 50;   // top of рабочая строка

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

      {/* letter anchored on baseline */}
      <text
        x={VB_W / 2}
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
