import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { layoutTextIntoRows, layoutElementLinesIntoRows, layoutWideLinesIntoRows, WIDE_GRID_STRETCH, paginateRows } from "./wordEngine.js";
import AnimatedStrokes from "./AnimatedStrokes.jsx";
import {
  INK_COLOR, NATIVE_L3, TEXT_ROW_WIDE_DIAGONAL_SPACING,
  TEXT_ROW_PITCH, TEXT_ROW_THIN_OFFSET, TEXT_ROW_DIAGONAL_SPACING, TEXT_ROW_ELEMENT_DIAGONAL_SPACING,
  ANGLE_FROM_HORIZONTAL_DEG,
  buildDiagonalLines, mmToNativeUnits,
  PRINT_PAGE_W_MM, PRINT_PAGE_H_MM, PRINT_MARGIN_MM, PRINT_LEFT_INSET_MM, PRINT_CENTER_INSET_MM,
  PRINT_CONTENT_W_MM, PRINT_FIRST_BASELINE_MM, PRINT_ROWS_PER_PAGE,
} from "./propisRuling.js";

const PAGE_W_UNITS = mmToNativeUnits(PRINT_PAGE_W_MM);
const PAGE_H_UNITS = mmToNativeUnits(PRINT_PAGE_H_MM);
const CONTENT_W_UNITS = mmToNativeUnits(PRINT_CONTENT_W_MM);

