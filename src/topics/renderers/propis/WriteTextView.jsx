import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { layoutTextIntoRows } from "./wordEngine.js";
import AnimatedStrokes from "./AnimatedStrokes.jsx";
import {
  INK_COLOR, NATIVE_L3, NATIVE_NARROW_MID, UNIT_H, TEXT_ROW_PITCH, TEXT_ROW_THIN_OFFSET,
  TEXT_ROW_DIAGONAL_SPACING, buildDiagonalLines,
} from "./propisRuling.js";

// Word tap-hit rect: see ReadTextView.jsx's identical WORD_HIT_Y for the full derivation --
// centers the hit rect on the row's own visual content instead of pinning it to y=0, which
// otherwise sits mostly above where the ink actually renders.
const WORD_HIT_Y = NATIVE_NARROW_MID - TEXT_ROW_PITCH / 2;

const DIGIT_ROW = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

// Same ЙЦУКЕН layout the app's magnetic_alphabet keyboard offers as an alternative to its
// alphabetical rows — a real physical-keyboard layout, which is what this mode wants.
const QWERTY_ROWS = [
  ["Й", "Ц", "У", "К", "Е", "Н", "Г", "Ш", "Щ", "З", "Х"],
  ["Ф", "Ы", "В", "А", "П", "Р", "О", "Л", "Д", "Ж", "Э"],
  ["Я", "Ч", "С", "М", "И", "Т", "Ь", "Б", "Ю", "Ъ", "Ё"],
];

const PUNCT_LEFT = ["!", "?"];
const PUNCT_RIGHT = [".", ","];

// Same classification magnetic_alphabet uses — visual style only, no drag-and-drop.
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

// Real "косая линейка" cycle -- one thin line (x-height top) and one thick
// baseline line per TEXT_ROW_PITCH, exactly mirroring the print notebooks'
// own NARROW_MM/WIDE_MM alternation (see propisRuling.js's TEXT_ROW_PITCH
// comment for the full derivation and why this replaced the old 4-line
// NATIVE_L1..L4 set, which only fit a single isolated row, not tiled text).
const GUIDE_ROW_LINES = [
  { y: NATIVE_L3 - TEXT_ROW_THIN_OFFSET, bold: false },
  { y: NATIVE_L3, bold: true },
];
const GUIDE_COLOR = "#6fa3e0";
const GUIDE_DIAG_W = 0.25;
const GUIDE_THIN_W = 0.4;
const GUIDE_BOLD_W = 0.9;

