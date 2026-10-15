import { compareSessionRecords } from "../../../shared/session-record-order.mjs";

// One atomic write stores the compact result and its pending sync operation.
// A browser close cannot leave a locally saved result without an upload queued.
export function persistSessionRecord(db, record, { snapshot = null, clearSnapshot = false } = {}) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["keyval", "syncQueue"], "readwrite");
    const kv = tx.objectStore("keyval");
    const queue = tx.objectStore("syncQueue");
    let result = record;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? new Error("Session save failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Session save aborted"));
    const request = kv.get("sessions");
    request.onsuccess = () => {
      const sessions = request.result ?? [];
      const saved = sessions.find(item => item.id === record.id);
      if (saved && compareSessionRecords(record, saved) < 0) { result = saved; return; }
      kv.put([...sessions.filter(item => item.id !== record.id), record], "sessions");
      if (clearSnapshot) kv.delete("activeSession");
      else if (snapshot) kv.put(snapshot, "activeSession");
      const cursorRequest = queue.openCursor();
      cursorRequest.onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) { queue.add({ type: "session.append", data: { ...record, mode: record.modeId } }); return; }
        if (cursor.value.type === "session.append" && cursor.value.data?.id === record.id) cursor.delete();
        cursor.continue();
      };
    };
  });
}
