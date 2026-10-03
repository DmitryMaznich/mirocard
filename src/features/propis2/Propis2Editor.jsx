import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { rowAtSvgY } from "@/topics/renderers/propis/PrintPageView";
import { ROWS_PER_PAGE, ROW_MARKS, RULINGS, analyzePage, appendTile, dropTile, duplicateRow, lineOwners, moveRow, newRow } from "@/topics/renderers/propis2/model.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import Propis2Carousel, { TileGlyph } from "./Propis2Carousel";
import Propis2Preview from "./Propis2Preview";

// The page constructor: a vertical carousel of letters and elements on the left, the page on the right.
// A tile is dragged onto the row it should stand on (or tapped: it goes below the last row). Tapping a row
// selects it; its panel under the page edits text, kind of row, repeat. The page is saved by the parent
// on every change; nothing is ever dropped silently.
export default function Propis2Editor({ page, topicRecord, onChange, onBack, onShow, onFromMarked }) {
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const analysis = useMemo(() => analyzePage(page, glyphMap), [page, glyphMap]);
  const owners = useMemo(() => lineOwners(page, glyphMap), [page, glyphMap]);
  const [selectedId, setSelectedId] = useState(null);
  const [dropRow, setDropRow] = useState(-1);
  const [ghost, setGhost] = useState(null); // { tile, x, y }
  const wrapRef = useRef(null);
  const pageIndexRef = useRef(0);
  const latest = useRef({ page, glyphMap });
  latest.current = { page, glyphMap };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
    const move = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!dragging) {
        const go = isMouse ? Math.hypot(dx, dy) > 5 : Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
        if (!go) return;
        dragging = true;
      }
      ev.preventDefault?.();
      row = rowAtPoint(ev.clientX, ev.clientY);
      setDropRow(row);
      setGhost({ tile, x: ev.clientX, y: ev.clientY });
    };
    const end = (ev, cancelled) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
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

  return (
    <div className="screen propis2-home propis2-editor2" data-testid="propis2-editor">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}><BackArrowIcon /></button>
        <input className="propis2-title-input" value={page.title} onChange={(e) => onChange({ ...page, title: e.target.value })} aria-label="Название страницы" />
        <div className="propis2-seg" role="group" aria-label="Разлиновка">
          {RULINGS.map((r) => (
            <button key={r.id} type="button" aria-pressed={page.ruling === r.id} className={page.ruling === r.id ? "is-on" : ""} onClick={() => onChange({ ...page, ruling: r.id })} title={r.label}>{r.short ?? r.label}</button>
          ))}
        </div>
      </div>

      <div className="propis2-stage">
        <Propis2Carousel topicRecord={topicRecord} onTap={tapTile} onDragStart={startDrag} />
        <div className="propis2-page-col" ref={wrapRef} onClick={onPageClick}>
          <Propis2Preview page={page} topicRecord={topicRecord} overlays={overlays} onPageIndexChange={(i) => { pageIndexRef.current = i; }} />
        </div>
      </div>

      <div className="propis2-dock">
        {selected ? (
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
        ) : (
          <p className="propis2-hint">Перетащите букву или элемент слева на нужную строку. Нажмите на строку, чтобы изменить её.</p>
        )}
        {analysis.problems > 0 && <div className="propis2-warn propis2-warn--summary">Строк с проблемами: {analysis.problems} (подсвечены красным)</div>}
        <div className="propis2-actions">
          <Button onClick={() => addRow({ kind: "text" })}>+ Слово</Button>
          <Button onClick={() => addRow({ kind: "passage" })}>+ Текст</Button>
          <Button onClick={() => addRow({ kind: "blank" })}>+ Пустая</Button>
          <label className="propis2-field--inline propis2-writeafter">
            <input type="checkbox" checked={Boolean(page.writeAfter)} onChange={(e) => onChange({ ...page, writeAfter: e.target.checked })} aria-label="Строка для письма после каждой строки" />
            писать под каждой строкой
          </label>
          <Button onClick={onShow}>Показать ученику</Button>
          <Button onClick={onFromMarked} disabled={markedCount === 0}>Страница из отмеченного{markedCount ? ` (${markedCount})` : ""}</Button>
        </div>
      </div>

      {ghost && (
        <div className="propis2-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true"><TileGlyph tile={ghost.tile} size={64} /></div>
      )}
    </div>
  );
}
