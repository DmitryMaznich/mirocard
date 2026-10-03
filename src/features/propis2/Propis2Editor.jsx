import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { rowAtSvgY } from "@/topics/renderers/propis/PrintPageView";
import { PRINT_PAGE_H_MM, PRINT_PAGE_W_MM } from "@/topics/renderers/propis/propisRuling.js";
import { GRIDS, ROWS_PER_PAGE, ROW_MARKS, RULINGS, analyzePage, appendTile, dropTile, duplicateRow, lineOwners, moveRow, newRow } from "@/topics/renderers/propis2/model.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import Propis2Carousel, { TileGlyph } from "./Propis2Carousel";
import Propis2Preview from "./Propis2Preview";

// The page constructor. Top: the page canvas, as wide as the screen allows (it may scroll a little, never
// more than ~20% of its height). Above it one line of settings. Below it tabs: «Символ» (a horizontal,
// endless carousel of letters and elements), «Слово» and «Текст» (typed, then dragged or added). Anything
// from the tabs is dragged up onto the row it should stand on, or tapped (it goes below the last row).
// Tapping a row selects it; its bar edits text, kind of row, repeat. The page is saved by the parent on
// every change; nothing is ever dropped silently.
const PAGE_ASPECT = PRINT_PAGE_W_MM / PRINT_PAGE_H_MM;
const MAX_OVERFLOW = 1.2; // portrait: the page may be this much taller than the room for it (a little scroll)

