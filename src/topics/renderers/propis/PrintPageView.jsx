import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { layoutTextIntoRows, paginateRows } from "./wordEngine.js";
import AnimatedStrokes from "./AnimatedStrokes.jsx";
import {
  INK_COLOR, NATIVE_L3, TEXT_ROW_PITCH, TEXT_ROW_THIN_OFFSET, TEXT_ROW_DIAGONAL_SPACING,
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
const FALLBACK_FONT_SIZE = 34;

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
const ROW_INDICES = Array.from({ length: PRINT_ROWS_PER_PAGE }, (_, i) => i);

// One physical page's ruling + content, reused for both the interactive on-screen view (one
// page at a time, tap-to-animate) and the print-only stacked view (every page, static ink,
// see PrintPageView's own "propis-print-all" block). `activeIndex`/`onToggleActive` are
// omitted (undefined) for the print render — nothing is tappable on paper.
function PrintPage({ page, pageIndex, activeIndex, onToggleActive }) {
  const { isLeftSlot, marginXUnits, contentXUnits } = slotGeometry(pageIndex);
  const diagonalShiftX = isLeftSlot ? 0 : -PAGE_W_UNITS;
  return (
    <svg
      className="propis-print-page-svg"
      viewBox={`0 0 ${PAGE_W_UNITS} ${PAGE_H_UNITS}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
      {SHEET_DIAGONAL_LINES.map((l, i) => (
        <line
          key={`d${i}`}
          x1={l.x1 + diagonalShiftX} y1={0} x2={l.x2 + diagonalShiftX} y2={PAGE_H_UNITS}
          stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W}
        />
      ))}
      {ROW_INDICES.map((row) => (
        <g key={`g${row}`}>
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
        const isActive = onToggleActive ? i === activeIndex : false;
        return (
          <g key={i} transform={`translate(${contentXUnits + p.x} ${rowOriginY(p.rowIndex)})`}>
            {onToggleActive && (
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

  const lines = task?.lines ?? [];
  const text = lines.join("\n");

  const layout = useMemo(
    () => layoutTextIntoRows(text, lettersByLabel, connectorsByKey, CONTENT_W_UNITS, undefined, punctuationByLabel),
    [text, lettersByLabel, connectorsByKey, punctuationByLabel]
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
                    <PrintPage page={pages[sheetIndex * 2]} pageIndex={sheetIndex * 2} />
                    <PrintPage page={pages[sheetIndex * 2 + 1]} pageIndex={sheetIndex * 2 + 1} />
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
