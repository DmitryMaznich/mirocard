// Printed-letter ruling: two solid guide lines (top of letter, baseline) plus
// a light dashed mid-line — no slant guides, unlike the cursive "Прописи"
// ruling. Each row is visually separated by a gap, so the page reads as a
// set of distinct writing units rather than one dense block of lines.
export default function RulingRow({
  heightPx,
  widthPx = 440,
  justify = "flex-start",
  padLeft = 18,
  showMargin = true,
  children,
}) {
  return (
    <div className="pl-row" style={{ height: heightPx, position: "relative" }}>
      <svg
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <line x1={0} y1={2}            x2={widthPx} y2={2}            stroke="#bcd4e8" strokeWidth="1" />
        <line x1={0} y1={heightPx / 2} x2={widthPx} y2={heightPx / 2} stroke="#d8e6f0" strokeWidth="1" strokeDasharray="4 5" />
        <line x1={0} y1={heightPx - 2} x2={widthPx} y2={heightPx - 2} stroke="#5b9bd5" strokeWidth="1.6" />
        {showMargin && <line x1={14} y1={0} x2={14} y2={heightPx} stroke="#f4b8b8" strokeWidth="1.2" />}
      </svg>
      <div className="pl-row-content" style={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: justify, paddingLeft: padLeft, paddingRight: 10 }}>
        {children}
      </div>
    </div>
  );
}
