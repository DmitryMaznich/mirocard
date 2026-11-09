import { useAppStore } from "@/core/store";
import TopicLibraryScreen from "@/features/topics/TopicLibraryScreen";
import { isLocalModeProfile } from "@/features/topics/catalogService";
import { continueContext, continueDestination, formatLastActivity, previewTopicDestination,
  recentTopicContext, rememberPreviewChoice } from "@/features/topics/topicUiPreviewModel";
import TopicCover from "@/shared/components/TopicCover";
import ModeIcon from "@/shared/components/ModeIcon";
import { ChevronRightIcon } from "@/shared/components/ArrowIcons";
import { setupText } from "@/shared/i18n/setupText.js";
import { getInterfaceTopicTitle } from "@/shared/i18n/topicTitles.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { getTopicTitle } from "@/shared/utils/format";
import { isPickableMode } from "@/shared/utils/topicUtils";

// Home in the topic UI preview: «Продолжить» (the student's latest topic and
// exercise, one tap to start) above «Мои темы». No progress, no score — only
// when the last lesson was (owner's decision, 2026-11-09).
export default function HomePreview() {
  const { t, language } = useUiTranslation();
  const sessions = useAppStore((s) => s.sessions);
  const studentId = useAppStore((s) => s.activeStudentId);
  const snapshot = useAppStore((s) => s.activeSessionSnapshot);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const ownedTopics = useAppStore((s) => s.ownedTopics);
  const account = useAppStore((s) => s.account);
  const token = useAppStore((s) => s.token);
  const setScreen = useAppStore((s) => s.setScreen);
  const setActiveTopicId = useAppStore((s) => s.setActiveTopicId);
  const setActiveTextId = useAppStore((s) => s.setActiveTextId);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);

  // Same visibility rule as the topic library: another account's download on
  // this device must not surface here.
  const owned = new Set((ownedTopics ?? []).filter((item) => item.source !== "request").map((item) => item.topicId));
  const records = !account || isLocalModeProfile(account, token)
    ? topicRecords
    : topicRecords.filter((record) => record.meta.builtin || owned.has(record.meta.id));
  const last = continueContext(recentTopicContext(sessions, studentId, snapshot), records);

  return <div className="topic-ui-home-body">
    {last ? <ContinueCard last={last} t={t} language={language} onStart={start} onChange={change} />
      : <section className="topic-ui-continue">
        <div className="topic-ui-continue-label">{t("preview.firstLesson")}</div>
        <p className="topic-ui-continue-help">{t("preview.firstLessonHelp")}</p>
        <button className="topic-ui-start" onClick={() => setScreen("topics")}>+ {t("preview.addTopic")}</button>
      </section>}
    <TopicLibraryScreen embedded />
  </div>;

  function select(record, textId) {
    setActiveTopicId(record.meta.id);
    if (textId) setActiveTextId(textId);
    rememberPreviewChoice(studentId, "topic");
  }

  function start() {
    const textId = knownText(last.record, last.textId);
    select(last.record, textId);
    if (last.mode) {
      setActiveModeId(last.mode.id);
      rememberPreviewChoice(studentId, "mode");
    }
    setScreen(continueDestination(last.record, last.mode, textId));
  }

  function change() {
    const textId = knownText(last.record, last.textId);
    select(last.record, textId);
    setScreen(last.record.meta.renderer === "reading" && textId ? "modes" : previewTopicDestination(last.record));
  }
}

function knownText(record, textId) {
  return textId && record.texts?.some((text) => text.id === textId) ? textId : null;
}

function ContinueCard({ last, t, language, onStart, onChange }) {
  const { record, mode } = last;
  const text = record.texts?.find((item) => item.id === last.textId);
  const hasModes = record.modes?.some(isPickableMode);
  const modeTitle = mode ? (setupText(mode.ui?.title) || mode.id).replace(/^\d+\.\s*/, "") : null;
  const value = [text ? getTopicTitle(text.title) : null, modeTitle].filter(Boolean).join(" · ");
  const title = getInterfaceTopicTitle(record.meta.id, record.meta.title);
  const when = formatLastActivity(last.time, t, language);

  return <section className="topic-ui-continue" aria-label={t("preview.continue")}>
    <div className="topic-ui-continue-label">{t("preview.continue")}</div>
    <div className="topic-ui-continue-topic">
      <TopicCover topicId={record.meta.id} avatarPath={record.meta.avatar} title={record.meta.title} />
      <div><h2>{title}</h2>{when && <p>{t("preview.lastTime", { when })}</p>}</div>
    </div>
    {hasModes && <button className="topic-ui-mode-switch" onClick={onChange}>
      {mode?.ui?.icon ? <ModeIcon topicId={record.meta.id} iconPath={mode.ui.icon} size="medium" /> : null}
      <span className="topic-ui-mode-switch-value">
        <small>{text && !mode ? t("preview.text") : t("preview.exercise")}</small>
        {value || t("preview.chooseExercise")}
      </span>
      <span className="topic-ui-mode-switch-action">{t("preview.change")}<ChevronRightIcon size={15} /></span>
    </button>}
    <button className="topic-ui-start" onClick={onStart}>
      <svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17" fill="currentColor"><path d="M5 3l12 7-12 7z" /></svg>
      {t("preview.start")}
    </button>
  </section>;
}
