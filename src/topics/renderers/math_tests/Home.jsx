import { useEffect, useMemo, useState } from "react";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import SheetSvg from "./SheetSvg";
import { layoutTest, blanksOf } from "./layout.js";
import { LIBRARY, libraryPreview } from "./store.js";

const THUMB_W = 168; // px

function Thumb({ test }) {
  const layout = useMemo(() => layoutTest(test), [test]);
  return (
    <span className="mt-thumb" style={{ width: THUMB_W, height: THUMB_W * (layout.grid.h / layout.grid.w) }}>
      <SheetSvg layout={layout} pageIndex={0} test={test} scale={THUMB_W / layout.grid.w} />
    </span>
  );
}

const dateOf = (ts) => new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

function summary(test) {
  const layout = layoutTest(test);
  const n = blanksOf(layout).filter((b) => !b.aux).length;
  const blocks = test.blocks.length;
  const bw = blocks % 10 === 1 && blocks % 100 !== 11 ? "блок" : [2, 3, 4].includes(blocks % 10) && ![12, 13, 14].includes(blocks % 100) ? "блока" : "блоков";
  return `${blocks} ${bw} · ${n} ответов · ${layout.pages.length > 1 ? `${layout.pages.length} стр. ` : ""}${test.format === "a5" ? "А5" : "А4"}`;
}

// «Мои контрольные» and «Готовые листы»: the entry of the topic. `solving` — the mode «Решить
// контрольную»: a tap opens a sheet for solving, no «Новая контрольная», no copy/delete menu, and a
// ready sheet is solved as it is (not copied into «Мои контрольные»).
export default function Home({ tests, loading, onBack, onNew, onOpen, onFromLibrary, onDelete, onDuplicate, solving = false, draft = null, onContinueDraft }) {
  const [tab, setTab] = useState("mine");
  const [menuFor, setMenuFor] = useState(null);
  useEffect(() => { if (!loading && tests.length === 0) setTab(solving ? "library" : "mine"); }, [loading, tests.length, solving]);
  const previews = useMemo(() => LIBRARY.map((e) => ({ entry: e, test: libraryPreview(e) })), []);

  return (
    <div className="screen mt-root mt-home" data-testid="math-tests-home">
      <div className="screen-header mt-header">
        <button className="back-btn" onClick={onBack} aria-label="Назад"><BackArrowIcon /></button>
        <h1 className="mt-header-title">{solving ? "Решить контрольную" : "Контрольные по математике"}</h1>
      </div>
      <div className="mt-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "is-on" : ""} onClick={() => setTab("mine")}>Мои контрольные</button>
        <button type="button" role="tab" aria-selected={tab === "library"} className={tab === "library" ? "is-on" : ""} onClick={() => setTab("library")}>Готовые листы</button>
      </div>
      <div className="mt-home-body">
        {draft && (
          // a sheet left half-solved (Back, a reload): it goes on from where it stopped (draft.js)
          <div className="mt-draft" role="status">
            <div className="mt-draft-text">
              <span className="mt-card-group">{draft.marks ? "Проверено, есть ошибки" : "Не дорешано"}</span>
              <b>{draft.test.title || "Контрольная"}</b>
            </div>
            <button type="button" className="mt-solve-btn" onClick={onContinueDraft}>Продолжить</button>
          </div>
        )}
        {tab === "mine" ? (
          <div className="mt-cards">
            {!solving && (
              <button type="button" className="mt-card mt-card--new" onClick={onNew}>
                <span className="mt-new-plus" aria-hidden="true">+</span>
                Новая контрольная
              </button>
            )}
            {solving && !loading && tests.length === 0 && (
              <p className="mt-muted mt-lib-hint">Своих листов пока нет — соберите лист в «Конструкторе контрольных» или откройте готовый.</p>
            )}
            {tests.map((t) => (
              <div key={t.id} className="mt-card">
                <button type="button" className="mt-card-open" onClick={() => onOpen(t)} aria-label={`${solving ? "Решать" : "Открыть"} «${t.title}»`}>
                  <Thumb test={t} />
                </button>
                <div className="mt-card-meta">
                  <b>{t.title || "Без названия"}</b>
                  <span>{summary(t)}</span>
                  <span>
                    {dateOf(t.updatedAt)}
                    {t.lastResult ? <> · решено <b className="mt-card-score">{t.lastResult.right} из {t.lastResult.total}</b></> : null}
                  </span>
                </div>
                {!solving && <button type="button" className="mt-card-more" aria-label="Ещё" onClick={() => setMenuFor(menuFor === t.id ? null : t.id)}>⋯</button>}
                {!solving && menuFor === t.id && (
                  <div className="mt-card-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onDuplicate(t); }}>Копия</button>
                    <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuFor(null); if (window.confirm(`Удалить «${t.title}»?`)) onDelete(t); }}>Удалить</button>
                  </div>
                )}
              </div>
            ))}
            {loading && <span className="mt-muted">Загружаю…</span>}
          </div>
        ) : (
          <>
            <p className="mt-muted mt-lib-hint">{solving ? "Нажмите на лист — он откроется для решения." : "Откройте готовый лист — получится ваша копия: в ней можно менять блоки и решать."}</p>
            <div className="mt-cards">
              {previews.map(({ entry, test }) => (
                <div key={entry.id} className="mt-card">
                  <button type="button" className="mt-card-open" onClick={() => onFromLibrary(entry)} aria-label={`${solving ? "Решать" : "Открыть"} «${entry.title}»`}>
                    <Thumb test={test} />
                  </button>
                  <div className="mt-card-meta">
                    <span className="mt-card-group">{entry.group}</span>
                    <b>{entry.title}</b>
                    <span>{entry.note}</span>
                  </div>
                </div>
              ))}
              {!solving && <div className="mt-card mt-card--soon">
                <span className="mt-card-group">Задачи · скоро</span>
                <b>Задачи в одно действие</b>
                <span>с картинкой и коротким текстом</span>
              </div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
