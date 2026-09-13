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
// UNIT_H apart double-allocates ascender/descender headroom every row already
// reserves on its own, which was the original "extra blank ruled line between
// every text line" bug (reported 2026-08-19).
//
// Set to the SAME real "косая линейка" cycle the print notebooks already use
// (scripts/propis_worksheets/page.py's ROW_CYCLE_MM=12mm, at this app's own
// 150-units-per-25mm native scale: 12mm * 150/25 = 72 units) -- not an
// independently-chosen value. A first attempt (100 units, sized only off the
// bare ascender+descender minimum) got flagged 2026-08-19 as "сделал левую
// сетку": at 100, the OLD 4-line-per-row guide set (NATIVE_L1..L4, spanning
// 130 units) no longer fit inside one row's own pitch, so consecutive rows'
// guide lines interleaved out of order instead of tiling as clean parallel
// lines. 72 fixes that by pairing with a 2-line-per-cycle guide set (see
// GUIDE_ROW_LINES in WriteTextView.jsx/ReadTextView.jsx: one thin line
// NARROW_MM above each baseline, one thick baseline line, exactly mirroring
// page.py's own NARROW_MM/WIDE_MM alternation) instead of 4 -- the same cycle
// already verified against every captured letter's real ink bounds for the
// print pipeline (max ascender "Й" 59.3 units, max descender "р" 21.2 units,
// measured 2026-08-19), so no separate re-validation was needed here.
export const TEXT_ROW_PITCH = 72;

// The print notebooks' own NARROW_MM (4mm, x-height zone) converted to this
// app's native units (4mm * 150/25 = 24) -- how far above each baseline the
// cycle's thin line sits. WIDE_MM (8mm = 48 units) is implied, not a separate
// constant: it's simply whatever's left going up from the thin line to the
// NEXT row's baseline (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET = 72 - 24 = 48),
// same arithmetic as page.py's WIDE_MM.
export const TEXT_ROW_THIN_OFFSET = 24;

// Standard 20mm diagonal spacing ("стандарт российских школ", same as
// DIAGONAL_MM above and the print notebooks), converted to native units so
// WriteTextView.jsx/ReadTextView.jsx can draw them directly in the same
// coordinate space as everything else in their SVG (20mm * 150/25 = 120).
export const TEXT_ROW_DIAGONAL_SPACING = (DIAGONAL_MM * UNIT_H) / LINE_MM;

// mm -> this file's native units, same scale every other constant above uses
// (150 units per 25mm). Exported so callers building print-page geometry (only
// PrintPageView.jsx today) don't hand-roll the conversion.
export const mmToNativeUnits = (mm) => (mm * UNIT_H) / LINE_MM;

// Real print-page geometry for the "Тетрадный лист" (read_lines/print_page) mode --
// one physical A4-landscape sheet (297x210mm) split into two A5-proportioned (148.5x210mm)
// slots, EXACTLY the geometry scripts/propis_worksheets/propis_ruling.py (the actual PDF
// ruling) and page.py (the letter-worksheets content overlay) already use -- not
// independently chosen. Added 2026-09-13 so the on-screen "Тетрадный лист" mode's page
// count/row count is real print geometry, not an arbitrary on-screen fit, per the user's
// explicit goal: "мы должны получать ровно такой же PDF, только с набранными пользователем
// строками" (the eventual PDF export this same geometry drives, see PrintPageView.jsx).
export const PRINT_PAGE_W_MM = 148.5;
export const PRINT_PAGE_H_MM = 210;
export const PRINT_MARGIN_MM = 15; // red margin line, from the page's own OUTER edge
// Content insets mirror page.py's LEFT_INSET_MM/CENTER_INSET_MM exactly: a "left slot"
// page's content hugs its own red margin line (2mm past it); a "right slot" page's content
// hugs the OTHER edge instead (2mm in from what would be the booklet's center divider),
// leaving extra breathing room before ITS OWN red line -- confirmed with the user
// 2026-08-15 for the print pipeline, reused here unchanged for the same visual (see
// page.py's own comment for the "why", specific to booklet fold/staple assembly).
export const PRINT_LEFT_INSET_MM = PRINT_MARGIN_MM + 2;
export const PRINT_CENTER_INSET_MM = 4;
export const PRINT_CONTENT_W_MM = PRINT_PAGE_W_MM - 2 * PRINT_MARGIN_MM; // 118.5mm
// First baseline's distance from the page TOP, and the baseline-to-baseline cycle.
// **NOT the same number as propis_ruling.py's own SHIFT_MM(-6)** — that script draws in
// reportlab's bottom-up frame (y=0 at the page's BOTTOM edge), so its -6mm phase shift does
// not translate directly to "6mm from the top". page.py's row_baselines() (bottom-up
// _thick_line_ys(), reversed) is the real ground truth for where content actually lands;
// converting its own output to a from-top distance gives baselines at 12, 24, ..., 204mm —
// i.e. row 0 sits 12mm from the top, not 6mm (bug found and fixed 2026-09-13: the on-screen
// page had this backwards — 6mm top / 12mm bottom gap instead of the real 12mm top / 6mm
// bottom — read as "too much empty space, especially at the bottom" against a real printed
// page). Re-derive with `scripts/propis_worksheets/page.py`'s own `_thick_line_ys()` logic
// (SHIFT_MM/NARROW_MM/WIDE_MM/PAGE_H_MM) before touching this number again — don't
// hand-convert propis_ruling.py's bottom-up SHIFT_MM a second time.
export const PRINT_FIRST_BASELINE_MM = 12;
// floor((210 - 12) / 12) + 1 = 17 -- matches propis_worksheets/page.py's own row_baselines()
// count exactly (still 17 with the corrected first-baseline offset above).
export const PRINT_ROWS_PER_PAGE = 17;

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
