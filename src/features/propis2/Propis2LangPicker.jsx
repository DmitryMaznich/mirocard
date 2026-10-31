import { useEffect, useState } from "react";

// The writing language of a deck that carries several (propis2/languages.js, docs/mockups/propis2-languages.html): a quiet chip in the
// header of «Мои тетради» naming the current one, and a bottom sheet with the languages — each with what changes (how many letters, its
// own letters) and how many notebooks it has, so it is plain that switching hides nothing for good.
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

export function Propis2LangChip({ languages, lang, onOpen }) {
  const current = languages.find((l) => l.id === lang) ?? languages[0];
  return (
    <button type="button" className="p2-lang-chip" onClick={onOpen} aria-haspopup="dialog" aria-label={`Язык письма: ${current.title}`} data-testid="propis2-lang-chip">
      {current.title} <span className="p2-lang-caret" aria-hidden="true">▾</span>
    </button>
  );
}

export function Propis2LangSheet({ languages, lang, counts = {}, studentName, onPick, onClose }) {
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
        <h2 id="p2-lang-title">На каком языке пишем?</h2>
        <p className="p2-lang-sub">{studentName ? `Ученик: ${studentName}. ` : ""}Тетради каждого языка хранятся отдельно.</p>
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
