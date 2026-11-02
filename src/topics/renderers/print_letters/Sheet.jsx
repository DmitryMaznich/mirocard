import LetterBlock from "./LetterBlock";
import { sheetSizeMm } from "./model";

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
      className={`pl-sheet pl-sheet--${page.paper ?? "cell"} ${className}`}
      style={{ width: `${w}mm`, height: `${heightMm}mm`, ...style }}
    >
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
