import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { pushOp } from "@/core/syncApi";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { NOTEBOOK_KEYS, PAGE_PAPER_KEYS, kitToLibraryItems, layoutChange, methodNotebooks, newId, newPage, newSet, notebookLayout, notebookSections, pageFromPreset, pageFormat, pageMargin, pageToLines, paperDiffers, pickFragment, rowsPerPage, setToLines, taskGrid } from "@/topics/renderers/propis2/model.js";
import { SYNC_PREFIX, diffOps, mergeRemote, snapshotDocs, snapshotFromRemote } from "@/topics/renderers/propis2/syncLib.js";
import { applyLayout, clearDraft, emptyLibrary, isBlankNotebook, loadDraft, loadLibrary, mergeNotebook, migrateToNotebooks, pagesTakeNotebookRuling, presetsToNotebooks, removePage, removeSet, saveDraft, saveLibrary, setTitleOf, upsertPage, upsertSet } from "@/topics/renderers/propis2/storage.js";
import Propis2Library from "./Propis2Library";
import Propis2Editor from "./Propis2Editor";
import Propis2ShowPanel from "./Propis2ShowPanel";
import Propis2SaveDialog from "./Propis2SaveDialog";
import Propis2PrintDialog from "./Propis2PrintDialog";
import CoverSide from "./cover/CoverSide.jsx";
import { migrateLegacy, normalizeCover } from "./cover/coverConfig.js";
import { setBackInterceptor } from "@/shared/navigation/backInterceptor";
import "./propis2.css";

// Home screen of «Прописи 2»: library -> editor -> student view. The library lives in IndexedDB on this device. A notebook that is
// opened or edited is worked on as a SESSION (a draft in memory, mirrored to this device): nothing reaches «Мои тетради» until the
// adult confirms (save button / the question when leaving), so opening an editor never leaves a «Новая тетрадь» behind.
const UNDO_TYPING_MS = 1000;
const UNDO_DEPTH = 200;

