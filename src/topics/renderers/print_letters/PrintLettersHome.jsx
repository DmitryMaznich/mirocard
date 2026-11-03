import { useEffect, useMemo, useRef, useState } from "react";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import ConstructorView from "./ConstructorView";
import PrintPages from "./PrintPages";
import usePdfExport from "./usePdfExport";
import {
  SYNC_PREFIX, clearDraft, copyNotebook, docFor, docKey, loadDraft, loadLocal, mergeRemote, newNotebook, notebookJson,
  putNotebook, READY_SECTIONS, readyNotebooks, removeNotebook, saveDraft, saveLocal, sortedNotebooks,
} from "./library";
import { IconAddPage, IconDuplicate, IconEditPage, IconNotebook, IconPdf, IconTrash } from "./icons";

const MONTHS = ["янв.", "февр.", "марта", "апр.", "мая", "июня", "июля", "авг.", "сент.", "окт.", "нояб.", "дек."];
const UNDO_DEPTH = 200;
const UNDO_TYPING_MS = 1000;

function dateLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(today) - day(d)) / 86400000);
  if (diff === 0) return "сегодня";
  if (diff === 1) return "вчера";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const metaLine = (nb) => `${nb.pages.length} стр. · ${(nb.format ?? "a4") === "a5" ? "А5" : "А4"}`;

// A library tool: propis2's own (Propis2Library's Tool — an icon over its caption).
function Tool({ label, caption, tone = "", onClick, children }) {
  return (
    <button type="button" className={`pl2-ib pl2-tool ${tone}`} aria-label={label} title={label} onClick={onClick}>
      <span className="pl2-tool-ico">{children}</span>
      <span className="pl2-cap">{caption}</span>
    </button>
  );
}

