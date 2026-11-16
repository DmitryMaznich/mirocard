import { useEffect, useState } from "react";
import { sampleLetters, scriptOf } from "@/topics/renderers/propis2/myLanguages.js";

// The language of a new notebook in a deck with several writing languages (propis2/languages.js, docs/propis2-languages.md): a bottom
// sheet with the languages — each with what changes (how many letters, its own letters) and how many notebooks it already has.
const RU_LETTERS = 33;

function letterNote(lang) {
  const lower = lang.alphabet?.lower;
  if (!lower) return `${RU_LETTERS} буквы`;
  const n = [...lower].length;
  const own = [...lower].filter((ch) => !"абвгдеёжзийклмнопрстуфхцчшщъыьэюя".includes(ch));
  const plural = n % 10 === 1 && n % 100 !== 11 ? "буква" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "буквы" : "букв";
  return own.length ? `${n} ${plural} · ${own.join(" ")}` : `${n} ${plural}`;
}

function notebooksNote(n) {
  if (!n) return "тетрадей нет";
  const w = n % 10 === 1 && n % 100 !== 11 ? "тетрадь" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "тетради" : "тетрадей";
  return `${n} ${w}`;
}

// Only the language: a writing style is chosen per PAGE in the editor («Стиль» in the page strip, owner 2026-11-10), not for a new notebook.
export function Propis2LangSheet({ title = "Язык письма", languages, lang, counts = {}, onPick, onClose }) {
  const [picked, setPicked] = useState(lang);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="p2-lang-layer" data-testid="propis2-lang-sheet">
      <div className="p2-lang-scrim" onClick={onClose} />
      <div className="p2-lang-sheet" role="dialog" aria-modal="true" aria-labelledby="p2-lang-title">
        <div className="p2-lang-grab" aria-hidden="true" />
        <h2 id="p2-lang-title">{title}</h2>
        <p className="p2-lang-sub">От языка зависят буквы, наклон и бумага тетради. Язык готовой тетради не меняется.</p>
        <div className="p2-lang-list" role="radiogroup" aria-label="Язык письма">
          {languages.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={picked === l.id} className={`p2-lang-opt${picked === l.id ? " is-on" : ""}`} onClick={() => setPicked(l.id)}>
              <span className="p2-lang-radio" aria-hidden="true" />
              <span className="p2-lang-text">
                <span className="p2-lang-name">{l.title}</span>
                <span className="p2-lang-note">{notebooksNote(counts[l.id] ?? 0)} · {letterNote(l)}</span>
              </span>
              {l.status === "draft" && <span className="p2-lang-draft">черновик</span>}
            </button>
          ))}
        </div>
        <button type="button" className="p2-lang-done" onClick={() => { if (picked !== lang) onPick(picked); onClose(); }}>Готово</button>
      </div>
    </div>
  );
}

// «Мои языки» (docs/mockups/propis2-languages-journey.html, screen 3): the languages the adult works in — ticks, grouped by script (the
// script of the first ticked one first), each named in itself, with two of its letters; the last one cannot be unticked. Notebooks of a
// language taken off stay in «Мои тетради».
export function Propis2MyLangsSheet({ languages, selected, counts = {}, onSave, onClose }) {
  const [picked, setPicked] = useState(() => new Set(selected));
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const firstScript = scriptOf(languages.find((l) => selected.includes(l.id)) ?? languages[0]);
  const groups = [firstScript, firstScript === "latin" ? "cyrillic" : "latin"]
    .map((sc) => ({ sc, langs: languages.filter((l) => scriptOf(l) === sc) }))
    .filter((g) => g.langs.length);
  const toggle = (id) => setPicked((cur) => {
    const next = new Set(cur);
    if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
    return next;
  });
  return (
    <div className="p2-lang-layer" data-testid="propis2-my-langs-sheet">
      <div className="p2-lang-scrim" onClick={onClose} />
      <div className="p2-lang-sheet" role="dialog" aria-modal="true" aria-labelledby="p2-mylang-title">
        <div className="p2-lang-grab" aria-hidden="true" />
        <h2 id="p2-mylang-title">Мои языки</h2>
        <p className="p2-lang-sub">Тетради, готовые тетради и карточки — на этих языках. Тетради снятого языка остаются в «Моих тетрадях».</p>
        {groups.map((g) => (
          <div key={g.sc}>
            <div className="p2-lang-group">{g.sc === "latin" ? "Латиница" : "Кириллица"}</div>
            <div className="p2-lang-list" role="group" aria-label={g.sc === "latin" ? "Латиница" : "Кириллица"}>
              {g.langs.map((l) => {
                const on = picked.has(l.id);
                return (
                  <button key={l.id} type="button" role="checkbox" aria-checked={on} className={`p2-lang-opt${on ? " is-on" : ""}`} onClick={() => toggle(l.id)} disabled={on && picked.size === 1} title={on && picked.size === 1 ? "Хотя бы один язык" : undefined}>
                    <span className={`p2-lang-check${on ? " is-on" : ""}`} aria-hidden="true">{on ? "✓" : ""}</span>
                    <span className="p2-lang-text">
                      <span className="p2-lang-name">{l.title}{l.status === "draft" && <span className="p2-lang-draft">черновик</span>}</span>
                      <span className="p2-lang-note">{notebooksNote(counts[l.id] ?? 0)}{l.styles?.length > 1 ? ` · стилей: ${l.styles.length}` : ""}</span>
                    </span>
                    <span className="p2-lang-sample" aria-hidden="true">{sampleLetters(l)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button type="button" className="p2-lang-done" onClick={() => { onSave([...picked]); onClose(); }}>Готово</button>
      </div>
    </div>
  );
}
