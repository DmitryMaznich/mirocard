import { useState } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { deriveConcepts } from "@/shared/utils/topicUtils";

function NumberStepper({ label, value, min, max, onChange }) {
  return (
    <div className="param-row">
      <div className="param-label">{label}</div>
      <div className="param-stepper">
        <button className="stepper-btn" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="stepper-value">{value}</span>
        <button className="stepper-btn" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function EnumParam({ label, options, value, onChange }) {
  return (
    <div className="param-row">
      <div className="param-label">{label}</div>
      <div className="param-enum-group">
        {options.map((opt) => (
          <button
            key={opt}
            className={`enum-btn ${value === opt ? "enum-btn--active" : ""}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ParamsScreen() {
  const setScreen          = useAppStore((s) => s.setScreen);
  const activeTopicId      = useAppStore((s) => s.activeTopicId);
  const activeStudentId    = useAppStore((s) => s.activeStudentId);
  const activeModeId       = useAppStore((s) => s.activeModeId);
  const topicRecords       = useAppStore((s) => s.topicRecords);
  const studentTopicLinks  = useAppStore((s) => s.studentTopicLinks);
  const upsertStudentTopicLink = useAppStore((s) => s.upsertStudentTopicLink);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const mode        = topicRecord?.modes.find((m) => m.id === activeModeId);

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const link    = studentTopicLinks[linkKey] ?? {};

  function getInitialParams() {
    const modeParams = mode?.params ?? {};
    const saved      = link.params ?? {};
    const out = {};
    for (const [key, def] of Object.entries(modeParams)) {
      if (def.type === "concept_selector") continue;
      out[key] = saved[key] ?? def.default ?? (def.type === "number" ? def.min : def.values?.[0]);
    }
    return out;
  }

  const [params, setParams] = useState(getInitialParams);

  if (!topicRecord || !mode) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("modes")}>←</button>
          <h1 className="screen-title">Параметры</h1>
        </div>
        <div className="empty-state"><div className="empty-state__text">Режим не выбран</div></div>
      </div>
    );
  }

  const allConcepts = deriveConcepts(topicRecord.cards);
  const selectedConceptIds = link.selectedConceptIds ?? allConcepts.map((c) => c.conceptId);
  const maxSize = topicRecord.meta.sessionConfig?.maxSize ?? 12;

  function startSession() {
    upsertStudentTopicLink(activeStudentId, activeTopicId, { params });
    setScreen("session");
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("modes")}>←</button>
        <h1 className="screen-title">{mode.ui?.title ?? mode.id}</h1>
      </div>

      <div className="params-body">
        {Object.values(mode.params ?? {}).some((d) => d.type === "concept_selector") && (
          <div className="param-row">
            <div className="param-label">Понятия</div>
            <div className="param-concept-row">
              <span>{selectedConceptIds.length} из {allConcepts.length}</span>
              {allConcepts.length > maxSize && (
                <button className="link-btn" onClick={() => setScreen("concepts")}>Изменить</button>
              )}
            </div>
          </div>
        )}

        {Object.entries(mode.params ?? {}).map(([key, def]) => {
          if (def.type === "concept_selector") return null;
          if (def.type === "number") {
            return (
              <NumberStepper
                key={key}
                label={key}
                value={params[key] ?? def.default}
                min={def.min}
                max={def.max}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              />
            );
          }
          if (def.type === "enum") {
            return (
              <EnumParam
                key={key}
                label={key}
                options={def.values}
                value={params[key] ?? def.default}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              />
            );
          }
          return null;
        })}
      </div>

      <div style={{ padding: 20 }}>
        <Button fullWidth onClick={startSession}>Начать занятие</Button>
      </div>
    </div>
  );
}