// Landscape tablet and wider: the page takes the whole height on the left, all tools sit in a side panel.
const SIDE_QUERY = "(min-width: 900px) and (min-aspect-ratio: 1/1)";
function useSideLayout() {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(SIDE_QUERY).matches : false);
  const [side, setSide] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(SIDE_QUERY);
    const on = () => setSide(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return side;
}
const EDGE = 56; // px from the canvas edge where dragging auto-scrolls it

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
  const [dropRow, setDropRow] = useState(-1);
  const [ghost, setGhost] = useState(null); // { tile, x, y }
  const [tab, setTab] = useState("symbol");
  const [draftWord, setDraftWord] = useState("");
  const [draftText, setDraftText] = useState("");
  const [pageW, setPageW] = useState(0);
  const side = useSideLayout();
  const sideRef = useRef(side);
  sideRef.current = side;
  const wrapRef = useRef(null);
  const pageIndexRef = useRef(0);
  const latest = useRef({ page, glyphMap });
  latest.current = { page, glyphMap };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // The page's width: the canvas width, but not so wide that the page is more than MAX_OVERFLOW times taller
  // than the room for it. Recomputed when the canvas resizes (rotation, dock height, keyboard).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setPageW(Math.floor(Math.min(w - 8, h * (sideRef.current ? 1 : MAX_OVERFLOW) * PAGE_ASPECT)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [side]);

  const selectedIndex = page.rows.findIndex((r) => r.id === selectedId);
  const selected = selectedIndex >= 0 ? page.rows[selectedIndex] : null;
  const selectedInfo = selectedIndex >= 0 ? analysis.rows[selectedIndex] : null;
  const markedCount = page.rows.filter((r) => r.marked).length;

  const setRows = (rows) => onChange({ ...page, rows: rows.length ? rows : [newRow()] });
  const patchSelected = (patch) => setRows(page.rows.map((r) => (r.id === selectedId ? { ...r, ...patch } : r)));

  // Which physical row (0-based over the whole page) is under a screen point; -1 if none.
  const rowAtPoint = useCallback((cx, cy) => {
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
  }, []);

  const applyDrop = useCallback((result) => {
    onChangeRef.current(result.page);
    setSelectedId(result.rowId);
  }, []);

  const startDrag = useCallback((tile, e) => {
    if (e.button != null && e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    const isMouse = e.pointerType === "mouse" || !e.pointerType;
    let dragging = false;
    let row = -1;
    let pointerY = start.y;
    let lastX = start.x;
    let timer = null;
    // near the top/bottom edge of the canvas the page scrolls by itself, so any row can be reached
    const autoScroll = () => {
      const col = wrapRef.current;
      if (!col || !dragging) return;
      const box = col.getBoundingClientRect();
      if (pointerY < box.top + EDGE) col.scrollTop -= 14;
      else if (pointerY > box.bottom - EDGE) col.scrollTop += 14;
      else return;
      row = rowAtPoint(lastX, pointerY);
      setDropRow(row);
    };
    const move = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!dragging) {
        // touch: the move that is not the carousel's own scroll starts the drag (portrait: the strip scrolls
        // sideways, so a vertical move drags; side panel: the grid scrolls vertically, so a sideways move
        // drags); mouse: any move
        const go = isMouse ? Math.hypot(dx, dy) > 5
          : sideRef.current ? Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)
          : Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx);
        if (!go) return;
        dragging = true;
        timer = setInterval(autoScroll, 30);
      }
      pointerY = ev.clientY;
      lastX = ev.clientX;
      ev.preventDefault?.();
      row = rowAtPoint(ev.clientX, ev.clientY);
      setDropRow(row);
      setGhost({ tile, x: ev.clientX, y: ev.clientY });
    };
    const end = (ev, cancelled) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      clearInterval(timer);
      setGhost(null);
      setDropRow(-1);
      if (cancelled) return;
      const { page: p, glyphMap: g } = latest.current;
      if (dragging) { if (row >= 0) applyDrop(dropTile(p, g, row, tile)); }
      else applyDrop(appendTile(p, g, tile));
    };
    const up = (ev) => end(ev, false);
    const cancel = (ev) => end(ev, true);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }, [rowAtPoint, applyDrop]);

  const tapTile = useCallback((tile) => applyDrop(appendTile(latest.current.page, latest.current.glyphMap, tile)), [applyDrop]);

  // Tap on the page: select the row under the finger (or clear the selection).
  const onPageClick = (e) => {
    const abs = rowAtPoint(e.clientX, e.clientY);
    const owner = abs >= 0 ? owners[abs] : null;
    setSelectedId(owner != null ? page.rows[owner]?.id ?? null : null);
  };

  const addRow = (patch) => {
    const row = newRow(patch);
    setRows([...page.rows.filter((r) => r.kind === "blank" || String(r.text ?? "").trim()), row]);
    setSelectedId(row.id);
  };

  // Overlays on the page: the selected row (blue), the row a tile is hovering over (green), problems (red).
  const overlays = useMemo(() => {
    const out = [];
    owners.forEach((o, abs) => {
      if (o == null) return;
      const info = analysis.rows[o];
      if (info && (info.unsupported.length || info.overflow)) out.push({ row: abs, tone: "warn" });
      if (page.rows[o]?.id === selectedId) out.push({ row: abs, tone: "select" });
    });
    if (dropRow >= 0) out.push({ row: dropRow, tone: "drop" });
    return out;
  }, [owners, analysis, page.rows, selectedId, dropRow]);

  useEffect(() => { if (selectedId && selectedIndex < 0) setSelectedId(null); }, [selectedId, selectedIndex]);

  const addTyped = (kind, text, setText) => {
    const value = text.trim();
    if (!value) return;
    applyDrop(appendTile(page, glyphMap, { kind, text: value }));
    setText("");
  };
  // typed tiles are dragged like carousel tiles; they are drawn as text
  const typedTile = (kind, text) => ({ key: kind, kind, text: text.trim(), caption: text.trim().slice(0, 24), strokes: [] });

  return (
    <div className={`screen propis2-home propis2-editor2${side ? " propis2-editor2--side" : ""}`} data-testid="propis2-editor">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}><BackArrowIcon /></button>
        <input className="propis2-title-input" value={page.title} onChange={(e) => onChange({ ...page, title: e.target.value })} aria-label="Название страницы" />
        <Button onClick={onShow}>Показать ученику</Button>
      </div>

      <div className="propis2-main">
      <div className="propis2-settings" role="group" aria-label="Настройки страницы">
        <div className="propis2-seg" role="group" aria-label="Разлиновка">
          {RULINGS.map((r) => (
            <button key={r.id} type="button" aria-pressed={page.ruling === r.id} className={page.ruling === r.id ? "is-on" : ""} onClick={() => onChange({ ...page, ruling: r.id })} title={r.label}>{r.short ?? r.label}</button>
          ))}
        </div>
        <div className="propis2-seg" role="group" aria-label="Линейка">
          {GRIDS.map((g) => (
            <button key={g.id} type="button" aria-pressed={(page.grid ?? "regular") === g.id} className={(page.grid ?? "regular") === g.id ? "is-on" : ""} onClick={() => onChange({ ...page, grid: g.id })} title={g.label}>{g.short}</button>
          ))}
        </div>
        <label className="propis2-writeafter">
          <input type="checkbox" checked={page.midDash !== false} onChange={(e) => onChange({ ...page, midDash: e.target.checked })} aria-label="Пунктир в серединных линиях" />
          пунктир
        </label>
        <label className="propis2-writeafter">
          <input type="checkbox" checked={Boolean(page.writeAfter)} onChange={(e) => onChange({ ...page, writeAfter: e.target.checked })} aria-label="Строка для письма после каждой строки" />
          писать под каждой строкой
        </label>
        <Button onClick={onFromMarked} disabled={markedCount === 0}>Из отмеченного{markedCount ? ` (${markedCount})` : ""}</Button>
        {analysis.problems > 0 && <span className="propis2-warn propis2-warn--summary">Строк с проблемами: {analysis.problems}</span>}
      </div>

      <div className="propis2-page-col" ref={wrapRef} onClick={onPageClick}>
        <div className="propis2-page-box" style={pageW ? { width: pageW } : undefined}>
          <Propis2Preview page={page} topicRecord={topicRecord} overlays={overlays} onPageIndexChange={(i) => { pageIndexRef.current = i; }} />
        </div>
      </div>

      <div className="propis2-dock">
        {selected && (
          <div className="propis2-dock-row" data-testid="propis2-row-panel">
            {selected.kind === "blank" ? (
              <span className="propis2-blank-note">Пустая строка — место для письма</span>
            ) : selected.kind === "passage" ? (
              <textarea value={selected.text} rows={2} onChange={(e) => patchSelected({ text: e.target.value })} placeholder="Текст — будет разбит на строки по ширине листа" aria-label="Текст строки" />
            ) : (
              <input value={selected.text} onChange={(e) => patchSelected({ text: e.target.value })} placeholder="буква, слог, слово…" aria-label="Текст строки" />
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
            {selectedInfo?.overflow && (
              <div className="propis2-warn" role="alert">Строка не помещается по ширине — её конец будет обрезан. Сократите или разбейте на две строки.</div>
            )}
          </div>
        )}

        <div className="propis2-tabs" role="tablist" aria-label="Что поставить на страницу">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`propis2-tab${tab === t.id ? " is-on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {tab === "symbol" && <Propis2Carousel topicRecord={topicRecord} onTap={tapTile} onDragStart={startDrag} side={side} />}

        {tab === "word" && (
          <div className="propis2-typed" data-testid="propis2-tab-word">
            <input value={draftWord} onChange={(e) => setDraftWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTyped("text", draftWord, setDraftWord); }} placeholder="слог или слово: ма, мама, шар…" aria-label="Слово или слог" />
            <Button onClick={() => addTyped("text", draftWord, setDraftWord)} disabled={!draftWord.trim()}>+ Строка</Button>
            {draftWord.trim() && (
              <button type="button" className="propis2-tile propis2-tile--typed" onPointerDown={(e) => startDrag(typedTile("text", draftWord), e)} onDragStart={(e) => e.preventDefault()} aria-label="Перетащите слово на строку">
                <TileGlyph tile={typedTile("text", draftWord)} size={52} />
              </button>
            )}
            <Button onClick={() => addRow({ kind: "blank" })}>+ Пустая строка</Button>
          </div>
        )}

        {tab === "text" && (
          <div className="propis2-typed" data-testid="propis2-tab-text">
            <textarea value={draftText} rows={2} onChange={(e) => setDraftText(e.target.value)} placeholder="Текст целиком: он разобьётся по строкам листа" aria-label="Текст для страницы" />
            <Button onClick={() => addTyped("passage", draftText, setDraftText)} disabled={!draftText.trim()}>+ Текст</Button>
            {draftText.trim() && (
              <button type="button" className="propis2-tile propis2-tile--typed" onPointerDown={(e) => startDrag(typedTile("passage", draftText), e)} onDragStart={(e) => e.preventDefault()} aria-label="Перетащите текст на строку">
                <TileGlyph tile={typedTile("passage", draftText)} size={52} />
              </button>
            )}
          </div>
        )}
      </div>

      </div>

      {ghost && (
        <div className="propis2-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true"><TileGlyph tile={ghost.tile} size={64} /></div>
      )}
    </div>
  );
}
