import { useUiTranslation } from "@/shared/i18n/useUiTranslation";
import { BackArrowIcon, ChevronRightIcon } from "@/shared/components/ArrowIcons";
import ModeIcon from "@/shared/components/ModeIcon";

// The app's own screen header (dark bar, square «back», «i» for the topic) —
// the same one the lesson settings, statistics and every other screen after
// this one have, so the path Home → exercises → settings keeps one look.
// «Статистика» sits in the bar like «Обновить» on the statistics screen.
export function ModePickerPreviewHeader({ title, onBack, onAbout, onStatistics }) {
  const { t } = useUiTranslation();
  return <div className="screen-header topic-ui-screen-header">
    <button className="back-btn" aria-label={t("common.back")} onClick={onBack}><BackArrowIcon /></button>
    <h1 className="screen-title">{title}</h1>
    {onStatistics && <button className="header-action-btn topic-ui-header-text-btn" onClick={onStatistics}>{t("preview.statistics")}</button>}
    <button className="header-info-btn" onClick={onAbout} title={t("topics.about")} aria-label={t("topics.about")}>i</button>
  </div>;
}

export function ModePickerPreviewSection({ title }) {
  return <li className="mode-item-row topic-ui-exercise-section"><h2>{title}</h2></li>;
}

// One exercise: icon, title and when it was last done — no score
// (owner's decision, 2026-11-09). The instruction is behind «?» — the same
// sign the lesson settings use for the same text.
export function ModePickerPreviewRow({ topicId, mode, title, index, disabled, test,
  recent, lastTime, onSelect, onInfo, readiness }) {
  const { t } = useUiTranslation();
  return <div className={`topic-ui-exercise${recent ? " topic-ui-exercise--recent" : ""}${test ? " topic-ui-exercise--test" : ""}`}>
    <button className="topic-ui-exercise-open" disabled={disabled} onClick={onSelect}>
      {mode.ui?.icon ? <ModeIcon topicId={topicId} iconPath={mode.ui.icon} size="medium" />
        : <span className="topic-ui-exercise-number" aria-hidden="true">{index + 1}</span>}
      <span className="topic-ui-exercise-copy">
        {recent && <span className="topic-ui-exercise-tags"><span className="topic-ui-mode-recent">{t("preview.lastTimePill")}</span></span>}
        <strong>{title.replace(/^\d+\.\s*/, "")}</strong>
        <span className="topic-ui-exercise-when">{lastTime || t("preview.notYet")}</span>
      </span>
      <ChevronRightIcon size={16} />
    </button>
    <button className="topic-ui-exercise-info" onClick={onInfo} aria-label={`${t("mode.about")}: ${title}`}>
      <span aria-hidden="true">?</span>
    </button>
    {readiness && <div className="topic-ui-readiness">{readiness}</div>}
  </div>;
}
