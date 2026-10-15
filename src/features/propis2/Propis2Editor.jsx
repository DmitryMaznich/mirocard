import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { rowAtSvgY } from "@/topics/renderers/propis/PrintPageView";
import { GRIDS, GRID_KINDS, PAGE_FORMATS, MARGINS, multipliesByDefault, pageAspect, pageFormat, rowsPerPage, RULINGS, pageMargin, rowParams, analyzePage, clearPage, duplicateRow, isLocked, lineOwners, moveRow, newRow, pageGridKind, selectRowAt, taskGrid } from "@/topics/renderers/propis2/model.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { buildTiles } from "./Propis2Carousel";
import Propis2Field from "./Propis2Field";
import Propis2TextEditor from "./Propis2TextEditor";
import { useKeyboardInset } from "./useKeyboardInset";
import { bracesIn, bracesOut, fieldFromRows, insertToken, rowIdAtCaret, rowsFromField } from "@/topics/renderers/propis2/fieldText.js";
import Propis2Preview from "./Propis2Preview";
import * as I from "./Propis2Icons";
import Propis2Picker from "./Propis2Picker";
import { useHint } from "./Propis2Hint";

// The page constructor. The page canvas, with settings above it and the tools below it (tabs «Символ», «Слово», «Текст»).
// No dragging: select a row (tap it on the page) and tap a symbol, it goes into that row; with no row selected a tapped
// symbol starts a new row. The selected row's bar edits its text, kind of row, repeat, order. The page is saved by the
// parent on every change; nothing is ever dropped silently.
const OFFER_MS = 5000;
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

// The dot on a strip button: the pages of the notebook differ in this setting (owner, 2026-10-15).
export const MIXED_TEXT = "в тетради по-разному";
// What a strip button did, for the offer to do it on the whole notebook.
const optionName = (list, id, field = "label") => String(list.find((o) => o.id === id)?.[field] ?? id).toLowerCase();
const SETTING_SAYS = {
  gridKind: (v) => `Бумага: ${optionName(GRID_KINDS, v)}`,
  ruling: (v) => `Строки: ${optionName(RULINGS, v, "short")}`,
  grid: (v) => `Наклон: ${optionName(GRIDS, v, "short")}`,
  margin: (v) => `Поля: ${optionName(MARGINS, v)}`,
  midDash: (v) => (v ? "Пунктир включён" : "Пунктир выключен"),
  writeAfter: (v) => (v ? "Строки для письма добавлены" : "Строки для письма убраны"),
};

// What the constructor shows are pictograms; the name of each control is its aria-label only.
const PAPER_ICONS = { propis: I.IconPaperPropis, square: I.IconPaperSquare, ruled: I.IconPaperRuled };
const RULING_ICONS = { narrow: I.IconRowNarrow, wide: I.IconRowWide };
const SLANT_ICONS = { regular: I.IconSlantSparse, dense: I.IconSlantDense };
const FORMAT_ICONS = { a5: I.IconFormatA5, a4: I.IconFormatA4 };
const MARGIN_ICONS = { off: I.IconMarginOff, left: I.IconMarginLeft, right: I.IconMarginRight };
const SOLID_REPEAT = "all-solid";
const repeatChoice = (o) => (o.repeat === "all" && o.copies === "solid" ? SOLID_REPEAT : o.repeat);
const repeatPatch = (id) => (id === SOLID_REPEAT ? { repeat: "all", copies: "solid" } : { repeat: id, copies: "dash" });
const REPEAT_OPTS = [
  { id: "one", label: "Одна запись", Icon: I.IconRepOne },
  { id: "all", label: "Повтор пунктиром", Icon: I.IconRepAll },
  // the copies as pale solid lines (row `copies: "solid"`): it was a «Копии» button of its own, the difference unseen at the size of
  // the page on a phone and the button looked dead (owner, 2026-10-15: make it a choice of «Образец»)
  { id: SOLID_REPEAT, label: "Повтор бледной линией", Icon: I.IconRepSolid },
  { id: "fade", label: "Повтор с затуханием", Icon: I.IconRepFade },
];
const DOT_OPTS = [
  { id: "none", label: "Без красных точек", Icon: I.IconDotsNone },
  { id: "one", label: "Красная точка у образца", Icon: I.IconDotsOne },
  { id: "all", label: "Красные точки у образца и копий", Icon: I.IconDotsAll },
];


