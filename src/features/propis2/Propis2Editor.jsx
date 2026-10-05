import { useEffect, useMemo, useRef, useState } from "react";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { rowAtSvgY } from "@/topics/renderers/propis/PrintPageView";
import { GRIDS, GRID_KINDS, PAGE_FORMATS, MARGINS, multipliesByDefault, pageAspect, pageFormat, rowsPerPage, RULINGS, pageMargin, rowParams, analyzePage, clearPage, duplicateRow, isLocked, lineOwners, moveRow, newRow, pageGridKind, selectRowAt } from "@/topics/renderers/propis2/model.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { buildTiles } from "./Propis2Carousel";
import Propis2Field from "./Propis2Field";
import { useKeyboardInset } from "./useKeyboardInset";
import { fieldFromRows, insertLine, rowIdAtCaret, rowsFromField } from "@/topics/renderers/propis2/fieldText.js";
import Propis2Preview from "./Propis2Preview";
import * as I from "./Propis2Icons";
import Propis2Picker from "./Propis2Picker";
import Propis2Presets from "./Propis2Presets";
import { useHint } from "./Propis2Hint";

// The page constructor. The page canvas, with settings above it and the tools below it (tabs «Символ», «Слово», «Текст»).
// No dragging: select a row (tap it on the page) and tap a symbol, it goes into that row; with no row selected a tapped
// symbol starts a new row. The selected row's bar edits its text, kind of row, repeat, order. The page is saved by the
// parent on every change; nothing is ever dropped silently.
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
const FORMAT_ICONS = { a5: I.IconFormatA5, a4: I.IconFormatA4 };
const MARGIN_ICONS = { off: I.IconMarginOff, left: I.IconMarginLeft, right: I.IconMarginRight };
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


// A round/square icon button: 44px target, pressed state, the name only as aria-label.
function IconBtn({ label, on, onClick, disabled, children, className = "", ...rest }) {
  const { bind, tip } = useHint(label);
  return (
    <button type="button" className={`p2-ib${on ? " is-on" : ""} ${className}`} aria-label={label} aria-pressed={on === undefined ? undefined : Boolean(on)} disabled={disabled} onClick={onClick} {...bind} {...rest}>
      {children}
      {tip}
    </button>
  );
}

