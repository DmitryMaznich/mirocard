import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasZoom } from "./useCanvasZoom";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { SLANT_PAPERS, SOLID_REPEAT, followingSameRows, mixedRowSettings, rowSetting, GRIDS, GRID_KINDS, PAGE_FORMATS, deckPapers, MARGINS, multipliesByDefault, pageAspect, pageFormat, RULINGS, pageMargin, rowParams, analyzePage, clearPage, duplicateRow, isLocked, lineOwners, moveRow, newRow, pageGridKind, selectRowAt } from "@/topics/renderers/propis2/model.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { buildTiles } from "./Propis2Carousel";
import { ElementPicker } from "./Propis2Field";
import Propis2Keys from "./Propis2Keys";
import Propis2Thumbs from "./Propis2Thumbs";
import { useKeyboardInset } from "./useKeyboardInset";
import { bracesIn, bracesOut, fieldFromRows, insertToken, rowIdAtCaret, rowsFromField } from "@/topics/renderers/propis2/fieldText.js";
import { caretFromSheet, caretOnSheet } from "@/topics/renderers/propis2/caret.js";
import Propis2Preview from "./Propis2Preview";
import * as I from "./Propis2Icons";
import Propis2Picker from "./Propis2Picker";
import { useHint } from "./Propis2Hint";