// Shifts row 0's baseline from wherever buildWordTrajectory's own native coordinate system
// bakes it (NATIVE_L3=88 — a property of the captured letter PATHS themselves, not of this
// page) down to the real print page's own first-baseline position (PRINT_FIRST_BASELINE_MM,
// 12mm from the physical top — see that constant's own comment for the reportlab bottom-up
// axis gotcha). Constant across every row —
// only the whole grid's vertical anchor moves, row-to-row spacing (TEXT_ROW_PITCH) doesn't.
const ROW_Y_SHIFT = NATIVE_L3 - mmToNativeUnits(PRINT_FIRST_BASELINE_MM);
const rowOriginY = (row) => row * TEXT_ROW_PITCH - ROW_Y_SHIFT;

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
function slotGeometry(pageIndex, compact = false) {
  const isLeftSlot = pageIndex % 2 === 0;
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
const SHEET_DIAGONAL_LINES = buildDiagonalLines(PAGE_H_UNITS, PAGE_W_UNITS * 2, TEXT_ROW_DIAGONAL_SPACING);
// "Элементы букв" pages use a much denser diagonal backing than ordinary text pages -- see
// TEXT_ROW_ELEMENT_DIAGONAL_SPACING's own comment (propisRuling.js) for why the standard
// 20mm spacing doesn't work for these: most elements are narrower than one 20mm gap, so a
// whole крючок/заборчик could render with no slant guide crossing it at all.
const SHEET_DIAGONAL_LINES_DENSE = buildDiagonalLines(PAGE_H_UNITS, PAGE_W_UNITS * 2, TEXT_ROW_ELEMENT_DIAGONAL_SPACING);
// "Широкая строка": every wide band carries its OWN slant grid, phased on the band's bottom line, so the
// first slant meets the bottom (and the top) horizontal at the same distance from the page's left edge in
// every row (a page-long grid would shift by 3.6 units per row). Distance of that first crossing:
const WIDE_GRID_FIRST_X = 15; // units (2.5mm) from the left edge, on the band's bottom line
const WIDE_SLANT_TAN = Math.tan(((90 - ANGLE_FROM_HORIZONTAL_DEG) * Math.PI) / 180);
// slant line k of a band at height y (row-local coordinates: the band's bottom line is y = NATIVE_L3 - TEXT_ROW_THIN_OFFSET)
const WIDE_BAND_BOTTOM_LOCAL = NATIVE_L3 - TEXT_ROW_THIN_OFFSET;
const wideLineX = (k, yLocal) => WIDE_GRID_FIRST_X + k * TEXT_ROW_WIDE_DIAGONAL_SPACING + (WIDE_BAND_BOTTOM_LOCAL - yLocal) * WIDE_SLANT_TAN;
const WIDE_LINE_COUNT = Math.ceil((PAGE_W_UNITS + (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET) * WIDE_SLANT_TAN) / TEXT_ROW_WIDE_DIAGONAL_SPACING) + 2;
// "Узкая строка" (методика, часть 2): the same captured glyphs at half size. Band = 24 units (4 mm) standing on the
// baseline (row-local y = 64), thin line on top, dashed middle, bold baseline; a dashed guide in the middle of the gap
// between bands (ascender / descender limit); a short bold bar at the left edge of each band. The 65deg slants (cell
// 15 units) run through the WHOLE page, not only inside the bands.
const NARROW_SCALE = 0.5;
const NARROW_CELL = TEXT_ROW_WIDE_DIAGONAL_SPACING * NARROW_SCALE;
const NARROW_BAND_H = (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET) * NARROW_SCALE;
const NARROW_GUIDE_LOCAL = NATIVE_L3 - TEXT_ROW_PITCH; // 16: dashed limit line above the band
const NARROW_FIRST_X = 15;
const NARROW_START_DOT_R = 2;
const NARROW_BAR_W = 1.4;
const narrowYRef = () => rowOriginY(1) + WIDE_BAND_BOTTOM_LOCAL;
const narrowLineX = (k, yAbs) => NARROW_FIRST_X + k * NARROW_CELL + (narrowYRef() - yAbs) * WIDE_SLANT_TAN;
const ROW_INDICES = Array.from({ length: PRINT_ROWS_PER_PAGE }, (_, i) => i);
// "Широкая строка": the ordinary 17-row cycle, but ruling row 0 is only the TOP edge of the first
// wide band (its own bold baseline) -- content rows start at ruling row 1, so 16 per page, and
// the first band doesn't sit cut off against the physical page edge.
const WIDE_ROWS_PER_PAGE = PRINT_ROWS_PER_PAGE - 1;
// Slants are drawn only inside each wide band (previous baseline down to this row's thin line);
// the narrow strip below stays blank, as in the original workbook.
const wideBandTop = (row) => rowOriginY(row) + NATIVE_L3 - TEXT_ROW_PITCH;
const wideBandHeight = TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET;

// «Прописи 2» editor: which content row (0-based, on one page) a point at svg-y `y` belongs to; -1 outside
// the ruled rows. A row owns the strip from its previous baseline down to its own baseline (the same
// for the narrow and wide rulings: both stand on the same 72-unit pitch).
export function rowAtSvgY(y) {
  const top = rowOriginY(1) + NATIVE_L3 - TEXT_ROW_PITCH;
  const r = Math.floor((y - top) / TEXT_ROW_PITCH);
  return r >= 0 && r < WIDE_ROWS_PER_PAGE ? r : -1;
}
const overlayRect = (r) => ({ y: rowOriginY(r + 1) + NATIVE_L3 - TEXT_ROW_PITCH, h: TEXT_ROW_PITCH });
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
// `onFragmentTap` (optional, «Прописи 2»): tap reports the row and the tap's x inside it instead of toggling the
// inline animation. `crop` (optional): show only a window of the page (the show panel's single row).
// `speedFactor` slows/speeds the pen animation.
function PrintPage({ page, pageIndex, activeIndex, onToggleActive, onFragmentTap, crop = null, speedFactor = 1, overlays = null, useElements, wideRows = false, narrowRows = false }) {
  const { isLeftSlot, marginXUnits, contentXUnits } = slotGeometry(pageIndex, wideRows);
  const diagonalShiftX = isLeftSlot ? 0 : -PAGE_W_UNITS;
  const diagonalLines = useElements ? SHEET_DIAGONAL_LINES_DENSE : SHEET_DIAGONAL_LINES;
  const guideColor = wideRows ? WIDE_GUIDE_COLOR : GUIDE_COLOR;
  const contentRow = (r) => (wideRows ? r + 1 : r);
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
      viewBox={crop ? `${crop.x} ${crop.y} ${crop.w} ${crop.h}` : `0 0 ${PAGE_W_UNITS} ${PAGE_H_UNITS}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
      {narrowRows && (() => {
        const kLo = Math.floor((-NARROW_FIRST_X - narrowYRef() * WIDE_SLANT_TAN) / NARROW_CELL);
        const kHi = Math.ceil((PAGE_W_UNITS - NARROW_FIRST_X - (narrowYRef() - PAGE_H_UNITS) * WIDE_SLANT_TAN) / NARROW_CELL);
        const ks = Array.from({ length: kHi - kLo + 1 }, (_, i) => kLo + i);
        return (
          <g data-narrow-grid="1">
            {ks.map((k) => (
              <line key={k} x1={narrowLineX(k, 0)} y1={0} x2={narrowLineX(k, PAGE_H_UNITS)} y2={PAGE_H_UNITS} stroke={guideColor} strokeWidth={GUIDE_DIAG_W} />
            ))}
            {ROW_INDICES.slice(1).map((row) => {
              const top = rowOriginY(row) + WIDE_BAND_BOTTOM_LOCAL - NARROW_BAND_H;
              const bottom = rowOriginY(row) + WIDE_BAND_BOTTOM_LOCAL;
              const guideY = rowOriginY(row) + NARROW_GUIDE_LOCAL;
              return (
                <g key={row} data-narrow-band={row}>
                  <line x1="0" y1={guideY} x2={PAGE_W_UNITS} y2={guideY} stroke={guideColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH} />
                  <line x1="0" y1={top} x2={PAGE_W_UNITS} y2={top} stroke={guideColor} strokeWidth={GUIDE_THIN_W} />
                  <line x1="0" y1={(top + bottom) / 2} x2={PAGE_W_UNITS} y2={(top + bottom) / 2} stroke={guideColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH} />
                  <line x1="0" y1={bottom} x2={PAGE_W_UNITS} y2={bottom} stroke={guideColor} strokeWidth={GUIDE_BOLD_W} />
                  <line x1={NARROW_BAR_W / 2} y1={top} x2={NARROW_BAR_W / 2} y2={bottom} stroke={guideColor} strokeWidth={NARROW_BAR_W} />
                </g>
              );
            })}
            {(() => {
              const lastY = rowOriginY(ROW_INDICES.length - 1) + WIDE_BAND_BOTTOM_LOCAL + NARROW_BAND_H;
              return <line x1="0" y1={lastY} x2={PAGE_W_UNITS} y2={lastY} stroke={guideColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH} />;
            })()}
          </g>
        );
      })()}
      {wideRows && !narrowRows ? ROW_INDICES.slice(1).map((row) => (
        <g key={`band${row}`} data-wide-band={row}>
          {Array.from({ length: WIDE_LINE_COUNT }, (_, k) => k - 1).map((k) => (
            <line
              key={k}
              x1={wideLineX(k, NATIVE_L3 - TEXT_ROW_PITCH)} y1={wideBandTop(row)}
              x2={wideLineX(k, WIDE_BAND_BOTTOM_LOCAL)} y2={wideBandTop(row) + wideBandHeight}
              stroke={guideColor} strokeWidth={GUIDE_DIAG_W}
            />
          ))}
        </g>
      )) : diagonalEls}
      {!narrowRows && ROW_INDICES.map((row) => (
        <g key={`g${row}`}>
          {(useElements || wideRows) && !(wideRows && row === 0) && (
            <line
              x1="0" y1={rowOriginY(row) + NATIVE_L3 - WIDE_MID_OFFSET}
              x2={PAGE_W_UNITS} y2={rowOriginY(row) + NATIVE_L3 - WIDE_MID_OFFSET}
              stroke={guideColor} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH}
            />
          )}
          {!(wideRows && row === 0) && (
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
              rowOriginY(contentRow(p.rowIndex)) + startPoint[1],
              wideRows ? TEXT_ROW_WIDE_DIAGONAL_SPACING : TEXT_ROW_ELEMENT_DIAGONAL_SPACING,
              diagonalShiftX
            ) - (contentXUnits + p.x + startPoint[0])
          : 0;
        return (
          <g key={i} transform={`translate(${contentXUnits + p.x + elementSnapDx} ${rowOriginY(contentRow(p.rowIndex))})`}>
            {tappable && (
              <rect
                className="propis-text-word-hit"
                x={-4} y={NATIVE_L3 - TEXT_ROW_PITCH / 2} width={p.segments.reduce((s, seg) => s + seg.width, 0) + 8} height={TEXT_ROW_PITCH}
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
            {p.segments.map((seg, si) =>
              seg.type === "cursive" ? (
                <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                  {isActive ? (
                    <AnimatedStrokes trajectory={seg.trajectory} tipSize={crop ? "normal" : "large"} speedFactor={speedFactor} />
                  ) : (
                    seg.trajectory.strokes.map((s, ssi) => (
                      <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    ))
                  )}
                </g>
              ) : seg.type === "glyph" ? (
                <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                  {seg.strokes.map((s, ssi) => (
                    <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
                    <AnimatedStrokes trajectory={seg.trajectory} tipSize={crop ? "normal" : "large"} speedFactor={speedFactor} />
                  ) : seg.strokes.map((s, ssi) => (
                    // dashed copies fade out along the row (wordEngine WIDE_FADE_END_X); a fully faded one keeps only its start dot
                    s.opacity !== undefined && s.opacity <= 0.02 ? null : (
                      <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? REPEAT_DASH : undefined} opacity={s.opacity} />
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
          </g>
        );
      })}
      {overlays?.map((o, k) => {
        const { y, h } = overlayRect(o.row);
        return <rect key={`ov${k}`} x="0" y={y} width={PAGE_W_UNITS} height={h} fill={OVERLAY_FILL[o.tone] ?? OVERLAY_FILL.select} pointerEvents="none" data-overlay={o.tone} />;
      })}
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
function narrowSnapX(rowIndex, x, y) {
  const { contentXUnits } = slotGeometry(0, true);
  const yAbs = rowOriginY(rowIndex + 1) + y;
  const k = Math.round((contentXUnits + x - narrowLineX(0, yAbs)) / NARROW_CELL);
  return narrowLineX(k, yAbs) - contentXUnits;
}

function wideSnapX(rowIndex, x, y) {
  const { contentXUnits } = slotGeometry(0, true);
  // slant line k at local height y (see wideLineX): nearest line to the point, row-local x back out
  const k = Math.round((contentXUnits + x - wideLineX(0, y)) / TEXT_ROW_WIDE_DIAGONAL_SPACING);
  void rowIndex; // every row has the same phase, so the row index no longer matters
  return wideLineX(k, y) - contentXUnits;
}

// Optional props («Прописи 2», all inert when absent): `onFragmentTap` (see PrintPage), `bare` (only the page:
// no close/nav/print), `focus` (crop to the first row and animate it), `speedFactor`.
export default function PrintPageView({ task, onClose, onFragmentTap, bare = false, focus = false, speedFactor = 1, overlays = null, onPageIndexChange = null }) {
  const lettersByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.letters ?? []) map.set(item.label ?? item.id, item);
    return map;
  }, [task]);

  const connectorsByKey = useMemo(() => {
    const map = new Map();
    for (const item of task?.connectors ?? []) {
      const key = `${item.fromLine}_${item.toLine}`;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [task]);

  const punctuationByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.punctuation ?? []) map.set(item.label ?? item.id, item);
    return map;
  }, [task]);

  const elementsByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.elements ?? []) map.set(item.id, item);
    return map;
  }, [task]);

  const lines = task?.lines ?? [];
  const wideRows = Boolean(task?.wideRows);
  const narrowRows = wideRows && Boolean(task?.narrowRows);
  const useElements = Boolean(task?.useElements) && !wideRows;
  const text = lines.join("\n");
  const wideGlyphsByLabel = useMemo(() => {
    const map = new Map();
    // elements.json entries captured on the wide zone ride along by id (same capture grid, so
    // they get the same grid stretch); wide.json glyphs win and also register their aliases.
    for (const el of task?.elements ?? []) map.set(el.id, { label: el.id, kind: "element", strokes: el.strokes, stretch: WIDE_GRID_STRETCH, repeatCells: task?.wideElementRepeat?.[el.id] });
    for (const item of task?.wideGlyphs ?? []) {
      map.set(item.label, item);
      for (const alias of item.aliases ?? []) map.set(alias, item);
    }
    return map;
  }, [task]);

  const layout = useMemo(
    () => wideRows
      ? (narrowRows ? layoutWideLinesIntoRows(lines, wideGlyphsByLabel, narrowSnapX, true, NARROW_SCALE) : layoutWideLinesIntoRows(lines, wideGlyphsByLabel, wideSnapX))
      : useElements
      ? layoutElementLinesIntoRows(lines, elementsByLabel, CONTENT_W_UNITS)
      : layoutTextIntoRows(text, lettersByLabel, connectorsByKey, CONTENT_W_UNITS, undefined, punctuationByLabel),
    [wideRows, narrowRows, wideGlyphsByLabel, useElements, lines, elementsByLabel, text, lettersByLabel, connectorsByKey, punctuationByLabel]
  );
  const pages = useMemo(() => paginateRows(layout, wideRows ? WIDE_ROWS_PER_PAGE : PRINT_ROWS_PER_PAGE, { exact: Boolean(task?.exactPages) }), [layout, wideRows, task?.exactPages]);

  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => { onPageIndexChange?.(pageIndex); }, [pageIndex, onPageIndexChange]);
  const [activeIndex, setActiveIndex] = useState(focus ? 0 : null);
  useEffect(() => setActiveIndex(focus ? 0 : null), [pageIndex, focus]);
  // pages.length only shrinks if the task itself changes (new session) — clamp defensively
  // rather than let a stale pageIndex point past the end.
  useEffect(() => { if (pageIndex > pages.length - 1) setPageIndex(0); }, [pages.length, pageIndex]);

  const zoomWrapRef = useRef(null);
  const zoomContentRef = useRef(null);
  const { isZoomed, reset: resetZoom } = usePinchZoom(zoomWrapRef, zoomContentRef);
  useEffect(() => { resetZoom(); }, [pageIndex, resetZoom]);

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pages.length - 1;

  // `focus`: a window on the first row only (the show panel): ruling lines of that row, the sample, room for
  // ascenders/descenders and a margin to the right of the sample.
  const focusCrop = (() => {
    if (!focus) return null;
    const first = (pages[0] ?? [])[0];
    if (!first) return null;
    const { contentXUnits } = slotGeometry(0, wideRows);
    const row = wideRows ? first.rowIndex + 1 : first.rowIndex;
    const widthUnits = first.segments.reduce((sum, seg) => sum + seg.width, 0);
    const w = Math.max(260, contentXUnits + first.x + widthUnits + 80);
    if (narrowRows) return { x: 0, y: rowOriginY(row) + NARROW_GUIDE_LOCAL - 30, w, h: WIDE_BAND_BOTTOM_LOCAL - NARROW_GUIDE_LOCAL + 75 };
    return { x: 0, y: wideBandTop(row) - 30, w, h: wideBandHeight + 75 };
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
              overlays={overlays?.filter((o) => Math.floor(o.row / WIDE_ROWS_PER_PAGE) === shownIndex).map((o) => ({ ...o, row: o.row % WIDE_ROWS_PER_PAGE }))}
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
        {lines.length === 0 ? (
          <div className="propis-empty-hint">
            Для этого занятия не набрано ни одной строки.
          </div>
        ) : (
          <>
            <div className="propis-print-page-wrap" ref={zoomWrapRef}>
              <div className="propis-print-page-zoom" ref={zoomContentRef}>
                <PrintPage
                  page={pages[pageIndex] ?? []}
                  pageIndex={pageIndex}
                  activeIndex={activeIndex}
                  onToggleActive={(i) => setActiveIndex((cur) => (cur === i ? null : i))}
                  onFragmentTap={onFragmentTap}
                  speedFactor={speedFactor}
                  useElements={useElements}
                  wideRows={wideRows}
                  narrowRows={narrowRows}
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

            <div className="propis-text-nav">
              <button
                type="button"
                className="propis-ctrl-btn"
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                disabled={!canPrev}
                aria-label="Предыдущая страница"
              >
                ‹
              </button>
              <span className="propis-text-nav__counter">Страница {pageIndex + 1} из {pages.length}</span>
              <button
                type="button"
                className="propis-ctrl-btn"
                onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
                disabled={!canNext}
                aria-label="Следующая страница"
              >
                ›
              </button>
              <button type="button" className="propis-ctrl-btn propis-print-btn" onClick={() => window.print()}>
                🖨 Печать
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
                {Array.from({ length: pages.length / 2 }, (_, sheetIndex) => (
                  <div key={sheetIndex} className="propis-print-all__sheet">
                    <PrintPage page={pages[sheetIndex * 2]} pageIndex={sheetIndex * 2} useElements={useElements} wideRows={wideRows} narrowRows={narrowRows} />
                    <PrintPage page={pages[sheetIndex * 2 + 1]} pageIndex={sheetIndex * 2 + 1} useElements={useElements} wideRows={wideRows} narrowRows={narrowRows} />
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
