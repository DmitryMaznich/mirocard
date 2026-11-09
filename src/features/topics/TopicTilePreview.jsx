import { useState } from "react";
import TopicCover from "@/shared/components/TopicCover";
import { ArrowDownSmallIcon, ArrowUpSmallIcon, CheckmarkIcon, ClockSmallIcon, MoreDotsIcon } from "@/shared/components/ArrowIcons";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation";

// Presentation only. TopicTile remains the owner of access checks, downloads,
// errors and progress for both interfaces.
//   installed — a compact tile on Home: cover and title in one row, the
//               short description under them across the whole tile;
//   catalog   — one row of «Добавить тему»; tapping it opens a bottom sheet
//               with the long description, which replaces both «Что внутри»
//               and the «Установить тему?» dialog.
export default function TopicTilePreview({ title, topicId, avatarPath, categoryLabel,
  shortDescription, description, modeCount, recent, installed, isBuiltin, access, presentation, status, badgeLabel,
  canOpen, loading, progress, error, disabled, onOpen, onAction, onMenu }) {
  const { t } = useUiTranslation();
  // Remembers whether the topic was installed when the sheet opened: once a
  // download from the sheet finishes, the sheet closes by itself.
  const [details, setDetails] = useState(null);
  const sheetOpen = details != null && !(!details.wasInstalled && installed && !loading);
  const canAct = !disabled && !loading && status !== "pending";
  const cover = <TopicCover topicId={topicId} avatarPath={avatarPath} title={title} />;
  const download = loading && <div className="topic-ui-download" role="status">
    <div><span>{t("preview.progress")}</span><strong>{progress == null ? t("common.loading") : `${Math.round(progress * 100)}%`}</strong></div>
    <div className={`topic-ui-progress${progress == null ? " topic-ui-progress--indeterminate" : ""}`}
      role="progressbar" aria-label={t("topics.download")} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={progress == null ? undefined : Math.round(progress * 100)}>
      <span style={progress == null ? undefined : { width: `${Math.max(0, Math.min(100, progress * 100))}%` }} />
    </div>
  </div>;
  const failure = error && <div className="topic-ui-download-error" role="alert"><p>{error}</p>
    <button onClick={onAction} disabled={!canAct}>{t("common.retry")}</button></div>;

  if (presentation === "installed") {
    return <article className={`topic-ui-tile topic-ui-tile--installed${recent ? " topic-ui-tile--recent" : ""}`} data-topic-id={topicId}>
      <button className="topic-ui-topic-open" disabled={!canAct} onClick={onOpen}>
        {cover}
        <strong>{title}{status === "update" && <span className="topic-ui-new">{t("preview.new")}</span>}</strong>
        {shortDescription && <span className="topic-ui-short">{shortDescription}</span>}
        {!canOpen && <span className="topic-ui-access">{badgeLabel}</span>}
      </button>
      <button className="topic-ui-more" aria-label={`${t("topics.actions")}: ${title}`} onClick={onMenu}>
        <MoreDotsIcon size={18} />
      </button>
      {download}{failure}
    </article>;
  }

  const actionIcon = loading ? "…"
    : canOpen && status !== "update" ? <CheckmarkIcon size={18} />
    : status === "update" ? <ArrowUpSmallIcon size={18} />
    : status === "install" ? <ArrowDownSmallIcon size={18} />
    : status === "pending" || status === "soon" ? <ClockSmallIcon size={18} />
    : null;
  const actionText = status === "request" ? t("preview.subscription") : status === "soon" ? badgeLabel : null;
  const sheetLabel = canOpen && status !== "update" ? t("preview.open")
    : status === "install" ? t("preview.addToMine")
    : status === "update" ? t("preview.update")
    : status === "request" ? t("preview.subscription") : badgeLabel;

  return <article className="topic-ui-tile topic-ui-tile--catalog" data-topic-id={topicId}>
    <div className="topic-ui-catalog-row">
      <button className="topic-ui-catalog-open" onClick={() => setDetails({ wasInstalled: installed })}>
        {cover}
        <span className="topic-ui-catalog-text">
          {categoryLabel && <small>{categoryLabel}</small>}
          <strong>{title}</strong>
          {(shortDescription || description) && <span className="topic-ui-short">{shortDescription || description}</span>}
        </span>
      </button>
      <button className={`topic-ui-get topic-ui-get--${canOpen && status !== "update" ? "open" : status}${actionText ? " topic-ui-get--text" : ""}`}
        disabled={!canAct} aria-label={`${badgeLabel}: ${title}`}
        onClick={canOpen && status !== "update" ? onOpen : onAction}>
        {actionText ?? actionIcon}
      </button>
    </div>
    {download}{failure}
    {sheetOpen && <div className="topic-ui-sheet-overlay" onClick={(event) => event.target === event.currentTarget && setDetails(null)}>
      <div className="topic-ui-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="topic-ui-sheet-grab" aria-hidden="true" />
        <div className="topic-ui-sheet-head">{cover}<div><h2>{title}</h2>
          <p>{[categoryLabel, modeCount != null ? t("preview.exerciseCount", { count: modeCount }) : null].filter(Boolean).join(" · ")}</p></div></div>
        {description && <p className="topic-ui-sheet-description">{description}</p>}
        <div className="topic-ui-sheet-facts">
          {installed && <span>{t("preview.installed")}</span>}
          {!installed && !isBuiltin && <span>{access === "paid" ? t("preview.subscription") : t("preview.free")}</span>}
        </div>
        {download}{failure}
        <button className="topic-ui-sheet-primary" disabled={!canAct}
          onClick={() => { if (canOpen && status !== "update") { setDetails(null); onOpen(); } else onAction(); }}>
          {sheetLabel}
        </button>
        <button className="topic-ui-sheet-close" onClick={() => setDetails(null)}>{t("common.cancel")}</button>
      </div>
    </div>}
  </article>;
}
