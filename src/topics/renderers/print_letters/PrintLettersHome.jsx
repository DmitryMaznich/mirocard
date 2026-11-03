import { useEffect, useMemo, useRef, useState } from "react";
import ConstructorView from "./ConstructorView";
import PageThumb from "./PageThumb";
import PrintPages from "./PrintPages";
import { NARROW_QUERY, useMediaQuery } from "./hooks";
import {
  SYNC_PREFIX, clearDraft, copyNotebook, docFor, docKey, loadDraft, loadLocal, mergeRemote, newNotebook, notebookJson,
  putNotebook, readyNotebooks, removeNotebook, saveDraft, saveLocal, sortedNotebooks,
} from "./library";
import { IconClose, IconDuplicate, IconEdit, IconNewNotebook, IconPrint, IconTrash } from "./icons";

const MONTHS = ["янв.", "февр.", "марта", "апр.", "мая", "июня", "июля", "авг.", "сент.", "окт.", "нояб.", "дек."];

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

const metaLine = (nb) => `${nb.pages.length} стр. · ${(nb.format ?? "a4").toUpperCase().replace("A", "А")}`;

// «Печатные буквы» home: «Мои тетради» → the editor of one notebook. The
// architecture of propis2's own home (Propis2Home/Propis2Library), without
// its options: a notebook opened for editing is a SESSION — a working copy
// with the saved version beside it; nothing reaches «Мои тетради» until
// «Сохранить» (or the question when leaving), and the working copy is
// mirrored to this device as a draft so a closed app loses nothing.
export default function PrintLettersHome({ task, onAdvance, accountKv }) {
  const letters = task?.letters ?? [];
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
  const narrow = useMediaQuery(NARROW_QUERY);

  const [lib, setLibState] = useState(loadLocal);
  const libRef = useRef(lib);
  const setLib = (next) => { libRef.current = next; setLibState(next); saveLocal(next); };

  // the notebook being edited: { nb, base } — base is the saved version's JSON (null: never saved)
  const [session, setSession] = useState(null);
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

  // Printing from the list: render that notebook's sheets, print, drop them.
  useEffect(() => {
    if (!printNb) return undefined;
    const t = setTimeout(() => { window.print(); setPrintNb(null); }, 50);
    return () => clearTimeout(t);
  }, [printNb]);

  function open(nb, isNew = false) {
    setSession({ nb, base: isNew ? null : notebookJson(nb) });
    setDraft(null);
  }
  function close() {
    setSession(null);
    setLeaveAsk(false);
    clearDraft();
  }
  function save() {
    if (!session) return null;
    const nb = { ...session.nb, title: session.nb.title.trim() || "Без названия", updatedAt: Date.now() };
    const next = putNotebook(libRef.current, nb);
    setLib(next);
    push(nb.id, next);
    setSession({ nb, base: notebookJson(nb) });
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
  function takeReady(r) {
    const cp = copyNotebook(r);
    const next = putNotebook(libRef.current, cp);
    setLib(next);
    push(cp.id, next);
    open(cp);
  }
  function resumeDraft() {
    const saved = libRef.current.notebooks.find((n) => n.id === draft.nb.id);
    setSession({ nb: draft.nb, base: !draft.isNew && saved ? notebookJson(saved) : null });
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
          onChange={(fn) => setSession((s) => (s ? { ...s, nb: fn(s.nb) } : s))}
          byId={byId}
          families={families}
          dirty={dirty}
          onSave={save}
          onBack={back}
        />
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
  const Tool = ({ label, caption, tone = "", onClick, children }) => (
    <button type="button" className={`pl-lib-tool ${tone}`} aria-label={label} title={label} onClick={onClick}>
      {children}{!narrow && <span>{caption}</span>}
    </button>
  );

  return (
    <div className={`pl-lib${narrow ? " is-narrow" : ""}`}>
      <div className="pl-header no-print">
        <span className="pl-header-title">Печатные буквы</span>
        <span className="pl-header-fill" />
        {onAdvance && (
          <button type="button" className="pl-header-btn" onClick={onAdvance}><IconClose /><span>Завершить</span></button>
        )}
      </div>

      <div className="pl-lib-body no-print">
        {draft && (
          <div className="pl-banner" role="status">
            <span>Не сохранена тетрадь «{draft.nb.title.trim() || "Без названия"}»</span>
            <button type="button" className="pl-banner-go" onClick={resumeDraft}>Продолжить</button>
            <button type="button" className="pl-banner-drop" onClick={dropDraft}>Удалить</button>
          </div>
        )}

        <button type="button" className="pl-lib-new" onClick={() => open(newNotebook(), true)}>
          <IconNewNotebook /> Новая тетрадь
        </button>

        {mine.length > 0 && <h2 className="pl-lib-h2">Мои тетради</h2>}
        {mine.length > 0 && (
          <ul className="pl-lib-grid">
            {mine.map((nb) => (
              <li key={nb.id} className="pl-lib-card">
                <div className="pl-lib-card-main">
                  <PageThumb page={nb.pages[0]} format={nb.format} byId={byId} index={0} hideNumber label={`Открыть тетрадь ${nb.title}`} onSelect={() => open(nb)} />
                  <div className="pl-lib-card-text">
                    <span className="pl-lib-card-title">{nb.title}</span>
                    <span className="pl-lib-meta">{metaLine(nb)} · {dateLabel(nb.updatedAt)}</span>
                  </div>
                </div>
                <div className="pl-lib-tools" role="group" aria-label={`Действия с тетрадью ${nb.title}`}>
                  <Tool label={`Править тетрадь ${nb.title}`} caption="Править" tone="is-go" onClick={() => open(nb)}><IconEdit /></Tool>
                  <Tool label={`Печать тетради ${nb.title}`} caption="Печать" onClick={() => setPrintNb(nb)}><IconPrint /></Tool>
                  <Tool label={`Копия тетради ${nb.title}`} caption="Копия" onClick={() => copy(nb)}><IconDuplicate /></Tool>
                  <Tool label={`Удалить тетрадь ${nb.title}`} caption="Удалить" tone="is-danger" onClick={() => remove(nb)}><IconTrash /></Tool>
                </div>
              </li>
            ))}
          </ul>
        )}

        {ready.length > 0 && (
          <>
            <div className="pl-lib-h2row">
              <h2 className="pl-lib-h2">Готовые тетради</h2>
              <span className="pl-lib-meta">«Взять в мои» кладёт копию в «Мои тетради» — её можно менять, готовая остаётся как была</span>
            </div>
            <ul className="pl-lib-grid pl-lib-grid--ready">
              {ready.map((r) => (
                <li key={r.id} className="pl-lib-card is-ready">
                  <div className="pl-lib-card-main">
                    <PageThumb page={r.pages[0]} format={r.format} byId={byId} index={0} hideNumber label={`Взять тетрадь ${r.title}`} onSelect={() => takeReady(r)} />
                    <div className="pl-lib-card-text">
                      <span className="pl-lib-card-title">{r.title}</span>
                      <span className="pl-lib-meta">{metaLine(r)}</span>
                    </div>
                  </div>
                  <p className="pl-lib-desc">{r.description}</p>
                  <div className="pl-lib-tools" role="group" aria-label={`Действия с готовой тетрадью ${r.title}`}>
                    <button type="button" className="pl-lib-take" onClick={() => takeReady(r)}>Взять в мои</button>
                    <Tool label={`Печать тетради ${r.title}`} caption="Печать" onClick={() => setPrintNb(r)}><IconPrint /></Tool>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <PrintPages notebook={printNb} byId={byId} />
    </div>
  );
}
