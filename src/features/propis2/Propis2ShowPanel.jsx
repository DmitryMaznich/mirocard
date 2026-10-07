import { useEffect, useMemo, useRef, useState } from "react";
import PrintPageView, { snapXFor } from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { lineWidth } from "@/topics/renderers/propis2/model.js";
import { TEXT_ROW_WIDE_DIAGONAL_SPACING } from "@/topics/renderers/propis/propisRuling.js";
import { WIDE_ROW_MAX_X } from "@/topics/renderers/propis/wordEngine.js";

// Show panel: the tapped fragment written large on its own ruling, the pen going over it, with repeat, slow motion and close.
// The page behind stays mounted, so closing returns to the same page, zoom and scroll.
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

export default function Propis2ShowPanel({ fragment, topicRecord, ruling, grid, midDash, onClose }) {
  const [slow, setSlow] = useState(false);
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
    const narrow = ruling === "narrow" || grid === "square";
    const snap = snapXFor({ narrowRows: narrow, simpleGrid: grid, narrow17: narrow });
    const scale = snap.cell?.scale ?? (narrow ? 0.5 : 1);
    const w = lineWidth(fragment, buildGlyphMap(topicRecord), narrow ? "narrow" : "wide", snap);
    const indent = Math.max(0, Math.floor((WIDE_ROW_MAX_X / 2 - w / 2) / (TEXT_ROW_WIDE_DIAGONAL_SPACING * scale)));
    return buildPageTask({ topicRecord, lines: [`${fragment}#1${indent ? `#i${indent}` : ""}`], narrowRows: ruling === "narrow", grid, midDash });
  }, [topicRecord, fragment, ruling, grid, midDash]);
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
