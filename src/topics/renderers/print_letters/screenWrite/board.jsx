import { CELL, glyphWidth } from "./boardGeometry";

// The board shared by the screen modes of print_letters — «Пишу на экране» (ScreenWriteView) and
// «Почини букву» (../fixLetter/FixLetterView): the ordinary notebook grid edge to edge, the letter's own
// cells lightly tinted, red ruler ticks on their top and bottom lines, and a quiet tone.

// Red ruler ticks on the top and bottom lines of the letter's own cells only (owner: «рисками только ту
// зону, где мы рисуем букву»), in each of those cells: a long one at the
// middle, short ones at ¼ and ¾ (owner, 2026-11-04: «риски как на линейке… по верхней и нижней линиям…
// красного цвета»). Red, so they are read neither as the grid nor as a path to trace; they mark where
// a stroke starts (Т's stick at ¾, О's top at ½) without lines through the cell. Earlier tries: dashed
// lines across the board (read as «trace me»), Ilyukhina's big cell (thirds — too hard to see).
// Only inside the letter's own width (a wide letter is 1½ cells on screen: its second cell gets only
// the tick at ¼ — the rest of that cell is not the letter's).
const TICK_LONG = 9, TICK_SHORT = 5;
function RulerTicks({ width }) {
  const ticks = [];
  for (let c = 0; c < width; c += CELL) {
    for (const [dx, len] of [[CELL / 4, TICK_SHORT], [CELL / 2, TICK_LONG], [(3 * CELL) / 4, TICK_SHORT]]) {
      const x = c + dx;
      if (x > width - 1) continue;
      ticks.push(<line key={`t${x}`} x1={x} y1={0} x2={x} y2={len} />, <line key={`b${x}`} x1={x} y1={2 * CELL - len} x2={x} y2={2 * CELL} />);
    }
  }
  return <g className="plw-ruler">{ticks}</g>;
}

// `frame` (the modes' «Рамка и риски», on by default; owner, 2026-11-06: «тонкий контур пространства для
// буквы, чтобы было видно какая ширина буквы ожидается… обозначить где должна буква начинаться»): a thin
// outline of the letter's place — its width × 2 cells — in the ticks' red, paler, so the outline and the
// ticks read as one ruler, not as a path to trace; the place inside lightly tinted. Off: the bare grid.
export function Grid({ box, card, frame = true }) {
  const w = glyphWidth(card);
  const lines = [];
  const x1 = box.x0 + box.w, y1 = box.y0 + box.h;
  for (let x = Math.floor(box.x0 / CELL) * CELL; x <= x1; x += CELL) {
    lines.push(<line key={`x${x}`} x1={x} y1={box.y0} x2={x} y2={y1} className="plw-grid-cell" />);
  }
  for (let y = Math.floor(box.y0 / CELL) * CELL; y <= y1; y += CELL) {
    lines.push(<line key={`y${y}`} x1={box.x0} y1={y} x2={x1} y2={y} className="plw-grid-cell" />);
  }
  return (
    <g>
      <rect x={box.x0} y={box.y0} width={box.w} height={box.h} className="plw-paper" />
      {frame && <rect x={0} y={0} width={w} height={2 * CELL} className="plw-cell-own" />}
      {lines}
      {frame && <rect x={0} y={0} width={w} height={2 * CELL} className="plw-frame" />}
      {frame && <RulerTicks width={w} />}
    </g>
  );
}

