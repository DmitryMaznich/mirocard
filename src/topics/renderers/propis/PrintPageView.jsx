import { memo, useMemo, useState, useEffect, useRef, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { layoutTextIntoRows, layoutElementLinesIntoRows, layoutWideLinesIntoRows, WIDE_GRID_STRETCH, WIDE_ROW_MAX_X, paginateRows } from "./wordEngine.js";
import AnimatedStrokes from "./AnimatedStrokes.jsx";
import { BrandMarks, FoldLine, StapleMarks } from "./brandMarks.jsx";
import { bookletSheets } from "./booklet.js";
import {
  INK_COLOR, NATIVE_L3, TEXT_ROW_WIDE_DIAGONAL_SPACING,
  TEXT_ROW_PITCH, TEXT_ROW_THIN_OFFSET, TEXT_ROW_DIAGONAL_SPACING, TEXT_ROW_ELEMENT_DIAGONAL_SPACING,
  ANGLE_FROM_HORIZONTAL_DEG,
  buildDiagonalLines, mmToNativeUnits,
  PRINT_PAGE_W_MM, PRINT_PAGE_H_MM, PRINT_MARGIN_MM, PROPIS2_MARGIN_MM, propis2MarginUnits, PRINT_LEFT_INSET_MM, PRINT_CENTER_INSET_MM,
  PRINT_CONTENT_W_MM, PRINT_FIRST_BASELINE_MM, PRINT_ROWS_PER_PAGE,
} from "./propisRuling.js";

const PAGE_W_UNITS = mmToNativeUnits(PRINT_PAGE_W_MM);
const CONTENT_W_UNITS = mmToNativeUnits(PRINT_CONTENT_W_MM);

// Shifts row 0's baseline from wherever buildWordTrajectory's own native coordinate system
// bakes it (NATIVE_L3=88 — a property of the captured letter PATHS themselves, not of this
// page) down to the real print page's own first-baseline position (PRINT_FIRST_BASELINE_MM,
// 12mm from the physical top — see that constant's own comment for the reportlab bottom-up
// axis gotcha). Constant across every row —
// only the whole grid's vertical anchor moves, row-to-row spacing (TEXT_ROW_PITCH) doesn't.
const ROW_Y_SHIFT = NATIVE_L3 - mmToNativeUnits(PRINT_FIRST_BASELINE_MM);
const rowOriginY = (row) => row * TEXT_ROW_PITCH - ROW_Y_SHIFT;
// `propis2` narrow ruling (`narrow17`) starts at ruling row 0, so its first dashed line used to sit exactly on the page's cut edge (0 mm)
// while 6 mm stayed free under the last row (17 rows of 12 mm on a 210 mm page): the whole ruling and the writing move down 4.5 mm.
// The slant lines stay where they are (the writing snaps to them at its new height).
const NARROW17_SHIFT_MM = 4.5;
const n17Shift = (narrow17) => (narrow17 ? mmToNativeUnits(NARROW17_SHIFT_MM) : 0);

const GUIDE_COLOR = "#6fa3e0";
const WIDE_GUIDE_COLOR = "#555555"; // wide-row method sheets: dark grey grid + dashed mid line
const START_DOT_COLOR = "#dc2626";
const MARGIN_COLOR = "#c0392b"; // "красная линия полей" — a real notebook's red margin rule
const GUIDE_DIAG_W = 0.25;
const GUIDE_THIN_W = 0.4;
const GUIDE_BOLD_W = 0.9;
const MARGIN_LINE_W = 1.4;
// Dashed mid-line for each row's own WIDE (ascender) zone, "Элементы букв" rows only
// (2026-09-20, user's explicit ask: "в этой разлиновке тетрадной добавить пунктирную линию
// в каждой широкой строке, посредине широкой строки... В мастерской такая линия у нас уже
// есть", scoped to useElements the next day -- "эта сетка нужна только в режиме элементов,
// в буквах я бы ее не делал") -- the exact same reference
// line tools/letter_capture/handwriting_capture.html's own drawRuling() already draws as
// `.rule-red-h` at its own TOP_MID (propisRuling.js's NATIVE_TOP_MID=36, "tall ascenders top
// out here"), reusing its own dash pattern (`stroke-dasharray: 2 1.4`) verbatim so the two
// tools' ruling reads as the same reference, not a new invention. The WIDE zone here is NOT
// the capture tool's own per-card L1..L2 span though -- this page's row cycle was deliberately
// NOT a copy of that per-card spacing (see TEXT_ROW_PITCH's own comment: the old 4-line-per-
// row NATIVE_L1..L4 set didn't fit the real print notebook's own 12mm cycle, replaced by this
// page's own 2-line thin/bold pair) -- so the offset is re-derived from THIS page's own real
// geometry instead: the WIDE zone spans from the previous row's own baseline (TEXT_ROW_PITCH
// above this row's own baseline) down to this row's own thin line (TEXT_ROW_THIN_OFFSET above
// baseline), so its true midpoint sits `TEXT_ROW_THIN_OFFSET + (TEXT_ROW_PITCH -
// TEXT_ROW_THIN_OFFSET) / 2` above the baseline -- 24 + (72-24)/2 = 48 units, not simply
// NATIVE_TOP_MID's own 36 (which answers a different question: the midpoint of a single
// isolated card's own 52-unit L1..L2 span, not this page's own 48-unit inter-row wide zone).
const WIDE_MID_OFFSET = TEXT_ROW_THIN_OFFSET + (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET) / 2;
const GUIDE_WIDE_MID_DASH = "2 1.4";
const FALLBACK_FONT_SIZE = 34;
// ~0.5mm radius (native units are 6/mm, propisRuling.js's UNIT_H=150 per LINE_MM=25) --
// halved from the original 6 (2026-09-18, "уменьши точки в начале штриха в два раза"): a
// dot per stroke (see startPoints below) reads as clutter on a multi-stroke element at the
// old size, small enough now to stay a clear landmark without dominating.
const ELEMENT_START_DOT_R = 3;
// Small red "which way does the pen move" marker, one per stroke, at its own midpoint
// (wordEngine.js's getMidpointTangent) -- per the user's explicit ask (2026-09-18,
// "маленькие красные стрелочки по направлению написания"). Briefly removed the same day
// when the feature was still built for an on-screen animated demo (the user judged it
// redundant with the animation itself); restored once the user clarified the real target is
// a PRINTED practice sheet with no animation at all -- on paper, an arrow is the only way to
// show stroke direction. A flat isosceles triangle, tip pointing along local +x, so rotating
// the wrapping <g> by the stroke's own tangent angle (atan2 in degrees, same convention
// `rotate()` uses) aims it correctly regardless of direction. Sized relative to
// ELEMENT_START_DOT_R (3) -- comparably small, a clear landmark without competing with ink.
const ARROW_COLOR = "#dc2626";
const ARROW_LEN = 5;
const ARROW_HALF_W = 2.4;
const ARROW_PATH = `M ${ARROW_LEN} 0 L ${-ARROW_LEN * 0.4} ${-ARROW_HALF_W} L ${-ARROW_LEN * 0.4} ${ARROW_HALF_W} Z`;
// Repeat copies (wordEngine.js's buildRepeatChain) render dashed and faded so a whole row of
// them reads as trace guides, not as ink of equal weight to the primary example.
const REPEAT_DASH = "4 3";
const REPEAT_OPACITY = 0.5;

// Which physical A4-sheet half this page is (even index = left slot, odd = right slot) and
// where its own margin line / content start sit as a result — mirrors
// scripts/propis_worksheets/page.py's LEFT_INSET_MM/CENTER_INSET_MM exactly (see
// propisRuling.js's PRINT_* constants for the full "why"): a left-slot page's margin line
// sits near its own left (outer) edge and its content hugs that same side; a right-slot
// page's margin line sits near its own right (outer) edge instead, and its content hugs the
// OPPOSITE (inner/center-divider) side.
// "Широкая строка" sheets have no margin: no red line, rows start one cell in from the page's left edge.
const WIDE_CONTENT_INSET_MM = 5;
// `propis2` margin on a wide-row page: `margin` is the side of the FIRST page ("left" / "right"); it alternates on the
// spread, the red line stands PROPIS2_MARGIN_MM from that edge and the content keeps a cell's width clear of it.
function slotGeometry(pageIndex, compact = false, margin = "off", geom = GEOMS.a5) {
  const isLeftSlot = pageIndex % 2 === 0;
  if (compact && (margin === "left" || margin === "right")) {
    const onLeft = (margin === "left") === isLeftSlot;
    return {
      isLeftSlot,
      marginXUnits: mmToNativeUnits(onLeft ? PROPIS2_MARGIN_MM : geom.wMm - PROPIS2_MARGIN_MM),
      contentXUnits: mmToNativeUnits(onLeft ? PROPIS2_MARGIN_MM + WIDE_CONTENT_INSET_MM : WIDE_CONTENT_INSET_MM),
    };
  }
  if (compact) return { isLeftSlot, marginXUnits: null, contentXUnits: mmToNativeUnits(WIDE_CONTENT_INSET_MM) };
  return {
    isLeftSlot,
    marginXUnits: mmToNativeUnits(isLeftSlot ? PRINT_MARGIN_MM : PRINT_PAGE_W_MM - PRINT_MARGIN_MM),
    contentXUnits: mmToNativeUnits(isLeftSlot ? PRINT_LEFT_INSET_MM : PRINT_CENTER_INSET_MM),
  };
}

// Computed across the FULL physical sheet width (both slots together), not per slot —
// propis_ruling.py's own real PDF draws its diagonal hatching in a single continuous pass
// across the whole 297mm sheet, so the pattern's phase carries seamlessly across the
// left/right slot boundary. Building it per slot independently (each its own x=-dx start)
// was the first cut's bug: 148.5mm isn't a multiple of the 20mm diagonal spacing, so each
// slot's own phase drifted from the other's, and the two lines met at visibly different
// angles/offsets right at the seam (reported by the user from a printed page photo,
// 2026-09-13). The right slot's own copy is shifted left by one page width so whatever fell
// at sheet-x=[148.5, 297] now sits at this slot's own local x=[0, 148.5] — the svg's own
// default overflow:hidden clips the rest, same as any other line here.
// "Элементы букв" pages use a much denser diagonal backing than ordinary text pages -- see
// TEXT_ROW_ELEMENT_DIAGONAL_SPACING's own comment (propisRuling.js) for why the standard
// 20mm spacing doesn't work for these: most elements are narrower than one 20mm gap, so a
// whole крючок/заборчик could render with no slant guide crossing it at all.
// `propis2`, dense grid on the wide ruling: 5 mm, the distance between the two tops of «и» there.
const SQUARE_CELL = mmToNativeUnits(5); // `propis2`: the squared grid, 5 mm
// "Широкая строка": every wide band carries its OWN slant grid, phased on the band's bottom line, so the
// first slant meets the bottom (and the top) horizontal at the same distance from the page's left edge in
// every row (a page-long grid would shift by 3.6 units per row). Distance of that first crossing:
const WIDE_GRID_FIRST_X = 15; // units (2.5mm) from the left edge, on the band's bottom line
const WIDE_SLANT_TAN = Math.tan(((90 - ANGLE_FROM_HORIZONTAL_DEG) * Math.PI) / 180);
// slant line k of a band at height y (row-local coordinates: the band's bottom line is y = NATIVE_L3 - TEXT_ROW_THIN_OFFSET)
const WIDE_BAND_BOTTOM_LOCAL = NATIVE_L3 - TEXT_ROW_THIN_OFFSET;
const wideLineX = (k, yLocal) => WIDE_GRID_FIRST_X + k * TEXT_ROW_WIDE_DIAGONAL_SPACING + (WIDE_BAND_BOTTOM_LOCAL - yLocal) * WIDE_SLANT_TAN;
const wideLineCount = (pageW) => Math.ceil((pageW + (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET) * WIDE_SLANT_TAN) / TEXT_ROW_WIDE_DIAGONAL_SPACING) + 2;
// "Узкая строка" (методика, часть 2): the same captured glyphs at half size. Band = 24 units (4 mm) standing on the
// baseline (row-local y = 64), thin line on top, dashed middle, bold baseline; a dashed guide in the middle of the gap
// between bands (ascender / descender limit); a short bold bar at the left edge of each band. The 65deg slants (cell
// 15 units) run through the WHOLE page, not only inside the bands.
const NARROW_SCALE = 0.5;
export const NARROW_CELL = TEXT_ROW_WIDE_DIAGONAL_SPACING * NARROW_SCALE; // exported: the element list draws the same slant step
// `propis2`, dense grid on the narrow ruling: exactly the letters' own cell (2.5 mm, the distance between the two tops of «и»),
// so that every stem of every letter stands on a drawn line.
const NARROW_BAND_H = (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET) * NARROW_SCALE;
const NARROW_GUIDE_LOCAL = NATIVE_L3 - TEXT_ROW_PITCH; // 16: dashed limit line above the band
const NARROW_FIRST_X = 15;
const NARROW_START_DOT_R = 2;
const NARROW_BAR_W = 1.4;
const narrowYRef = () => rowOriginY(1) + WIDE_BAND_BOTTOM_LOCAL;
const narrowLineX = (k, yAbs) => NARROW_FIRST_X + k * NARROW_CELL + (narrowYRef() - yAbs) * WIDE_SLANT_TAN;
// "Широкая строка": the ordinary 17-row cycle, but ruling row 0 is only the TOP edge of the first
// wide band (its own bold baseline) -- content rows start at ruling row 1, so 16 per page, and
// the first band doesn't sit cut off against the physical page edge.

// `propis2` page formats. "a5" is the page of the finished copybooks (148.5 x 210 mm, two of them on an A4 landscape
// sheet, the diagonal grid runs on across the pair); "a4" is a whole A4 portrait sheet (210 x 297 mm), one page per sheet.
// Same row cycle, so an A4 page simply has more rows and a wider line.
const PAGE_ROW_CYCLE_MM = 12;
function makeGeom(format) {
  const a4 = format === "a4";
  const wMm = a4 ? 210 : PRINT_PAGE_W_MM;
  const hMm = a4 ? 297 : PRINT_PAGE_H_MM;
  const w = mmToNativeUnits(wMm);
  const h = mmToNativeUnits(hMm);
  const rows = Math.floor((hMm - PRINT_FIRST_BASELINE_MM) / PAGE_ROW_CYCLE_MM) + 1;
  const sheetW = a4 ? w : w * 2;
  return {
    format: a4 ? "a4" : "a5", wMm, hMm, w, h, rows, wideRows: rows - 1, pairedSlots: !a4,
    rowIndices: Array.from({ length: rows }, (_, i) => i),
    maxX: WIDE_ROW_MAX_X + (w - PAGE_W_UNITS),
    lines: {
      std: buildDiagonalLines(h, sheetW, TEXT_ROW_DIAGONAL_SPACING),
      dense: buildDiagonalLines(h, sheetW, TEXT_ROW_ELEMENT_DIAGONAL_SPACING),
      wideDense: buildDiagonalLines(h, sheetW, TEXT_ROW_WIDE_DIAGONAL_SPACING),
      narrowDense: buildDiagonalLines(h, sheetW, NARROW_CELL),
    },
  };
}
const GEOMS = { a5: makeGeom("a5"), a4: makeGeom("a4") };
export const geomOf = (format) => (format === "a4" ? GEOMS.a4 : GEOMS.a5);
// Slants are drawn only inside each wide band (previous baseline down to this row's thin line);
// the narrow strip below stays blank, as in the original workbook.
const wideBandTop = (row) => rowOriginY(row) + NATIVE_L3 - TEXT_ROW_PITCH;
const wideBandHeight = TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET;

// `propis2` editor: which content row (0-based, on one page) a point at svg-y `y` belongs to; -1 outside
// the ruled rows. A row owns the strip from its previous baseline down to its own baseline (the same
// for the narrow and wide rulings: both stand on the same 72-unit pitch).
// `propis2` narrow ruling (`narrow17`): content starts at ruling row 0, a page holds all 17 rows of the printed notebook (24 on A4);
// the wide ruling keeps its first ruling row as the top edge of the first band (16 / 23 rows).
// `propis2`, squared paper ("square"): its own rows, not the 12 mm cycle of the copybook. A row is two cells (10 mm): one cell
// written in, one left empty ("через клетку"); the baseline is a line of the grid, the first one 10 mm from the top. A digit is
// one cell tall (wordEngine.js places it in its cell, `snapX.cell`).
const SQUARE_PITCH = 2 * SQUARE_CELL;
const SQUARE_FIRST_BASELINE = 2 * SQUARE_CELL;
// letters on squared paper: the copybook's letters in the copybook's proportions, a lowercase letter (the 48-unit band at scale 1)
// 3/4 of a cell tall, so a capital is 1.5 cells (the school norm for squared notebooks)
const SQUARE_LETTER_SCALE = (0.75 * SQUARE_CELL) / (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET);
// `propis2`, ruled paper ("ruled", owner 2026-10-14: «как в школьной линейке»): its own rows too — a line every 8 mm (the school ruled
// notebook), the first 16 mm from the top; the letters smaller than on the copybook: a lowercase letter 3.2 mm, a capital 6.4 mm.
const RULED_PITCH = mmToNativeUnits(8);
const RULED_LETTER_SCALE = mmToNativeUnits(3.2) / (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET);
// `propis2_bg`, the Bulgarian copybook ruling ("bg", docs/propis2-variants.md): a row of four lines, bold (top of capitals and
// ascenders) 6.08 mm above a thin line, the 4.94 mm lowercase band down to a thin baseline, 5.98 mm down to the next bold line (the
// top line of the next row: rows every 17 mm, 11 on an A5 page); no dashes; sparse slant guides at 1 : 4 (76deg) every 35 mm. The
// bands as on a Bulgarian teacher's writing video (owner, 2026-10-19: 1.23 : 1 : 1.21, near even; «Тетрадка 1 клас» had 6.5 /
// 4.26 / 6.24). The letters are the copybook's, a lowercase letter 4.94 mm tall; the deck's meta.script stretches their
// ascenders and descenders to the bold lines (wordEngine / scriptGeometry.js).
const BG_UP_MM = 6.08;
const BG_X_MM = 4.94;
const BG_DOWN_MM = 5.98;
const BG_PITCH = mmToNativeUnits(BG_UP_MM + BG_X_MM + BG_DOWN_MM);
const BG_LETTER_SCALE = mmToNativeUnits(BG_X_MM) / (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET);
const BG_GUIDE_STEP = mmToNativeUnits(35);
const BG_GUIDE_TAN = 1 / 4; // horizontal run per unit of height of the guides (76deg from the horizontal)
// Papers with rows of their own (`ownRows`: "square" | "ruled" | "bg"): pitch, first baseline, the room kept under the last row, letter scale.
const OWN_ROWS = {
  square: { pitch: SQUARE_PITCH, first: SQUARE_FIRST_BASELINE, foot: SQUARE_CELL, scale: SQUARE_LETTER_SCALE },
  ruled: { pitch: RULED_PITCH, first: 2 * RULED_PITCH, foot: RULED_PITCH, scale: RULED_LETTER_SCALE },
  bg: { pitch: BG_PITCH, first: mmToNativeUnits(10 + BG_UP_MM + BG_X_MM), foot: mmToNativeUnits(BG_DOWN_MM + 5), scale: BG_LETTER_SCALE },
};
const ownOf = (kind) => OWN_ROWS[kind === true ? "square" : kind] ?? null;
const ownRowsOf = (geom, kind) => { const o = ownOf(kind); return Math.floor((geom.h - o.foot - o.first) / o.pitch) + 1; };
export const squareRowsPerPage = (format) => ownRowsOf(geomOf(format), "square");
export const ownRowsPerPage = (format, kind) => ownRowsOf(geomOf(format), kind);
// y of the row-local origin of content row `row` of such a page (the engine's baseline is row-local y = WIDE_BAND_BOTTOM_LOCAL)
const ownRowY = (row, kind) => { const o = ownOf(kind); return o.first + row * o.pitch - WIDE_BAND_BOTTOM_LOCAL; };
const perPageOf = (geom, narrow17, ownRows = null) => (ownOf(ownRows) ? ownRowsOf(geom, ownRows) : narrow17 ? geom.rows : geom.wideRows);
// `ownRows`: "square" | "ruled" (true = "square", as before)
export function rowAtSvgY(y, format = "a5", narrow17 = false, ownRows = null) {
  const o = ownOf(ownRows);
  if (o) {
    // a row owns the strip above its baseline up to the previous one (on squared paper: the empty cell and the one written in)
    const r = Math.floor((y - (o.first - o.pitch)) / o.pitch);
    return r >= 0 && r < ownRowsOf(geomOf(format), ownRows) ? r : -1;
  }
  const off = narrow17 ? 0 : 1;
  const top = rowOriginY(off) + n17Shift(narrow17) + NATIVE_L3 - TEXT_ROW_PITCH;
  const r = Math.floor((y - top) / TEXT_ROW_PITCH);
  return r >= 0 && r < perPageOf(geomOf(format), narrow17) ? r : -1;
}
const overlayRect = (r, off = 1) => ({ y: rowOriginY(r + off) + NATIVE_L3 - TEXT_ROW_PITCH, h: TEXT_ROW_PITCH });
const OVERLAY_FILL = { select: "rgba(37,99,235,.10)", drop: "rgba(22,163,74,.22)", warn: "rgba(220,38,38,.12)" };
const DIAGONAL_TAN = Math.tan(((90 - ANGLE_FROM_HORIZONTAL_DEG) * Math.PI) / 180);

// Where line n of the dense diagonal grid (see SHEET_DIAGONAL_LINES_DENSE) actually renders
// at a given page-absolute Y, on THIS page's own slot (accounting for diagonalShiftX) --
// inverse of buildDiagonalLines' own x1/x2 construction: line n's un-shifted X at height 0 is
// n*spacing, and it leans by `y*DIAGONAL_TAN` per unit of Y (see that function's own comment
// on the top-right-leaning "/" shape), so its X at any Y is `n*spacing - y*DIAGONAL_TAN`, then
// shifted the same way the rendered <line> elements are.
function diagonalLineX(n, y, spacingUnits, diagonalShiftX) {
  return n * spacingUnits - y * DIAGONAL_TAN + diagonalShiftX;
}

// Each element's own start point must land exactly on the dense diagonal grid (2026-09-18,
// user's explicit ask: "эта сетка дает нам четкий ориентир по планированию расстояния между
// элементами... точка начала всегда [должна находиться на какой-то из линий]") -- the grid
// isn't just decoration once elements exist on the page, it's the spacing reference a child
// (or a parent copying the page by hand) uses to judge how far apart to draw each element.
// Finds the nearest grid line index n (real, not rounded to an integer boundary the caller
// then has to re-snap) via the inverse of diagonalLineX, then returns that line's own real X.
function nearestDiagonalX(x, y, spacingUnits, diagonalShiftX) {
  const n = Math.round((x - diagonalShiftX + y * DIAGONAL_TAN) / spacingUnits);
  return diagonalLineX(n, y, spacingUnits, diagonalShiftX);
}

// Where a row can be tapped (row-local y): over its own ink, with a margin (`wideRows`: `propis2` / the wide sheets, whose letters stand
// on the band at y 16..64 on the narrow ruling, not around NATIVE_L3 as the `propis` text rows; a rect around NATIVE_L3 sat below the letters).
const HIT_PAD = 10;
const HIT_CACHE = new WeakMap();
function hitBox(row, wideRows) {
  if (!wideRows) return { y: NATIVE_L3 - TEXT_ROW_PITCH / 2, h: TEXT_ROW_PITCH };
  if (HIT_CACHE.has(row.segments)) return HIT_CACHE.get(row.segments);
  const ys = row.segments.flatMap((seg) => seg.strokes ?? []).flatMap((st) => (st.d.match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 1));
  const box = ys.length ? { y: Math.min(...ys) - HIT_PAD, h: Math.max(...ys) - Math.min(...ys) + 2 * HIT_PAD } : { y: NATIVE_L3 - TEXT_ROW_PITCH / 2, h: TEXT_ROW_PITCH };
  HIT_CACHE.set(row.segments, box);
  return box;
}

// The ink of one row. A row that is not being animated is drawn by RowInk, which React skips while the row object is the same: the
// layout keeps finished rows (wordEngine.js), so typing in one row of the page redraws only that row.
function RowSegments({ segments, isActive = false, narrowRows = false, speedFactor = 1, evenSpeed = false, tipSize = "large" }) {
  return (
    <>
      {segments.map((seg, si) =>
              seg.type === "cursive" ? (
                <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                  {isActive ? (
                    <AnimatedStrokes trajectory={seg.trajectory} tipSize={tipSize} speedFactor={speedFactor} evenSpeed={evenSpeed} />
                  ) : (
                    seg.trajectory.strokes.map((s, ssi) => (
                      <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    ))
                  )}
                </g>
              ) : seg.type === "glyph" ? (
                <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                  {seg.strokes.map((s, ssi) => (
                    <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={s.width ?? 2} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </g>
              ) : seg.type === "element" ? (
                // "Элементы букв" -- always static ink (no tap/animation, see isElementRow
                // above): the primary example, its start dot(s) and direction arrow(s), then
                // the rest of the row filled with dashed trace-guide copies
                // (wordEngine.js's buildRepeatChain) for the child to trace over on paper.
                // One start dot per STROKE, not just the first: a multi-stroke element
                // (01_pryamaya_liniya's two separate lines, 03_zaborchik_ploskie's four) is
                // several disconnected pen-lifts, each needing its own "start here" mark.
                <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                  {isActive && seg.trajectory ? (
                    <AnimatedStrokes trajectory={seg.trajectory} tipSize={tipSize} speedFactor={speedFactor} evenSpeed={evenSpeed} />
                  ) : seg.strokes.map((s, ssi) => (
                    // dashed copies fade out along the row (wordEngine WIDE_FADE_END_X); a fully faded one keeps only its start dot
                    s.opacity !== undefined && s.opacity <= 0.02 ? null : (
                      <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={s.width ?? 2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? REPEAT_DASH : undefined} opacity={s.opacity} />
                    )
                  ))}
                  {!isActive && seg.startPoints?.map((pt, pi) => (
                    <circle key={pi} cx={pt[0]} cy={pt[1]} r={narrowRows ? NARROW_START_DOT_R : ELEMENT_START_DOT_R} fill={START_DOT_COLOR} />
                  ))}
                  {!isActive && seg.directionArrows?.map((a, ai) => a && a.long && (
                    <g key={ai} fill="none" stroke={ARROW_COLOR} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
                      <path d={a.d} />
                      <path d={a.head} />
                    </g>
                  ))}
                  {!isActive && seg.directionArrows?.map((a, ai) => a && !a.long && (
                    <g key={ai} transform={`translate(${a.point[0]} ${a.point[1]}) rotate(${a.angleDeg})`}>
                      <path d={ARROW_PATH} fill={ARROW_COLOR} />
                    </g>
                  ))}
                  {seg.repeatChain?.map((copy, ci) => (
                    <g key={ci}>
                      {copy.strokes.map((s, ssi) => (
                        <path
                          key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2}
                          strokeLinecap="round" strokeLinejoin="round" strokeDasharray={REPEAT_DASH} opacity={REPEAT_OPACITY}
                        />
                      ))}
                      {copy.startPoints?.map((pt, pi) => (
                        <circle key={pi} cx={pt[0]} cy={pt[1]} r={narrowRows ? NARROW_START_DOT_R : ELEMENT_START_DOT_R} fill={START_DOT_COLOR} opacity={REPEAT_OPACITY} />
                      ))}
                    </g>
                  ))}
                </g>
              ) : (
                <text key={si} x={seg.xOffset} y={NATIVE_L3} fontSize={FALLBACK_FONT_SIZE} fontFamily="system-ui, sans-serif" fill={INK_COLOR}>
                  {seg.text}
                </text>
              )
            )}
    </>
  );
}
const RowInk = memo(function RowInk({ segments, narrowRows }) {
  return <RowSegments segments={segments} narrowRows={narrowRows} />;
});

// One physical page's ruling + content, reused for both the interactive on-screen view (one
// page at a time, tap-to-animate) and the print-only stacked view (every page, static ink,
// see PrintPageView's own "propis-print-all" block). `activeIndex`/`onToggleActive` are
// omitted (undefined) for the print render — nothing is tappable on paper.
//
// "Элементы букв" rows (`useElements`) use the EXACT SAME horizontal row grid/ruling
// ordinary text rows do — no `useElements`-specific ROW ruling code at all. Every earlier
// attempt this same day (2026-09-18) gave element rows their OWN bespoke row ruling (a
// combined 4-line block; two separately-sized wide/narrow row types) and each one, in a
// different way, ran into the same wall: "узкие строки это не пустые промежутки, это именно
// узкие строки разлиновки для прописей! эта разлиновка должна оставаться в любом случае есть
// на ней символ или нет" -- the row ruling is a FIXED, always-printed feature of the page,
// like a real ruled notebook, not a per-element slot that appears/disappears/resizes with
// content. Reusing the text-row grid verbatim is the only way to guarantee that. Only
// wordEngine.js's layoutElementLinesIntoRows differs (anchoring each element's own real,
// unscaled ink onto whichever of the row's two existing guide lines matches its family) --
// and, same day, the DIAGONAL backing: `useElements` picks SHEET_DIAGONAL_LINES_DENSE
// instead of the standard set (see its own comment) -- that one axis genuinely does need to
// differ, since the standard 20mm spacing is too sparse for a single narrow element's own
// ink to ever cross a slant guide at all.
// `onFragmentTap` (optional, `propis2`): tap reports the row and the tap's x inside it instead of toggling the
// inline animation. `crop` (optional): show only a window of the page (the show panel's single row).
// `speedFactor` slows/speeds the pen animation.
// `pageNumber`: printed in a small ring at the bottom, by the OUTER edge of the page (as in the printed notebooks): on an A4 sheet of
// two A5 pages the left page's is on the left, the right page's on the right; a whole A4 page alternates like a book (1 right, 2 left).
const PAGE_NUMBER_R_MM = 2.6;
const PAGE_NUMBER_INSET_MM = 6.5;
function PrintPage({ page, pageIndex, gridIndex = null, noSlant = false, activeIndex, onToggleActive, onFragmentTap, onSheetPoint = null, crop = null, speedFactor = 1, overlays = null, simpleGrid = null, midDash = true, margin = "off", format = "a5", narrow17 = false, ownRows = null, useElements, wideRows = false, narrowRows = false, pageNumber = null, brand = false }) {
  const geom = geomOf(format);
  // this page's own sheet size and diagonal grids (shadow the A5 module defaults)
  const PAGE_W_UNITS = geom.w;
  const PAGE_H_UNITS = geom.h;
  const ROW_INDICES = geom.rowIndices;
  const SHEET_DIAGONAL_LINES_NARROW_DENSE = geom.lines.narrowDense;
  const SHEET_DIAGONAL_LINES_WIDE_DENSE = geom.lines.wideDense;
  const SHEET_DIAGONAL_LINES = geom.lines.std;
  const SHEET_DIAGONAL_LINES_DENSE = geom.lines.dense;
  const { isLeftSlot, marginXUnits, contentXUnits } = slotGeometry(pageIndex, wideRows, margin, geom);
  // the slant grid is shifted by a page width on an odd page of the notebook (it runs on across the open sheet), and the letters snap to
  // it by that same page (snapXFor): `gridIndex` is that page when the side of the sheet (`pageIndex`: margin, number, mark) is another —
  // «Тетрадью» puts page 8 on the left half; drawn by the half, its grid stood 1.5 mm off its letters (owner, 2026-10-24)
  const diagonalShiftX = (gridIndex ?? pageIndex) % 2 === 0 || !geom.pairedSlots ? 0 : -PAGE_W_UNITS;
  const diagonalLines = useElements ? SHEET_DIAGONAL_LINES_DENSE : SHEET_DIAGONAL_LINES;
  const guideColor = wideRows ? WIDE_GUIDE_COLOR : GUIDE_COLOR;
  const rowOff = narrow17 ? 0 : 1;
  const n17 = n17Shift(narrow17);
  const contentRow = (r) => (wideRows ? r + rowOff : r);
  // y of a content row's own origin on this page
  const rowY = (r) => (ownRows ? ownRowY(r, ownRows) : rowOriginY(contentRow(r)) + n17);
  // the show panel's window (crop.row): only the ruling of the row the pen writes on, not its neighbours
  const onlyRow = crop?.row ?? null;
  // `propis2`: a plain slant grid replaces the methodology grid in what is drawn (the methodology grid stays
  // internal: letters still snap to it, it is just not drawn). The two grids are the ones of the finished
  // copybooks: "regular" = the standard Russian-school grid, a line every 20 mm (DIAGONAL_MM); "dense" = the
  // fine grid, a line every 2.5 mm on the narrow ruling (the letters' own cell) and every 5 mm
  // on the wide one: the step follows the row, it is the distance between the two tops of «и» on that row.
  const simpleStep = Boolean(simpleGrid);
  // "square" / "ruled": plain paper, an ordinary school notebook page: only each row's baseline is kept, no thin line, no dashes
  const plain = simpleGrid === "square" || simpleGrid === "ruled" || simpleGrid === "bg";
  // "square": an ordinary school squared grid, 5 mm cells (vertical and horizontal lines), under the row guides.
  // dashed guide lines are slightly red on the `propis2` pages (the `propis` sheets keep the grid colour)
  const dashColor = simpleGrid ? "#e57d7a" : guideColor;
  // wide ruling: the slants live only inside the wide bands, none in the narrow strips between them (as in the methodology)
  const clipId = `p2c${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const slantClip = simpleGrid && wideRows && !narrowRows && !plain;
  const squareEls = simpleGrid === "square" ? (
    // crisp: each line a whole screen pixel. Lines thinner than a pixel otherwise come out in stripes on the screen, some darker
    // and some all but gone (owner, 2026-10-25: «участки клеточного фона, не сплошной»); the PDF ignores it (svg2pdf: no shape-rendering)
    <g data-simple-grid="square" shapeRendering="crispEdges">
      {Array.from({ length: Math.floor(PAGE_W_UNITS / SQUARE_CELL) + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * SQUARE_CELL} y1={0} x2={i * SQUARE_CELL} y2={PAGE_H_UNITS} stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W} opacity={0.7} />
      ))}
      {Array.from({ length: Math.floor(PAGE_H_UNITS / SQUARE_CELL) + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * SQUARE_CELL} x2={PAGE_W_UNITS} y2={i * SQUARE_CELL} stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W} opacity={0.7} />
      ))}
    </g>
  ) : null;
  // "ruled": the lines of a school ruled notebook, one under each row (its baseline), from the first row to the last
  const ruledEls = ownRows === "ruled" ? (
    <g data-simple-grid="ruled">
      {Array.from({ length: ownRowsOf(geom, "ruled") }, (_, r) => r).filter((r) => onlyRow === null || r === onlyRow).map((r) => {
        const y = ownRowY(r, "ruled") + WIDE_BAND_BOTTOM_LOCAL;
        return <line key={r} x1={0} y1={y} x2={PAGE_W_UNITS} y2={y} stroke={GUIDE_COLOR} strokeWidth={GUIDE_THIN_W * 1.6} />;
      })}
    </g>
  ) : null;
  // "bg": the Bulgarian copybook ruling (BG_* above): per row bold - thin - thin(baseline), the next row's bold line closing it, and the
  // 76deg guides over the whole ruled part of the page
  const bgEls = ownRows === "bg" ? (() => {
    const rows = Array.from({ length: ownRowsOf(geom, "bg") }, (_, r) => r).filter((r) => onlyRow === null || r === onlyRow);
    const base = (r) => ownRowY(r, "bg") + WIDE_BAND_BOTTOM_LOCAL;
    const top = base(rows[0] ?? 0) - mmToNativeUnits(BG_UP_MM + BG_X_MM);
    const bottom = base(rows[rows.length - 1] ?? 0) + mmToNativeUnits(BG_DOWN_MM);
    const run = (bottom - top) * BG_GUIDE_TAN;
    const guides = Array.from({ length: Math.ceil((PAGE_W_UNITS + run) / BG_GUIDE_STEP) + 1 }, (_, k) => mmToNativeUnits(10) + k * BG_GUIDE_STEP);
    return (
      <g data-simple-grid="bg">
        {onlyRow === null && !noSlant && guides.map((x) => <line key={`s${x}`} x1={x - run} y1={bottom} x2={x} y2={top} stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W} />)}
        {rows.map((r) => {
          const y = base(r);
          return (
            <g key={r} data-bg-row={r}>
              <line x1={0} y1={y - mmToNativeUnits(BG_UP_MM + BG_X_MM)} x2={PAGE_W_UNITS} y2={y - mmToNativeUnits(BG_UP_MM + BG_X_MM)} stroke={GUIDE_COLOR} strokeWidth={GUIDE_BOLD_W} />
              <line x1={0} y1={y - mmToNativeUnits(BG_X_MM)} x2={PAGE_W_UNITS} y2={y - mmToNativeUnits(BG_X_MM)} stroke={GUIDE_COLOR} strokeWidth={GUIDE_THIN_W} />
              <line x1={0} y1={y} x2={PAGE_W_UNITS} y2={y} stroke={GUIDE_COLOR} strokeWidth={GUIDE_THIN_W} />
              {midDash && <line x1={0} y1={y - mmToNativeUnits(BG_X_MM / 2)} x2={PAGE_W_UNITS} y2={y - mmToNativeUnits(BG_X_MM / 2)} stroke={dashColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH} data-bg-dash="1" />}
              {(onlyRow !== null || r === rows[rows.length - 1]) && <line x1={0} y1={y + mmToNativeUnits(BG_DOWN_MM)} x2={PAGE_W_UNITS} y2={y + mmToNativeUnits(BG_DOWN_MM)} stroke={GUIDE_COLOR} strokeWidth={GUIDE_BOLD_W} />}
            </g>
          );
        })}
      </g>
    );
  })() : null;
  const simpleEls = squareEls ?? ruledEls ?? bgEls ?? (simpleGrid && simpleGrid !== "ruled" && simpleGrid !== "bg" && simpleGrid !== "none" ? (
    <g data-simple-grid={simpleGrid} clipPath={slantClip ? `url(#${clipId})` : undefined}>
      {slantClip && (
        <clipPath id={clipId}>
          {ROW_INDICES.slice(1).filter((row) => onlyRow === null || row === onlyRow).map((row) => <rect key={row} x="0" y={wideBandTop(row)} width={PAGE_W_UNITS} height={wideBandHeight} />)}
        </clipPath>
      )}
      {(simpleGrid === "dense" ? (narrowRows ? SHEET_DIAGONAL_LINES_NARROW_DENSE : SHEET_DIAGONAL_LINES_WIDE_DENSE) : SHEET_DIAGONAL_LINES).map((l, i) => (
        <line key={i} x1={l.x1 + diagonalShiftX} y1={0} x2={l.x2 + diagonalShiftX} y2={PAGE_H_UNITS} stroke={guideColor} strokeWidth={GUIDE_DIAG_W} />
      ))}
    </g>
  ) : null);
  const diagonalEls = wideRows ? null : diagonalLines.map((l, i) => (
    <line
      key={`d${i}`}
      x1={l.x1 + diagonalShiftX} y1={0} x2={l.x2 + diagonalShiftX} y2={PAGE_H_UNITS}
      stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W}
    />
  ));
  return (
    <svg
      className="propis-print-page-svg"
      // `onSheetPoint({ row, x, shiftKey })`: a click on the sheet — the row of this page under it and the x in that row's own units
      // (`propis2` typing on the sheet puts the caret there)
      onClick={onSheetPoint ? (e) => {
        const svg = e.currentTarget;
        const m = svg.getScreenCTM?.();
        let q;
        if (m && svg.createSVGPoint) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; q = pt.matrixTransform(m.inverse()); } else {
          // no screen matrix (a test DOM): the box on the screen scaled to the viewBox
          const box = svg.getBoundingClientRect();
          const [vx, vy, vw, vh] = String(svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
          q = { x: vx + ((e.clientX - box.left) / (box.width || 1)) * vw, y: vy + ((e.clientY - box.top) / (box.height || 1)) * vh };
        }
        const row = rowAtSvgY(q.y, format, narrow17, ownRows);
        onSheetPoint({ row, x: q.x - contentXUnits - (page.find((p) => p.rowIndex === row)?.x ?? 0), shiftKey: e.shiftKey });
      } : undefined}
      viewBox={crop ? `${crop.x} ${crop.y} ${crop.w} ${crop.h}` : `0 0 ${PAGE_W_UNITS} ${PAGE_H_UNITS}`}
      style={crop ? { "--crop-ratio": crop.w / crop.h } : undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
      {simpleEls}
      {narrowRows && !ownRows && (() => {
        const kLo = Math.floor((-NARROW_FIRST_X - narrowYRef() * WIDE_SLANT_TAN) / NARROW_CELL);
        const kHi = Math.ceil((PAGE_W_UNITS - NARROW_FIRST_X - (narrowYRef() - PAGE_H_UNITS) * WIDE_SLANT_TAN) / NARROW_CELL);
        const ks = Array.from({ length: kHi - kLo + 1 }, (_, i) => kLo + i);
        return (
          <g data-narrow-grid="1">
            {!simpleStep && ks.map((k) => (
              <line key={k} x1={narrowLineX(k, 0)} y1={0} x2={narrowLineX(k, PAGE_H_UNITS)} y2={PAGE_H_UNITS} stroke={guideColor} strokeWidth={GUIDE_DIAG_W} />
            ))}
            {ROW_INDICES.slice(rowOff).filter((row) => onlyRow === null || row === onlyRow).map((row) => {
              const top = rowOriginY(row) + n17 + WIDE_BAND_BOTTOM_LOCAL - NARROW_BAND_H;
              const bottom = rowOriginY(row) + n17 + WIDE_BAND_BOTTOM_LOCAL;
              const guideY = rowOriginY(row) + n17 + NARROW_GUIDE_LOCAL;
              // the show panel's single row keeps its lower dashed line too (the descender limit: on the page it is the next row's guide)
              const lowY = rowOriginY(row + 1) + n17 + NARROW_GUIDE_LOCAL;
              return (
                <g key={row} data-narrow-band={row}>
                  {onlyRow !== null && midDash && !plain && <line x1="0" y1={lowY} x2={PAGE_W_UNITS} y2={lowY} stroke={dashColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH} />}
                  {midDash && !plain && <line x1="0" y1={guideY} x2={PAGE_W_UNITS} y2={guideY} stroke={dashColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH} />}
                  {!plain && <line x1="0" y1={top} x2={PAGE_W_UNITS} y2={top} stroke={guideColor} strokeWidth={GUIDE_THIN_W} />}
                  {midDash && !plain && <line x1="0" y1={(top + bottom) / 2} x2={PAGE_W_UNITS} y2={(top + bottom) / 2} stroke={dashColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH} />}
                  <line x1="0" y1={bottom} x2={PAGE_W_UNITS} y2={bottom} stroke={guideColor} strokeWidth={GUIDE_BOLD_W} />
                  {!plain && <line x1={NARROW_BAR_W / 2} y1={top} x2={NARROW_BAR_W / 2} y2={bottom} stroke={guideColor} strokeWidth={NARROW_BAR_W} />}
                </g>
              );
            })}
            {onlyRow === null && (() => {
              const lastY = rowOriginY(ROW_INDICES.length - 1) + n17 + WIDE_BAND_BOTTOM_LOCAL + NARROW_BAND_H;
              return midDash && !plain ? <line x1="0" y1={lastY} x2={PAGE_W_UNITS} y2={lastY} stroke={dashColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH} /> : null;
            })()}
          </g>
        );
      })()}
      {wideRows && !narrowRows ? (simpleStep ? null : ROW_INDICES.slice(1).map((row) => (
        <g key={`band${row}`} data-wide-band={row}>
          {Array.from({ length: wideLineCount(PAGE_W_UNITS) }, (_, k) => k - 1).map((k) => (
            <line
              key={k}
              x1={wideLineX(k, NATIVE_L3 - TEXT_ROW_PITCH)} y1={wideBandTop(row)}
              x2={wideLineX(k, WIDE_BAND_BOTTOM_LOCAL)} y2={wideBandTop(row) + wideBandHeight}
              stroke={guideColor} strokeWidth={GUIDE_DIAG_W}
            />
          ))}
        </g>
      ))) : diagonalEls}
      {!narrowRows && ROW_INDICES.filter((row) => onlyRow === null || row === onlyRow || row === onlyRow - 1).map((row) => (
        <g key={`g${row}`}>
          {(useElements || wideRows) && midDash && !plain && !(wideRows && row === 0) && (
            <line
              x1="0" y1={rowOriginY(row) + NATIVE_L3 - WIDE_MID_OFFSET}
              x2={PAGE_W_UNITS} y2={rowOriginY(row) + NATIVE_L3 - WIDE_MID_OFFSET}
              stroke={dashColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH}
            />
          )}
          {!plain && !(wideRows && row === 0) && (
            <line
              x1="0" y1={rowOriginY(row) + NATIVE_L3 - TEXT_ROW_THIN_OFFSET}
              x2={PAGE_W_UNITS} y2={rowOriginY(row) + NATIVE_L3 - TEXT_ROW_THIN_OFFSET}
              stroke={guideColor} strokeWidth={GUIDE_THIN_W}
            />
          )}
          <line
            x1="0" y1={rowOriginY(row) + NATIVE_L3}
            x2={PAGE_W_UNITS} y2={rowOriginY(row) + NATIVE_L3}
            stroke={guideColor} strokeWidth={GUIDE_BOLD_W}
          />
        </g>
      ))}
      {marginXUnits !== null && <line x1={marginXUnits} y1={0} x2={marginXUnits} y2={PAGE_H_UNITS} stroke={MARGIN_COLOR} strokeWidth={MARGIN_LINE_W} />}
      {page.map((p, i) => {
        // Element rows ("Элементы букв") are a print-only worksheet target with no
        // interactivity at all (2026-09-18, revised after the user decided a screen demo/
        // animation is unneeded overhead -- "мне нужны нормальные тренировочные тетради в
        // пдф формате... только анимация не нужна и отдельный режим наполнения экранного
        // листа с элементами [не нужен]"): no tap-to-animate, so no hit-rect and no active
        // state either, unlike a cursive/text row which keeps both.
        const isElementRow = p.segments.some((seg) => seg.type === "element");
        // "Широкая строка" rows are tappable too: tap plays the pen animation (seg.trajectory).
        const tappable = (onToggleActive || onFragmentTap) && (!isElementRow || wideRows);
        const isActive = tappable ? i === activeIndex : false;
        // Snap the element's own start point onto the nearest dense-diagonal grid line (see
        // nearestDiagonalX's own comment) -- shifts the WHOLE row (primary + every repeat
        // copy, all rendered inside this same <g>) by a rigid delta, so nothing about the
        // element's own internal geometry (buildRepeatChain's spacing/chaining) changes, only
        // where the row as a whole sits on the page.
        const startPoint = isElementRow && !wideRows ? p.segments[0].startPoints?.[0] : null;
        const elementSnapDx = startPoint
          ? nearestDiagonalX(
              contentXUnits + p.x + startPoint[0],
              rowOriginY(contentRow(p.rowIndex)) + n17 + startPoint[1],
              wideRows ? TEXT_ROW_WIDE_DIAGONAL_SPACING : TEXT_ROW_ELEMENT_DIAGONAL_SPACING,
              diagonalShiftX
            ) - (contentXUnits + p.x + startPoint[0])
          : 0;
        return (
          <g key={i} transform={`translate(${contentXUnits + p.x + elementSnapDx} ${rowY(p.rowIndex)})`}>
            {isActive
              ? <RowSegments segments={p.segments} isActive narrowRows={narrowRows} speedFactor={speedFactor} evenSpeed={Boolean(crop)} tipSize={crop ? "medium" : "large"} />
              : <RowInk segments={p.segments} narrowRows={narrowRows} />}
            {/* the tap area lies OVER the ink (it covers the letters themselves, see hitBox), so the strokes do not swallow the tap */}
            {tappable && (
              <rect
                className="propis-text-word-hit"
                x={-4} y={hitBox(p, wideRows).y} width={p.segments.reduce((s, seg) => s + seg.width, 0) + 8} height={hitBox(p, wideRows).h}
                onClick={(e) => {
                  if (!onFragmentTap) { onToggleActive(i); return; }
                  // tap x in the row's own units (the rect sits inside the row's translated <g>)
                  const svg = e.currentTarget.ownerSVGElement;
                  const ctm = e.currentTarget.getScreenCTM?.();
                  let localX = 0;
                  if (svg?.createSVGPoint && ctm) {
                    const pt = svg.createSVGPoint();
                    pt.x = e.clientX; pt.y = e.clientY;
                    localX = pt.matrixTransform(ctm.inverse()).x;
                  }
                  onFragmentTap({ row: p, index: i, localX });
                }}
              />
            )}
          </g>
        );
      })}
      {overlays?.map((o, k) => {
        const { y: oy, h } = ownRows ? { y: ownRowY(o.row, ownRows) + WIDE_BAND_BOTTOM_LOCAL - ownOf(ownRows).pitch, h: ownOf(ownRows).pitch } : overlayRect(o.row, rowOff);
        const y = ownRows ? oy : oy + n17;
        // `propis2` typing on the sheet: the caret / the selected stretch of a row, `x` (and `x2`) in the row's own units
        if (o.tone === "caret" || o.tone === "range") {
          const rowX = contentXUnits + (page.find((p) => p.rowIndex === o.row)?.x ?? 0);
          if (o.tone === "range") return <rect key={`ov${k}`} x={rowX + Math.min(o.x, o.x2)} y={y + h * 0.18} width={Math.abs(o.x2 - o.x)} height={h * 0.8} fill="rgba(37,99,235,.22)" pointerEvents="none" data-overlay="range" />;
          return <line key={`ov${k}`} className="propis-caret" x1={rowX + o.x} y1={y + h * 0.18} x2={rowX + o.x} y2={y + h * 0.98} stroke="#1d4ed8" strokeWidth={h * 0.035} strokeLinecap="round" pointerEvents="none" data-overlay="caret" />;
        }
        return <rect key={`ov${k}`} x="0" y={y} width={PAGE_W_UNITS} height={h} fill={OVERLAY_FILL[o.tone] ?? OVERLAY_FILL.select} pointerEvents="none" data-overlay={o.tone} />;
      })}
      {brand && (
        <BrandMarks w={PAGE_W_UNITS} h={PAGE_H_UNITS} marginX={wideRows && (margin === "left" || margin === "right") ? marginXUnits : null}
          innerLeft={geom.pairedSlots ? !isLeftSlot : pageIndex % 2 === 0} />
      )}
      {pageNumber != null && (() => {
        const outerLeft = geom.pairedSlots ? isLeftSlot : pageIndex % 2 === 1;
        const r = mmToNativeUnits(PAGE_NUMBER_R_MM);
        const cx = outerLeft ? mmToNativeUnits(PAGE_NUMBER_INSET_MM) : PAGE_W_UNITS - mmToNativeUnits(PAGE_NUMBER_INSET_MM);
        const cy = PAGE_H_UNITS - mmToNativeUnits(PAGE_NUMBER_INSET_MM);
        return (
          <g data-page-number={pageNumber}>
            <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#c7cdd4" strokeWidth={r * 0.08} />
            <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontFamily="Nunito, sans-serif" fontWeight="700" fontSize={r * (pageNumber > 99 ? 0.85 : 1.05)} fill="#6b7280">{pageNumber}</text>
          </g>
        );
      })()}
    </svg>
  );
}

// Pinch-zoom/pan for the on-screen "Тетрадный лист" preview (2026-09-21, "насколько сложно
// сделать зум с пальцами тетрадного листа... чтобы рассмотреть подробнее") -- can't lean on
// the browser's own native pinch-zoom here: index.html's viewport meta sets
// `user-scalable=no, maximum-scale=1.0` app-wide (deliberate, to stop accidental page-zoom
// during normal drag/tap interactions elsewhere in the app), so this has to be a small
// self-contained gesture handler scoped to just this one screen, not a CSS-only trick.
// Kept as plain DOM listeners + a mutable ref (not React state) for the live scale/pan --
// touchmove can fire dozens of times a frame, and re-rendering PrintPage's whole SVG tree on
// every one would be needless work when only a CSS transform on the wrapping div is needed.
// `isZoomed` is the one bit that DOES go through React state, and only flips on meaningful
// transitions (gesture end, double-tap, explicit reset) -- cheap, and it's what the floating
// reset button's visibility depends on.
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 24;

function usePinchZoom(wrapRef, contentRef) {
  const [isZoomed, setIsZoomed] = useState(false);
  const state = useRef({ scale: 1, tx: 0, ty: 0 });
  const gesture = useRef({ pinch: null, pan: null, lastTap: null });

  const apply = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const { scale, tx, ty } = state.current;
    content.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }, [contentRef]);

  // Content is centered in the wrap, so panning range grows with how far past 1x we've
  // zoomed -- half the wrap's own size times (scale-1) keeps the zoomed content from being
  // dragged entirely off screen in either direction.
  const clamp = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const { scale } = state.current;
    const rect = wrap.getBoundingClientRect();
    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;
    state.current.tx = Math.max(-maxX, Math.min(maxX, state.current.tx));
    state.current.ty = Math.max(-maxY, Math.min(maxY, state.current.ty));
  }, [wrapRef]);

  const reset = useCallback(() => {
    state.current = { scale: 1, tx: 0, ty: 0 };
    apply();
    setIsZoomed(false);
  }, [apply]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const dist = (t0, t1) => Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

    function onTouchStart(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t0, t1] = e.touches;
        gesture.current.pinch = { dist: dist(t0, t1), ...state.current };
        gesture.current.pan = null;
        return;
      }
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      gesture.current.pan = { x: t.clientX, y: t.clientY, tx: state.current.tx, ty: state.current.ty };
      gesture.current.pinch = null;

      const now = Date.now();
      const last = gesture.current.lastTap;
      const isDoubleTap = last && now - last.time < DOUBLE_TAP_MS
        && Math.hypot(t.clientX - last.x, t.clientY - last.y) < DOUBLE_TAP_SLOP_PX;
      if (isDoubleTap) {
        e.preventDefault();
        gesture.current.lastTap = null;
        if (state.current.scale > ZOOM_MIN + 0.01) {
          reset();
        } else {
          state.current = { scale: 2, tx: 0, ty: 0 };
          apply();
          setIsZoomed(true);
        }
        return;
      }
      gesture.current.lastTap = { time: now, x: t.clientX, y: t.clientY };
    }

    function onTouchMove(e) {
      if (e.touches.length === 2 && gesture.current.pinch) {
        e.preventDefault();
        const [t0, t1] = e.touches;
        const { dist: startDist, scale: startScale, tx: startTx, ty: startTy } = gesture.current.pinch;
        state.current.scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, startScale * (dist(t0, t1) / startDist)));
        // Pinch also drifts tx/ty proportionally so the gesture reads as "zoom about roughly
        // where my fingers are", not "zoom about the exact center every time".
        state.current.tx = startTx * (state.current.scale / startScale);
        state.current.ty = startTy * (state.current.scale / startScale);
        clamp();
        apply();
        return;
      }
      if (e.touches.length === 1 && gesture.current.pan && state.current.scale > ZOOM_MIN + 0.01) {
        e.preventDefault();
        const t = e.touches[0];
        state.current.tx = gesture.current.pan.tx + (t.clientX - gesture.current.pan.x);
        state.current.ty = gesture.current.pan.ty + (t.clientY - gesture.current.pan.y);
        clamp();
        apply();
      }
    }

    function onTouchEnd(e) {
      if (e.touches.length < 2) gesture.current.pinch = null;
      if (e.touches.length === 0) gesture.current.pan = null;
      if (state.current.scale <= ZOOM_MIN + 0.01) {
        state.current = { scale: 1, tx: 0, ty: 0 };
        apply();
        setIsZoomed(false);
      } else {
        setIsZoomed(true);
      }
    }

    // Trackpad pinch on desktop arrives as wheel events with ctrlKey set (both Chrome and
    // Safari's convention) -- handled the same way as a real touch pinch for easier testing
    // without a phone, ctrl+scroll on a mouse is rare enough not to collide with anything else.
    function onWheel(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      state.current.scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.current.scale - e.deltaY * 0.01));
      clamp();
      apply();
      setIsZoomed(state.current.scale > ZOOM_MIN + 0.01);
    }

    wrap.addEventListener("touchstart", onTouchStart, { passive: false });
    wrap.addEventListener("touchmove", onTouchMove, { passive: false });
    wrap.addEventListener("touchend", onTouchEnd, { passive: false });
    wrap.addEventListener("touchcancel", onTouchEnd, { passive: false });
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      wrap.removeEventListener("touchstart", onTouchStart);
      wrap.removeEventListener("touchmove", onTouchMove);
      wrap.removeEventListener("touchend", onTouchEnd);
      wrap.removeEventListener("touchcancel", onTouchEnd);
      wrap.removeEventListener("wheel", onWheel);
    };
  }, [wrapRef, contentRef, apply, clamp, reset]);

  return { isZoomed, reset };
}

