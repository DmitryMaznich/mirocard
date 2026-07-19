import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { useLessonPlan } from "./LessonPlanContext";
import { computeDefaultParams } from "@/StudentApp";
import SessionPlanBuilderSheet from "./SessionPlanBuilderSheet";
import "./lessonPlan.css";

export default function SessionPlanDrawer({
  isOpen,
  onClose,
  modeTitle,
  onOpenModeSettings,
  soundEnabled,
  onToggleSound,
  isStudentPortal,
  adultConfirmAdvance,
  lockHoldProgress,
  lockFlash,
  onLockPointerDown,
  onLockPointerUp,
}) {
  const lessonPlan = useLessonPlan();
  const topicRecords = useAppStore((s) => s.topicRecords);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const [activeTab, setActiveTab] = useState("plan");
  const [noteDraftItemId, setNoteDraftItemId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeSessionPlan = lessonPlan?.activeSessionPlan ?? null;

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

  function handleBuilderClose() {
    setShowBuilder(false);
    lessonPlan?.refresh(activeStudentId);
  }

  return (
    <>
      <div className="session-plan-scrim" onClick={onClose} />
      <div className="session-plan-panel" role="dialog" aria-modal="true">
        <div className="session-plan-panel__tabs">
          <button
            type="button"
            className={`session-plan-panel__tab${activeTab === "plan" ? " session-plan-panel__tab--active" : ""}`}
            onClick={() => setActiveTab("plan")}
          >
            План занятия
          </button>
          <button
            type="button"
            className={`session-plan-panel__tab${activeTab === "settings" ? " session-plan-panel__tab--active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Настройки режима
          </button>
          <button
            type="button"
            className={`session-plan-panel__tab${activeTab === "session" ? " session-plan-panel__tab--active" : ""}`}
            onClick={() => setActiveTab("session")}
          >
            Сессия
          </button>
        </div>

        <div className="session-plan-panel__body">
          {activeTab === "plan" && (
            activeSessionPlan ? (
              <ul className="lesson-plan-sheet__list">
                {activeSessionPlan.items.map((item) => {
                  const playable = !item.done && isPlayable(item);
                  const clickable = item.done || !playable;
                  return (
                    <li key={item.id} className="lesson-plan-sheet__item">
                      <div className="lesson-plan-sheet__row">
                        <button
                          type="button"
                          className={`lesson-plan-sheet__check${item.done ? " lesson-plan-sheet__check--done" : ""}`}
                          onClick={clickable ? () => lessonPlan.markItemDone(item.id, !item.done) : undefined}
                          disabled={!clickable}
                          aria-label={item.done ? "Отменить отметку" : "Отметить выполненным"}
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
            ) : (
              <div className="session-plan-empty">
                <div className="session-plan-empty__text">Плана на сегодня пока нет</div>
                <button className="lesson-plan-sheet__play" onClick={() => setShowBuilder(true)}>
                  Собрать план
                </button>
              </div>
            )
          )}

          {activeTab === "settings" && (
            <div className="session-plan-settings-row">
              <span className="session-plan-settings-row__label">{modeTitle}</span>
              <button className="lesson-plan-sheet__play" onClick={onOpenModeSettings}>
                Изменить →
              </button>
            </div>
          )}

          {activeTab === "session" && (
            <div className="session-plan-session-tab">
              <div className="session-plan-settings-row">
                <span className="session-plan-settings-row__label">Звук</span>
                <button
                  type="button"
                  className={`session-audio-icon-button${soundEnabled ? " session-audio-icon-button--active" : ""}`}
                  onClick={onToggleSound}
                  aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
                >
                  <span className="session-audio-speaker-icon">
                    {soundEnabled ? "🔊" : "🔇"}
                  </span>
                </button>
              </div>

              {!isStudentPortal && (
                <div className="session-plan-settings-row">
                  <span className="session-plan-settings-row__label">Переход с подтверждением</span>
                  <button
                    type="button"
                    className="session-lock-btn"
                    style={{ "--lock-p": lockHoldProgress }}
                    onPointerDown={onLockPointerDown}
                    onPointerUp={onLockPointerUp}
                    onPointerLeave={onLockPointerUp}
                    onPointerCancel={onLockPointerUp}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label={adultConfirmAdvance ? "Снять блокировку (удержать)" : "Включить блокировку (удержать)"}
                  >
                    <span className="session-lock-btn__icon">
                      {adultConfirmAdvance ? "🔒" : "🔓"}
                    </span>
                    {lockFlash && (
                      <span className={`session-lock-flash session-lock-flash--${lockFlash}`}>
                        {lockFlash === "locked" ? "Блок." : "Снято"}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showBuilder && (
        <SessionPlanBuilderSheet
          studentId={activeStudentId}
          periodPlan={null}
          existingSessionPlan={activeSessionPlan}
          onClose={handleBuilderClose}
        />
      )}
    </>
  );
}
