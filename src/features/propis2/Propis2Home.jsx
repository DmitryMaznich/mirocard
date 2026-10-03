import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { PROPIS2_SHEET_TITLES } from "@/topics/renderers/propis2/data.js";
import { newId, newPage, newSet, pageFromLines, pageFromMarked, pageToLines, pickFragment, setToLines } from "@/topics/renderers/propis2/model.js";
import { emptyLibrary, loadLibrary, removePage, removeSet, saveLibrary, upsertPage, upsertSet } from "@/topics/renderers/propis2/storage.js";
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
  const saveTimer = useRef(null);
  const latest = useRef(library);
  latest.current = library;

  useEffect(() => {
    let alive = true;
    loadLibrary(db).then((lib) => { if (alive) { setLibrary(lib); setLoaded(true); } }).catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [db]);

  // Autosave: debounced write after every change, flushed when the screen goes away.
  const persist = useCallback((next) => {
    setLibrary(next);
    latest.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveLibrary(latest.current, db).catch(() => {}); }, 300);
  }, [db]);
  useEffect(() => () => { clearTimeout(saveTimer.current); saveLibrary(latest.current, db).catch(() => {}); }, [db]);

  const sheets = topicRecord?.wideSheets ?? {};
  const elementLabels = useMemo(() => new Set([...(topicRecord?.elements ?? []).map((e) => e.id), ...(topicRecord?.wide ?? []).filter((g) => g.kind === "element").map((g) => g.label)]), [topicRecord]);
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const page = view.pageId ? library.pages.find((p) => p.id === view.pageId) : null;
  const set = view.setId ? library.sets.find((st) => st.id === view.setId) : null;
  const pagesById = useMemo(() => new Map(library.pages.map((p) => [p.id, p])), [library.pages]);

  const createPage = (p) => { persist(upsertPage(library, p)); setView({ name: "editor", pageId: p.id }); };

  if (!loaded) return <div className="screen propis2-home" data-testid="propis2-loading" />;

  // Student view: one page, or a whole set as one booklet (pages padded to screen-page boundaries).
  if ((view.name === "show" && page) || (view.name === "showSet" && set)) {
    const isSet = view.name === "showSet";
    const ruling = isSet ? set.ruling : page.ruling;
    const lines = isSet ? setToLines(set, pagesById, glyphMap) : pageToLines(page, glyphMap);
    const task = buildPageTask({ topicRecord, lines, narrowRows: ruling === "narrow" });
    return (
      <div className="propis2-view" data-testid="propis2-view">
        <PrintPageView
          task={task}
          onClose={() => { setFragment(null); setView({ ...view, name: view.from ?? "library" }); }}
          onFragmentTap={({ row, localX }) => setFragment(pickFragment(row.word, localX, glyphMap, ruling))}
        />
        {fragment && (
          <Propis2ShowPanel fragment={fragment} topicRecord={topicRecord} ruling={ruling} onClose={() => setFragment(null)} />
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
        onFromMarked={() => {
          const next = pageFromMarked(page);
          if (next) createPage(next);
        }}
      />
    );
  }

  return (
    <Propis2Library
      pages={library.pages}
      sets={library.sets}
      sheets={sheets}
      onBack={() => setScreen("home")}
      onNew={() => createPage(newPage())}
      onFromSheet={(id) => createPage(pageFromLines(PROPIS2_SHEET_TITLES[id] ?? id, sheets[id], "narrow", elementLabels))}
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
        if (src) persist(upsertSet(library, { ...src, id: newId("st"), title: `${src.title} (копия)`, createdAt: Date.now() }));
      }}
      onDeleteSet={(id) => persist(removeSet(library, id))}
    />
  );
}