// "Тетрадный лист" (read_lines) — real print-page geometry (propisRuling.js's PRINT_*
// constants), not a scrolling container: one physical page shown at a time (Prev/Next), red
// margin line, exactly PRINT_ROWS_PER_PAGE (17) ruled rows always drawn regardless of
// content. Content comes from the params-screen line constructor (task.lines, one entry per
// notebook row) instead of a picked/typed whole text — see engine.js's read_lines branch.
//
// Added 2026-09-13 specifically so "Печать" produces a REAL PDF matching this screen
// mm-for-mm (window.print() + @page CSS sized to the exact physical page, see propis.css's
// print rules) — not just a similar-looking on-screen approximation.
// Row-local x of the nearest slant-grid line at (x, y) for a "Широкая строка" content row. The
// ruling phase depends on the physical page slot and the row's own Y, both derivable from the row
// index alone (WIDE_ROWS_PER_PAGE rows per page), so the layout can snap without knowing pages.
// The content's x offset on the page a row lands on (its page follows from its index alone); it only differs between
// pages when the `propis2` margin alternates.
const rowContentX = (rowIndex, margin, geom, narrow17, ownRows = null) => slotGeometry(Math.floor(rowIndex / perPageOf(geom, narrow17, ownRows)), true, margin, geom).contentXUnits;

