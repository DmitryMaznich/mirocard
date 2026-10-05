import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { pushOp } from "@/core/syncApi";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { PROPIS2_SHEET_TITLES } from "@/topics/renderers/propis2/data.js";
import { kitToLibraryItems, newId, newPage, newSet, pageFromPreset, pageFormat, pageMargin, pageToLines, presetFromLines, presetFromPage, pickFragment, setPageStarts, setToLines, taskGrid } from "@/topics/renderers/propis2/model.js";
import { SYNC_PREFIX, diffOps, mergeRemote, snapshotDocs, snapshotFromRemote } from "@/topics/renderers/propis2/syncLib.js";
import { emptyLibrary, loadLibrary, removePage, removePreset, removeSet, saveLibrary, upsertPage, upsertPreset, upsertSet } from "@/topics/renderers/propis2/storage.js";
import Propis2Library from "./Propis2Library";
import Propis2Editor from "./Propis2Editor";
import Propis2ShowPanel from "./Propis2ShowPanel";
import Propis2SetEditor from "./Propis2SetEditor";
import "./propis2.css";

// Home screen of «Прописи 2»: library -> editor -> student view. Pages live in IndexedDB on this
// device and are saved on every change.
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
      persist(mergeRemote(latest.current, res.kv));
    } catch {
      // offline or signed out: the local library keeps working, the queue catches up later
    }
  }, [persist]);

  useEffect(() => {
    let alive = true;
    loadLibrary(db)
      .then((lib) => { if (!alive) return; latest.current = lib; syncedRef.current = snapshotDocs(lib); setLibrary(lib); setLoaded(true); pullRemote(); })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [db, pullRemote]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") pullRemote(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pullRemote]);
  useEffect(() => () => { clearTimeout(saveTimer.current); flush(); }, [flush]);

  const sheets = useMemo(() => topicRecord?.wideSheets ?? {}, [topicRecord]);
  const elementLabels = useMemo(() => new Set([...(topicRecord?.elements ?? []).map((e) => e.id), ...(topicRecord?.wide ?? []).filter((g) => g.kind === "element").map((g) => g.label)]), [topicRecord]);
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  // presets: the built-in ones are the methodology sheets, «Мои» are saved in the library
  const builtinPresets = useMemo(() => Object.keys(PROPIS2_SHEET_TITLES).filter((id) => sheets[id]).map((id) => presetFromLines(id, PROPIS2_SHEET_TITLES[id], sheets[id], "narrow", elementLabels)), [sheets, elementLabels]);
  const kitPresets = useMemo(() => kits.map((k) => ({ id: `kit:${k.id}`, title: k.title, kit: k, builtin: true })), [kits]);
  const presets = useMemo(() => ({ builtin: [...kitPresets, ...builtinPresets], mine: library.presets ?? [] }), [kitPresets, builtinPresets, library.presets]);
  const createFromPreset = (ps) => {
    if (ps.kit) {
      // a multi-page kit: a set of pages, opened as a set
      const { set: ns, pages: nps } = kitToLibraryItems(ps.kit);
      persist(upsertSet(nps.reduce((lib, pg) => upsertPage(lib, pg), library), ns));
      setView({ name: "showSet", setId: ns.id, from: "library" }); // straight into the viewer, no screen in between
      return;
    }
    const np = pageFromPreset(ps);
    persist(upsertPage(library, np));
    setView({ name: "editor", pageId: np.id });
  };
  const page = view.pageId ? library.pages.find((p) => p.id === view.pageId) : null;
  const set = view.setId ? library.sets.find((st) => st.id === view.setId) : null;
  const pagesById = useMemo(() => new Map(library.pages.map((p) => [p.id, p])), [library.pages]);

  const createPage = (p) => { persist(upsertPage(library, p)); setView({ name: "editor", pageId: p.id }); };

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
          onPageIndexChange={setShownPage}
          onClose={() => { setFragment(null); setView({ ...view, name: view.from ?? "library" }); }}
          onFragmentTap={({ row, localX }) => setFragment(pickFragment(row.word, localX, glyphMap, ruling))}
        />
        {editTarget && (
          <button type="button" className="propis-ctrl-btn propis2-view-edit" aria-label="Изменить эту страницу" title="Изменить эту страницу" onClick={() => { setFragment(null); setView({ name: "editor", pageId: editTarget, backTo: isSet ? { name: "showSet", setId: set.id, from: view.from } : view.backTo }); }}>✎</button>
        )}
        {fragment && (
          <Propis2ShowPanel fragment={fragment} topicRecord={topicRecord} ruling={ruling} grid={gridSource ? taskGrid(gridSource) : undefined} midDash={gridSource?.midDash} onClose={() => setFragment(null)} />
        )}
      </div>
    );
  }

  if (view.name === "setEditor" && set) {
    return (
      <Propis2SetEditor
        set={set}
        pages={library.pages}
        topicRecord={topicRecord}
        onChange={(next) => persist(upsertSet(library, next))}
        onBack={() => setView({ name: "library" })}
        onShow={() => setView({ name: "showSet", setId: set.id, from: "setEditor" })}
        onEditPage={(id) => setView({ name: "editor", pageId: id, backTo: { name: "setEditor", setId: set.id } })}
        onDuplicatePage={(id, index) => {
          const src = pagesById.get(id);
          if (!src) return;
          const copy = { ...src, id: newId("pg"), title: `${src.title} (копия)`, rows: src.rows.map((r) => ({ ...r, id: newId("r") })), createdAt: Date.now() };
          const withPage = upsertPage(library, copy);
          const pageIds = [...set.pageIds.slice(0, index + 1), copy.id, ...set.pageIds.slice(index + 1)];
          persist(upsertSet(withPage, { ...set, pageIds }));
        }}
      />
    );
  }

  if (view.name === "editor" && page) {
    return (
      <Propis2Editor
        page={page}
        topicRecord={topicRecord}
        onChange={(next) => persist(upsertPage(library, next))}
        onBack={() => setView(view.backTo ?? { name: "library" })}
        onShow={() => setView({ name: "show", pageId: page.id, from: "editor", backTo: view.backTo })}
        presets={presets}
        onApplyPreset={createFromPreset}
        onSavePreset={(name) => persist(upsertPreset(library, presetFromPage(page, name)))}
        onDeletePreset={(id) => persist(removePreset(library, id))}
      />
    );
  }

  return (
    <Propis2Library
      pages={library.pages.filter((p) => !p.kitId)}
      sets={library.sets}
      sheets={sheets}
      onBack={() => setScreen("home")}
      onNew={() => createPage(newPage())}
      presets={presets}
      onFromPreset={(id) => { const ps = [...presets.builtin, ...presets.mine].find((x) => x.id === id); if (ps) createFromPreset(ps); }}
      onDeletePreset={(id) => persist(removePreset(library, id))}
      onOpen={(id) => setView({ name: "show", pageId: id, from: "library" })}
      onEdit={(id) => setView({ name: "editor", pageId: id })}
      onDuplicate={(id) => {
        const src = library.pages.find((p) => p.id === id);
        if (src) persist(upsertPage(library, { ...src, id: newId("pg"), title: `${src.title} (копия)`, rows: src.rows.map((r) => ({ ...r, id: newId("r") })), createdAt: Date.now() }));
      }}
      onDelete={(id) => persist(removePage(library, id))}
      onNewSet={() => { const st = newSet(); persist(upsertSet(library, st)); setView({ name: "setEditor", setId: st.id }); }}
      onOpenSet={(id) => setView({ name: "showSet", setId: id, from: "library" })}
      onEditSet={(id) => setView({ name: "setEditor", setId: id })}
      onDuplicateSet={(id) => {
        const src = library.sets.find((st) => st.id === id);
        if (!src) return;
        // the pages of a kit belong to it: a copy of the kit gets copies of the pages
        const copy = { ...src, id: newId("st"), title: `${src.title} (копия)`, createdAt: Date.now() };
        let lib = library;
        if (src.kit) {
          const own = src.pageIds.map((pid) => library.pages.find((p) => p.id === pid)).filter(Boolean);
          const copies = own.map((p) => ({ ...p, id: newId("pg"), kitId: copy.id, rows: p.rows.map((r) => ({ ...r, id: newId("r") })), createdAt: Date.now() }));
          copy.pageIds = copies.map((p) => p.id);
          lib = copies.reduce((l, p) => upsertPage(l, p), lib);
        }
        persist(upsertSet(lib, copy));
      }}
      onDeleteSet={(id) => persist(removeSet(library.pages.filter((p) => p.kitId === id).reduce((lib, p) => removePage(lib, p.id), library), id))}
    />
  );
}
