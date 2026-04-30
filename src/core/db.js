const DB_VERSION = 1;

export function openDb(name = "mirocard") {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("keyval")) {
        db.createObjectStore("keyval");
      }
      if (!db.objectStoreNames.contains("topics")) {
        db.createObjectStore("topics");
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _dbPromise = null;

export function getDb() {
  if (!_dbPromise) _dbPromise = openDb();
  return _dbPromise;
}

// ─── kv helpers ───────────────────────────────────────────────────────────────

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function req2p(idbReq) {
  return new Promise((resolve, reject) => {
    idbReq.onsuccess = () => resolve(idbReq.result ?? null);
    idbReq.onerror   = () => reject(idbReq.error);
  });
}

export const kv = {
  get:  (db, key)        => req2p(tx(db, "keyval", "readonly").get(key)),
  set:  (db, key, value) => req2p(tx(db, "keyval", "readwrite").put(value, key)),
  del:  (db, key)        => req2p(tx(db, "keyval", "readwrite").delete(key)),
};

// ─── topics helpers ───────────────────────────────────────────────────────────

function topicKey(topicId, filename) {
  return `${topicId}/${filename}`;
}

export const topics = {
  async saveFile(db, topicId, filename, blob) {
    const buf = await blob.arrayBuffer();
    return req2p(tx(db, "topics", "readwrite").put({ buf, type: blob.type }, topicKey(topicId, filename)));
  },

  async getFile(db, topicId, filename) {
    const entry = await req2p(tx(db, "topics", "readonly").get(topicKey(topicId, filename)));
    if (!entry) return null;
    return new Blob([entry.buf], { type: entry.type });
  },

  listFiles(db, topicId) {
    const prefix = `${topicId}/`;
    return new Promise((resolve, reject) => {
      const store = tx(db, "topics", "readonly");
      const range = IDBKeyRange.bound(prefix, prefix + "￿", false, false);
      const req = store.getAllKeys(range);
      req.onsuccess = () => {
        resolve((req.result ?? []).map((k) => String(k).slice(prefix.length)));
      };
      req.onerror = () => reject(req.error);
    });
  },

  deleteTopic(db, topicId) {
    const prefix = `${topicId}/`;
    return new Promise((resolve, reject) => {
      const store = tx(db, "topics", "readwrite");
      const range = IDBKeyRange.bound(prefix, prefix + "￿", false, false);
      const req = store.delete(range);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  },
};
