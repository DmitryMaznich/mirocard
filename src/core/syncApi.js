import { api } from "@/core/api";
import { getDb } from "@/core/db";

const SQ = "syncQueue";

function req2p(r) {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result ?? null);
    r.onerror   = () => rej(r.error);
  });
}

function cursorAll(db) {
  return new Promise((res, rej) => {
    const entries = [];
    const req = db.transaction(SQ, "readonly").objectStore(SQ).openCursor();
    req.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) { res(entries); return; }
      entries.push({ key: c.primaryKey, type: c.value.type, data: c.value.data });
      c.continue();
    };
    req.onerror = () => rej(req.error);
  });
}

// For upsert ops: replace any older queued entry for the same entity
function dedupUpsert(db, type, entityId) {
  return new Promise((res) => {
    const req = db.transaction(SQ, "readwrite").objectStore(SQ).openCursor();
    req.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) { res(); return; }
      if (c.value.type === type && c.value.data?.id === entityId) c.delete();
      c.continue();
    };
    req.onerror = res;
  });
}

async function enqueue(type, data) {
  const db = await getDb();
  if (data?.id && type.endsWith(".upsert")) {
    await dedupUpsert(db, type, data.id).catch(() => {});
  }
  await req2p(db.transaction(SQ, "readwrite").objectStore(SQ).add({ type, data })).catch(() => {});
}

export async function flushQueue() {
  const db = await getDb();
  const entries = await cursorAll(db).catch(() => []);
  for (const { key, type, data } of entries) {
    try {
      await api.post("/sync", { operations: [{ type, data }] });
      await req2p(db.transaction(SQ, "readwrite").objectStore(SQ).delete(key)).catch(() => {});
    } catch {
      break; // stop on first failure, retry next time
    }
  }
}

let _onlineListenerSet = false;
export function setupOnlineListener() {
  if (_onlineListenerSet) return;
  _onlineListenerSet = true;
  window.addEventListener("online", () => flushQueue().catch(() => {}));
}

export async function pushOp(type, data) {
  try {
    await api.post("/sync", { operations: [{ type, data }] });
  } catch {
    await enqueue(type, data);
  }
}
