import { useMemo, useState } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { PROPIS2_SHEET_TITLES } from "@/topics/renderers/propis2/data.js";
import "./propis2.css";

// Spike of the «Прописи 2» home screen (the builder). Step 0: prove the topic can own its home
// screen and draw a page with the shared engine + data. The real constructor (row types,
// repeats, reorder, save/load, validation) replaces the plain row list below.
export default function Propis2Home() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const topicRecord = useAppStore((s) => s.topicRecords.find((r) => r.meta.id === activeTopicId));
  const sheets = topicRecord?.wideSheets ?? {};
  const [lines, setLines] = useState(() => [...(sheets.page18 ?? [])]);
  const [narrow, setNarrow] = useState(true);
  const [showing, setShowing] = useState(false);
  const task = useMemo(() => buildPageTask({ topicRecord, lines, narrowRows: narrow }), [topicRecord, lines, narrow]);

  function setLine(i, text) { setLines((ls) => ls.map((l, k) => (k === i ? text : l))); }
  function addLine() { setLines((ls) => [...ls, ""]); }
  function removeLine(i) { setLines((ls) => ls.filter((_, k) => k !== i)); }
  function loadSheet(id) { setLines([...(sheets[id] ?? [])]); }

  if (showing) {
    return (
      <div className="propis2-view" data-testid="propis2-view">
        <PrintPageView task={task} onClose={() => setShowing(false)} />
      </div>
    );
  }

  return (
    <div className="screen propis2-home" data-testid="propis2-home">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Прописи 2</h1>
      </div>
      <div className="propis2-body">
        <label className="propis2-field">
          Готовый набор
          <select defaultValue="" onChange={(e) => e.target.value && loadSheet(e.target.value)}>
            <option value="">— выбрать —</option>
            {Object.entries(PROPIS2_SHEET_TITLES).filter(([id]) => sheets[id]).map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
        </label>
        <label className="propis2-field propis2-field--inline">
          <input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} /> Узкая строка
        </label>
        <ol className="propis2-rows">
          {lines.map((line, i) => (
            <li key={i}>
              <input value={line} onChange={(e) => setLine(i, e.target.value)} aria-label={`Строка ${i + 1}`} />
              <button type="button" onClick={() => removeLine(i)} aria-label="Удалить строку">✕</button>
            </li>
          ))}
        </ol>
        <div className="propis2-actions">
          <Button onClick={addLine}>+ Строка</Button>
          <Button onClick={() => setShowing(true)}>Показать страницу</Button>
        </div>
      </div>
    </div>
  );
}
