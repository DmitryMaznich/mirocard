import { useState } from "react";
import { useAppStore } from "@/core/store";
import { useLessonPlan } from "./LessonPlanContext";
import { computeDefaultParams } from "@/StudentApp";
import "./lessonPlan.css";

export default function LessonPlanPanel() {
  const lessonPlan = useLessonPlan();
  const topicRecords = useAppStore((s) => s.topicRecords);
  const [noteDraftItemId, setNoteDraftItemId] = useState(null);
  const [noteText, setNoteText] = useState("");

  const activeSessionPlan = lessonPlan?.activeSessionPlan ?? null;
  if (!activeSessionPlan) return null;

  const total = activeSessionPlan.items.length;
  const doneCount = activeSessionPlan.items.filter((item) => item.done).length;

  function handlePlayItem(item) {
    const store = useAppStore.getState();
    const topicRecord = store.topicRecords.find((r) => r.meta.id === item.topicId);
    if (!topicRecord) return; // topic removed since the item was added — no quick start
    const mode = topicRecord.modes?.find((m) => m.id === item.mode);
    const defaultParams = computeDefaultParams(topicRecord, mode);
    store.upsertStudentTopicLink(store.activeStudentId, item.topicId, { params: defaultParams });
    useAppStore.setState({
      activeStudentId: store.activeStudentId,
      activeTopicId: item.topicId,
      activeModeId: item.mode,
      activeTextId: null,
      activeText: null,
    });
    store.setActiveLessonPlanItemId(item.id);
    store.setScreen("session");
  }

  function submitNote(itemId) {
    const text = noteText.trim();
    if (text) lessonPlan.markItemDone(itemId, true, text);
    setNoteDraftItemId(null);
    setNoteText("");
  }

  return (
    <>
      <button className="lesson-plan-badge" onClick={() => lessonPlan.setIsOpen((v) => !v)}>
        📋 {doneCount}/{total}
      </button>
      {lessonPlan.isOpen && (
        <div className="lesson-plan-sheet">
          <div className="lesson-plan-sheet__header">
            <span>План занятия</span>
            <button onClick={() => lessonPlan.setIsOpen(false)}>свернуть ▾</button>
          </div>
          <ul className="lesson-plan-sheet__list">
            {activeSessionPlan.items.map((item) => (
              <li key={item.id} className="lesson-plan-sheet__item">
                <div className="lesson-plan-sheet__row">
                  <span className={`lesson-plan-sheet__label${item.done ? " lesson-plan-sheet__label--done" : ""}`}>
                    {item.label ?? item.text}
                  </span>
                  {item.done ? (
                    <span aria-hidden>✅</span>
                  ) : item.kind === "topic" && topicRecords.some((r) => r.meta.id === item.topicId) ? (
                    <button className="lesson-plan-sheet__play" onClick={() => handlePlayItem(item)}>
                      Играть это
                    </button>
                  ) : (
                    <input type="checkbox" onChange={() => lessonPlan.markItemDone(item.id, true)} />
                  )}
                </div>
                {item.done && item.origin === "period" && noteDraftItemId !== item.id && (
                  <button className="lesson-plan-sheet__note-link" onClick={() => setNoteDraftItemId(item.id)}>
                    + заметка
                  </button>
                )}
                {noteDraftItemId === item.id && (
                  <div className="lesson-plan-sheet__note-row">
                    <input
                      className="lesson-plan-sheet__note-input"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Например, «хорошо получалось»"
                    />
                    <button onClick={() => submitNote(item.id)}>✓</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
