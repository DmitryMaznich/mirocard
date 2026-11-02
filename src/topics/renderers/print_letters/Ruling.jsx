// Real physical sizes, in mm, not arbitrary screen pixels — this is a sheet
// meant to be printed. FINE_MM is a normal school-notebook cell (5mm); a
// letter/element occupies a 2×2 block of those (UNIT_MM = 10mm tall and
// wide), matching "про letters ~2 cells tall" and the glyphs' near-square
// aspect ratio. The page-wide background grid (print_letters.css, .pl-sheet)
// ticks every FINE_MM; everything below must stay a whole multiple of it —
// mixing in an arbitrary px gap would drift off the printed grid lines.
export const FINE_MM = 5;
export const UNIT_MM = FINE_MM * 2;

export default function GridRow({ cells, padLeft = 0, children }) {
  const gridW = cells * UNIT_MM;
  return (
    <div style={{ height: `${UNIT_MM}mm`, marginLeft: `${padLeft}mm`, width: `${gridW}mm`, display: "flex" }}>
      {children}
    </div>
  );
}
