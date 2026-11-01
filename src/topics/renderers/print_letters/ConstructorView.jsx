import { useState, useMemo } from "react";
import IntroPage       from "./pages/IntroPage";
import DottedPage       from "./pages/DottedPage";
import FadingPage       from "./pages/FadingPage";
import IndependentPage  from "./pages/IndependentPage";

const PAGE_TYPES = [
  { id: "intro",       label: "1. Знакомство",          Comp: IntroPage },
  { id: "dotted",      label: "2. Обводка по точкам",   Comp: DottedPage },
  { id: "fading",      label: "3. Угасающая опора",     Comp: FadingPage },
  { id: "independent", label: "4. Самостоятельно",      Comp: IndependentPage },
];

const FAMILY_TITLES = { straight: "Прямые линии" };

let nextPageSeq = 1;

export default function ConstructorView({ task, onAdvance }) {
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

  const [activeLetterId, setActiveLetterId] = useState(letters[0]?.id ?? null);
  const [activePageType, setActivePageType] = useState(PAGE_TYPES[0].id);
  const [pages, setPages] = useState([]);

  function addPage() {
    if (!activeLetterId) return;
    setPages((prev) => [...prev, { seq: nextPageSeq++, letterId: activeLetterId, pageType: activePageType }]);
  }
  function removePage(seq) {
    setPages((prev) => prev.filter((p) => p.seq !== seq));
  }
  function movePage(seq, dir) {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.seq === seq);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function printNotebook() {
    window.print();
  }

  return (
    <div className="pl-constructor">
      <div className="pl-builder">
        <div className="pl-builder-section">
          <div className="pl-builder-label">Буква</div>
          {families.map(([famId, famLetters]) => (
            <div key={famId} className="pl-family-group">
              <div className="pl-family-title">{FAMILY_TITLES[famId] ?? famId}</div>
              <div className="pl-letter-tiles">
                {famLetters.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`pl-letter-tile${l.id === activeLetterId ? " pl-letter-tile--active" : ""}`}
                    onClick={() => setActiveLetterId(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pl-builder-section">
          <div className="pl-builder-label">Тип страницы</div>
          <div className="pl-pagetype-tiles">
            {PAGE_TYPES.map((pt) => (
              <button
                key={pt.id}
                type="button"
                className={`pl-pagetype-tile${pt.id === activePageType ? " pl-pagetype-tile--active" : ""}`}
                onClick={() => setActivePageType(pt.id)}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="pl-btn pl-btn--add" onClick={addPage} disabled={!activeLetterId}>
          + Добавить страницу
        </button>

        {pages.length > 0 && (
          <ol className="pl-pages-list">
            {pages.map((p, idx) => {
              const pt = PAGE_TYPES.find((x) => x.id === p.pageType);
              return (
                <li key={p.seq} className="pl-pages-list-item">
                  <span>{p.letterId} — {pt?.label}</span>
                  <span className="pl-pages-list-actions">
                    <button type="button" onClick={() => movePage(p.seq, -1)} disabled={idx === 0} aria-label="Выше">↑</button>
                    <button type="button" onClick={() => movePage(p.seq, 1)} disabled={idx === pages.length - 1} aria-label="Ниже">↓</button>
                    <button type="button" onClick={() => removePage(p.seq)} aria-label="Удалить">✕</button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {pages.length > 0 && (
          <button type="button" className="pl-btn pl-btn--print" onClick={printNotebook}>🖨 Печать</button>
        )}
        <button type="button" className="pl-btn pl-btn--done" onClick={onAdvance}>Завершить занятие</button>
      </div>

      <div className="pl-preview">
        {pages.length === 0 && (
          <div className="pl-preview-empty">Выберите букву и тип страницы, затем нажмите «Добавить страницу»</div>
        )}
        {pages.map((p) => {
          const letter = byId[p.letterId];
          const pt = PAGE_TYPES.find((x) => x.id === p.pageType);
          if (!letter || !pt) return null;
          const Comp = pt.Comp;
          return (
            <div key={p.seq} className="pl-sheet">
              <Comp letter={letter} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
