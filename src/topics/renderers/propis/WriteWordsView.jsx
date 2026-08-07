import { useMemo, useState, useCallback } from "react";
import WordAnimatedCard from "./WordAnimatedCard.jsx";
import { buildWordTrajectory } from "./wordEngine.js";

// Same alphabetical grouping PropisPracticeView and the app's magnetic_alphabet
// keyboard both use, for a consistent layout across topics.
const ABV_ROWS = [
  ["А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "И", "Й"],
  ["К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф"],
  ["Х", "Ц", "Ч", "Ш", "Щ", "Ъ", "Ы", "Ь", "Э", "Ю", "Я"],
];

export default function WriteWordsView({ task, onClose }) {
  const lettersByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.letters ?? []) map.set(item.label ?? item.id, item);
    return map;
  }, [task]);

  const connectorsByKey = useMemo(() => {
    const map = new Map();
    for (const item of task?.connectors ?? []) map.set(`${item.fromLine}_${item.toLine}`, item);
    return map;
  }, [task]);

  const [word, setWord] = useState("");
  const [caseMode, setCaseMode] = useState("lower");

  const trajectory = useMemo(() => {
    if (!word) return null;
    try {
      return buildWordTrajectory(word, lettersByLabel, connectorsByKey);
    } catch {
      return null;
    }
  }, [word, lettersByLabel, connectorsByKey]);

  const handleKey = useCallback((letter) => {
    const ch = caseMode === "upper" ? letter : letter.toLowerCase();
    setWord((w) => w + ch);
  }, [caseMode]);

  const handleBackspace = useCallback(() => {
    setWord((w) => Array.from(w).slice(0, -1).join(""));
  }, []);

  const handleClear = useCallback(() => setWord(""), []);

  return (
    <div className="propis-practice-stage">
      <button type="button" className="propis-ctrl-btn propis-practice-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-practice-frame">
        <div className="propis-practice-demo">
          {trajectory
            ? <WordAnimatedCard trajectory={trajectory} />
            : <div className="propis-practice-empty">Набери слово внизу — здесь появится анимация письма</div>}
        </div>

        <div className="propis-word-row">
          <div className="propis-word-preview">{word || " "}</div>
          <button type="button" className="propis-word-btn" onClick={handleBackspace} disabled={!word} aria-label="Стереть букву">←</button>
          <button type="button" className="propis-word-btn" onClick={handleClear} disabled={!word}>Очистить</button>
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
                    className="propis-key"
                    onClick={() => handleKey(l)}
                  >
                    {caseMode === "upper" ? l : l.toLowerCase()}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
