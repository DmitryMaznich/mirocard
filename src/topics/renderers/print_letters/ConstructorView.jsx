import { useState, useRef } from "react";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import BlockPickerButton from "./BlockPickerButton";
import OptionPicker from "./OptionPicker";
import Sheet from "./Sheet";
import RowInspector from "./RowInspector";
import PrintPages from "./PrintPages";
import { NARROW_QUERY, useFitZoom, useMediaQuery } from "./hooks";
import { FORMATS, DEFAULT_STYLE, describeStyle, withStyle, paperOf, allElements, ladderRows, pageOverflows, sheetSizeMm } from "./model";
import { PALETTE, blankPage, newId } from "./library";
import { WORD_STYLE, allLetterIdx, isWordBlock, wordLadderRows } from "./words";
import {
  IconTrash, IconPrint, IconDuplicate, IconP2Save, IconUndo, IconRedo, IconAddPage, IconFitWidth, IconChevronUp, IconChevronDown,
  IconPaperSquare, IconPaperBigCell, IconPaperLine, IconFormatA4, IconFormatA5,
} from "./icons";

const PAPER_OPTIONS = [
  { id: "bigcell", label: "Крупная клетка", Icon: IconPaperBigCell },
  { id: "cell", label: "Клетка", Icon: IconPaperSquare },
  { id: "line", label: "Линейка", Icon: IconPaperLine },
];
const FORMAT_OPTIONS = [
  { id: "a4", label: FORMATS.a4.label, Icon: IconFormatA4 },
  { id: "a5", label: FORMATS.a5.label, Icon: IconFormatA5 },
];
const PX_PER_MM = 96 / 25.4;
const THUMB_W = 124; // px — the sheet in the page rail (propis2's p2-thumbs column)
const ZOOM_STEP = 0.25;
const ZOOM_MAX = 3;

const DOCK_KEY = "print_letters:dock-open";

const withIds = (rows) => rows.map((r) => ({ id: newId(), ...r }));

