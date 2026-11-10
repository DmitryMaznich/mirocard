import { useState } from "react";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation";
import { CATEGORY_ORDER, CATEGORY_LABEL_KEYS } from "./topicCategories";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import TopicImport from "./TopicImport";

// embedded — «Мои темы» on Home: installed topics in a stable alphabetical
// grid (the latest one is marked, not moved — a topic keeps its place), and
// «Добавить тему» as the last tile: a rare action, so not at the top.
// catalog — «Добавить тему»: only what is not added yet; the added ones are
// one tap away under the list. A search looks through everything.
export default function TopicLibraryPreview({ embedded, items, renderItem, query, onQuery,
  filter, onFilter, loading, error, onRetry, onHome, onCatalog }) {
  const { t, language } = useUiTranslation();
  const [showInstalled, setShowInstalled] = useState(false);
  // A topic added on this visit stays in its row (now with «Открыть»), so its
  // sheet does not vanish mid-download and the list does not jump.
  const [offered, setOffered] = useState(() => new Set());
  const unseen = items.filter((item) => !item.installedRecord && !offered.has(item.id));
  if (unseen.length) setOffered(new Set([...offered, ...unseen.map((item) => item.id)]));
  const isNew = (item) => !item.installedRecord || offered.has(item.id);
  const byTitle = (a, b) => a.title.localeCompare(b.title, language);
  const installed = items.filter((item) => item.installedRecord).sort(byTitle);

  if (embedded) {
    return <>
      <div className="topic-ui-section-title"><h2>{t("preview.myTopics")}</h2><span>{installed.length}</span></div>
      <div className="topic-ui-installed-grid">
        {installed.map(renderItem)}
        <button className="topic-ui-add-tile" onClick={onCatalog}>
          <span aria-hidden="true">+</span>{t("preview.addTopic")}
        </button>
      </div>
      {installed.length === 0 && <div className="topic-ui-empty"><h2>{t("preview.emptyTitle")}</h2><p>{t("preview.emptyHelp")}</p></div>}
    </>;
  }

  const searching = query.trim() !== "";
  const needle = query.trim().toLocaleLowerCase(language);
  const inFilter = items.filter((item) => (filter === "all" || item.category === filter)
    && (!searching || item.title.toLocaleLowerCase(language).includes(needle)));
  const notInstalled = inFilter.filter(isNew)
    .sort((a, b) => Number(Boolean(a.entry?.comingSoon)) - Number(Boolean(b.entry?.comingSoon)) || byTitle(a, b));
  const installedInFilter = inFilter.filter((item) => !isNew(item)).sort(byTitle);
  const listed = searching || showInstalled ? [...notInstalled, ...installedInFilter] : notInstalled;

  return <>
    <div className="screen-header topic-ui-screen-header">
      <button className="back-btn" aria-label={t("preview.backTopics")} onClick={onHome}><BackArrowIcon /></button>
      <h1 className="screen-title">{t("preview.addTopic")}</h1>
    </div>
    <div className="topic-ui-catalog-body">
    <label className="topic-ui-search">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="6.5" /><path d="m15 15 6 6" /></svg>
      <input type="search" aria-label={t("preview.search")} placeholder={t("preview.search")}
        value={query} onChange={(event) => onQuery(event.target.value)} />
    </label>
    <nav className="topic-ui-filters" aria-label={t("topics.title")}>
      {["all", ...CATEGORY_ORDER].map((category) => <button key={category} aria-pressed={filter === category}
        onClick={() => onFilter(category)}>{category === "all" ? t("topics.all") : t(CATEGORY_LABEL_KEYS[category])}</button>)}
    </nav>
    <div className="topic-ui-catalog-list">{listed.map(renderItem)}</div>
    {!searching && !loading && !error && notInstalled.length === 0 && !showInstalled && <p className="topic-ui-empty">{t("preview.nothingNew")}</p>}
    {searching && !listed.length && !loading && !error && <p className="topic-ui-empty">{t("topics.noResults")}</p>}
    {!searching && installedInFilter.length > 0 && <button className="topic-ui-show-installed" onClick={() => setShowInstalled((value) => !value)}>
      {showInstalled ? t("preview.hideInstalled") : t("preview.showInstalled", { count: installedInFilter.length })}
    </button>}
    {loading && <p role="status">{t("topics.loading")}</p>}
    {error && <div className="topic-ui-catalog-error" role="status"><p>{t("topics.loadError")}</p><button onClick={onRetry}>{t("common.retry")}</button></div>}
    <TopicImport compact />
    </div>
  </>;
}