// «Печатные буквы» home: «Мои тетради» → the editor of one notebook — propis2's own home
// (Propis2Home / Propis2Library), its look copied class for class (propis2-style.css), without its
// options. A notebook opened for editing is a SESSION: a working copy with the saved version
// beside it and its own undo/redo; nothing reaches «Мои тетради» until «Сохранить» (or the
// question when leaving), and the working copy is mirrored to this device as a draft.
export default function PrintLettersHome({ task, onBack, onAdvance, accountKv, makePdf }) {
  const letters = useMemo(() => task?.letters ?? [], [task]);
  const byId = useMemo(() => Object.fromEntries(letters.map((l) => [l.id, l])), [letters]);
  const families = useMemo(() => {
    const map = new Map();
    for (const l of letters) {
      const famId = l.family ?? "other";
      if (!map.has(famId)) map.set(famId, []);
      map.get(famId).push(l);
    }
    return Array.from(map.entries());
  }, [letters]);
  const ready = useMemo(() => readyNotebooks(byId), [byId]);

  const [lib, setLibState] = useState(loadLocal);
  const libRef = useRef(lib);
  const setLib = (next) => { libRef.current = next; setLibState(next); saveLocal(next); };

  // the notebook being edited: { nb, base, past, future } — base: the saved version's JSON (null: never saved)
  const [session, setSession] = useState(null);
  const lastTyping = useRef(0);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [draft, setDraft] = useState(() => {
    const d = loadDraft();
    if (!d) return null;
    const saved = loadLocal().notebooks.find((n) => n.id === d.nb.id);
    if (!d.isNew && saved && notebookJson(saved) === notebookJson(d.nb)) { clearDraft(); return null; }
    return d;
  });
  const [printNb, setPrintNb] = useState(null);

  const dirty = Boolean(session && notebookJson(session.nb) !== session.base);

  const push = (id, l = libRef.current) => {
    const doc = docFor(l, id);
    if (doc && accountKv?.put) Promise.resolve(accountKv.put(docKey(id), doc)).catch(() => {});
  };

  // Pull the account's notebooks once (last write wins per notebook); send up what the account lacks.
  useEffect(() => {
    if (!accountKv?.list) return undefined;
    let alive = true;
    accountKv.list(SYNC_PREFIX).then((items) => {
      if (!alive) return;
      const { lib: merged, push: ids } = mergeRemote(libRef.current, items);
      setLib(merged);
      ids.forEach((id) => push(id, merged));
    }).catch(() => {}); // offline or signed out: the device copy keeps working
    return () => { alive = false; };
  }, [accountKv]); // eslint-disable-line react-hooks/exhaustive-deps

  // The working copy goes to this device as a draft on every change.
  useEffect(() => {
    if (!session) return;
    if (dirty) saveDraft({ nb: session.nb, isNew: session.base === null });
    else clearDraft();
  }, [session, dirty]);

  // Printing (the browser's print, only when the app has no PDF maker): render that notebook's
  // sheets, print, drop them.
  useEffect(() => {
    if (!printNb) return undefined;
    const t = setTimeout(() => { window.print(); setPrintNb(null); }, 50);
    return () => clearTimeout(t);
  }, [printNb]);
  const pdf = usePdfExport({ makePdf, byId });
  const toPdf = (nb) => (makePdf ? pdf.start(nb) : setPrintNb(nb));

  function open(nb, isNew = false) {
    setSession({ nb, base: isNew ? null : notebookJson(nb), past: [], future: [] });
    setDraft(null);
  }
  function close() {
    setSession(null);
    setLeaveAsk(false);
    clearDraft();
  }
  // A change: one undo step, except typing the name (one step per pause, like propis2).
  function change(fn, { typing = false } = {}) {
    const now = Date.now();
    const merge = typing && now - lastTyping.current < UNDO_TYPING_MS;
    lastTyping.current = typing ? now : 0;
    setSession((s) => {
      if (!s) return s;
      const nb = fn(s.nb);
      if (nb === s.nb) return s;
      return { ...s, nb, past: merge ? s.past : [...s.past, s.nb].slice(-UNDO_DEPTH), future: [] };
    });
  }
  const undo = () => setSession((s) => (s && s.past.length ? { ...s, nb: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.nb, ...s.future] } : s));
  const redo = () => setSession((s) => (s && s.future.length ? { ...s, nb: s.future[0], past: [...s.past, s.nb], future: s.future.slice(1) } : s));
  function save() {
    if (!session) return null;
    const nb = { ...session.nb, title: session.nb.title.trim() || "Без названия", updatedAt: Date.now() };
    const next = putNotebook(libRef.current, nb);
    setLib(next);
    push(nb.id, next);
    setSession((s) => ({ ...s, nb, base: notebookJson(nb) }));
    clearDraft();
    return nb;
  }
  function back() {
    if (dirty) setLeaveAsk(true);
    else close();
  }
  function copy(nb) {
    const cp = copyNotebook(nb, `${nb.title} (копия)`);
    const next = putNotebook(libRef.current, cp);
    setLib(next);
    push(cp.id, next);
  }
  function remove(nb) {
    if (!window.confirm(`Удалить тетрадь «${nb.title}»?`)) return;
    const next = removeNotebook(libRef.current, nb.id);
    setLib(next);
    push(nb.id, next);
  }
  // A ready notebook opens as an editable copy — it reaches «Мои тетради» when saved (propis2: «Править»).
  const editReady = (r) => open(copyNotebook(r), true);
  function resumeDraft() {
    const saved = libRef.current.notebooks.find((n) => n.id === draft.nb.id);
    setSession({ nb: draft.nb, base: !draft.isNew && saved ? notebookJson(saved) : null, past: [], future: [] });
    setDraft(null);
  }
  function dropDraft() {
    clearDraft();
    setDraft(null);
  }

  if (session) {
    return (
      <>
        <ConstructorView
          key={session.nb.id}
          notebook={session.nb}
          onChange={change}
          byId={byId}
          families={families}
          dirty={dirty}
          onSave={save}
          onBack={back}
          onUndo={undo}
          onRedo={redo}
          canUndo={session.past.length > 0}
          canRedo={session.future.length > 0}
          onPdf={() => toPdf(session.nb)}
          pdfBusy={pdf.busy}
        />
        {pdf.node}
        {leaveAsk && (
          <div className="pl-modal no-print" role="presentation">
            <div className="pl-dialog" role="dialog" aria-modal="true" aria-labelledby="pl-leave-title">
              <h2 id="pl-leave-title">Сохранить тетрадь «{session.nb.title.trim() || "Без названия"}»?</h2>
              <p>Есть несохранённые правки. Без сохранения они не попадут в «Мои тетради».</p>
              <button type="button" className="pl-dialog-primary" onClick={() => { save(); close(); }}>Сохранить</button>
              <button type="button" className="pl-dialog-danger" onClick={close}>Не сохранять</button>
              <button type="button" className="pl-dialog-plain" onClick={() => setLeaveAsk(false)}>Отмена — вернуться к тетради</button>
            </div>
          </div>
        )}
      </>
    );
  }

  const mine = sortedNotebooks(lib);
  const leave = onBack ?? onAdvance;

  return (
    <div className="screen plb-home plb-lib pl-lib2" data-testid="print-letters-library">
      <div className="screen-header no-print">
        {leave && <button className="back-btn" onClick={leave} aria-label="Назад"><BackArrowIcon /></button>}
        <h1 className="screen-title">Печатные буквы</h1>
      </div>
      <div className="plb-body no-print">
        {draft && (
          <div className="pl2-banner" role="status">
            <span className="pl2-banner-text">Не сохранена тетрадь «{draft.nb.title.trim() || "Без названия"}»</span>
            <span className="pl2-banner-actions">
              <button type="button" aria-label="Продолжить несохранённую тетрадь" onClick={resumeDraft}>Продолжить</button>
              <button type="button" aria-label="Удалить несохранённую тетрадь" onClick={dropDraft}>Удалить</button>
            </span>
          </div>
        )}
        <div className="pl2-nb-start">
          <button type="button" className="pl2-tile pl2-tile--primary pl2-tile--wide" aria-label="Новая тетрадь" onClick={() => open(newNotebook(), true)}>
            <span className="pl2-tile-ico"><IconAddPage /></span>
            <span className="pl2-tile-cap">Новая тетрадь</span>
          </button>
        </div>

        {mine.length > 0 && <h2 className="plb-h2">Мои тетради</h2>}
        {mine.length > 0 && (
          <ul className="plb-pages">
            {mine.map((nb) => (
              <li key={nb.id} className="pl2-nb">
                <div className="pl2-nb-head">
                  <span className="pl2-nb-ico"><IconNotebook /></span>
                  <div className="pl2-nb-main">
                    <div className="pl2-nb-name">{nb.title}</div>
                    <div className="pl2-nb-meta">{metaLine(nb)} · {dateLabel(nb.updatedAt)}</div>
                  </div>
                </div>
                <div className="pl2-nb-tools" role="group" aria-label="Действия с тетрадью">
                  <Tool label={`Изменить тетрадь ${nb.title}`} caption="Править" tone="pl2-tool--go" onClick={() => open(nb)}><IconEditPage /></Tool>
                  <Tool label={`PDF тетради ${nb.title}`} caption="PDF" onClick={() => toPdf(nb)}><IconPdf /></Tool>
                  <Tool label={`Копия тетради ${nb.title}`} caption="Копия" onClick={() => copy(nb)}><IconDuplicate /></Tool>
                  <Tool label={`Удалить тетрадь ${nb.title}`} caption="Удалить" tone="pl2-ib--danger" onClick={() => remove(nb)}><IconTrash /></Tool>
                </div>
              </li>
            ))}
          </ul>
        )}

        {ready.length > 0 && (
          <>
            <h2 className="plb-h2">Готовые тетради</h2>
            <p className="pl-ready-intro">Курс по «Волшебным линиям» В. А. Илюхиной: занятие — новые буквы лесенкой в клетке 1 см, потом повторение, слоги и слова из уже изученных букв.</p>
            {READY_SECTIONS.map((section) => {
              const list = ready.filter((r) => r.section === section);
              if (!list.length) return null;
              return (
                <section key={section} className="pl-ready-sec" aria-label={section}>
                  <h3 className="pl-ready-h3">{section}</h3>
                  <ul className="plb-pages">
                    {list.map((r) => (
                      <li key={r.id} className="pl2-nb pl2-nb--ready">
                        <div className="pl2-nb-head">
                          <span className="pl2-nb-ico"><IconNotebook /></span>
                          <div className="pl2-nb-main">
                            <div className="pl2-nb-name">{r.title}</div>
                            <div className="pl2-nb-meta">{metaLine(r)}</div>
                            {r.description && <div className="pl2-nb-desc">{r.description}</div>}
                          </div>
                        </div>
                        <div className="pl2-nb-tools" role="group" aria-label="Действия с тетрадью">
                          <Tool label={`Изменить тетрадь ${r.title}`} caption="Править" tone="pl2-tool--go" onClick={() => editReady(r)}><IconEditPage /></Tool>
                          <Tool label={`PDF тетради ${r.title}`} caption="PDF" onClick={() => toPdf(r)}><IconPdf /></Tool>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>

      <PrintPages notebook={printNb} byId={byId} />
      {pdf.node}
    </div>
  );
}