// A strip tool: propis2's IconBtn with a caption (p2-ib p2-tool: the icon over its caption).
function Tool({ label, caption, onClick, disabled, danger = false, children }) {
  return (
    <button type="button" className={`pl2-ib pl2-tool${danger ? " pl2-ib--danger" : ""}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <span className="pl2-tool-ico">{children}</span>
      <span className="pl2-cap">{caption}</span>
    </button>
  );
}

// The editor of one notebook — propis2's own editor (Propis2Editor), its two layouts copied:
//  - computer: header (back · the notebook's name · save), one tool bar (undo/redo · the page ·
//    the row's tools on their blue tier · print · zoom), the pages as thumbnails on the left, the
//    sheet in the middle, a status bar at the bottom — plus this topic's own row panel on the right
//    (the elements of the selected row are picked on the letter itself);
//  - phone / narrow: header, the page strip, the row strip, the zoom pill, the sheet, and the row
//    panel docked at the bottom.
// The notebook lives in PrintLettersHome (a session: saved copy, draft, undo/redo); every change
// goes up through onChange(updater, { typing }).
export default function ConstructorView({ notebook, onChange, byId, families, dirty, onSave, onBack, onUndo, onRedo, canUndo, canRedo }) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const canvasRef = useRef(null);

  const pages = notebook.pages;
  const format = notebook.format ?? "a4";
  const setPages = (updater) => onChange((nb) => ({ ...nb, pages: typeof updater === "function" ? updater(nb.pages) : updater }));
  const setFormat = (f) => onChange((nb) => ({ ...nb, format: f }));
  const setTitle = (title) => onChange((nb) => ({ ...nb, title }), { typing: true });

  const [activePageId, setActivePageId] = useState(() => pages[0]?.id ?? null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [zoom, setZoom] = useState(1);
  // phone: the row panel folds down to one bar (owner, 2026-11-03); remembered on this device
  const [dockOpen, setDockOpen] = useState(() => {
    try { return window.localStorage.getItem(DOCK_KEY) !== "0"; } catch { return true; }
  });
  const toggleDock = () => setDockOpen((open) => {
    try { window.localStorage.setItem(DOCK_KEY, open ? "0" : "1"); } catch { /* private mode: just this session */ }
    return !open;
  });

  const sheet = sheetSizeMm(format);
  const fit = useFitZoom(canvasRef, sheet.w, narrow ? 0 : sheet.h);

  const found = pages.findIndex((p) => p.id === activePageId);
  const activePageIndex = found >= 0 ? found : 0;
  const activePage = pages[activePageIndex] ?? null;
  const activeId = activePage?.id ?? null;
  const paper = activePage ? paperOf(activePage) : "cell";
  const selectedBlock = activePage?.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const selectedWord = isWordBlock(selectedBlock) ? selectedBlock : null;
  const selectedLetter = selectedBlock && !selectedWord ? byId[selectedBlock.letterId] : null;
  const blockLabel = selectedWord ? selectedWord.words.join(" ") : selectedLetter?.label ?? "";
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
    const page = blankPage(paper);
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
  // a syllable / word block (words.js): its words, built by the ladder
  function addWordBlock(words) {
    if (!words.length || !activePage) return;
    const id = newId();
    const rows = withIds(wordLadderRows(words));
    updateActivePage((p) => ({ ...p, blocks: [...p.blocks, { id, kind: "word", words, color: PALETTE[p.blocks.length % PALETTE.length], size: 2, rows }] }));
    setSelectedBlockId(id);
    setSelectedRowId(rows[0].id);
  }
  function removeSelectedBlock() {
    if (!selectedBlockId) return;
    updateActivePage((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== selectedBlockId) }));
    clearSelection();
  }
  function addRow() {
    if (!selectedBlock || (!selectedLetter && !selectedWord)) return;
    let row;
    if (selectedWord) {
      const text = selectedRow?.text ?? selectedWord.words[0];
      row = { id: newId(), text, elements: allLetterIdx(text), ...WORD_STYLE };
    } else {
      row = { id: newId(), elements: allElements(selectedLetter), ...DEFAULT_STYLE };
    }
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
    if (!selectedLetter && !selectedWord) return;
    const rows = withIds(selectedWord ? wordLadderRows(selectedWord.words) : ladderRows(selectedLetter));
    updateSelectedBlock((b) => ({ ...b, rows }));
    setSelectedRowId(rows[0].id);
  }

  const hasContent = pages.some((p) => p.blocks.length > 0);
  const overflow = activePage ? pageOverflows(activePage, format) : false;
  const sheetZoom = fit * zoom;

  const inspector = (
    <RowInspector
      letter={selectedLetter}
      wordBlock={selectedWord}
      byId={byId}
      color={selectedBlock?.color}
      row={selectedRow}
      rowIndex={selectedRowIndex}
      rowCount={selectedBlock?.rows.length ?? 0}
      onSetElements={(elements) => updateSelectedRow((r) => ({ ...r, elements }))}
      onSetText={(text) => updateSelectedRow((r) => ({ ...r, text, elements: r.elements.length ? allLetterIdx(text) : [] }))}
      onSetStyle={(patch) => updateSelectedRow((r) => withStyle(r, patch))}
      onMoveRow={moveSelectedRow}
      onAddRow={addRow}
      onRemoveRow={removeSelectedRow}
      onLadder={applyLadder}
      size={selectedBlock?.size === 4 ? 4 : 2}
      paper={paper}
      onSetSize={(size) => updateSelectedBlock((b) => ({ ...b, size }))}
    />
  );

  // ---- the pieces, laid out per layout below (as Propis2Editor does)
  const headerEl = (
    <div className="screen-header pl2-header no-print">
      <button className="back-btn" onClick={onBack} aria-label="Назад"><BackArrowIcon /></button>
      <input className="plb-title-input" value={notebook.title} onChange={(e) => setTitle(e.target.value)} placeholder="Без названия" aria-label="Название тетради" />
      {narrow && <>
        <button type="button" className="pl2-hist" onClick={onUndo} disabled={!canUndo} aria-label="Отменить" title="Отменить"><IconUndo /></button>
        <button type="button" className="pl2-hist" onClick={onRedo} disabled={!canRedo} aria-label="Вернуть" title="Вернуть"><IconRedo /></button>
      </>}
      <button type="button" className="pl2-save" onClick={onSave} disabled={!dirty} aria-label="Сохранить тетрадь" title={dirty ? "Сохранить тетрадь" : "Нет несохранённых изменений"}><IconP2Save /></button>
    </div>
  );
  const pageEls = <>
    <OptionPicker label="Формат" caption="Формат" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
    <OptionPicker label="Бумага" caption="Бумага" options={PAPER_OPTIONS} value={paper} onChange={(p) => updateActivePage((pg) => ({ ...pg, paper: p }))} />
  </>;
  // the top bar holds only the block: add one (the letter picker) and delete the selected one;
  // everything about a row lives in the row panel (RowInspector)
  const blockEls = <>
    <BlockPickerButton families={families} byId={byId} onPickLetter={addBlock} onPickWords={addWordBlock} />
    <Tool label="Удалить блок буквы" caption="Удалить блок" danger disabled={!selectedBlockId} onClick={removeSelectedBlock}><IconTrash /></Tool>
  </>;
  const printEl = <Tool label="Печать тетради" caption="Печать" disabled={!hasContent} onClick={() => window.print()}><IconPrint /></Tool>;
  const historyEls = <>
    <Tool label="Отменить (Ctrl+Z)" caption="Отменить" onClick={onUndo} disabled={!canUndo}><IconUndo /></Tool>
    <Tool label="Вернуть (Ctrl+Y)" caption="Вернуть" onClick={onRedo} disabled={!canRedo}><IconRedo /></Tool>
  </>;
  const zoomEl = (
    <div className="pl2-zoom no-print" role="group" aria-label="Масштаб страницы">
      <button type="button" className="pl2-zoom-btn" onClick={() => setZoom((z) => Math.max(1, z - ZOOM_STEP))} disabled={zoom <= 1.001} aria-label="Уменьшить" title="Уменьшить">−</button>
      <button type="button" className="pl2-zoom-btn pl2-zoom-pct" onClick={() => setZoom(1)} disabled={zoom <= 1.001} aria-label="Вписать страницу" title="Вписать страницу целиком">{Math.round(zoom * 100)}%</button>
      <button type="button" className="pl2-zoom-btn" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX - 0.001} aria-label="Увеличить" title="Увеличить">+</button>
      {!narrow && <button type="button" className={`pl2-zoom-btn pl2-zoom-width${zoom === 1 ? " is-on" : ""}`} onClick={() => setZoom(1)} aria-label="По ширине" title="Страница по ширине"><IconFitWidth /></button>}
    </div>
  );
  const canvasEl = (
    <div className={`plb-page-col no-print${zoom > 1.001 ? " is-zoomed" : ""}`} ref={canvasRef} onClick={clearSelection}>
      <div className="plb-page-box">
        {overflow && <div className="pl-overflow" role="status">Лист переполнен — нижние строки не поместятся при печати. Уберите строку или перенесите блок на новую страницу.</div>}
        {activePage && (
          <Sheet
            page={activePage}
            format={format}
            byId={byId}
            className="pl-sheet--screen"
            style={sheetZoom !== 1 ? { zoom: sheetZoom } : undefined}
            selectedBlockId={selectedBlockId}
            selectedRowId={selectedRowId}
            onSelectBlock={selectBlock}
            onSelectRow={selectRow}
          />
        )}
      </div>
    </div>
  );
  const rowNo = selectedRowIndex >= 0 ? selectedRowIndex + 1 : 0;
  const styleName = selectedRow ? describeStyle(selectedRow) : "";

  if (!narrow) {
    const scale = THUMB_W / (sheet.w * PX_PER_MM);
    return (
      <div className="screen plb-home plb-editor2 plb-editor2--desk pl-editor" data-testid="print-letters-editor">
        {headerEl}
        <div className="pl2-desk-bar no-print" role="toolbar" aria-label="Инструменты">
          {historyEls}
          <span className="pl2-sep" aria-hidden="true" />
          <div className="pl2-desk-group" role="group" aria-label="Настройки страницы">{pageEls}</div>
          <span className="pl2-sep" aria-hidden="true" />
          <div className="pl2-desk-group pl2-desk-group--row" role="group" aria-label="Блок буквы">{blockEls}</div>
          <span className="pl2-sep" aria-hidden="true" />
          {printEl}
          <span className="pl2-desk-fill" />
          {zoomEl}
        </div>
        <div className="pl2-desk-body no-print">
          <div className="pl2-thumbs">
            <div className="pl2-thumbs-list">
              {pages.map((p, i) => (
                <button key={p.id} type="button" className={`pl2-thumb${p.id === activeId ? " is-current" : ""}`} onClick={() => switchPage(p.id)} aria-label={`Страница ${i + 1}`} aria-current={p.id === activeId ? "page" : undefined}>
                  <span className="pl2-thumb-no">{i + 1}</span>
                  <span className="pl2-thumb-sheet pl-thumb-sheet2" style={{ width: THUMB_W, aspectRatio: `${sheet.w} / ${sheet.h}` }}>
                    <span className="pl-thumb-scale" style={{ transform: `scale(${scale})` }}>
                      <Sheet page={p} format={format} byId={byId} className="pl-sheet--thumb" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="pl2-thumbs-foot">
              <button type="button" className="pl2-thumbs-add" onClick={addPage}><IconAddPage />Страница</button>
              <div className="pl2-thumbs-acts">
                <button type="button" onClick={duplicateActivePage} aria-label="Копия страницы" title="Копия страницы"><IconDuplicate /></button>
                <button type="button" onClick={() => moveActivePage(-1)} disabled={activePageIndex <= 0} aria-label="Страница раньше" title="Раньше">↑</button>
                <button type="button" onClick={() => moveActivePage(1)} disabled={activePageIndex >= pages.length - 1} aria-label="Страница позже" title="Позже">↓</button>
                <button type="button" className="is-danger" onClick={removeActivePage} aria-label="Удалить страницу" title="Удалить страницу"><IconTrash /></button>
              </div>
            </div>
          </div>
          <div className="pl2-desk-canvas">{canvasEl}</div>
          <aside className="pl-inspector" aria-label="Настройки строки">{inspector}</aside>
        </div>
        <div className="pl2-status no-print" role="status">
          <span>Стр. <b>{activePageIndex + 1}</b> из {pages.length}</span>
          {rowNo > 0 && <span>Строка <b>{rowNo}</b>{styleName ? ` · ${styleName}` : ""}</span>}
          <span className="pl2-status-hint">{hasContent ? "Щёлкните по строке листа — справа её элементы и опора" : "«Блок» — буква, слог или слово: блок сразу собран лесенкой"}</span>
        </div>
        <PrintPages notebook={notebook} byId={byId} />
      </div>
    );
  }

  return (
    <div className="screen plb-home plb-editor2 plb-editor2--phone pl-editor" data-testid="print-letters-editor">
      {headerEl}
      <div className="plb-main no-print">
        <div className="plb-settings" role="group" aria-label="Блок и страница">
          <div className="pl2-blockgrp" role="group" aria-label="Блок буквы">{blockEls}</div>
          <span className="pl2-sep" aria-hidden="true" />
          {pages.length > 1 && (
            <>
              <button type="button" className="pl2-ib pl2-tool" aria-label="Предыдущая страница" disabled={activePageIndex <= 0} onClick={() => switchPage(pages[activePageIndex - 1].id)}><span className="pl2-tool-ico pl2-glyph">‹</span><span className="pl2-cap">Назад</span></button>
              <span className="pl2-pager-pos" aria-live="polite">Стр. {activePageIndex + 1} из {pages.length}</span>
              <button type="button" className="pl2-ib pl2-tool" aria-label="Следующая страница" disabled={activePageIndex >= pages.length - 1} onClick={() => switchPage(pages[activePageIndex + 1].id)}><span className="pl2-tool-ico pl2-glyph">›</span><span className="pl2-cap">Вперёд</span></button>
              <span className="pl2-sep" aria-hidden="true" />
            </>
          )}
          {pageEls}
          <span className="pl2-sep" aria-hidden="true" />
          <Tool label="Добавить страницу" caption="Добавить" onClick={addPage}><IconAddPage /></Tool>
          <Tool label="Копия страницы" caption="Копия" onClick={duplicateActivePage}><IconDuplicate /></Tool>
          <Tool label={pages.length > 1 ? "Удалить страницу" : "Очистить страницу"} caption="Удалить" danger onClick={removeActivePage}><IconTrash /></Tool>
          {printEl}
        </div>
        {zoomEl}
        {canvasEl}
        <div className={`plb-dock pl-dock${dockOpen ? "" : " is-folded"}`}>
          <button type="button" className="pl-dock-toggle" onClick={toggleDock} aria-expanded={dockOpen} aria-label={dockOpen ? "Свернуть настройки строки" : "Показать настройки строки"}>
            <span className="pl-dock-sum">{dockOpen ? null : <>
              {selectedBlock && <span className="pl-dock-tile" style={{ "--pl-block-color": selectedBlock.color }}>{blockLabel}</span>}
              <span className="pl-dock-text">{rowNo > 0 ? <>Строка <b>{rowNo}</b> из {selectedBlock.rows.length}{styleName ? ` · ${styleName}` : ""}</> : selectedBlock ? <>{selectedWord ? "Блок" : "Буква"} <b>{blockLabel}</b></> : "Настройки строки"}</span>
            </>}</span>
            <span className="pl-dock-chev" aria-hidden="true">{dockOpen ? <IconChevronDown /> : <IconChevronUp />}</span>
          </button>
          {dockOpen && <div className="pl-dock-body">{inspector}</div>}
        </div>
      </div>
      <PrintPages notebook={notebook} byId={byId} />
    </div>
  );
}