export default function Propis2Editor({ page, topicRecord, onChange, onBack, onShow, presets, onApplyPreset, onSavePreset, onDeletePreset }) {
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const analysis = useMemo(() => analyzePage(page, glyphMap), [page, glyphMap]);
  const owners = useMemo(() => lineOwners(page, glyphMap), [page, glyphMap]);
  const [selectedId, setSelectedId] = useState(null);
  // the field shows the page's rows from `fieldStartId` to the end, one per line; no start = the place below the last row
  const [fieldStartId, setFieldStartId] = useState(null);
  const [draft, setDraft] = useState("");
  const [caretRequest, setCaretRequest] = useState(null);
  const [pageW, setPageW] = useState(0);
  const [undoPage, setUndoPage] = useState(null); // the page as it was before «Очистить страницу», for «Отменить»
  const locked = isLocked(page);
  const keyboard = useKeyboardInset();
  const elementTiles = useMemo(() => buildTiles(topicRecord).elements, [topicRecord]);
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
  const aspect = pageAspect(page);

  // The page's width: the canvas width, but not so wide that the page is more than MAX_OVERFLOW times taller
  // than the room for it. Recomputed when the canvas resizes (rotation, dock height, keyboard).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setPageW(Math.floor(phoneRef.current ? w - 8 : Math.min(w - 8, h * (sideRef.current ? 1 : MAX_OVERFLOW) * aspect)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [side, phone, aspect]);

  const selectedIndex = page.rows.findIndex((r) => r.id === selectedId);
  const selected = selectedIndex >= 0 ? page.rows[selectedIndex] : null;
  const selectedInfo = selectedIndex >= 0 ? analysis.rows[selectedIndex] : null;
  const rowEditable = !locked && Boolean(selected) && (selected.kind === "text" || selected.kind === "element");
  const rowOpts = (() => {
    if (!selected) return null;
    const p = rowParams(selected);
    // a row from a ready sheet follows the engine's own rule until a repeat is picked: show what it does
    return p.repeat === "auto" ? { ...p, repeat: multipliesByDefault(selected.text, glyphMap) ? "all" : "one" } : p;
  })();

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
    const local = rowAtSvgY(y, pageFormat(page));
    return local < 0 ? -1 : pageIndexRef.current * rowsPerPage(page) + local;
  };

  // Tap on the page: select the row under the finger; an empty place on the sheet gets a new, empty row (so any ruled
  // row can be tapped and filled); a tap outside the ruled rows clears the selection.
  const onPageClick = (e) => {
    const abs = rowAtPoint(e.clientX, e.clientY);
    if (abs < 0) { setSelectedId(null); setFieldStartId(null); return; }
    if (locked) {
      const owner = abs < owners.length ? owners[abs] : undefined;
      setSelectedId(owner != null ? page.rows[owner].id : null);
      return;
    }
    const result = selectRowAt(page, glyphMap, abs);
    if (result.page !== page) onChange(result.page);
    setSelectedId(result.rowId);
    setFieldStartId(result.rowId);
  };

  const clear = () => { setUndoPage(page); setSelectedId(null); setFieldStartId(null); onChange(clearPage(page)); };
  const undoClear = () => { if (undoPage) { onChange(undoPage); setUndoPage(null); } };

  // ---- the text field ----
  const startId = page.rows.some((r) => r.id === fieldStartId) ? fieldStartId : null;
  const fieldIndex = startId ? page.rows.findIndex((r) => r.id === startId) : -1;
  const rowsSig = page.rows.map((r) => `${r.id}|${r.kind}|${r.text}`).join("\n");
  const draftKey = `${rowsSig}#${startId ?? ""}#${locked ? selectedId ?? "" : ""}`;
  const [draftSynced, setDraftSynced] = useState(draftKey);
  // the draft is rebuilt from the page whenever the page or the starting row changed from outside the field
  if (draftSynced !== draftKey) {
    setDraftSynced(draftKey);
    setDraft(locked ? (selected ? String(selected.text ?? "") : "") : fieldFromRows(page.rows, fieldIndex < 0 ? page.rows.length : fieldIndex));
  }
  const onField = (value) => {
    if (locked) {
      if (!selected) return;
      setDraft(value);
      const next = { ...page, rows: page.rows.map((r) => (r.id === selected.id ? { ...r, text: value } : r)) };
      setDraftSynced(`${next.rows.map((r) => `${r.id}|${r.kind}|${r.text}`).join("\n")}#${startId ?? ""}#${selectedId ?? ""}`);
      onChange(next);
      return;
    }
    const { rows, firstId } = rowsFromField({ rows: page.rows, startId, value, glyphMap, page });
    if (rows === page.rows) { setDraft(value); return; }
    const nextStart = startId ?? firstId;
    setDraft(value);
    setFieldStartId(nextStart);
    setDraftSynced(`${rows.map((r) => `${r.id}|${r.kind}|${r.text}`).join("\n")}#${nextStart ?? ""}#`);
    onChange({ ...page, rows: rows.length ? rows : [newRow()] });
    if (!selectedId || !rows.some((r) => r.id === selectedId)) setSelectedId(nextStart);
  };
  const onCaret = (caret) => {
    if (locked) return;
    const id = rowIdAtCaret(page.rows, startId, draft, caret);
    if (id && id !== selectedId) setSelectedId(id);
  };
  const insertElement = (token, caret) => {
    if (locked) { if (selected) onField(token); return; }
    const { value, caret: pos } = insertLine(draft, caret, token);
    onField(value);
    setCaretRequest({ pos, n: Date.now() });
  };
  const setRowAsText = (asText) => {
    if (!selected) return;
    patchSelected({ asText, kind: asText ? "passage" : "text" });
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
    <div className={`screen propis2-home propis2-editor2${side ? " propis2-editor2--side" : ""}${phone ? " propis2-editor2--phone" : ""}${keyboard.open ? " propis2-editor2--kb" : ""}`} data-testid="propis2-editor" style={keyboard.open ? { "--p2-vvtop": `${keyboard.top}px`, "--p2-vvh": `${keyboard.height}px` } : undefined}>
      <div className="screen-header p2-header">
        <button className="back-btn" onClick={onBack} aria-label="Назад"><BackArrowIcon /></button>
        <input className="propis2-title-input" value={page.title} onChange={(e) => onChange({ ...page, title: e.target.value })} aria-label="Название страницы" />
        <button type="button" className="p2-show" onClick={onShow} aria-label="Показать ученику"><I.IconPlay /></button>
      </div>

      <div className="propis2-main">
        <div className="propis2-settings" role="group" aria-label="Настройки страницы">
          <Propis2Picker label="Формат" disabled={locked} value={pageFormat(page)} onChange={(id) => onChange({ ...page, format: id })} options={PAGE_FORMATS.map((f) => ({ id: f.id, label: f.label, Icon: FORMAT_ICONS[f.id] }))} />
          <Propis2Picker label="Тип бумаги" disabled={locked} value={gridKind} onChange={(id) => onChange({ ...page, gridKind: id })} options={GRID_KINDS.map((g) => ({ id: g.id, label: g.label, Icon: PAPER_ICONS[g.id] }))} />
          <Propis2Picker label="Разлиновка" disabled={locked} value={page.ruling} onChange={(id) => onChange({ ...page, ruling: id })} options={RULINGS.map((r) => ({ id: r.id, label: r.short ?? r.label, Icon: RULING_ICONS[r.id] }))} />
          <Propis2Picker label="Косая линейка" value={page.grid ?? "regular"} disabled={locked || !propisGrid} onChange={(id) => onChange({ ...page, grid: id })} options={GRIDS.map((g) => ({ id: g.id, label: g.short, Icon: SLANT_ICONS[g.id] }))} />
          <Propis2Picker label="Поля" disabled={locked} value={pageMargin(page)} onChange={(id) => onChange({ ...page, margin: id })} options={MARGINS.map((m) => ({ id: m.id, label: m.label, Icon: MARGIN_ICONS[m.id] }))} />
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
        </div>

        <div className="propis2-settings propis2-settings--row" role="group" aria-label="Настройки строки">
          <Propis2Picker label="Повтор" value={rowOpts?.repeat ?? "all"} disabled={!rowEditable} onChange={(id) => patchSelected({ repeat: id })} options={REPEAT_OPTS} />
          <Propis2Picker label="Красные точки" value={rowOpts?.dots ?? "all"} disabled={!rowEditable} onChange={(id) => patchSelected({ dots: id })} options={DOT_OPTS} />
          <IconBtn label="Копии пунктиром" on={rowEditable ? rowOpts.copies === "dash" : undefined} disabled={!rowEditable} onClick={() => patchSelected({ copies: rowOpts.copies === "dash" ? "solid" : "dash" })}><I.IconCopyDash /></IconBtn>
          <IconBtn label="Строка как текст (с переносом)" on={selected ? selected.kind === "passage" : undefined} disabled={locked || !selected || selected.kind === "blank"} onClick={() => setRowAsText(selected.kind !== "passage")}><I.IconTabText /></IconBtn>
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
          {(selectedInfo?.unsupported.length > 0 || selectedInfo?.outside?.length > 0 || selectedInfo?.overflow || analysis.problems > 0) && (
            <div className="p2-warns">
              {selectedInfo?.unsupported.length > 0 && (
                <div className="p2-warn" role="alert" aria-label={`Нет начертания: ${selectedInfo.unsupported.join(" ")}`}><I.IconWarn />{selectedInfo.unsupported.map((c) => <b key={c}>{c}</b>)}</div>
              )}
              {selectedInfo?.outside?.length > 0 && (
                <div className="p2-warn" role="alert" aria-label={`На широкой строке нельзя: ${selectedInfo.outside.join(" ")}`}><I.IconWarn /><I.IconRowWide />{selectedInfo.outside.map((c) => <b key={c}>{c}</b>)}</div>
              )}
              {selectedInfo?.overflow && (
                <div className="p2-warn" role="alert" aria-label="Строка не помещается по ширине"><I.IconWarn /><span className="p2-cut" aria-hidden="true" /></div>
              )}
              {analysis.problems > 0 && <div className="p2-warn p2-warn--summary" role="status" aria-label={`Строк с проблемами: ${analysis.problems}`}><I.IconWarn /><b>{analysis.problems}</b></div>}
            </div>
          )}
          <Propis2Field
            value={draft}
            onChange={onField}
            onCaret={onCaret}
            disabled={locked && !selected}
            singleLine={locked}
            placeholder={locked ? "Выберите строку на странице" : "Буква, слово или текст. Enter — новая строка"}
            elements={elementTiles}
            onInsertElement={insertElement}
            caretRequest={caretRequest}
          />
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
