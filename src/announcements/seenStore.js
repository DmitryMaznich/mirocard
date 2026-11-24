// «Already read» marks of the announcements (docs/announcements.md): one key per announcement,
// `announcements:seen:<id>` = { at }, on the device (IndexedDB keyval) and in the account (kv, through the offline
// queue). One key per announcement, not one list: two devices marking two announcements offline never overwrite
// each other (the server keeps the last write per key).
import { kv } from "@/core/db";
import { api } from "@/core/api";
import { pushOp } from "@/core/syncApi";

export const SEEN_PREFIX = "announcements:seen:";

export async function localSeen(db, ids) {
  const out = [];
  for (const id of ids) if (await kv.get(db, SEEN_PREFIX + id).catch(() => null)) out.push(id);
  return out;
}

// the account's marks (read on another device); null when offline or signed out
export async function remoteSeen() {
  try {
    const res = await api.get(`/account/kv?prefix=${encodeURIComponent(SEEN_PREFIX)}`);
    return (res?.kv ?? []).filter((i) => i?.key?.startsWith(SEEN_PREFIX) && i.value).map((i) => i.key.slice(SEEN_PREFIX.length));
  } catch {
    return null;
  }
}

export async function markSeen(db, id, { signedIn = true, now = Date.now() } = {}) {
  const value = { at: now };
  await kv.set(db, SEEN_PREFIX + id, value).catch(() => {});
  if (signedIn) {
    try { await pushOp("kv.upsert", { key: SEEN_PREFIX + id, value }); } catch { /* offline: the device's mark stands */ }
  }
}

// a mark read from the account, kept on the device too (so it holds offline)
export async function keepLocal(db, ids, now = Date.now()) {
  for (const id of ids) await kv.set(db, SEEN_PREFIX + id, { at: now }).catch(() => {});
}
