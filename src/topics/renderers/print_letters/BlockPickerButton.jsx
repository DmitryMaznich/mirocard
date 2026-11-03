import { useEffect, useRef, useState } from "react";
import { usePopupPos } from "./usePopupPos";
import { IconLetterA } from "./icons";
import LetterGlyph from "./LetterGlyph";
import { PlateWords } from "./WordBlock";
import { ALPHABET, VOWELS, syllableSuggestions, wordSuggestions } from "./words";

const FAMILY_TITLES = { straight: "Прямые линии" };
const PANEL_W = 340;
const TABS = [
  { id: "letter", label: "Буква" },
  { id: "syllable", label: "Слог" },
  { id: "word", label: "Слово" },
];
const MAX_LEN = 6;

// «Блок» in the top strip (propis2's picker pattern: a button that pops a panel under itself). Three
// tabs (owner, 2026-11-03; docs/mockups/print-letters-words.html): a letter — its grid, as before;
// a syllable or a word — tap letter tiles to build one (only letters the topic has drawn; the rest
// show dashed and can't be tapped, so it's clear why «НА» isn't there yet) or take ready ones from
// the list; several picked become the rows of one block.
export default function BlockPickerButton({ families, byId, onPickLetter, onPickWords }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("letter");
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState([]);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelStyle = usePopupPos(open, btnRef, PANEL_W, () => setOpen(false));

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const switchTab = (id) => { setTab(id); setDraft(""); setPicked([]); };
  const close = () => { setOpen(false); setDraft(""); setPicked([]); };
  const toggle = (w) => setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w]));
  const takeDraft = () => {
    if (draft.length < 2) return;
    setPicked((p) => (p.includes(draft) ? p : [...p, draft]));
    setDraft("");
  };
  const addBlock = () => {
    const words = draft.length >= 2 && !picked.includes(draft) ? [...picked, draft] : picked;
    if (!words.length) return;
    onPickWords(words, tab);
    close();
  };

  const ready = tab === "syllable" ? syllableSuggestions(byId) : tab === "word" ? wordSuggestions(byId) : [];
  const chips = [...ready, ...picked.filter((w) => !ready.includes(w))];
  const count = picked.length + (draft.length >= 2 && !picked.includes(draft) ? 1 : 0);

  return (
    <div className="pl2-pick" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={`pl2-pick-btn pl2-tool${open ? " is-open" : ""}`}
        aria-label="Новый блок: буква, слог или слово"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pl2-tool-ico"><IconLetterA /><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></span>
        <span className="pl2-cap">Блок</span>
      </button>
      {open && (
        <div className="pl-letters-panel pl-blockpick" role="dialog" aria-label="Новый блок" style={{ ...panelStyle, width: PANEL_W, maxHeight: panelStyle?.top != null ? `calc(100dvh - ${panelStyle.top + 8}px)` : undefined }}>
          <div className="pl-bp-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => switchTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {tab === "letter" && families.map(([famId, famLetters]) => (
            <div key={famId}>
              <div className="pl-el-group">{FAMILY_TITLES[famId] ?? famId}</div>
              <div className="pl-letters-grid">
                {famLetters.map((l) => (
                  <button key={l.id} type="button" className="pl-letters-cell" aria-label={`Буква ${l.label}`} onClick={() => { close(); onPickLetter(l.id); }}>
                    <LetterGlyph letter={l} heightMm={7} variant="plain" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {tab !== "letter" && (
            <>
              <div className="pl-bp-compose">
                <span className="pl-bp-draft" aria-live="polite">
                  {draft ? <PlateWords words={[draft]} byId={byId} heightMm={8} color="#1f3a8a" weight={10} /> : <span className="pl-bp-ph">{tab === "syllable" ? "Соберите слог из букв" : "Соберите слово из букв"}</span>}
                </span>
                <button type="button" className="pl-bp-back" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft} aria-label="Стереть последнюю букву">⌫</button>
                <button type="button" className="pl-bp-take" onClick={takeDraft} disabled={draft.length < 2} aria-label="В список">＋</button>
              </div>
              <div className="pl-bp-keys">
                {ALPHABET.map((ch) => {
                  const letter = byId[ch];
                  return (
                    <button key={ch} type="button" className={`pl-bp-key${VOWELS.has(ch) ? " is-vowel" : ""}${letter ? "" : " is-off"}`} disabled={!letter || draft.length >= MAX_LEN}
                      aria-label={letter ? ch : `${ch} — ещё не нарисована`} onClick={() => setDraft((d) => d + ch)}>
                      {letter ? <LetterGlyph letter={letter} heightMm={5} variant="plain" weight={11} /> : ch}
                    </button>
                  );
                })}
              </div>
              <div className="pl-el-group">{tab === "syllable" ? "Готовые слоги" : "Готовые слова"} — можно несколько</div>
              {chips.length ? (
                <div className="pl-bp-chips">
                  {chips.map((w) => (
                    <button key={w} type="button" className={`pl-bp-chip${picked.includes(w) ? " is-on" : ""}`} aria-pressed={picked.includes(w)} aria-label={w} onClick={() => toggle(w)}>
                      <PlateWords words={[w]} byId={byId} heightMm={4.5} color={picked.includes(w) ? "#2a6b60" : "#1f3a8a"} weight={11} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="pl-bp-none">Из нарисованных букв {tab === "syllable" ? "слогов" : "слов"} пока не собрать — нужны гласные.</p>
              )}
              <button type="button" className="pl-bp-add" onClick={addBlock} disabled={!count}>
                {count > 1 ? `Добавить блок · ${count}` : "Добавить блок"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
