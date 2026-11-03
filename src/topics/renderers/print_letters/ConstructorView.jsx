import { useState, useRef } from "react";
import LetterPickerButton from "./LetterPickerButton";
import PageThumb from "./PageThumb";
import OptionPicker from "./OptionPicker";
import Sheet from "./Sheet";
import RowInspector from "./RowInspector";
import BottomSheet from "./BottomSheet";
import PrintPages from "./PrintPages";
import { NARROW_QUERY, useFitZoom, useMediaQuery } from "./hooks";
import { FORMATS, paperOf, allElements, ladderRows, pageOverflows, sheetSizeMm } from "./model";
import { PALETTE, blankPage, newId } from "./library";
import {
  IconPlus, IconAddRow, IconTrash, IconPrint, IconUp, IconDown, IconDuplicate, IconBack, IconSave,
  IconPaperSquare, IconPaperLine3, IconPaperLine2, IconFormatA4, IconFormatA5,
} from "./icons";

const PAPER_OPTIONS = [
  { id: "cell", label: "Клетка", Icon: IconPaperSquare },
  { id: "line3", label: "Линейка: 3 линии", Icon: IconPaperLine3 },
  { id: "line2", label: "Линейка: 2 линии", Icon: IconPaperLine2 },
];
const FORMAT_OPTIONS = [
  { id: "a4", label: FORMATS.a4.label, Icon: IconFormatA4 },
  { id: "a5", label: FORMATS.a5.label, Icon: IconFormatA5 },
];

const withIds = (rows) => rows.map((r) => ({ id: newId(), ...r }));

