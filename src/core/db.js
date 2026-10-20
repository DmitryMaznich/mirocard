const DB_VERSION = 3;

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
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("audioOverrides")) {
        db.createObjectStore("audioOverrides");
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
  replaceTopic(db, topicId, files, record, { keepFiles = [], extraValues = {} } = {}) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["topics", "keyval"], "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Topic installation aborted"));
      const store = transaction.objectStore("topics");
      const values = transaction.objectStore("keyval");
      const prefix = `${topicId}/`;
      const retained = new Set(keepFiles.map((file) => topicKey(topicId, file)));
      const abort = (error) => { transaction.abort(); reject(error); };
      try {
        const keys = store.getAllKeys(IDBKeyRange.bound(prefix, prefix + "￿", false, false));
        keys.onsuccess = () => {
          try {
            for (const key of keys.result) if (!retained.has(key)) store.delete(key);
            for (const [name, file] of Object.entries(files)) store.put(file, topicKey(topicId, name));
          } catch (error) { abort(error); }
        };
        values.put(record, `topic:${topicId}`);
        for (const [key, value] of Object.entries(extraValues)) values.put(value, key);
        const index = values.get("installedTopicIds");
        index.onsuccess = () => {
          const ids = index.result ?? [];
          try { if (!ids.includes(topicId)) values.put([...ids, topicId], "installedTopicIds"); } catch (error) { abort(error); }
        };
      } catch (error) { abort(error); }
    });
  },
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

  deleteFile(db, topicId, filename) {
    return req2p(tx(db, "topics", "readwrite").delete(topicKey(topicId, filename)));
  },
};

// ─── audioOverrides helpers ───────────────────────────────────────────────────

export const audio = {
  get: (db, key) => req2p(tx(db, "audioOverrides", "readonly").get(key)),
  set: (db, key, value) => req2p(tx(db, "audioOverrides", "readwrite").put(value, key)),
  del: (db, key) => req2p(tx(db, "audioOverrides", "readwrite").delete(key)),

  getByPrefix(db, prefix) {
    return new Promise((resolve, reject) => {
      const store = tx(db, "audioOverrides", "readonly");
      const range = IDBKeyRange.bound(prefix, prefix + "￿", false, false);
      const results = [];
      const req = store.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { results.push({ key: String(cursor.key), value: cursor.value }); cursor.continue(); }
        else resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  },
};
