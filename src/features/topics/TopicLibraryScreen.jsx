import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { importTopic, deleteTopicRecord, TopicImportError } from "@/topics/topicLoader";
import TopicCover from "@/shared/components/TopicCover";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import TopicImport from "./TopicImport";
import { getTopicCatalogStatus, getTopicTitle } from "@/shared/utils/format";

function InstalledTopicItem({ record, isActive, onSelect, onDelete }) {
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
        </div>
      </div>
      <button className="icon-btn icon-btn--danger" onClick={(e) => { e.stopPropagation(); onDelete(record); }}>✕</button>
    </li>
  );
}

function CatalogTopicItem({ entry, topicRecords, buildInfo }) {
  const status = getTopicCatalogStatus(entry, topicRecords);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const setTopicRecords = useAppStore((s) => s.setTopicRecords);

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      const url = new URL(entry.url, window.location.href).href;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const db = await getDb();
      const record = await importTopic(db, buf, buildInfo.version);
      setTopicRecords([
        ...topicRecords.filter((r) => r.meta.id !== record.meta.id),
        record,
      ]);
    } catch (err) {
      setError(
        err instanceof TopicImportError ? err.message : "Ошибка загрузки"
      );
    } finally {
      setLoading(false);
    }
  }

  const actionLabel = {
    not_installed:    loading ? "Загружаем…" : "Скачать",
    update_available: loading ? "Обновляем…" : `Обновить до v${entry.version}`,
    installed:        "Установлена",
  }[status];

  return (
    <li className="topic-item">
      <div className="topic-cover topic-cover--medium topic-cover--placeholder">
        {entry.title?.ru?.slice(0, 2) ?? "?"}
      </div>
      <div className="topic-item__info">
        <div className="topic-item__title">{entry.title?.ru ?? entry.id}</div>
        <div className="topic-item__meta">v{entry.version}</div>
        {entry.description?.ru && (
          <div className="topic-item__desc">{entry.description.ru}</div>
        )}
        {error && <div className="form-error">{error}</div>}
      </div>
      <Button
        variant={status === "installed" ? "secondary" : "primary"}
        disabled={status === "installed" || loading}
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
  const [catalogErr, setCatalogErr] = useState("");
  const [deleting,   setDeleting]   = useState(null);

  useEffect(() => {
    if (tab !== "catalog" || catalog !== null) return;
    fetch("./decks/catalog.json")
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => setCatalogErr("Не удалось загрузить каталог"));
  }, [tab]);

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
              {topicRecords.map((record) => (
                <InstalledTopicItem
                  key={record.meta.id}
                  record={record}
                  isActive={record.meta.id === activeTopicId}
                  onSelect={(r) => { setActiveTopicId(r.meta.id); setScreen("home"); }}
                  onDelete={setDeleting}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "catalog" && (
        <div className="tab-content">
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
                  buildInfo={buildInfo}
                />
              ))}
            </ul>
          )}
        </div>
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
