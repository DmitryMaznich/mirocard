import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { rowAtSvgY } from "@/topics/renderers/propis/PrintPageView";
import { PRINT_PAGE_H_MM, PRINT_PAGE_W_MM } from "@/topics/renderers/propis/propisRuling.js";
import { GRIDS, GRID_KINDS, ROWS_PER_PAGE, ROW_MARKS, RULINGS, analyzePage, appendTile, duplicateRow, lineOwners, moveRow, newRow, pageGridKind, selectRowAt, tapSymbol } from "@/topics/renderers/propis2/model.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import Propis2Carousel from "./Propis2Carousel";
import Propis2Preview from "./Propis2Preview";

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

const TABS = [
  { id: "symbol", label: "Символ" },
  { id: "word", label: "Слово" },
  { id: "text", label: "Текст" },
];

export default function Propis2Editor({ page, topicRecord, onChange, onBack, onShow, onFromMarked }) {
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const analysis = useMemo(() => analyzePage(page, glyphMap), [page, glyphMap]);
  const owners = useMemo(() => lineOwners(page, glyphMap), [page, glyphMap]);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("symbol");
  const [draftWord, setDraftWord] = useState("");
  const [draftText, setDraftText] = useState("");
  const [pageW, setPageW] = useState(0);
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
    const result = selectRowAt(page, glyphMap, abs);
    if (result.page !== page) onChange(result.page);
    setSelectedId(result.rowId);
  };

  const applyResult = (result) => {
    onChange(result.page);
    setSelectedId(result.rowId);
  };
  const tapTile = (tile) => applyResult(tapSymbol(page, glyphMap, selectedId, tile));

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

  useEffect(() => { if (selectedId && selectedIndex < 0) setSelectedId(null); }, [selectedId, selectedIndex]);

  return (
    <div className={`screen propis2-home propis2-editor2${side ? " propis2-editor2--side" : ""}${phone ? " propis2-editor2--phone" : ""}`} data-testid="propis2-editor">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}><BackArrowIcon /></button>
        <input className="propis2-title-input" value={page.title} onChange={(e) => onChange({ ...page, title: e.target.value })} aria-label="Название страницы" />
        <Button onClick={onShow}>Показать ученику</Button>
      </div>

      <div className="propis2-main">
        <div className="propis2-settings" role="group" aria-label="Настройки страницы">
          <div className="propis2-seg" role="group" aria-label="Тип сетки">
            {GRID_KINDS.map((g) => (
              <button key={g.id} type="button" aria-pressed={gridKind === g.id} className={gridKind === g.id ? "is-on" : ""} onClick={() => onChange({ ...page, gridKind: g.id })}>{g.label}</button>
            ))}
          </div>
          <div className="propis2-seg" role="group" aria-label="Разлиновка">
            {RULINGS.map((r) => (
              <button key={r.id} type="button" aria-pressed={page.ruling === r.id} className={page.ruling === r.id ? "is-on" : ""} onClick={() => onChange({ ...page, ruling: r.id })} title={r.label}>{r.short ?? r.label}</button>
            ))}
          </div>
          <div className="propis2-seg" role="group" aria-label="Косая линейка">
            {GRIDS.map((g) => (
              <button key={g.id} type="button" disabled={!propisGrid} aria-pressed={(page.grid ?? "regular") === g.id} className={(page.grid ?? "regular") === g.id ? "is-on" : ""} onClick={() => onChange({ ...page, grid: g.id })} title={g.label}>{g.short}</button>
            ))}
          </div>
          <label className={`propis2-writeafter${propisGrid ? "" : " is-disabled"}`}>
            <input type="checkbox" disabled={!propisGrid} checked={page.midDash !== false} onChange={(e) => onChange({ ...page, midDash: e.target.checked })} aria-label="Пунктир в серединных линиях" />
            пунктир
          </label>
          <label className="propis2-writeafter">
            <input type="checkbox" checked={Boolean(page.writeAfter)} onChange={(e) => onChange({ ...page, writeAfter: e.target.checked })} aria-label="Строка для письма после каждой строки" />
            писать под каждой строкой
          </label>
          <Button onClick={onFromMarked} disabled={markedCount === 0}>Из отмеченного{markedCount ? ` (${markedCount})` : ""}</Button>
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
              {selected.kind === "blank" ? (
                <span className="propis2-blank-note">Пустая строка — место для письма</span>
              ) : selected.kind === "passage" ? (
                <textarea value={selected.text} rows={2} onChange={(e) => patchSelected({ text: e.target.value })} placeholder="Текст — будет разбит на строки по ширине листа" aria-label="Текст строки" />
              ) : (
                <input value={selected.text} onChange={(e) => patchSelected({ text: e.target.value })} placeholder="нажмите на символы ниже или наберите" aria-label="Текст строки" />
              )}
              {selected.kind === "text" && (
                <button type="button" className="propis2-backspace" onClick={() => patchSelected({ text: Array.from(selected.text).slice(0, -1).join("") })} disabled={!selected.text} aria-label="Стереть последний символ">⌫</button>
              )}
              {(selected.kind === "text" || selected.kind === "element") && (
                <div className="propis2-seg" role="group" aria-label="Вид строки">
                  {ROW_MARKS.map((m) => (
                    <button key={m.id} type="button" aria-pressed={selected.mark === m.id} className={selected.mark === m.id ? "is-on" : ""} onClick={() => patchSelected({ mark: m.id })} title={m.label}>{m.short ?? m.label}</button>
                  ))}
                </div>
              )}
              <label className="propis2-mark" title="Отметить строку для повторения">
                <input type="checkbox" checked={Boolean(selected.marked)} onChange={(e) => patchSelected({ marked: e.target.checked })} aria-label="Повторить строку" /> повторить
              </label>
              <span className="propis2-row-tools">
                <button type="button" onClick={() => setRows(moveRow(page.rows, selectedIndex, -1))} disabled={selectedIndex === 0} aria-label="Выше">↑</button>
                <button type="button" onClick={() => setRows(moveRow(page.rows, selectedIndex, 1))} disabled={selectedIndex === page.rows.length - 1} aria-label="Ниже">↓</button>
                <button type="button" onClick={() => { const next = duplicateRow(page.rows, selectedIndex); setRows(next); setSelectedId(next[selectedIndex + 1].id); }} aria-label="Дублировать">⧉</button>
                <button type="button" onClick={() => { setRows(page.rows.filter((r) => r.id !== selectedId)); setSelectedId(null); }} aria-label="Удалить строку">✕</button>
              </span>
              {selectedInfo?.unsupported.length > 0 && (
                <div className="propis2-warn" role="alert">Нет начертания для: {selectedInfo.unsupported.map((c) => `«${c}»`).join(" ")} — эти символы не попадут на страницу.</div>
              )}
              {selectedInfo?.outside?.length > 0 && (
                <div className="propis2-warn" role="alert">На широкой строке нельзя: {selectedInfo.outside.map((c) => `«${c}»`).join(" ")} — эти знаки выходят за строку. Переключите на узкую или замените.</div>
              )}
              {selectedInfo?.overflow && (
                <div className="propis2-warn" role="alert">Строка не помещается по ширине — её конец будет обрезан. Сократите или разбейте на две строки.</div>
              )}
            </div>
          ) : (
            <p className="propis2-hint">Нажмите на строку страницы и затем на символ: он попадёт в эту строку. Без выбранной строки символ начнёт новую.</p>
          )}
          {analysis.problems > 0 && <div className="propis2-warn propis2-warn--summary">Строк с проблемами: {analysis.problems} (подсвечены красным)</div>}
          </div>

          <div className="propis2-tabs" role="tablist" aria-label="Что поставить на страницу">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`propis2-tab${tab === t.id ? " is-on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <div className="propis2-dock-body">
          {tab === "symbol" && <Propis2Carousel topicRecord={topicRecord} onTap={tapTile} ruling={page.ruling} />}

          {tab === "word" && (
            <div className="propis2-typed" data-testid="propis2-tab-word">
              <input value={draftWord} onChange={(e) => setDraftWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTyped("text", draftWord, setDraftWord); }} placeholder="слог или слово: ма, мама, шар…" aria-label="Слово или слог" />
              <Button onClick={() => addTyped("text", draftWord, setDraftWord)} disabled={!draftWord.trim()}>+ Строка</Button>
              <Button onClick={() => addRow({ kind: "blank" })}>+ Пустая строка</Button>
            </div>
          )}

          {tab === "text" && (
            <div className="propis2-typed" data-testid="propis2-tab-text">
              <textarea value={draftText} rows={2} onChange={(e) => setDraftText(e.target.value)} placeholder="Текст целиком: он разобьётся по строкам листа" aria-label="Текст для страницы" />
              <Button onClick={() => addTyped("passage", draftText, setDraftText)} disabled={!draftText.trim()}>+ Текст</Button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
