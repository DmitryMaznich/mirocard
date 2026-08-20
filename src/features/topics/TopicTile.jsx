import { useState } from "react";
import { getImportErrorMessage } from "./catalogService";
import { CATEGORY_STYLE, STATUS_BADGES, OTHER_CATEGORY } from "./topicCategories";
import { CategoryGlyph } from "./CategoryIcons";
import { ArrowDownSmallIcon, ArrowUpSmallIcon, CheckmarkIcon } from "@/shared/components/ArrowIcons";

// One card in the "Темы" grid. Covers both a catalog entry the user hasn't
// installed yet and an already-installed record — the tile figures out
// which state it's in and shows the matching status chip, so the same list
// can mix "browse the catalog" and "open what you have" without two screens.
export default function TopicTile({
  title,
  category,
  entry,             // catalog descriptor, or null if not in the shared catalog (builtin / imported)
  installedRecord,   // local topic record, or null if not installed
  isActive,
  access = "free",
  claimSource,        // ownedTopics[...].source, or null
  onInstall,
  onSelect,
  onMenu,
  onInfo,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isBuiltin = Boolean(installedRecord?.meta.builtin);
  const isPending = claimSource === "request";
  const isGranted = claimSource != null && claimSource !== "request";

  let status;
  if (!installedRecord) {
    status = isPending ? "pending" : (!isGranted && access === "paid" ? "request" : "install");
  } else if (isActive) {
    status = "active";
  } else if (entry && installedRecord.meta.version !== entry.version) {
    status = "update";
  } else {
    status = "open";
  }

  const canOpen = status === "active" || status === "open" || status === "update";

  async function handleAction() {
    setLoading(true);
    setError("");
    try {
      await onInstall(entry, { force: status === "update" });
    } catch (err) {
      setError(getImportErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleTileClick() {
    if (canOpen) onSelect(installedRecord);
    else if (status !== "pending") handleAction();
  }

  function handleChipClick(e) {
    e.stopPropagation();
    if (status === "active" || status === "open") onSelect(installedRecord);
    else if (status !== "pending") handleAction();
  }

  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE[OTHER_CATEGORY];
  const badge = entry?.status ? STATUS_BADGES[entry.status] : null;

  const chipLabel = loading ? "…"
    : status === "active"  ? "Активна"
    : status === "open"    ? "Открыть"
    : status === "update"  ? `v${entry.version}`
    : status === "install" ? "Установить"
    : status === "request" ? "Запросить доступ"
    : "Запрос отправлен";

  const chipIcon = status === "active"  ? <CheckmarkIcon size={11} />
    : status === "install" ? <ArrowDownSmallIcon size={11} />
    : status === "update"  ? <ArrowUpSmallIcon size={11} />
    : null;

  const versionText = installedRecord
    ? (isBuiltin ? "встроенная" : `v${installedRecord.meta.version}`)
    : (entry ? `v${entry.version}` : "");

  return (
    <article
      className={`topic-tile${canOpen ? " topic-tile--open" : ""}`}
      onClick={handleTileClick}
    >
      <div className={`topic-tile__cover ${style.cls}`}>
        {badge && <span className={`topic-tile__badge ${badge.className}`}>{badge.label}</span>}
        <CategoryGlyph name={style.icon} />
        {installedRecord && !isBuiltin && onMenu && (
          <button
            className="topic-tile__menu"
            onClick={(e) => { e.stopPropagation(); onMenu(installedRecord); }}
            aria-label="Действия"
          >
            ⋯
          </button>
        )}
        {installedRecord && isBuiltin && onInfo && (
          <button
            className="topic-tile__menu"
            onClick={(e) => { e.stopPropagation(); onInfo(installedRecord); }}
            aria-label="О теме"
          >
            i
          </button>
        )}
      </div>
      <div className="topic-tile__body">
        <div className="topic-tile__title">{title}</div>
        <div className="topic-tile__foot">
          <span className="topic-tile__status-text">{versionText}</span>
          <button
            className={`topic-action-chip topic-action-chip--${status}`}
            disabled={disabled || loading || status === "pending"}
            onClick={handleChipClick}
          >
            {chipIcon}
            {chipLabel}
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
      </div>
    </article>
  );
}
