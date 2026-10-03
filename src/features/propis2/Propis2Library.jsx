import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import Button from "@/shared/components/Button";
import { PROPIS2_SHEET_TITLES } from "@/topics/renderers/propis2/data.js";

function dateLabel(ts) {
  try { return new Date(ts).toLocaleDateString("ru-RU"); } catch { return ""; }
}

// «Мои страницы»: the home of the topic. Create from scratch or from a ready sheet, open as the
// student sees it, edit, duplicate, delete.
export default function Propis2Library({ pages, sheets, onBack, onNew, onFromSheet, onOpen, onEdit, onDuplicate, onDelete }) {
  const sheetIds = Object.keys(PROPIS2_SHEET_TITLES).filter((id) => sheets?.[id]);
  return (
    <div className="screen propis2-home" data-testid="propis2-library">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}><BackArrowIcon /></button>
        <h1 className="screen-title">Прописи 2</h1>
      </div>
      <div className="propis2-body">
        <div className="propis2-actions">
          <Button onClick={onNew}>+ Новая страница</Button>
        </div>
        <label className="propis2-field">
          Из готового набора
          <select defaultValue="" onChange={(e) => { if (e.target.value) { onFromSheet(e.target.value); e.target.value = ""; } }} aria-label="Готовый набор">
            <option value="">— выбрать набор —</option>
            {sheetIds.map((id) => <option key={id} value={id}>{PROPIS2_SHEET_TITLES[id]}</option>)}
          </select>
        </label>
        {pages.length === 0 ? (
          <p className="propis2-empty">Страниц пока нет. Создайте новую или возьмите готовый набор.</p>
        ) : (
          <ul className="propis2-pages">
            {pages.map((p) => (
              <li key={p.id} className="propis2-page-card" data-testid="propis2-page-card">
                <div className="propis2-page-title">{p.title || "Без названия"}</div>
                <div className="propis2-page-meta">{p.rows.filter((r) => String(r.text).trim()).length} строк · {dateLabel(p.updatedAt)}</div>
                <div className="propis2-actions">
                  <Button onClick={() => onOpen(p.id)}>Открыть</Button>
                  <Button onClick={() => onEdit(p.id)}>Изменить</Button>
                  <button type="button" className="propis2-link" onClick={() => onDuplicate(p.id)}>Копия</button>
                  <button type="button" className="propis2-link" onClick={() => onDelete(p.id)}>Удалить</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
