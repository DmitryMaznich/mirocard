import { useState } from "react";
import { useAppStore } from "@/core/store";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { formatDate } from "@/shared/utils/format";

function LastResultBadge({ session }) {
  if (!session) return <span className="mode-badge mode-badge--none">Не проходили</span>;
  if (session.percentCorrect === null) {
    return <span className="mode-badge mode-badge--browse">Без оценки · {formatDate(session.completedAt)}</span>;
  }
  const ok = session.percentCorrect >= 70;
  return (
    <span className={`mode-badge ${ok ? "mode-badge--ok" : "mode-badge--warn"}`}>
      {session.percentCorrect}% · {formatDate(session.completedAt)}
    </span>
  );
}

function getLastModeSession(sessions, studentId, topicId, modeId) {
  return sessions
    .filter((s) => s.studentId === studentId && s.topicId === topicId && s.modeId === modeId)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0] ?? null;
}

export default function ModePickerScreen() {
  const setScreen       = useAppStore((s) => s.setScreen);
  const activeTopicId   = useAppStore((s) => s.activeTopicId);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const topicRecords    = useAppStore((s) => s.topicRecords);
  const sessions        = useAppStore((s) => s.sessions);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);

  const [methodology, setMethodology] = useState(null);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);

  if (!topicRecord) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("home")}>←</button>
          <h1 className="screen-title">Режим</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__text">Тема не выбрана</div>
          <Button onClick={() => setScreen("topics")}>Выбрать тему</Button>
        </div>
      </div>
    );
  }

  function pickMode(mode) {
    setActiveModeId(mode.id);
    setScreen("params");
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">{topicRecord.meta.title}</h1>
      </div>

      <ul className="mode-list">
        {topicRecord.modes.map((mode) => {
          const lastSession = getLastModeSession(sessions, activeStudentId, activeTopicId, mode.id);
          return (
            <li key={mode.id} className="mode-item-row">
              <button className="mode-item mode-item--flex" onClick={() => pickMode(mode)}>
                <div>
                  <div className="mode-item__title">{mode.ui?.title ?? mode.id}</div>
                  <div className="mode-item__desc">{mode.ui?.instruction ?? ""}</div>
                  <LastResultBadge session={lastSession} />
                </div>
              </button>
              {mode.methodology && (
                <button
                  className="mode-info-btn"
                  onClick={(e) => { e.stopPropagation(); setMethodology(mode); }}
                >
                  ?
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {methodology && (
        <Modal title={methodology.ui?.title} onClose={() => setMethodology(null)}>
          <p className="methodology-text">{methodology.methodology?.text}</p>
          {methodology.methodology?.tips?.length > 0 && (
            <ul className="methodology-tips">
              {methodology.methodology.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          )}
          {methodology.methodology?.duration && (
            <div className="methodology-duration">⏱ {methodology.methodology.duration}</div>
          )}
        </Modal>
      )}
    </div>
  );
}
