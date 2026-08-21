import { useState } from "react";
import { getImportErrorMessage } from "./catalogService";
import { CATEGORY_STYLE, STATUS_BADGES, OTHER_CATEGORY } from "./topicCategories";
import TopicCover from "@/shared/components/TopicCover";
import { getBuiltinTopicAvatarPath } from "@/topics/builtinAssets";
import { ArrowDownSmallIcon, ArrowUpSmallIcon, CheckmarkIcon, LockSmallIcon, ClockSmallIcon, MoreDotsIcon } from "@/shared/components/ArrowIcons";

// One row in the "Темы" list — a wide horizontal pill (same template as the
// active-topic "Продолжить" strip on the home screen), not the earlier
// square cover-on-top card. Covers both a catalog entry the user hasn't
// installed yet and an already-installed record — the tile figures out
// which state it's in and shows the matching status badge, so the same list
// can mix "browse the catalog" and "open what you have" without two screens.
//
// 2026-08-20 redesign (user request): dropped the separate "Открыть" text
// button entirely — the whole row is already the tap target, the button was
// redundant. In its place, a single small circular badge on the right now
// carries the state as an icon instead of a word (checkmark = open/installed,
// down-arrow = not installed, up-arrow = update available, lock = paid tier
// awaiting a request, clock = request already sent). The "⋯"/"i" menu
// trigger sits just left of that badge, deliberately smaller and lower-
// contrast so it doesn't compete with the primary status badge for attention.
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
  const isDone = status === "active" || status === "open";

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

  // Deliberately NOT the same branch as handleTileClick: for "update", the
  // tile itself still opens the (already-installed, still-usable) topic --
  // only the badge specifically triggers the re-download.
  function handleBadgeClick(e) {
    e.stopPropagation();
    if (status === "active" || status === "open") onSelect(installedRecord);
    else if (status !== "pending") handleAction();
  }

  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE[OTHER_CATEGORY];
  const statusBadge = entry?.status ? STATUS_BADGES[entry.status] : null;
  const topicId = installedRecord?.meta.id ?? entry?.id;
  const avatarPath = installedRecord?.meta.avatar ?? getBuiltinTopicAvatarPath(topicId);

  const badgeIcon = loading ? "…"
    : status === "active" || status === "open" ? <CheckmarkIcon size={16} />
    : status === "update"  ? <ArrowUpSmallIcon size={15} />
    : status === "install" ? <ArrowDownSmallIcon size={15} />
    : status === "request" ? <LockSmallIcon size={15} />
    : <ClockSmallIcon size={15} />; // pending

  const badgeLabel = loading ? "Загрузка…"
    : status === "active"  ? "Активна"
    : status === "open"    ? "Открыть"
    : status === "update"  ? `Доступно обновление v${entry.version}`
    : status === "install" ? "Установить"
    : status === "request" ? "Запросить доступ"
    : "Запрос отправлен";

  return (
    <article
      className={`topic-tile-row ${style.cls}${canOpen ? " topic-tile-row--open" : ""}`}
      onClick={handleTileClick}
    >
      <div className="topic-tile-row__fill" aria-hidden />
      <div className="topic-tile-row__icon">
        <TopicCover topicId={topicId} avatarPath={avatarPath} title={title} size="small" />
      </div>
      <div className="topic-tile-row__text">
        <div className="topic-tile-row__eyebrow">
          <span>{category}</span>
          {statusBadge && <span className={`topic-tile-row__tag topic-tile-row__tag--${entry.status}`}>{statusBadge.label}</span>}
        </div>
        <div className="topic-tile-row__title">{title}</div>
      </div>
      {installedRecord && !isBuiltin && onMenu && (
        <button
          type="button"
          className="topic-tile-row__more"
          onClick={(e) => { e.stopPropagation(); onMenu(installedRecord); }}
          aria-label="Действия"
        >
          <MoreDotsIcon size={16} />
        </button>
      )}
      {installedRecord && isBuiltin && onInfo && (
        <button
          type="button"
          className="topic-tile-row__more"
          onClick={(e) => { e.stopPropagation(); onInfo(installedRecord); }}
          aria-label="О теме"
        >
          i
        </button>
      )}
      <button
        type="button"
        className={`topic-tile-row__badge topic-tile-row__badge--${isDone ? "done" : "get"}`}
        disabled={disabled || loading || status === "pending"}
        onClick={handleBadgeClick}
        aria-label={badgeLabel}
      >
        {badgeIcon}
      </button>
      {error && <div className="form-error">{error}</div>}
    </article>
  );
}
