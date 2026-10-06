import { useMemo, useState } from "react";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildPageTask } from "@/topics/renderers/propis2/pageTask.js";

// Show panel: the tapped fragment written large on its own ruling, with repeat, slow-motion and
// close. The page behind stays mounted, so closing returns to the same page, zoom and scroll.
export default function Propis2ShowPanel({ fragment, topicRecord, ruling, grid, midDash, onClose }) {
  const [slow, setSlow] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const task = useMemo(
    () => buildPageTask({ topicRecord, lines: [`${fragment}#1`], narrowRows: ruling === "narrow", grid, midDash }),
    [topicRecord, fragment, ruling, grid, midDash],
  );
  return (
    <div className="propis2-panel" role="dialog" aria-label="Показ написания" data-testid="propis2-panel">
      <div className="propis2-panel-card">
        <div className="propis2-panel-head">
          <strong className="propis2-panel-title">{fragment}</strong>
          <button type="button" className="propis-ctrl-btn" onClick={() => setPlayKey((k) => k + 1)} aria-label="Повтор" title="Повтор">↻</button>
          <button type="button" className={`propis-ctrl-btn${slow ? " propis2-panel-on" : ""}`} onClick={() => setSlow((v) => !v)} aria-pressed={slow} aria-label={slow ? "Обычная скорость" : "Медленно"} title={slow ? "Обычная скорость" : "Медленно"}>🐢</button>
          <button type="button" className="propis-ctrl-btn" onClick={onClose} aria-label="Закрыть показ" title="Закрыть">✕</button>
        </div>
        <div className="propis2-panel-stage">
          <PrintPageView key={playKey} task={task} bare focus speedFactor={slow ? 0.4 : 1} />
        </div>
      </div>
    </div>
  );
}
