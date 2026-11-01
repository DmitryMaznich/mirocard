// Клетка (square-cell grid), not ruled lines — per Ilyukhina's «Волшебные линии 2»,
// printed letters there are written directly in a square-grid notebook, one letter per
// cell, not on a lined "строка" with a baseline/midline. Replaces the earlier 3-line
// ruling entirely (see docs/print-letters.md, "Разворот 2026-11-01" — fourth).
export const CELL = 38;

export default function GridRow({ cells, padLeft = 0, children }) {
  const gridW = cells * CELL;
  return (
    <div className="pl-row" style={{ height: CELL, position: "relative", marginLeft: padLeft, width: gridW }}>
      <svg
        viewBox={`0 0 ${gridW} ${CELL}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        {Array.from({ length: cells + 1 }).map((_, i) => (
          <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={CELL} stroke="#bcd4e8" strokeWidth="1" />
        ))}
        <line x1={0} y1={0.5} x2={gridW} y2={0.5} stroke="#bcd4e8" strokeWidth="1" />
        <line x1={0} y1={CELL - 0.5} x2={gridW} y2={CELL - 0.5} stroke="#bcd4e8" strokeWidth="1" />
      </svg>
      <div className="pl-row-content" style={{ position: "relative", height: "100%", display: "flex" }}>
        {children}
      </div>
    </div>
  );
}
