import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { ROW_KINDS, ROW_MARKS, RULINGS, analyzePage, duplicateRow, moveRow, newRow } from "@/topics/renderers/propis2/model.js";
import { buildGlyphMap, listElementChoices } from "@/topics/renderers/propis2/pageTask.js";

// The page constructor: title, ruling, rows (kind / text-or-element / mark), live warnings.
// The page is saved by the parent on every change (autosave); nothing is ever dropped silently.
export default function Propis2Editor({ page, topicRecord, onChange, onBack, onShow }) {
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const elementChoices = useMemo(() => listElementChoices(topicRecord), [topicRecord]);
  const analysis = useMemo(() => analyzePage(page, glyphMap), [page, glyphMap]);
  const focusRef = useRef(null);
  const [focusIndex, setFocusIndex] = useState(null);

  useEffect(() => {
    if (focusIndex == null) return;
    focusRef.current?.querySelector?.(`[data-row="${focusIndex}"] input, [data-row="${focusIndex}"] select`)?.focus();
    setFocusIndex(null);
  }, [focusIndex, page.rows.length]);

  const setRows = (rows) => onChange({ ...page, rows: rows.length ? rows : [newRow()] });
  const patchRow = (i, patch) => setRows(page.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const addRow = () => { setRows([...page.rows, newRow()]); setFocusIndex(page.rows.length); };

  return (
    <div className="screen propis2-home" data-testid="propis2-editor">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}><BackArrowIcon /></button>
        <h1 className="screen-title">Страница</h1>
      </div>
      <div className="propis2-body">
        <label className="propis2-field">
          Название
          <input value={page.title} onChange={(e) => onChange({ ...page, title: e.target.value })} aria-label="Название страницы" />
        </label>
        <label className="propis2-field">
          Разлиновка
          <select value={page.ruling} onChange={(e) => onChange({ ...page, ruling: e.target.value })} aria-label="Разлиновка">
            {RULINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>

        <ol className="propis2-rows" ref={focusRef}>
          {page.rows.map((row, i) => {
            const a = analysis.rows[i];
            return (
              <li key={row.id} data-row={i} className="propis2-row">
                <div className="propis2-row-main">
                  <select value={row.kind} onChange={(e) => patchRow(i, { kind: e.target.value, text: "" })} aria-label={`Тип строки ${i + 1}`}>
                    {ROW_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                  </select>
                  {row.kind === "element" ? (
                    <select value={row.text} onChange={(e) => patchRow(i, { text: e.target.value })} aria-label={`Элемент строки ${i + 1}`}>
                      <option value="">— выберите элемент —</option>
                      {elementChoices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  ) : (
                    <input value={row.text} onChange={(e) => patchRow(i, { text: e.target.value })} placeholder="буква, слог, слово…" aria-label={`Содержимое строки ${i + 1}`} />
                  )}
                  <select value={row.mark} onChange={(e) => patchRow(i, { mark: e.target.value })} aria-label={`Вид строки ${i + 1}`}>
                    {ROW_MARKS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                <div className="propis2-row-tools">
                  <button type="button" onClick={() => setRows(moveRow(page.rows, i, -1))} disabled={i === 0} aria-label="Выше">↑</button>
                  <button type="button" onClick={() => setRows(moveRow(page.rows, i, 1))} disabled={i === page.rows.length - 1} aria-label="Ниже">↓</button>
                  <button type="button" onClick={() => setRows(duplicateRow(page.rows, i))} aria-label="Дублировать">⧉</button>
                  <button type="button" onClick={() => setRows(page.rows.filter((_, k) => k !== i))} aria-label="Удалить строку">✕</button>
                </div>
                {a?.unsupported.length > 0 && (
                  <div className="propis2-warn" role="alert">Нет начертания для: {a.unsupported.map((c) => `«${c}»`).join(" ")} — эти символы не попадут на страницу.</div>
                )}
                {a?.overflow && (
                  <div className="propis2-warn" role="alert">Строка не помещается по ширине — её конец будет обрезан. Сократите или разбейте на две строки.</div>
                )}
              </li>
            );
          })}
        </ol>

        {analysis.problems > 0 && <div className="propis2-warn propis2-warn--summary">Строк с проблемами: {analysis.problems}</div>}
        <div className="propis2-actions">
          <Button onClick={addRow}>+ Строка</Button>
          <Button onClick={onShow}>Показать как ученику</Button>
        </div>
      </div>
    </div>
  );
}
