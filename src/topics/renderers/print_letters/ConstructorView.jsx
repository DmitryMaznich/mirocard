import { useState, useMemo } from "react";
import LetterBlock from "./LetterBlock";

const FAMILY_TITLES = { straight: "Прямые линии" };
const PALETTE = ["#e8702a", "#2f8fd1", "#b5257a", "#3aa655", "#d1a62f", "#7a52c9"];

let uid = 1;
const nextId = () => uid++;

// Starting point when a block is created — one row per stroke element, then
// the whole letter. Purely a convenient default: every row is independently
// editable/removable afterwards, and more rows can be added freely.
function defaultRows(letter) {
  const rows = letter.strokes.map((_, i) => ({ content: i }));
  rows.push({ content: "full" });
  return rows.map((r) => ({ id: nextId(), ...r }));
}

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

  const [activeLetterId, setActiveLetterId] = useState(letters[0]?.id ?? null);
  const [blocks, setBlocks] = useState([]); // { id, letterId, color, rows: [{ id, content }] }

  function addBlock() {
    const letter = byId[activeLetterId];
    if (!letter) return;
    setBlocks((prev) => [
      ...prev,
      {
        id: nextId(),
        letterId: activeLetterId,
        color: PALETTE[prev.length % PALETTE.length],
        rows: defaultRows(letter),
      },
    ]);
  }
  function removeBlock(blockId) {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }
  function addRow(blockId) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, rows: [...b.rows, { id: nextId(), content: "full" }] } : b)));
  }
  function removeRow(blockId, rowId) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, rows: b.rows.filter((r) => r.id !== rowId) } : b)));
  }
  function setRowContent(blockId, rowId, content) {
    setBlocks((prev) => prev.map((b) => (
      b.id === blockId ? { ...b, rows: b.rows.map((r) => (r.id === rowId ? { ...r, content } : r)) } : b
    )));
  }

  function printNotebook() {
    window.print();
  }

  return (
    <div className="pl-constructor">
      <div className="pl-builder">
        <div className="pl-builder-section">
          <div className="pl-builder-label">Буква для нового блока</div>
          {families.map(([famId, famLetters]) => (
            <div key={famId} className="pl-family-group">
              <div className="pl-family-title">{FAMILY_TITLES[famId] ?? famId}</div>
              <div className="pl-letter-tiles">
                {famLetters.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`pl-letter-tile${l.id === activeLetterId ? " pl-letter-tile--active" : ""}`}
                    onClick={() => setActiveLetterId(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="pl-btn pl-btn--add" onClick={addBlock} disabled={!activeLetterId}>
          + Добавить блок буквы
        </button>
        {blocks.length > 0 && (
          <button type="button" className="pl-btn pl-btn--print" onClick={printNotebook}>🖨 Печать</button>
        )}
        <button type="button" className="pl-btn pl-btn--done" onClick={onAdvance}>Завершить занятие</button>
      </div>

      <div className="pl-preview">
        {blocks.length === 0 && (
          <div className="pl-preview-empty">Выберите букву и нажмите «Добавить блок буквы» — дальше в каждом блоке можно добавлять и убирать строки</div>
        )}
        <div className="pl-notebook">
          {blocks.map((b) => (
            <LetterBlock
              key={b.id}
              letter={byId[b.letterId]}
              color={b.color}
              rows={b.rows}
              onAddRow={() => addRow(b.id)}
              onRemoveRow={(rowId) => removeRow(b.id, rowId)}
              onChangeRowContent={(rowId, content) => setRowContent(b.id, rowId, content)}
              onRemoveBlock={() => removeBlock(b.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
