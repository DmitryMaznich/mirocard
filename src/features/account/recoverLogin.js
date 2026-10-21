import { api, setApiToken } from "@/core/api";
import { openDb, activateRecoveredDatabase } from "@/core/db";
import { normalizeBootstrap } from "@/core/bootstrap";
import { useAppStore } from "@/core/store";
import { markLoginFailure } from "./loginDiagnostics";

function saveRecoverySnapshot(db, raw, preservedDatabase) {
  const snapshot = normalizeBootstrap(raw);
  // Unlike ordinary synchronization, this is a new empty database, so there
  // are no local edits to merge. Commit the entire snapshot atomically before
  // changing the active database pointer, including on quota/commit failures.
  const values = {
    token: snapshot.token, account: snapshot.account, accountId: snapshot.account.id,
    settings: snapshot.settings, subscription: snapshot.subscription,
    students: snapshot.students, sessions: snapshot.sessions,
    ownedTopics: snapshot.ownedTopics, studentTopicLinks: snapshot.studentTopicLinks,
    conceptProgress: snapshot.conceptProgress, builtinVisibility: snapshot.builtinVisibility,
    archivedTopicIds: snapshot.archivedTopicIds, erasedStudentIds: snapshot.erasedStudentIds,
    recoverySource: { databaseName: preservedDatabase, createdAt: new Date().toISOString() },
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keyval", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new DOMException("Recovery write aborted", "AbortError"));
    tx.onerror = () => reject(tx.error ?? new DOMException("Recovery write failed", "UnknownError"));
    try {
      const store = tx.objectStore("keyval");
      for (const [key, value] of Object.entries(values)) store.put(value, key);
    } catch (error) {
      try { tx.abort(); } catch { /* A failed request may already have aborted it. */ }
      reject(error);
    }
  });
}

// Explicit action on the login screen, after explaining what happens to
// unsynced edits and downloads. The old DB is never written to or deleted.
export async function recoverLogin() {
  const pending = useAppStore.getState().loginRecovery;
  if (!pending?.account?.id || !pending.token || !pending.databaseName) throw new Error("No recoverable login");
  let stage = "recovery-load-account";
  let recoveryDb;
  let activated = false;
  try {
    setApiToken(pending.token);
    const [bootstrap, sessions] = await Promise.all([
      api.get("/account/bootstrap"), api.get("/sessions?limit=200"),
    ]);
    if (bootstrap.account?.id !== pending.account.id) throw new Error("Recovery account mismatch");
    stage = "recovery-save-copy";
    recoveryDb = await openDb(`mirocard-recovery-${crypto.randomUUID()}`);
    await saveRecoverySnapshot(recoveryDb, { ...bootstrap, token: pending.token, sessions }, pending.databaseName);
    if (useAppStore.getState().loginRecovery !== pending) throw new Error("Login changed during recovery");
    stage = "recovery-activate";
    activateRecoveredDatabase(recoveryDb, pending.databaseName);
    activated = true;
    useAppStore.setState({ loginRecovery: null });
    // The caller reloads. Ordinary boot now reads the committed cloud copy,
    // installs first-party topics and restores authentication as on a new device.
  } catch (error) {
    markLoginFailure(error, stage);
    throw error;
  } finally {
    if (recoveryDb && !activated) recoveryDb.close();
  }
}
