import { mmToNativeUnits } from "./propisRuling.js";

// The Mironium mark (public/brand/mironium-logo.svg: the head; drawn 440 high in its own units). Inlined, not an <img>: a print
// document must not wait for a fetch (see src/features/session/symmetryDrawPrintHtml.js).
export const MIRONIUM_HEAD = "M 98.0 0.0 L 376.0 0.0 L 401.0 5.0 L 401.0 7.0 L 388.0 12.0 L 382.0 20.0 L 379.0 17.0 L 369.0 15.0 L 342.0 24.0 L 319.0 23.0 L 291.0 29.0 L 291.0 31.0 L 297.0 29.0 L 313.0 29.0 L 313.0 31.0 L 279.0 41.0 L 229.0 67.0 L 219.0 67.0 L 209.0 61.0 L 215.0 69.0 L 233.0 71.0 L 245.0 67.0 L 265.0 55.0 L 268.0 56.0 L 247.0 71.0 L 204.0 88.0 L 198.0 96.0 L 196.0 112.0 L 200.0 102.0 L 209.0 93.0 L 219.0 91.0 L 206.0 102.0 L 199.0 125.0 L 188.0 136.0 L 200.0 132.0 L 194.0 142.0 L 193.0 151.0 L 201.0 143.0 L 198.0 156.0 L 203.0 167.0 L 206.0 148.0 L 209.0 147.0 L 207.0 151.0 L 209.0 155.0 L 216.0 150.0 L 213.0 159.0 L 214.0 200.0 L 212.0 206.0 L 196.0 224.0 L 176.0 236.0 L 171.0 245.0 L 173.0 255.0 L 191.0 273.0 L 190.0 284.0 L 185.0 289.0 L 186.0 296.0 L 197.0 303.0 L 198.0 310.0 L 209.0 311.0 L 213.0 309.0 L 215.0 311.0 L 212.0 316.0 L 199.0 317.0 L 194.0 322.0 L 195.0 331.0 L 202.0 338.0 L 204.0 344.0 L 203.0 365.0 L 205.0 375.0 L 214.0 386.0 L 224.0 390.0 L 274.0 390.0 L 294.0 396.0 L 304.0 406.0 L 311.0 421.0 L 316.0 440.0 L 92.0 440.0 L 75.0 435.0 L 54.0 422.0 L 42.0 408.0 L 35.0 395.0 L 30.0 374.0 L 31.0 61.0 L 40.0 36.0 L 59.0 15.0 L 77.0 5.0 Z";

const MARK_GRAY = "#aab2ba";
const WORD_GRAY = "#c3c9cf";

// `propis2` printed pages carry a quiet Mironium mark where nobody writes (owner, 2026-10-14; mockups A2 / B):
// - a page with a margin: the word «Mironium» standing up the margin strip, twice (at 30% and 70% of the height), very light;
// - a page without one: «mironium.com» with the head, standing along the INNER edge (the fold), at mid-height — between the staples,
//   in the strip before the first letter of a row.
// Native units, the page's own svg. `marginX`: the red line's x (null: no margin); `innerLeft`: the inner edge is the left one.
export function BrandMarks({ w, h, marginX, innerLeft }) {
  const mm = mmToNativeUnits(1);
  if (marginX != null) {
    const cx = marginX < w / 2 ? marginX / 2 : (w + marginX) / 2;
    const rot = cx < w / 2 ? -90 : 90;
    return (
      <g data-brand="margin" pointerEvents="none">
        {[0.3, 0.7].map((f) => (
          <g key={f} transform={`translate(${cx} ${h * f}) rotate(${rot})`}>
            <rect x={-17 * mm} y={-3.2 * mm} width={34 * mm} height={6.4 * mm} fill="#fff" />
            <text x="0" y="0" dy="0.34em" textAnchor="middle" fontFamily="'DM Serif Display', Georgia, serif" fontSize={5.2 * mm} fill={WORD_GRAY} letterSpacing={0.3 * mm}>Mironium</text>
          </g>
        ))}
      </g>
    );
  }
  const cx = innerLeft ? 2.3 * mm : w - 2.3 * mm;
  const rot = innerLeft ? -90 : 90;
  const head = 2.5 * mm;
  return (
    <g data-brand="fold" pointerEvents="none" transform={`translate(${cx} ${h / 2}) rotate(${rot})`}>
      <rect x={-12.5 * mm} y={-1.5 * mm} width={25 * mm} height={3 * mm} fill="#fff" />
      <g transform={`translate(${-11.6 * mm} ${-1.25 * mm}) scale(${head / 440})`}><path d={MIRONIUM_HEAD} fill={MARK_GRAY} /></g>
      <text x={1.4 * mm} y="0" dy="0.36em" textAnchor="middle" fontFamily="Nunito, sans-serif" fontWeight="700" fontSize={2.2 * mm} fill={MARK_GRAY} letterSpacing={0.05 * mm}>mironium.com</text>
    </g>
  );
}

// Staple marks on the fold of an A4 landscape sheet printed «Тетрадью» (owner, 2026-10-15: as on the printed series — the very
// marks of scripts/propis_worksheets/propis_ruling.py and scripts/cover_tetrad.py): at 45 mm from the top and the bottom edge, a pair
// of slots 1.2 x 2.5 mm, 6 mm apart, on the fold; on the inner sheets a faint oval around each slot. Over the spine too.
const STAPLE_YS = [45, 210 - 45];
export function StapleMarks({ ovals = true }) {
  return (
    <svg className="propis-print-staples" viewBox="0 0 297 210" preserveAspectRatio="none" aria-hidden="true" data-staples="1">
      {STAPLE_YS.flatMap((y) => [-3, 3].map((dy) => (
        <g key={`${y}${dy}`}>
          {ovals && <ellipse cx={148.5} cy={y + dy} rx={2} ry={1.5} fill="none" stroke="#999" strokeWidth={0.2} opacity={0.3} />}
          <rect x={148.5 - 0.6} y={y + dy - 1.25} width={1.2} height={2.5} rx={0.3} fill="#3b3b3b" stroke="#333" strokeWidth={0.1} />
        </g>
      )))}
    </svg>
  );
}
