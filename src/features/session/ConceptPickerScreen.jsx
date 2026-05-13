import { useState } from "react";
import { useAppStore } from "@/core/store";
import { persistStudentTopicLink } from "@/core/linkUtils";
import Button from "@/shared/components/Button";
import ConceptDot from "@/shared/components/ConceptDot";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { computeConceptLevel } from "@/features/session/useConceptProgress";
import { useTopicFile } from "@/shared/hooks/useTopicFile";

function ConceptCard({ concept, topicId, level, selected, onToggle }) {
  const imgUrl = useTopicFile(topicId, concept.primary?.image);
  const label  = concept.primary?.label ?? concept.conceptId;

  return (
    <button
      className={`concept-card ${selected ? "concept-card--selected" : ""}`}
      onClick={() => onToggle(concept.conceptId)}
    >
      {imgUrl ? (
        <>
          <img className="concept-card__img" src={imgUrl} alt="" />
          <div className="concept-card__footer">
            <ConceptDot level={level} size={10} />
            <span className="concept-card__label">{label}</span>
          </div>
        </>
      ) : (
        <>
          <div className="concept-card__text-body">
            <span className="concept-card__text-label">{label}</span>
          </div>
          <div className="concept-card__footer concept-card__footer--dot-only">
            <ConceptDot level={level} size={10} />
          </div>
        </>
      )}
    </button>
  );
}

export default function ConceptPickerScreen() {
  const setScreen          = useAppStore((s) => s.setScreen);
  const activeTopicId      = useAppStore((s) => s.activeTopicId);
  const activeStudentId    = useAppStore((s) => s.activeStudentId);
  const topicRecords       = useAppStore((s) => s.topicRecords);
  const sessions           = useAppStore((s) => s.sessions);
  const studentTopicLinks  = useAppStore((s) => s.studentTopicLinks);
  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const concepts    = topicRecord ? deriveConcepts(topicRecord.cards) : [];

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const saved   = studentTopicLinks[linkKey]?.selectedConceptIds ?? concepts.map((c) => c.conceptId);

  const [selected, setSelected] = useState(new Set(saved));

  function toggle(cid) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(cid)) next.delete(cid);
      else               next.add(cid);
      return next;
    });
  }

  function selectAll()  { setSelected(new Set(concepts.map((c) => c.conceptId))); }
  function selectNone() { setSelected(new Set()); }

  function confirm() {
    persistStudentTopicLink(activeStudentId, activeTopicId, {
      selectedConceptIds: [...selected],
      selectionMode: "manual",
    });
    setScreen("params");
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("params")}>←</button>
        <h1 className="screen-title">Понятия ({selected.size})</h1>
        <button className="header-action-btn" onClick={selected.size === concepts.length ? selectNone : selectAll}>
          {selected.size === concepts.length ? "−" : "✓"}
        </button>
      </div>
      <div className="concept-grid">
        {concepts.map((concept) => {
          const level = computeConceptLevel(sessions, activeStudentId, activeTopicId, concept.conceptId);
          return (
            <ConceptCard
              key={concept.conceptId}
              concept={concept}
              topicId={activeTopicId}
              level={level}
              selected={selected.has(concept.conceptId)}
              onToggle={toggle}
            />
          );
        })}
      </div>
      <div style={{ padding: 16 }}>
        <Button fullWidth disabled={selected.size === 0} onClick={confirm}>
          Подтвердить ({selected.size})
        </Button>
      </div>
    </div>
  );
}
