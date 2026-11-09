import { useEffect, useMemo, useRef, useState } from "react";
import Sheet from "./Sheet";
import {
  CASES, FORMATS, PAPERS, SIZES, SUPPORTS,
  alphabetNotebook, blockLabel, cleanWord, layout, newLetterBlock, newNotebook, newRow, newWordBlock, sheetSizeMm, PAGE_MARGIN_MM,
} from "./model";
import { LANGUAGES, languageOf } from "./languages";
import { styleOf, stylesFor } from "./styles";
import { loadAccount, loadLocal, merge, putAccount, saveLocal } from "./store";

// «Латиница» (latin_letters): «Мои тетради» and the notebook constructor, a full screen of its own
// (src/features/printLetters/PrintLettersScreen.jsx routes the topic here). docs/latin-letters.md.

const live = (map) => Object.values(map).filter((nb) => nb && !nb.deleted).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

export default function LatinLettersApp({ onBack, accountKv, makePdf }) {
  const [lib, setLib] = useState(() => loadLocal());
  const [openId, setOpenId] = useState(null);
  const pending = useRef({}); // id → timer: the account copy is written once typing stops

  // the account's copies, once (newer copy of each notebook wins; push up what the account lacks)
  useEffect(() => {
    let alive = true;
    loadAccount(accountKv).then((remote) => {
      if (!alive) return;
      setLib((local) => {
        const merged = merge(local, remote);
        for (const nb of Object.values(merged)) if (merged[nb.id] !== remote[nb.id]) putAccount(accountKv, nb);
        saveLocal(merged);
        return merged;
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, [accountKv]);

  const save = (nb) => {
    const next = { ...nb, updatedAt: Date.now() };
    setLib((m) => {
      const merged = { ...m, [next.id]: next };
      saveLocal(merged);
      return merged;
    });
    clearTimeout(pending.current[next.id]);
    pending.current[next.id] = setTimeout(() => putAccount(accountKv, next), 1200);
    return next;
  };

  const open = (nb) => {
    save(nb);
    setOpenId(nb.id);
  };

  const current = openId ? lib[openId] : null;
  if (current && !current.deleted) {
    return <Editor nb={current} onChange={save} onClose={() => setOpenId(null)} makePdf={makePdf} />;
  }

  const notebooks = live(lib);
  return (
    <div className="ll-app ll-home">
      <header className="ll-topbar">
        <button type="button" className="ll-back" onClick={onBack} aria-label="Назад">‹</button>
        <h1 className="ll-title">Латиница</h1>
      </header>
      <main className="ll-home-body">
        <section>
          <h2 className="ll-h2">Новая тетрадь</h2>
          <div className="ll-cards">
            <button type="button" className="ll-card ll-card--new" onClick={() => open(newNotebook())}>
              <span className="ll-card-big">+</span>
              <span>Пустая тетрадь</span>
            </button>
            <button type="button" className="ll-card" onClick={() => open(alphabetNotebook("en"))}>
              <span className="ll-card-big">Aa–Zz</span>
              <span>Весь алфавит</span>
            </button>
          </div>
        </section>
        <section>
          <h2 className="ll-h2">Мои тетради</h2>
          {notebooks.length === 0 && <p className="ll-muted">Пока нет тетрадей.</p>}
          <ul className="ll-list">
            {notebooks.map((nb) => (
              <li key={nb.id} className="ll-list-item">
                <button type="button" className="ll-list-open" onClick={() => setOpenId(nb.id)}>
                  <span className="ll-list-title">{nb.title || "Тетрадь"}</span>
                  <span className="ll-muted">
                    {languageOf(nb.lang).title} · {styleOf(nb.style).title} · {nb.blocks.length} {plural(nb.blocks.length, "блок", "блока", "блоков")}
                  </span>
                </button>
                <button type="button" className="ll-icon-btn" aria-label="Удалить тетрадь"
                  onClick={() => { if (window.confirm(`Удалить тетрадь «${nb.title}»?`)) save({ id: nb.id, deleted: true }); }}>
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function Seg({ value, options, onChange, label }) {
  return (
    <div className="ll-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={String(o.id) === String(value)} title={o.hint}
          className={`ll-seg-btn${String(o.id) === String(value) ? " is-on" : ""}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Editor({ nb, onChange, onClose, makePdf }) {
  const [selId, setSelId] = useState(null);
  const [word, setWord] = useState("");
  const [pdf, setPdf] = useState(null); // null | "making" | "error"
  const pdfRef = useRef(null);
  const L = useMemo(() => layout(nb), [nb]);
  const lang = languageOf(nb.lang);
  const style = styleOf(nb.style);
  const set = (patch) => onChange({ ...nb, ...patch });
  const setBlocks = (blocks) => set({ blocks });
  const sel = nb.blocks.find((b) => b.id === selId) ?? null;

  const addBlock = (b) => {
    // the panel stays on the alphabet: letters are usually added several in a row
    setBlocks([...nb.blocks, b]);
  };
  const addWord = (text) => {
    const clean = cleanWord(text, style);
    if (!clean) return;
    addBlock(newWordBlock(clean));
    setWord("");
  };
  const updateBlock = (b) => setBlocks(nb.blocks.map((x) => (x.id === b.id ? b : x)));
  const moveBlock = (d) => {
    const i = nb.blocks.findIndex((b) => b.id === selId);
    const j = i + d;
    if (i < 0 || j < 0 || j >= nb.blocks.length) return;
    const blocks = nb.blocks.slice();
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    setBlocks(blocks);
  };
  const removeBlock = () => {
    setBlocks(nb.blocks.filter((b) => b.id !== selId));
    setSelId(null);
  };

  // «PDF»: the app's vector PDF maker, from sheets laid out off screen at their real size; an app
  // without it (older than this deck) gets the browser's print
  useEffect(() => {
    if (pdf !== "making" || !pdfRef.current) return undefined;
    let alive = true;
    makePdf(pdfRef.current).then((blob) => {
      if (!alive) return;
      setPdf(null);
      if (blob) sharePdf(blob, `${(nb.title || "Латиница").replace(/[\\/:*?"<>|]+/g, " ").trim()}.pdf`);
    }).catch((e) => {
      console.error("latin_letters PDF", e);
      if (alive) setPdf("error");
    });
    return () => { alive = false; };
  }, [pdf]); // eslint-disable-line react-hooks/exhaustive-deps

  const toPdf = () => (makePdf ? setPdf("making") : window.print());
  const fmt = FORMATS[nb.format] ?? FORMATS.a4;
  const sheet = sheetSizeMm(nb.format);

  return (
    <div className="ll-app ll-editor">
      <header className="ll-topbar">
        <button type="button" className="ll-back" onClick={onClose} aria-label="К тетрадям">‹</button>
        <input className="ll-title-input" value={nb.title} onChange={(e) => set({ title: e.target.value })} aria-label="Название тетради" />
        <button type="button" className="ll-btn ll-btn--primary" onClick={toPdf} disabled={pdf === "making" || nb.blocks.length === 0}>
          {pdf === "making" ? "Готовлю PDF…" : "PDF"}
        </button>
      </header>
      <div className="ll-settings">
        {Object.keys(LANGUAGES).length > 1 && (
          <label className="ll-field">Язык
            <select value={nb.lang} onChange={(e) => set({ lang: e.target.value })}>
              {Object.values(LANGUAGES).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
        )}
        <label className="ll-field">Стиль
          <select value={nb.style} onChange={(e) => set({ style: e.target.value })}>
            {stylesFor(nb.lang).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        <Seg label="Бумага" value={nb.paper} options={PAPERS} onChange={(paper) => set({ paper })} />
        {nb.paper !== "cell" && <Seg label="Размер" value={nb.size} options={SIZES} onChange={(size) => set({ size })} />}
        <Seg label="Формат" value={nb.format} options={Object.values(FORMATS)} onChange={(format) => set({ format })} />
        <label className="ll-check"><input type="checkbox" checked={nb.nameLine !== false} onChange={(e) => set({ nameLine: e.target.checked })} /> Строка «Name»</label>
      </div>
      {pdf === "error" && (
        <div className="ll-error" role="alert">Не получилось сделать PDF. <button type="button" onClick={() => setPdf(null)}>Закрыть</button></div>
      )}
      <div className="ll-work">
        <main className="ll-canvas" onClick={(e) => { if (e.target === e.currentTarget) setSelId(null); }}>
          {nb.blocks.length === 0 && <p className="ll-empty">Добавьте букву или слово — справа (на телефоне ниже).</p>}
          {L.pages.map((page, i) => (
            <div key={i} className="ll-page" style={{ maxWidth: `${Math.round(sheet.w * 4.2)}px` }}>
              <Sheet nb={nb} L={L} page={page} pageNo={L.pages.length > 1 ? i + 1 : null} selectedBlockId={selId} onSelectBlock={setSelId} />
              <div className="ll-page-no">Стр. {i + 1} из {L.pages.length} · {fmt.label}</div>
            </div>
          ))}
        </main>
        <aside className="ll-panel">
          {sel ? (
            <BlockPanel block={sel} onChange={updateBlock} onMove={moveBlock} onRemove={removeBlock} onClose={() => setSelId(null)} />
          ) : (
            <>
              <h3 className="ll-h3">Буква</h3>
              <div className="ll-alpha">
                {lang.alphabet.map((ch) => (
                  <button key={ch} type="button" className="ll-alpha-btn" onClick={() => addBlock(newLetterBlock(ch))}>{ch}{ch.toLowerCase()}</button>
                ))}
              </div>
              <h3 className="ll-h3">Слово</h3>
              <form className="ll-word-form" onSubmit={(e) => { e.preventDefault(); addWord(word); }}>
                <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="cat" lang="en" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                <button type="submit" className="ll-btn" disabled={!cleanWord(word, style)}>Добавить</button>
              </form>
              <div className="ll-chips">
                {lang.words.map((w) => <button key={w} type="button" className="ll-chip" onClick={() => addWord(w)}>{w}</button>)}
              </div>
              {nb.blocks.length > 0 && (
                <>
                  <h3 className="ll-h3">Блоки тетради</h3>
                  <div className="ll-chips">
                    {nb.blocks.map((b) => <button key={b.id} type="button" className="ll-chip ll-chip--block" onClick={() => setSelId(b.id)}>{blockLabel(b)}</button>)}
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>
      {pdf === "making" && (
        <div ref={pdfRef} className="ll-pdf-host" aria-hidden="true">
          {L.pages.map((page, i) => (
            <div key={i} className="pl-pdf-page" data-w={fmt.w} data-h={fmt.h}>
              <div className="pl-pdf-slot" data-x={PAGE_MARGIN_MM} data-y={PAGE_MARGIN_MM} data-w={sheet.w} data-h={sheet.h} style={{ width: `${sheet.w}mm` }}>
                <Sheet nb={nb} L={L} page={page} pageNo={L.pages.length > 1 ? i + 1 : null} />
              </div>
            </div>
          ))}
        </div>
      )}
      {/* the browser's print (no makePdf): only these sheets are printed */}
      <div className="ll-print" aria-hidden="true">
        <style>{`@page { size: ${fmt.w}mm ${fmt.h}mm; margin: ${PAGE_MARGIN_MM}mm; }`}</style>
        {L.pages.map((page, i) => (
          <div key={i} className="ll-print-page" style={{ width: `${sheet.w}mm` }}>
            <Sheet nb={nb} L={L} page={page} pageNo={L.pages.length > 1 ? i + 1 : null} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockPanel({ block, onChange, onMove, onRemove, onClose }) {
  const rows = block.rows;
  const setRow = (id, patch) => onChange({ ...block, rows: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const moveRow = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...block, rows: next });
  };
  return (
    <div className="ll-block-panel">
      <div className="ll-block-head">
        <span className="ll-block-label">{blockLabel(block)}</span>
        <button type="button" className="ll-btn" onClick={onClose}>Готово</button>
      </div>
      <div className="ll-block-actions">
        <button type="button" className="ll-btn" onClick={() => onMove(-1)} aria-label="Блок выше">↑ Выше</button>
        <button type="button" className="ll-btn" onClick={() => onMove(1)} aria-label="Блок ниже">↓ Ниже</button>
        <button type="button" className="ll-btn ll-btn--danger" onClick={onRemove}>Удалить блок</button>
      </div>
      <h3 className="ll-h3">Строки</h3>
      <ol className="ll-rows">
        {rows.map((r, i) => (
          <li key={r.id} className="ll-row">
            <div className="ll-row-top">
              <span className="ll-row-no">{i + 1}</span>
              <button type="button" className="ll-mini" onClick={() => moveRow(i, -1)} aria-label="Строку выше">↑</button>
              <button type="button" className="ll-mini" onClick={() => moveRow(i, 1)} aria-label="Строку ниже">↓</button>
              <button type="button" className="ll-mini" onClick={() => onChange({ ...block, rows: rows.filter((x) => x.id !== r.id) })} aria-label="Удалить строку" disabled={rows.length <= 1}>×</button>
            </div>
            {block.kind === "letter" && <Seg label="Буква" value={r.case} options={CASES} onChange={(c) => setRow(r.id, { case: c })} />}
            <Seg label="Опора" value={r.support} options={SUPPORTS} onChange={(s) => setRow(r.id, { support: s })} />
          </li>
        ))}
      </ol>
      <button type="button" className="ll-btn" onClick={() => onChange({ ...block, rows: [...rows, newRow(block)] })}>+ Строка</button>
    </div>
  );
}

function sharePdf(blob, name) {
  const file = new File([blob], name, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: name }).catch(() => download(blob, name));
    return;
  }
  download(blob, name);
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

