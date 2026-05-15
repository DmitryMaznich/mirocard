import { getDb } from "@/core/db";
import { importTopic, TopicImportError } from "@/topics/topicLoader";
import { clearRendererCache } from "@/topics/rendererLoader";

export const CATALOG_URL = "./decks/catalog.json";

export function buildServerUrl(resourceUrl, force = false) {
  const url = new URL(resourceUrl, window.location.href);
  if (force) {
    url.searchParams.set("_refresh", `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  }
  return url.href;
}

export async function fetchCatalog(force = false) {
  const res = await fetch(buildServerUrl(CATALOG_URL, force), {
    cache: force ? "reload" : "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchCatalogTopic(entry, appVersion, force = false) {
  const res = await fetch(buildServerUrl(entry.url, force), {
    cache: force ? "reload" : "default",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const db = await getDb();
  const record = await importTopic(db, buf, appVersion);
  clearRendererCache(record.meta.id);
  return record;
}

export function getImportErrorMessage(err) {
  if (err instanceof TopicImportError) return err.message;
  return `Ошибка загрузки: ${err?.message ?? err}`;
}

export async function refreshInstalledCatalogTopics({
  topicRecords,
  appVersion,
  force = true,
}) {
  const catalog = await fetchCatalog(force);
  const installedIds = new Set(topicRecords.map((record) => record.meta.id));
  const entries = (catalog.decks ?? []).filter((entry) => installedIds.has(entry.id));

  const nextRecords = [...topicRecords];
  const failed = [];
  const updated = [];

  for (const entry of entries) {
    try {
      const record = await fetchCatalogTopic(entry, appVersion, force);
      const index = nextRecords.findIndex((item) => item.meta.id === record.meta.id);
      if (index >= 0) nextRecords[index] = record;
      else nextRecords.push(record);
      updated.push({ entry, record });
    } catch (err) {
      failed.push({ entry, error: getImportErrorMessage(err) });
    }
  }

  return {
    catalog,
    nextRecords,
    updated,
    failed,
    skipped: topicRecords.length - entries.length,
  };
}