// Squared paper: digits go into cells: `cell` tells the engine the cell size and where, in the row's own x, a vertical line of the grid
// is (the grid starts at the page's left edge, the content at the margin). Letters snap to an UNDRAWN slant grid of their own cell
// (the copybook's slant grid scaled with them): the joins of the copybook are measured on that grid; placed freely, every join came out
// longer (most of all the ones leaving the bottom of a letter: э ж о), so the words are exactly the copybook's, only smaller.
function squareSnapFor(margin, geom) {
  const step = TEXT_ROW_WIDE_DIAGONAL_SPACING * SQUARE_LETTER_SCALE;
  const snap = (_rowIndex, x, y) => {
    const lean = (WIDE_BAND_BOTTOM_LOCAL - y) * WIDE_SLANT_TAN;
    return Math.round((x - lean) / step) * step + lean;
  };
  snap.cell = { size: SQUARE_CELL, scale: SQUARE_LETTER_SCALE, origin: (rowIndex) => -rowContentX(rowIndex, margin, geom, true, "square") };
  return snap;
}

// Ruled paper (and the Bulgarian ruling, `scale` BG_LETTER_SCALE): no cells; the letters smaller (`letterScale`), on the same undrawn
// slant grid scaled with them (see squareSnapFor).
function ruledSnapFor(scale = RULED_LETTER_SCALE) {
  const step = TEXT_ROW_WIDE_DIAGONAL_SPACING * scale;
  const snap = (_rowIndex, x, y) => {
    const lean = (WIDE_BAND_BOTTOM_LOCAL - y) * WIDE_SLANT_TAN;
    return Math.round((x - lean) / step) * step + lean;
  };
  snap.letterScale = scale;
  return snap;
}

