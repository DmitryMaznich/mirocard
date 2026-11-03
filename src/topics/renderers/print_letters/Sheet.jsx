import LetterBlock from "./LetterBlock";
import WordBlock, { PlateWords } from "./WordBlock";
import { isWordBlock } from "./words";
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
        if (isWordBlock(b)) {
          return (
            <WordBlock
              key={b.id}
              block={b}
              byId={byId}
              format={format}
              size={drawnSize(b, paperOf(page))}
              paper={paperOf(page)}
              selected={b.id === selectedBlockId}
              selectedRowId={b.id === selectedBlockId ? selectedRowId : null}
              onSelectBlock={() => onSelectBlock?.(b.id)}
              onSelectRow={(rowId) => onSelectRow?.(b.id, rowId)}
            />
          );
        }
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
// Syllables and words are listed after the letters, the heading becomes «Пишем».
function SheetHeader({ page, byId }) {
  const ids = [...new Set(page.blocks.filter((b) => !isWordBlock(b)).map((b) => b.letterId))].filter((id) => byId[id]);
  const words = [...new Set(page.blocks.filter(isWordBlock).flatMap((b) => b.words ?? []))];
  return (
    <div className="pl-sheet-head">
      <span>Имя</span><span className="pl-sheet-head-line pl-sheet-head-line--name" />
      <span>Дата</span><span className="pl-sheet-head-line pl-sheet-head-line--date" />
      <span className="pl-sheet-head-fill" />
      <span className="pl-sheet-head-title">
        {words.length ? "Пишем" : ids.length > 1 ? "Буквы" : "Буква"}
        <span className="pl-sheet-head-letters">
          {ids.map((id) => <LetterGlyph key={id} letter={byId[id]} heightMm={5} variant="plain" label={byId[id].label} />)}
          {words.length > 0 && <PlateWords words={words} byId={byId} heightMm={5} color="#1f3a8a" weight={9} />}
        </span>
      </span>
    </div>
  );
}
