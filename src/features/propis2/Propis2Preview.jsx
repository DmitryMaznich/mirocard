import { useDeferredValue, useMemo } from "react";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { pageMargin, pageToLines, taskGrid } from "@/topics/renderers/propis2/model.js";

// Live preview of the page being edited: the page as it will be shown and printed. The layout runs
// on a deferred copy of the page, so typing stays responsive while the preview catches up.
export default function Propis2Preview({ page, topicRecord, overlays = null, onPageIndexChange = null }) {
  const deferred = useDeferredValue(page);
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const task = useMemo(
    () => buildPageTask({ topicRecord, lines: pageToLines(deferred, glyphMap), narrowRows: deferred.ruling === "narrow", grid: taskGrid(deferred), midDash: deferred.midDash, margin: pageMargin(deferred) }),
    [topicRecord, deferred, glyphMap],
  );
  return (
    <div className="propis2-preview" data-testid="propis2-preview" aria-label="Предпросмотр страницы">
      <PrintPageView task={task} bare overlays={overlays} onPageIndexChange={onPageIndexChange} />
    </div>
  );
}
