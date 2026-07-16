import { useState } from "react";
import { useAppStore } from "@/core/store";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { getTopicTitle } from "@/shared/utils/format";
import "./lessonPlan.css";

const TAB_TOPIC = "topic";
const TAB_FREEFORM = "freeform";

export default function AddPlanItemSheet({ onPick, onClose }) {
  const topicRecords = useAppStore((s) => s.topicRecords);
  const [tab, setTab] = useState(TAB_TOPIC);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [freeText, setFreeText] = useState("");

  const availableTopics = topicRecords.filter((r) => (r.modes?.length ?? 0) > 0);
  const selectedTopic = availableTopics.find((r) => r.meta.id === selectedTopicId) ?? null;

  function handlePickMode(mode) {
    onPick({
      kind: "topic",
      topicId: selectedTopic.meta.id,
      mode: mode.id,
      label: `${getTopicTitle(selectedTopic.meta.title)} · ${getTopicTitle(mode.ui?.title) || mode.id}`,
    });
  }

  function handleFreeformSubmit() {
    const text = freeText.trim();
    if (!text) return;
    onPick({ kind: "freeform", text });
  }

  return (
    <Modal title="Добавить цель" onClose={onClose}>
      <div className="lesson-plan-add-sheet__tabs">
        <button
          className={`lesson-plan-add-sheet__tab${tab === TAB_TOPIC ? " lesson-plan-add-sheet__tab--active" : ""}`}
          onClick={() => setTab(TAB_TOPIC)}
        >
          Тема из приложения
        </button>
        <button
          className={`lesson-plan-add-sheet__tab${tab === TAB_FREEFORM ? " lesson-plan-add-sheet__tab--active" : ""}`}
          onClick={() => setTab(TAB_FREEFORM)}
        >
          Своя задача
        </button>
      </div>

      {tab === TAB_TOPIC && !selectedTopic && (
        <ul className="lesson-plan-add-sheet__list">
          {availableTopics.map((r) => (
            <li key={r.meta.id}>
              <button onClick={() => setSelectedTopicId(r.meta.id)}>{getTopicTitle(r.meta.title)}</button>
            </li>
          ))}
        </ul>
      )}

      {tab === TAB_TOPIC && selectedTopic && (
        <ul className="lesson-plan-add-sheet__list">
          {selectedTopic.modes.map((mode) => (
            <li key={mode.id}>
              <button onClick={() => handlePickMode(mode)}>{getTopicTitle(mode.ui?.title) || mode.id}</button>
            </li>
          ))}
          <li><button onClick={() => setSelectedTopicId(null)}>← Другая тема</button></li>
        </ul>
      )}

      {tab === TAB_FREEFORM && (
        <div className="lesson-plan-add-sheet__freeform">
          <input
            className="lesson-plan-add-sheet__input"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Например, «повторить стишок»"
          />
          <Button onClick={handleFreeformSubmit} disabled={!freeText.trim()}>Добавить</Button>
        </div>
      )}
    </Modal>
  );
}
