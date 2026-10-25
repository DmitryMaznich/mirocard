import { useDeferredValue, useEffect, useRef, useState } from "react";
import { PrintPageTop } from "@/topics/renderers/propis/PrintPageView";
import { buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { pageFormat, pageMargin, pageToLines, taskGrid, pageNoSlant } from "@/topics/renderers/propis2/model.js";
import * as I from "./Propis2Icons";

// The computer layout's column of the notebook's pages (owner, 2026-10-23, «вариант Б»): every page as a thumbnail, a click opens
// it, the open one framed; under them «+ Страница» and the open page's own actions (copy, earlier, later, delete). A thumbnail is
// laid out once per page object (TASKS) and only when it scrolls into sight (a 24-page notebook does not lay out 24 pages at once).
const TASKS = new WeakMap(); // page object -> its task
function taskOf(page, layout, topicRecord, glyphMap) {
  const key = JSON.stringify(layout ?? {});
  if (TASKS.has(page) && TASKS.get(page).key === key) return TASKS.get(page).task;
  const p = { ...page, ...layout };
  const task = buildPageTask({ topicRecord, lines: pageToLines(p, glyphMap), narrowRows: p.ruling === "narrow", grid: taskGrid(p), noSlant: pageNoSlant(p), midDash: p.midDash, margin: pageMargin(p), format: pageFormat(p) });
  TASKS.set(page, { key, task });
  return task;
}

function Thumb({ page, index, current, layout, topicRecord, glyphMap, onGo }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined"); // no observer (a test DOM): draw at once
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setSeen(true); }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  useEffect(() => { if (current) ref.current?.scrollIntoView?.({ block: "nearest" }); }, [current]);
  return (
    <button type="button" ref={ref} className={`p2-thumb${current ? " is-current" : ""}`} aria-label={`Страница ${index + 1}`} aria-current={current ? "page" : undefined} onClick={() => !current && onGo(index)}>
      <span className="p2-thumb-no">{index + 1}</span>
      <span className="p2-thumb-sheet">{seen && <PrintPageTop task={taskOf(page, layout, topicRecord, glyphMap)} rows={99} />}</span>
    </button>
  );
}

export default function Propis2Thumbs({ nav, live, topicRecord, glyphMap }) {
  // the open page is drawn from the page being edited (deferred: typing stays quick, its thumbnail follows a moment later)
  const shown = useDeferredValue(live);
  return (
    <nav className="p2-thumbs" aria-label="Страницы тетради">
      <div className="p2-thumbs-list">
        {nav.pages.map((p, i) => (
          <Thumb key={p.id} page={i === nav.index ? shown : p} index={i} current={i === nav.index} layout={nav.layout} topicRecord={topicRecord} glyphMap={glyphMap} onGo={nav.onGo} />
        ))}
      </div>
      <div className="p2-thumbs-foot">
        <button type="button" className="p2-thumbs-add" onClick={nav.onAdd} aria-label="Добавить страницу"><I.IconAddPage /> Страница</button>
        <div className="p2-thumbs-acts" role="group" aria-label={`Страница ${nav.index + 1}`}>
          <button type="button" onClick={nav.onDuplicate} aria-label="Копия страницы" title="Копия страницы"><I.IconDuplicate /></button>
          <button type="button" onClick={nav.onMoveBefore} disabled={nav.index <= 0} aria-label="Переместить страницу раньше" title="Раньше">↑</button>
          <button type="button" onClick={nav.onMoveAfter} disabled={nav.index >= nav.total - 1} aria-label="Переместить страницу позже" title="Позже">↓</button>
          <button type="button" className="is-danger" onClick={nav.onDelete} aria-label={nav.total > 1 ? "Удалить страницу из тетради" : "Удалить тетрадь"} title="Удалить"><I.IconTrash /></button>
        </div>
      </div>
    </nav>
  );
}
