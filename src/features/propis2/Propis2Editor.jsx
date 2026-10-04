import { useEffect, useMemo, useRef, useState } from "react";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { rowAtSvgY } from "@/topics/renderers/propis/PrintPageView";
import { PRINT_PAGE_H_MM, PRINT_PAGE_W_MM } from "@/topics/renderers/propis/propisRuling.js";
import { GRIDS, GRID_KINDS, ROWS_PER_PAGE, RULINGS, rowParams, analyzePage, appendTile, clearPage, duplicateRow, isLocked, lineOwners, moveRow, newRow, pageGridKind, replaceSymbol, selectRowAt, tapSymbol } from "@/topics/renderers/propis2/model.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import Propis2Carousel, { TileGlyph, buildTiles } from "./Propis2Carousel";
import Propis2Preview from "./Propis2Preview";
import * as I from "./Propis2Icons";
import Propis2Picker from "./Propis2Picker";
import Propis2Presets from "./Propis2Presets";

// The page constructor. The page canvas, with settings above it and the tools below it (tabs «Символ», «Слово», «Текст»).
// No dragging: select a row (tap it on the page) and tap a symbol, it goes into that row; with no row selected a tapped
// symbol starts a new row. The selected row's bar edits its text, kind of row, repeat, order. The page is saved by the
// parent on every change; nothing is ever dropped silently.
const PAGE_ASPECT = PRINT_PAGE_W_MM / PRINT_PAGE_H_MM;
const MAX_OVERFLOW = 1.2; // portrait tablet: the page may be this much taller than the room for it (a little scroll)

// Landscape tablet and wider: the page takes the whole height on the left, all tools sit in a side panel.
const SIDE_QUERY = "(min-width: 900px) and (min-aspect-ratio: 1/1)";
// Phone (narrow portrait): the page is as wide as the screen but only about half of it shows; the rest scrolls inside
// the canvas. Full toolsets above and below it.
const PHONE_QUERY = "(max-width: 640px)";
function useMedia(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, [query]);
  return on;
}

// What the constructor shows are pictograms; the name of each control is its aria-label only.
const PAPER_ICONS = { propis: I.IconPaperPropis, square: I.IconPaperSquare, ruled: I.IconPaperRuled };
const RULING_ICONS = { narrow: I.IconRowNarrow, wide: I.IconRowWide };
const SLANT_ICONS = { regular: I.IconSlantSparse, dense: I.IconSlantDense };
const REPEAT_OPTS = [
  { id: "one", label: "Одна запись", Icon: I.IconRepOne },
  { id: "all", label: "Повтор на всю строку", Icon: I.IconRepAll },
  { id: "fade", label: "Повтор с затуханием", Icon: I.IconRepFade },
];
const DOT_OPTS = [
  { id: "none", label: "Без красных точек", Icon: I.IconDotsNone },
  { id: "one", label: "Красная точка у образца", Icon: I.IconDotsOne },
  { id: "all", label: "Красные точки у образца и копий", Icon: I.IconDotsAll },
];

const TABS = [
  { id: "symbol", label: "Символ", Icon: null },
  { id: "word", label: "Слово", Icon: I.IconTabWord },
  { id: "text", label: "Текст", Icon: I.IconTabText },
];

