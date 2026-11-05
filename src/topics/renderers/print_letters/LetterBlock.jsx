import LetterGlyph, { letterFrame } from "./LetterGlyph";
import { FINE_MM } from "./Ruling";
import { TILE, LETTER_H, plateHeightCells, paperGap, blockCells, rowCells, rowBesidePlate, rowStartCells, copiesPerRow, copyPitch, copyPlan, letterH, letterW, isRuled, rowStyle } from "./model";
import { rowTask, missHint, missCopy, findSequence, findWidest } from "./tasks";

const mm = (cells) => `${cells * FINE_MM}mm`;

// A naborny print block for one letter. Every length is a whole number of
// notebook cells (model.js), so every edge — block outline, tile, each
// letter's box — lands on a printed grid line; the block spans the sheet's
// whole usable width, so the number of copies per row follows the format.
//
// Every row draws its elements inside the SAME frame — the whole letter's
// grid box — so an isolated element (Н's crossbar) sits exactly where it
// sits in the full letter, and the label tile shows that same stroke shape.
// What each copy draws comes from the row's three options (line, contours,
// dots) via copyPlan().
// What each copy of a row draws, as LetterGlyph props (null — a blank letter-cell). Besides the
// ordinary row (copyPlan) a row can be «Допиши штрих» or «Найди и обведи» (tasks.js).
function rowCopies(row, letter, byId, format, beside, size, paper) {
  const frame = letterFrame(letter);
  const task = rowTask(row);
  if (task === "find") {
    const copies = copiesPerRow(findWidest(letter, byId), format, beside, size, paper);
    return findSequence(letter, copies, row.seed ?? row.id, byId).map((l) => ({
      letter: l, frame: letterFrame(l), w: letterW(l, size), variant: "trace", dots: false,
    }));
  }
  const copies = copiesPerRow(letter, format, beside, size, paper);
  const w = letterW(letter, size);
  if (task === "miss") {
    const st = rowStyle(row);
    const hint = missHint(row);
    return Array.from({ length: copies }, (_, i) => {
      if (i === 0) return { letter, frame, w, variant: "sample", dots: st.dots !== "none", arrows: st.arrows, tappable: true };
      const c = missCopy(letter, i - 1, row.stroke);
      return { letter: c.letter, frame, w, variant: "plain", hintStart: hint === "dot" ? c.start : null, key: `m${c.gone}` };
    });
  }
  const strokes = row.elements.map((i) => ({ ...letter.strokes[i], n: i + 1 })).filter((s) => s.d);
  const miniLetter = { ...letter, strokes };
  return copyPlan(row, copies).map((p) => p && ({ letter: miniLetter, frame, w, ...p, tappable: p.variant === "sample" }));
}

export default function LetterBlock({ letter, byId = {}, color, rows, format, size = 2, paper = "cell", selected, selectedRowId, onSelectBlock, onSelectRow, style }) {
  const frame = letterFrame(letter);
  const w = letterW(letter, size);
  const h = letterH(size);
  const g = paperGap(paper);
  const plateH = plateHeightCells(rows.length, size, paper);
  return (
    <div
      className={`pl-block${selected ? " is-selected" : ""}`}
      style={{ ...style, outlineColor: color, width: mm(blockCells(format)), height: mm(Math.max(TILE, rows.length * (g + h) + g)) }}
      onClick={(e) => { e.stopPropagation(); onSelectBlock(); }}
    >
      <div
        className="pl-block-tile"
        style={{ height: mm(plateH), width: mm(TILE), paddingTop: mm(Math.floor((plateH - LETTER_H) / 2)), "--pl-block-color": color }}
        aria-label={`Буква ${letter.label}`}
      >
        {/* the plate letter is a letter's own height, 2 cells, centred in the 4-cell plate: its top
            and bottom lie on grid lines like the letters in the rows (owner, 2026-11-03) */}
        <LetterGlyph letter={letter} frame={frame} heightMm={LETTER_H * FINE_MM} variant="plain" color="#ffffff" weight={15} />
      </div>

      {rows.map((row, index) => {
        const beside = rowBesidePlate(index, size, paper);
        const start = rowStartCells(beside, paper);
        const width = rowCells(format, beside, paper);
        const plan = rowCopies(row, letter, byId, format, beside, size, paper);
        return (
          <div
            key={row.id}
            className={`pl-row-wrap${row.id === selectedRowId ? " is-selected" : ""}`}
            style={{ position: "absolute", top: mm(index * (g + h)), left: 0, right: 0, paddingTop: mm(g), paddingLeft: mm(start) }}
            onClick={(e) => { e.stopPropagation(); onSelectRow(row.id); }}
          >
            {isRuled(paper) && (
              <div
                className="pl-ruling"
                aria-hidden="true"
                style={{ left: mm(start), top: mm(g), width: mm(width), height: mm(h) }}
              />
            )}
            <div className="pl-row" style={{ height: mm(h), width: mm(width) }}>
              {plan.map((p, i) => (
                <div key={i} className="pl-cell" style={{ width: mm(i === plan.length - 1 ? (p?.w ?? w) : copyPitch(size)), height: mm(h) }}>
                  {p && (
                    <LetterGlyph
                      key={`${p.letter.id}-${row.elements.join(",")}-${p.variant}-${p.dots ? 1 : 0}-${p.arrows === false ? 0 : 1}-${p.key ?? ""}`}
                      letter={p.letter}
                      frame={p.frame}
                      heightMm={h * FINE_MM}
                      widthMm={p.w * FINE_MM}
                      variant={p.variant}
                      opacity={p.opacity ?? 1}
                      tappable={!!p.tappable}
                      dots={p.dots}
                      arrows={p.arrows !== false}
                      hintStart={p.hintStart ?? null}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
