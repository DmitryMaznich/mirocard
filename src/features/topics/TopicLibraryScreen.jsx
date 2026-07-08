import { useCallback, useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { AnalyticsScreen } from "@/features/analytics/AnalyticsScreen";
import { getDb } from "@/core/db";
import { deleteTopicRecord } from "@/topics/topicLoader";
import TopicCover from "@/shared/components/TopicCover";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import TopicImport from "./TopicImport";
import InfoModal from "@/shared/components/InfoModal";
import TopicHeroCard from "./TopicHeroCard";
import TopicActionSheet from "./TopicActionSheet";
import { getTopicTitle } from "@/shared/utils/format";
import {
  fetchCatalog,
  fetchCatalogTopic,
  claimDeck,
  getImportErrorMessage,
} from "./catalogService";
import { BackArrowIcon, ChevronRightIcon } from "@/shared/components/ArrowIcons";

function InstalledTopicItem({ record, onSelect, onMenu, onInfo }) {
  const isBuiltin = Boolean(record.meta.builtin);
  return (
    <li className="topic-item" onClick={() => onSelect(record)}>
      <TopicCover
        topicId={record.meta.id}
        avatarPath={record.meta.avatar}
        title={record.meta.title}
        size="medium"
      />
      <div className="topic-item__info">
        <div className="topic-item__title">{getTopicTitle(record.meta.title)}</div>
        <div className="topic-item__meta">
          {isBuiltin
            ? "встроенная"
            : `v${record.meta.version} · ${record.meta.conceptCount ?? record.cards.length} понятий`}
        </div>
      </div>
      {isBuiltin
        ? (
          <button
            className="icon-btn icon-btn--info"
            onClick={(e) => { e.stopPropagation(); onInfo(record); }}
            aria-label="О теме"
          >
            i
          </button>
        ) : (
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onMenu(record); }}
            aria-label="Действия"
          >
            ⋯
          </button>
        )}
    </li>
  );
}

