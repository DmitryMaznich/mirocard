import { getDb } from "@/core/db";
import { importTopic, TopicImportError } from "@/topics/topicLoader";
import { clearRendererCache } from "@/topics/rendererLoader";
import { api, getApiToken } from "@/core/api";

export function getImportErrorMessage(err) {
  if (err instanceof TopicImportError) return err.message;
  return `Ошибка загрузки: ${err?.message ?? err}`;
}

// A local therapist profile has an account-shaped display object but no API
// token. Free decks are deliberately
// published as static ZIPs, so asking the API to claim one first turns a
// perfectly valid local install into a misleading "Missing token" error.
export function shouldClaimCatalogDeck(entry) {
  return (entry.access ?? "free") !== "free";
}

export function isLocalModeProfile(account, token) {
  return account?.email === "local" && !token;
}

// Only a genuinely free catalog entry is downloaded directly from its
// static URL, with no claim call and no lock badge. Local mode is
// deliberately NOT special-cased here anymore: it has no backend account to
// authenticate a paid download with, which is exactly why a paid entry must
// stay locked in local mode rather than being waved through as free (see
// isLocalModeProfile below -- it now only affects the free/API-fallback
// choice for genuinely free entries, never whether a paid entry is treated
// as free).
export function isFreeStaticInstall(entry) {
  return (entry.access ?? "free") === "free" && Boolean(entry.url);
}

// The access-controlled endpoint is intentionally keyed only by topic id.
// Its ZIP therefore has to bypass HTTP caches whenever a catalog item changes.
export function getDeckDownloadUrl(topicId, refresh = Date.now()) {
  return `/api/decks/${encodeURIComponent(topicId)}/download?_refresh=${refresh}`;
}

export async function fetchCatalog() {
  // /api/decks/catalog works without auth too (see backend/server.mjs) --
  // it just strips the `url` field from every paid entry when the caller
  // isn't authenticated, so it's safe for logged-out / local-mode use.
  // There used to be a fallback here to the raw static /decks/catalog.json,
  // which the server no longer serves at all: that file lists every paid
  // deck's direct download URL with zero access control.
  return api.get("/decks/catalog");
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
    // A unique _refresh value bypasses both the service worker's cache-first
    // path and any stale HTTP entry left by an interrupted earlier download.
    // The worker saves the successful response back under the clean URL for
    // offline use afterwards.
    const separator = entry.url.includes("?") ? "&" : "?";
    const directUrl = `${entry.url.replace(/^\.\//, "/")}${separator}_refresh=${Date.now()}`;
    res = await fetch(directUrl, { cache: "no-store" });
    // Fallback to API if static fails (e.g., deck not in dist)
    if (!res.ok && token) {
      res = await fetch(getDeckDownloadUrl(entry.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } else {
    // Paid/restricted decks: must go through the authenticated,
    // entitlement-checked API and ONLY that -- there is no static-URL
    // fallback here on purpose. Falling back to entry.url on an API
    // failure (401/403 for an unentitled or unauthenticated caller
    // included) used to let anyone re-fetch the same paid ZIP straight
    // from public static hosting, defeating the paywall entirely.
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    res = await fetch(getDeckDownloadUrl(entry.id), { headers });
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
