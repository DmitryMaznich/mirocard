import { useState } from "react";
import { bookletBlocked, bookletPageCount } from "./booklet";
import { loadOpts } from "./pdfOptions";



// «Тетрадь в PDF» — propis2's print dialog (Propis2PrintDialog), its markup and look, with this topic's
// options: a simple cover or none, «По порядку» / «Тетрадью» (А5 only, up to BOOKLET_MAX_PAGES pages),
// page numbers. The choice is remembered on this device.
export default function PdfDialog({ notebook, onSave, onCancel }) {
  const [opts, setOpts] = useState(loadOpts);
  const why = bookletBlocked(notebook);
  const booklet = opts.booklet && !why;
  const pages = notebook.pages.length;
  const padded = bookletPageCount(pages) - pages;
  const a5 = (notebook.format ?? "a4") === "a5";
  const set = (patch) => setOpts((o) => ({ ...o, ...patch }));
  return (
    <div className="pl2-modal no-print" role="dialog" aria-modal="true" aria-label="Тетрадь в PDF">
      <div className="pl2-modal-card pl2-print-card">
        <h2 className="pl2-modal-title">Тетрадь в PDF</h2>
        <p className="pl2-print-sub">«{notebook.title?.trim() || "Тетрадь"}» · {pages} стр. · {a5 ? "А5" : "А4"}</p>
        <div className="pl2-print-opt">
          <div className="pl2-print-opt-label">Обложка</div>
          <div className="pl2-chips" role="radiogroup" aria-label="Обложка">
            <button type="button" role="radio" aria-checked={!opts.cover} className={`pl2-chip${!opts.cover ? " is-on" : ""}`} onClick={() => set({ cover: false })}>Без обложки</button>
            <button type="button" role="radio" aria-checked={opts.cover} className={`pl2-chip${opts.cover ? " is-on" : ""}`} onClick={() => set({ cover: true })}>С обложкой</button>
          </div>
        </div>
        {opts.cover && <p className="pl2-print-note">{a5
          ? "Обложка на первом листе справа (слева — пустой оборот), следом пустой лист — её изнанка. На обложке — буквы и слова тетради, её название и строка для имени."
          : "Обложка — первым листом, следом пустой — её оборот при двусторонней печати. На обложке — буквы и слова тетради, её название и строка для имени."}</p>}
        <div className="pl2-print-opt">
          <div className="pl2-print-opt-label">Как печатать</div>
          <div className="pl2-chips" role="radiogroup" aria-label="Как печатать">
            <button type="button" role="radio" aria-checked={!booklet} className={`pl2-chip${!booklet ? " is-on" : ""}`} onClick={() => set({ booklet: false })}>По порядку</button>
            <button type="button" role="radio" aria-checked={booklet} disabled={Boolean(why)} className={`pl2-chip${booklet ? " is-on" : ""}`} onClick={() => set({ booklet: true })}>Тетрадью</button>
          </div>
        </div>
        <p className="pl2-print-note">{why && opts.booklet ? why : booklet
          ? `Листы разложены для тетради: каждый лист А4 печатается с двух сторон (переворот по короткому краю), стопка складывается пополам и скрепляется по сгибу.${padded ? ` В конце ${padded === 1 ? "добавится 1 пустая страница" : `добавятся ${padded} пустые страницы`} с той же бумагой.` : ""}`
          : a5 ? "Страницы идут подряд, по две на листе А4: лист разрезают пополам." : `Страницы идут подряд, по одной на листе А4.${why ? ` ${why}` : ""}`}</p>
        <label className="pl2-print-switch">
          <input type="checkbox" checked={opts.numbers} onChange={(e) => set({ numbers: e.target.checked })} />
          <span className="pl2-print-sw" aria-hidden="true" />
          Номера страниц
        </label>
        <p className="pl2-print-note pl2-print-note--sw">Внизу страницы, у внешнего края. Обложка без номера.</p>
        <div className="pl2-modal-actions">
          <button type="button" className="pl2-modal-btn pl2-modal-btn--primary" onClick={() => onSave({ ...opts, booklet })}>Сохранить PDF</button>
          <button type="button" className="pl2-modal-btn" onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

