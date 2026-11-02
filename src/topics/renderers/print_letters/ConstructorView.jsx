import { useState, useMemo } from "react";
import LetterBlock from "./LetterBlock";
import LetterPickerButton from "./LetterPickerButton";
import RowContentPicker from "./RowContentPicker";
import PageThumb from "./PageThumb";
import { IconPlus, IconTrash, IconPrint, IconClose, IconUp, IconDown, IconDuplicate } from "./icons";

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

function blankPage() {
  return { id: nextId(), blocks: [] };
}

// propis2's own model (verified against the real Propis2Editor, not just its
// source comments): a title bar, a page sidebar with real-content thumbnails
// on the left, one page open on the canvas at a time, and a toolbar above it
// whose buttons act on whatever is selected (a row, a block) and are present
// but disabled rather than hidden when there is nothing to act on. No back
// button here — the standard session header above this renderer already
// has one; this title bar is cosmetic, "Завершить" below still means
// "this task is done," a different action from leaving the session.
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

  const [pages, setPages] = useState(() => [blankPage()]);
  const [activePageId, setActivePageId] = useState(() => pages[0]?.id ?? null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const activePageIndex = pages.findIndex((p) => p.id === activePageId);
  const activePage = pages[activePageIndex] ?? null;
  const selectedBlock = activePage?.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const selectedRow = selectedBlock?.rows.find((r) => r.id === selectedRowId) ?? null;

  function updateActivePage(fn) {
    setPages((prev) => prev.map((p) => (p.id === activePageId ? fn(p) : p)));
  }

  function switchPage(pageId) {
    setActivePageId(pageId);
    setSelectedBlockId(null);
    setSelectedRowId(null);
  }
  function addPage() {
    const page = blankPage();
    setPages((prev) => [...prev, page]);
    switchPage(page.id);
  }
  function duplicateActivePage() {
    if (!activePage) return;
    const copy = { id: nextId(), blocks: activePage.blocks.map((b) => ({ ...b, id: nextId(), rows: b.rows.map((r) => ({ ...r, id: nextId() })) })) };
    setPages((prev) => {
      const next = [...prev];
      next.splice(activePageIndex + 1, 0, copy);
      return next;
    });
    switchPage(copy.id);
  }
  function moveActivePage(dir) {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === activePageId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function removeActivePage() {
    if (!activePage) return;
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== activePageId);
      const result = next.length > 0 ? next : [blankPage()];
      const fallback = result[Math.min(activePageIndex, result.length - 1)];
      switchPage(fallback.id);
      return result;
    });
  }

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
    if (!letter || !activePage) return;
    const id = nextId();
    const rows = defaultRows(letter);
    updateActivePage((p) => ({ ...p, blocks: [...p.blocks, { id, letterId, color: PALETTE[p.blocks.length % PALETTE.length], rows }] }));
    setSelectedBlockId(id);
    setSelectedRowId(rows[rows.length - 1].id);
  }
  function removeSelectedBlock() {
    if (!selectedBlockId) return;
    updateActivePage((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== selectedBlockId) }));
    setSelectedBlockId(null);
    setSelectedRowId(null);
  }
  function addRowToSelectedBlock() {
    if (!selectedBlockId) return;
    const rowId = nextId();
    updateActivePage((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === selectedBlockId ? { ...b, rows: [...b.rows, { id: rowId, content: "full" }] } : b)) }));
    setSelectedRowId(rowId);
  }
  function removeSelectedRow() {
    if (!selectedBlockId || !selectedRowId) return;
    updateActivePage((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === selectedBlockId ? { ...b, rows: b.rows.filter((r) => r.id !== selectedRowId) } : b)) }));
    setSelectedRowId(null);
  }
  function setSelectedRowContent(content) {
    if (!selectedBlockId || !selectedRowId) return;
    updateActivePage((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (
        b.id === selectedBlockId ? { ...b, rows: b.rows.map((r) => (r.id === selectedRowId ? { ...r, content } : r)) } : b
      )),
    }));
  }

  function printNotebook() {
    window.print();
  }

  const hasContent = pages.some((p) => p.blocks.length > 0);

  return (
    <div className="pl-constructor">
      <div className="pl-header no-print">
        <span className="pl-header-title">Печатные буквы</span>
      </div>

      <div className="pl-toolbar no-print" role="toolbar" aria-label="Инструменты">
        <LetterPickerButton families={families} onPick={addBlock} />
        <span className="pl-sep" aria-hidden="true" />
        <button type="button" className="pl-tool" disabled={!selectedBlockId} onClick={addRowToSelectedBlock}>
          <span className="pl-tool-ico"><IconPlus /></span>
          <span className="pl-tool-cap">Строка</span>
        </button>
        <button type="button" className="pl-tool" disabled={!selectedBlockId} onClick={removeSelectedBlock}>
          <span className="pl-tool-ico"><IconTrash /></span>
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
          <span className="pl-tool-ico"><IconClose /></span>
          <span className="pl-tool-cap">Строку</span>
        </button>
        <span className="pl-toolbar-fill" />
        {hasContent && (
          <button type="button" className="pl-tool" onClick={printNotebook}>
            <span className="pl-tool-ico"><IconPrint /></span>
            <span className="pl-tool-cap">Печать</span>
          </button>
        )}
        <button type="button" className="pl-tool pl-tool--muted" onClick={onAdvance}>
          <span className="pl-tool-ico"><IconClose /></span>
          <span className="pl-tool-cap">Завершить</span>
        </button>
      </div>

      <div className="pl-body">
        <div className="pl-pages-rail no-print">
          <div className="pl-pages-list">
            {pages.map((p, i) => (
              <PageThumb key={p.id} page={p} byId={byId} active={p.id === activePageId} index={i} onSelect={() => switchPage(p.id)} />
            ))}
          </div>
          <button type="button" className="pl-page-add" onClick={addPage}>
            <IconPlus /> Страница
          </button>
          <div className="pl-page-actions">
            <button type="button" onClick={duplicateActivePage} aria-label="Дублировать страницу" title="Дублировать"><IconDuplicate /></button>
            <button type="button" onClick={() => moveActivePage(-1)} disabled={activePageIndex <= 0} aria-label="Страница выше" title="Выше"><IconUp /></button>
            <button type="button" onClick={() => moveActivePage(1)} disabled={activePageIndex < 0 || activePageIndex >= pages.length - 1} aria-label="Страница ниже" title="Ниже"><IconDown /></button>
            <button type="button" onClick={removeActivePage} aria-label="Удалить страницу" title="Удалить" className="pl-page-actions-danger"><IconTrash /></button>
          </div>
        </div>

        <div className="pl-canvas" onClick={() => { setSelectedBlockId(null); setSelectedRowId(null); }}>
          {!hasContent && (
            <div className="pl-preview-empty">Нажмите «+ Буква» — появится блок; кликните по строке, чтобы настроить именно её</div>
          )}
          {activePage && (
            <div className="pl-sheet">
              {activePage.blocks.map((b) => (
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
          )}
        </div>
      </div>

      {/* Print renders every page as its own physical sheet, not just the one being edited on screen. */}
      <div className="pl-print-pages">
        {pages.map((p) => (
          <div key={p.id} className="pl-sheet pl-sheet--print">
            {p.blocks.map((b) => (
              <LetterBlock
                key={b.id}
                letter={byId[b.letterId]}
                color={b.color}
                rows={b.rows}
                selected={false}
                selectedRowId={null}
                onSelectBlock={() => {}}
                onSelectRow={() => {}}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
