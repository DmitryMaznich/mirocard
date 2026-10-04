// «Прописи 2» library sync. Every page / set / preset is its own account_kv document (`propis2:page:<id>` ...), written
// with the app's offline queue (`kv.upsert`) and read back with GET /account/kv?prefix=propis2:. Last write wins per
// document (by its `updatedAt`); a delete is a tombstone `{ id, deleted: true, updatedAt }` so it reaches other devices.
export const SYNC_PREFIX = "propis2:";
const LISTS = { page: "pages", set: "sets", preset: "presets" };
const VALID = {
  page: (d) => Array.isArray(d.rows),
  set: (d) => Array.isArray(d.pageIds),
  preset: (d) => Array.isArray(d.rows),
};

export const docKey = (kind, id) => `${SYNC_PREFIX}${kind}:${id}`;
export function parseKey(key) {
  const m = /^propis2:(page|set|preset):(.+)$/.exec(String(key));
  return m ? { kind: m[1], id: m[2] } : null;
}

// key -> JSON of everything the library currently says about each document (live docs and tombstones)
export function snapshotDocs(lib) {
  const out = new Map();
  for (const [kind, list] of Object.entries(LISTS)) {
    for (const doc of lib[list] ?? []) out.set(docKey(kind, doc.id), JSON.stringify(doc));
  }
  for (const [key, updatedAt] of Object.entries(lib.deleted ?? {})) {
    const info = parseKey(key);
    if (info) out.set(key, JSON.stringify({ id: info.id, deleted: true, updatedAt }));
  }
  return out;
}

// What changed since `synced` (a snapshot Map): the kv.upsert payloads to send, and the new snapshot.
export function diffOps(synced, lib) {
  const next = snapshotDocs(lib);
  const ops = [];
  for (const [key, json] of next) if (synced.get(key) !== json) ops.push({ key, value: JSON.parse(json) });
  return { ops, next };
}

export const snapshotFromRemote = (items) => new Map((items ?? []).filter((i) => parseKey(i?.key)).map((i) => [i.key, JSON.stringify(i.value)]));

// Fold the server's documents into the local library (last write wins per document). Returns the same object when
// nothing changed.
export function mergeRemote(lib, items) {
  const next = { ...lib, pages: [...(lib.pages ?? [])], sets: [...(lib.sets ?? [])], presets: [...(lib.presets ?? [])], deleted: { ...(lib.deleted ?? {}) } };
  let changed = false;
  for (const item of items ?? []) {
    const info = parseKey(item?.key);
    const v = item?.value;
    if (!info || !v || typeof v !== "object") continue;
    const list = LISTS[info.kind];
    const ts = Number(v.updatedAt) || 0;
    const at = next[list].findIndex((d) => d.id === info.id);
    const local = at >= 0 ? next[list][at] : null;
    const tomb = next.deleted[item.key];
    if (v.deleted) {
      if (local && (Number(local.updatedAt) || 0) > ts) continue; // edited here after it was deleted elsewhere
      if (local) { next[list].splice(at, 1); changed = true; }
      if (!(tomb >= ts)) { next.deleted[item.key] = ts; changed = true; }
      continue;
    }
    if (!VALID[info.kind](v)) continue;
    if (tomb !== undefined && tomb >= ts) continue; // deleted after this version
    if (local && (Number(local.updatedAt) || 0) >= ts) continue;
    if (local) next[list][at] = v; else next[list].unshift(v);
    if (tomb !== undefined) delete next.deleted[item.key];
    changed = true;
  }
  return changed ? next : lib;
}
