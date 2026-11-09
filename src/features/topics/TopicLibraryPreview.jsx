import { useState } from "react";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation";
import { CATEGORY_ORDER, CATEGORY_LABEL_KEYS } from "./topicCategories";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import TopicImport from "./TopicImport";

export default function TopicLibraryPreview({ embedded, items, renderItem, query, onQuery,
  filter, onFilter, recentTopicId, loading, error, onRetry, onHome, onCatalog }) {
  const { t, language } = useUiTranslation();
  const [onlyNew, setOnlyNew] = useState(false);
  const installed = items.filter((item) => item.installedRecord)
    .sort((a, b) => Number(b.id === recentTopicId) - Number(a.id === recentTopicId)
      || a.title.localeCompare(b.title, language));
  const matches = items.filter((item) => (filter === "all" || item.category === filter)
    && (!onlyNew || !item.installedRecord)
    && item.title.toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)))
    .sort((a, b) => Number(Boolean(a.entry?.comingSoon)) - Number(Boolean(b.entry?.comingSoon))
      || a.title.localeCompare(b.title, language));

  return <>
    {embedded ? <>
      <div className="topic-ui-home-heading">
        <h1>{t("preview.homeTitle")}</h1>
        <button className="topic-ui-load-new" onClick={onCatalog}>
          <span aria-hidden="true">＋</span>{t("preview.loadNew")}
        </button>
      </div>
      <div className="topic-ui-section-title"><h2>{t("preview.installed")}</h2><span>{installed.length}</span></div>
    </> : <>
      <header className="topic-ui-catalog-header">
        <button className="back-btn" aria-label={t("preview.backTopics")} onClick={onHome}><BackArrowIcon /></button>
        <h1>{t("preview.catalogTitle")}</h1>
      </header>
      <label className="topic-ui-search">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="6.5" /><path d="m15 15 6 6" /></svg>
        <input type="search" aria-label={t("preview.search")} placeholder={t("preview.search")}
          value={query} onChange={(event) => onQuery(event.target.value)} />
      </label>
      <nav className="topic-ui-filters" aria-label={t("topics.title")}>
        {["all", ...CATEGORY_ORDER].map((category) => <button key={category} aria-pressed={filter === category}
          onClick={() => onFilter(category)}>{category === "all" ? t("topics.all") : t(CATEGORY_LABEL_KEYS[category])}</button>)}
      </nav>
      <label className="topic-ui-only-new"><input type="checkbox" checked={onlyNew}
        onChange={(event) => setOnlyNew(event.target.checked)} />{t("preview.onlyNew")}</label>
    </>}
    <div className={embedded ? "topic-ui-installed-grid" : "topic-ui-catalog-grid"}>
      {(embedded ? installed : matches).map(renderItem)}
    </div>
    {embedded && installed.length === 0 && <div className="topic-ui-empty"><h2>{t("preview.emptyTitle")}</h2><p>{t("preview.emptyHelp")}</p></div>}
    {!embedded && !matches.length && !loading && !error && <p className="topic-ui-empty">{t("topics.noResults")}</p>}
    {loading && <p role="status">{t("topics.loading")}</p>}
    {error && <div className="topic-ui-catalog-error" role="status"><p>{t("topics.loadError")}</p><button onClick={onRetry}>{t("common.retry")}</button></div>}
    {!embedded && <TopicImport compact />}
  </>;
}
