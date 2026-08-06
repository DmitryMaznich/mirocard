// Real Russian school "пропись" geometry, shared by every propis view.
// One row is 4 lines bounding 3 gaps, top to bottom: line, 10mm, line, 5mm ("узкая
// строка"), line, 10mm, line. The baseline is the line at the BOTTOM of the 5mm узкая
// строка gap — that's where every letter starts being written. No margin before the
// first line or after the last — the row is exactly bounded by them.
export const UNIT_H = 150;

const ASCENDER_GAP_MM  = 10; // row top -> x-height top
const NARROW_GAP_MM    = 5;  // узкая строка: x-height top -> baseline
const DESCENDER_GAP_MM = 10; // baseline -> row bottom
export const LINE_MM = ASCENDER_GAP_MM + NARROW_GAP_MM + DESCENDER_GAP_MM; // 25mm

// Cumulative line positions, expressed as "units" out of UNIT_H (same convention L1-L4
// always used) so the rest of the ruling/letter-scaling code doesn't need to change.
const mmToUnit = (mm) => (mm / LINE_MM) * UNIT_H;
export const L1 = mmToUnit(0);                                                   // row top
export const L2 = mmToUnit(ASCENDER_GAP_MM);                                     // x-height top
export const L3 = mmToUnit(ASCENDER_GAP_MM + NARROW_GAP_MM);                     // baseline (bold)
export const L4 = mmToUnit(ASCENDER_GAP_MM + NARROW_GAP_MM + DESCENDER_GAP_MM);  // row bottom
export const DIAGONAL_MM = 20; // "стандарт российских школ"
export const ANGLE_FROM_HORIZONTAL_DEG = 65;

// The baseline every captured letter's own path data was extracted/drawn against (the
// original "2:1:2" font-formation system, written_letters/letterPaths.js, tools/letter_capture).
// This is a property of the LETTER data, not the ruling — L3 above is the ruling's own
// (now different) baseline guide position. LoopingLetterCell re-anchors letters onto L3
// using this constant, instead of relying on their baked-in position lining up with it.
export const LETTER_BASELINE_UNIT = 88;

// The letter's own x-height span in that same native system: L2=62 to L3=88 = 26 units —
// i.e. the height of the letter's main body, excluding ascenders/descenders. Used to scale
// letters so this span matches the ruling's узкая строка exactly, instead of naively scaling
// the whole 150-unit box to the whole row height (which underscales the body since a
// letter's ascenders/descenders eat into that 150 units too).
export const LETTER_XHEIGHT_UNIT_SPAN = 88 - 62;

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