// A round/square icon button: 44px target, pressed state, the name only as aria-label.
function IconBtn({ label, caption, on, onClick, disabled, children, className = "", mixed = false, ...rest }) {
  const { bind, tip } = useHint(label);
  return (
    <button type="button" className={`p2-ib${caption ? " p2-tool" : ""}${on ? " is-on" : ""} ${className}`} aria-label={label} aria-pressed={on === undefined ? undefined : Boolean(on)} aria-description={mixed ? MIXED_TEXT : undefined} disabled={disabled} onClick={onClick} {...bind} {...rest}>
      {mixed && <span className="p2-mixed" aria-hidden="true" />}
      {caption ? <><span className="p2-tool-ico">{children}</span><span className="p2-cap">{caption}</span></> : children}
      {tip}
    </button>
  );
}

export default function Propis2Editor({ page, nav, topicRecord, onChange, onBack, onShow, dirty = false, onSave, title, onTitle, onUndo, onRedo, canUndo = false, canRedo = false, notebook = null }) {
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  // The checks of the rows and the map of the sheet's rows are worked out on a deferred copy of the page (as the preview is): a key
  // typed shows in the field at once, the marks on the sheet follow a moment later.
  const settled = useDeferredValue(page);
  const analysis = useMemo(() => analyzePage(settled, glyphMap), [settled, glyphMap]);
  const owners = useMemo(() => lineOwners(settled, glyphMap), [settled, glyphMap]);
  const [selectedId, setSelectedId] = useState(null);
  // the field shows the page's rows from `fieldStartId` to the end, one per line; no start = the place below the last row
  const [fieldStartId, setFieldStartId] = useState(null);
  const [draft, setDraft] = useState("");
  const [caretRequest, setCaretRequest] = useState(null);
  const [pageW, setPageW] = useState(0);
  const locked = isLocked(page);
  // A setting changed on this page is offered for the whole notebook for a few seconds (owner, 2026-10-15: no «Всем» button, no
  // mode to forget): { key, value, done } — `done`: it went onto every page, the offer turns into «Отменить».
  const [offer, setOffer] = useState(null);
  const offerTimer = useRef(null);
  useEffect(() => () => clearTimeout(offerTimer.current), []);
  const showOffer = (o, ms) => { clearTimeout(offerTimer.current); setOffer(o); offerTimer.current = o ? setTimeout(() => setOffer(null), ms) : null; };
  const setSetting = (key, value) => {
    onChange({ ...page, [key]: value });
    showOffer(notebook?.othersDiffer(key, value) ? { key, value } : null, OFFER_MS);
  };
  const keyboard = useKeyboardInset();
  // every element has a short code of its own for the field, {э1}, {э2}... (by its place in the list)
  const elementTiles = useMemo(() => buildTiles(topicRecord).elements.map((t, i) => ({ ...t, code: `э${i + 1}` })), [topicRecord]);
  const elementCodes = useMemo(() => new Map(elementTiles.map((t) => [t.text, t.code])), [elementTiles]);
  const side = useMedia(SIDE_QUERY);
  const phone = useMedia(PHONE_QUERY) && !side;
  // wide screens: the text of the WHOLE page in a tall editor (line numbers, one line per row); a locked kit page edits one row in the small field
  const full = side && !locked;
  const sideRef = useRef(side);
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  sideRef.current = side;
  const wrapRef = useRef(null);
  const pageIndexRef = useRef(0);
  const gridKind = pageGridKind(page);
  const mx = notebook?.mixed ?? {};
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
  // What the red marks under the page mean: one chip per kind of problem; a tap opens a note with the cause and the way out
  const [warnOpen, setWarnOpen] = useState(null);
  const shownChars = (list) => list.map((c) => c.replace("№", "")).join(" ");
  const warnChips = [];
  if (selectedInfo?.unsupported.length > 0) {
    const chars = shownChars(selectedInfo.unsupported);
    warnChips.push({ kind: "unsupported", label: `Нет начертания: ${chars}. Нажмите, чтобы узнать подробнее`, icon: selectedInfo.unsupported.map((c) => <b key={c}>{c}</b>), title: `Нет начертания: ${chars}`,
      what: "Этих символов нет в прописях, поэтому в строке они не рисуются. Поддерживаются русские буквы (строчные и заглавные), цифры, знаки + − = < >, точка, запятая, ! ? и элементы из кнопки «Элемент». Дефис и тире внутри слова, кавычки, скобки и латинские буквы не пишутся.",
      fix: "замените эти символы другими или удалите их из строки." });
  }
  if (selectedInfo?.outside?.length > 0) {
    const chars = shownChars(selectedInfo.outside);
    warnChips.push({ kind: "outside", label: `На широкой строке нельзя: ${chars}. Нажмите, чтобы узнать подробнее`, icon: <><I.IconRowWide />{selectedInfo.outside.map((c) => <b key={c}>{c.replace("№", "")}</b>)}</>, title: `На широкой строке нельзя: ${chars}`,
      what: "Широкая строка рассчитана на строчные буквы, которые целиком помещаются в строку, как в методике. Заглавные буквы, б, в, д, з, р, у, ф, ц, щ, цифры и знаки ! ? выходят за строку, поэтому здесь не пишутся.",
      fix: "переключите страницу на узкую строку (кнопка «Строки») или замените эти буквы." });
  }
  if (selectedInfo?.overflow) {
    warnChips.push({ kind: "overflow", label: "Строка не помещается по ширине. Нажмите, чтобы узнать подробнее", icon: <span className="p2-cut" aria-hidden="true" />, title: "Строка не помещается по ширине",
      what: "Запись длиннее, чем помещается в строке между краями листа и полями: конец строки уходит за лист и не будет виден и напечатан.",
      fix: "сократите запись, разбейте её на две строки клавишей Enter или включите кнопку «Текст»: тогда длинная фраза сама перенесётся на следующие строки. Помогут также формат А4 и страница без полей." });
  }
  if (analysis.problems > 0) {
    warnChips.push({ kind: "summary", label: `Строк с проблемами: ${analysis.problems}. Нажмите, чтобы узнать подробнее`, icon: <b>{analysis.problems}</b>, title: `Строк с проблемами: ${analysis.problems}`,
      what: "Такие строки на странице подсвечены красным. Это строки, где есть символы без начертания, буквы, которые нельзя на широкой строке, или запись, которая не помещается по ширине.",
      fix: "нажмите на красную строку на странице: под страницей появятся значки с причиной, нажатие на значок объяснит её." });
  }
  const openWarn = warnOpen && warnOpen.row === selectedId && warnChips.some((w) => w.kind === warnOpen.kind) ? warnOpen.kind : null;
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
    const local = rowAtSvgY(y, pageFormat(page), page.ruling === "narrow", ["square", "ruled"].includes(taskGrid(page)) ? taskGrid(page) : null);
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
    // the full-page editor: the caret goes to the line of the tapped row
    if (full) setCaretRequest({ line: result.page.rows.findIndex((r) => r.id === result.rowId), n: Date.now() });
  };

  // undone, like any other change, with the undo arrow
  const clear = () => { if (typeof window !== "undefined" && window.confirm && !window.confirm("Очистить страницу? Все строки будут стёрты.")) return; setSelectedId(null); setFieldStartId(null); onChange(clearPage(page)); };

  // ---- the text field ----
  const startId = full ? (page.rows[0]?.id ?? null) : (page.rows.some((r) => r.id === fieldStartId) ? fieldStartId : null);
  const fieldIndex = startId ? page.rows.findIndex((r) => r.id === startId) : -1;
  const rowsSig = page.rows.map((r) => `${r.id}|${r.kind}|${r.text}`).join("\n");
  const draftKey = `${rowsSig}#${startId ?? ""}#${locked ? selectedId ?? "" : ""}`;
  const [draftSynced, setDraftSynced] = useState(draftKey);
  // the draft is rebuilt from the page whenever the page or the starting row changed from outside the field
  if (draftSynced !== draftKey) {
    setDraftSynced(draftKey);
    setDraft(bracesIn(locked ? (selected ? String(selected.text ?? "") : "") : fieldFromRows(page.rows, fieldIndex < 0 ? page.rows.length : fieldIndex, full), elementCodes));
  }
  // `typing`: keys typed in the field (one undo step while typed without a pause); a tile inserted is a step of its own
  const onField = (shown, typing = true) => {
    const value = bracesOut(shown, elementCodes);
    if (locked) {
      if (!selected) return;
      setDraft(shown);
      const next = { ...page, rows: page.rows.map((r) => (r.id === selected.id ? { ...r, text: value } : r)) };
      setDraftSynced(`${next.rows.map((r) => `${r.id}|${r.kind}|${r.text}`).join("\n")}#${startId ?? ""}#${selectedId ?? ""}`);
      onChange(next, { typing });
      return;
    }
    const { rows, firstId } = rowsFromField({ rows: page.rows, startId, value, glyphMap, page });
    if (rows === page.rows) { setDraft(shown); return; }
    const nextStart = startId ?? firstId;
    setDraft(shown);
    setFieldStartId(nextStart);
    setDraftSynced(`${rows.map((r) => `${r.id}|${r.kind}|${r.text}`).join("\n")}#${nextStart ?? ""}#`);
    onChange({ ...page, rows: rows.length ? rows : [newRow()] }, { typing });
    if (!selectedId || !rows.some((r) => r.id === selectedId)) setSelectedId(nextStart);
  };
  const onCaret = (caret) => {
    if (locked) return;
    const id = rowIdAtCaret(page.rows, startId, draft, caret);
    if (id && id !== selectedId) setSelectedId(id);
  };
  const insertElement = (token, caret) => {
    if (locked) { if (selected) onField(token, false); return; }
    const { value, caret: pos } = insertToken(draft, caret, token);
    onField(value, false);
    setCaretRequest({ pos, n: Date.now() });
  };
  const setRowAsText = (asText) => {
    if (!selected) return;
    patchSelected({ asText, kind: asText ? "passage" : "text" });
  };

  // the number of the sheet's row each line of the full-page editor starts at (a running text covers several rows: its first)
  const rowNumbers = useMemo(() => {
    const out = [];
    owners.forEach((o, abs) => { if (o != null && out[o] === undefined) out[o] = String(abs + 1); });
    return out;
  }, [owners]);

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

  useEffect(() => { if (selectedId && selectedIndex < 0) setSelectedId(null); }, [selectedId, selectedIndex]);

  const warnsEl = (selectedInfo?.unsupported.length > 0 || selectedInfo?.outside?.length > 0 || selectedInfo?.overflow || analysis.problems > 0) && (
            <div className="p2-warns">
              {warnChips.map((w) => (
                <button key={w.kind} type="button" className={`p2-warn${w.kind === "summary" ? " p2-warn--summary" : ""}${openWarn === w.kind ? " is-open" : ""}`} aria-label={w.label} aria-expanded={openWarn === w.kind} aria-controls="p2-warn-note" onClick={() => setWarnOpen(openWarn === w.kind ? null : { kind: w.kind, row: selectedId })}>
                  <I.IconWarn />{w.icon}
                </button>
              ))}
              {openWarn && warnChips.find((w) => w.kind === openWarn) && (
                <div className="p2-warn-note" id="p2-warn-note" role="status">
                  <b className="p2-warn-note-title">{warnChips.find((w) => w.kind === openWarn).title}</b>
                  <p>{warnChips.find((w) => w.kind === openWarn).what}</p>
                  <p className="p2-warn-note-fix"><b>Что сделать:</b> {warnChips.find((w) => w.kind === openWarn).fix}</p>
                </div>
              )}
            </div>
          );

  return (
    <div className={`screen propis2-home propis2-editor2${side ? " propis2-editor2--side" : ""}${phone ? " propis2-editor2--phone" : ""}${keyboard.open ? " propis2-editor2--kb" : ""}`} data-testid="propis2-editor" style={keyboard.open ? { "--p2-vvtop": `${keyboard.top}px`, "--p2-vvh": `${keyboard.height}px` } : undefined}>
      <div className="screen-header p2-header">
        <button className="back-btn" onClick={onBack} aria-label="Назад"><BackArrowIcon /></button>
        <input className="propis2-title-input" value={title ?? page.title} onChange={(e) => (onTitle ? onTitle(e.target.value) : onChange({ ...page, title: e.target.value }, { typing: true }))} aria-label={onTitle ? "Название тетради" : "Название страницы"} />
        {onSave && <button type="button" className="p2-save" onClick={onSave} disabled={!dirty} aria-label="Сохранить тетрадь" title={dirty ? "Сохранить тетрадь" : "Нет несохранённых изменений"}><I.IconSave /></button>}
        <button type="button" className="p2-show" onClick={onShow} aria-label="Показать ученику"><I.IconPlay /></button>
      </div>

      <div className="propis2-main">
        <div className="propis2-settings" role="group" aria-label="Настройки страницы">
          {/* one strip for the page (owner, 2026-10-15): paging, then the paper, then what is done to the page; it scrolls on a phone */}
          {nav?.total > 1 && (
            <>
              <button type="button" className="p2-ib p2-tool" aria-label="Предыдущая страница" disabled={nav.index <= 0} onClick={nav.onPrev}><span className="p2-tool-ico p2-glyph">‹</span><span className="p2-cap">Назад</span></button>
              <span className="p2-pager-pos" aria-live="polite">Стр. {nav.index + 1} из {nav.total}</span>
              <button type="button" className="p2-ib p2-tool" aria-label="Следующая страница" disabled={nav.index >= nav.total - 1} onClick={nav.onNext}><span className="p2-tool-ico p2-glyph">›</span><span className="p2-cap">Вперёд</span></button>
              <span className="p2-sep" aria-hidden="true" />
            </>
          )}
          {/* the notebook is A5 (owner, 2026-10-14: an A4 notebook needs another printer; A4 stays only as the sheet an A5 notebook is
              printed on): the format shows only on a page already made A4, to take it back to A5 */}
          {pageFormat(page) === "a4" && <Propis2Picker label="Формат" caption="Формат" disabled={locked} value={pageFormat(page)} onChange={(id) => onChange({ ...page, format: id })} options={PAGE_FORMATS.map((f) => ({ id: f.id, label: f.label, Icon: FORMAT_ICONS[f.id] }))} />}
          <Propis2Picker label="Тип бумаги" caption="Бумага" disabled={locked} mixed={mx.gridKind} value={gridKind} onChange={(id) => setSetting("gridKind", id)} options={GRID_KINDS.map((g) => ({ id: g.id, label: g.label, Icon: PAPER_ICONS[g.id] }))} />
          <Propis2Picker label="Разлиновка" caption="Строки" disabled={locked} mixed={mx.ruling} value={page.ruling} onChange={(id) => setSetting("ruling", id)} options={RULINGS.map((r) => ({ id: r.id, label: r.short ?? r.label, Icon: RULING_ICONS[r.id] }))} />
          <Propis2Picker label="Косая линейка" caption="Наклон" value={page.grid ?? "regular"} disabled={locked || !propisGrid} mixed={mx.grid} onChange={(id) => setSetting("grid", id)} options={GRIDS.map((g) => ({ id: g.id, label: g.short, Icon: SLANT_ICONS[g.id] }))} />
          <Propis2Picker label="Поля" caption="Поля" disabled={locked} mixed={mx.margin} value={pageMargin(page)} onChange={(id) => setSetting("margin", id)} options={MARGINS.map((m) => ({ id: m.id, label: m.label, Icon: MARGIN_ICONS[m.id] }))} />
          <IconBtn label="Пунктир в серединных линиях" caption="Пунктир" on={page.midDash !== false} disabled={locked || !propisGrid} mixed={mx.midDash} onClick={() => setSetting("midDash", page.midDash === false)} data-kind="dash"><I.IconDash /></IconBtn>
          <IconBtn label="Строка для письма после каждой строки" caption="Писать" on={Boolean(page.writeAfter)} disabled={locked} mixed={mx.writeAfter} onClick={() => setSetting("writeAfter", !page.writeAfter)} data-kind="writeafter"><I.IconWriteAfter /></IconBtn>
          {locked && (
            <>
              <span className="p2-lock" role="img" aria-label="Страница из тетради: раскладка закрыта, меняются только символы и слова"><I.IconLock /></span>
              <IconBtn label="Редактировать страницу" caption="Править" onClick={() => onChange({ ...page, locked: false })}><I.IconEditPage /></IconBtn>
              <IconBtn label="Очистить страницу" caption="Очистить" className="p2-ib--danger" onClick={clear}><I.IconClearPage /></IconBtn>
            </>
          )}
          {nav && (
            <>
              <span className="p2-sep" aria-hidden="true" />
              <button type="button" className="p2-ib p2-tool" aria-label="Добавить страницу" onClick={nav.onAdd}><span className="p2-tool-ico"><I.IconAddPage /></span><span className="p2-cap">Добавить</span></button>
              <button type="button" className="p2-ib p2-tool" aria-label="Копия страницы" onClick={nav.onDuplicate}><span className="p2-tool-ico"><I.IconDuplicate /></span><span className="p2-cap">Копия</span></button>
              {nav.total > 1 && (
                <>
                  <button type="button" className="p2-ib p2-tool" aria-label="Переместить страницу раньше" disabled={nav.index <= 0} onClick={nav.onMoveBefore}><span className="p2-tool-ico p2-glyph">←</span><span className="p2-cap">Раньше</span></button>
                  <button type="button" className="p2-ib p2-tool" aria-label="Переместить страницу позже" disabled={nav.index >= nav.total - 1} onClick={nav.onMoveAfter}><span className="p2-tool-ico p2-glyph">→</span><span className="p2-cap">Позже</span></button>
                </>
              )}
              <button type="button" className="p2-ib p2-tool p2-ib--danger" aria-label={nav.total > 1 ? "Удалить страницу из тетради" : "Удалить тетрадь"} onClick={nav.onDelete}><span className="p2-tool-ico"><I.IconTrash /></span><span className="p2-cap">Удалить</span></button>
            </>
          )}
        </div>

        <div className="propis2-settings propis2-settings--row" role="group" aria-label="Настройки строки">
          <Propis2Picker label="Повтор" caption="Образец" value={rowOpts ? repeatChoice(rowOpts) : "all"} disabled={!rowEditable} onChange={(id) => patchSelected(repeatPatch(id))} options={REPEAT_OPTS} />
          <Propis2Picker label="Красные точки" caption="Точки" value={rowOpts?.dots ?? "all"} disabled={!rowEditable} onChange={(id) => patchSelected({ dots: id })} options={DOT_OPTS} />
          <IconBtn label="Строка как текст (с переносом)" caption="Текст" on={selected ? selected.kind === "passage" : undefined} disabled={locked || !selected || selected.kind === "blank"} onClick={() => setRowAsText(selected.kind !== "passage")}><I.IconTabText /></IconBtn>
          <span className="p2-sep" aria-hidden="true" />
          <div className="p2-seg" role="group" aria-label="Строка">
            <IconBtn label="Выше" caption="Выше" onClick={() => setRows(moveRow(page.rows, selectedIndex, -1))} disabled={!selected || selectedIndex === 0}><I.IconUp /></IconBtn>
            <IconBtn label="Ниже" caption="Ниже" onClick={() => setRows(moveRow(page.rows, selectedIndex, 1))} disabled={!selected || selectedIndex === page.rows.length - 1}><I.IconDown /></IconBtn>
            <IconBtn label="Дублировать" caption="Дубль" disabled={!selected} onClick={() => { const next = duplicateRow(page.rows, selectedIndex); setRows(next); setSelectedId(next[selectedIndex + 1].id); }}><I.IconDuplicate /></IconBtn>
            <IconBtn label="Удалить строку" caption="Удалить" className="p2-ib--danger" disabled={!selected} onClick={() => { setRows(page.rows.filter((r) => r.id !== selectedId)); setSelectedId(null); }}><I.IconTrash /></IconBtn>
          </div>
        </div>

        {onUndo && (
          // undo / redo float over the canvas, at its right side (not in the scrolling page: they stay put while it scrolls)
          <div className="p2-history" role="group" aria-label="История изменений">
            <button type="button" className="p2-hist" onClick={onUndo} disabled={!canUndo} aria-label="Отменить" title="Отменить"><I.IconUndo /></button>
            <button type="button" className="p2-hist" onClick={onRedo} disabled={!canRedo} aria-label="Вернуть" title="Вернуть"><I.IconRedo /></button>
          </div>
        )}
        {offer && notebook && (
          <div className="p2-offer" role="status" data-testid="propis2-offer">
            <span className="p2-offer-msg">{SETTING_SAYS[offer.key](offer.value)} — {offer.done ? `на всех ${notebook.total} страницах` : `на стр. ${(nav?.index ?? 0) + 1}`}</span>
            {offer.done
              ? <button type="button" className="p2-offer-btn p2-offer-btn--ghost" onClick={() => { showOffer(null); onUndo?.(); }}>Отменить</button>
              : <button type="button" className="p2-offer-btn" onClick={() => { notebook.applyAll(offer.key, offer.value); showOffer({ ...offer, done: true }, OFFER_MS - 1000); }}><I.IconSpread />На всю тетрадь</button>}
            <span className="p2-offer-timer" aria-hidden="true" key={offer.done ? "done" : "offer"}><i style={{ animationDuration: `${offer.done ? OFFER_MS - 1000 : OFFER_MS}ms` }} /></span>
          </div>
        )}
        <div className="propis2-page-col" ref={wrapRef} onClick={onPageClick}>
          <div className="propis2-page-box" style={pageW ? { width: pageW } : undefined}>
            <Propis2Preview page={page} topicRecord={topicRecord} overlays={overlays} onPageIndexChange={(i) => { pageIndexRef.current = i; }} />
          </div>
        </div>

        <div className="propis2-dock">
          {full ? (
            <Propis2TextEditor value={draft} onChange={onField} onCaret={onCaret} placeholder="Буква, слово или текст. Enter — новая строка" elements={elementTiles} onInsertElement={insertElement} caretRequest={caretRequest} numbers={rowNumbers} activeLine={selectedIndex} bar={warnsEl} />
          ) : (
            <>
              {warnsEl}
              {side && locked && <p className="p2-ed-locked">Страница из готовой тетради закрыта: правится только выбранная строка. Кнопка «Править» вверху откроет всю страницу.</p>}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
