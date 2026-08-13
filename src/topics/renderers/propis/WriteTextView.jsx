import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { layoutTextIntoRows } from "./wordEngine.js";
import { INK_COLOR, NATIVE_L1, NATIVE_L2, NATIVE_L3, NATIVE_L4, UNIT_H } from "./propisRuling.js";

// Same alphabetical grouping WriteWordsView/PropisPracticeView and the app's
// magnetic_alphabet keyboard all use, for a consistent layout across topics.
const ABV_ROWS = [
  ["А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "И", "Й"],
  ["К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф"],
  ["Х", "Ц", "Ч", "Ш", "Щ", "Ъ", "Ы", "Ь", "Э", "Ю", "Я"],
];

// Same classification magnetic_alphabet uses — visual style only, no drag-and-drop, no
// digit/punctuation rows (there's no captured propis stroke data for those characters, so
// buildWordTrajectory would throw on them).
const VOWELS = new Set(["А", "Е", "Ё", "И", "О", "У", "Ы", "Э", "Ю", "Я"]);
const SIGNS = new Set(["Ъ", "Ь"]);
function keyCategory(letter) {
  if (VOWELS.has(letter)) return "vowel";
  if (SIGNS.has(letter)) return "sign";
  return "consonant";
}

// Fixed on-screen row height — native units (UNIT_H=150 tall per row) are converted to
// pixels through this, so the SVG viewBox's own width/height ratio always matches the
// container's real pixel aspect exactly (no preserveAspectRatio distortion needed).
const ROW_HEIGHT_PX = 72;

const GUIDE_ROW_LINES = [
  { y: NATIVE_L1, bold: false },
  { y: NATIVE_L2, bold: false },
  { y: NATIVE_L3, bold: true },
  { y: NATIVE_L4, bold: false },
];
const GUIDE_COLOR = "#6fa3e0";
const GUIDE_THIN_W = 0.4;
const GUIDE_BOLD_W = 0.9;

export default function WriteTextView({ task, onClose }) {
  const lettersByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.letters ?? []) map.set(item.label ?? item.id, item);
    return map;
  }, [task]);

  const connectorsByKey = useMemo(() => {
    const map = new Map();
    for (const item of task?.connectors ?? []) {
      const key = `${item.fromLine}_${item.toLine}`;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [task]);

  const [text, setText] = useState("");
  const [caseMode, setCaseMode] = useState("lower");

  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(320);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWrapW(entries[0].contentRect.width || 320);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowWidthUnits = (wrapW / ROW_HEIGHT_PX) * UNIT_H;

  const layout = useMemo(
    () => layoutTextIntoRows(text, lettersByLabel, connectorsByKey, rowWidthUnits),
    [text, lettersByLabel, connectorsByKey, rowWidthUnits]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [layout.rowCount]);

  const handleKey = useCallback((letter) => {
    const ch = caseMode === "upper" ? letter : letter.toLowerCase();
    setText((t) => t + ch);
  }, [caseMode]);

  const handleSpace = useCallback(() => setText((t) => t + " "), []);
  const handleEnter = useCallback(() => setText((t) => t + "\n"), []);
  const handleBackspace = useCallback(() => {
    setText((t) => Array.from(t).slice(0, -1).join(""));
  }, []);
  const handleClear = useCallback(() => setText(""), []);

  return (
    <div className="propis-practice-stage">
      <button type="button" className="propis-ctrl-btn propis-practice-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-text-frame">
        <div className="propis-text-grid-scroll" ref={wrapRef}>
          <svg
            className="propis-text-grid-svg"
            viewBox={`0 0 ${rowWidthUnits} ${layout.rowCount * UNIT_H}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
            {Array.from({ length: layout.rowCount }, (_, rowIndex) =>
              GUIDE_ROW_LINES.map((g, gi) => (
                <line
                  key={`${rowIndex}_${gi}`}
                  x1="0" y1={rowIndex * UNIT_H + g.y} x2={rowWidthUnits} y2={rowIndex * UNIT_H + g.y}
                  stroke={GUIDE_COLOR}
                  strokeWidth={g.bold ? GUIDE_BOLD_W : GUIDE_THIN_W}
                />
              ))
            )}
            {layout.placed.map((p, i) => (
              <g key={i} transform={`translate(${p.x} ${p.rowIndex * UNIT_H})`}>
                {p.trajectory.strokes.map((s, si) => (
                  <path key={si} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </g>
            ))}
          </svg>
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
                {row.map((l) => (
                  <button
                    type="button"
                    key={l}
                    className={`propis-key propis-key--${keyCategory(l)}`}
                    onClick={() => handleKey(l)}
                  >
                    {caseMode === "upper" ? l : l.toLowerCase()}
                  </button>
                ))}
              </div>
            ))}
            <div className="propis-key-row">
              <button type="button" className="propis-key propis-key--wide" onClick={handleSpace}>пробел</button>
              <button type="button" className="propis-key propis-key--wide" onClick={handleEnter} aria-label="Новая строка">⏎</button>
              <button type="button" className="propis-key propis-key--wide" onClick={handleBackspace} disabled={!text} aria-label="Стереть">←</button>
              <button type="button" className="propis-key propis-key--wide" onClick={handleClear} disabled={!text}>Очистить</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
