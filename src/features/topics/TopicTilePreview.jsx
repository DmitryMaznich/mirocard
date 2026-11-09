import TopicCover from "@/shared/components/TopicCover";
import { MoreDotsIcon } from "@/shared/components/ArrowIcons";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation";

// Presentation only. TopicTile remains the owner of access checks, downloads,
// confirmation, errors and progress for both interfaces.
export default function TopicTilePreview({ title, topicId, avatarPath, version, availableVersion, categoryLabel,
  description, modeCount, recent, installed, isBuiltin, presentation, status, badgeLabel,
  canOpen, loading, progress, error, disabled, onOpen, onAction, onMenu, onInfo }) {
  const { t } = useUiTranslation();
  const isCard = presentation === "installed";
  const canAct = !disabled && !loading && status !== "pending";
  const cover = <TopicCover topicId={topicId} avatarPath={avatarPath} title={title} />;
  const statusLabel = status === "update" ? t("preview.update")
    : canOpen ? t("preview.installedStatus") : badgeLabel;
  const actionLabel = canOpen && status !== "update" ? t("preview.open")
    : status === "install" ? t("preview.install")
    : status === "request" ? t("preview.subscription")
    : status === "update" ? t("topics.updateAvailable", { version: availableVersion }) : badgeLabel;

  return <article className={`topic-ui-tile topic-ui-tile--${presentation}${isCard && recent ? " topic-ui-tile--recent" : ""}`}
    data-topic-id={topicId}>
    {isCard ? <>
      {recent && <span className="topic-ui-recent">{t("preview.recent")}</span>}
      <button className="topic-ui-topic-open" disabled={!canAct} onClick={onOpen}>
        {cover}<strong>{title}</strong>
        {modeCount != null && <span className="topic-ui-mode-count">{t("preview.exerciseCount", { count: modeCount })}</span>}
        <span className="topic-ui-version">v{version}</span>
        {!canOpen && <span className="topic-ui-access">{statusLabel}</span>}
      </button>
      <button className="topic-ui-more" aria-label={`${t("topics.actions")}: ${title}`} onClick={onMenu}>
        <MoreDotsIcon size={21} />
      </button>
    </> : <>
      <button className="topic-ui-catalog-cover" onClick={onInfo}>
        {cover}<span><small>{categoryLabel}</small><strong>{title}</strong></span>
      </button>
      <div className="topic-ui-catalog-copy">
        {description && <p className="topic-ui-description">{description}</p>}
        <div className="topic-ui-metadata">
          <span>{modeCount != null ? t("preview.exerciseCount", { count: modeCount }) : ""}</span>
          <span>v{version}</span>
        </div>
        {(installed || status !== "install") && <span className={`topic-ui-status topic-ui-status--${status}`}>{statusLabel}</span>}
        <div className="topic-ui-actions">
          <button className="topic-ui-details" onClick={onInfo}>{t("preview.inside")}</button>
          {canOpen && status === "update" && <button className="topic-ui-details" onClick={onOpen}>{t("preview.open")}</button>}
          <button className="topic-ui-primary" disabled={!canAct} onClick={onAction}>{actionLabel}</button>
          {installed && !isBuiltin && <button className="topic-ui-more-inline" aria-label={`${t("topics.actions")}: ${title}`} onClick={onMenu}><MoreDotsIcon size={20} /></button>}
        </div>
      </div>
    </>}
    {loading && <div className="topic-ui-download" role="status">
      <div><span>{t("preview.progress")}</span><strong>{progress == null ? t("common.loading") : `${Math.round(progress * 100)}%`}</strong></div>
      <div className={`topic-ui-progress${progress == null ? " topic-ui-progress--indeterminate" : ""}`}
        role="progressbar" aria-label={t("topics.download")} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={progress == null ? undefined : Math.round(progress * 100)}>
        <span style={progress == null ? undefined : { width: `${Math.max(0, Math.min(100, progress * 100))}%` }} />
      </div>
    </div>}
    {error && <div className="topic-ui-download-error" role="alert"><p>{error}</p><button onClick={onAction} disabled={!canAct}>{t("common.retry")}</button></div>}
  </article>;
}
