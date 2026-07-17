import { useState } from "react";
import { useAppStore } from "@/core/store";
import { useLessonPlan } from "./LessonPlanContext";
import { computeDefaultParams } from "@/StudentApp";
import "./lessonPlan.css";

const RING_RADIUS = 12.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function LessonPlanPanel() {
  const lessonPlan = useLessonPlan();
  const topicRecords = useAppStore((s) => s.topicRecords);
  const [noteDraftItemId, setNoteDraftItemId] = useState(null);
  const [noteText, setNoteText] = useState("");

  const activeSessionPlan = lessonPlan?.activeSessionPlan ?? null;
  if (!activeSessionPlan) return null;

  const total = activeSessionPlan.items.length;
  const doneCount = activeSessionPlan.items.filter((item) => item.done).length;
  const isComplete = total > 0 && doneCount === total;
  const ringOffset = RING_CIRCUMFERENCE * (1 - doneCount / Math.max(total, 1));

  function isPlayable(item) {
    return item.kind === "topic" && topicRecords.some((r) => r.meta.id === item.topicId);
  }

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
      <button
        className={`lesson-plan-badge${isComplete ? " lesson-plan-badge--complete" : ""}`}
        onClick={() => lessonPlan.setIsOpen((v) => !v)}
        aria-label="План занятий"
      >
        <span className="lesson-plan-badge__ring-wrap">
          <svg viewBox="0 0 30 30">
            <circle className="lesson-plan-badge__ring-track" cx="15" cy="15" r={RING_RADIUS} fill="none" strokeWidth="3" />
            <circle
              className="lesson-plan-badge__ring-fill"
              cx="15" cy="15" r={RING_RADIUS} fill="none" strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <span className="lesson-plan-badge__icon" aria-hidden>
            {isComplete ? (
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M7 8h6M7 11.5h6M7 15h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </span>
        </span>
        <span className="lesson-plan-badge__count">
          {doneCount}<small>из {total}</small>
        </span>
      </button>
      {lessonPlan.isOpen && (
        <div className="lesson-plan-sheet">
          <div className="lesson-plan-sheet__header">
            <span className="lesson-plan-sheet__title">План занятий</span>
            <button onClick={() => lessonPlan.setIsOpen(false)}>свернуть ▾</button>
          </div>
          <ul className="lesson-plan-sheet__list">
            {activeSessionPlan.items.map((item) => {
              const playable = !item.done && isPlayable(item);
              const manuallyCheckable = !item.done && !playable;
              return (
                <li key={item.id} className="lesson-plan-sheet__item">
                  <div className="lesson-plan-sheet__row">
                    <button
                      type="button"
                      className={`lesson-plan-sheet__check${item.done ? " lesson-plan-sheet__check--done" : ""}`}
                      onClick={manuallyCheckable ? () => lessonPlan.markItemDone(item.id, true) : undefined}
                      disabled={!manuallyCheckable && !item.done}
                      aria-label={item.done ? "Выполнено" : "Отметить выполненным"}
                    >
                      {item.done ? "✓" : ""}
                    </button>
                    <span className={`lesson-plan-sheet__label${item.done ? " lesson-plan-sheet__label--done" : ""}`}>
                      {item.label ?? item.text}
                    </span>
                    {playable && (
                      <button className="lesson-plan-sheet__play" onClick={() => handlePlayItem(item)}>
                        Играть это
                      </button>
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
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
