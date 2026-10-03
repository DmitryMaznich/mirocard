import { useMemo, useState } from "react";
import Button from "@/shared/components/Button";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildPageTask } from "@/topics/renderers/propis2/pageTask.js";

// Show panel: the tapped fragment written large on its own ruling, with repeat, slow-motion and
// close. The page behind stays mounted, so closing returns to the same page, zoom and scroll.
export default function Propis2ShowPanel({ fragment, topicRecord, ruling, dense = false, onClose }) {
  const [slow, setSlow] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const task = useMemo(
    () => buildPageTask({ topicRecord, lines: [`${fragment}#1`], narrowRows: ruling === "narrow", denseGrid: dense }),
    [topicRecord, fragment, ruling, dense],
  );
  return (
    <div className="propis2-panel" role="dialog" aria-label="Показ написания" data-testid="propis2-panel">
      <div className="propis2-panel-card">
        <div className="propis2-panel-head">
          <strong>{fragment}</strong>
          <button type="button" className="propis2-panel-x" onClick={onClose} aria-label="Закрыть показ">✕</button>
        </div>
        <div className="propis2-panel-stage">
          <PrintPageView key={playKey} task={task} bare focus speedFactor={slow ? 0.4 : 1} />
        </div>
        <div className="propis2-panel-actions">
          <Button onClick={() => setPlayKey((k) => k + 1)}>↻ Повтор</Button>
          <Button onClick={() => setSlow((v) => !v)} aria-pressed={slow}>{slow ? "Обычная скорость" : "🐢 Медленно"}</Button>
          <Button onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </div>
  );
}