export default function Propis2Home({ db }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const topicRecord = useAppStore((s) => s.topicRecords.find((r) => r.meta.id === activeTopicId));
  const [library, setLibrary] = useState(emptyLibrary);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState({ name: "library" });
  const [fragment, setFragment] = useState(null);
  const [shownPage, setShownPage] = useState(0); // the screen page the viewer shows (0-based, whole notebook), to edit exactly that page
  // the student view of a notebook shows one run of pages on the same paper at a time (model.js notebookSections): which run, and on
  // which of its pages it opens (a page index in the run, or "last" when coming back from the next run)
  const [part, setPart] = useState({ index: 0, startAt: 0 });
  const [partPages, setPartPages] = useState({}); // screen pages each run really takes, as the viewer reports them (by its page ids)
  // printing: the dialog (cover, page numbers) first; the choice is remembered per notebook on this device
  const [printAsk, setPrintAsk] = useState(false);
  const [printRun, setPrintRun] = useState(0); // bumped to print once the chosen cover is on the (hidden) print sheets
  const [printCfgs, setPrintCfgs] = useState(() => readPrintCfgs());
  const [kits, setKits] = useState([]); // «Методика» kits: a big file, loaded when the topic opens, not with the app
  useEffect(() => { let alive = true; import("@/topics/renderers/propis2/kits.json").then((m) => { if (alive) setKits(m.default?.kits ?? []); }).catch(() => {}); return () => { alive = false; }; }, []);
  const saveTimer = useRef(null);
  const latest = useRef(library);
  latest.current = library;

  // the notebook being worked on: {sid, lib, base, past, future}; lib !== base means unsaved changes. past / future: the undo / redo
  // history of this session, entries {lib, pageId} (the whole notebook as it was, and the page that was open: undo goes back there)
  const [session, setSession] = useState(null);
  const [ask, setAsk] = useState(null); // the confirmation dialog: {mode: "leave" | "save"}
  const [draft, setDraft] = useState(null); // an unsaved notebook a closed app left on this device
  const working = session ? session.lib : library;
  const dirty = Boolean(session && session.lib !== session.base);
  const isNewNb = Boolean(session && !library.sets.some((st) => st.id === session.sid));

  const syncedRef = useRef(new Map()); // what the account is known to hold, per document (see syncLib.js)

  // Autosave: debounced write after every change, flushed when the screen goes away. The same tick sends what changed
  // (pages, sets, presets, deletions) to the account through the offline queue.
  const flush = useCallback(() => {
    saveLibrary(latest.current, db).catch(() => {});
    const { ops, next } = diffOps(syncedRef.current, latest.current);
    syncedRef.current = next;
    for (const op of ops) pushOp("kv.upsert", op).catch(() => {});
  }, [db]);
  const persist = useCallback((next) => {
    setLibrary(next);
    latest.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 300);
  }, [flush]);

  // Pull the account's documents (last write wins per document); whatever the account lacks or has older goes up with the next flush.
  const pullRemote = useCallback(async () => {
    try {
      const res = await api.get(`/account/kv?prefix=${encodeURIComponent(SYNC_PREFIX)}`);
      if (!Array.isArray(res?.kv)) return;
      syncedRef.current = snapshotFromRemote(res.kv);
      persist(pagesTakeNotebookRuling(migrateToNotebooks(presetsToNotebooks(mergeRemote(latest.current, res.kv)))));
    } catch {
      // offline or signed out: the local library keeps working, the queue catches up later
    }
  }, [persist]);

  useEffect(() => {
    let alive = true;
    loadLibrary(db)
      .then((raw) => {
        if (!alive) return;
        // no page lives outside a notebook: what was saved loose becomes a notebook of one page (and goes up with the next flush)
        const lib = pagesTakeNotebookRuling(migrateToNotebooks(presetsToNotebooks(raw)));
        syncedRef.current = snapshotDocs(raw);
        latest.current = lib;
        setLibrary(lib);
        setLoaded(true);
        if (lib !== raw) persist(lib);
        pullRemote();
        loadDraft(db).then((d) => { if (alive) setDraft(d); }).catch(() => {});
      })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [db, pullRemote, persist]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") pullRemote(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pullRemote]);
  useEffect(() => () => { clearTimeout(saveTimer.current); flush(); }, [flush]);

  const sheets = useMemo(() => topicRecord?.wideSheets ?? {}, [topicRecord]);
  const elementLabels = useMemo(() => new Set([...(topicRecord?.elements ?? []).map((e) => e.id), ...(topicRecord?.wide ?? []).filter((g) => g.kind === "element").map((g) => g.label)]), [topicRecord]);
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  // the methodology workbook as two ready notebooks: part 1 on the WIDE ruling, part 2 on the NARROW one (data.js)
  const methodKits = useMemo(() => methodNotebooks(sheets, elementLabels), [sheets, elementLabels]);
  const kitPresets = useMemo(() => [...methodKits, ...kits].map((k) => ({ id: `kit:${k.id}`, title: k.title, kit: k, builtin: true })), [methodKits, kits]);
  const readyAll = useMemo(() => kitPresets.map((ps) => ({ id: ps.id, title: ps.title, pages: ps.kit ? ps.kit.pages.length : 1, ps })), [kitPresets]);
  const takenIds = useMemo(() => new Set(library.sets.map((st) => st.sourceId ?? (st.kit ? `kit:${st.kit}` : null)).filter(Boolean)), [library.sets]);
  const ready = useMemo(() => readyAll.filter((r) => !takenIds.has(r.id)), [readyAll, takenIds]);
  const ownCopyOf = (ps) => {
    const existing = library.sets.find((st) => (st.sourceId ?? (st.kit ? `kit:${st.kit}` : null)) === ps.id);
    if (existing) return { lib: library, set: existing };
    if (ps.kit) {
      const { set: ns, pages: nps } = kitToLibraryItems(ps.kit);
      return { lib: upsertSet(nps.reduce((lib, pg) => upsertPage(lib, pg), library), ns), set: ns };
    }
    const pg = pageFromPreset(ps);
    const nb = newSet(pg.title, { id: `st_${pg.id}`, ruling: pg.ruling, pageIds: [pg.id], createdAt: pg.createdAt, sourceId: ps.id });
    return { lib: upsertSet(upsertPage(library, pg), nb), set: nb };
  };
  // ---- the session of a notebook: open it, work on it, confirm or drop ----
  const startSession = (sid, lib = library) => setSession({ sid, lib, base: lib, past: [], future: [] });
  // Every change of the notebook goes through here and can be undone. Typing (`typing`: the text field, the title) is ONE step while
  // the keys come less than UNDO_TYPING_MS apart, as in a text editor; anything else is a step of its own.
  const lastTyping = useRef(0);
  const edit = (next, { typing = false } = {}) => {
    const now = Date.now();
    const join = typing && now - lastTyping.current < UNDO_TYPING_MS;
    lastTyping.current = typing ? now : 0;
    const pageId = view.pageId ?? null;
    setSession((cur) => {
      if (!cur || next === cur.lib) return cur;
      const past = join && cur.past.length ? cur.past : [...cur.past, { lib: cur.lib, pageId }].slice(-UNDO_DEPTH);
      return { ...cur, lib: next, past, future: [] };
    });
  };
  // the page to show after a step back/forward: the one open when that change was made, or one that still exists in the notebook
  const pageAfter = (lib, wanted) => {
    if (wanted && lib.pages.some((p) => p.id === wanted)) return wanted;
    return lib.sets.find((st) => st.id === session?.sid)?.pageIds[0] ?? null;
  };
  const undo = () => {
    if (!session?.past.length) return;
    lastTyping.current = 0;
    const { lib, pageId } = session.past[session.past.length - 1];
    setSession({ ...session, lib, past: session.past.slice(0, -1), future: [{ lib: session.lib, pageId: view.pageId ?? null }, ...session.future] });
    const to = pageAfter(lib, pageId);
    if (to && to !== view.pageId) setView({ ...view, pageId: to });
  };
  const redo = () => {
    if (!session?.future.length) return;
    lastTyping.current = 0;
    const { lib, pageId } = session.future[0];
    setSession({ ...session, lib, past: [...session.past, { lib: session.lib, pageId: view.pageId ?? null }], future: session.future.slice(1) });
    const to = pageAfter(lib, pageId);
    if (to && to !== view.pageId) setView({ ...view, pageId: to });
  };
  const endSession = () => { setSession(null); setAsk(null); setFragment(null); setDraft(null); clearDraft(db).catch(() => {}); };
  const toLibrary = () => { endSession(); setView({ name: "library" }); };
  // what the adult confirmed goes into the library as THAT notebook only
  const keepSession = (name) => {
    const lib = name ? setTitleOf(session.lib, session.sid, name) : session.lib;
    persist(mergeNotebook(latest.current, lib, session.sid));
    return lib;
  };
  const requestLeave = () => { if (dirty) setAsk({ mode: "leave" }); else toLibrary(); };
  // The system Back button does what the on-screen back does: close the question / the show panel, step out of the viewer or
  // the editor (asking to save unsaved work), and only from the library leave the topic.
  useEffect(() => {
    setBackInterceptor(() => {
      if (ask) { setAsk(null); return true; }
      if (fragment) { setFragment(null); return true; }
      if (view.name === "editor") { const bt = view.backTo; if (bt && bt.name !== "library") setView(bt); else requestLeave(); return true; }
      if (view.name === "show" || view.name === "showSet") { if (view.from === "editor") setView({ ...view, name: "editor" }); else requestLeave(); return true; }
      return false;
    });
    return () => setBackInterceptor(null);
  });
  const onSaveClick = () => {
    if (!session || !dirty) return;
    if (isNewNb) { setAsk({ mode: "save" }); return; }
    const lib = keepSession();
    setSession((cur) => (cur ? { ...cur, lib, base: lib } : cur));
    clearDraft(db).catch(() => {});
  };
  const sessionSet = session ? session.lib.sets.find((st) => st.id === session.sid) : null;
  const dialog = ask && session ? (
    <Propis2SaveDialog
      mode={ask.mode}
      isNew={isNewNb}
      defaultName={sessionSet?.title ?? ""}
      onSave={(name) => {
        const lib = keepSession(name);
        if (ask.mode === "leave") toLibrary();
        else { setSession((cur) => (cur ? { ...cur, lib, base: lib } : cur)); setAsk(null); clearDraft(db).catch(() => {}); }
      }}
      onDiscard={toLibrary}
      onStay={() => setAsk(null)}
    />
  ) : null;
  // the unsaved notebook is mirrored to this device (not to the account) while it differs from what is saved
  useEffect(() => {
    if (!session || session.lib === session.base) return undefined;
    const t = setTimeout(() => {
      const st = session.lib.sets.find((x) => x.id === session.sid);
      if (st) saveDraft({ sid: session.sid, set: st, pages: st.pageIds.map((id) => session.lib.pages.find((pg) => pg.id === id)).filter(Boolean), savedAt: Date.now() }, db).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [session, db]);
  const resumeDraft = () => {
    if (!draft) return;
    const lib = pagesTakeNotebookRuling(mergeNotebook(library, { sets: [draft.set], pages: draft.pages }, draft.sid));
    setSession({ sid: draft.sid, lib, base: library, past: [], future: [] });
    setView({ name: "editor", pageId: draft.set.pageIds[0], backTo: { name: "library" } });
  };

  // the student view of a notebook, opened on its first page or on the page `pageId`
  const showNotebook = (st, pagesByIdNow, extra, pageId = null) => {
    const secs = notebookSections(st, pagesByIdNow, glyphMap);
    const at = Math.max(0, secs.findIndex((sec) => sec.pageIds.includes(pageId)));
    let startAt = 0;
    if (pageId && secs[at]) for (const id of secs[at].pageIds) { if (id === pageId) break; startAt += screenPagesOf(pagesByIdNow.get(id)); }
    setPart({ index: at, startAt });
    setPartPages({});
    setShownPage(0);
    setView({ name: "showSet", setId: st.id, ...extra });
  };
  const screenPagesOf = (pg) => Math.max(1, Math.ceil(pageToLines(pg, glyphMap).length / rowsPerPage(pg)));
  const openReady = (id) => { const r = readyAll.find((x) => x.id === id); if (!r) return; const { lib, set: st } = ownCopyOf(r.ps); startSession(st.id, lib); showNotebook(st, new Map(lib.pages.map((p) => [p.id, p])), { from: "library" }); };
  const editReady = (id) => { const r = readyAll.find((x) => x.id === id); if (!r) return; const { lib, set: st } = ownCopyOf(r.ps); startSession(st.id, lib); setView({ name: "editor", pageId: st.pageIds[0], backTo: { name: "library" } }); };
  // a new page is a notebook of one page (there is no page outside a notebook); it is not in the list until it is confirmed
  const createPage = (p) => {
    const nb = newSet(p.title, { id: `st_${p.id}`, ruling: p.ruling, pageIds: [p.id], createdAt: p.createdAt });
    startSession(nb.id, upsertSet(upsertPage(library, p), nb));
    setView({ name: "editor", pageId: p.id, backTo: { name: "library" } });
  };
  const page = view.pageId ? working.pages.find((p) => p.id === view.pageId) : null;
  const set = view.setId ? working.sets.find((st) => st.id === view.setId) : null;
  const pagesById = useMemo(() => new Map(working.pages.map((p) => [p.id, p])), [working.pages]);
  const blankIds = useMemo(() => {
    const byId = new Map(library.pages.map((p) => [p.id, p]));
    return library.sets.filter((st) => isBlankNotebook(st, byId)).map((st) => st.id);
  }, [library.sets, library.pages]);

  // The student view's layout is heavy (a whole set: hundreds of rows): built once per content, not on every render
  // (turning a page and opening the show panel re-render this screen). A notebook is laid out one run of pages on the same paper at
  // a time (each on its own paper); a notebook on one paper is one run, the whole notebook at once as before.
  const sections = useMemo(() => {
    if (!(view.name === "showSet" && set)) return null;
    const secs = notebookSections(set, pagesById, glyphMap);
    let start = 0;
    for (const sec of secs) { sec.start = start; start += partPages[sec.pageIds.join()] ?? sec.pages; }
    return { list: secs, total: start };
  }, [view.name, set, pagesById, glyphMap, partPages]);
  const partIndex = sections ? Math.min(part.index, Math.max(0, sections.list.length - 1)) : 0;
  const partSec = sections?.list[partIndex] ?? null;
  // the runs' pages and paper (not their page counts): the tasks are rebuilt only when these change
  const runsKey = sections ? sections.list.map((sec) => `${sec.key}|${sec.pageIds.join()}`).join("/") : "";
  const taskOf = useCallback((paper, lines) => buildPageTask({ topicRecord, lines, narrowRows: paper.ruling === "narrow", grid: taskGrid(paper), midDash: paper.midDash, margin: pageMargin(paper), format: pageFormat(paper) }), [topicRecord]);
  // one task per run: the viewer shows the open one, printing prints them all
  const runTasks = useMemo(
    () => (sections ? sections.list.map((sec) => taskOf(sec.paper, setToLines(set, pagesById, glyphMap, sec.pageIds))) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runsKey, set, pagesById, glyphMap, taskOf],
  );
  const showData = useMemo(() => {
    const isSet = view.name === "showSet" && set;
    if (!isSet && !(view.name === "show" && page)) return null;
    if (isSet && !partSec) return null;
    const paper = isSet ? partSec.paper : page;
    const task = isSet ? runTasks[partIndex] : taskOf(page, pageToLines(page, glyphMap));
    return { isSet, ruling: paper.ruling, gridSource: paper, task };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.name, page, set, runTasks, partIndex, glyphMap, taskOf]);
  // the cover: the notebook's own (`set.cover`, synced with it; a notebook printed before keeps the design remembered on this device),
  // drawn with the notebook's name and first rows (its own paper)
  const printKey = view.name === "showSet" && set ? set.id : view.name === "show" && page ? page.id : null;
  const printTitle = view.name === "showSet" && set ? set.title : page?.title ?? "";
  const coverFirstPage = view.name === "showSet" && set ? pagesById.get(set.pageIds[0]) : page;
  const coverSet = view.name === "showSet" ? set : page ? working.sets.find((st) => st.pageIds.includes(page.id)) ?? null : null;
  const squaredFirst = Boolean(coverFirstPage) && taskGrid(coverFirstPage) === "square";
  const coverNotebook = useMemo(() => {
    if (!printKey || !coverFirstPage) return null;
    const sample = view.name === "showSet" ? runTasks?.[0] : taskOf(coverFirstPage, pageToLines(coverFirstPage, glyphMap));
    return { title: printTitle, sampleTask: sample, a4: pageFormat(coverFirstPage) === "a4", topicRecord };
  }, [printKey, printTitle, coverFirstPage, view.name, runTasks, taskOf, glyphMap, topicRecord]);
  const printCfg = { numbers: true, ...(printKey ? printCfgs[printKey] : null) };
  const cover = useMemo(
    () => normalizeCover(coverSet?.cover ?? migrateLegacy(printCfg.cover, { squared: squaredFirst }), { squared: squaredFirst }),
    [coverSet?.cover, printCfg.cover, squaredFirst],
  );
  // the chosen cover goes into the notebook: into the library when the notebook is there, and into the open session (so saving it later
  // keeps it) without making the session unsaved when it was not
  const saveCover = (next) => {
    if (!coverSet) return;
    const withCover = (lib) => ({ ...lib, sets: lib.sets.map((st) => (st.id === coverSet.id ? { ...st, cover: next, updatedAt: Date.now() } : st)) });
    const inLibrary = library.sets.find((st) => st.id === coverSet.id);
    if (inLibrary) persist(upsertSet(library, { ...inLibrary, cover: next }));
    setSession((cur) => {
      if (!cur || !cur.lib.sets.some((st) => st.id === coverSet.id)) return cur;
      const lib = withCover(cur.lib);
      return { ...cur, lib, base: cur.base === cur.lib ? lib : inLibrary ? withCover(cur.base) : cur.base };
    });
  };
  useEffect(() => {
    if (!printRun) return undefined;
    const t = setTimeout(() => window.print(), 60);
    return () => clearTimeout(t);
  }, [printRun]);
  const onPartPages = useCallback((n) => {
    const k = partSec?.pageIds.join();
    if (k) setPartPages((cur) => (cur[k] === n ? cur : { ...cur, [k]: n }));
  }, [partSec]);

  if (!loaded) return <div className="screen propis2-home" data-testid="propis2-loading" />;

  // Student view: one page, or a whole set as one booklet (pages padded to screen-page boundaries).
  if ((view.name === "show" && page) || (view.name === "showSet" && set)) {
    const { isSet, ruling, gridSource, task } = showData;
    // the page of the notebook on the screen page shown: within the run, by the screen pages each of its pages takes
    let editTarget = isSet ? partSec.pageIds[0] : page.id;
    if (isSet) { let at = partSec.start; for (const id of partSec.pageIds) { if (at > shownPage) break; editTarget = id; at += screenPagesOf(pagesById.get(id)); } }
    if (view.from === "editor") editTarget = null;
    return (
      <div className="propis2-view" data-testid="propis2-view">
        <PrintPageView
          key={isSet ? `${set.id}:${partIndex}:${part.startAt}` : page.id}
          task={task}
          topNav
          onPageIndexChange={setShownPage}
          onPrint={() => setPrintAsk(true)}
          printCover={cover.enabled && coverNotebook ? <CoverSide side="front" cover={cover} notebook={coverNotebook} /> : null}
          printBack={cover.enabled && cover.back.kind !== "none" && coverNotebook ? <CoverSide side="back" cover={cover} notebook={coverNotebook} /> : null}
          pageNumbers={printCfg.numbers}
          {...(isSet ? {
            pageBase: partSec.start,
            pageTotal: sections.total,
            startAt: part.startAt,
            onPageCount: onPartPages,
            printParts: runTasks.length > 1 ? runTasks : null,
            onEdge: (dir) => { setFragment(null); setPart({ index: partIndex + dir, startAt: dir < 0 ? "last" : 0 }); },
          } : {})}
          onClose={() => { setFragment(null); if (view.from === "editor") setView({ ...view, name: "editor" }); else requestLeave(); }}
          onFragmentTap={({ row, localX }) => setFragment(pickFragment(row.word, localX, glyphMap, ruling))}
        />
        {editTarget && (
          <button type="button" className="propis-ctrl-btn propis2-view-edit" aria-label="Изменить эту страницу" title="Изменить эту страницу" onClick={() => { setFragment(null); setView({ name: "editor", pageId: editTarget, backTo: isSet ? { name: "showSet", setId: set.id, from: view.from } : view.backTo }); }}>✎</button>
        )}
        {printAsk && coverNotebook && (
          <Propis2PrintDialog
            title={printTitle}
            pages={isSet ? sections.total : Math.max(1, Math.ceil(pageToLines(page, glyphMap).length / rowsPerPage(page)))}
            cover={cover}
            numbers={printCfg.numbers}
            notebook={coverNotebook}
            onCancel={() => setPrintAsk(false)}
            onPrint={({ cover: chosen, numbers }) => {
              saveCover(chosen);
              const next = { ...printCfgs, [printKey]: { numbers } };
              setPrintCfgs(next);
              writePrintCfgs(next);
              setPrintAsk(false);
              setPrintRun((n) => n + 1);
            }}
          />
        )}
        {fragment && (
          <Propis2ShowPanel fragment={fragment} topicRecord={topicRecord} ruling={ruling} grid={gridSource ? taskGrid(gridSource) : undefined} midDash={gridSource?.midDash} onClose={() => setFragment(null)} />
        )}
        {dialog}
      </div>
    );
  }

  if (view.name === "editor" && page) {
    // every page is in a notebook: the editor pages through its pages, adds / copies / deletes them, and the paper is the notebook's
    const navSet = working.sets.find((st) => st.pageIds.includes(page.id)) ?? null;
    const navIndex = navSet ? navSet.pageIds.indexOf(page.id) : -1;
    const goPage = (id) => id && setView({ ...view, pageId: id });
    const shown = navSet ? { ...page, ...notebookLayout(navSet, pagesById) } : page;
    const nav = navSet && navIndex >= 0 ? {
      index: navIndex,
      total: navSet.pageIds.length,
      onPrev: () => goPage(navSet.pageIds[navIndex - 1]),
      onNext: () => goPage(navSet.pageIds[navIndex + 1]),
      onMoveBefore: () => { const ids = [...navSet.pageIds]; [ids[navIndex - 1], ids[navIndex]] = [ids[navIndex], ids[navIndex - 1]]; edit(upsertSet(working, { ...navSet, pageIds: ids })); },
      onMoveAfter: () => { const ids = [...navSet.pageIds]; [ids[navIndex + 1], ids[navIndex]] = [ids[navIndex], ids[navIndex + 1]]; edit(upsertSet(working, { ...navSet, pageIds: ids })); },
      onAdd: () => {
        // a blank page with the notebook's paper, right after this one
        const { id: _id, title: _t, rows: _r, createdAt: _c, updatedAt: _u, locked: _l, presetId: _p, ...layout } = shown;
        const fresh = newPage(`Страница ${navSet.pageIds.length + 1}`, layout);
        const pageIds = [...navSet.pageIds.slice(0, navIndex + 1), fresh.id, ...navSet.pageIds.slice(navIndex + 1)];
        edit(upsertSet(upsertPage(working, fresh), { ...navSet, pageIds }));
        goPage(fresh.id);
      },
      onDuplicate: () => {
        const copy = { ...page, id: newId("pg"), title: `${page.title} (копия)`, rows: page.rows.map((r) => ({ ...r, id: newId("r") })), createdAt: Date.now() };
        const pageIds = [...navSet.pageIds.slice(0, navIndex + 1), copy.id, ...navSet.pageIds.slice(navIndex + 1)];
        edit(upsertSet(upsertPage(working, copy), { ...navSet, pageIds }));
        goPage(copy.id);
      },
      onDelete: () => {
        const last = navSet.pageIds.length === 1;
        const ask = last ? `Удалить тетрадь «${navSet.title || page.title}»?` : `Удалить страницу «${page.title}» из тетради?`;
        if (typeof window !== "undefined" && window.confirm && !window.confirm(ask)) return;
        if (last) { persist(mergeNotebook(latest.current, removeSet(working, navSet.id), session.sid)); toLibrary(); return; }
        const pageIds = navSet.pageIds.filter((id) => id !== page.id);
        edit(upsertSet(removePage(working, page.id), { ...navSet, pageIds }));
        goPage(pageIds[Math.min(navIndex, pageIds.length - 1)]);
      },
    } : null;
    return (
      <>
      <Propis2Editor
        key={page.id}
        nav={nav}
        page={shown}
        title={navSet ? navSet.title : undefined}
        onTitle={navSet ? (t) => edit(upsertSet(working, { ...navSet, title: t }), { typing: true }) : undefined}
        topicRecord={topicRecord}
        onChange={(next, how) => {
          // the format is the whole notebook's (one booklet when printed); the rest of the paper and the rows are this page's
          const change = navSet ? layoutChange(shown, next) : {};
          const patch = Object.fromEntries(Object.entries(change).filter(([k]) => NOTEBOOK_KEYS.includes(k)));
          let lib = Object.keys(patch).length ? applyLayout(working, navSet.id, patch) : working;
          // a one-page notebook is named after its page
          if (navSet && navSet.pageIds.length === 1 && next.title !== shown.title) lib = upsertSet(lib, { ...lib.sets.find((st) => st.id === navSet.id), title: next.title });
          edit(upsertPage(lib, next), how);
        }}
        paperToAll={navSet && navSet.pageIds.length > 1 ? {
          differs: paperDiffers(navSet, pagesById, shown),
          apply: () => edit(applyLayout(working, navSet.id, Object.fromEntries(PAGE_PAPER_KEYS.map((k) => [k, shown[k]])))),
        } : null}
        onUndo={undo}
        onRedo={redo}
        canUndo={Boolean(session?.past.length)}
        canRedo={Boolean(session?.future.length)}
        onBack={() => { const bt = view.backTo; if (bt && bt.name !== "library") setView(bt); else requestLeave(); }}
        dirty={dirty}
        onSave={onSaveClick}
        onShow={() => (navSet ? showNotebook(navSet, pagesById, { pageId: page.id, from: "editor", backTo: view.backTo }, page.id) : setView({ name: "show", pageId: page.id, from: "editor", backTo: view.backTo }))}
      />
      {dialog}
      </>
    );
  }

  return (
    <Propis2Library
      sets={library.sets}
      draft={draft}
      blankCount={blankIds.length}
      onResumeDraft={resumeDraft}
      onDropDraft={() => { setDraft(null); clearDraft(db).catch(() => {}); }}
      onDropBlank={() => persist(blankIds.reduce((lib, id) => removeSet(lib, id), library))}
      onBack={() => setScreen("home")}
      onNew={() => createPage(newPage("Новая тетрадь"))}
      ready={ready}
      onOpenReady={openReady}
      onEditReady={editReady}
      onOpenSet={(id) => { const st = library.sets.find((x) => x.id === id); if (!st) return; startSession(id); showNotebook(st, new Map(library.pages.map((p) => [p.id, p])), { from: "library" }); }}
      onEditSet={(id) => { const st = library.sets.find((x) => x.id === id); if (st?.pageIds[0]) { startSession(id); setView({ name: "editor", pageId: st.pageIds[0], backTo: { name: "library" } }); } }}
      onRenameSet={(id, title) => { const st = library.sets.find((x) => x.id === id); if (st) persist(upsertSet(library, { ...st, title })); }}
      onDuplicateSet={(id) => {
        const src = library.sets.find((st) => st.id === id);
        if (!src) return;
        // a notebook owns its pages: a copy of it gets copies of them
        const copy = { ...src, id: newId("st"), title: `${src.title} (копия)`, createdAt: Date.now() };
        const own = src.pageIds.map((pid) => library.pages.find((p) => p.id === pid)).filter(Boolean);
        const copies = own.map((p) => ({ ...p, id: newId("pg"), kitId: copy.id, rows: p.rows.map((r) => ({ ...r, id: newId("r") })), createdAt: Date.now() }));
        copy.pageIds = copies.map((p) => p.id);
        persist(upsertSet(copies.reduce((l, p) => upsertPage(l, p), library), copy));
      }}
      onDeleteSet={(id) => persist(removeSet(library, id))}
    />
  );
}

// page numbers per notebook: a convenience of this device, not part of the notebook (the cover is the notebook's: `set.cover`;
// the first version kept the cover design here too, `cover`, read once as the cover of a notebook that has none yet)
const PRINT_CFG_KEY = "propis2:print";
function readPrintCfgs() {
  try { return JSON.parse(localStorage.getItem(PRINT_CFG_KEY) ?? "{}") ?? {}; } catch { return {}; }
}
function writePrintCfgs(cfgs) {
  try { localStorage.setItem(PRINT_CFG_KEY, JSON.stringify(cfgs)); } catch { /* private mode: not remembered */ }
}