const narrowSnapFor = (margin, geom, narrow17) => (rowIndex, x, y) => {
  const contentXUnits = rowContentX(rowIndex, margin, geom, narrow17);
  const yAbs = rowOriginY(rowIndex + (narrow17 ? 0 : 1)) + n17Shift(narrow17) + y;
  const k = Math.round((contentXUnits + x - narrowLineX(0, yAbs)) / NARROW_CELL);
  return narrowLineX(k, yAbs) - contentXUnits;
};
// `propis2`, the narrow row on the sparse slant or none: the hidden grid the letters snap to starts again in every row, on the row's own
// baseline (as the wide row's does), so a row's first letter stands at one place in every row (owner, 2026-10-25). On the page-long grid
// it moved by up to a cell from row to row. Nothing is drawn of this grid; the dense slant (drawn, continuous) keeps the page-long one.
const narrowRowSnapFor = (margin, geom, narrow17) => (rowIndex, x, y) => {
  const contentXUnits = rowContentX(rowIndex, margin, geom, narrow17);
  const lineX = (k) => NARROW_FIRST_X + k * NARROW_CELL + (WIDE_BAND_BOTTOM_LOCAL - y) * WIDE_SLANT_TAN;
  const k = Math.round((contentXUnits + x - lineX(0)) / NARROW_CELL);
  return lineX(k) - contentXUnits;
};

