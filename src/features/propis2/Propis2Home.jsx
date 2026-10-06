import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { pushOp } from "@/core/syncApi";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { kitToLibraryItems, layoutChange, methodNotebooks, newId, newPage, newSet, notebookLayout, pageFromPreset, pageFormat, pageMargin, pageToLines, pickFragment, setPageStarts, setToLines, taskGrid } from "@/topics/renderers/propis2/model.js";
import { SYNC_PREFIX, diffOps, mergeRemote, snapshotDocs, snapshotFromRemote } from "@/topics/renderers/propis2/syncLib.js";
import { applyLayout, clearDraft, emptyLibrary, isBlankNotebook, loadDraft, loadLibrary, mergeNotebook, migrateToNotebooks, presetsToNotebooks, removePage, removeSet, saveDraft, saveLibrary, setTitleOf, upsertPage, upsertSet } from "@/topics/renderers/propis2/storage.js";
import Propis2Library from "./Propis2Library";
import Propis2Editor from "./Propis2Editor";
import Propis2ShowPanel from "./Propis2ShowPanel";
import Propis2SaveDialog from "./Propis2SaveDialog";
import "./propis2.css";

// Home screen of «Прописи 2»: library -> editor -> student view. The library lives in IndexedDB on this device. A notebook that is
// opened or edited is worked on as a SESSION (a draft in memory, mirrored to this device): nothing reaches «Мои тетради» until the
// adult confirms (save button / the question when leaving), so opening an editor never leaves a «Новая тетрадь» behind.
export default function Propis2Home({ db }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const topicRecord = useAppStore((s) => s.topicRecords.find((r) => r.meta.id === activeTopicId));
  const [library, setLibrary] = useState(emptyLibrary);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState({ name: "library" });
  const [fragment, setFragment] = useState(null);
  const [shownPage, setShownPage] = useState(0); // the screen page the viewer shows (0-based), to edit exactly that page
  const [kits, setKits] = useState([]); // «Методика» kits: a big file, loaded when the topic opens, not with the app
  useEffect(() => { let alive = true; import("@/topics/renderers/propis2/kits.json").then((m) => { if (alive) setKits(m.default?.kits ?? []); }).catch(() => {}); return () => { alive = false; }; }, []);
  const saveTimer = useRef(null);
  const latest = useRef(library);
  latest.current = library;

  const [session, setSession] = useState(null); // the notebook being worked on: {sid, lib, base}; lib !== base means unsaved changes
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
      persist(migrateToNotebooks(presetsToNotebooks(mergeRemote(latest.current, res.kv))));
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
        const lib = migrateToNotebooks(presetsToNotebooks(raw));
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
  const startSession = (sid, lib = library) => setSession({ sid, lib, base: lib });
  const edit = (next) => setSession((cur) => (cur ? { ...cur, lib: next } : cur));
  const endSession = () => { setSession(null); setAsk(null); setFragment(null); setDraft(null); clearDraft(db).catch(() => {}); };
  const toLibrary = () => { endSession(); setView({ name: "library" }); };
  // what the adult confirmed goes into the library as THAT notebook only
  const keepSession = (name) => {
    const lib = name ? setTitleOf(session.lib, session.sid, name) : session.lib;
    persist(mergeNotebook(latest.current, lib, session.sid));
    return lib;
  };
  const requestLeave = () => { if (dirty) setAsk({ mode: "leave" }); else toLibrary(); };
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
    const lib = mergeNotebook(library, { sets: [draft.set], pages: draft.pages }, draft.sid);
    setSession({ sid: draft.sid, lib, base: library });
    setView({ name: "editor", pageId: draft.set.pageIds[0], backTo: { name: "library" } });
  };

  const openReady = (id) => { const r = readyAll.find((x) => x.id === id); if (!r) return; const { lib, set: st } = ownCopyOf(r.ps); startSession(st.id, lib); setView({ name: "showSet", setId: st.id, from: "library" }); };
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
  // (turning a page and opening the show panel re-render this screen).
  const showData = useMemo(() => {
    const isSet = view.name === "showSet" && set;
    if (!isSet && !(view.name === "show" && page)) return null;
    const ruling = isSet ? set.ruling : page.ruling;
    const lines = isSet ? setToLines(set, pagesById, glyphMap) : pageToLines(page, glyphMap);
    const gridSource = isSet ? pagesById.get(set.pageIds?.[0]) : page;
    const starts = isSet ? setPageStarts(set, pagesById, glyphMap) : [];
    const task = buildPageTask({ topicRecord, lines, narrowRows: ruling === "narrow", grid: gridSource ? taskGrid(gridSource) : undefined, midDash: gridSource?.midDash, margin: pageMargin(gridSource), format: pageFormat(gridSource) });
    return { isSet, ruling, gridSource, starts, task };
  }, [view.name, page, set, pagesById, glyphMap, topicRecord]);

  if (!loaded) return <div className="screen propis2-home" data-testid="propis2-loading" />;

  // Student view: one page, or a whole set as one booklet (pages padded to screen-page boundaries).
  if ((view.name === "show" && page) || (view.name === "showSet" && set)) {
    const { isSet, ruling, gridSource, starts, task } = showData;
    const editTarget = view.from === "editor" ? null : isSet ? set.pageIds[Math.max(0, starts.reduce((best, st, k) => (st != null && st <= shownPage + 1 ? k : best), 0))] : page.id;
    return (
      <div className="propis2-view" data-testid="propis2-view">
        <PrintPageView
          task={task}
          topNav
          onPageIndexChange={setShownPage}
          onClose={() => { setFragment(null); if (view.from === "editor") setView({ ...view, name: "editor" }); else requestLeave(); }}
          onFragmentTap={({ row, localX }) => setFragment(pickFragment(row.word, localX, glyphMap, ruling))}
        />
        {editTarget && (
          <button type="button" className="propis-ctrl-btn propis2-view-edit" aria-label="Изменить эту страницу" title="Изменить эту страницу" onClick={() => { setFragment(null); setView({ name: "editor", pageId: editTarget, backTo: isSet ? { name: "showSet", setId: set.id, from: view.from } : view.backTo }); }}>✎</button>
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
        topicRecord={topicRecord}
        onChange={(next) => {
          // paper settings are the whole notebook's, the rest is this page's
          const patch = navSet ? layoutChange(shown, next) : {};
          let lib = Object.keys(patch).length ? applyLayout(working, navSet.id, patch) : working;
          // a one-page notebook is named after its page
          if (navSet && navSet.pageIds.length === 1 && next.title !== shown.title) lib = upsertSet(lib, { ...lib.sets.find((st) => st.id === navSet.id), title: next.title });
          edit(upsertPage(lib, next));
        }}
        onBack={() => { const bt = view.backTo; if (bt && bt.name !== "library") setView(bt); else requestLeave(); }}
        dirty={dirty}
        onSave={onSaveClick}
        onShow={() => setView(navSet ? { name: "showSet", setId: navSet.id, pageId: page.id, from: "editor", backTo: view.backTo } : { name: "show", pageId: page.id, from: "editor", backTo: view.backTo })}
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
      onOpenSet={(id) => { startSession(id); setView({ name: "showSet", setId: id, from: "library" }); }}
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
