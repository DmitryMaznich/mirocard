import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { PROPIS2_SHEET_TITLES } from "@/topics/renderers/propis2/data.js";
import { newId, newPage, pageFromLines, pageFromMarked, pageToLines, pickFragment } from "@/topics/renderers/propis2/model.js";
import { emptyLibrary, loadLibrary, removePage, saveLibrary, upsertPage } from "@/topics/renderers/propis2/storage.js";
import Propis2Library from "./Propis2Library";
import Propis2Editor from "./Propis2Editor";
import Propis2ShowPanel from "./Propis2ShowPanel";
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

  const createPage = (p) => { persist(upsertPage(library, p)); setView({ name: "editor", pageId: p.id }); };

  if (!loaded) return <div className="screen propis2-home" data-testid="propis2-loading" />;

  if (view.name === "show" && page) {
    const task = buildPageTask({ topicRecord, lines: pageToLines(page, glyphMap), narrowRows: page.ruling === "narrow" });
    return (
      <div className="propis2-view" data-testid="propis2-view">
        <PrintPageView
          task={task}
          onClose={() => { setFragment(null); setView({ name: view.from ?? "library", pageId: view.pageId }); }}
          onFragmentTap={({ row, localX }) => setFragment(pickFragment(row.word, localX, glyphMap, page.ruling))}
        />
        {fragment && (
          <Propis2ShowPanel fragment={fragment} topicRecord={topicRecord} ruling={page.ruling} onClose={() => setFragment(null)} />
        )}
      </div>
    );
  }

  if (view.name === "editor" && page) {
    return (
      <Propis2Editor
        page={page}
        topicRecord={topicRecord}
        onChange={(next) => persist(upsertPage(library, next))}
        onBack={() => setView({ name: "library" })}
        onShow={() => setView({ name: "show", pageId: page.id, from: "editor" })}
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
    />
  );
}
