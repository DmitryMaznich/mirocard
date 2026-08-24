import { useCallback, useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { AnalyticsScreen } from "@/features/analytics/AnalyticsScreen";
import { getDb } from "@/core/db";
import { deleteTopicRecord } from "@/topics/topicLoader";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import TopicImport from "./TopicImport";
import InfoModal from "@/shared/components/InfoModal";
import TopicActionSheet from "./TopicActionSheet";
import TopicTile from "./TopicTile";
import ContinueStrip from "./ContinueStrip";
import { getTopicTitle } from "@/shared/utils/format";
import {
  fetchCatalog,
  fetchCatalogTopic,
  claimDeck,
  shouldClaimCatalogDeck,
  isLocalModeProfile,
} from "./catalogService";
import { CATEGORY_ORDER, OTHER_CATEGORY, getTopicCategory } from "./topicCategories";
import { getPersonalTopicCaption } from "./topicOrigin";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

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
  const token             = useAppStore((s) => s.token);

  const [catalog,           setCatalog]           = useState(null);
  const [catalogError,      setCatalogError]      = useState(false);
  const [filter,             setFilter]           = useState("mine");
  const [query,              setQuery]            = useState("");
  const [analyticsTarget,   setAnalyticsTarget]   = useState(null);
  const [deleting,          setDeleting]          = useState(null);
  const [infoTopic,         setInfoTopic]         = useState(null);
  const [actionSheetRecord, setActionSheetRecord] = useState(null);

  const loadCatalog = useCallback(() => {
    fetchCatalog()
      .then((c) => { setCatalog(c); setCatalogError(false); })
      .catch(() => setCatalogError(true));
  }, []);

  useEffect(() => {
    if (catalog === null) loadCatalog();
  }, [catalog, loadCatalog]);

  const installCatalogEntry = useCallback(async (entry, { force = false } = {}) => {
    const owned = (ownedTopics ?? []).find((o) => o.topicId === entry.id);
    const isGranted = owned != null && owned.source !== "request";
    if (!isGranted && shouldClaimCatalogDeck(entry, token)) {
      const result = await claimDeck(entry.id);
      upsertOwnedTopic({ topicId: entry.id, source: result.status === "granted" ? "free" : "request" });
      if (result.status !== "granted") return; // pending — don't download yet
    }
    const record = await fetchCatalogTopic(entry, buildInfo.version, force);
    upsertTopicRecord(record);
    return record;
  }, [buildInfo.version, token, upsertTopicRecord, upsertOwnedTopic, ownedTopics]);

  function handleSelectTopic(record) {
    setActiveTopicId(record.meta.id);
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
  const isLocalMode = isLocalModeProfile(account, token);
  const ownedById = Object.fromEntries((ownedTopics ?? []).map((o) => [o.topicId, o]));
  const ownedNonPendingIds = new Set(
    (ownedTopics ?? []).filter((o) => o.source !== "request").map((o) => o.topicId)
  );

  const visibleRecords = (account && !isLocalMode
    ? topicRecords.filter((r) => r.meta.builtin || ownedNonPendingIds.has(r.meta.id))
    : topicRecords
  ).filter((r) => !r.meta.hidden);

  const visibleDecks = catalog
    ? catalog.decks.filter((e) => !hasAdminGrants || ownedNonPendingIds.has(e.id))
    : [];

  const activeRecord = visibleRecords.find((r) => r.meta.id === activeTopicId);

  const itemsById = new Map();
  for (const entry of visibleDecks) {
    itemsById.set(entry.id, {
      id: entry.id,
      title: entry.title?.ru ?? entry.id,
      category: getTopicCategory(entry.id),
      entry,
      installedRecord: null,
    });
  }
  for (const record of visibleRecords) {
    const existing = itemsById.get(record.meta.id) ?? {
      id: record.meta.id,
      title: getTopicTitle(record.meta.title),
      category: getTopicCategory(record.meta.id),
      entry: null,
    };
    existing.installedRecord = record;
    itemsById.set(record.meta.id, existing);
  }
  const allItems = [...itemsById.values()];
  const installedCount = allItems.filter((item) => item.installedRecord != null).length;

  const trimmedQuery = query.trim().toLowerCase();
  const searchResults = trimmedQuery
    ? allItems.filter((item) => item.title.toLowerCase().includes(trimmedQuery))
    : null;

  // "Мои темы" is everything already on the device (builtin, downloaded,
  // imported, granted) — the other chips filter the full catalog instead.
  const filteredItems = filter === "mine"
    ? allItems.filter((item) => item.installedRecord != null)
    : filter === "all"
      ? allItems
      : allItems.filter((item) => item.category === filter);

  const sectionsToShow = [...CATEGORY_ORDER, OTHER_CATEGORY]
    .map((label) => ({ label, items: filteredItems.filter((item) => item.category === label) }))
    .filter((group) => group.items.length > 0);

  function renderItem(item) {
    const owned = ownedById[item.id] ?? null;
    const personalCaption = item.installedRecord
      ? getPersonalTopicCaption(item.installedRecord.meta, ownedTopics)
      : null;
    return (
      <TopicTile
        key={item.id}
        title={item.title}
        category={item.category}
        entry={item.entry}
        installedRecord={item.installedRecord}
        isActive={item.installedRecord?.meta.id === activeTopicId}
        access={item.entry?.access ?? "free"}
        claimSource={owned?.source ?? null}
        personalCaption={personalCaption}
        onInstall={installCatalogEntry}
        onSelect={handleSelectTopic}
        onMenu={setActionSheetRecord}
        onInfo={setInfoTopic}
      />
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Темы</h1>
      </div>

      <div className="topics-search">
        <input
          type="text"
          inputMode="search"
          placeholder="Найти тему…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="topics-screen-body">
        {!trimmedQuery && activeRecord && (
          <ContinueStrip record={activeRecord} onContinue={() => setScreen("home")} />
        )}

        {!trimmedQuery && (
          <nav className="topic-filter-chips">
            <button
              className={`topic-chip topic-chip--mine${filter === "mine" ? " is-active" : ""}`}
              onClick={() => setFilter("mine")}
            >
              Мои темы
              {installedCount > 0 && <span className="topic-chip__count">{installedCount}</span>}
            </button>
            <button
              className={`topic-chip${filter === "all" ? " is-active" : ""}`}
              onClick={() => setFilter("all")}
            >
              Всё
            </button>
            {CATEGORY_ORDER.map((label) => (
              <button
                key={label}
                className={`topic-chip${filter === label ? " is-active" : ""}`}
                onClick={() => setFilter(label)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        {trimmedQuery ? (
          <section className="topics-section">
            <div className="topics-section__head"><h2>Результаты поиска</h2></div>
            {searchResults.length > 0 ? (
              <div className="topics-grid">{searchResults.map(renderItem)}</div>
            ) : (
              <div className="empty-state"><div className="empty-state__text">Ничего не найдено</div></div>
            )}
          </section>
        ) : (
          <>
            {sectionsToShow.map((group) => (
              <section className="topics-section" key={group.label}>
                <div className="topics-section__head"><h2>{group.label}</h2></div>
                <div className="topics-grid">{group.items.map(renderItem)}</div>
              </section>
            ))}

            {!catalog && !catalogError && (
              <div className="empty-state"><div className="empty-state__text">Загружаем каталог…</div></div>
            )}
            {catalogError && (
              <div className="empty-state">
                <div className="empty-state__text">Не удалось загрузить каталог</div>
                <Button variant="secondary" onClick={loadCatalog}>Повторить</Button>
              </div>
            )}

            <TopicImport compact />
          </>
        )}
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
