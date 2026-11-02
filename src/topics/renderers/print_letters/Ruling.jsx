// The grid itself is drawn once, for the whole page (`.pl-sheet`'s own
// background-image in print_letters.css) — not per row. A row is just a
// transparent strip of cells sitting on top of that shared grid, so it has
// to land exactly on the page grid's lines: callers must keep `padLeft` and
// row heights as whole multiples of `CELL`, never an arbitrary gap.
export const CELL = 38;

export default function GridRow({ cells, padLeft = 0, children }) {
  const gridW = cells * CELL;
  return (
    <div style={{ height: CELL, marginLeft: padLeft, width: gridW, display: "flex" }}>
      {children}
    </div>
  );
}