// The page constructor: the page canvas with the settings of the page and of the row above it. The text is typed STRAIGHT ONTO THE
// SHEET (owner, 2026-10-23, «как в Word»): a click on a row puts the caret there, between the letters, and the keyboard writes into the
// row; there is no text field to look at. The page's text is one string, one line per row (fieldText.js), held by an invisible
// textarea (Propis2Keys) — the caret, the selection, Enter, Backspace, the arrows are its own; caret.js maps them onto the sheet.
// The selected row (the one the caret is in) gets its options from the row strip. The page is saved by the parent on every change.
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
const PAPER_ICONS = { propis: I.IconPaperPropis, square: I.IconPaperSquare, ruled: I.IconPaperRuled, bg: I.IconPaperBg };
const RULING_ICONS = { narrow: I.IconRowNarrow, wide: I.IconRowWide };
const SLANT_ICONS = { regular: I.IconSlantSparse, dense: I.IconSlantDense, none: I.IconSlantNone };
const FORMAT_ICONS = { a5: I.IconFormatA5, a4: I.IconFormatA4 };
const MARGIN_ICONS = { off: I.IconMarginOff, left: I.IconMarginLeft, right: I.IconMarginRight };
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
// What a row strip button did, for the offer to do it on the next rows too (owner, 2026-10-24)
const ROW_SAYS = {
  repeat: (v) => `Образец: ${optionName(REPEAT_OPTS, v)}`,
  dots: (v) => `Точки: ${optionName(DOT_OPTS, v)}`,
};
const ROW_PATCH = { repeat: (v) => repeatPatch(v), dots: (v) => ({ dots: v }) };
const onRows = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "строке" : "строках"}`;


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
  const keysRef = useRef(null);
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [typing, setTyping] = useState(false); // the invisible text has the focus: the caret shows on the sheet
  const [pageW, setPageW] = useState(0);
  const [colW, setColW] = useState(0); // the canvas width: the page at «По ширине»
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
  // the invisible text holds the WHOLE page, one line per row (a locked kit page: the selected row only)
  const full = !locked;
  const sideRef = useRef(side);
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  sideRef.current = side;
  const wrapRef = useRef(null);
  const boxRef = useRef(null);
  const pageIndexRef = useRef(0);
  const gridKind = pageGridKind(page);
  const mx = notebook?.mixed ?? {};
  const propisGrid = gridKind === "propis";
  // the Bulgarian paper has no dense slant: only «Редкая» / «Без наклонных»
  const slantValue = page.grid === "none" ? "none" : page.grid === "dense" && propisGrid ? "dense" : "regular";
  const aspect = pageAspect(page);

  // The page's width: the canvas width, but not so wide that the page is more than MAX_OVERFLOW times taller
  // than the room for it. Recomputed when the canvas resizes (rotation, dock height, keyboard).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      // the computer layout: the room inside the canvas's own padding (it pads the sheet off the edges of the desk)
      const cs = sideRef.current ? window.getComputedStyle(el) : null;
      const w = cs ? el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) + 8 : el.clientWidth;
      const h = cs ? el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) : el.clientHeight;
      if (!w || !h) return;
      setPageW(Math.floor(phoneRef.current ? w - 8 : Math.min(w - 8, h * (sideRef.current ? 1 : MAX_OVERFLOW) * aspect)));
      setColW(Math.floor(w - 8));
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
  // A row setting (Образец, Точки) changed on the selected row; the rows below that were set as it was are offered the change too:
  // «… на строке 3 · На следующие строки» (as the paper's «На всю тетрадь»). Only down to the first row set otherwise, on this page.
  const setRowSetting = (key, value) => {
    const old = rowSetting(selected, key, glyphMap);
    patchSelected(ROW_PATCH[key](value));
    const ids = old === value ? [] : followingSameRows(page.rows, selectedIndex, key, old, glyphMap);
    showOffer(ids.length ? { scope: "rows", key, value, ids, row: selectedIndex + 1 } : null, OFFER_MS);
  };
  const rowMixed = useMemo(() => mixedRowSettings(page.rows, glyphMap), [page.rows, glyphMap]);

  // A click on the sheet (PrintPage onSheetPoint: the sheet row under it, the x in the row): the caret goes to the nearest letter
  // boundary of that row — an empty place on the sheet gets a new, empty row first (any ruled row can be clicked and typed into);
  // Shift + click selects from the caret to there. Outside the ruled rows: the caret goes away.
  const onSheetPoint = ({ row: abs, x, shiftKey }) => {
    if (abs < 0) { keysRef.current?.blur(); setSelectedId(null); setFieldStartId(null); return; }
    // focus now, inside the click: a phone opens its keyboard only for a field focused by the user's own tap
    keysRef.current?.focus({ preventScroll: true });
    if (locked) {
      const owner = abs < owners.length ? owners[abs] : undefined;
      setSelectedId(owner != null ? page.rows[owner].id : null);
      setCaretRequest({ pos: owner != null ? String(page.rows[owner].text ?? "").length : 0, n: Date.now() });
      return;
    }
    const result = selectRowAt(page, glyphMap, abs);
    if (result.page !== page) onChange(result.page);
    const next = result.page;
    const lines = bracesIn(fieldFromRows(next.rows, 0, true), elementCodes).split("\n");
    const hit = caretFromSheet({ page: next, glyphMap, owners: lineOwners(next, glyphMap), abs, x, lines, codes: elementCodes })
      ?? { rowIndex: Math.max(0, next.rows.findIndex((r) => r.id === result.rowId)), offset: 0 };
    const pos = lines.slice(0, hit.rowIndex).reduce((n, l) => n + l.length + 1, 0) + hit.offset;
    setSelectedId(next.rows[hit.rowIndex]?.id ?? result.rowId);
    setFieldStartId(next.rows[0]?.id ?? null);
    setCaretRequest({ pos, anchor: shiftKey ? sel.start : pos, n: Date.now() });
  };
  // a click on the canvas around the sheet: the caret goes away
  const onPageClick = (e) => { if (!e.target.closest?.("svg.propis-print-page-svg")) { keysRef.current?.blur(); setSelectedId(null); } };

  // undone, like any other change, with the undo arrow
  const clear = () => { if (typeof window !== "undefined" && window.confirm && !window.confirm("Очистить страницу? Все строки будут стёрты.")) return; setSelectedId(null); setFieldStartId(null); onChange(clearPage(page)); };

  // ---- the text field ----
  const startId = full ? (page.rows[0]?.id ?? null) : (page.rows.some((r) => r.id === fieldStartId) ? fieldStartId : null);
  const fieldIndex = startId ? page.rows.findIndex((r) => r.id === startId) : -1;
  const rowsSig = page.rows.map((r) => `${r.id}|${r.kind}|${r.text}`).join("\n");
  const draftKey = `${rowsSig}#${startId ?? ""}#${locked ? selectedId ?? "" : ""}`;
  const [draftSynced, setDraftSynced] = useState(null); // null: the first render fills the field from the page (it opened empty on a computer)
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
  const insertElement = (token, caret = sel.start) => {
    if (locked) { if (selected) onField(token, false); return; }
    const { value, caret: pos } = insertToken(draft, caret, token);
    onField(value, false);
    setCaretRequest({ pos, n: Date.now() });
  };
  const onKeysSelect = ({ start, end }) => { setSel({ start, end }); onCaret(start); };
  const setRowAsText = (asText) => {
    if (!selected) return;
    patchSelected({ asText, kind: asText ? "passage" : "text" });
  };

  // Overlays on the page: the selected row (blue), problems (red), and while typing the caret / the selected stretch (caret.js).
  const ownersNow = useMemo(() => lineOwners(page, glyphMap), [page, glyphMap]);
  const caretMarks = useMemo(() => {
    if (!typing || locked) return [];
    const lines = draft.split("\n");
    const at = (pos) => {
      const before = draft.slice(0, Math.max(0, Math.min(draft.length, pos))).split("\n");
      const rowIndex = before.length - 1;
      return caretOnSheet({ page, glyphMap, owners: ownersNow, rowIndex, line: lines[rowIndex] ?? "", offset: before[rowIndex].length, codes: elementCodes });
    };
    const a = at(sel.start);
    if (!a) return [];
    if (sel.end <= sel.start) return [{ row: a.abs, tone: "caret", x: a.x }];
    const b = at(sel.end);
    if (!b) return [];
    if (a.abs === b.abs) return [{ row: a.abs, tone: "range", x: a.x, x2: b.x }];
    // over several sheet rows: from the start to the row's right edge, whole rows between, the last row from its start
    const out = [{ row: a.abs, tone: "range", x: a.x, x2: 10000 }];
    for (let r = a.abs + 1; r < b.abs; r += 1) out.push({ row: r, tone: "range", x: 0, x2: 10000 });
    out.push({ row: b.abs, tone: "range", x: 0, x2: b.x });
    return out;
  }, [typing, locked, draft, sel, page, glyphMap, ownersNow, elementCodes]);
  const overlays = useMemo(() => {
    const out = [];
    owners.forEach((o, abs) => {
      if (o == null) return;
      const info = analysis.rows[o];
      if (info && (info.unsupported.length || info.outside?.length || info.overflow)) out.push({ row: abs, tone: "warn" });
      if (page.rows[o]?.id === selectedId) out.push({ row: abs, tone: "select" });
    });
    return [...out, ...caretMarks];
  }, [owners, analysis, page.rows, selectedId, caretMarks]);

  const zoom = useCanvasZoom({ colRef: wrapRef, boxRef, fitW: pageW, widthW: colW });
  // The caret (or, not typing, the selected row) stays in sight, the page zoomed in or not: the canvas scrolls to it. Also when the
  // canvas itself changes size — above all when a phone's or a tablet's keyboard opens (the editor then takes only the visible part
  // of the screen) — so the caret never stays under the keyboard (owner, 2026-10-23). Not on a zoom: Ctrl + wheel keeps the point under
  // the pointer.
  const keepInView = () => {
    const col = wrapRef.current;
    const mark = col?.querySelector('[data-overlay="caret"]') ?? col?.querySelector('[data-overlay="select"]');
    if (!mark) return;
    const c = col.getBoundingClientRect();
    const r = mark.getBoundingClientRect();
    const pad = 16;
    const below = 28; // a little more room under the caret: the next row shows too
    if (r.top < c.top + pad) col.scrollTop -= c.top + pad - r.top;
    else if (r.bottom > c.bottom - below) col.scrollTop += Math.min(r.bottom - (c.bottom - below), r.top - (c.top + pad));
    // zoomed in: sideways too (the caret only; a selected row spans the whole width)
    if (mark.getAttribute("data-overlay") === "caret") {
      if (r.left < c.left + pad) col.scrollLeft -= c.left + pad - r.left;
      else if (r.right > c.right - pad) col.scrollLeft += r.right - (c.right - pad);
    }
  };
  const keepRef = useRef(keepInView);
  useEffect(() => { keepRef.current = keepInView; });
  useEffect(() => { keepRef.current(); }, [overlays, keyboard.open, keyboard.height]);
  useEffect(() => {
    const col = wrapRef.current;
    if (!col || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => requestAnimationFrame(() => keepRef.current()));
    ro.observe(col);
    return () => ro.disconnect();
  }, []);

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

  // ---- the pieces of the screen: the phone / tablet layout stacks them, the computer layout lays them out like a desktop editor ----
  const headerEl = (
      <div className="screen-header p2-header">
        <button className="back-btn" onClick={onBack} aria-label="Назад"><BackArrowIcon /></button>
        <input className="propis2-title-input" value={title ?? page.title} onChange={(e) => (onTitle ? onTitle(e.target.value) : onChange({ ...page, title: e.target.value }, { typing: true }))} aria-label={onTitle ? "Название тетради" : "Название страницы"} />
        {onSave && <button type="button" className="p2-save" onClick={onSave} disabled={!dirty} aria-label="Сохранить тетрадь" title={dirty ? "Сохранить тетрадь" : "Нет несохранённых изменений"}><I.IconSave /></button>}
        <button type="button" className="p2-show" onClick={onShow} aria-label="Показать ученику"><I.IconPlay /></button>
      </div>
  );
  const paperEls = <>
          {/* the notebook is A5 (owner, 2026-10-14: an A4 notebook needs another printer; A4 stays only as the sheet an A5 notebook is
              printed on): the format shows only on a page already made A4, to take it back to A5 */}
          {pageFormat(page) === "a4" && <Propis2Picker label="Формат" caption="Формат" disabled={locked} value={pageFormat(page)} onChange={(id) => onChange({ ...page, format: id })} options={PAGE_FORMATS.map((f) => ({ id: f.id, label: f.label, Icon: FORMAT_ICONS[f.id] }))} />}
          <Propis2Picker label="Тип бумаги" caption="Бумага" disabled={locked} mixed={mx.gridKind} value={gridKind} onChange={(id) => setSetting("gridKind", id)} options={deckPapers(topicRecord).map((g) => ({ id: g.id, label: g.label, Icon: PAPER_ICONS[g.id] }))} />
          <Propis2Picker label="Разлиновка" caption="Строки" disabled={locked} mixed={mx.ruling} value={page.ruling} onChange={(id) => setSetting("ruling", id)} options={RULINGS.map((r) => ({ id: r.id, label: r.short ?? r.label, Icon: RULING_ICONS[r.id] }))} />
          <Propis2Picker label="Косая линейка" caption="Наклон" value={slantValue} disabled={locked || !SLANT_PAPERS.has(gridKind)} mixed={mx.grid} onChange={(id) => setSetting("grid", id)} options={GRIDS.filter((g) => propisGrid || g.id !== "dense").map((g) => ({ id: g.id, label: g.short, Icon: SLANT_ICONS[g.id] }))} />
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
  </>;
  const rowEls = <>
          <Propis2Picker label="Повтор" caption="Образец" value={rowOpts ? repeatChoice(rowOpts) : "all"} disabled={!rowEditable} mixed={rowMixed.repeat} onChange={(id) => setRowSetting("repeat", id)} options={REPEAT_OPTS} />
          <Propis2Picker label="Красные точки" caption="Точки" value={rowOpts?.dots ?? "all"} disabled={!rowEditable} mixed={rowMixed.dots} onChange={(id) => setRowSetting("dots", id)} options={DOT_OPTS} />
          <ElementPicker elements={elementTiles} disabled={locked && !selected} onInsert={(text) => { insertElement(text); }} />
          <IconBtn label="Строка как текст (с переносом)" caption="Текст" on={selected ? selected.kind === "passage" : undefined} disabled={locked || !selected || selected.kind === "blank"} onClick={() => setRowAsText(selected.kind !== "passage")}><I.IconTabText /></IconBtn>
          <span className="p2-sep" aria-hidden="true" />
          <div className="p2-seg" role="group" aria-label="Строка">
            <IconBtn label="Выше" caption="Выше" onClick={() => setRows(moveRow(page.rows, selectedIndex, -1))} disabled={!selected || selectedIndex === 0}><I.IconUp /></IconBtn>
            <IconBtn label="Ниже" caption="Ниже" onClick={() => setRows(moveRow(page.rows, selectedIndex, 1))} disabled={!selected || selectedIndex === page.rows.length - 1}><I.IconDown /></IconBtn>
            <IconBtn label="Дублировать" caption="Дубль" disabled={!selected} onClick={() => { const next = duplicateRow(page.rows, selectedIndex); setRows(next); setSelectedId(next[selectedIndex + 1].id); }}><I.IconDuplicate /></IconBtn>
            <IconBtn label="Удалить строку" caption="Удалить" className="p2-ib--danger" disabled={!selected} onClick={() => { setRows(page.rows.filter((r) => r.id !== selectedId)); setSelectedId(null); }}><I.IconTrash /></IconBtn>
          </div>
  </>;
  // the canvas zoom (useCanvasZoom.js): − / the share / + / «По ширине»; the share brings the whole page back
  // `withHistory`: undo / redo in the same row as the zoom (phones / tablets, owner 2026-10-24: hides nothing there); the desk
  // layout has them in its tool bar
  const zoomEl = (withHistory = false) => (
        <div className="p2-zoom" role="group" aria-label="Масштаб страницы">
          {withHistory && onUndo && (
            <>
              <button type="button" className="p2-zoom-btn" onClick={onUndo} disabled={!canUndo} aria-label="Отменить" title="Отменить"><I.IconUndo /></button>
              <button type="button" className="p2-zoom-btn" onClick={onRedo} disabled={!canRedo} aria-label="Вернуть" title="Вернуть"><I.IconRedo /></button>
              <span className="p2-zoom-sep" aria-hidden="true" />
            </>
          )}
          <button type="button" className="p2-zoom-btn" onClick={zoom.zoomOut} disabled={zoom.z <= 1.001} aria-label="Уменьшить" title="Уменьшить (Ctrl + колесо)">−</button>
          <button type="button" className="p2-zoom-btn p2-zoom-pct" onClick={zoom.fit} disabled={zoom.z <= 1.001} aria-label="Вписать страницу" title="Вписать страницу целиком">{Math.round(zoom.z * 100)}%</button>
          <button type="button" className="p2-zoom-btn" onClick={zoom.zoomIn} disabled={zoom.z >= zoom.maxZ - 0.001} aria-label="Увеличить" title="Увеличить (Ctrl + колесо)">+</button>
          {zoom.canWidth && <button type="button" className={`p2-zoom-btn p2-zoom-width${Math.abs(zoom.z - zoom.widthZ) < 0.01 ? " is-on" : ""}`} onClick={zoom.toWidth} aria-label="По ширине" title="Страница по ширине"><I.IconFitWidth /></button>}
        </div>
  );
  const canvasEl = (
        <div className={`propis2-page-col${zoom.z > 1.001 ? " is-zoomed" : ""}`} ref={wrapRef} onClick={onPageClick}>
          <div className="propis2-page-box" ref={boxRef} style={pageW ? { width: Math.round(pageW * zoom.z) } : undefined}>
            <Propis2Preview page={page} topicRecord={topicRecord} overlays={overlays} onSheetPoint={onSheetPoint} onPageIndexChange={(i) => { pageIndexRef.current = i; }} />
          </div>
        </div>
  );
  const rowOffer = offer?.scope === "rows";
  const applyRowOffer = () => {
    const ids = new Set(offer.ids);
    const patch = ROW_PATCH[offer.key](offer.value);
    setRows(page.rows.map((r) => (ids.has(r.id) ? { ...r, ...patch } : r)));
    showOffer({ ...offer, done: true }, OFFER_MS - 1000);
  };
  const offerEl = offer && (rowOffer || notebook) && (
          <div className="p2-offer" role="status" data-testid="propis2-offer">
            <span className="p2-offer-msg">{rowOffer
              ? `${ROW_SAYS[offer.key](offer.value)} — ${offer.done ? `ещё на ${onRows(offer.ids.length)} ниже` : `на строке ${offer.row}`}`
              : `${SETTING_SAYS[offer.key](offer.value)} — ${offer.done ? `на всех ${notebook.total} страницах` : `на стр. ${(nav?.index ?? 0) + 1}`}`}</span>
            {offer.done
              ? <button type="button" className="p2-offer-btn p2-offer-btn--ghost" onClick={() => { showOffer(null); onUndo?.(); }}>Отменить</button>
              : rowOffer
                ? <button type="button" className="p2-offer-btn" onClick={applyRowOffer}><I.IconSpread />На следующие строки</button>
                : <button type="button" className="p2-offer-btn" onClick={() => { notebook.applyAll(offer.key, offer.value); showOffer({ ...offer, done: true }, OFFER_MS - 1000); }}><I.IconSpread />На всю тетрадь</button>}
            <span className="p2-offer-timer" aria-hidden="true" key={offer.done ? "done" : "offer"}><i style={{ animationDuration: `${offer.done ? OFFER_MS - 1000 : OFFER_MS}ms` }} /></span>
          </div>
  );
  const keysEl = (
          <Propis2Keys inputRef={keysRef} value={draft} onChange={(v, pos) => { setSel({ start: pos, end: pos }); onField(v, true); }} onSelect={onKeysSelect} onFocusChange={setTyping} onUndo={onUndo} onRedo={onRedo} request={caretRequest} readOnly={locked && !selected} />
  );

  if (side) {
    // The computer layout (owner, 2026-10-23, «вариант Б»): one tool bar across the screen — undo / redo, the page's paper, the row's
    // tools, the zoom — the notebook's pages as thumbnails on the left (a click opens one, the page's own actions under them), the
    // sheet in the middle, a status bar at the bottom (page, row, what Enter does, the problems).
    const rowNo = selectedIndex >= 0 ? owners.indexOf(selectedIndex) + 1 : 0;
    const kindName = !selected ? "" : selected.kind === "passage" ? "связный текст" : selected.kind === "blank" || !String(selected.text ?? "").trim() ? "пустая строка" : selected.kind === "element" ? "элемент" : "образец";
    return (
      <div className={`screen propis2-home propis2-editor2 propis2-editor2--desk${keyboard.open ? " propis2-editor2--kb" : ""}`} data-testid="propis2-editor" style={keyboard.open ? { "--p2-vvtop": `${keyboard.top}px`, "--p2-vvh": `${keyboard.height}px` } : undefined}>
        {headerEl}
        <div className="p2-desk-bar" role="toolbar" aria-label="Инструменты">
          {onUndo && (
            <>
              <button type="button" className="p2-ib p2-tool" onClick={onUndo} disabled={!canUndo} aria-label="Отменить" title="Отменить (Ctrl+Z)"><span className="p2-tool-ico"><I.IconUndo /></span><span className="p2-cap">Отменить</span></button>
              <button type="button" className="p2-ib p2-tool" onClick={onRedo} disabled={!canRedo} aria-label="Вернуть" title="Вернуть (Ctrl+Y)"><span className="p2-tool-ico"><I.IconRedo /></span><span className="p2-cap">Вернуть</span></button>
              <span className="p2-sep" aria-hidden="true" />
            </>
          )}
          <div className="p2-desk-group" role="group" aria-label="Настройки страницы">{paperEls}</div>
          <span className="p2-sep" aria-hidden="true" />
          <div className="p2-desk-group p2-desk-group--row" role="group" aria-label="Настройки строки">{rowEls}</div>
          <span className="p2-desk-fill" />
          {zoomEl()}
        </div>
        <div className="p2-desk-body">
          {nav && <Propis2Thumbs nav={nav} live={page} topicRecord={topicRecord} glyphMap={glyphMap} />}
          <div className="p2-desk-canvas">
            {canvasEl}
            {offerEl}
          </div>
        </div>
        <div className="p2-status" role="status">
          {nav && <span>Стр. <b>{nav.index + 1}</b> из {nav.total}</span>}
          {rowNo > 0 && <span>Строка <b>{rowNo}</b>{kindName ? ` · ${kindName}` : ""}</span>}
          <span className="p2-status-hint">{typing ? "Enter — новая строка · слово — образец, фраза с пробелами — связный текст · Ctrl+Z — отменить" : "Щёлкните по строке листа и печатайте"}</span>
          {locked && <span>Страница закрыта: правится выбранная строка, «Править» откроет всю</span>}
          <span className="p2-desk-fill" />
          {warnsEl}
        </div>
        {keysEl}
      </div>
    );
  }

  return (
    <div className={`screen propis2-home propis2-editor2${phone ? " propis2-editor2--phone" : ""}${keyboard.open ? " propis2-editor2--kb" : ""}`} data-testid="propis2-editor" style={keyboard.open ? { "--p2-vvtop": `${keyboard.top}px`, "--p2-vvh": `${keyboard.height}px` } : undefined}>
      {headerEl}

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
          {paperEls}
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
          {rowEls}
        </div>

        {offerEl}
        {zoomEl(true)}
        {canvasEl}

        <div className="propis2-dock propis2-dock--keys">
          {warnsEl}
          {/* with the keyboard open (or typing on a phone / portrait tablet: Android shrinks the window itself) the hint gives its room to the page */}
          {!keyboard.open && !typing && <p className="p2-keys-hint" data-testid="propis2-keys-hint">
            {typing
              ? "Enter — новая строка. Слово — образец, фраза с пробелами — связный текст. Элементы — кнопкой «Элемент»."
              : "Нажмите на строку листа и печатайте: буквы встают прямо на строку."}
          </p>}
          {keysEl}
        </div>
      </div>
    </div>
  );
}
