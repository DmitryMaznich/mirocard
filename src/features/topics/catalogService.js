import { getDb } from "@/core/db";
import { importTopic, TopicImportError } from "@/topics/topicLoader";
import { clearRendererCache } from "@/topics/rendererLoader";
import { api, getApiToken } from "@/core/api";

export function getImportErrorMessage(err) {
  if (err instanceof TopicImportError) return err.message;
  return `Ошибка загрузки: ${err?.message ?? err}`;
}

export async function fetchCatalog() {
  try {
    return await api.get("/decks/catalog");
  } catch {
    // Fallback: fetch the static catalog.json (works without auth for free/local installs)
    const res = await fetch("/decks/catalog.json");
    if (!res.ok) throw new Error("Не удалось загрузить каталог");
    return res.json();
  }
}

export async function claimDeck(topicId) {
  return api.post(`/decks/${topicId}/claim`, {});
}

export async function fetchCatalogTopic(entry, appVersion) {
  const access = entry.access ?? "free";
  const token = getApiToken();

  let res;
  if (access === "free" && entry.url) {
    // Free decks: download directly from static URL — no auth needed, fast, no API dependency
    const directUrl = entry.url.replace(/^\.\//, "/");
    res = await fetch(directUrl);
    // Fallback to API if static fails (e.g., deck not in dist)
    if (!res.ok && token) {
      res = await fetch(`/api/decks/${entry.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } else {
    // Paid/restricted decks: must go through API (auth + access check)
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    res = await fetch(`/api/decks/${entry.id}/download`, { headers });
    // Fallback to static if API fails
    if (!res.ok && entry.url) {
      const directUrl = entry.url.replace(/^\.\//, "/");
      res = await fetch(directUrl);
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    try { message = (await res.json()).error || message; } catch (e) { void e; }
    throw new Error(message);
  }

  const buf = await res.arrayBuffer();
  const db = await getDb();
  const record = await importTopic(db, buf, appVersion);
  clearRendererCache(record.meta.id);
  return record;
}

export async function silentUpdateOutdatedTopics({ topicRecords, appVersion }) {
  try {
    const catalog = await fetchCatalog();
    const installedById = Object.fromEntries(topicRecords.map((r) => [r.meta.id, r]));
    const outdated = (catalog.decks ?? []).filter((entry) => {
      const installed = installedById[entry.id];
      return installed && installed.meta.version !== entry.version;
    });
    if (!outdated.length) return { nextRecords: topicRecords, updated: [] };

    const nextRecords = [...topicRecords];
    const updated = [];
    for (const entry of outdated) {
      try {
        const record = await fetchCatalogTopic(entry, appVersion);
        const idx = nextRecords.findIndex((r) => r.meta.id === record.meta.id);
        if (idx >= 0) nextRecords[idx] = record;
        updated.push(record);
      } catch (e) { void e; }
    }
    return { nextRecords, updated };
  } catch {
    return { nextRecords: topicRecords, updated: [] };
  }
}

export async function refreshInstalledCatalogTopics({ topicRecords, appVersion }) {
  const catalog = await fetchCatalog();
  const installedIds = new Set(topicRecords.map((record) => record.meta.id));
  const entries = (catalog.decks ?? []).filter((entry) => installedIds.has(entry.id));

  const nextRecords = [...topicRecords];
  const failed = [];
  const updated = [];

  for (const entry of entries) {
    try {
      const record = await fetchCatalogTopic(entry, appVersion);
      const index = nextRecords.findIndex((item) => item.meta.id === record.meta.id);
      if (index >= 0) nextRecords[index] = record;
      else nextRecords.push(record);
      updated.push({ entry, record });
    } catch (err) {
      failed.push({ entry, error: getImportErrorMessage(err) });
    }
  }

  return { catalog, nextRecords, updated, failed, skipped: topicRecords.length - entries.length };
}
