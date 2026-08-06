// Real Russian school "пропись" geometry, shared by every propis view.
// One row, top to bottom: надстрочная зона (N) | узкая строка (N) | широкая строка (2N) |
// подстрочная зона (N) — N = 5mm, so one full row = 5+5+10+5 = 25mm. Letters are still
// rendered in their own 150-unit box scaled uniformly to LINE_MM (matching
// written_letters/letterPaths.js, tools/letter_capture) — their baked-in baseline
// (unit 88/150) does not land exactly on L3 under these proportions.
export const UNIT_H = 150;

// Zone heights in mm, top to bottom: надстрочная(N) | узкая(N) | широкая(2N) | подстрочная(N).
const N = 5;
const NADSTROCHNAYA_MM = N;
const UZKAYA_MM         = N;
const SHIROKAYA_MM      = 2 * N;
const PODSTROCHNAYA_MM  = N;
export const LINE_MM = NADSTROCHNAYA_MM + UZKAYA_MM + SHIROKAYA_MM + PODSTROCHNAYA_MM; // 25mm

// Cumulative zone boundaries, expressed as "units" out of UNIT_H (same convention L1-L4
// always used) so the rest of the ruling/letter-scaling code doesn't need to change.
const mmToUnit = (mm) => (mm / LINE_MM) * UNIT_H;
export const L1 = mmToUnit(NADSTROCHNAYA_MM);                                    // end of надстрочная
export const L2 = mmToUnit(NADSTROCHNAYA_MM + UZKAYA_MM);                        // end of узкая
export const L3 = mmToUnit(NADSTROCHNAYA_MM + UZKAYA_MM + SHIROKAYA_MM);         // end of широкая (baseline, bold)
export const L4 = mmToUnit(NADSTROCHNAYA_MM + UZKAYA_MM + SHIROKAYA_MM + PODSTROCHNAYA_MM); // row bottom
export const DIAGONAL_MM = 20; // "стандарт российских школ"
export const ANGLE_FROM_HORIZONTAL_DEG = 65;

// The baseline every captured letter's own path data was extracted/drawn against (the
// original "2:1:2" font-formation system, written_letters/letterPaths.js, tools/letter_capture).
// This is a property of the LETTER data, not the ruling — L3 above is the ruling's own
// (now different) baseline guide position. LoopingLetterCell re-anchors letters onto L3
// using this constant, instead of relying on their baked-in position lining up with it.
export const LETTER_BASELINE_UNIT = 88;

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
