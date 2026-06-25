import { useCallback, useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getBuiltinTopicAvatarPath } from "@/topics/builtinAssets";
import TopicCover from "@/shared/components/TopicCover";
import Button from "@/shared/components/Button";
import { getTopicCatalogStatus } from "@/shared/utils/format";
import {
  fetchCatalog,
  fetchCatalogTopic,
  getImportErrorMessage,
  refreshInstalledCatalogTopics,
} from "./catalogService";

const CATALOG_CATEGORIES = {
  letter_writing:           "Чтение",
  reading_dad_poems:        "Чтение",
  reading_dad_instructions: "Чтение",
  reading_dad_texts:        "Чтение",
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
};
const CATEGORY_ORDER = ["Чтение", "Математика", "Словарный запас", "Практика"];

function CatalogTopicItem({ entry, topicRecords, onInstall, disabled = false }) {
  const status          = getTopicCatalogStatus(entry, topicRecords);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const installedRecord = topicRecords.find((r) => r.meta.id === entry.id);
  const avatarPath      = installedRecord?.meta.avatar ?? getBuiltinTopicAvatarPath(entry.id);

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      await onInstall(entry, { force: status !== "not_installed" });
    } catch (err) {
      setError(getImportErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const chipVariant = status === "not_installed"    ? "install"
    : status === "update_available"                 ? "update"
    : "sync";

  const chipLabel = loading                         ? "…"
    : status === "not_installed"                    ? "↓ Скачать"
    : status === "update_available"                 ? `↑ v${entry.version}`
    : "↺ Синхр.";

  return (
    <li className="topic-item">
      <TopicCover topicId={entry.id} avatarPath={avatarPath} title={entry.title} size="medium" />
      <div className="topic-item__info">
        <div className="topic-item__title">{entry.title?.ru ?? entry.id}</div>
        <div className="topic-item__meta">
          v{entry.version}
          {status === "installed"        && " · установлена"}
          {status === "update_available" && installedRecord?.meta?.version && ` · сейчас v${installedRecord.meta.version}`}
        </div>
        {error && <div className="form-error">{error}</div>}
      </div>
      <button
        className={`topic-action-chip topic-action-chip--${chipVariant}`}
        disabled={disabled || loading}
        onClick={handleDownload}
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
  const buildInfo         = useAppStore((s) => s.buildInfo);

  const [catalog,         setCatalog]         = useState(null);
  const [catalogLoading,  setCatalogLoading]  = useState(false);
  const [catalogErr,      setCatalogErr]      = useState("");
  const [catalogMessage,  setCatalogMessage]  = useState("");
  const [refreshingDecks, setRefreshingDecks] = useState(false);

  const loadCatalog = useCallback(async (force = false) => {
    setCatalogLoading(true);
    setCatalogErr("");
    setCatalogMessage("");
    try {
      const nextCatalog = await fetchCatalog(force);
      setCatalog(nextCatalog);
      if (force) setCatalogMessage("Каталог обновлён");
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
    fetchCatalog(false)
      .then((c) => { if (!cancelled) setCatalog(c); })
      .catch(() => { if (!cancelled) setCatalogErr("Не удалось загрузить каталог"); });
    return () => { cancelled = true; };
  }, [catalog]);

  const installCatalogEntry = useCallback(async (entry, { force = false } = {}) => {
    const record = await fetchCatalogTopic(entry, buildInfo.version, force);
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
        force: true,
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

  const grouped = catalog
    ? CATEGORY_ORDER
        .map((cat) => ({ label: cat, entries: catalog.decks.filter((e) => CATALOG_CATEGORIES[e.id] === cat) }))
        .filter((g) => g.entries.length > 0)
    : [];
  const uncategorized = catalog ? catalog.decks.filter((e) => !CATALOG_CATEGORIES[e.id]) : [];

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("topics")}>←</button>
        <h1 className="screen-title">Каталог тем</h1>
      </div>
      <div className="tab-content">
        <div className="catalog-actions">
          <Button
            variant="secondary"
            onClick={() => loadCatalog(true)}
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
            <ul className="topic-list">
              {group.entries.map((entry) => (
                <CatalogTopicItem
                  key={entry.id}
                  entry={entry}
                  topicRecords={topicRecords}
                  onInstall={installCatalogEntry}
                  disabled={refreshingDecks}
                />
              ))}
            </ul>
          </div>
        ))}
        {uncategorized.length > 0 && (
          <div className="catalog-section">
            <div className="catalog-section-header">Другое</div>
            <ul className="topic-list">
              {uncategorized.map((entry) => (
                <CatalogTopicItem
                  key={entry.id}
                  entry={entry}
                  topicRecords={topicRecords}
                  onInstall={installCatalogEntry}
                  disabled={refreshingDecks}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
