import { useState, useMemo } from "react";
import LetterBlock from "./LetterBlock";
import LetterPickerButton from "./LetterPickerButton";

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

// Same architecture as the propis2 constructor: the canvas (the notebook) is
// the main view, a narrow tool strip sits above it, and picking a letter is
// a popup from a toolbar button rather than a permanent grid taking up its
// own panel.
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

  const [blocks, setBlocks] = useState([]); // { id, letterId, color, rows: [{ id, content }] }

  function addBlock(letterId) {
    const letter = byId[letterId];
    if (!letter) return;
    setBlocks((prev) => [
      ...prev,
      {
        id: nextId(),
        letterId,
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
      <div className="pl-toolbar no-print">
        <LetterPickerButton families={families} onPick={addBlock} />
        {blocks.length > 0 && (
          <button type="button" className="pl-tool" onClick={printNotebook}>
            <span className="pl-tool-ico" aria-hidden="true">🖨</span>
            <span className="pl-tool-cap">Печать</span>
          </button>
        )}
        <button type="button" className="pl-tool pl-tool--muted" onClick={onAdvance}>
          <span className="pl-tool-ico" aria-hidden="true">✕</span>
          <span className="pl-tool-cap">Завершить</span>
        </button>
      </div>

      <div className="pl-canvas">
        {blocks.length === 0 && (
          <div className="pl-preview-empty">Нажмите «+ Буква» — появится блок; в нём можно добавлять и настраивать строки</div>
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
