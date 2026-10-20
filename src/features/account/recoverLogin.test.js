import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { api } from "@/core/api";
import { openDb, getDb, kv, topics, getActiveDatabaseName, ACTIVE_DATABASE_KEY } from "@/core/db";
import { useAppStore } from "@/core/store";
import { recoverLogin } from "./recoverLogin";
import { loginDiagnosticCode } from "./loginDiagnostics";

describe("isolated cloud recovery after a local read failure", () => {
  let source;
  beforeEach(async () => {
    localStorage.removeItem(ACTIVE_DATABASE_KEY);
    source = await getDb();
    await kv.set(source, "accountId", "owner");
    await kv.set(source, "students", [{ id: "offline-student", name: "Unsynced" }]);
    await kv.set(source, "sessions", [{ id: "offline-session", studentId: "offline-student" }]);
    await kv.set(source, "studentTopicLinks", { offline: { studentId: "offline-student", topicId: "download" } });
    await topics.saveFile(source, "download", "deck.json", new Blob(["offline-topic"]));
    await new Promise((resolve, reject) => {
      const tx = source.transaction("syncQueue", "readwrite");
      tx.objectStore("syncQueue").clear();
      tx.objectStore("syncQueue").add({ type: "session.append", data: { id: "queued" } });
      tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
    });
    useAppStore.getState().logout();
    useAppStore.setState({ loginRecovery: { account: { id: "owner" }, token: "verified-token", databaseName: source.name } });
    vi.spyOn(api, "get").mockImplementation(async (path) => path.includes("bootstrap")
      ? { account: { id: "owner" }, students: [{ id: "cloud-student", name: "Synced" }], settings: { uiLanguage: "sl" }, studentTopicLinks: [], ownedTopics: [], conceptProgress: [] }
      : [{ id: "cloud-session", studentId: "cloud-student" }]);
    vi.spyOn(api, "post").mockRejectedValue(new Error("Recovery must not upload local records"));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useAppStore.getState().logout();
    localStorage.removeItem(ACTIVE_DATABASE_KEY);
  });

  async function expectOriginalIntact() {
    expect(await kv.get(source, "students")).toEqual([{ id: "offline-student", name: "Unsynced" }]);
    expect((await kv.get(source, "sessions"))[0].id).toBe("offline-session");
    expect((await kv.get(source, "studentTopicLinks")).offline.studentId).toBe("offline-student");
    expect(await topics.getFile(source, "download", "deck.json")).toBeInstanceOf(Blob);
    const queue = await new Promise((resolve, reject) => {
      const req = source.transaction("syncQueue").objectStore("syncQueue").getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    expect(queue).toEqual([{ type: "session.append", data: { id: "queued" } }]);
  }

  it("persists an independent server copy and preserves all original records and queued edits", async () => {
    await recoverLogin();
    const activeName = getActiveDatabaseName();
    expect(activeName).toMatch(/^mirocard-recovery-/);
    const recovered = await getDb();
    expect(recovered.name).toBe(activeName);
    expect(await kv.get(recovered, "token")).toBe("verified-token");
    expect(await kv.get(recovered, "accountId")).toBe("owner");
    expect((await kv.get(recovered, "students"))[0].id).toBe("cloud-student");
    expect((await kv.get(recovered, "sessions"))[0].id).toBe("cloud-session");
    expect((await kv.get(recovered, "recoverySource")).databaseName).toBe(source.name);
    const reopened = await openDb(activeName);
    expect((await kv.get(reopened, "account")).id).toBe("owner");
    reopened.close();
    await expectOriginalIntact();
    expect(api.post).not.toHaveBeenCalled();
    expect(useAppStore.getState().loginRecovery).toBeNull();
  });

  it("keeps the original active when the cloud is unavailable", async () => {
    const failure = new Error("Network error");
    api.get.mockRejectedValue(failure);
    await expect(recoverLogin()).rejects.toBe(failure);
    expect(loginDiagnosticCode(failure)).toMatch(/\/recovery-load-account\/Error$/);
    expect(getActiveDatabaseName()).toBe(source.name);
    await expectOriginalIntact();
  });

  it("never activates a partial copy when its write transaction aborts", async () => {
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (value, key) {
      if (this.transaction.db.name.startsWith("mirocard-recovery-") && key === "students") {
        this.transaction.abort();
        throw new DOMException("Injected quota failure", "QuotaExceededError");
      }
      return originalPut.call(this, value, key);
    });
    await expect(recoverLogin()).rejects.toHaveProperty("name", "QuotaExceededError");
    expect(getActiveDatabaseName()).toBe(source.name);
    await expectOriginalIntact();
  });

  it("keeps the original active when the database selection cannot be saved", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    await expect(recoverLogin()).rejects.toHaveProperty("name", "SecurityError");
    expect(getActiveDatabaseName()).toBe(source.name);
    await expectOriginalIntact();
  });

  it("waits for commit even when every put request succeeded", async () => {
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (value, key) {
      const request = originalPut.call(this, value, key);
      if (this.transaction.db.name.startsWith("mirocard-recovery-") && key === "recoverySource") {
        request.onsuccess = () => this.transaction.abort();
      }
      return request;
    });
    await expect(recoverLogin()).rejects.toHaveProperty("name", "AbortError");
    expect(getActiveDatabaseName()).toBe(source.name);
    await expectOriginalIntact();
  });

  it("rejects a different account or a recovery with no verified login", async () => {
    api.get.mockResolvedValue({ account: { id: "different-account" } });
    await expect(recoverLogin()).rejects.toThrow("Recovery account mismatch");
    expect(getActiveDatabaseName()).toBe(source.name);
    useAppStore.setState({ loginRecovery: null });
    await expect(recoverLogin()).rejects.toThrow("No recoverable login");
    await expectOriginalIntact();
  });
});
