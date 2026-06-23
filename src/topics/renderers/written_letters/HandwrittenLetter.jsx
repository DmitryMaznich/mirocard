// 4-line propis coordinate system (viewBox 90×120):
//
//  y=L1  (6)  ──── верхняя зона top      (ascenders / capitals)
//                  upper zone = 38 SVG units
//  y=L2 (44)  ──── рабочая строка top    (x-height line)
//                  рабочая строка = 38 SVG units  ← regular lowercase lives here
//  y=L3 (82)  ──── baseline
//                  lower zone = 30 SVG units
//  y=L4 (112) ──── нижняя зона bottom    (р, у, ц, щ, з, д, ф)
//
// VB_W=90 gives extra horizontal room to prevent right-edge clipping on
// wide cursive glyphs (Ш, Щ, Ю, М …).
// TX=43 shifts text anchor 2 units left of centre (VB_W/2=45) to compensate
// for Primo's rightward lean, so the letter looks centred in the card.
//
// If the letter top doesn't reach L2, increase FS. If it clips above L2, reduce it.

const VB_W = 90;
const VB_H = 120;

const L1 = 6;    // upper zone top
const L2 = 44;   // рабочая строка top  (x-height)
const L3 = 82;   // baseline
const L4 = 112;  // lower zone bottom

const FS = 65;   // font-size — targets x-height ≈ L2–L3 = 38 SVG units
const TX = 43;   // text anchor x

const C_BG    = "#fefef6";
const C_ZONE  = "rgba(205,232,245,0.45)";
const C_OUTER = "#c5e2f2";  // L1 / L4  — outer zone lines (lighter)
const C_L2    = "#9ecde8";  // L2       — x-height line
const C_L3    = "#5bafd0";  // L3       — baseline (darkest)
const C_FONT  = "#1d4ed8";

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
      {/* cream background */}
      <rect x={0} y={0} width={VB_W} height={VB_H} fill={C_BG} />

      {/* upper zone tint: L1 → L2  (ascenders / capitals) */}
      <rect x={0} y={L1} width={VB_W} height={L2 - L1} fill={C_ZONE} />

      {/* lower zone tint: L3 → L4  (descenders) */}
      <rect x={0} y={L3} width={VB_W} height={L4 - L3} fill={C_ZONE} />

      {/* Line 1 — upper zone top */}
      <line x1={0} y1={L1} x2={VB_W} y2={L1} stroke={C_OUTER} strokeWidth={1.0} />

      {/* Line 2 — рабочая строка top (x-height) */}
      <line x1={0} y1={L2} x2={VB_W} y2={L2} stroke={C_L2}   strokeWidth={1.4} />

      {/* Line 3 — baseline */}
      <line x1={0} y1={L3} x2={VB_W} y2={L3} stroke={C_L3}   strokeWidth={1.8} />

      {/* Line 4 — lower zone bottom */}
      <line x1={0} y1={L4} x2={VB_W} y2={L4} stroke={C_OUTER} strokeWidth={1.0} />

      {/* letter anchored on baseline */}
      <text
        x={TX}
        y={L3}
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