const wideSnapFor = (margin, geom) => (rowIndex, x, y) => {
  const contentXUnits = rowContentX(rowIndex, margin, geom, false);
  // slant line k at local height y (see wideLineX): nearest line to the point, row-local x back out
  const k = Math.round((contentXUnits + x - wideLineX(0, y)) / TEXT_ROW_WIDE_DIAGONAL_SPACING);
  return wideLineX(k, y) - contentXUnits;
};

// `propis2`, dense grid: letters snap to the lines that are actually drawn (SHEET_DIAGONAL_LINES_NARROW_DENSE on the narrow
// row, SHEET_DIAGONAL_LINES_WIDE_DENSE on the wide one), not to the hidden methodology grid. Line n of such a grid
// stands at x = n*step - y*tan on its page (see buildDiagonalLines) and every odd page is shifted by one page width,
// exactly as PrintPage draws it; the page of a row follows from its index alone (WIDE_ROWS_PER_PAGE rows per page).
function drawnGridSnapX(step, margin, geom, narrow17 = false) {
  const perPage = perPageOf(geom, narrow17);
  return (rowIndex, x, y) => {
    const pageIdx = Math.floor(rowIndex / perPage);
    const contentXUnits = slotGeometry(pageIdx, true, margin, geom).contentXUnits;
    const yAbs = rowOriginY((rowIndex % perPage) + (narrow17 ? 0 : 1)) + n17Shift(narrow17) + y;
    const shift = pageIdx % 2 === 0 || !geom.pairedSlots ? 0 : -geom.w;
    const base = shift - yAbs * WIDE_SLANT_TAN;
    const n = Math.round((contentXUnits + x - base) / step);
    return base + n * step - contentXUnits;
  };
}

