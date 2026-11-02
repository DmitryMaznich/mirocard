import { useState, useMemo } from "react";
import LetterBlock from "./LetterBlock";
import LetterPickerButton from "./LetterPickerButton";
import RowContentPicker from "./RowContentPicker";

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

// propis2's own model, not a reinvented one: the canvas is a clean preview —
// no controls live on the rows themselves — and a click on a row selects it;
// everything you can do to that selection (or to its block) lives in one
// toolbar above the canvas, present but disabled when nothing fits it. Only
// the "letter"/"row content" pickers keep their own popups, same as propis2's
// Propis2Picker buttons sitting right in that same toolbar.
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
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;
  const selectedRow = selectedBlock?.rows.find((r) => r.id === selectedRowId) ?? null;

  function selectBlock(blockId) {
    setSelectedBlockId(blockId);
    setSelectedRowId(null);
  }
  function selectRow(blockId, rowId) {
    setSelectedBlockId(blockId);
    setSelectedRowId(rowId);
  }

  function addBlock(letterId) {
    const letter = byId[letterId];
    if (!letter) return;
    const id = nextId();
    const rows = defaultRows(letter);
    setBlocks((prev) => [...prev, { id, letterId, color: PALETTE[prev.length % PALETTE.length], rows }]);
    setSelectedBlockId(id);
    setSelectedRowId(rows[rows.length - 1].id);
  }
  function removeSelectedBlock() {
    if (!selectedBlockId) return;
    setBlocks((prev) => prev.filter((b) => b.id !== selectedBlockId));
    setSelectedBlockId(null);
    setSelectedRowId(null);
  }
  function addRowToSelectedBlock() {
    if (!selectedBlockId) return;
    const rowId = nextId();
    setBlocks((prev) => prev.map((b) => (b.id === selectedBlockId ? { ...b, rows: [...b.rows, { id: rowId, content: "full" }] } : b)));
    setSelectedRowId(rowId);
  }
  function removeSelectedRow() {
    if (!selectedBlockId || !selectedRowId) return;
    setBlocks((prev) => prev.map((b) => (b.id === selectedBlockId ? { ...b, rows: b.rows.filter((r) => r.id !== selectedRowId) } : b)));
    setSelectedRowId(null);
  }
  function setSelectedRowContent(content) {
    if (!selectedBlockId || !selectedRowId) return;
    setBlocks((prev) => prev.map((b) => (
      b.id === selectedBlockId ? { ...b, rows: b.rows.map((r) => (r.id === selectedRowId ? { ...r, content } : r)) } : b
    )));
  }

  function printNotebook() {
    window.print();
  }

  return (
    <div className="pl-constructor">
      <div className="pl-toolbar no-print" role="toolbar" aria-label="Инструменты">
        <LetterPickerButton families={families} onPick={addBlock} />
        <span className="pl-sep" aria-hidden="true" />
        <button type="button" className="pl-tool" disabled={!selectedBlockId} onClick={addRowToSelectedBlock}>
          <span className="pl-tool-ico" aria-hidden="true">+</span>
          <span className="pl-tool-cap">Строка</span>
        </button>
        <button type="button" className="pl-tool" disabled={!selectedBlockId} onClick={removeSelectedBlock}>
          <span className="pl-tool-ico" aria-hidden="true">🗑</span>
          <span className="pl-tool-cap">Блок</span>
        </button>
        <span className="pl-sep" aria-hidden="true" />
        <RowContentPicker
          disabled={!selectedRow}
          value={selectedRow?.content ?? "full"}
          strokeCount={selectedBlock ? byId[selectedBlock.letterId].strokes.length : 0}
          onChange={setSelectedRowContent}
        />
        <button type="button" className="pl-tool" disabled={!selectedRow} onClick={removeSelectedRow}>
          <span className="pl-tool-ico" aria-hidden="true">✕</span>
          <span className="pl-tool-cap">Строку</span>
        </button>
        <span className="pl-toolbar-fill" />
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

      <div className="pl-canvas" onClick={() => { setSelectedBlockId(null); setSelectedRowId(null); }}>
        {blocks.length === 0 && (
          <div className="pl-preview-empty">Нажмите «+ Буква» — появится блок; кликните по строке, чтобы настроить именно её</div>
        )}
        <div className="pl-notebook">
          {blocks.map((b) => (
            <LetterBlock
              key={b.id}
              letter={byId[b.letterId]}
              color={b.color}
              rows={b.rows}
              selected={b.id === selectedBlockId}
              selectedRowId={b.id === selectedBlockId ? selectedRowId : null}
              onSelectBlock={() => selectBlock(b.id)}
              onSelectRow={(rowId) => selectRow(b.id, rowId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
