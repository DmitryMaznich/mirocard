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

// The coordinate system every captured letter/connector's own stroke data is drawn in —
// same as handwriting_capture.html's canvas/drawRuling() (viewBox "0 0 100 150"). NOT the
// same system as this file's own L1-L4 above (see note in the implementation plan this
// was introduced from — docs/superpowers/plans/2026-08-07-propis-word-writing.md). Kept
// under a NATIVE_ prefix specifically so the two can never be accidentally interchanged.
export const NATIVE_L1 = 10;         // row top
export const NATIVE_TOP_MID = 36;    // tall ascenders (Й,Г,П,Н...) top out here
export const NATIVE_L2 = 62;         // x-height top / top of узкая строка
export const NATIVE_NARROW_MID = 75; // vertical center of узкая строка — most letters' own start/end point
export const NATIVE_L3 = 88;         // baseline (bold) — same value as LETTER_BASELINE_UNIT above
export const NATIVE_BOT_MID = 110;   // real descenders are shallower than ascenders are tall, not simply symmetric
export const NATIVE_L4 = 140;        // row bottom

// The same 7 numbered ruling lines shown in handwriting_capture.html's drawRuling(), in
// the same top-to-bottom numbering (1-7) — the shared vocabulary a letter's entry/exit
// line and a connector's fromLine/toLine are expressed in. Keep this in sync by hand with
// drawRuling()'s H_GUIDES array if either ever changes.
export const GUIDE_LINES = [
  { line: 1, y: NATIVE_L1 },
  { line: 2, y: NATIVE_TOP_MID },
  { line: 3, y: NATIVE_L2 },
  { line: 4, y: NATIVE_NARROW_MID },
  { line: 5, y: NATIVE_L3 },
  { line: 6, y: NATIVE_BOT_MID },
  { line: 7, y: NATIVE_L4 },
];

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

// Baseline-to-baseline distance for MULTI-LINE text flow (WriteTextView.jsx,
// ReadTextView.jsx) -- NOT the same as UNIT_H (150), which is the full
// ascender+x-height+descender allocation a single ISOLATED letter/word card
// needs (PropisPracticeView, WordAnimatedCard). Tiling multiple rows a full
// UNIT_H apart double-allocates: each row already reserves its OWN 59.3-unit
// ascender headroom and 21.2-unit descender depth (real max across every
// captured letter -- "Й" and "р" respectively, measured 2026-08-19 against
// the real capture data, not the nominal NATIVE_L1/L4 guide lines), so two
// adjacent rows never need more than 59.3 + 21.2 = 80.5 units apart -- UNIT_H
// leaves ~70 units (46%) of dead space between every pair of written lines,
// which is the "extra blank ruled line between every text line" bug reported
// 2026-08-19 (present in WriteTextView.jsx too -- ReadTextView.jsx just
// inherited it verbatim). 100 keeps ~20 units of buffer over the bare
// 80.5-unit minimum -- comfortably real-notebook-dense without the tallest
// letter of one line ever touching the deepest letter of the next.
export const TEXT_ROW_PITCH = 100;

export const INK_COLOR = "#1d4ed8";
export const NIB_COLOR = "#fbbf24";
// Quartered (not just halved) for the same reason the ruling stroke-widths are:
// PropisPracticeView's 2x crop zoom already doubles on-screen thickness by itself,
// so this needs to be a quarter of the original to land at half the original on screen.
export const STROKE_W  = 2;
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