// The function that puts a letter's start on a line of the grid the page is drawn with (the layout and the text wrapping of
// `propis2` must use the SAME one: a word placed on the grid is wider than the same word measured freely).
// The same function for the same page parameters (`cacheable`): the layout keeps finished rows per grid function (wordEngine.js).
const SNAP_FNS = new Map();
// the show panel's window (focus): room for the pen above (and, to keep the row in the middle, below) the row; margin beside the ink
const FOCUS_PEN_ROOM = 44;
const FOCUS_SIDE = 40;
// `pageShift` (0 / 1): the parity of the notebook page the run starts on. A page is drawn by its place in the whole notebook (margin side,
// slant grid shifted by a page width on the right half of a sheet); a run of a notebook on several papers starting on an odd page used to
// snap its letters as if it started on an even one — off the drawn slants by 0.7 of a cell (3.5 mm on the wide row) and to the other
// margin (owner, 2026-10-24: «on the dense slant the letters are not on the lines»). The run's rows are counted on by one page for it.
export function snapXFor(args) {
  const shift = (args.pageShift ?? 0) % 2;
  const key = JSON.stringify([args.narrowRows, args.simpleGrid, args.margin ?? "off", args.format ?? "a5", args.narrow17 ?? false, shift]);
  let fn = SNAP_FNS.get(key);
  if (!fn) {
    const base = makeSnapX(args);
    if (!shift) fn = base;
    else {
      const per = perPageOf(geomOf(args.format ?? "a5"), args.narrow17 ?? false, OWN_ROWS[args.simpleGrid] ? args.simpleGrid : null);
      fn = (rowIndex, x, y) => base(rowIndex + per, x, y);
      if (base.hidden) fn.hidden = true;
      if (base.drawn) fn.drawn = true;
      if (base.letterScale) fn.letterScale = base.letterScale;
      if (base.cell) fn.cell = { ...base.cell, origin: (rowIndex) => base.cell.origin(rowIndex + per) };
    }
    fn.cacheable = true;
    SNAP_FNS.set(key, fn);
  }
  return fn;
}
function makeSnapX({ narrowRows, simpleGrid, margin = "off", format = "a5", narrow17 = false }) {
  const geom = geomOf(format);
  if (simpleGrid === "square") return squareSnapFor(margin, geom);
  if (simpleGrid === "ruled") return ruledSnapFor();
  if (simpleGrid === "bg") return ruledSnapFor(BG_LETTER_SCALE);
  const dense = simpleGrid === "dense";
  if (dense) {
    const drawn = narrowRows ? drawnGridSnapX(NARROW_CELL, margin, geom, narrow17) : drawnGridSnapX(TEXT_ROW_WIDE_DIAGONAL_SPACING, margin, geom);
    drawn.drawn = true; // its lines are drawn on the page: the layout may put a letter on one even where it keeps a gap (wordEngine `#v`)
    return drawn;
  }
  // the methodology grid the letters snap to is NOT drawn on these pages (only the 20 mm slants): `hidden` tells the layout so
  // (a digit inside a number then keeps a steady gap to the one before instead of jumping to the next invisible line)
  const fn = narrowRows ? (simpleGrid ? narrowRowSnapFor : narrowSnapFor)(margin, geom, narrow17) : wideSnapFor(margin, geom);
  fn.hidden = true;
  return fn;
}

