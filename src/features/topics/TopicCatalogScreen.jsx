import { useCallback, useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getBuiltinTopicAvatarPath } from "@/topics/builtinAssets";
import TopicCover from "@/shared/components/TopicCover";
import Button from "@/shared/components/Button";
import { getTopicCatalogStatus } from "@/shared/utils/format";
import {
  fetchCatalog,
  fetchCatalogTopic,
  claimDeck,
  getImportErrorMessage,
  refreshInstalledCatalogTopics,
  shouldClaimCatalogDeck,
  isLocalModeProfile,
} from "./catalogService";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

const CATALOG_CATEGORIES = {
  letter_writing:           "Чтение",
  propis:                   "Чтение",
  reading_dad_poems:        "Чтение",
  reading_dad_instructions: "Чтение",
  sentence_puzzle:          "Чтение",
  phrase_match_pilot:       "Чтение",
  vowel_consonant_ru:       "Чтение",
  magnetic_alphabet:        "Чтение",
  comparison:               "Математика",
  math_houses:              "Математика",
  addition_subtraction:     "Математика",
  column_addition:          "Математика",
  emotions_v2:              "Словарный запас",
  clothes_basic:            "Словарный запас",
  verbs_v2:                 "Словарный запас",
  transport_photo:          "Словарный запас",
  opposites:                "Словарный запас",
  tools_functions:          "Словарный запас",
  first_then:               "Практика",
  shopping_list:            "Практика",
  coffee:                   "Практика",
  chat_with_mom:            "Практика",
  word_formation_soup:      "Словарный запас",
};
const CATEGORY_ORDER = ["Чтение", "Математика", "Словарный запас", "Практика"];

const STATUS_BADGES = {
  beta:         { label: "БЕТА",  className: "catalog-badge--beta" },
  experimental: { label: "ЭКСП.", className: "catalog-badge--experimental" },
};

