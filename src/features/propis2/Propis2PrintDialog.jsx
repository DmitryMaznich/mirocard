import { useState } from "react";
import CoverSide from "./cover/CoverSide.jsx";
import { BOOKLET_MAX_PAGES, bookletPageCount } from "@/topics/renderers/propis/booklet.js";
import { ACCENTS, BACKS, BACK_PAPERS, DECORS, FIELDS, PRESETS, SPINE_PAPERS, applyPreset, backPaperOf, normalizeCover, presetOf } from "./cover/coverConfig.js";

// Asked before a notebook is printed (owner, 2026-10-08). The cover is one template (cover/coverConfig.js): a ready design picked in
// one tap (the presets, each shown as the cover itself, small), its options under «Настроить», and the back — what is printed on the
// back of the cover (A5: the left half of the cover's sheet). Above them the live preview, the back and the front side by side
// (on a phone one of them, switched). Page numbers as before. «Печать» hands the choice back (the screen keeps it with the notebook);
// «Отмена» changes nothing.
// «Как печатать» (owner, 2026-10-14): «По порядку» — the pages as the notebook has them, two to a sheet, to cut; «Тетрадью» — in booklet
// order, to fold the stack in half and staple it on the fold (A5 only, up to BOOKLET_MAX_PAGES pages; booklet.js).
export default function Propis2PrintDialog({ title, pages, cover: initialCover, numbers: initialNumbers = true, booklet: initialBooklet = false, notebook, onPrint, onCancel }) {
  const [cover, setCover] = useState(() => normalizeCover(initialCover));
  const [numbers, setNumbers] = useState(initialNumbers);
  const bookletWhy = notebook.a4 ? "Тетрадью — только формат A5: для A4 нужны листы A3." : pages > BOOKLET_MAX_PAGES ? `Тетрадью — до ${BOOKLET_MAX_PAGES} страниц: толще тетрадь плохо складывается и скрепляется. Разделите её на две.` : null;
  const [booklet, setBooklet] = useState(initialBooklet && !bookletWhy);
  const padded = bookletPageCount(pages) - pages;
  // the previews count the leaves as they will be printed (the padding pages of «Тетрадью» are leaves too)
  const shown = { ...notebook, pages, booklet };
  const [side, setSide] = useState("front"); // the side the phone shows
  const [tune, setTune] = useState(false);
  const preset = presetOf(cover);
  const set = (patch) => setCover((c) => normalizeCover({ ...c, ...patch }));
  const setTitle = (patch) => setCover((c) => normalizeCover({ ...c, title: { ...c.title, ...patch } }));
  const toggleField = (id) => setCover((c) => normalizeCover({ ...c, fields: c.fields.includes(id) ? c.fields.filter((f) => f !== id) : [...c.fields, id] }));
  return (
    <div className="p2-modal" role="dialog" aria-modal="true" aria-label="Печать тетради" data-testid="propis2-print-dialog">
      <div className="p2-modal-card p2-print-card">
        <h2 className="p2-modal-title">Печать тетради</h2>
        <p className="p2-print-sub">«{title}» · {pages} стр.</p>
        <div className="p2-print-sec">Обложка</div>
        <div className="p2-print-covers" role="radiogroup" aria-label="Обложка">
          {PRESETS.map((p) => {
            const on = preset === p.id;
            return (
              <button key={p.id} type="button" role="radio" aria-label={p.label} aria-checked={on} className={`p2-print-cover${on ? " is-on" : ""}`} onClick={() => setCover((c) => applyPreset(c, p.id))}>
                <span className="p2-print-thumb">{p.id === "none" ? <span className="p2-print-none">—</span> : <CoverSide side="front" cover={applyPreset(cover, p.id)} notebook={shown} />}</span>
                <span className="p2-print-label">{p.label}</span>
              </button>
            );
          })}
        </div>
        {cover.enabled && (
          <>
            <div className="p2-print-sides" role="tablist" aria-label="Сторона обложки">
              {[["back", "Задник"], ["front", "Лицо"]].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={side === id} className={`p2-chip${side === id ? " is-on" : ""}`} onClick={() => setSide(id)}>{label}</button>
              ))}
            </div>
            <div className={`p2-print-spread p2-print-spread--${side}${notebook.a4 ? " p2-print-spread--a4" : ""}`} data-testid="propis2-cover-preview">
              <div className="p2-print-page p2-print-page--back"><CoverSide side="back" cover={cover} notebook={shown} /></div>
              <div className="p2-print-page p2-print-page--front"><CoverSide side="front" cover={cover} notebook={shown} /></div>
            </div>
            <Chips label="Задник" options={BACKS} value={cover.back.kind} onPick={(kind) => set({ back: { kind, paper: backPaperOf(kind) } })} />
            {cover.back.kind !== "none" && <Chips label="Бумага задника" options={BACK_PAPERS} value={cover.back.paper} onPick={(paper) => set({ back: { ...cover.back, paper } })} small />}
            <button type="button" className={`p2-print-more${tune ? " is-open" : ""}`} aria-expanded={tune} onClick={() => setTune((t) => !t)}>
              Настроить обложку <span aria-hidden="true">{tune ? "▴" : "▾"}</span>
            </button>
            {tune && (
              <div className="p2-print-tune">
                <label className="p2-print-field">
                  <span>Название на обложке</span>
                  <input type="text" value={cover.title.text ?? ""} placeholder={title} maxLength={80} onChange={(e) => setTitle({ text: e.target.value })} />
                </label>
                {!notebook.a4 && <Chips label="Украшение" options={DECORS} value={cover.decor} onPick={(decor) => set({ decor })} />}
                {!notebook.a4 && cover.decor === "spine" && <Chips label="Бумага корешка" options={SPINE_PAPERS} value={cover.spine} onPick={(spine) => set({ spine })} small />}
                <Chips label="Поля" options={FIELDS} value={cover.fields} onPick={toggleField} multi />
                <Chips label="Цвет" options={ACCENTS} value={cover.accent} onPick={(accent) => set({ accent })} swatch />
                <Chips label="Логотип" options={ON_OFF} value={cover.logo ? "on" : "off"} onPick={(v) => set({ logo: v === "on" })} />
              </div>
            )}
            <p className="p2-print-note">{notebook.a4
              ? "Обложка печатается первым листом, задник — на втором (её оборот при двусторонней печати)."
              : "Обложка и задник печатаются на одном листе (задник слева), следом — пустой лист (оборот)."}</p>
          </>
        )}
        <div className="p2-print-opt">
          <div className="p2-print-opt-label">Как печатать</div>
          <div className="p2-chips" role="radiogroup" aria-label="Как печатать">
            <button type="button" role="radio" aria-checked={!booklet} className={`p2-chip${!booklet ? " is-on" : ""}`} onClick={() => setBooklet(false)}>По порядку</button>
            <button type="button" role="radio" aria-checked={booklet} disabled={Boolean(bookletWhy)} className={`p2-chip${booklet ? " is-on" : ""}`} onClick={() => setBooklet(true)}>Тетрадью</button>
          </div>
        </div>
        <p className="p2-print-note" data-testid="propis2-print-how">{bookletWhy ?? (booklet
          ? `Печать с двух сторон, переворот по КОРОТКОМУ краю. Стопку сложить пополам и скрепить по сгибу.${padded ? ` В конце ${padded === 1 ? "добавится 1 линованная страница" : `добавятся ${padded} линованные страницы`}.` : ""}`
          : "Страницы идут подряд, по две на листе: лист разрезают пополам.")}</p>
        <label className="p2-print-switch">
          <input type="checkbox" checked={numbers} onChange={(e) => setNumbers(e.target.checked)} />
          <span className="p2-print-sw" aria-hidden="true" />
          Номера страниц
        </label>
        <p className="p2-print-note p2-print-note--sw">Внизу страницы, у внешнего края. Обложка без номера.</p>
        <div className="p2-modal-actions">
          <button type="button" className="p2-modal-btn p2-modal-btn--primary" onClick={() => onPrint({ cover, numbers, booklet })}>Печать</button>
          <button type="button" className="p2-modal-btn" onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

const ON_OFF = [{ id: "on", label: "Есть" }, { id: "off", label: "Нет" }];

// a row of choices: one of them (a radio group) or several (`multi`, toggles)
function Chips({ label, options, value, onPick, multi = false, swatch = false, small = false }) {
  const isOn = (id) => (multi ? value.includes(id) : value === id);
  return (
    <div className={`p2-print-opt${small ? " p2-print-opt--small" : ""}`}>
      <div className="p2-print-opt-label">{label}</div>
      <div className="p2-chips" role={multi ? "group" : "radiogroup"} aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" role={multi ? "checkbox" : "radio"} aria-checked={isOn(o.id)} className={`p2-chip${isOn(o.id) ? " is-on" : ""}`} onClick={() => onPick(o.id)}>
            {swatch && <i className="p2-chip-swatch" style={{ background: o.color }} aria-hidden="true" />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
