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
// 6mm from the physical top, propis_ruling.py's own SHIFT_MM). Constant across every row —
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

const DIAGONAL_LINES = buildDiagonalLines(PAGE_H_UNITS, PAGE_W_UNITS, TEXT_ROW_DIAGONAL_SPACING);
const ROW_INDICES = Array.from({ length: PRINT_ROWS_PER_PAGE }, (_, i) => i);

// One physical page's ruling + content, reused for both the interactive on-screen view (one
// page at a time, tap-to-animate) and the print-only stacked view (every page, static ink,
// see PrintPageView's own "propis-print-all" block). `activeIndex`/`onToggleActive` are
// omitted (undefined) for the print render — nothing is tappable on paper.
function PrintPage({ page, pageIndex, activeIndex, onToggleActive }) {
  const { marginXUnits, contentXUnits } = slotGeometry(pageIndex);
  return (
    <svg
      className="propis-print-page-svg"
      viewBox={`0 0 ${PAGE_W_UNITS} ${PAGE_H_UNITS}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
      {DIAGONAL_LINES.map((l, i) => (
        <line key={`d${i}`} x1={l.x1} y1={0} x2={l.x2} y2={PAGE_H_UNITS} stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W} />
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
                    <AnimatedStrokes trajectory={seg.trajectory} />
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

            {/* Print-only: every page stacked, one per physical sheet of paper (propis.css's
                @media print rules size each .propis-print-page-svg to the real
                148.5x210mm and force a page break between them) — the interactive
                Prev/Next view above is hidden while printing instead.
                Portaled straight to <body> (2026-09-13): Chrome's print engine only ever
                paints ONE page for content nested inside a `position: fixed` ancestor
                (.propis-practice-stage, this view's own root) — a well-known print
                limitation, not a bug in the page-break CSS itself (confirmed: the very
                same markup prints correctly once moved outside that ancestor). A portal
                sidesteps it entirely rather than fighting position/overflow overrides on
                every ancestor in the chain. */}
            {createPortal(
              <div className="propis-print-all" aria-hidden="true">
                {pages.map((page, i) => (
                  <div key={i} className="propis-print-all__page">
                    <PrintPage page={page} pageIndex={i} />
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
