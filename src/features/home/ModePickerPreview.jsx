import { useUiTranslation } from "@/shared/i18n/useUiTranslation";
import { BackArrowIcon, ChevronRightIcon } from "@/shared/components/ArrowIcons";
import TopicCover from "@/shared/components/TopicCover";
import ModeIcon from "@/shared/components/ModeIcon";

export function ModePickerPreviewHeader({ topic, title, count, onBack, onAbout }) {
  const { t } = useUiTranslation();
  return <>
    <div className="topic-ui-mode-navigation">
      <button onClick={onBack}><BackArrowIcon />{t("common.back")}</button>
      <button onClick={onAbout}>{t("topics.about")}</button>
    </div>
    <header className="topic-ui-mode-heading">
      <TopicCover topicId={topic.meta.id} avatarPath={topic.meta.avatar} title={topic.meta.title} />
      <div><h1>{title}</h1><p>{t("preview.exerciseCount", { count })} · v{topic.meta.version}</p></div>
    </header>
    <h2 className="topic-ui-exercise-heading">{t("preview.exercises")}</h2>
  </>;
}

export function ModePickerPreviewRow({ topicId, mode, title, instruction, index, disabled,
  recent, result, readiness, onSelect, onInfo }) {
  const { t } = useUiTranslation();
  return <div className={`topic-ui-exercise${recent ? " topic-ui-exercise--recent" : ""}${mode.finite || /Контрольная работа/.test(title) ? " topic-ui-exercise--test" : ""}`}>
    <button className="topic-ui-exercise-open" disabled={disabled} onClick={onSelect}>
      {mode.ui?.icon ? <ModeIcon topicId={topicId} iconPath={mode.ui.icon} size="medium" />
        : <span className="topic-ui-exercise-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}
      <span className="topic-ui-exercise-copy">
        {recent && <span className="topic-ui-mode-recent">{t("preview.recent")}</span>}
        <strong>{title.replace(/^\d+\.\s*/, "")}</strong>
        {instruction && <span className="topic-ui-exercise-instruction">{instruction}</span>}
        {result}
      </span>
      <ChevronRightIcon size={17} />
    </button>
    <button className="topic-ui-exercise-info" onClick={onInfo} aria-label={`${t("mode.about")}: ${title}`}>
      <span aria-hidden="true">i</span>
    </button>
    {readiness && <div className="topic-ui-readiness">{readiness}</div>}
  </div>;
}
