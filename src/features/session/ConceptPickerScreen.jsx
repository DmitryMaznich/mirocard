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

  const groupMeta      = topicRecord?.meta?.groups ?? null;
  const availableGroups = groupMeta ? Object.keys(groupMeta) : [];

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const saved   = studentTopicLinks[linkKey]?.selectedConceptIds ?? concepts.map((c) => c.conceptId);

  const [selected, setSelected]   = useState(new Set(saved));
  const [activeGroup, setActiveGroup] = useState(null);

  const filteredConcepts = activeGroup
    ? concepts.filter((c) => c.primary?.group === activeGroup)
    : concepts;

  const allFilteredSelected = filteredConcepts.length > 0 &&
    filteredConcepts.every((c) => selected.has(c.conceptId));

  function toggle(cid) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(cid)) next.delete(cid);
      else               next.add(cid);
      return next;
    });
  }

  function selectAll()  {
    setSelected((s) => new Set([...s, ...filteredConcepts.map((c) => c.conceptId)]));
  }
  function selectNone() {
    const ids = new Set(filteredConcepts.map((c) => c.conceptId));
    setSelected((s) => new Set([...s].filter((id) => !ids.has(id))));
  }

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
        <button className="header-action-btn" onClick={allFilteredSelected ? selectNone : selectAll}>
          {allFilteredSelected ? "−" : "✓"}
        </button>
      </div>

      {groupMeta && availableGroups.length > 0 && (
        <div className="concept-group-filter">
          <button
            className={`group-filter-btn${activeGroup === null ? " group-filter-btn--active" : ""}`}
            onClick={() => setActiveGroup(null)}
          >
            Все
          </button>
          {availableGroups.map((gid) => (
            <button
              key={gid}
              className={`group-filter-btn${activeGroup === gid ? " group-filter-btn--active" : ""}`}
              onClick={() => setActiveGroup(gid)}
            >
              {groupMeta[gid]?.ru ?? gid}
            </button>
          ))}
        </div>
      )}

      <div className="concept-grid">
        {filteredConcepts.map((concept) => {
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
