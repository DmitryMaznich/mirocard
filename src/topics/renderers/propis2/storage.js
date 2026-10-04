// «Прописи 2» library: the adult's pages and page sets, stored on this device (IndexedDB keyval,
// own key, nothing added to the app's shared tables). Account sync is a later step.
import { getDb, kv } from "@/core/db";
import { docKey } from "./syncLib.js";

const tomb = (library, kind, id) => ({ ...(library.deleted ?? {}), [docKey(kind, id)]: Date.now() });

export const LIBRARY_KEY = "propis2:library";

export function emptyLibrary() {
  return { version: 1, pages: [], sets: [], presets: [], deleted: {} };
}

export function normalizeLibrary(raw) {
  const lib = raw && typeof raw === "object" ? raw : {};
  return {
    version: 1,
    pages: Array.isArray(lib.pages) ? lib.pages.filter((p) => p && p.id && Array.isArray(p.rows)) : [],
    sets: Array.isArray(lib.sets) ? lib.sets.filter((st) => st && st.id && Array.isArray(st.pageIds)) : [],
    deleted: lib.deleted && typeof lib.deleted === "object" ? lib.deleted : {},
    presets: Array.isArray(lib.presets) ? lib.presets.filter((ps) => ps && ps.id && Array.isArray(ps.rows)) : [],
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

// Deleting a page also drops it from every set that listed it.
export function removePage(library, pageId) {
  return {
    ...library,
    pages: library.pages.filter((p) => p.id !== pageId),
    sets: library.sets.map((st) => (st.pageIds.includes(pageId) ? { ...st, pageIds: st.pageIds.filter((id) => id !== pageId), updatedAt: Date.now() } : st)),
    deleted: tomb(library, "page", pageId),
  };
}

export function upsertSet(library, set) {
  const stamped = { ...set, updatedAt: Date.now() };
  const exists = library.sets.some((s) => s.id === set.id);
  return { ...library, sets: exists ? library.sets.map((s) => (s.id === set.id ? stamped : s)) : [stamped, ...library.sets] };
}

export function removeSet(library, setId) {
  return { ...library, sets: library.sets.filter((s) => s.id !== setId), deleted: tomb(library, "set", setId) };
}

export function upsertPreset(library, preset) {
  const stamped = { ...preset, updatedAt: Date.now() };
  const list = library.presets ?? [];
  const exists = list.some((p) => p.id === preset.id);
  return { ...library, presets: exists ? list.map((p) => (p.id === preset.id ? stamped : p)) : [stamped, ...list] };
}

export function removePreset(library, presetId) {
  return { ...library, presets: (library.presets ?? []).filter((p) => p.id !== presetId), deleted: tomb(library, "preset", presetId) };
}
