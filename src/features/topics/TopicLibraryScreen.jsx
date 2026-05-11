import { useCallback, useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { importTopic, deleteTopicRecord, TopicImportError } from "@/topics/topicLoader";
import { clearRendererCache } from "@/topics/rendererLoader";
import { getBuiltinTopicAvatarPath } from "@/topics/builtinAssets";
import TopicCover from "@/shared/components/TopicCover";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import TopicImport from "./TopicImport";
import InfoModal from "@/shared/components/InfoModal";
import { getTopicCatalogStatus, getTopicTitle } from "@/shared/utils/format";

const CATALOG_URL = "./decks/catalog.json";

function buildServerUrl(resourceUrl, force = false) {
  const url = new URL(resourceUrl, window.location.href);
  if (force) {
    url.searchParams.set("_refresh", `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  }
  return url.href;
}

async function fetchCatalog(force = false) {
  const res = await fetch(buildServerUrl(CATALOG_URL, force), {
    cache: force ? "reload" : "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchCatalogTopic(entry, appVersion, force = false) {
  const res = await fetch(buildServerUrl(entry.url, force), {
    cache: force ? "reload" : "default",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const db = await getDb();
  return importTopic(db, buf, appVersion);
}

function getImportErrorMessage(err) {
  if (err instanceof TopicImportError) return err.message;
  return `Ошибка загрузки: ${err?.message ?? err}`;
}

function InstalledTopicItem({ record, isActive, onSelect, onDelete, onInfo, hasUpdate }) {
  return (
    <li className={`topic-item ${isActive ? "topic-item--active" : ""}`} onClick={() => onSelect(record)}>
      <TopicCover
        topicId={record.meta.id}
        avatarPath={record.meta.avatar}
        title={record.meta.title}
        size="medium"
      />
      <div className="topic-item__info">
        <div className="topic-item__title">{getTopicTitle(record.meta.title)}</div>
        <div className="topic-item__meta">
          v{record.meta.version} · {record.meta.conceptCount ?? record.cards.length} понятий
          {hasUpdate && <span className="tab-badge" style={{ marginLeft: 6 }}>обновление</span>}
        </div>
      </div>
      <button className="icon-btn icon-btn--info" onClick={(e) => { e.stopPropagation(); onInfo(record); }} title="О теме">i</button>
      <button className="icon-btn icon-btn--danger" onClick={(e) => { e.stopPropagation(); onDelete(record); }}>✕</button>
    </li>
  );
}

function CatalogTopicItem({ entry, topicRecords, onInstall, disabled = false }) {
  const status = getTopicCatalogStatus(entry, topicRecords);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const installedRecord = topicRecords.find((record) => record.meta.id === entry.id);
  const avatarPath = installedRecord?.meta.avatar ?? getBuiltinTopicAvatarPath(entry.id);

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

  const actionLabel = {
    not_installed:    loading ? "Загружаем…" : "Скачать",
    update_available: loading ? "Обновляем…" : `Обновить до v${entry.version}`,
    installed:        loading ? "Обновляем…" : "Обновить с сервера",
  }[status];

  return (
    <li className="topic-item">
      <TopicCover
        topicId={entry.id}
        avatarPath={avatarPath}
        title={entry.title}
        size="medium"
      />
      <div className="topic-item__info">
        <div className="topic-item__title">{entry.title?.ru ?? entry.id}</div>
        <div className="topic-item__meta">
          v{entry.version}
          {status === "installed" && " · установлена"}
          {status === "update_available" && installedRecord?.meta?.version && ` · сейчас v${installedRecord.meta.version}`}
        </div>
        {entry.description?.ru && (
          <div className="topic-item__desc">{entry.description.ru}</div>
        )}
        {error && <div className="form-error">{error}</div>}
      </div>
      <Button
        variant={status === "installed" ? "secondary" : "primary"}
        disabled={disabled || loading}
        onClick={handleDownload}
      >
        {actionLabel}
      </Button>
    </li>
  );
}

export default function TopicLibraryScreen() {
  const setScreen          = useAppStore((s) => s.setScreen);
  const topicRecords       = useAppStore((s) => s.topicRecords);
  const setTopicRecords    = useAppStore((s) => s.setTopicRecords);
  const buildInfo          = useAppStore((s) => s.buildInfo);
  const activeTopicId      = useAppStore((s) => s.activeTopicId);
  const setActiveTopicId   = useAppStore((s) => s.setActiveTopicId);

  const [tab,        setTab]        = useState("mine");
  const [catalog,    setCatalog]    = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogErr, setCatalogErr] = useState("");
  const [catalogMessage, setCatalogMessage] = useState("");
  const [refreshingDecks, setRefreshingDecks] = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [infoTopic,  setInfoTopic]  = useState(null);

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
      .then((nextCatalog) => {
        if (!cancelled) setCatalog(nextCatalog);
      })
      .catch(() => {
        if (!cancelled) setCatalogErr("Не удалось загрузить каталог");
      });
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  const installCatalogEntry = useCallback(async (entry, { force = false } = {}) => {
    const record = await fetchCatalogTopic(entry, buildInfo.version, force);
    clearRendererCache(record.meta.id);
    setTopicRecords([
      ...topicRecords.filter((r) => r.meta.id !== record.meta.id),
      record,
    ]);
    return record;
  }, [buildInfo.version, setTopicRecords, topicRecords]);

  async function handleRefreshInstalledDecks() {
    setRefreshingDecks(true);
    setCatalogErr("");
    setCatalogMessage("");
    try {
      const freshCatalog = await fetchCatalog(true);
      setCatalog(freshCatalog);
      const installedIds = new Set(topicRecords.map((record) => record.meta.id));
      const entries = (freshCatalog.decks ?? []).filter((entry) => installedIds.has(entry.id));

      if (entries.length === 0) {
        setCatalogMessage("Нет установленных тем для обновления");
        return;
      }

      const nextRecords = [...topicRecords];
      const failed = [];
      const updated = [];

      for (const entry of entries) {
        try {
          const record = await fetchCatalogTopic(entry, buildInfo.version, true);
          const index = nextRecords.findIndex((item) => item.meta.id === record.meta.id);
          if (index >= 0) nextRecords[index] = record;
          else nextRecords.push(record);
          updated.push(`${entry.title?.ru ?? entry.id} v${record.meta.version}`);
        } catch (err) {
          failed.push(`${entry.title?.ru ?? entry.id}: ${getImportErrorMessage(err)}`);
        }
      }

      if (updated.length > 0) {
        setTopicRecords(nextRecords);
        setCatalogMessage(`Обновлено: ${updated.join(", ")}`);
      }
      if (failed.length > 0) {
        setCatalogErr(`Не обновлено: ${failed.join("; ")}`);
      }
    } catch {
      setCatalogErr("Не удалось обновить колоды с сервера");
    } finally {
      setRefreshingDecks(false);
    }
  }

  async function handleDelete() {
    const db = await getDb();
    await deleteTopicRecord(db, deleting.meta.id);
    setTopicRecords(topicRecords.filter((r) => r.meta.id !== deleting.meta.id));
    setDeleting(null);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">Темы</h1>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "mine" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("mine")}
        >
          Мои темы ({topicRecords.length})
        </button>
        <button
          className={`tab-btn ${tab === "catalog" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("catalog")}
        >
          Каталог
          {catalog && (() => {
            const n = topicRecords.filter((r) => {
              const e = catalog.decks?.find((d) => d.id === r.meta.id);
              return e && e.version !== r.meta.version;
            }).length;
            return n > 0 ? <span className="tab-badge" style={{ marginLeft: 6 }}>{n}</span> : null;
          })()}
        </button>
      </div>

      {tab === "mine" && (
        <div className="tab-content">
          <TopicImport />
          {topicRecords.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__text">Нет установленных тем</div>
              <Button variant="secondary" onClick={() => setTab("catalog")}>
                Перейти в каталог
              </Button>
            </div>
          ) : (
            <ul className="topic-list">
              {topicRecords.map((record) => {
                const catalogEntry = catalog?.decks?.find((e) => e.id === record.meta.id);
                const hasUpdate = !!catalogEntry && catalogEntry.version !== record.meta.version;
                return (
                  <InstalledTopicItem
                    key={record.meta.id}
                    record={record}
                    isActive={record.meta.id === activeTopicId}
                    onSelect={(r) => { setActiveTopicId(r.meta.id); setScreen("home"); }}
                    onDelete={setDeleting}
                    onInfo={setInfoTopic}
                    hasUpdate={hasUpdate}
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "catalog" && (
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
          {catalogErr && <div className="form-error" style={{ margin: 16 }}>{catalogErr}</div>}
          {!catalog && !catalogErr && (
            <div className="empty-state">
              <div className="empty-state__text">Загружаем каталог…</div>
            </div>
          )}
          {catalog && (
            <ul className="topic-list">
              {catalog.decks.map((entry) => (
                <CatalogTopicItem
                  key={entry.id}
                  entry={entry}
                  topicRecords={topicRecords}
                  onInstall={installCatalogEntry}
                  disabled={refreshingDecks}
                />
              ))}
            </ul>
          )}
        </div>
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
    </div>
  );
}
