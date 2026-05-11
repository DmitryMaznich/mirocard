// Puzzle piece geometry and SVG primitive
//
// Body:  110 × 70 px
// Tab:   protrudes 16 px to the RIGHT  (cubic bezier, y 22–48)
// Notch: concave indentation from LEFT, 16 px inward (y 22–48)
//
// Row interlocking:
//   cells have width=110, gap=0, overflow:visible
//   tab of piece N extends into piece N+1's space
//   piece N+1 has higher z-index → covers N's tab everywhere
//   EXCEPT the notch region (no fill there) → N's tab shows through = locked

export const BODY_W = 110;
export const BODY_H = 70;
const TAB_R  = 16;
const TAB_Y1 = 22;
const TAB_Y2 = 48;

export const PIECE_COLORS = {
  subject:   { fill: "#dbeafe", stroke: "#4a90d9", text: "#1a5ca8" },
  verb:      { fill: "#d1fae5", stroke: "#4a9b8f", text: "#1b6b62" },
  adjective: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
  object:    { fill: "#ede9fe", stroke: "#8b5cf6", text: "#4c1d95" },
};

const SLOT_LABELS = {
  subject:   "КТО?",
  verb:      "ЧТО ДЕЛАЕТ?",
  adjective: "КАКУЮ?",
  object:    "ЧТО?",
};

// Returns { left: "flat"|"notch", right: "flat"|"tab" }
export function getPieceConnectors(slotType, structure) {
  const left  = slotType === "subject" ? "flat" : "notch";
  const right = (slotType === "object" || (structure === "simple" && slotType === "verb"))
    ? "flat"
    : "tab";
  return { left, right };
}

// Clockwise SVG path: top → right side → bottom → left side
export function buildPiecePath(left, right) {
  const W = BODY_W, H = BODY_H, R = TAB_R, Y1 = TAB_Y1, Y2 = TAB_Y2;

  let d = `M 0,0 L ${W},0 `;

  if (right === "tab") {
    // Cubic bezier: bulge right to x = W+R
    d += `L ${W},${Y1} C ${W + R},${Y1} ${W + R},${Y2} ${W},${Y2} `;
  }
  d += `L ${W},${H} L 0,${H} `;

  if (left === "notch") {
    // Cubic bezier: curve inward (toward +x) — creates concave cutout
    d += `L 0,${Y2} C ${R},${Y2} ${R},${Y1} 0,${Y1} `;
  }

  d += "Z";
  return d;
}

// Shared SVG puzzle piece — used by slots (row) and cards (pool + overlay)
export default function PuzzlePieceSvg({
  slotType,
  structure,
  emoji,
  label,
  isEmpty,
  isOver = false,
}) {
  const { left, right } = getPieceConnectors(slotType, structure);
  const path   = buildPiecePath(left, right);
  const colors = PIECE_COLORS[slotType] ?? PIECE_COLORS.subject;

  const fill        = isEmpty ? (isOver ? "#e8f0fe" : "#f9fafb")   : colors.fill;
  const stroke      = isEmpty ? (isOver ? colors.stroke : "#d1d5db") : colors.stroke;
  const strokeDash  = isEmpty ? "6 4" : undefined;

  // Horizontal center of body (tab/notch are visual decoration, not text area)
  const cx = BODY_W / 2;

  return (
    <svg
      width={BODY_W}
      height={BODY_H}
      viewBox={`0 0 ${BODY_W} ${BODY_H}`}
      style={{ overflow: "visible", display: "block", flexShrink: 0 }}
    >
      <path
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        strokeDasharray={strokeDash}
      />

      {isEmpty ? (
        <text
          x={cx} y={BODY_H / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fontWeight="700"
          fill={stroke}
          opacity="0.75"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {SLOT_LABELS[slotType]}
        </text>
      ) : (
        <>
          <text
            x={cx} y={BODY_H * 0.37}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="22"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {emoji}
          </text>
          <text
            x={cx} y={BODY_H * 0.77}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="13"
            fontWeight="600"
            fill={colors.text}
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {label}
          </text>
        </>
      )}
    </svg>
  );
}