// A task laid out and cut into pages, with what drawing a page of it needs (the viewer, and the print of a document in parts).
function layoutTaskPages(task) {
  const lettersByLabel = new Map();
  for (const item of task?.letters ?? []) lettersByLabel.set(item.label ?? item.id, item);
  const connectorsByKey = new Map();
  for (const item of task?.connectors ?? []) {
    const key = `${item.fromLine}_${item.toLine}`;
    const list = connectorsByKey.get(key);
    if (list) list.push(item);
    else connectorsByKey.set(key, [item]);
  }
  const punctuationByLabel = new Map();
  for (const item of task?.punctuation ?? []) punctuationByLabel.set(item.label ?? item.id, item);
  const elementsByLabel = new Map();
  for (const item of task?.elements ?? []) elementsByLabel.set(item.id, item);
  const lines = task?.lines ?? [];
  const wideRows = Boolean(task?.wideRows);
  const margin = task?.margin === "left" || task?.margin === "right" ? task.margin : "off";
  const geom = geomOf(task?.format);
  const rowMaxX = geom.maxX - (margin === "off" ? 0 : propis2MarginUnits());
  const narrowRows = wideRows && Boolean(task?.narrowRows);
  const narrow17 = narrowRows && Boolean(task?.narrow17);
  const ownRows = wideRows && OWN_ROWS[task?.simpleGrid] ? task.simpleGrid : null;
  const perPage = perPageOf(geom, narrow17, ownRows);
  const useElements = Boolean(task?.useElements) && !wideRows;
  // elements.json entries captured on the wide zone ride along by id (same capture grid, so
  // they get the same grid stretch); wide.json glyphs win and also register their aliases.
  const wideGlyphsByLabel = new Map();
  for (const el of task?.elements ?? []) wideGlyphsByLabel.set(el.id, { label: el.id, kind: "element", strokes: el.strokes, stretch: WIDE_GRID_STRETCH, repeatCells: task?.wideElementRepeat?.[el.id] });
  for (const item of task?.wideGlyphs ?? []) {
    wideGlyphsByLabel.set(item.label, item);
    for (const alias of item.aliases ?? []) wideGlyphsByLabel.set(alias, item);
  }
  if (task?.script) wideGlyphsByLabel.script = task.script; // `propis2` variant decks: their own slant and heights (scriptGeometry.js)
  const layout = wideRows
    ? layoutWideLinesIntoRows(lines, wideGlyphsByLabel, snapXFor({ narrowRows, simpleGrid: task?.simpleGrid, margin, format: geom.format, narrow17, pageShift: (Number(task?.firstPage) || 0) % 2 }), true, narrowRows ? NARROW_SCALE : 1, rowMaxX)
    : useElements
      ? layoutElementLinesIntoRows(lines, elementsByLabel, CONTENT_W_UNITS)
      : layoutTextIntoRows(lines.join("\n"), lettersByLabel, connectorsByKey, CONTENT_W_UNITS, undefined, punctuationByLabel);
  const pages = paginateRows(layout, wideRows ? perPage : PRINT_ROWS_PER_PAGE, { exact: Boolean(task?.exactPages), minPages: Number(task?.minPages) || 0 });
  return { lines, wideRows, margin, geom, narrowRows, narrow17, ownRows, perPage, useElements, pages, simpleGrid: task?.simpleGrid ?? null, noSlant: Boolean(task?.noSlant), midDash: task?.midDash !== false };
}

// The top rows of a page of a task (the first one by default), as printed (its own paper): the window on a notebook on its cover;
// `propis2`'s dictation review shows its answer pages this way, each cut after its last written row. `rows`: how much of the page, in its rows.
const TOP_DOCS = new WeakMap(); // task -> its layout: thumbnails of a notebook's pages are drawn again and again as the editor remounts
const topDoc = (task) => { if (!TOP_DOCS.has(task)) TOP_DOCS.set(task, layoutTaskPages(task)); return TOP_DOCS.get(task); };
// The pages of a task as { rows: the rows it writes on (its last written row + 1), perPage, w, h: the page's size in units }.
export function printPageRows(task) {
  const doc = topDoc(task);
  return doc.pages.map((p) => ({ rows: p.length ? Math.max(...p.map((x) => x.rowIndex)) + 1 : 0, perPage: doc.perPage, w: doc.geom.w, h: doc.geom.h }));
}
export function PrintPageTop({ task, rows = 5, page = 0 }) {
  const doc = useMemo(() => topDoc(task), [task]);
  const h = Math.min(doc.geom.h, doc.geom.h * ((rows + 0.6) / Math.max(1, doc.perPage)));
  return (
    <PrintPage page={doc.pages[page] ?? []} pageIndex={page} crop={{ x: 0, y: 0, w: doc.geom.w, h }} useElements={doc.useElements} wideRows={doc.wideRows} narrowRows={doc.narrowRows}
      simpleGrid={doc.simpleGrid} noSlant={doc.noSlant} midDash={doc.midDash} margin={doc.margin} format={doc.geom.format} narrow17={doc.narrow17} ownRows={doc.ownRows} />
  );
}

