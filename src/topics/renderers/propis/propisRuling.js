// Real Russian school "пропись" geometry, shared by every propis view.
// The vertical ruling per row is the actual letter-formation "2:1:2" system every
// captured letter is drawn against (written_letters/letterPaths.js, tools/letter_capture):
// a 150-unit cell with guides at L1=10, L2=62, L3=88 (baseline, bold), L4=140.
export const UNIT_H = 150;
export const L1 = 10, L2 = 62, L3 = 88, L4 = 140; // propis 2:1:2
export const LINE_MM = 12; // one working row, real-world height (Russian school standard)
export const DIAGONAL_MM = 20; // "стандарт российских школ"
export const ANGLE_FROM_HORIZONTAL_DEG = 65;

export const INK_COLOR = "#1d4ed8";
export const NIB_COLOR = "#fbbf24";
// Quartered (not just halved) for the same reason the ruling stroke-widths are:
// PropisPracticeView's 2x crop zoom already doubles on-screen thickness by itself,
// so this needs to be a quarter of the original to land at half the original on screen.
export const STROKE_W  = 2;
export const TIP_R     = 1.125;
export const SPEED     = 48; // font-units/sec — gentle pace for a continuously looping demo

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// One row's L1/L2/L3(bold baseline)/L4 guides, tiled `rowCount` times, in mm.
export function buildRowGuideLines(rowCount) {
  const toMm = (u) => (u / UNIT_H) * LINE_MM;
  const guides = [
    { u: L1, bold: false },
    { u: L2, bold: false },
    { u: L3, bold: true }, // baseline
    { u: L4, bold: false },
  ];
  const lines = [];
  for (let row = 0; row < rowCount; row++) {
    for (const g of guides) lines.push({ y: row * LINE_MM + toMm(g.u), bold: g.bold });
  }
  return lines;
}

// 65°-from-horizontal diagonal guides, covering `widthMm` at `heightMm` tall. Spaced every
// real 20mm by default; callers cropped much narrower than that (e.g. a zoomed single-letter
// card) should pass a smaller `spacingMm`, or the real spacing can fall entirely between two
// lines and never land inside such a narrow strip at all.
export function buildDiagonalLines(heightMm, widthMm, spacingMm = DIAGONAL_MM) {
  const angleRad = ((90 - ANGLE_FROM_HORIZONTAL_DEG) * Math.PI) / 180;
  const dx = heightMm * Math.tan(angleRad);
  const lines = [];
  // Callers draw these as (x1,y=0 top) -> (x2,y=heightMm bottom). Cyrillic cursive leans
  // right — a "/" shape, top further right than bottom — so x1 (top) must be the larger
  // value. The reference PDF script computed this in bottom-up PDF coordinates; naively
  // reusing its (x, x+dx) pair for SVG's top-down y axis mirrors the slant, hence the swap.
  for (let x = -dx; x < widthMm + dx; x += spacingMm) {
    lines.push({ x1: x + dx, x2: x });
  }
  return lines;
}
