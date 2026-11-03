import LetterBlock from "./LetterBlock";
import LetterGlyph from "./LetterGlyph";
import { drawnSize, paperOf, sheetSizeMm } from "./model";

// One printable sheet at its real size: the paper format minus the printer
// margin (@page). The same component draws the page on the canvas, inside a
// thumbnail (scaled) and in the print run, so the three never disagree.
export default function Sheet({ page, format, byId, className = "", style, selectedBlockId = null, selectedRowId = null, onSelectBlock, onSelectRow }) {
  const { w, h } = sheetSizeMm(format);
  // On paper, 1mm less than the exact printable height: an exact fit can
  // round over and push a blank sheet out after every page.
  const heightMm = className.includes("pl-sheet--print") ? h - 1 : h;
  return (
    <div
      className={`pl-sheet pl-sheet--${paperOf(page)} ${className}`}
      style={{ width: `${w}mm`, height: `${heightMm}mm`, ...style }}
    >
      {page.blocks.length > 0 && <SheetHeader page={page} byId={byId} />}
      {page.blocks.map((b) => {
        const letter = byId[b.letterId];
        if (!letter) return null;
        return (
          <LetterBlock
            key={b.id}
            letter={letter}
            color={b.color}
            rows={b.rows}
            format={format}
            size={drawnSize(b, paperOf(page))}
            paper={paperOf(page)}
            selected={b.id === selectedBlockId}
            selectedRowId={b.id === selectedBlockId ? selectedRowId : null}
            onSelectBlock={() => onSelectBlock?.(b.id)}
            onSelectRow={(rowId) => onSelectRow?.(b.id, rowId)}
          />
        );
      })}
    </div>
  );
}

// «Имя ____ Дата ____» — the child (or adult) writes them in: a name is
// itself a writing goal at this age, the date lets progress be compared
// across sheets. On the right: the page's letters, drawn with the same
// strokes as in the blocks, not typed in a font.
function SheetHeader({ page, byId }) {
  const ids = [...new Set(page.blocks.map((b) => b.letterId))].filter((id) => byId[id]);
  return (
    <div className="pl-sheet-head">
      <span>Имя</span><span className="pl-sheet-head-line pl-sheet-head-line--name" />
      <span>Дата</span><span className="pl-sheet-head-line pl-sheet-head-line--date" />
      <span className="pl-sheet-head-fill" />
      <span className="pl-sheet-head-title">
        {ids.length > 1 ? "Буквы" : "Буква"}
        <span className="pl-sheet-head-letters">
          {ids.map((id) => <LetterGlyph key={id} letter={byId[id]} heightMm={5} variant="plain" label={byId[id].label} />)}
        </span>
      </span>
    </div>
  );
}