// A round/square icon button: 44px target, pressed state, the name only as aria-label.
function IconBtn({ label, on, onClick, disabled, children, className = "", ...rest }) {
  return (
    <button type="button" className={`p2-ib${on ? " is-on" : ""} ${className}`} aria-label={label} aria-pressed={on === undefined ? undefined : Boolean(on)} disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

export default function Propis2Editor({ page, topicRecord, onChange, onBack, onShow, onFromMarked, presets, onApplyPreset, onSavePreset, onDeletePreset }) {
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const analysis = useMemo(() => analyzePage(page, glyphMap), [page, glyphMap]);
  const owners = useMemo(() => lineOwners(page, glyphMap), [page, glyphMap]);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("symbol");
  const [draftWord, setDraftWord] = useState("");
  const [draftText, setDraftText] = useState("");
  const [pageW, setPageW] = useState(0);
  const [undoPage, setUndoPage] = useState(null); // the page as it was before «Очистить страницу», for «Отменить»
  const locked = isLocked(page);
  const symbolIcon = useMemo(() => { const t = buildTiles(topicRecord).lower.find((x) => x.text === "а"); return t ? <TileGlyph tile={t} size={28} bare /> : "а"; }, [topicRecord]);
  const side = useMedia(SIDE_QUERY);
  const phone = useMedia(PHONE_QUERY) && !side;
  const sideRef = useRef(side);
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  sideRef.current = side;
  const wrapRef = useRef(null);
  const pageIndexRef = useRef(0);
  const gridKind = pageGridKind(page);
  const propisGrid = gridKind === "propis";

  // The page's width: the canvas width, but not so wide that the page is more than MAX_OVERFLOW times taller
  // than the room for it. Recomputed when the canvas resizes (rotation, dock height, keyboard).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setPageW(Math.floor(phoneRef.current ? w - 8 : Math.min(w - 8, h * (sideRef.current ? 1 : MAX_OVERFLOW) * PAGE_ASPECT)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [side, phone]);

  const selectedIndex = page.rows.findIndex((r) => r.id === selectedId);
  const selected = selectedIndex >= 0 ? page.rows[selectedIndex] : null;
  const selectedInfo = selectedIndex >= 0 ? analysis.rows[selectedIndex] : null;
  const rowEditable = !locked && Boolean(selected) && (selected.kind === "text" || selected.kind === "element");
  const rowOpts = selected ? rowParams(selected) : null;
  const markedCount = page.rows.filter((r) => r.marked).length;

  const setRows = (rows) => onChange({ ...page, rows: rows.length ? rows : [newRow()] });
  const patchSelected = (patch) => setRows(page.rows.map((r) => (r.id === selectedId ? { ...r, ...patch } : r)));

  // Which physical row (0-based over the whole page) is under a screen point; -1 if none.
  const rowAtPoint = (cx, cy) => {
    const svg = wrapRef.current?.querySelector("svg.propis-print-page-svg");
    if (!svg) return -1;
    const box = svg.getBoundingClientRect();
    if (cx < box.left || cx > box.right || cy < box.top || cy > box.bottom) return -1;
    let y;
    try {
      const m = svg.getScreenCTM?.();
      if (m && svg.createSVGPoint) { const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; y = pt.matrixTransform(m.inverse()).y; }
    } catch { y = undefined; }
    if (!Number.isFinite(y)) {
      const vbH = Number(String(svg.getAttribute("viewBox") ?? "").split(/\s+/)[3]) || box.height;
      y = ((cy - box.top) / (box.height || 1)) * vbH;
    }
    const local = rowAtSvgY(y);
    return local < 0 ? -1 : pageIndexRef.current * ROWS_PER_PAGE + local;
  };

  // Tap on the page: select the row under the finger; an empty place on the sheet gets a new, empty row (so any ruled
  // row can be tapped and filled); a tap outside the ruled rows clears the selection.
  const onPageClick = (e) => {
    const abs = rowAtPoint(e.clientX, e.clientY);
    if (abs < 0) { setSelectedId(null); return; }
    if (locked) {
      const owner = abs < owners.length ? owners[abs] : undefined;
      setSelectedId(owner != null ? page.rows[owner].id : null);
      return;
    }
    const result = selectRowAt(page, glyphMap, abs);
    if (result.page !== page) onChange(result.page);
    setSelectedId(result.rowId);
  };

  const applyResult = (result) => {
    onChange(result.page);
    setSelectedId(result.rowId);
  };
  const tapTile = (tile) => {
    if (locked) { if (selectedId) onChange(replaceSymbol(page, selectedId, tile)); return; }
    applyResult(tapSymbol(page, glyphMap, selectedId, tile));
  };
  const clear = () => { setUndoPage(page); setSelectedId(null); onChange(clearPage(page)); };
  const undoClear = () => { if (undoPage) { onChange(undoPage); setUndoPage(null); } };

  const addRow = (patch) => {
    const row = newRow(patch);
    setRows([...page.rows.filter((r) => r.kind === "blank" || String(r.text ?? "").trim()), row]);
    setSelectedId(row.id);
  };
  const addTyped = (kind, text, setText) => {
    const value = text.trim();
    if (!value) return;
    applyResult(appendTile(page, glyphMap, { kind, text: value }));
    setText("");
  };

  // Overlays on the page: the selected row (blue), problems (red).
  const overlays = useMemo(() => {
    const out = [];
    owners.forEach((o, abs) => {
      if (o == null) return;
      const info = analysis.rows[o];
      if (info && (info.unsupported.length || info.outside?.length || info.overflow)) out.push({ row: abs, tone: "warn" });
      if (page.rows[o]?.id === selectedId) out.push({ row: abs, tone: "select" });
    });
    return out;
  }, [owners, analysis, page.rows, selectedId]);

  useEffect(() => {
    if (!undoPage) return undefined;
    const t = setTimeout(() => setUndoPage(null), 8000);
    return () => clearTimeout(t);
  }, [undoPage]);
  useEffect(() => { if (selectedId && selectedIndex < 0) setSelectedId(null); }, [selectedId, selectedIndex]);

  return (
    <div className={`screen propis2-home propis2-editor2${side ? " propis2-editor2--side" : ""}${phone ? " propis2-editor2--phone" : ""}`} data-testid="propis2-editor">
      <div className="screen-header p2-header">
        <button className="back-btn" onClick={onBack} aria-label="Назад"><BackArrowIcon /></button>
        <input className="propis2-title-input" value={page.title} onChange={(e) => onChange({ ...page, title: e.target.value })} aria-label="Название страницы" />
        <button type="button" className="p2-show" onClick={onShow} aria-label="Показать ученику"><I.IconPlay /></button>
      </div>

      <div className="propis2-main">
        <div className="propis2-settings" role="group" aria-label="Настройки страницы">
          <Propis2Picker label="Тип бумаги" disabled={locked} value={gridKind} onChange={(id) => onChange({ ...page, gridKind: id })} options={GRID_KINDS.map((g) => ({ id: g.id, label: g.label, Icon: PAPER_ICONS[g.id] }))} />
          <Propis2Picker label="Разлиновка" disabled={locked} value={page.ruling} onChange={(id) => onChange({ ...page, ruling: id })} options={RULINGS.map((r) => ({ id: r.id, label: r.short ?? r.label, Icon: RULING_ICONS[r.id] }))} />
          <Propis2Picker label="Косая линейка" value={page.grid ?? "regular"} disabled={locked || !propisGrid} onChange={(id) => onChange({ ...page, grid: id })} options={GRIDS.map((g) => ({ id: g.id, label: g.short, Icon: SLANT_ICONS[g.id] }))} />
          <IconBtn label="Пунктир в серединных линиях" on={page.midDash !== false} disabled={locked || !propisGrid} onClick={() => onChange({ ...page, midDash: page.midDash === false })} data-kind="dash"><I.IconDash /></IconBtn>
          <IconBtn label="Строка для письма после каждой строки" on={Boolean(page.writeAfter)} disabled={locked} onClick={() => onChange({ ...page, writeAfter: !page.writeAfter })} data-kind="writeafter"><I.IconWriteAfter /></IconBtn>
          <span className="p2-grow" />
          {locked && (
            <>
              <span className="p2-lock" role="img" aria-label="Страница из пресета: раскладка закрыта, меняются только символы и слова"><I.IconLock /></span>
              <IconBtn label="Очистить страницу" className="p2-ib--danger" onClick={clear}><I.IconClearPage /></IconBtn>
            </>
          )}
          <Propis2Presets
            builtin={presets?.builtin ?? []}
            mine={presets?.mine ?? []}
            defaultName={page.title}
            canSave={page.rows.some((r) => r.kind === "blank" || String(r.text ?? "").trim())}
            onApply={(ps) => onApplyPreset?.(ps)}
            onSave={(name) => onSavePreset?.(name)}
            onDeleteMine={(id) => onDeletePreset?.(id)}
          />
          <IconBtn label="Из отмеченного" onClick={onFromMarked} disabled={markedCount === 0} className="p2-ib--plain">
            <I.IconFromMarked />
            {markedCount > 0 && <span className="p2-badge">{markedCount}</span>}
          </IconBtn>
        </div>

        <div className="propis2-settings propis2-settings--row" role="group" aria-label="Настройки строки">
          <Propis2Picker label="Повтор" value={rowOpts?.repeat ?? "all"} disabled={!rowEditable} onChange={(id) => patchSelected({ repeat: id })} options={REPEAT_OPTS} />
          <Propis2Picker label="Красные точки" value={rowOpts?.dots ?? "all"} disabled={!rowEditable} onChange={(id) => patchSelected({ dots: id })} options={DOT_OPTS} />
          <IconBtn label="Копии пунктиром" on={rowEditable ? rowOpts.copies === "dash" : undefined} disabled={!rowEditable} onClick={() => patchSelected({ copies: rowOpts.copies === "dash" ? "solid" : "dash" })}><I.IconCopyDash /></IconBtn>
          <IconBtn label="Повторить строку" on={selected ? Boolean(selected.marked) : undefined} disabled={!selected} onClick={() => patchSelected({ marked: !selected.marked })}><I.IconRepeat /></IconBtn>
          <span className="p2-grow" />
          <div className="p2-seg" role="group" aria-label="Строка">
            <IconBtn label="Выше" onClick={() => setRows(moveRow(page.rows, selectedIndex, -1))} disabled={!selected || selectedIndex === 0}><I.IconUp /></IconBtn>
            <IconBtn label="Ниже" onClick={() => setRows(moveRow(page.rows, selectedIndex, 1))} disabled={!selected || selectedIndex === page.rows.length - 1}><I.IconDown /></IconBtn>
            <IconBtn label="Дублировать" disabled={!selected} onClick={() => { const next = duplicateRow(page.rows, selectedIndex); setRows(next); setSelectedId(next[selectedIndex + 1].id); }}><I.IconDuplicate /></IconBtn>
            <IconBtn label="Удалить строку" className="p2-ib--danger" disabled={!selected} onClick={() => { setRows(page.rows.filter((r) => r.id !== selectedId)); setSelectedId(null); }}><I.IconTrash /></IconBtn>
          </div>
        </div>

        <div className="propis2-page-col" ref={wrapRef} onClick={onPageClick}>
          <div className="propis2-page-box" style={pageW ? { width: pageW } : undefined}>
            <Propis2Preview page={page} topicRecord={topicRecord} overlays={overlays} onPageIndexChange={(i) => { pageIndexRef.current = i; }} />
          </div>
        </div>

        <div className="propis2-dock">
          <div className="propis2-dock-bar">
            {selected ? (
              <div className="propis2-dock-row" data-testid="propis2-row-panel">
                <div className="p2-field">
                  {selected.kind === "blank" ? (
                    <span className="p2-blank" aria-label="Пустая строка — место для письма"><I.IconAddBlank /></span>
                  ) : selected.kind === "passage" ? (
                    <textarea value={selected.text} rows={1} onChange={(e) => patchSelected({ text: e.target.value })} aria-label="Текст строки" />
                  ) : (
                    <input value={selected.text} onChange={(e) => patchSelected({ text: e.target.value })} aria-label="Текст строки" />
                  )}
                  {selected.kind === "text" && (
                    <IconBtn label="Стереть последний символ" onClick={() => patchSelected({ text: Array.from(selected.text).slice(0, -1).join("") })} disabled={!selected.text}><I.IconBackspace /></IconBtn>
                  )}
                </div>
                {selectedInfo?.unsupported.length > 0 && (
                  <div className="p2-warn" role="alert" aria-label={`Нет начертания: ${selectedInfo.unsupported.join(" ")}`}><I.IconWarn />{selectedInfo.unsupported.map((c) => <b key={c}>{c}</b>)}</div>
                )}
                {selectedInfo?.outside?.length > 0 && (
                  <div className="p2-warn" role="alert" aria-label={`На широкой строке нельзя: ${selectedInfo.outside.join(" ")}`}><I.IconWarn /><I.IconRowWide />{selectedInfo.outside.map((c) => <b key={c}>{c}</b>)}</div>
                )}
                {selectedInfo?.overflow && (
                  <div className="p2-warn" role="alert" aria-label="Строка не помещается по ширине"><I.IconWarn /><span className="p2-cut" aria-hidden="true" /></div>
                )}
              </div>
            ) : (
              <div className="p2-hint" aria-label="Нажмите на строку, затем на символ"><I.IconTapHint /></div>
            )}
            {analysis.problems > 0 && <div className="p2-warn p2-warn--summary" role="status" aria-label={`Строк с проблемами: ${analysis.problems}`}><I.IconWarn /><b>{analysis.problems}</b></div>}
          </div>

          <div className="propis2-tabs" role="tablist" aria-label="Что поставить на страницу">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-label={t.label} aria-selected={tab === t.id} className={`propis2-tab${tab === t.id ? " is-on" : ""}`} onClick={() => setTab(t.id)}>
                {t.id === "symbol" ? <span className="p2-tab-glyph" aria-hidden="true">{symbolIcon}</span> : <t.Icon />}
              </button>
            ))}
          </div>

          <div className="propis2-dock-body">
            {tab === "symbol" && <Propis2Carousel topicRecord={topicRecord} onTap={tapTile} ruling={page.ruling} />}

            {tab === "word" && (
              <div className="propis2-typed" data-testid="propis2-tab-word">
                <input value={draftWord} onChange={(e) => setDraftWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTyped("text", draftWord, setDraftWord); }} aria-label="Слово или слог" />
                <IconBtn label="+ Строка" onClick={() => addTyped("text", draftWord, setDraftWord)} disabled={locked || !draftWord.trim()} className="p2-ib--primary"><I.IconAddRow /></IconBtn>
                <IconBtn label="+ Пустая строка" disabled={locked} onClick={() => addRow({ kind: "blank" })}><I.IconAddBlank /></IconBtn>
              </div>
            )}

            {tab === "text" && (
              <div className="propis2-typed" data-testid="propis2-tab-text">
                <textarea value={draftText} rows={2} onChange={(e) => setDraftText(e.target.value)} aria-label="Текст для страницы" />
                <IconBtn label="+ Текст" onClick={() => addTyped("passage", draftText, setDraftText)} disabled={locked || !draftText.trim()} className="p2-ib--primary"><I.IconAddText /></IconBtn>
              </div>
            )}
          </div>
        </div>
      </div>
      {undoPage && (
        <div className="p2-undo" role="status">
          <span>Страница очищена</span>
          <button type="button" aria-label="Отменить очистку" onClick={undoClear}><I.IconUndo /></button>
        </div>
      )}
    </div>
  );
}
