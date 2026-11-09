import { useUiTranslation } from "@/shared/i18n/useUiTranslation";
import { BackArrowIcon, ChevronRightIcon } from "@/shared/components/ArrowIcons";
import TopicCover from "@/shared/components/TopicCover";
import ModeIcon from "@/shared/components/ModeIcon";

export function ModePickerPreviewHeader({ topic, title, count, onBack, onAbout, onStatistics }) {
  const { t } = useUiTranslation();
  return <>
    <div className="topic-ui-mode-navigation">
      <button className="topic-ui-back" aria-label={t("common.back")} onClick={onBack}><BackArrowIcon /></button>
      <span className="topic-ui-mode-navigation-spacer" />
      {onStatistics && <button className="topic-ui-pill-button" onClick={onStatistics}>{t("preview.statistics")}</button>}
      <button className="topic-ui-pill-button" onClick={onAbout}>{t("topics.about")}</button>
    </div>
    <header className="topic-ui-mode-heading">
      <TopicCover topicId={topic.meta.id} avatarPath={topic.meta.avatar} title={topic.meta.title} />
      <div><h1>{title}</h1><p>{t("preview.exerciseCount", { count })}</p></div>
    </header>
  </>;
}

// One exercise: icon, title and when it was last done — no score
// (owner's decision, 2026-11-09). The instruction moved behind «i».
export function ModePickerPreviewRow({ topicId, mode, title, index, disabled, test,
  recent, lastTime, onSelect, onInfo, readiness }) {
  const { t } = useUiTranslation();
  return <div className={`topic-ui-exercise${recent ? " topic-ui-exercise--recent" : ""}${test ? " topic-ui-exercise--test" : ""}`}>
    <button className="topic-ui-exercise-open" disabled={disabled} onClick={onSelect}>
      {mode.ui?.icon ? <ModeIcon topicId={topicId} iconPath={mode.ui.icon} size="medium" />
        : <span className="topic-ui-exercise-number" aria-hidden="true">{index + 1}</span>}
      <span className="topic-ui-exercise-copy">
        {(recent || test) && <span className="topic-ui-exercise-tags">
          {recent && <span className="topic-ui-mode-recent">{t("preview.lastTimePill")}</span>}
          {test && <span className="topic-ui-mode-test">{t("preview.test")}</span>}
        </span>}
        <strong>{title.replace(/^\d+\.\s*/, "")}</strong>
        <span className="topic-ui-exercise-when">{lastTime || t("preview.notYet")}</span>
      </span>
      <ChevronRightIcon size={16} />
    </button>
    <button className="topic-ui-exercise-info" onClick={onInfo} aria-label={`${t("mode.about")}: ${title}`}>
      <span aria-hidden="true">i</span>
    </button>
    {readiness && <div className="topic-ui-readiness">{readiness}</div>}
  </div>;
}
