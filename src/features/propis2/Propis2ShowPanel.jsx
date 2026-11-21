import { isFourLinePaper } from "@/handwriting/fourLinePapers.js";
import { isPrintPaper } from "@/handwriting/printPapers.js";
import { useEffect, useMemo, useRef, useState } from "react";
import PrintPageView, { snapXFor } from "@/handwriting/PrintPageView";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { lineWidth } from "@/topics/renderers/propis2/model.js";
import { TEXT_ROW_WIDE_DIAGONAL_SPACING } from "@/handwriting/propisRuling.js";
import { WIDE_ROW_MAX_X } from "@/handwriting/wordEngine.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

// Show panel: the tapped fragment written large on its own ruling, the pen going over it, with repeat, slow motion and close.
// The page behind stays mounted, so closing returns to the same page, zoom and scroll.
// «Без отрыва | С отрывом» (owner, 2026-11-21): the two techniques of docs/propis2-letter-parts.md over the same ink — joined (the pen as the
// letters were captured, one motion, the way back up a stick over the ink) or lifted (row flag `#L`: every element of a letter, every join on
// its own, the pen put down at each without its way through the air). Shown only where the deck's letters carry their elements.
// Layout: a header that says WHAT is shown («Буква» / «Слово» + the fragment), the writing row in the middle of the screen (the
// window on the row takes the stage's own shape, see PrintPageView `fitAspect`), the controls at the bottom within reach of a thumb.
const kindOf = (fragment) => {
  const t = String(fragment ?? "").replace(/№/g, "").trim();
  if (/\s/.test(t)) return "Пишем";
  if (/^[0-9]+$/.test(t)) return t.length === 1 ? "Цифра" : "Число";
  if (/^[0-9+\-=<>]+$/.test(t)) return "Пример";
  if ([...t].length === 1) return "Буква";
  return "Слово";
};

export default function Propis2ShowPanel({ fragment, topicRecord, ruling, grid, midDash, bandFill = null, onClose }) {
  const { t } = useUiTranslation();
  const [slow, setSlow] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const stageRef = useRef(null);
  const [aspect, setAspect] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => { if (el.clientWidth && el.clientHeight) setAspect(el.clientWidth / el.clientHeight); };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // the fragment is moved to the middle of its row (an indent in slant cells), so the ruling runs on at both sides of it
  const task = useMemo(() => {
    const narrow = ruling === "narrow" || grid === "square" || grid === "ruled" || isFourLinePaper(grid) || grid === "m1" || grid === "m2" || isPrintPaper(grid);
    const snap = snapXFor({ narrowRows: narrow, simpleGrid: grid, narrow17: narrow });
    const scale = snap.cell?.scale ?? snap.letterScale ?? (narrow ? 0.5 : 1);
    const w = lineWidth(fragment, buildGlyphMap(topicRecord), narrow ? "narrow" : "wide", snap);
    const indent = Math.max(0, Math.floor((WIDE_ROW_MAX_X / 2 - w / 2) / (TEXT_ROW_WIDE_DIAGONAL_SPACING * scale)));
    return buildPageTask({ topicRecord, lines: [`${fragment}#1${indent ? `#i${indent}` : ""}${lifted ? "#L" : ""}`], narrowRows: ruling === "narrow", grid, midDash, bandFill });
  }, [topicRecord, fragment, ruling, grid, midDash, bandFill, lifted]);
  // the switch only where the letters are split into elements (letter_elements.json in the deck — «Прописи: латиница» since 0.12.0; the
  // print hands are written apart anyway, a deck without elements would only go stroke by stroke)
  const hasElements = useMemo(() => { for (const g of buildGlyphMap(topicRecord).values()) if (g?.kind === "letter" && g.trajectory && !g.upright) return true; return false; }, [topicRecord]);
  const shown = String(fragment ?? "").replace(/№/g, "");
  return (
    <div className="propis2-panel" role="dialog" aria-label="Показ написания" data-testid="propis2-panel">
      <div className="propis2-panel-head">
        <div className="propis2-panel-what">
          <span className="propis2-panel-kind">{kindOf(fragment)}</span>
          <strong className="propis2-panel-title">{shown}</strong>
        </div>
        <button type="button" className="propis2-panel-close" onClick={onClose} aria-label="Закрыть показ" title="Закрыть">✕</button>
      </div>
      <div className="propis2-panel-stage" ref={stageRef}>
        <PrintPageView key={playKey} task={task} bare focus fitAspect={aspect} speedFactor={slow ? 0.4 : 1} />
      </div>
      {hasElements && (
        <div className="propis2-tech" role="radiogroup" aria-label={t("propis2.technique")} data-lifted={lifted ? "1" : "0"}>
          <span className="propis2-tech-thumb" aria-hidden="true" />
          <button type="button" role="radio" aria-checked={!lifted} className={`propis2-tech-opt${!lifted ? " is-on" : ""}`} onClick={() => { setLifted(false); setPlayKey((k) => k + 1); }}>
            <svg className="propis2-tech-ico" viewBox="0 0 36 16" aria-hidden="true"><path d="M2 12 C 7 2, 11 2, 13 9 S 20 14, 23 6 S 31 2, 34 10" /></svg>
            {t("propis2.joined")}
          </button>
          <button type="button" role="radio" aria-checked={lifted} className={`propis2-tech-opt${lifted ? " is-on" : ""}`} onClick={() => { setLifted(true); setPlayKey((k) => k + 1); }}>
            <svg className="propis2-tech-ico" viewBox="0 0 36 16" aria-hidden="true"><path d="M2 12 C 5 4, 8 3, 10 8" /><path d="M15 4 L 15 12" /><path d="M21 12 C 22 5, 26 3, 27 8" /><path d="M32 4 L 33 12" /></svg>
            {t("propis2.lifted")}
          </button>
        </div>
      )}
      <div className="propis2-panel-controls">
        <button type="button" className="propis2-panel-btn" onClick={() => setPlayKey((k) => k + 1)} aria-label="Повтор">
          <span className="propis2-panel-ico" aria-hidden="true">↻</span>Ещё раз
        </button>
        <button type="button" className={`propis2-panel-btn propis2-panel-btn--slow${slow ? " is-on" : ""}`} onClick={() => setSlow((v) => !v)} aria-pressed={slow} aria-label={slow ? "Обычная скорость" : "Медленно"}>
          <span className="propis2-panel-ico" aria-hidden="true">🐢</span>Медленно
        </button>
      </div>
    </div>
  );
}
