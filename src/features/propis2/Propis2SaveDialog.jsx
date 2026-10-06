import { useEffect, useRef, useState } from "react";

// The confirmation of what is kept. Nothing reaches «Мои тетради» without it:
//   mode "leave": the adult is leaving a notebook that has unsaved changes (save / not save / stay)
//   mode "save":  the save button on a notebook that is not in the list yet (asks the name)
// A notebook that is new always gets its name asked here, so the list does not fill with «Новая тетрадь».
export default function Propis2SaveDialog({ mode, isNew, defaultName = "", onSave, onDiscard, onStay }) {
  const [name, setName] = useState(defaultName);
  const input = useRef(null);
  useEffect(() => { if (isNew) input.current?.select(); }, [isNew]);
  const clean = name.trim();
  const canSave = !isNew || clean.length > 0;
  const title = mode === "save"
    ? "Сохранить тетрадь"
    : isNew ? "Сохранить новую тетрадь?" : "Сохранить изменения в тетради?";
  return (
    <div className="p2-modal" role="dialog" aria-modal="true" aria-label={title} data-testid="propis2-save-dialog">
      <div className="p2-modal-card">
        <h2 className="p2-modal-title">{title}</h2>
        {isNew ? (
          <label className="p2-modal-field">
            Название тетради
            <input ref={input} value={name} onChange={(e) => setName(e.target.value)} aria-label="Название тетради" onKeyDown={(e) => { if (e.key === "Enter" && canSave) onSave(clean); }} />
          </label>
        ) : (
          <p className="p2-modal-text">«{defaultName}»</p>
        )}
        <div className="p2-modal-actions">
          <button type="button" className="p2-modal-btn p2-modal-btn--primary" disabled={!canSave} onClick={() => onSave(isNew ? clean : undefined)}>Сохранить</button>
          {mode === "leave" && <button type="button" className="p2-modal-btn p2-modal-btn--danger" onClick={onDiscard}>Не сохранять</button>}
          <button type="button" className="p2-modal-btn" onClick={onStay}>{mode === "leave" ? "Остаться" : "Отмена"}</button>
        </div>
      </div>
    </div>
  );
}
