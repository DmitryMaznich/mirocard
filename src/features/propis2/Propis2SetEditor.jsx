import { useMemo } from "react";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { RULINGS, moveRow, setPageStarts } from "@/topics/renderers/propis2/model.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";

// Set («комплект») editor: title, ruling for the whole set, the ordered pages. Pages are picked from
// the library; the same page can appear more than once, "дублировать" makes an independent copy.
export default function Propis2SetEditor({ set, pages, topicRecord, onChange, onBack, onShow, onDuplicatePage, onEditPage }) {
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const starts = useMemo(() => setPageStarts(set, byId, glyphMap), [set, byId, glyphMap]);
  const setIds = (pageIds) => onChange({ ...set, pageIds });
  const move = (i, d) => setIds(moveRow(set.pageIds.map((id) => ({ id })), i, d).map((r) => r.id));

  return (
    <div className="screen propis2-home" data-testid="propis2-set-editor">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}><BackArrowIcon /></button>
        <h1 className="screen-title">Комплект</h1>
      </div>
      <div className="propis2-body">
        <label className="propis2-field">
          Название
          <input value={set.title} onChange={(e) => onChange({ ...set, title: e.target.value })} aria-label="Название комплекта" />
        </label>
        <label className="propis2-field">
          Разлиновка всего комплекта
          <select value={set.ruling} onChange={(e) => onChange({ ...set, ruling: e.target.value })} aria-label="Разлиновка комплекта">
            {RULINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>

        <ol className="propis2-rows">
          {set.pageIds.map((id, i) => {
            const p = byId.get(id);
            return (
              <li key={`${id}-${i}`} className="propis2-row" data-testid="propis2-set-page">
                <div className="propis2-row-main">
                  <strong>{p ? (p.title || "Без названия") : "Страница удалена"}</strong>
                  {starts[i] != null && <span className="propis2-page-meta">с листа {starts[i]}</span>}
                </div>
                <div className="propis2-row-tools">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Страницу выше">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === set.pageIds.length - 1} aria-label="Страницу ниже">↓</button>
                  {p && <button type="button" onClick={() => onEditPage(id)} aria-label="Изменить страницу">✎</button>}
                  {p && <button type="button" onClick={() => onDuplicatePage(id, i)} aria-label="Дублировать страницу">⧉</button>}
                  <button type="button" onClick={() => setIds(set.pageIds.filter((_, k) => k !== i))} aria-label="Убрать страницу из комплекта">✕</button>
                </div>
              </li>
            );
          })}
        </ol>

        {set.pageIds.length === 0 && <p className="propis2-empty">В комплекте пока нет страниц.</p>}
        <label className="propis2-field">
          Добавить страницу
          <select value="" onChange={(e) => e.target.value && setIds([...set.pageIds, e.target.value])} aria-label="Добавить страницу в комплект">
            <option value="">— выбрать из моих страниц —</option>
            {pages.map((p) => <option key={p.id} value={p.id}>{p.title || "Без названия"}</option>)}
          </select>
        </label>
        <div className="propis2-actions">
          <Button onClick={onShow} disabled={set.pageIds.filter((id) => byId.get(id)).length === 0}>Показать комплект как ученику</Button>
        </div>
      </div>
    </div>
  );
}
