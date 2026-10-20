import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { translateUi as tr } from "@/shared/i18n/uiLanguage.js";
import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { formatDate, getTopicTitle } from "@/shared/utils/format";
import { getUserRecipes } from "@/core/groupStore";
import { BackArrowIcon, ChevronRightIcon } from "@/shared/components/ArrowIcons";

const KIND_LABELS = () => ({ poem: tr("reading.poem"), instruction: tr("reading.instruction"), shopping_list: tr("reading.list"), safe_code: tr("reading.safe"), sentence_pool: tr("reading.tasks"), poem_book: tr("reading.book") });

function getTextTitle(text) {
  return getTopicTitle(text?.title) || text?.id || "";
}

function getLastTextSession(sessions, studentId, topicId, textId) {
  return sessions
    .filter((session) => session.studentId === studentId && session.topicId === topicId && session.textId === textId)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0] ?? null;
}

function TextResultBadge({ session }) {
  const { t: tr } = useUiTranslation();
  if (!session) return <span className="mode-badge mode-badge--none">{tr("mode.notTried")}</span>;
  return <span className="mode-badge mode-badge--browse">{tr("reading.lastSession", { date: formatDate(session.completedAt) })}</span>;
}

function ReadingTextThumb({ topicId, text }) {
  const { t: tr } = useUiTranslation();
  const url = useTopicFile(topicId, text?.image);

  if (text?.image && url) {
    return (
      <img
        className="reading-text-thumb"
        src={url}
        alt={tr("reading.illustration", { title: getTextTitle(text) })}
        draggable={false}
      />
    );
  }

  return <div className="reading-text-kind">{KIND_LABELS()[text.kind] ?? tr("reading.prose")}</div>;
}

export default function TextPickerScreen() {
  const { t: tr } = useUiTranslation();
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

  // single sentence_pool text — skip picker, go straight to mode selection
  useEffect(() => {
    const builtIn = topicRecord?.texts ?? [];
    if (builtIn.length === 1 && builtIn[0].kind === "sentence_pool") {
      setActiveText(builtIn[0]);
      setScreen("modes");
      return;
    }
    // reading_short_stories reads as one continuous "Читаем рассказы" session
    // covering every story (see engine.js's buildAllStoriesTasks) — picking
    // one of the 12 rows here would be misleading (every row starts the same
    // session, from story 1, not from the one tapped), so skip this list
    // entirely and go straight to that mode's params (which story) screen.
    // The picked text itself is just an anchor the store's activeText/
    // activeTextId expect to be non-null elsewhere; which one doesn't matter.
    if (activeTopicId === "reading_short_stories" && builtIn.length) {
      setActiveText(builtIn[0]);
      setScreen("modes");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pickText(text) {
    setActiveText(text);
    if (text.kind === "instruction") {
      setActiveModeId("follow_instruction");
      setScreen("home");
    } else if (text.kind === "shopping_list") {
      setActiveModeId("shopping_list");
      setScreen("home");
    } else if (text.kind === "safe_code") {
      setActiveModeId("safe_code");
      setScreen("home");
    } else if (text.kind === "poem_book") {
      setActiveModeId("read_poem_book");
      setScreen("home");
    } else {
      setScreen("modes");
    }
  }

  if (!topicRecord || topicRecord.meta.renderer !== "reading") {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
          <h1 className="screen-title">{tr("reading.title")}</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__text">{tr("reading.noTopic")}</div>
          <Button onClick={() => setScreen("topics")}>{tr("mode.chooseTopic")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">{getTopicTitle(topicRecord.meta.title)}</h1>
        <button className="header-action-btn" onClick={() => setScreen("all_texts")} title={tr("setup.allTexts")}>≡</button>
      </div>

      {texts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__text">{tr("reading.noTexts")}</div>
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
                  {text.kind === "poem_book" ? (
                    <div className="topic-item__meta">{`${text.pages?.length ?? 0} стихов`}</div>
                  ) : text.kind !== "instruction" && (
                    <div className="topic-item__meta">
                      {`${text.lines?.length ?? 0} строк · уровень ${text.level ?? 1}`}
                    </div>
                  )}
                  {text.status === "final" && (
                    <div className="topic-item__meta">
                      <span className="recipe-status-badge">{tr("reading.final")}</span>
                    </div>
                  )}
                  <TextResultBadge session={lastSession} />
                </div>
                <span className="reading-text-arrow"><ChevronRightIcon size={16} /></span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
