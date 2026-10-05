import { useEffect, useRef, useState } from "react";
import * as I from "./Propis2Icons";
import { useHint } from "./Propis2Hint";

// The presets popover of the page tier: a text list in two groups («Методика» — built-in, «Мои» — saved by the adult)
// plus "save this page as a preset". Choosing a preset starts a NEW page from it (the current page is never overwritten).
export default function Propis2Presets({ builtin = [], mine = [], canSave, defaultName = "", onApply, onSave, onDeleteMine }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef(null);
  const { bind, tip } = useHint("Комплекты");
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const list = (items, deletable) => (
    <ul className="p2-presets-list">
      {items.map((p) => (
        <li key={p.id}>
          <button type="button" className="p2-presets-item" onClick={() => { setOpen(false); onApply(p); }}>{p.title}</button>
          {deletable && <button type="button" className="p2-presets-del" aria-label={`Удалить комплект ${p.title}`} onClick={() => onDeleteMine(p.id)}><I.IconTrash /></button>}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="p2-pick p2-presets" ref={ref}>
      <button type="button" className={`p2-ib p2-ib--plain${open ? " is-on" : ""}`} aria-label="Комплекты" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} {...bind}><I.IconPresets />{tip}</button>
      {open && (
        <div className="p2-presets-panel" role="dialog" aria-label="Комплекты">
          {builtin.length > 0 && <><h3>Методика</h3>{list(builtin, false)}</>}
          <h3>Мои</h3>
          {mine.length > 0 ? list(mine, true) : <p className="p2-presets-empty">Пока пусто</p>}
          <div className="p2-presets-save">
            <input value={name} placeholder={defaultName} onChange={(e) => setName(e.target.value)} aria-label="Название комплекта" />
            <button type="button" className="p2-ib p2-ib--primary" aria-label="Сохранить как комплект" disabled={!canSave} onClick={() => { onSave(name.trim() || defaultName); setName(""); setOpen(false); }}><I.IconSavePreset /></button>
          </div>
        </div>
      )}
    </div>
  );
}
