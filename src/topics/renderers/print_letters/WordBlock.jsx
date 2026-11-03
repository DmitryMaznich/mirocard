import LetterGlyph, { letterFrame } from "./LetterGlyph";
import { FINE_MM } from "./Ruling";
import { TILE, paperGap, blockCells, rowCells, rowBesidePlate, rowStartCells, copyPitch, copyPlan, letterH, letterW, isRuled } from "./model";
import { plateCells, plateWords, wordCopiesPerRow, wordLetters, wordPitchCells, wordWidthCells } from "./words";

const mm = (cells) => `${cells * FINE_MM}mm`;

// A print block for a syllable or a word (words.js) — LetterBlock's twin: the same outline, plate
// and rows on whole cells, but every copy is a word, each letter in its own letter-cell, one clean
// letter-cell between copies. The first copy of a row is the sample (the whole word, solid, with
// arrows and start dots); the contours after it leave out the letters the row doesn't draw.
export default function WordBlock({ block, byId, format, size = 2, paper = "cell", selected, selectedRowId, onSelectBlock, onSelectRow, style }) {
  const plateW = plateCells(block);
  const h = letterH(size);
  const g = paperGap(paper);
  const pitch = copyPitch(size);
  return (
    <div
      className={`pl-block${selected ? " is-selected" : ""}`}
      style={{ ...style, outlineColor: block.color, width: mm(blockCells(format)), height: mm(Math.max(TILE, block.rows.length * (g + h) + g)) }}
      onClick={(e) => { e.stopPropagation(); onSelectBlock(); }}
    >
      <div
        className="pl-block-tile pl-block-tile--word"
        style={{ height: mm(TILE), width: mm(plateW), "--pl-block-color": block.color }}
        aria-label={plateWords(block).join(", ")}
      >
        <PlateWords words={plateWords(block)} byId={byId} />
      </div>

      {block.rows.map((row, index) => {
        const letters = wordLetters(row.text ?? "", byId);
        const beside = rowBesidePlate(index, size, paper);
        const start = rowStartCells(beside, paper, plateW);
        const width = rowCells(format, beside, paper, plateW);
        const copies = letters.length ? wordCopiesPerRow(letters, format, beside, size, paper, plateW) : 0;
        const plan = copyPlan(row, copies);
        const shown = new Set(row.elements);
        const wPitch = wordPitchCells(letters, size);
        return (
          <div
            key={row.id}
            className={`pl-row-wrap${row.id === selectedRowId ? " is-selected" : ""}`}
            style={{ position: "absolute", top: mm(index * (g + h)), left: 0, right: 0, paddingTop: mm(g), paddingLeft: mm(start) }}
            onClick={(e) => { e.stopPropagation(); onSelectRow(row.id); }}
          >
            {isRuled(paper) && (
              <div className="pl-ruling" aria-hidden="true" style={{ left: mm(start), top: mm(g), width: mm(width), height: mm(h) }} />
            )}
            <div className="pl-row" style={{ height: mm(h), width: mm(width) }}>
              {plan.map((p, ci) => (
                <div key={ci} className="pl-cell" style={{ width: mm(ci === plan.length - 1 ? wordWidthCells(letters, size) : wPitch), height: mm(h) }}>
                  {p && letters.map((letter, li) => {
                    const sample = p.variant === "sample";
                    if (!sample && !shown.has(li)) return null;
                    return (
                      <div key={li} style={{ position: "absolute", left: mm(li * pitch), top: 0 }}>
                        <LetterGlyph
                          key={`${p.variant}-${p.dots ? 1 : 0}`}
                          letter={letter}
                          frame={letterFrame(letter)}
                          heightMm={h * FINE_MM}
                          widthMm={letterW(letter, size) * FINE_MM}
                          variant={p.variant}
                          opacity={p.opacity}
                          tappable={sample}
                          dots={p.dots}
                          label={sample ? letter.label : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The plate's words: bold white letters, space between letters (0.4 of the letter's height — less
// and the thick strokes touch) and twice that between words.
export function PlateWords({ words, byId, heightMm = TILE * FINE_MM * 0.5, color = "#ffffff", weight = 15 }) {
  return (
    <span className="pl-plate-words" style={{ gap: `${heightMm * 0.8}mm` }}>
      {words.map((w, wi) => (
        <span key={wi} className="pl-plate-word" style={{ gap: `${heightMm * 0.4}mm` }}>
          {wordLetters(w, byId).map((l, li) => (
            <LetterGlyph key={li} letter={l} heightMm={heightMm} variant="plain" color={color} weight={weight} />
          ))}
        </span>
      ))}
    </span>
  );
}
