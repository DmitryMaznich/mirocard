import { useState } from "react";
import CoverSide from "./cover/CoverSide.jsx";
import { ACCENTS, BACKS, BACK_PAPERS, DECORS, FIELDS, PRESETS, TITLE_STYLES, applyPreset, backPaperOf, normalizeCover, presetOf } from "./cover/coverConfig.js";

// Asked before a notebook is printed (owner, 2026-10-08). The cover is one template (cover/coverConfig.js): a ready design picked in
// one tap (the presets, each shown as the cover itself, small), its options under «Настроить», and the back — what is printed on the
// back of the cover (A5: the left half of the cover's sheet). Above them the live preview, the back and the front side by side
// (on a phone one of them, switched). Page numbers as before. «Печать» hands the choice back (the screen keeps it with the notebook);
// «Отмена» changes nothing.
export default function Propis2PrintDialog({ title, pages, cover: initialCover, numbers: initialNumbers = true, notebook, onPrint, onCancel }) {
  const [cover, setCover] = useState(() => normalizeCover(initialCover));
  const [numbers, setNumbers] = useState(initialNumbers);
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
                <span className="p2-print-thumb">{p.id === "none" ? <span className="p2-print-none">—</span> : <CoverSide side="front" cover={applyPreset(cover, p.id)} notebook={notebook} />}</span>
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
              <div className="p2-print-page p2-print-page--back"><CoverSide side="back" cover={cover} notebook={notebook} /></div>
              <div className="p2-print-page p2-print-page--front"><CoverSide side="front" cover={cover} notebook={notebook} /></div>
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
                <Chips label="Название" options={TITLE_STYLES} value={cover.title.style} onPick={(style) => setTitle({ style })} />
                <Chips label="Надпись «ТЕТРАДЬ»" options={ON_OFF} value={cover.title.kicker ? "on" : "off"} onPick={(v) => setTitle({ kicker: v === "on" })} />
                <Chips label="Украшение" options={DECORS} value={cover.decor} onPick={(decor) => set({ decor })} />
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
