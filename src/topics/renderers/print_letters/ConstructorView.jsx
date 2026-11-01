import { useState, useMemo } from "react";
import LetterBlock from "./LetterBlock";

const FAMILY_TITLES = { straight: "Прямые линии" };
const PALETTE = ["#e8702a", "#2f8fd1", "#b5257a", "#3aa655", "#d1a62f", "#7a52c9"];
const BLOCKS_PER_SHEET = 4;

export default function ConstructorView({ task, onAdvance }) {
  const letters = task?.letters ?? [];
  const byId = useMemo(() => Object.fromEntries(letters.map((l) => [l.id, l])), [letters]);
  const families = useMemo(() => {
    const map = new Map();
    for (const l of letters) {
      const famId = l.family ?? "other";
      if (!map.has(famId)) map.set(famId, []);
      map.get(famId).push(l);
    }
    return Array.from(map.entries());
  }, [letters]);

  const [selected, setSelected] = useState([]); // ordered letter ids
  const [mode, setMode] = useState("trace"); // "trace" | "independent"

  function toggleLetter(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const sheets = [];
  for (let i = 0; i < selected.length; i += BLOCKS_PER_SHEET) {
    sheets.push(selected.slice(i, i + BLOCKS_PER_SHEET));
  }

  function printNotebook() {
    window.print();
  }

  return (
    <div className="pl-constructor">
      <div className="pl-builder">
        <div className="pl-builder-section">
          <div className="pl-builder-label">Буквы для тетради</div>
          {families.map(([famId, famLetters]) => (
            <div key={famId} className="pl-family-group">
              <div className="pl-family-title">{FAMILY_TITLES[famId] ?? famId}</div>
              <div className="pl-letter-tiles">
                {famLetters.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`pl-letter-tile${selected.includes(l.id) ? " pl-letter-tile--active" : ""}`}
                    onClick={() => toggleLetter(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pl-builder-section">
          <div className="pl-builder-label">Тип строки</div>
          <div className="pl-pagetype-tiles">
            <button
              type="button"
              className={`pl-pagetype-tile${mode === "trace" ? " pl-pagetype-tile--active" : ""}`}
              onClick={() => setMode("trace")}
            >
              Обводка по точкам
            </button>
            <button
              type="button"
              className={`pl-pagetype-tile${mode === "independent" ? " pl-pagetype-tile--active" : ""}`}
              onClick={() => setMode("independent")}
            >
              Часть строки — самостоятельно
            </button>
          </div>
        </div>

        {selected.length > 0 && (
          <button type="button" className="pl-btn pl-btn--print" onClick={printNotebook}>🖨 Печать</button>
        )}
        <button type="button" className="pl-btn pl-btn--done" onClick={onAdvance}>Завершить занятие</button>
      </div>

      <div className="pl-preview">
        {selected.length === 0 && (
          <div className="pl-preview-empty">Отметьте буквы — страницы соберутся сами, по {BLOCKS_PER_SHEET} буквы на лист</div>
        )}
        {sheets.map((group, sheetIdx) => (
          <div key={sheetIdx} className="pl-sheet">
            <div className="pl-page">
              {group.map((id, idx) => (
                <LetterBlock
                  key={id}
                  letter={byId[id]}
                  color={PALETTE[(sheetIdx * BLOCKS_PER_SHEET + idx) % PALETTE.length]}
                  independent={mode === "independent"}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
