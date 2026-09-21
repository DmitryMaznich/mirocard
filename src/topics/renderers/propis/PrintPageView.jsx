import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { layoutTextIntoRows, layoutElementLinesIntoRows, paginateRows } from "./wordEngine.js";
import AnimatedStrokes from "./AnimatedStrokes.jsx";
import {
  INK_COLOR, NATIVE_L3,
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
function slotGeometry(pageIndex) {
  const isLeftSlot = pageIndex % 2 === 0;
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
const ROW_INDICES = Array.from({ length: PRINT_ROWS_PER_PAGE }, (_, i) => i);
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
function PrintPage({ page, pageIndex, activeIndex, onToggleActive, useElements }) {
  const { isLeftSlot, marginXUnits, contentXUnits } = slotGeometry(pageIndex);
  const diagonalShiftX = isLeftSlot ? 0 : -PAGE_W_UNITS;
  const diagonalLines = useElements ? SHEET_DIAGONAL_LINES_DENSE : SHEET_DIAGONAL_LINES;
  return (
    <svg
      className="propis-print-page-svg"
      viewBox={`0 0 ${PAGE_W_UNITS} ${PAGE_H_UNITS}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
      {diagonalLines.map((l, i) => (
        <line
          key={`d${i}`}
          x1={l.x1 + diagonalShiftX} y1={0} x2={l.x2 + diagonalShiftX} y2={PAGE_H_UNITS}
          stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W}
        />
      ))}
      {ROW_INDICES.map((row) => (
        <g key={`g${row}`}>
          {useElements && (
            <line
              x1="0" y1={rowOriginY(row) + NATIVE_L3 - WIDE_MID_OFFSET}
              x2={PAGE_W_UNITS} y2={rowOriginY(row) + NATIVE_L3 - WIDE_MID_OFFSET}
              stroke={GUIDE_COLOR} strokeWidth={GUIDE_THIN_W} strokeDasharray={GUIDE_WIDE_MID_DASH}
            />
          )}
          <line
            x1="0" y1={rowOriginY(row) + NATIVE_L3 - TEXT_ROW_THIN_OFFSET}
            x2={PAGE_W_UNITS} y2={rowOriginY(row) + NATIVE_L3 - TEXT_ROW_THIN_OFFSET}
            stroke={GUIDE_COLOR} strokeWidth={GUIDE_THIN_W}
          />
          <line
            x1="0" y1={rowOriginY(row) + NATIVE_L3}
            x2={PAGE_W_UNITS} y2={rowOriginY(row) + NATIVE_L3}
            stroke={GUIDE_COLOR} strokeWidth={GUIDE_BOLD_W}
          />
        </g>
      ))}
      <line x1={marginXUnits} y1={0} x2={marginXUnits} y2={PAGE_H_UNITS} stroke={MARGIN_COLOR} strokeWidth={MARGIN_LINE_W} />
      {page.map((p, i) => {
        // Element rows ("Элементы букв") are a print-only worksheet target with no
        // interactivity at all (2026-09-18, revised after the user decided a screen demo/
        // animation is unneeded overhead -- "мне нужны нормальные тренировочные тетради в
        // пдф формате... только анимация не нужна и отдельный режим наполнения экранного
        // листа с элементами [не нужен]"): no tap-to-animate, so no hit-rect and no active
        // state either, unlike a cursive/text row which keeps both.
        const isElementRow = p.segments.some((seg) => seg.type === "element");
        const isActive = onToggleActive && !isElementRow ? i === activeIndex : false;
        // Snap the element's own start point onto the nearest dense-diagonal grid line (see
        // nearestDiagonalX's own comment) -- shifts the WHOLE row (primary + every repeat
        // copy, all rendered inside this same <g>) by a rigid delta, so nothing about the
        // element's own internal geometry (buildRepeatChain's spacing/chaining) changes, only
        // where the row as a whole sits on the page.
        const startPoint = isElementRow ? p.segments[0].startPoints?.[0] : null;
        const elementSnapDx = startPoint
          ? nearestDiagonalX(
              contentXUnits + p.x + startPoint[0],
              rowOriginY(p.rowIndex) + startPoint[1],
              TEXT_ROW_ELEMENT_DIAGONAL_SPACING,
              diagonalShiftX
            ) - (contentXUnits + p.x + startPoint[0])
          : 0;
        return (
          <g key={i} transform={`translate(${contentXUnits + p.x + elementSnapDx} ${rowOriginY(p.rowIndex)})`}>
            {onToggleActive && !isElementRow && (
              <rect
                className="propis-text-word-hit"
                x={-4} y={NATIVE_L3 - TEXT_ROW_PITCH / 2} width={p.segments.reduce((s, seg) => s + seg.width, 0) + 8} height={TEXT_ROW_PITCH}
                onClick={() => onToggleActive(i)}
              />
            )}
            {p.segments.map((seg, si) =>
              seg.type === "cursive" ? (
                <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                  {isActive ? (
                    <AnimatedStrokes trajectory={seg.trajectory} tipSize="large" />
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
                  {seg.strokes.map((s, ssi) => (
                    <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                  {seg.startPoints?.map((pt, pi) => (
                    <circle key={pi} cx={pt[0]} cy={pt[1]} r={ELEMENT_START_DOT_R} fill={INK_COLOR} />
                  ))}
                  {seg.directionArrows?.map((a, ai) => a && (
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
                        <circle key={pi} cx={pt[0]} cy={pt[1]} r={ELEMENT_START_DOT_R} fill={INK_COLOR} opacity={REPEAT_OPACITY} />
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
    </svg>
  );
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
export default function PrintPageView({ task, onClose }) {
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
  const useElements = Boolean(task?.useElements);
  const text = lines.join("\n");

  const layout = useMemo(
    () => useElements
      ? layoutElementLinesIntoRows(lines, elementsByLabel, CONTENT_W_UNITS)
      : layoutTextIntoRows(text, lettersByLabel, connectorsByKey, CONTENT_W_UNITS, undefined, punctuationByLabel),
    [useElements, lines, elementsByLabel, text, lettersByLabel, connectorsByKey, punctuationByLabel]
  );
  const pages = useMemo(() => paginateRows(layout, PRINT_ROWS_PER_PAGE), [layout]);

  const [pageIndex, setPageIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);
  useEffect(() => setActiveIndex(null), [pageIndex]);
  // pages.length only shrinks if the task itself changes (new session) — clamp defensively
  // rather than let a stale pageIndex point past the end.
  useEffect(() => { if (pageIndex > pages.length - 1) setPageIndex(0); }, [pages.length, pageIndex]);

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pages.length - 1;

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
            <div className="propis-print-page-wrap">
              <PrintPage
                page={pages[pageIndex] ?? []}
                pageIndex={pageIndex}
                activeIndex={activeIndex}
                onToggleActive={(i) => setActiveIndex((cur) => (cur === i ? null : i))}
                useElements={useElements}
              />
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
                    <PrintPage page={pages[sheetIndex * 2]} pageIndex={sheetIndex * 2} useElements={useElements} />
                    <PrintPage page={pages[sheetIndex * 2 + 1]} pageIndex={sheetIndex * 2 + 1} useElements={useElements} />
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
