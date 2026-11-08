import { useEffect, useState } from "react";

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

// A language with several writing styles (languages.js `styles`, e.g. English print and British): its styles are offered under the
// list, and `onPick(language, style)` gets both.
export function Propis2LangSheet({ title = "Язык письма", languages, lang, style = null, counts = {}, onPick, onClose }) {
  const [picked, setPicked] = useState(lang);
  const stylesOf = (id) => { const st = languages.find((l) => l.id === id)?.styles; return st?.length > 1 ? st : null; };
  const [pickedStyle, setPickedStyle] = useState(style);
  const styles = stylesOf(picked);
  const shownStyle = styles ? (styles.find((x) => x.id === pickedStyle) ?? styles[0]).id : null;
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
            <button key={l.id} type="button" role="radio" aria-checked={picked === l.id} className={`p2-lang-opt${picked === l.id ? " is-on" : ""}`} onClick={() => { setPicked(l.id); if (l.id !== picked) setPickedStyle(null); }}>
              <span className="p2-lang-radio" aria-hidden="true" />
              <span className="p2-lang-text">
                <span className="p2-lang-name">{l.title}</span>
                <span className="p2-lang-note">{notebooksNote(counts[l.id] ?? 0)} · {letterNote(l)}</span>
              </span>
              {l.status === "draft" && <span className="p2-lang-draft">черновик</span>}
            </button>
          ))}
        </div>
        {styles && (
          <>
            <h3 className="p2-lang-styles-title">Стиль письма</h3>
            <div className="p2-lang-list" role="radiogroup" aria-label="Стиль письма" data-testid="propis2-style-list">
              {styles.map((st) => (
                <button key={st.id} type="button" role="radio" aria-checked={shownStyle === st.id} className={`p2-lang-opt${shownStyle === st.id ? " is-on" : ""}`} onClick={() => setPickedStyle(st.id)}>
                  <span className="p2-lang-radio" aria-hidden="true" />
                  <span className="p2-lang-text"><span className="p2-lang-name">{st.title}</span>{st.note && <span className="p2-lang-note">{st.note}</span>}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <button type="button" className="p2-lang-done" onClick={() => { if (picked !== lang || shownStyle !== style) onPick(picked, shownStyle); onClose(); }}>Готово</button>
      </div>
    </div>
  );
}