function CatalogTopicItem({ entry, topicRecords, ownedTopic, onInstall, onClaim, claimRequired, disabled = false }) {
  const installStatus = getTopicCatalogStatus(entry, topicRecords);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const installedRecord = topicRecords.find((r) => r.meta.id === entry.id);
  const avatarPath      = installedRecord?.meta.avatar ?? getBuiltinTopicAvatarPath(entry.id);

  const access = entry.access ?? "free";
  const claimSource = ownedTopic?.source ?? null;
  const isPending = claimSource === "request";
  const isGranted = claimSource && claimSource !== "request";

  async function handleAction() {
    setLoading(true);
    setError("");
    try {
      if (!isGranted && claimRequired) {
        const result = await onClaim(entry.id);
        if (result.status === "pending") return; // UI will update via store
      }
      await onInstall(entry);
    } catch (err) {
      setError(getImportErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // Button config
  let chipVariant, chipLabel;
  if (isPending) {
    chipVariant = "pending";
    chipLabel   = "Запрос отправлен";
  } else if (!isGranted && access === "paid") {
    chipVariant = "request";
    chipLabel   = loading ? "…" : "Запросить доступ";
  } else if (installStatus === "not_installed") {
    chipVariant = "install";
    chipLabel   = loading ? "…" : "↓ Установить";
  } else if (installStatus === "update_available") {
    chipVariant = "update";
    chipLabel   = loading ? "…" : `↑ v${entry.version}`;
  } else {
    chipVariant = "sync";
    chipLabel   = loading ? "…" : "↺ Синхр.";
  }

  const badge = STATUS_BADGES[entry.status];

  return (
    <li className="topic-item">
      <TopicCover topicId={entry.id} avatarPath={avatarPath} title={entry.title} size="medium" />
      <div className="topic-item__info">
        <div className="topic-item__title">
          {entry.title?.ru ?? entry.id}
          {badge && <span className={`catalog-badge ${badge.className}`}>{badge.label}</span>}
        </div>
        <div className="topic-item__meta">
          v{entry.version}
          {installStatus === "installed"        && " · установлена"}
          {installStatus === "update_available" && installedRecord?.meta?.version && ` · сейчас v${installedRecord.meta.version}`}
        </div>
        {error && <div className="form-error">{error}</div>}
      </div>
      <button
        className={`topic-action-chip topic-action-chip--${chipVariant}`}
        disabled={disabled || loading || isPending}
        onClick={handleAction}
      >
        {chipLabel}
      </button>
    </li>
  );
}

export default function TopicCatalogScreen() {
  const setScreen         = useAppStore((s) => s.setScreen);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const setTopicRecords   = useAppStore((s) => s.setTopicRecords);
  const upsertTopicRecord = useAppStore((s) => s.upsertTopicRecord);
  const upsertOwnedTopic  = useAppStore((s) => s.upsertOwnedTopic);
  const ownedTopics       = useAppStore((s) => s.ownedTopics);
  const account           = useAppStore((s) => s.account);
  const token             = useAppStore((s) => s.token);
  const buildInfo         = useAppStore((s) => s.buildInfo);

  const [catalog,         setCatalog]         = useState(null);
  const [catalogLoading,  setCatalogLoading]  = useState(false);
  const [catalogErr,      setCatalogErr]      = useState("");
  const [catalogMessage,  setCatalogMessage]  = useState("");
  const [refreshingDecks, setRefreshingDecks] = useState(false);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogErr("");
    setCatalogMessage("");
    try {
      const nextCatalog = await fetchCatalog();
      setCatalog(nextCatalog);
      return nextCatalog;
    } catch {
      setCatalogErr("Не удалось загрузить каталог");
      return null;
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (catalog !== null) return;
    let cancelled = false;
    fetchCatalog()
      .then((c) => { if (!cancelled) setCatalog(c); })
      .catch(() => { if (!cancelled) setCatalogErr("Не удалось загрузить каталог"); });
    return () => { cancelled = true; };
  }, [catalog]);

  const handleClaim = useCallback(async (topicId) => {
    const result = await claimDeck(topicId);
    // Update ownedTopics in store so button reflects new status immediately
    upsertOwnedTopic({ topicId, source: result.status === "granted" ? "free" : "request" });
    return result;
  }, [upsertOwnedTopic]);

  const installCatalogEntry = useCallback(async (entry) => {
    const record = await fetchCatalogTopic(entry, buildInfo.version);
    upsertTopicRecord(record);
    return record;
  }, [buildInfo.version, upsertTopicRecord]);

  async function handleRefreshInstalledDecks() {
    setRefreshingDecks(true);
    setCatalogErr("");
    setCatalogMessage("");
    try {
      const result = await refreshInstalledCatalogTopics({
        topicRecords,
        appVersion: buildInfo.version,
      });
      setCatalog(result.catalog);
      if (result.updated.length === 0 && result.failed.length === 0) {
        setCatalogMessage("Нет установленных тем для обновления");
        return;
      }
      if (result.updated.length > 0) {
        setTopicRecords(result.nextRecords);
        const updated = result.updated.map(({ entry, record }) => `${entry.title?.ru ?? entry.id} v${record.meta.version}`);
        setCatalogMessage(`Обновлено: ${updated.join(", ")}`);
      }
      if (result.failed.length > 0) {
        const failed = result.failed.map(({ entry, error }) => `${entry.title?.ru ?? entry.id}: ${error}`);
        setCatalogErr(`Не обновлено: ${failed.join("; ")}`);
      }
    } catch {
      setCatalogErr("Не удалось обновить колоды с сервера");
    } finally {
      setRefreshingDecks(false);
    }
  }

  const ownedById = Object.fromEntries((ownedTopics ?? []).map((o) => [o.topicId, o]));
  const isLocalMode = isLocalModeProfile(account, token);

  // When admin has explicitly granted topics (source === "grant"), treat ownedTopics as
  // a whitelist: show all topics the user owns (any non-pending source). Without any admin
  // grants, show the full catalog (no restriction).
  const hasAdminGrants = !isLocalMode && account != null && (ownedTopics ?? []).some((o) => o.source === "grant");

  const visibleDecks = catalog
    ? catalog.decks.filter((e) => !hasAdminGrants || (ownedById[e.id] != null && ownedById[e.id].source !== "request"))
    : [];

  const grouped = catalog
    ? CATEGORY_ORDER
        .map((cat) => ({ label: cat, entries: visibleDecks.filter((e) => CATALOG_CATEGORIES[e.id] === cat) }))
        .filter((g) => g.entries.length > 0)
    : [];
  const uncategorized = catalog ? visibleDecks.filter((e) => !CATALOG_CATEGORIES[e.id]) : [];

  function renderEntry(entry) {
    return (
      <CatalogTopicItem
        key={entry.id}
        entry={entry}
        topicRecords={topicRecords}
        ownedTopic={ownedById[entry.id] ?? null}
        onInstall={installCatalogEntry}
        onClaim={handleClaim}
        claimRequired={shouldClaimCatalogDeck(entry, token)}
        disabled={refreshingDecks}
      />
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("topics")}><BackArrowIcon /></button>
        <h1 className="screen-title">Каталог тем</h1>
      </div>
      <div className="tab-content">
        <div className="catalog-actions">
          <Button
            variant="secondary"
            onClick={loadCatalog}
            disabled={catalogLoading || refreshingDecks}
          >
            {catalogLoading ? "Проверяем…" : "Обновить каталог"}
          </Button>
          <Button
            variant="primary"
            onClick={handleRefreshInstalledDecks}
            disabled={catalogLoading || refreshingDecks || topicRecords.length === 0}
          >
            {refreshingDecks ? "Обновляем…" : "Обновить колоды с сервера"}
          </Button>
        </div>
        {catalogMessage && <div className="form-success">{catalogMessage}</div>}
        {catalogErr     && <div className="form-error" style={{ margin: 16 }}>{catalogErr}</div>}
        {!catalog && !catalogErr && (
          <div className="empty-state"><div className="empty-state__text">Загружаем каталог…</div></div>
        )}
        {grouped.map((group) => (
          <div key={group.label} className="catalog-section">
            <div className="catalog-section-header">{group.label}</div>
            <ul className="topic-list">{group.entries.map(renderEntry)}</ul>
          </div>
        ))}
        {uncategorized.length > 0 && (
          <div className="catalog-section">
            <div className="catalog-section-header">Другое</div>
            <ul className="topic-list">{uncategorized.map(renderEntry)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
