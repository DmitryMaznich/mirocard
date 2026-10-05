import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import Button from "@/shared/components/Button";

function dateLabel(ts) {
  try { return new Date(ts).toLocaleDateString("ru-RU"); } catch { return ""; }
}

// «Мои страницы»: the home of the topic. Create from scratch or from a ready sheet, open as the
// student sees it, edit, duplicate, delete.
export default function Propis2Library({ pages, sets = [], presets = { builtin: [], mine: [] }, onBack, onNew, onFromPreset, onDeletePreset, onOpen, onEdit, onDuplicate, onDelete, onNewSet, onOpenSet, onEditSet, onDuplicateSet, onDeleteSet }) {
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
        <div className="propis2-actions">
          <Button onClick={onNewSet}>+ Новый комплект</Button>
        </div>
        <label className="propis2-field">
          Из комплекта
          <select defaultValue="" onChange={(e) => { if (e.target.value) { onFromPreset(e.target.value); e.target.value = ""; } }} aria-label="Готовый набор">
            <option value="">— выбрать комплект —</option>
            {presets.builtin.length > 0 && <optgroup label="Методика">{presets.builtin.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</optgroup>}
            {presets.mine.length > 0 && <optgroup label="Мои">{presets.mine.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</optgroup>}
          </select>
        </label>
        {presets.mine.length > 0 && (
          <ul className="propis2-pages" aria-label="Мои комплекты (шаблоны)">
            {presets.mine.map((p) => (
              <li key={p.id} className="propis2-page-card">
                <div className="propis2-page-title">{p.title}</div>
                <div className="propis2-actions"><button type="button" className="propis2-link" onClick={() => onDeletePreset?.(p.id)}>Удалить комплект</button></div>
              </li>
            ))}
          </ul>
        )}
        {sets.length > 0 && (
          <>
            <h2 className="propis2-h2">Комплекты</h2>
            <ul className="propis2-pages">
              {sets.map((st) => (
                <li key={st.id} className="propis2-page-card" data-testid="propis2-set-card">
                  <div className="propis2-page-title">{st.title || "Без названия"}</div>
                  <div className="propis2-page-meta">{st.pageIds.length} стр. · {dateLabel(st.updatedAt)}</div>
                  <div className="propis2-actions">
                    <Button onClick={() => onOpenSet(st.id)}>Открыть</Button>
                    {!st.kit && <Button onClick={() => onEditSet(st.id)}>Изменить</Button>}
                    <button type="button" className="propis2-link" onClick={() => onDuplicateSet(st.id)}>Копия</button>
                    <button type="button" className="propis2-link" onClick={() => onDeleteSet(st.id)}>Удалить</button>
                  </div>
                </li>
              ))}
            </ul>
            <h2 className="propis2-h2">Страницы</h2>
          </>
        )}
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