// The editor of one notebook — propis2's own editor model: a dark header with
// back / the notebook's name / save, a toolbar for page and block actions, a
// page rail with real thumbnails, one page on the canvas and — this topic's
// own part — a row panel (right side on wide screens, bottom sheet on phones)
// where the selected row's elements are picked on the letter itself.
//
// The notebook lives in PrintLettersHome (a session with a saved copy and a
// draft); every change goes up through onChange(updater).
export default function ConstructorView({ notebook, onChange, byId, families, dirty, onSave, onBack }) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const canvasRef = useRef(null);

  const pages = notebook.pages;
  const format = notebook.format ?? "a4";
  const setPages = (updater) => onChange((nb) => ({ ...nb, pages: typeof updater === "function" ? updater(nb.pages) : updater }));
  const setFormat = (f) => onChange((nb) => ({ ...nb, format: f }));
  const setTitle = (title) => onChange((nb) => ({ ...nb, title }));

  const [activePageId, setActivePageId] = useState(() => pages[0]?.id ?? null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const zoom = useFitZoom(canvasRef, sheetSizeMm(format).w);

  const found = pages.findIndex((p) => p.id === activePageId);
  const activePageIndex = found >= 0 ? found : 0;
  const activePage = pages[activePageIndex] ?? null;
  const activeId = activePage?.id ?? null;
  const selectedBlock = activePage?.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const selectedLetter = selectedBlock ? byId[selectedBlock.letterId] : null;
  const selectedRowIndex = selectedBlock ? selectedBlock.rows.findIndex((r) => r.id === selectedRowId) : -1;
  const selectedRow = selectedRowIndex >= 0 ? selectedBlock.rows[selectedRowIndex] : null;

  function updateActivePage(fn) {
    setPages((prev) => prev.map((p) => (p.id === activeId ? fn(p) : p)));
  }
  function updateSelectedBlock(fn) {
    if (!selectedBlockId) return;
    updateActivePage((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === selectedBlockId ? fn(b) : b)) }));
  }
  function updateSelectedRow(fn) {
    if (!selectedRowId) return;
    updateSelectedBlock((b) => ({ ...b, rows: b.rows.map((r) => (r.id === selectedRowId ? fn(r) : r)) }));
  }
  function clearSelection() {
    setSelectedBlockId(null);
    setSelectedRowId(null);
  }

  // ---- pages
  function switchPage(pageId) {
    setActivePageId(pageId);
    clearSelection();
  }
  function addPage() {
    const page = blankPage(activePage ? paperOf(activePage) : "cell");
    setPages((prev) => [...prev, page]);
    switchPage(page.id);
  }
  function duplicateActivePage() {
    if (!activePage) return;
    const copy = { ...activePage, id: newId(), blocks: activePage.blocks.map((b) => ({ ...b, id: newId(), rows: b.rows.map((r) => ({ ...r, id: newId() })) })) };
    setPages((prev) => {
      const next = [...prev];
      next.splice(activePageIndex + 1, 0, copy);
      return next;
    });
    switchPage(copy.id);
  }
  function moveActivePage(dir) {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === activeId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function removeActivePage() {
    if (!activePage) return;
    const next = pages.filter((p) => p.id !== activeId);
    const result = next.length > 0 ? next : [blankPage()];
    setPages(result);
    switchPage(result[Math.min(activePageIndex, result.length - 1)].id);
  }

  // ---- blocks and rows
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
    const id = newId();
    const rows = withIds(ladderRows(letter));
    updateActivePage((p) => ({ ...p, blocks: [...p.blocks, { id, letterId, color: PALETTE[p.blocks.length % PALETTE.length], size: 2, rows }] }));
    setSelectedBlockId(id);
    setSelectedRowId(rows[0].id);
  }
  function removeSelectedBlock() {
    if (!selectedBlockId) return;
    updateActivePage((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== selectedBlockId) }));
    clearSelection();
  }
  function addRow() {
    if (!selectedBlock || !selectedLetter) return;
    const row = { id: newId(), elements: allElements(selectedLetter), support: "dotted" };
    const at = selectedRowIndex >= 0 ? selectedRowIndex + 1 : selectedBlock.rows.length;
    updateSelectedBlock((b) => ({ ...b, rows: [...b.rows.slice(0, at), row, ...b.rows.slice(at)] }));
    setSelectedRowId(row.id);
  }
  function removeSelectedRow() {
    if (!selectedRow) return;
    const rows = selectedBlock.rows;
    const neighbour = rows[selectedRowIndex + 1] ?? rows[selectedRowIndex - 1] ?? null;
    updateSelectedBlock((b) => ({ ...b, rows: b.rows.filter((r) => r.id !== selectedRowId) }));
    setSelectedRowId(neighbour?.id ?? null);
  }
  function moveSelectedRow(dir) {
    const i = selectedRowIndex;
    const j = i + dir;
    if (i < 0) return;
    updateSelectedBlock((b) => {
      if (j < 0 || j >= b.rows.length) return b;
      const rows = [...b.rows];
      [rows[i], rows[j]] = [rows[j], rows[i]];
      return { ...b, rows };
    });
  }
  function applyLadder() {
    if (!selectedLetter) return;
    const rows = withIds(ladderRows(selectedLetter));
    updateSelectedBlock((b) => ({ ...b, rows }));
    setSelectedRowId(rows[0].id);
  }

  const hasContent = pages.some((p) => p.blocks.length > 0);
  const overflow = activePage ? pageOverflows(activePage, format) : false;

  const inspector = (peek) => (
    <RowInspector
      letter={selectedLetter}
      color={selectedBlock?.color}
      row={selectedRow}
      rowIndex={selectedRowIndex}
      rowCount={selectedBlock?.rows.length ?? 0}
      onSetElements={(elements) => updateSelectedRow((r) => ({ ...r, elements }))}
      onSetSupport={(support) => updateSelectedRow((r) => ({ ...r, support }))}
      onMoveRow={moveSelectedRow}
      onLadder={applyLadder}
      size={selectedBlock?.size === 4 ? 4 : 2}
      onSetSize={(size) => updateSelectedBlock((b) => ({ ...b, size }))}
      peek={peek}
    />
  );

  return (
    <div className={`pl-constructor${narrow ? " is-narrow" : ""}`}>
      <div className="pl-header no-print">
        <button type="button" className="pl-header-back" onClick={onBack} aria-label="Назад, к моим тетрадям"><IconBack /></button>
        <label className="pl-title-field">
          <span className="pl-sr">Название тетради</span>
          <input className="pl-title-input" value={notebook.title} onChange={(e) => setTitle(e.target.value)} placeholder="Без названия" />
        </label>
        <span className="pl-header-fill" />
        {dirty && <span className="pl-dirty" role="status">● Не сохранено</span>}
        <button type="button" className="pl-save" onClick={onSave} disabled={!dirty} aria-label="Сохранить тетрадь">
          <IconSave /><span>{dirty ? "Сохранить" : "Сохранено"}</span>
        </button>
      </div>

      <div className="pl-toolbar no-print" role="toolbar" aria-label="Инструменты">
        <div className="pl-tool-group" role="group" aria-label="Лист">
          <OptionPicker label="Формат" caption="Формат" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
          <OptionPicker label="Бумага" options={PAPER_OPTIONS} value={activePage ? paperOf(activePage) : "cell"} onChange={(paper) => updateActivePage((p) => ({ ...p, paper }))} />
        </div>
        <span className="pl-sep" aria-hidden="true" />
        <div className="pl-tool-group" role="group" aria-label="Буква">
          <LetterPickerButton families={families} onPick={addBlock} />
          <button type="button" className="pl-tool pl-tool--danger" disabled={!selectedBlockId} onClick={removeSelectedBlock}>
            <span className="pl-tool-ico"><IconTrash /></span>
            <span className="pl-tool-cap">Удалить блок</span>
          </button>
        </div>
        <span className="pl-sep" aria-hidden="true" />
        <div className="pl-tool-group" role="group" aria-label="Строка">
          <button type="button" className="pl-tool" disabled={!selectedBlockId} onClick={addRow}>
            <span className="pl-tool-ico"><IconAddRow /></span>
            <span className="pl-tool-cap">Строка</span>
          </button>
          <button type="button" className="pl-tool pl-tool--danger" disabled={!selectedRow} onClick={removeSelectedRow}>
            <span className="pl-tool-ico"><IconTrash /></span>
            <span className="pl-tool-cap">Удалить строку</span>
          </button>
        </div>
        <span className="pl-toolbar-fill" />
        {hasContent && (
          <button type="button" className="pl-tool" onClick={() => window.print()}>
            <span className="pl-tool-ico"><IconPrint /></span>
            <span className="pl-tool-cap">Печать</span>
          </button>
        )}
      </div>

      <div className="pl-body no-print">
        <div className="pl-pages-rail">
          <div className="pl-pages-list">
            {pages.map((p, i) => (
              <PageThumb key={p.id} page={p} format={format} byId={byId} active={p.id === activeId} index={i} compact={narrow} onSelect={() => switchPage(p.id)} />
            ))}
          </div>
          <button type="button" className="pl-page-add" onClick={addPage} aria-label="Добавить страницу">
            <IconPlus /> {!narrow && "Страница"}
          </button>
          <div className="pl-page-actions">
            <button type="button" onClick={duplicateActivePage} aria-label="Дублировать страницу" title="Дублировать"><IconDuplicate /></button>
            <button type="button" onClick={() => moveActivePage(-1)} disabled={activePageIndex <= 0} aria-label="Страница выше" title="Выше"><IconUp /></button>
            <button type="button" onClick={() => moveActivePage(1)} disabled={activePageIndex >= pages.length - 1} aria-label="Страница ниже" title="Ниже"><IconDown /></button>
            <button type="button" onClick={removeActivePage} aria-label="Удалить страницу" title="Удалить" className="pl-page-actions-danger"><IconTrash /></button>
          </div>
        </div>

        <div className={`pl-canvas${narrow && selectedBlock ? " has-bsheet" : ""}`} ref={canvasRef} onClick={clearSelection}>
          {!hasContent && (
            <div className="pl-preview-empty">Нажмите «Буква» — появится блок. Нажмите на строку, чтобы выбрать её элементы и опору.</div>
          )}
          {overflow && (
            <div className="pl-overflow" role="status">Лист переполнен — нижние строки не поместятся при печати. Уберите строку или перенесите блок на новую страницу.</div>
          )}
          {activePage && (
            <Sheet
              page={activePage}
              format={format}
              byId={byId}
              className="pl-sheet--screen"
              style={zoom < 1 ? { zoom } : undefined}
              selectedBlockId={selectedBlockId}
              selectedRowId={selectedRowId}
              onSelectBlock={selectBlock}
              onSelectRow={selectRow}
            />
          )}
        </div>

        {!narrow && <aside className="pl-inspector" aria-label="Настройки строки" onClick={(e) => e.stopPropagation()}>{inspector(false)}</aside>}
      </div>

      {narrow && selectedBlock && (
        <BottomSheet expanded={sheetExpanded} onExpandedChange={setSheetExpanded}>
          {inspector(!sheetExpanded)}
        </BottomSheet>
      )}

      <PrintPages notebook={notebook} byId={byId} />
    </div>
  );
}
