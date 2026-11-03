import { useState, useMemo, useEffect, useRef } from "react";
import LetterPickerButton from "./LetterPickerButton";
import PageThumb from "./PageThumb";
import OptionPicker from "./OptionPicker";
import Sheet from "./Sheet";
import RowInspector from "./RowInspector";
import BottomSheet from "./BottomSheet";
import { FORMATS, PAGE_MARGIN_MM, paperOf, allElements, ladderRows, pageOverflows, sheetSizeMm } from "./model";
import {
  IconPlus, IconAddRow, IconTrash, IconPrint, IconClose, IconUp, IconDown, IconDuplicate,
  IconPaperSquare, IconPaperLine3, IconPaperLine2, IconFormatA4, IconFormatA5,
} from "./icons";

const PALETTE = ["#e8702a", "#2f8fd1", "#b5257a", "#3aa655", "#d1a62f", "#7a52c9"];
const PAPER_OPTIONS = [
  { id: "cell", label: "Клетка", Icon: IconPaperSquare },
  { id: "line3", label: "Линейка: 3 линии", Icon: IconPaperLine3 },
  { id: "line2", label: "Линейка: 2 линии", Icon: IconPaperLine2 },
];
const FORMAT_OPTIONS = [
  { id: "a4", label: FORMATS.a4.label, Icon: IconFormatA4 },
  { id: "a5", label: FORMATS.a5.label, Icon: IconFormatA5 },
];
const NARROW_QUERY = "(max-width: 760px)";
const PX_PER_MM = 96 / 25.4;
const CANVAS_PAD_PX = 32;

let uid = 1;
const nextId = () => uid++;
const withIds = (rows) => rows.map((r) => ({ id: nextId(), ...r }));

function blankPage() {
  return { id: nextId(), blocks: [], paper: "cell" };
}

function useMediaQuery(query) {
  const get = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [query]);
  return match;
}

// Shrinks the real-size sheet to the canvas width when the canvas is
// narrower than the paper (phones, small windows); never enlarges it.
function useFitZoom(ref, sheetWidthMm) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      const avail = el.clientWidth - CANVAS_PAD_PX;
      setZoom(Math.min(1, Math.max(0.2, avail / (sheetWidthMm * PX_PER_MM))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, sheetWidthMm]);
  return zoom;
}

// propis2's own editor model: a page rail with real thumbnails, one page on
// the canvas, a toolbar for page/block actions, and — this topic's own part —
// a row panel (right side on wide screens, bottom sheet on phones) where the
// selected row's elements are picked by tapping them on the letter itself,
// plus its support level and the block's «Лесенка». No back button here: the
// session header above already has one; "Завершить" means "task done".
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

  const narrow = useMediaQuery(NARROW_QUERY);
  const canvasRef = useRef(null);

  const [format, setFormat] = useState("a4");
  const [pages, setPages] = useState(() => [blankPage()]);
  const [activePageId, setActivePageId] = useState(() => pages[0]?.id ?? null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const sheetSize = sheetSizeMm(format);
  const zoom = useFitZoom(canvasRef, sheetSize.w);

  const activePageIndex = pages.findIndex((p) => p.id === activePageId);
  const activePage = pages[activePageIndex] ?? null;
  const selectedBlock = activePage?.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const selectedLetter = selectedBlock ? byId[selectedBlock.letterId] : null;
  const selectedRowIndex = selectedBlock ? selectedBlock.rows.findIndex((r) => r.id === selectedRowId) : -1;
  const selectedRow = selectedRowIndex >= 0 ? selectedBlock.rows[selectedRowIndex] : null;

  function updateActivePage(fn) {
    setPages((prev) => prev.map((p) => (p.id === activePageId ? fn(p) : p)));
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
    const page = blankPage();
    setPages((prev) => [...prev, page]);
    switchPage(page.id);
  }
  function duplicateActivePage() {
    if (!activePage) return;
    const copy = { ...activePage, id: nextId(), blocks: activePage.blocks.map((b) => ({ ...b, id: nextId(), rows: b.rows.map((r) => ({ ...r, id: nextId() })) })) };
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
    const next = pages.filter((p) => p.id !== activePageId);
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
    const id = nextId();
    const rows = withIds(ladderRows(letter));
    updateActivePage((p) => ({ ...p, blocks: [...p.blocks, { id, letterId, color: PALETTE[p.blocks.length % PALETTE.length], rows }] }));
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
    const row = { id: nextId(), elements: allElements(selectedLetter), support: "dotted" };
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
  const { w: paperW, h: paperH } = FORMATS[format];

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
      {/* The printer's paper size follows the notebook's format. */}
      <style>{`@media print { @page { size: ${paperW}mm ${paperH}mm; margin: ${PAGE_MARGIN_MM}mm; } }`}</style>

      <div className="pl-header no-print">
        <span className="pl-header-title">Печатные буквы</span>
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
        <button type="button" className="pl-tool pl-tool--muted" onClick={onAdvance}>
          <span className="pl-tool-ico"><IconClose /></span>
          <span className="pl-tool-cap">Завершить</span>
        </button>
      </div>

      <div className="pl-body no-print">
        <div className="pl-pages-rail">
          <div className="pl-pages-list">
            {pages.map((p, i) => (
              <PageThumb key={p.id} page={p} format={format} byId={byId} active={p.id === activePageId} index={i} compact={narrow} onSelect={() => switchPage(p.id)} />
            ))}
          </div>
          <button type="button" className="pl-page-add" onClick={addPage} aria-label="Добавить страницу">
            <IconPlus /> {!narrow && "Страница"}
          </button>
          <div className="pl-page-actions">
            <button type="button" onClick={duplicateActivePage} aria-label="Дублировать страницу" title="Дублировать"><IconDuplicate /></button>
            <button type="button" onClick={() => moveActivePage(-1)} disabled={activePageIndex <= 0} aria-label="Страница выше" title="Выше"><IconUp /></button>
            <button type="button" onClick={() => moveActivePage(1)} disabled={activePageIndex < 0 || activePageIndex >= pages.length - 1} aria-label="Страница ниже" title="Ниже"><IconDown /></button>
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

      {/* Print renders every page as its own physical sheet, not just the one being edited on screen. */}
      <div className="pl-print-pages">
        {pages.map((p) => (
          <Sheet key={p.id} page={p} format={format} byId={byId} className="pl-sheet--print" />
        ))}
      </div>
    </div>
  );
}
