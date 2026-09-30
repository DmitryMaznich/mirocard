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
      const queuedEntityId = c.value.data?.id ?? c.value.data?.studentId ?? c.value.data?.key;
      if (c.value.type === type && queuedEntityId === entityId) c.delete();
      c.continue();
    };
    req.onerror = res;
  });
}

async function enqueue(type, data) {
  const db = await getDb();
  // Some child resources are keyed by studentId (photo, rewards, personal
  // profile) rather than an entity `id`.  Keep only their newest queued write.
  const entityId = data?.id ?? data?.studentId ?? data?.key;
  if (entityId && type.endsWith(".upsert")) {
    await dedupUpsert(db, type, entityId).catch(() => {});
  }
  await req2p(db.transaction(SQ, "readwrite").objectStore(SQ).add({ type, data })).catch(() => {});
}

// Statuses where retrying the same op later can succeed: the session needs
// re-auth (401/403), a timeout (408) or rate limit (429). Anything else in
// 4xx means the server looked at this exact payload and refused it; keeping
// it at the head of the queue would block every op behind it forever.
const RETRYABLE_CLIENT_STATUSES = new Set([401, 403, 408, 429]);

export function isPermanentSyncRejection(error) {
  const status = error?.status;
  return typeof status === "number" && status >= 400 && status < 500 && !RETRYABLE_CLIENT_STATUSES.has(status);
}

export async function flushQueue() {
  const db = await getDb();
  const entries = await cursorAll(db).catch(() => []);
  for (const { key, type, data } of entries) {
    try {
      await api.post("/sync", { operations: [{ type, data }] });
    } catch (error) {
      // Network errors, timeouts and 5xx: stop and retry the whole queue
      // next time, in order.
      if (!isPermanentSyncRejection(error)) break;
      console.error(`[sync] dropping ${type} rejected with ${error.status}: ${error.message}`);
    }
    await req2p(db.transaction(SQ, "readwrite").objectStore(SQ).delete(key)).catch(() => {});
  }
}

let _onlineListenerSet = false;
export function setupOnlineListener() {
  if (_onlineListenerSet) return;
  _onlineListenerSet = true;
  window.addEventListener("online", () => flushQueue().catch(() => {}));
  // Also flush when tab becomes visible again — catches the case where the local
  // backend restarted (e.g. after power cut) without the browser firing "online".
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) flushQueue().catch(() => {});
  });
}

export async function pushOp(type, data) {
  // Write to queue first so the op survives a page refresh mid-flight.
  // Then attempt an immediate flush; failures are retried on next startup.
  await enqueue(type, data).catch(() => {});
  flushQueue().catch(() => {});
}
