// «Прописи 2» library: the adult's pages and page sets, stored on this device (IndexedDB keyval,
// own key, nothing added to the app's shared tables). Account sync is a later step.
import { getDb, kv } from "@/core/db";
import { docKey } from "./syncLib.js";
import { pageFromPreset } from "./model.js";

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

// Change the paper of a whole notebook: `patch` (the format, or a page's paper put onto all pages, see LAYOUT_KEYS) goes onto every
// page and the set.
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

// Until 2026-10-08 the ruling of a notebook (`set.ruling`) overrode its pages' own when the notebook was shown; now every page has
// its own paper. A notebook from before (no `pagePaper`) gets its ruling written onto its pages once, so it looks as it did, and is
// marked. Deterministic (devices that migrate the same notebook get the same documents); a page shared with a marked notebook or
// already on that ruling is left alone. Returns the same object when there is nothing to do.
export function pagesTakeNotebookRuling(library) {
  const old = library.sets.filter((s) => !s.pagePaper);
  if (!old.length) return library;
  const want = new Map();
  for (const s of old) if (s.ruling) for (const id of s.pageIds) if (!want.has(id)) want.set(id, s.ruling);
  return {
    ...library,
    pages: library.pages.map((p) => (want.has(p.id) && p.ruling !== want.get(p.id) ? { ...p, ruling: want.get(p.id) } : p)),
    sets: library.sets.map((s) => (s.pagePaper ? s : { ...s, pagePaper: true })),
  };
}

// There is no page outside a notebook: a page that no notebook lists becomes a notebook of one page. The id is made from the
// page's, and the stamps are the page's own, so devices that migrate the same page build the same notebook (last write wins,
// no duplicates).
export function migrateToNotebooks(library) {
  const listed = new Set(library.sets.flatMap((s) => s.pageIds));
  const loose = library.pages.filter((p) => !listed.has(p.id));
  if (!loose.length) return library;
  const made = loose.map((p) => ({ id: `st_${p.id}`, title: p.title || "Тетрадь", ruling: p.ruling ?? "narrow", pagePaper: true, pageIds: [p.id], createdAt: p.createdAt ?? p.updatedAt ?? 0, updatedAt: p.updatedAt ?? p.createdAt ?? 0 }));
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

// The saved page templates («Мои» presets) are gone as a concept: each becomes a notebook of one page (the page gets an id made from
// the template's, so every device builds the same one; a deleted notebook is not built again). `migrateToNotebooks` wraps the page.
export function presetsToNotebooks(library) {
  const have = new Set(library.pages.map((p) => p.id));
  const fresh = (library.presets ?? [])
    .map((ps) => ({ ps, id: `pg_ps_${ps.id}` }))
    .filter(({ id }) => !have.has(id) && !library.deleted?.[docKey("page", id)] && !library.deleted?.[docKey("set", `st_${id}`)])
    .map(({ ps, id }) => ({ ...pageFromPreset(ps), id, locked: false, presetId: undefined, createdAt: ps.createdAt ?? 0, updatedAt: ps.updatedAt ?? ps.createdAt ?? 0 }));
  return fresh.length ? { ...library, pages: [...library.pages, ...fresh] } : library;
}

// ---- the notebook being worked on: nothing reaches the library until the adult confirms ----

// What the adult confirmed goes into the library as THAT notebook only (its set and its pages; pages taken out of it are deleted):
// the rest of the library is whatever it is now, so a pull that came in while editing is not overwritten.
export function mergeNotebook(library, sessionLib, sid) {
  const next = sessionLib.sets.find((st) => st.id === sid);
  const old = library.sets.find((st) => st.id === sid);
  if (!next) return old ? removeSet(library, sid) : library;
  let lib = library;
  const keep = new Set(next.pageIds);
  for (const id of old?.pageIds ?? []) if (!keep.has(id)) lib = removePage(lib, id);
  for (const id of next.pageIds) {
    const pg = sessionLib.pages.find((p) => p.id === id);
    if (pg) lib = upsertPage(lib, pg);
  }
  return upsertSet(lib, next);
}

export const setTitleOf = (lib, sid, title) => ({ ...lib, sets: lib.sets.map((st) => (st.id === sid ? { ...st, title } : st)) });

// A notebook the adult only opened: no text in any row, not a ready one (those are never "empty"). The clutter of «Новая тетрадь».
export function isBlankNotebook(set, pagesById) {
  if (set.kit || set.sourceId) return false;
  return set.pageIds.every((id) => {
    const pg = pagesById.get(id);
    return !pg || pg.rows.every((r) => !String(r.text ?? "").trim());
  });
}

// The unsaved notebook is kept on this device (not synced) while it is edited, so a closed or killed app does not lose it.
export const DRAFT_KEY = "propis2:draft";
export async function saveDraft(draft, db) { await kv.set(db ?? (await getDb()), DRAFT_KEY, draft); }
export async function loadDraft(db) {
  const d = await kv.get(db ?? (await getDb()), DRAFT_KEY);
  return d && d.sid && d.set && Array.isArray(d.pages) ? d : null;
}
export async function clearDraft(db) { await kv.del(db ?? (await getDb()), DRAFT_KEY); }