// Digits/punctuation render as a plain system-font glyph (see wordEngine.js's
// buildWordSegments) until they have real captured cursive strokes — sized to roughly
// match a cursive letter's own x-height so it doesn't look wildly out of place on the line.
const FALLBACK_FONT_SIZE = 34;

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

  const punctuationByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.punctuation ?? []) map.set(item.label ?? item.id, item);
    return map;
  }, [task]);

  const [text, setText] = useState(task?.initialText ?? "");
  const [caseMode, setCaseMode] = useState("lower");
  const [activeIndex, setActiveIndex] = useState(null);
  useEffect(() => setActiveIndex(null), [text]);

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

  // Every keystroke rebuilds the layout over the FULL current text (see layoutTextIntoRows),
  // so without this cache every already-finished word would be rebuilt from scratch (real
  // stroke-geometry work) on every subsequent keystroke — an O(text typed so far) cost per
  // keystroke that grew unbounded as the user kept writing, and was the real driver behind
  // typing feeling laggy/dropping input the longer a session ran (2026-08-13). Recreated only
  // when the letter/connector data itself changes (never mid-session in practice).
  const segmentCache = useMemo(() => new Map(), [lettersByLabel, connectorsByKey, punctuationByLabel]);

  const layout = useMemo(
    () => layoutTextIntoRows(text, lettersByLabel, connectorsByKey, rowWidthUnits, segmentCache, punctuationByLabel),
    [text, lettersByLabel, connectorsByKey, rowWidthUnits, segmentCache, punctuationByLabel]
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

  const handleSymbol = useCallback((symbol) => setText((t) => t + symbol), []);
  const toggleShift = useCallback(() => setCaseMode((m) => (m === "upper" ? "lower" : "upper")), []);
  const handleSpace = useCallback(() => setText((t) => t + " "), []);
  const handleEnter = useCallback(() => setText((t) => t + "\n"), []);
  const handleBackspace = useCallback(() => {
    setText((t) => Array.from(t).slice(0, -1).join(""));
  }, []);
  const handleClear = useCallback(() => setText(""), []);

  const gridHeight = (layout.rowCount - 1) * TEXT_ROW_PITCH + UNIT_H;
  const diagonalLines = useMemo(
    () => buildDiagonalLines(gridHeight, rowWidthUnits, TEXT_ROW_DIAGONAL_SPACING),
    [gridHeight, rowWidthUnits]
  );

  return (
    <div className="propis-practice-stage">
      <button type="button" className="propis-ctrl-btn propis-practice-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-text-frame">
        <div className="propis-text-grid-scroll" ref={wrapRef}>
          <svg
            className="propis-text-grid-svg"
            viewBox={`0 0 ${rowWidthUnits} ${gridHeight}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
            {diagonalLines.map((l, i) => (
              <line key={`diag${i}`} x1={l.x1} y1={0} x2={l.x2} y2={gridHeight} stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W} />
            ))}
            {Array.from({ length: layout.rowCount }, (_, rowIndex) =>
              GUIDE_ROW_LINES.map((g, gi) => (
                <line
                  key={`${rowIndex}_${gi}`}
                  x1="0" y1={rowIndex * TEXT_ROW_PITCH + g.y} x2={rowWidthUnits} y2={rowIndex * TEXT_ROW_PITCH + g.y}
                  stroke={GUIDE_COLOR}
                  strokeWidth={g.bold ? GUIDE_BOLD_W : GUIDE_THIN_W}
                />
              ))
            )}
            {layout.placed.map((p, i) => {
              const wordWidth = p.segments.reduce((sum, seg) => sum + seg.width, 0);
              const isActive = i === activeIndex;
              return (
                <g key={i} transform={`translate(${p.x} ${p.rowIndex * TEXT_ROW_PITCH})`}>
                  <rect
                    className="propis-text-word-hit"
                    x={-4} y={WORD_HIT_Y} width={wordWidth + 8} height={TEXT_ROW_PITCH}
                    onClick={() => setActiveIndex((cur) => (cur === i ? null : i))}
                  />
                  {p.segments.map((seg, si) =>
                    seg.type === "cursive" ? (
                      <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                        {isActive ? (
                          <AnimatedStrokes trajectory={seg.trajectory} />
                        ) : (
                          seg.trajectory.strokes.map((s, ssi) => (
                            <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          ))
                        )}
                      </g>
                    ) : seg.type === "glyph" ? (
                      // Real captured punctuation ink, but never animated (see
                      // buildPunctuationGlyph in wordEngine.js) — it's a standalone
                      // replacement for the fallback font glyph, not a letter that chains.
                      <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                        {seg.strokes.map((s, ssi) => (
                          <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        ))}
                      </g>
                    ) : (
                      <text
                        key={si}
                        x={seg.xOffset} y={NATIVE_L3}
                        fontSize={FALLBACK_FONT_SIZE}
                        fontFamily="system-ui, sans-serif"
                        fill={INK_COLOR}
                      >
                        {seg.text}
                      </text>
                    )
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="propis-practice-keyboard">
          <div className="propis-key-rows">
            <div className="propis-key-row">
              {DIGIT_ROW.map((d) => (
                <button type="button" key={d} className="propis-key propis-key--neutral" onClick={() => handleSymbol(d)}>{d}</button>
              ))}
            </div>

            {QWERTY_ROWS.map((row, ri) => (
              <div className="propis-key-row" key={ri}>
                {ri === QWERTY_ROWS.length - 1 && (
                  <button
                    type="button"
                    className={`propis-key propis-key--shift${caseMode === "upper" ? " propis-key--active" : ""}`}
                    onClick={toggleShift}
                    aria-label="Регистр"
                    aria-pressed={caseMode === "upper"}
                  >
                    ⇧
                  </button>
                )}
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
              {PUNCT_LEFT.map((p) => (
                <button type="button" key={p} className="propis-key propis-key--neutral" onClick={() => handleSymbol(p)}>{p}</button>
              ))}
              <button type="button" className="propis-key propis-key--wide" onClick={handleSpace}>пробел</button>
              {PUNCT_RIGHT.map((p) => (
                <button type="button" key={p} className="propis-key propis-key--neutral" onClick={() => handleSymbol(p)}>{p}</button>
              ))}
            </div>

            <div className="propis-key-row">
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
