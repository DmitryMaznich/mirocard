// «Прописи 2» library: the adult's pages and page sets, stored on this device (IndexedDB keyval,
// own key, nothing added to the app's shared tables). Account sync is a later step.
import { getDb, kv } from "@/core/db";

export const LIBRARY_KEY = "propis2:library";

export function emptyLibrary() {
  return { version: 1, pages: [], sets: [] };
}

export function normalizeLibrary(raw) {
  const lib = raw && typeof raw === "object" ? raw : {};
  return {
    version: 1,
    pages: Array.isArray(lib.pages) ? lib.pages.filter((p) => p && p.id && Array.isArray(p.rows)) : [],
    sets: Array.isArray(lib.sets) ? lib.sets : [],
  };
}

export async function loadLibrary(db) {
  const database = db ?? (await getDb());
  return normalizeLibrary(await kv.get(database, LIBRARY_KEY));
}

export async function saveLibrary(library, db) {
  const database = db ?? (await getDb());
  await kv.set(database, LIBRARY_KEY, normalizeLibrary(library));
}

// Pure helpers over a library value (the UI keeps the value in state and persists it).
export function upsertPage(library, page) {
  const stamped = { ...page, updatedAt: Date.now() };
  const exists = library.pages.some((p) => p.id === page.id);
  return { ...library, pages: exists ? library.pages.map((p) => (p.id === page.id ? stamped : p)) : [stamped, ...library.pages] };
}

export function removePage(library, pageId) {
  return { ...library, pages: library.pages.filter((p) => p.id !== pageId) };
}