function PreviewChip({ entry, onInstall, disabled, isUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const label = loading   ? "…"
    : isUpdate            ? `↑ v${entry.version}`
    : `↓ ${entry.title?.ru ?? entry.id}`;

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      await onInstall(entry, { force: isUpdate });
    } catch (err) {
      setError(getImportErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="catalog-preview__chip-wrap">
      <button
        className={`topic-action-chip topic-action-chip--${isUpdate ? "update" : "install"}`}
        disabled={disabled || loading}
        onClick={handleClick}
      >
        {label}
      </button>
      {error && <div className="form-error">{error}</div>}
    </span>
  );
}

function CatalogPreview({ catalog, topicRecords, hasAdminGrants, ownedNonPendingIds, onInstall, onOpenCatalog, disabled }) {
  if (!catalog) return null;

  const accessibleDecks = catalog.decks.filter((e) =>
    !hasAdminGrants || ownedNonPendingIds.has(e.id)
  );

  const updates = accessibleDecks.filter((e) => {
    const installed = topicRecords.find((r) => r.meta.id === e.id);
    return installed && installed.meta.version !== e.version;
  });
  const newTopics = accessibleDecks
    .filter((e) => !topicRecords.find((r) => r.meta.id === e.id))
    .slice(0, 3);

  return (
    <div className="catalog-preview-card">
      <button className="catalog-preview-card__header" onClick={onOpenCatalog}>
        <span className="catalog-preview-card__title">Каталог тем</span>
        <span className="catalog-preview-card__open-btn">Открыть <ChevronRightIcon size={13} /></span>
      </button>
      {(updates.length > 0 || newTopics.length > 0) && (
        <div className="catalog-preview-card__body">
          {updates.length > 0 && (
            <div className="catalog-preview-card__group">
              <span className="catalog-preview-card__label">Доступны обновления</span>
              <div className="catalog-preview__chips">
                {updates.map((entry) => (
                  <PreviewChip
                    key={entry.id}
                    entry={entry}
                    onInstall={onInstall}
                    disabled={disabled}
                    isUpdate
                  />
                ))}
              </div>
            </div>
          )}
          {newTopics.length > 0 && (
            <div className="catalog-preview-card__group">
              <span className="catalog-preview-card__label">Новые темы — нажмите для установки</span>
              <div className="catalog-preview__chips">
                {newTopics.map((entry) => (
                  <PreviewChip
                    key={entry.id}
                    entry={entry}
                    onInstall={onInstall}
                    disabled={disabled}
                    isUpdate={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TopicLibraryScreen() {
  const setScreen         = useAppStore((s) => s.setScreen);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const setTopicRecords   = useAppStore((s) => s.setTopicRecords);
  const upsertTopicRecord = useAppStore((s) => s.upsertTopicRecord);
  const upsertOwnedTopic  = useAppStore((s) => s.upsertOwnedTopic);
  const buildInfo         = useAppStore((s) => s.buildInfo);
  const activeTopicId     = useAppStore((s) => s.activeTopicId);
  const setActiveTopicId  = useAppStore((s) => s.setActiveTopicId);
  const activeStudentId   = useAppStore((s) => s.activeStudentId);
  const ownedTopics       = useAppStore((s) => s.ownedTopics);
  const account           = useAppStore((s) => s.account);


  const [catalog,           setCatalog]           = useState(null);
  const [analyticsTarget,   setAnalyticsTarget]   = useState(null);
  const [deleting,          setDeleting]          = useState(null);
  const [infoTopic,         setInfoTopic]         = useState(null);
  const [actionSheetRecord, setActionSheetRecord] = useState(null);

  const installCatalogEntry = useCallback(async (entry, { force = false } = {}) => {
    const owned = (ownedTopics ?? []).find((o) => o.topicId === entry.id);
    const isGranted = owned != null && owned.source !== "request";
    if (!isGranted) {
      const result = await claimDeck(entry.id);
      upsertOwnedTopic({ topicId: entry.id, source: result.status === "granted" ? "free" : "request" });
      if (result.status !== "granted") return; // pending — don't download yet
    }
    const record = await fetchCatalogTopic(entry, buildInfo.version, force);
    upsertTopicRecord(record);
    return record;
  }, [buildInfo.version, upsertTopicRecord, upsertOwnedTopic, ownedTopics]);

  useEffect(() => {
    if (catalog !== null) return;
    let cancelled = false;
    fetchCatalog(false)
      .then((c) => { if (!cancelled) setCatalog(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [catalog]);

  function handleSelectTopic(r) {
    setActiveTopicId(r.meta.id);
    setScreen("home");
  }

  async function handleDelete() {
    const db = await getDb();
    await deleteTopicRecord(db, deleting.meta.id);
    setTopicRecords(topicRecords.filter((r) => r.meta.id !== deleting.meta.id));
    setDeleting(null);
  }

  // Library always shows only what the current user owns — so topics from a previous
  // user logged in on the same device don't bleed through.
  // Builtin topics are always visible. Local mode (no account) shows everything.
  const hasAdminGrants = account != null && (ownedTopics ?? []).some((o) => o.source === "grant");
  const grantedIds = new Set(
    (ownedTopics ?? []).filter((o) => o.source === "grant").map((o) => o.topicId)
  );
  const ownedNonPendingIds = new Set(
    (ownedTopics ?? []).filter((o) => o.source !== "request").map((o) => o.topicId)
  );
  const visibleRecords = (account
    ? topicRecords.filter((r) => r.meta.builtin || ownedNonPendingIds.has(r.meta.id))
    : topicRecords
  ).filter((r) => !r.meta.hidden);

  const activeRecord = visibleRecords.find((r) => r.meta.id === activeTopicId);
  const otherRecords = visibleRecords.filter((r) => r.meta.id !== activeTopicId);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Темы</h1>
      </div>

      <div className="topics-screen-body">
        {/* Zone 1: Hero — active topic */}
        {activeRecord && (
          <TopicHeroCard
            record={activeRecord}
            onInfo={setInfoTopic}
            onSelect={() => setScreen("home")}
          />
        )}
        {!activeRecord && topicRecords.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__text">Нет установленных тем</div>
          </div>
        )}

        {/* Zone 2: All other topics */}
        {otherRecords.length > 0 && (
          <ul className="topic-list topics-zone-list">
            {otherRecords.map((record) => (
              <InstalledTopicItem
                key={record.meta.id}
                record={record}
                onSelect={handleSelectTopic}
                onMenu={setActionSheetRecord}
                onInfo={setInfoTopic}
              />
            ))}
          </ul>
        )}

        {/* Zone 3: Catalog preview */}
        <CatalogPreview
          catalog={catalog}
          topicRecords={visibleRecords}
          hasAdminGrants={hasAdminGrants}
          ownedNonPendingIds={ownedNonPendingIds}
          onInstall={installCatalogEntry}
          onOpenCatalog={() => setScreen("catalog")}
          disabled={false}
        />

        {/* Import ZIP — редко используется, внизу */}
        <TopicImport compact />
      </div>

      {/* Overlays */}
      {actionSheetRecord && (
        <TopicActionSheet
          record={actionSheetRecord}
          onClose={() => setActionSheetRecord(null)}
          onInfo={(r) => { setInfoTopic(r); }}
          onAnalytics={(r) => setAnalyticsTarget({
            studentId:  activeStudentId,
            topicId:    r.meta.id,
            topicTitle: getTopicTitle(r.meta.title),
          })}
          onDelete={(r) => setDeleting(r)}
        />
      )}

      {infoTopic && (
        <InfoModal
          title={getTopicTitle(infoTopic.meta.title)}
          about={infoTopic.meta.about}
          modes={infoTopic.modes}
          onClose={() => setInfoTopic(null)}
        />
      )}

      {deleting && (
        <Modal
          title="Удалить тему?"
          onClose={() => setDeleting(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>Отмена</Button>
              <Button variant="danger" onClick={handleDelete}>Удалить</Button>
            </>
          }
        >
          Удалить <strong>{getTopicTitle(deleting.meta.title)}</strong>? История сессий сохранится.
        </Modal>
      )}

      {analyticsTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#fff" }}>
          <AnalyticsScreen
            studentId={analyticsTarget.studentId}
            topicId={analyticsTarget.topicId}
            topicTitle={analyticsTarget.topicTitle}
            onClose={() => setAnalyticsTarget(null)}
          />
        </div>
      )}
    </div>
  );
}
