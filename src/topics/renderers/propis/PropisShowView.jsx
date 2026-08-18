import { LINE_MM, buildRowGuideLines, buildDiagonalLines } from "./propisRuling.js";
import LoopingLetterCell from "./LoopingLetterCell.jsx";

// Real A5 copybook page proportions — matches make_lined_paper_landscape_standard.py
// (an A4-landscape two-page spread is two of these A5 pages side by side).
const PAGE_W_MM = 148.5;
const PAGE_H_MM = 210;
const MARGIN_MM = 15; // red margin line from the left edge

const ROW_COUNT = Math.floor(PAGE_H_MM / LINE_MM);
const H_LINES   = buildRowGuideLines(ROW_COUNT);
const D_LINES   = buildDiagonalLines(PAGE_H_MM, PAGE_W_MM);

// Not currently wired to any active mode — this full-page layout is being kept for the
// planned "export PDF worksheet for print" mode, not the on-screen practice mode.
export default function PropisShowView({ task, onAdvance, onClose }) {
  const items = task?.items ?? [];

  const rows = Array.from({ length: ROW_COUNT }, (_, i) => ({
    index: i,
    item: items.length ? items[i % items.length] : null,
  }));

  return (
    <div className="propis-stage">
      <svg
        className="propis-page-svg"
        viewBox={`0 0 ${PAGE_W_MM} ${PAGE_H_MM}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0" y="0" width={PAGE_W_MM} height={PAGE_H_MM} className="propis-paper" />

        {H_LINES.map((l, i) => (
          <line key={`h${i}`} x1={0} y1={l.y} x2={PAGE_W_MM} y2={l.y}
            className={l.bold ? "propis-line-bold" : "propis-line-thin"} />
        ))}
        {D_LINES.map((l, i) => (
          <line key={`d${i}`} x1={l.x1} y1={0} x2={l.x2} y2={PAGE_H_MM} className="propis-line-diag" />
        ))}
        <line x1={MARGIN_MM} y1={0} x2={MARGIN_MM} y2={PAGE_H_MM} className="propis-line-red" />

        {rows.map((row) => row.item && (
          <g key={row.index} transform={`translate(${MARGIN_MM} ${row.index * LINE_MM})`}>
            <LoopingLetterCell item={row.item} delayMs={200 + row.index * 180} />
          </g>
        ))}
      </svg>

      {items.length === 0 && (
        <div className="propis-empty-hint">
          Для этого занятия не выбрано ни одной буквы или элемента.
        </div>
      )}

      <div className="propis-controls">
        <button type="button" className="propis-ctrl-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        <button type="button" className="propis-ctrl-btn propis-ctrl-btn--done" onClick={onAdvance}>
          Завершить
        </button>
      </div>
    </div>
  );
}
