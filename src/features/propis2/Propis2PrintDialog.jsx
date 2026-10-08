import { useState } from "react";
import Propis2Cover, { COVERS } from "./Propis2Cover";

// Asked before a notebook is printed (owner, 2026-10-08): a cover or none (three designs, each shown as the cover itself, small) and
// page numbers (on by default). The choice is the notebook's: the screen remembers it for the next print.
export default function Propis2PrintDialog({ title, pages, initial, coverProps, onPrint, onCancel }) {
  const [cover, setCover] = useState(initial?.cover ?? "school");
  const [numbers, setNumbers] = useState(initial?.numbers ?? true);
  return (
    <div className="p2-modal" role="dialog" aria-modal="true" aria-label="Печать тетради" data-testid="propis2-print-dialog">
      <div className="p2-modal-card p2-print-card">
        <h2 className="p2-modal-title">Печать тетради</h2>
        <p className="p2-print-sub">«{title}» · {pages} стр.</p>
        <div className="p2-print-sec">Обложка</div>
        <div className="p2-print-covers" role="radiogroup" aria-label="Обложка">
          {COVERS.map((c) => (
            <button key={c.id} type="button" role="radio" aria-label={c.label} aria-checked={cover === c.id} className={`p2-print-cover${cover === c.id ? " is-on" : ""}`} onClick={() => setCover(c.id)}>
              <span className="p2-print-thumb">{c.id === "none" ? <span className="p2-print-none">—</span> : <Propis2Cover design={c.id} {...coverProps} />}</span>
              <span className="p2-print-label">{c.label}</span>
            </button>
          ))}
        </div>
        {cover !== "none" && <p className="p2-print-note">Обложка печатается первым листом, следом — пустой лист (её оборот при двусторонней печати).</p>}
        <label className="p2-print-switch">
          <input type="checkbox" checked={numbers} onChange={(e) => setNumbers(e.target.checked)} />
          <span className="p2-print-sw" aria-hidden="true" />
          Номера страниц
        </label>
        <p className="p2-print-note p2-print-note--sw">Внизу страницы, у внешнего края. Обложка без номера.</p>
        <div className="p2-modal-actions">
          <button type="button" className="p2-modal-btn p2-modal-btn--primary" onClick={() => onPrint({ cover, numbers })}>Печать</button>
          <button type="button" className="p2-modal-btn" onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
