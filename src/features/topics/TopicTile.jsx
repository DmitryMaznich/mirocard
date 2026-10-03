import { useState } from "react";
import { getImportErrorMessage } from "./catalogService";
import { STATUS_BADGES } from "./topicCategories";
import TopicCover from "@/shared/components/TopicCover";
import { getBuiltinTopicAvatarPath } from "@/topics/builtinAssets";
import { ArrowDownSmallIcon, ArrowUpSmallIcon, CheckmarkIcon, LockSmallIcon, ClockSmallIcon, MoreDotsIcon } from "@/shared/components/ArrowIcons";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";

// One row in the "Темы" list — a neutral bordered card (Claude Desktop
// connector-catalog look), not the earlier colored-pill fill. Covers both a
// catalog entry the user hasn't installed yet and an already-installed
// record — the tile figures out which state it's in and shows the matching
// status badge, so the same list can mix "browse the catalog" and "open what
// you have" without two screens.
//
// 2026-08-20 redesign (user request): dropped the separate "Открыть" text
// button entirely — the whole row is already the tap target, the button was
// redundant. In its place, a single small circular badge on the right now
// carries the state as an icon instead of a word (checkmark = open/installed,
// down-arrow = not installed, up-arrow = update available, lock = paid tier,
// requires a subscription, clock = legacy manual-request state). The "⋯"/"i" menu
// trigger sits just left of that badge, deliberately smaller and lower-
// contrast so it doesn't compete with the primary status badge for attention.
//
// 2026-09-04 redesign (user request): dropped the per-category color fill —
// category is still shown via section headers/filter chips, but the card
// itself is a plain white row now, and color is reserved for the status
// badge only.
export default function TopicTile({
  title,
  entry,             // catalog descriptor, or null if not in the shared catalog (builtin / imported)
  installedRecord,   // local topic record, or null if not installed
  isActive,
  access = "free",
  claimSource,        // ownedTopics[...].source, or null
  personalCaption,    // getPersonalTopicCaption() result, or null — imported/granted topics only
  // True when this is a previously-claimed PAID topic whose entitlement
  // (subscription/trial/promo) has since expired. A downloaded copy may
  // still sit in local storage (see catalogService's DRM note), but the
  // app itself must stop offering to open it -- same locked treatment as
  // never having claimed it, prompting a resubscribe instead.
  entitlementExpired = false,
  // True while the account holds any active entitlement (trial, promo,
  // subscription). A paid deck is then free to take, so it must not wear the
  // lock -- newcomers read a wall of locks as "everything is paid" (launch
  // testing finding N3). Claiming still goes through the backend as before.
  hasAccess = false,
  onInstall,
  onSelect,
  onMenu,
  onInfo,
  onLockedTap,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);
  // 0..1 download fraction; null = size unknown (indeterminate bar).
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [confirmingInstall, setConfirmingInstall] = useState(false);

  const isBuiltin = Boolean(installedRecord?.meta.builtin);
  const isPending = claimSource === "request";
  const isGranted = claimSource != null && claimSource !== "request" && !entitlementExpired;

  let status;
  if (entitlementExpired) {
    status = "request";
  } else if (!installedRecord) {
    status = isPending ? "pending" : (!isGranted && access === "paid" && !hasAccess ? "request" : "install");
  } else if (entry && installedRecord.meta.version !== entry.version) {
    status = "update";
  } else if (isActive) {
    status = "active";
  } else {
    status = "open";
  }

  const canOpen = !entitlementExpired && (status === "active" || status === "open" || status === "update");
  const isDone = status === "active" || status === "open";

  async function handleAction() {
    setLoading(true);
    setError("");
    setProgress(0);
    try {
      await onInstall(entry, { force: status === "update", onProgress: setProgress });
    } catch (err) {
      setError(getImportErrorMessage(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  // Installing a topic the user has never had before means a real download
  // (a few MB to tens of MB) landing on their device without warning —
  // confirm first. An update to something already installed isn't "a new
  // deck" in the same sense, so it keeps the previous one-tap behavior.
  function requestAction() {
    if (entitlementExpired && onLockedTap) onLockedTap(entry);
    else if (status === "install") setConfirmingInstall(true);
    else handleAction();
  }

  function handleTileClick() {
    if (canOpen) onSelect(installedRecord);
    else if (status !== "pending") requestAction();
  }

  // Deliberately NOT the same branch as handleTileClick: for "update", the
  // tile itself still opens the (already-installed, still-usable) topic --
  // only the badge specifically triggers the re-download.
  function handleBadgeClick(e) {
    e.stopPropagation();
    if (status === "active" || status === "open") onSelect(installedRecord);
    else if (status !== "pending") requestAction();
  }

  function confirmInstall() {
    setConfirmingInstall(false);
    handleAction();
  }

  const statusBadge = entry?.status ? STATUS_BADGES[entry.status] : null;
  const topicId = installedRecord?.meta.id ?? entry?.id;
  const avatarPath = installedRecord?.meta.avatar ?? getBuiltinTopicAvatarPath(topicId);
  const versionText = installedRecord
    ? (isBuiltin ? "встроенная" : `v${installedRecord.meta.version}`)
    : (entry ? `v${entry.version}` : "");

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
    : status === "request" ? "По подписке"
    : "Запрос отправлен";

  return (
    <>
    <article
      className={`topic-tile-row${canOpen ? " topic-tile-row--open" : ""}`}
      onClick={handleTileClick}
    >
      <div className="topic-tile-row__icon">
        <TopicCover topicId={topicId} avatarPath={avatarPath} title={title} size="small" />
      </div>
      <div className="topic-tile-row__text">
        <div className="topic-tile-row__title">{title}</div>
        <div className="topic-tile-row__eyebrow">
          <span>{versionText}</span>
          {statusBadge && !personalCaption && <span className={`topic-tile-row__tag topic-tile-row__tag--${entry.status}`}>{statusBadge.label}</span>}
          {personalCaption && <span className="topic-tile-row__tag topic-tile-row__tag--personal" title={personalCaption}>Личная</span>}
          {loading && <span className="topic-tile-row__loading">{progress != null ? `${Math.round(progress * 100)}%` : "Загружаем…"}</span>}
        </div>
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
        className={`topic-tile-row__badge topic-tile-row__badge--${isDone ? "done" : "get"} topic-tile-row__badge--${status}`}
        disabled={disabled || loading || status === "pending"}
        onClick={handleBadgeClick}
        aria-label={badgeLabel}
      >
        {badgeIcon}
      </button>
      {loading && (
        <div
          className={`topic-tile-row__progress${progress == null ? " topic-tile-row__progress--indeterminate" : ""}`}
          role="progressbar"
          aria-label="Загрузка темы"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress == null ? undefined : Math.round(progress * 100)}
        >
          <div className="topic-tile-row__progress-fill" style={progress == null ? undefined : { width: `${Math.max(progress, 0.03) * 100}%` }} />
        </div>
      )}
    </article>
    {error && <div className="topic-tile-row__error" role="alert">{error}</div>}
    {confirmingInstall && (
      <Modal
        title="Установить тему?"
        onClose={() => setConfirmingInstall(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmingInstall(false)}>Отмена</Button>
            <Button variant="primary" onClick={confirmInstall}>Установить</Button>
          </>
        }
      >
        <p>«{title}»{versionText ? ` ${versionText}` : ""} — тема будет скачана и сохранена на устройство.</p>
      </Modal>
    )}
    </>
  );
}
