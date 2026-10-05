import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import Button from "@/shared/components/Button";

function dateLabel(ts) {
  try { return new Date(ts).toLocaleDateString("ru-RU"); } catch { return ""; }
}

// «Мои тетради»: the home of the topic. A notebook is the only thing the adult keeps: create one from scratch or from a ready one,
// open it as the student sees it, edit, rename, copy, delete.
export default function Propis2Library({ sets = [], presets = { builtin: [], mine: [] }, onBack, onNew, onFromPreset, onDeletePreset, onOpenSet, onEditSet, onRenameSet, onDuplicateSet, onDeleteSet }) {
  return (
    <div className="screen propis2-home" data-testid="propis2-library">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}><BackArrowIcon /></button>
        <h1 className="screen-title">Прописи 2</h1>
      </div>
      <div className="propis2-body">
        <div className="propis2-actions">
          <Button onClick={onNew}>+ Новая тетрадь</Button>
        </div>
        <label className="propis2-field">
          Из готовой тетради
          <select defaultValue="" onChange={(e) => { if (e.target.value) { onFromPreset(e.target.value); e.target.value = ""; } }} aria-label="Готовый набор">
            <option value="">— выбрать тетрадь —</option>
            {presets.builtin.length > 0 && <optgroup label="Методика">{presets.builtin.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</optgroup>}
            {presets.mine.length > 0 && <optgroup label="Мои">{presets.mine.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</optgroup>}
          </select>
        </label>
        {presets.mine.length > 0 && (
          <ul className="propis2-pages" aria-label="Мои готовые тетради (шаблоны)">
            {presets.mine.map((p) => (
              <li key={p.id} className="propis2-page-card">
                <div className="propis2-page-title">{p.title}</div>
                <div className="propis2-actions"><button type="button" className="propis2-link" onClick={() => onDeletePreset?.(p.id)}>Удалить шаблон</button></div>
              </li>
            ))}
          </ul>
        )}
        <h2 className="propis2-h2">Мои тетради</h2>
        {sets.length === 0 ? (
          <p className="propis2-empty">Тетрадей пока нет. Создайте новую или возьмите готовую.</p>
        ) : (
          <ul className="propis2-pages">
            {sets.map((st) => (
              <li key={st.id} className="propis2-page-card" data-testid="propis2-set-card">
                <div className="propis2-page-title">{st.title || "Без названия"}</div>
                <div className="propis2-page-meta">{st.pageIds.length} стр. · {dateLabel(st.updatedAt)}</div>
                <div className="propis2-actions">
                  <Button onClick={() => onOpenSet(st.id)}>Открыть</Button>
                  <Button onClick={() => onEditSet(st.id)}>Изменить</Button>
                  <button type="button" className="propis2-link" onClick={() => { const t = window.prompt("Название тетради", st.title ?? ""); if (t && t.trim()) onRenameSet(st.id, t.trim()); }}>Переименовать</button>
                  <button type="button" className="propis2-link" onClick={() => onDuplicateSet(st.id)}>Копия</button>
                  <button type="button" className="propis2-link" onClick={() => onDeleteSet(st.id)}>Удалить</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
