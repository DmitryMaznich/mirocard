import { useMemo, useState } from "react";
import { LINE_MM, buildRowGuideLines, buildDiagonalLines } from "./propisRuling.js";
import LoopingLetterCell from "./LoopingLetterCell.jsx";

// Same alphabetical grouping the app's other custom keyboard (magnetic_alphabet) uses,
// for a consistent letter layout across topics — not shared code, just the same data.
const ABV_ROWS = [
  ["А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "И", "Й"],
  ["К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф"],
  ["Х", "Ц", "Ч", "Ш", "Щ", "Ъ", "Ы", "Ь", "Э", "Ю", "Я"],
];
const ALL_LETTERS = ABV_ROWS.flat();

// Stylised zoomed-in strip, not the real page width — ~2x zoom on the row, kept
// proportional to LINE_MM so this stays consistent if the row height ever changes again.
const CARD_W_MM      = LINE_MM * 1.0833;
const CARD_MARGIN_MM = LINE_MM * 0.25;

const CARD_LINES = buildRowGuideLines(1);
// The real 20mm diagonal spacing rarely lands inside a crop this narrow — space them
// relative to the crop width instead, purely for this zoomed-in card.
const CARD_DIAG  = buildDiagonalLines(LINE_MM, CARD_W_MM, CARD_W_MM / 2);

function keyFor(letterUpper, caseMode) {
  return caseMode === "upper" ? letterUpper : letterUpper.toLowerCase();
}

export default function PropisPracticeView({ task, onClose }) {
  const itemsByKey = useMemo(() => {
    const map = new Map();
    for (const item of task?.items ?? []) map.set(item.id ?? item.label, item);
    return map;
  }, [task]);

  const initial = useMemo(() => {
    for (const caseMode of ["upper", "lower"]) {
      for (const letter of ALL_LETTERS) {
        if (itemsByKey.has(keyFor(letter, caseMode))) return { caseMode, letter };
      }
    }
    return { caseMode: "upper", letter: ALL_LETTERS[0] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [caseMode, setCaseMode] = useState(initial.caseMode);
  const [letter, setLetter]     = useState(initial.letter);

  const activeKey  = keyFor(letter, caseMode);
  const activeItem = itemsByKey.get(activeKey) ?? null;

  return (
    <div className="propis-practice-stage">
      <button type="button" className="propis-ctrl-btn propis-practice-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-practice-frame">
        <div className="propis-practice-demo">
          <svg
            className="propis-practice-card-svg"
            viewBox={`0 0 ${CARD_W_MM} ${LINE_MM}`}
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="0" y="0" width={CARD_W_MM} height={LINE_MM} className="propis-paper" />
            {CARD_DIAG.map((l, i) => (
              <line key={`d${i}`} x1={l.x1} y1={0} x2={l.x2} y2={LINE_MM} className="propis-line-diag" />
            ))}
            {CARD_LINES.map((l, i) => (
              <line key={`h${i}`} x1={0} y1={l.y} x2={CARD_W_MM} y2={l.y}
                className={l.bold ? "propis-line-bold" : "propis-line-thin"} />
            ))}
            <line x1={CARD_MARGIN_MM} y1={0} x2={CARD_MARGIN_MM} y2={LINE_MM} className="propis-line-red" />

            {activeItem && (
              <g transform={`translate(${CARD_MARGIN_MM} 0)`}>
                <LoopingLetterCell key={activeKey} item={activeItem} />
              </g>
            )}
          </svg>

          {!activeItem && (
            <div className="propis-practice-empty">«{letter}{caseMode === "lower" ? letter.toLowerCase() : ""}» ещё не записана</div>
          )}
        </div>

        <div className="propis-practice-keyboard">
          <div className="propis-case-toggle" role="group" aria-label="Регистр">
            <button
              type="button"
              className={`propis-case-btn${caseMode === "upper" ? " propis-case-btn--active" : ""}`}
              onClick={() => setCaseMode("upper")}
            >
              <span className="propis-case-arrow">▲</span>
              ЗАГЛАВНАЯ
            </button>
            <button
              type="button"
              className={`propis-case-btn${caseMode === "lower" ? " propis-case-btn--active" : ""}`}
              onClick={() => setCaseMode("lower")}
            >
              <span className="propis-case-arrow">▼</span>
              строчная
            </button>
          </div>

          <div className="propis-key-rows">
            {ABV_ROWS.map((row, ri) => (
              <div className="propis-key-row" key={ri}>
                {row.map((l) => {
                  const has = itemsByKey.has(keyFor(l, caseMode));
                  return (
                    <button
                      type="button"
                      key={l}
                      className={`propis-key${l === letter ? " propis-key--active" : ""}`}
                      disabled={!has}
                      onClick={() => setLetter(l)}
                    >
                      {caseMode === "upper" ? l : l.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