// Optional props (`propis2`, all inert when absent): `onFragmentTap` (see PrintPage), `bare` (only the page:
// no close/nav/print), `focus` (crop to the first row and animate it), `speedFactor`.
// A long document can be shown in parts (`propis2`: a notebook whose pages are on different paper is laid out one run of pages at a
// time): `pageBase` is the number of screen pages before this part, `pageTotal` the pages of the whole document, `onEdge(dir)` is
// called when ‹ is pressed on the first page of the part (dir -1) or › on its last one (dir +1), `startAt` is the page of the part it opens on
// (a number, or "last" when coming back from the next part), `onPageCount(n)` reports how many pages the part really takes;
// `onJump("first" | "last")` is called by « / » when the first / last page of the document is in another part. The page
// counter, `onPageIndexChange` and the side of the margin (it alternates from page to page) follow the whole document.
// `printParts`: the tasks of ALL the parts, in order: printing then prints the whole document, every part on its own paper (the
// pages numbered through, two A5 pages on an A4 sheet across the parts); without it the print is this task's pages.
// `onPrint`: the print button calls it instead of printing at once (a dialog that asks for a cover and page numbers first);
// `printCover`: a cover (an A5 / A4 page) printed before the pages, on its own sheet, followed by an empty sheet (its back, for
// printing on both sides); `printBack`: the back of the cover (owner, 2026-10-08: it is printed on the back of the front) — A5: the
// left half of the cover's landscape sheet; A4: the second sheet, in place of the empty one; `pageNumbers`: number the printed pages (the cover is not counted).
// `booklet` (A5 only): print «Тетрадью» — the pages in saddle-stitch order (booklet.js), padded with ruled pages to a multiple of 4; the
// cover sheet stays the outer one (white inside). `brandMarks`: the quiet Mironium mark on every printed page (brandMarks.jsx).
export default function PrintPageView({ task, onClose, onFragmentTap, onSheetPoint = null, bare = false, focus = false, fitAspect = 0, speedFactor = 1, overlays = null, onPageIndexChange = null, topNav = false, pageBase = 0, pageTotal = null, onEdge = null, onJump = null, startAt = 0, onPageCount = null, printParts = null, onPrint = null, printCover = null, printBack = null, pageNumbers = false, booklet = false, brandMarks = false }) {
  const own = useMemo(() => layoutTaskPages(task), [task]);
  const { lines, wideRows, margin, geom, narrowRows, narrow17, ownRows, perPage, useElements, pages } = own;
  // what printing prints: every page of the document with the paper it is laid out on
  const printPages = useMemo(() => {
    const parts = printParts?.length ? printParts.map((t) => (t === task ? own : layoutTaskPages(t))) : [own];
    return parts.flatMap((part) => part.pages.map((page) => ({ page, part })));
  }, [printParts, task, own]);

  const [pageIndex, setPageIndex] = useState(() => Math.max(0, Math.min(pages.length - 1, startAt === "last" ? pages.length - 1 : Number(startAt) || 0)));
  useEffect(() => { onPageIndexChange?.(pageBase + pageIndex); }, [pageIndex, pageBase, onPageIndexChange]);
  useEffect(() => { onPageCount?.(pages.length); }, [pages.length, onPageCount]);
  const total = Math.max(pageTotal ?? 0, pageBase + pages.length);
  const [activeIndex, setActiveIndex] = useState(focus ? 0 : null);
  useEffect(() => setActiveIndex(focus ? 0 : null), [pageIndex, focus]);
  // pages.length only shrinks if the task itself changes (new session) — clamp defensively
  // rather than let a stale pageIndex point past the end.
  useEffect(() => { if (pageIndex > pages.length - 1) setPageIndex(0); }, [pages.length, pageIndex]);

  const zoomWrapRef = useRef(null);
  const zoomContentRef = useRef(null);
  const { isZoomed, reset: resetZoom } = usePinchZoom(zoomWrapRef, zoomContentRef);
  useEffect(() => { resetZoom(); }, [pageIndex, resetZoom]);

  const canPrev = pageIndex > 0 || Boolean(onEdge && pageBase > 0);
  const canNext = pageIndex < pages.length - 1 || Boolean(onEdge && pageBase + pages.length < total);
  const goPrev = () => { if (pageIndex > 0) setPageIndex(pageIndex - 1); else if (canPrev) onEdge(-1); };
  const goNext = () => { if (pageIndex < pages.length - 1) setPageIndex(pageIndex + 1); else if (canNext) onEdge(1); };
  // « / »: to the first / last page of the whole document (owner, 2026-10-23: a 24-page notebook is a long way page by page)
  const canFirst = pageBase + pageIndex > 0;
  const canLast = pageBase + pageIndex < total - 1;
  const goFirst = () => { if (pageBase > 0 && onJump) onJump("first"); else setPageIndex(0); };
  const goLast = () => { if (pageBase + pages.length < total && onJump) onJump("last"); else setPageIndex(pages.length - 1); };

  // `focus`: a window on the first row only (the show panel). The writing row stands in the MIDDLE of the window (the room left
  // for the pen above it is left below it too) and the window is centred on the ink of the sample, not on the row's start; with
  // `fitAspect` (the stage's width / height) the window takes the stage's shape, so the ruling runs across the whole stage and the
  // sample is as large as the stage allows: a single letter fills the height, a word the width.
  const focusCrop = (() => {
    if (!focus) return null;
    const first = (pages[0] ?? [])[0];
    if (!first) return null;
    const { contentXUnits } = slotGeometry(0, wideRows, margin, geom);
    const row = wideRows ? first.rowIndex + (narrow17 ? 0 : 1) : first.rowIndex;
    const xs = first.segments.flatMap((seg) => seg.strokes ?? []).flatMap((st) => (st.d.match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 0));
    const inkL = contentXUnits + first.x + (xs.length ? Math.min(...xs) : 0);
    const inkR = contentXUnits + first.x + (xs.length ? Math.max(...xs) : first.segments.reduce((sum, seg) => sum + seg.width, 0));
    // the band the letters stand in, with what rises above and hangs below it (page y)
    const [top, bottom] = ownRows
      ? [ownRowY(first.rowIndex, ownRows) + WIDE_BAND_BOTTOM_LOCAL - 0.8 * ownOf(ownRows).pitch, ownRowY(first.rowIndex, ownRows) + WIDE_BAND_BOTTOM_LOCAL + 0.45 * ownOf(ownRows).pitch]
      : narrowRows
        ? [rowOriginY(row) + n17Shift(narrow17) + NARROW_GUIDE_LOCAL - 6, rowOriginY(row) + n17Shift(narrow17) + WIDE_BAND_BOTTOM_LOCAL + 30]
        : [wideBandTop(row) - 12, wideBandTop(row) + wideBandHeight + 60];
    const room = FOCUS_PEN_ROOM; // the pen leans up and right of its tip: as much room above the row as below it
    const h = bottom - top + 2 * room;
    // wider to the stage's shape (the ruling across the whole stage); a long word that is wider stays so, the stage centres it vertically
    const w = Math.max(inkR - inkL + 2 * FOCUS_SIDE, fitAspect > 0 ? h * fitAspect : h * 0.9);
    const cx = (inkL + inkR) / 2;
    const cy = (top + bottom) / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h, row: wideRows ? row : first.rowIndex };
  })();

  if (bare) {
    // `bare` without `focus` is the editor's live preview: the page as printed, with a small page switcher.
    const shownIndex = focus ? 0 : Math.min(pageIndex, Math.max(0, pages.length - 1));
    return (
      <div className="propis-practice-stage propis-practice-stage--bare">
        <div className="propis-print-frame">
          <div className="propis-print-page-wrap">
            <PrintPage
              page={pages[shownIndex] ?? []}
              pageIndex={shownIndex}
              activeIndex={focus ? 0 : null}
              onToggleActive={focus ? () => {} : null}
              crop={focusCrop}
              speedFactor={speedFactor}
              simpleGrid={task?.simpleGrid ?? null} noSlant={Boolean(task?.noSlant)} midDash={task?.midDash !== false} margin={margin} format={geom.format} narrow17={narrow17} ownRows={ownRows}
              overlays={overlays?.filter((o) => Math.floor(o.row / perPage) === shownIndex).map((o) => ({ ...o, row: o.row % perPage }))}
              onSheetPoint={onSheetPoint ? (p) => onSheetPoint({ ...p, row: p.row < 0 ? -1 : shownIndex * perPage + p.row }) : null}
              useElements={useElements}
              wideRows={wideRows}
              narrowRows={narrowRows}
            />
          </div>
          {!focus && pages.length > 1 && (
            <div className="propis-text-nav">
              <button type="button" className="propis-ctrl-btn" onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={shownIndex === 0} aria-label="Предыдущая страница предпросмотра">‹</button>
              <span className="propis-text-nav__counter">Страница {shownIndex + 1} из {pages.length}</span>
              <button type="button" className="propis-ctrl-btn" onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))} disabled={shownIndex >= pages.length - 1} aria-label="Следующая страница предпросмотра">›</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="propis-practice-stage">
      <button type="button" className="propis-ctrl-btn propis-practice-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-print-frame">
        {lines.length === 0 && !(task?.minPages > 0) ? (
          <div className="propis-empty-hint">
            Для этого занятия не набрано ни одной строки.
          </div>
        ) : (
          <>
            <div className="propis-print-page-wrap" ref={zoomWrapRef}>
              <div className="propis-print-page-zoom" ref={zoomContentRef}>
                <PrintPage
                  page={pages[pageIndex] ?? []}
                  pageIndex={pageBase + pageIndex}
                  activeIndex={activeIndex}
                  onToggleActive={(i) => setActiveIndex((cur) => (cur === i ? null : i))}
                  onFragmentTap={onFragmentTap}
                  speedFactor={speedFactor}
                  useElements={useElements}
                  wideRows={wideRows}
                  narrowRows={narrowRows}
                  simpleGrid={task?.simpleGrid ?? null} noSlant={Boolean(task?.noSlant)} midDash={task?.midDash !== false} margin={margin} format={geom.format} narrow17={narrow17} ownRows={ownRows}
                />
              </div>
              {isZoomed && (
                <button
                  type="button"
                  className="propis-print-zoom-reset"
                  onClick={resetZoom}
                  aria-label="Сбросить масштаб"
                >
                  1×
                </button>
              )}
            </div>

            <div className={topNav ? "propis-text-nav propis-text-nav--top" : "propis-text-nav"}>
              <button type="button" className="propis-ctrl-btn" onClick={goFirst} disabled={!canFirst} aria-label="В начало" title="В начало">«</button>
              <button
                type="button"
                className="propis-ctrl-btn"
                onClick={goPrev}
                disabled={!canPrev}
                aria-label="Предыдущая страница"
              >
                ‹
              </button>
              <span className="propis-text-nav__counter" title={`Страница ${pageBase + pageIndex + 1} из ${total}`}>{topNav ? `${pageBase + pageIndex + 1} / ${total}` : `Страница ${pageBase + pageIndex + 1} из ${total}`}</span>
              <button
                type="button"
                className="propis-ctrl-btn"
                onClick={goNext}
                disabled={!canNext}
                aria-label="Следующая страница"
              >
                ›
              </button>
              <button type="button" className="propis-ctrl-btn" onClick={goLast} disabled={!canLast} aria-label="В конец" title="В конец">»</button>
              <button type="button" className="propis-ctrl-btn propis-print-btn" onClick={() => (onPrint ? onPrint() : window.print())} aria-label="Печать" title="Печать">
                {topNav ? "🖨" : "🖨 Печать"}
              </button>
            </div>

            {/* Print-only: pages 0/1 share ONE physical A4-landscape sheet (left slot + right
                slot side by side), 2/3 share the next sheet, etc. — matching the real
                propis_worksheets PDFs (one A4-landscape page, not two separate A5 pages per
                sheet). paginateRows already guarantees an even page count, so every sheet is
                a full pair (never an odd one left over). propis.css's @media print rules
                size each .propis-print-all__sheet to the real 297x210mm and force a page
                break between sheets, not between the two slots on the same sheet — the
                interactive Prev/Next view above is hidden while printing instead.
                Portaled straight to <body> (2026-09-13): Chrome's print engine only ever
                paints ONE page for content nested inside a `position: fixed` ancestor
                (.propis-practice-stage, this view's own root) — a well-known print
                limitation, not a bug in the page-break CSS itself (confirmed: the very
                same markup prints correctly once moved outside that ancestor). A portal
                sidesteps it entirely rather than fighting position/overflow overrides on
                every ancestor in the chain. */}
            {createPortal(
              <div className="propis-print-all" aria-hidden="true">
                {printCover && (geom.pairedSlots ? (
                  <>
                    {/* the cover on the right half of a landscape sheet, the back cover on its left half, then the empty back of that sheet */}
                    <div className="propis-print-all__sheet"><div className="propis-print-cover propis-print-cover--back">{printBack}</div><div className="propis-print-cover">{printCover}</div><FoldLine />{booklet && <StapleMarks ovals={false} />}</div>
                    <div className="propis-print-all__sheet" />
                  </>
                ) : (
                  <>
                    <div className="propis-print-all__sheet propis-print-all__sheet--a4"><div className="propis-print-cover propis-print-cover--a4">{printCover}</div></div>
                    <div className="propis-print-all__sheet propis-print-all__sheet--a4">{printBack && <div className="propis-print-cover propis-print-cover--a4 propis-print-cover--back">{printBack}</div>}</div>
                  </>
                ))}
                {geom.pairedSlots && booklet
                  ? bookletSheets(printPages.length).flatMap(({ front, back }, sheetIndex) => [front, back].map((pair, side) => (
                    <div key={`${sheetIndex}-${side}`} className="propis-print-all__sheet">
                      {pair.map((pi, slot) => {
                        // a padding page is ruled like the last page of the notebook, and numbered on
                        const { page = [], part } = printPages[pi] ?? { part: printPages[printPages.length - 1]?.part ?? own };
                        // the slot (0 left, 1 right) is the page's side in the open notebook: margin, page number and mark follow it
                        return <PrintPage key={slot} page={page} pageIndex={slot} gridIndex={pi} pageNumber={pageNumbers ? pi + 1 : null} brand={brandMarks} useElements={part.useElements} wideRows={part.wideRows} narrowRows={part.narrowRows} simpleGrid={part.simpleGrid} noSlant={part.noSlant} midDash={part.midDash} margin={part.margin} format={part.geom.format} narrow17={part.narrow17} ownRows={part.ownRows} />;
                      })}
                      <StapleMarks />
                    </div>
                  )))
                  : geom.pairedSlots
                  ? Array.from({ length: Math.ceil(printPages.length / 2) }, (_, sheetIndex) => (
                    <div key={sheetIndex} className="propis-print-all__sheet">
                      {[0, 1].map((slot) => {
                        const pi = sheetIndex * 2 + slot;
                        // the empty right half of the last sheet (an odd number of pages) is ruled like the page beside it
                        const { page = [], part } = printPages[pi] ?? { part: printPages[pi - 1]?.part ?? own };
                        return <PrintPage key={slot} page={page} pageIndex={pi} pageNumber={pageNumbers && printPages[pi] ? pi + 1 : null} brand={brandMarks} useElements={part.useElements} wideRows={part.wideRows} narrowRows={part.narrowRows} simpleGrid={part.simpleGrid} noSlant={part.noSlant} midDash={part.midDash} margin={part.margin} format={part.geom.format} narrow17={part.narrow17} ownRows={part.ownRows} />;
                      })}
                    </div>
                  ))
                  : printPages.map(({ page, part }, pi) => (
                    <div key={pi} className="propis-print-all__sheet propis-print-all__sheet--a4">
                      <PrintPage page={page} pageIndex={pi} pageNumber={pageNumbers ? pi + 1 : null} brand={brandMarks} useElements={part.useElements} wideRows={part.wideRows} narrowRows={part.narrowRows} simpleGrid={part.simpleGrid} noSlant={part.noSlant} midDash={part.midDash} margin={part.margin} format={part.geom.format} narrow17={part.narrow17} ownRows={part.ownRows} />
                    </div>
                  ))}
              </div>,
              document.body
            )}
          </>
        )}
      </div>
    </div>
  );
}
