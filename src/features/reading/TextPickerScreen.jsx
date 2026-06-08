import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { formatDate, getTopicTitle } from "@/shared/utils/format";
import { getUserRecipes } from "@/core/groupStore";

const KIND_LABELS = { poem: "стих", instruction: "инструкция", shopping_list: "список" };

function getTextTitle(text) {
  return getTopicTitle(text?.title) || text?.id || "";
}

function getLastTextSession(sessions, studentId, topicId, textId) {
  return sessions
    .filter((session) => session.studentId === studentId && session.topicId === topicId && session.textId === textId)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0] ?? null;
}

function TextResultBadge({ session }) {
  if (!session) return <span className="mode-badge mode-badge--none">Не проходили</span>;
  return <span className="mode-badge mode-badge--browse">Было занятие · {formatDate(session.completedAt)}</span>;
}

function ReadingTextThumb({ topicId, text }) {
  const url = useTopicFile(topicId, text?.image);

  if (text?.image && url) {
    return (
      <img
        className="reading-text-thumb"
        src={url}
        alt={`Иллюстрация: ${getTextTitle(text)}`}
        draggable={false}
      />
    );
  }

  return <div className="reading-text-kind">{KIND_LABELS[text.kind] ?? "проза"}</div>;
}

export default function TextPickerScreen() {
  const setScreen        = useAppStore((s) => s.setScreen);
  const activeTopicId    = useAppStore((s) => s.activeTopicId);
  const activeStudentId  = useAppStore((s) => s.activeStudentId);
  const topicRecords     = useAppStore((s) => s.topicRecords);
  const sessions         = useAppStore((s) => s.sessions);
  const setActiveText    = useAppStore((s) => s.setActiveText);
  const setActiveModeId  = useAppStore((s) => s.setActiveModeId);

  const topicRecord = topicRecords.find((record) => record.meta.id === activeTopicId);
  const [userRecipes, setUserRecipes] = useState([]);

  useEffect(() => {
    if (activeTopicId) {
      getUserRecipes(activeTopicId).then(setUserRecipes).catch(() => {});
    }
  }, [activeTopicId]);

  const texts = [...(topicRecord?.texts ?? []), ...userRecipes];

  function pickText(text) {
    setActiveText(text);
    if (text.kind === "instruction") {
      setActiveModeId("follow_instruction");
      setScreen("home");
    } else if (text.kind === "shopping_list") {
      setActiveModeId("shopping_list");
      setScreen("home");
    } else {
      setScreen("modes");
    }
  }

  if (!topicRecord || topicRecord.meta.renderer !== "reading") {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("home")}>←</button>
          <h1 className="screen-title">Тексты</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__text">Тема чтения не выбрана</div>
          <Button onClick={() => setScreen("topics")}>Выбрать тему</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">{getTopicTitle(topicRecord.meta.title)}</h1>
        <button className="header-action-btn" onClick={() => setScreen("all_texts")} title="Все тексты">≡</button>
      </div>

      {texts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__text">В теме нет текстов</div>
        </div>
      ) : (
        <ul className="topic-list reading-text-list">
          {texts.map((text) => {
            const lastSession = getLastTextSession(sessions, activeStudentId, activeTopicId, text.id);
            return (
              <li
                key={text.id}
                className="topic-item reading-text-item"
                role="button"
                tabIndex={0}
                onClick={() => pickText(text)}
                onKeyDown={(event) => event.key === "Enter" && pickText(text)}
              >
                <ReadingTextThumb topicId={activeTopicId} text={text} />
                <div className="topic-item__info">
                  <div className="topic-item__title">{getTextTitle(text)}</div>
                  <div className="topic-item__meta">
                    {text.kind === "instruction"
                      ? `${text.stepCount ?? text.steps?.length ?? 0} шагов`
                      : `${text.lines?.length ?? 0} строк · уровень ${text.level ?? 1}`}
                    {text.status === "final" && <span className="recipe-status-badge">✓ финал</span>}
                  </div>
                  <TextResultBadge session={lastSession} />
                </div>
                <span className="reading-text-arrow">→</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
