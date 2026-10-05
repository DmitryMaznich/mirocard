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

// A notebook owns its pages: deleting it deletes them too (except one that another notebook also lists).
export function removeSet(library, setId) {
  const set = library.sets.find((s) => s.id === setId);
  const others = new Set(library.sets.filter((s) => s.id !== setId).flatMap((s) => s.pageIds));
  const owned = (set?.pageIds ?? []).filter((id) => !others.has(id));
  const stamps = Object.fromEntries(owned.map((id) => [docKey("page", id), Date.now()]));
  return {
    ...library,
    pages: library.pages.filter((p) => !owned.includes(p.id)),
    sets: library.sets.filter((s) => s.id !== setId),
    deleted: { ...tomb(library, "set", setId), ...stamps },
  };
}

// Change the paper of a whole notebook: `patch` (notebook-wide keys, see LAYOUT_KEYS) goes onto every page and the set.
export function applyLayout(library, setId, patch) {
  const set = library.sets.find((s) => s.id === setId);
  if (!set || !Object.keys(patch).length) return library;
  const now = Date.now();
  const ids = new Set(set.pageIds);
  return {
    ...library,
    pages: library.pages.map((p) => (ids.has(p.id) ? { ...p, ...patch, updatedAt: now } : p)),
    sets: library.sets.map((s) => (s.id === setId ? { ...s, ...(patch.ruling ? { ruling: patch.ruling } : {}), updatedAt: now } : s)),
  };
}

// There is no page outside a notebook: a page that no notebook lists becomes a notebook of one page. The id is made from the
// page's, and the stamps are the page's own, so devices that migrate the same page build the same notebook (last write wins,
// no duplicates).
export function migrateToNotebooks(library) {
  const listed = new Set(library.sets.flatMap((s) => s.pageIds));
  const loose = library.pages.filter((p) => !listed.has(p.id));
  if (!loose.length) return library;
  const made = loose.map((p) => ({ id: `st_${p.id}`, title: p.title || "Тетрадь", ruling: p.ruling ?? "narrow", pageIds: [p.id], createdAt: p.createdAt ?? p.updatedAt ?? 0, updatedAt: p.updatedAt ?? p.createdAt ?? 0 }));
  const have = new Set(library.sets.map((s) => s.id));
  return { ...library, sets: [...library.sets, ...made.filter((s) => !have.has(s.id) && !library.deleted?.[docKey("set", s.id)])] };
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
