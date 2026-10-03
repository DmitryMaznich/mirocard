import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-ai-disabled-"));
process.env.MIROCARD_DATA_DIR = dataDir;
process.env.ANTHROPIC_API_KEY = "test-key-must-never-be-used";
process.env.ERROR_REPORTING_WEBHOOK_URL = "";
process.env.ANALYTICS_WEBHOOK_URL = "";

const { router } = await import("../server.mjs");
const { getDb } = await import("../lib/db.mjs");
const { createAccount, activateAccount, storeAuthToken, upsertStudent, appendSession } = await import("../lib/account-repository.mjs");
const db = getDb();
const account = createAccount(db, { email: "ai-disabled@example.test", passwordHash: "unused" });
activateAccount(db, account.id);
const token = "test-ai-disabled-token";
storeAuthToken(db, { accountId: account.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: "2099-01-01T00:00:00.000Z" });
upsertStudent(db, account.id, { id: "kid", name: "Test" });
appendSession(db, account.id, { id: "lesson", studentId: "kid", topicId: "topic", topicVersion: "1", mode: "default", startedAt: "2026-10-01T00:00:00Z", completedAt: "2026-10-01T00:01:00Z" });
db.prepare("INSERT INTO analysis_cache (student_id, topic_id, prompt_version, generated_at, result_json) VALUES (?, ?, ?, ?, ?)")
  .run("kid", "topic", "v1", Date.now(), JSON.stringify({ summary: "private cached report" }));

const server = createServer(router);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test("old clients cannot generate, read or delete AI reports, even with a configured key and existing lesson data", async () => {
  const realFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = (url, options) => {
    if (!String(url).startsWith(base + "/")) {
      externalCalls++;
      throw new Error("External calls are forbidden in this test");
    }
    return realFetch(url, options);
  };
  try {
    for (const prefix of ["/api", ""]) {
      for (const auth of [null, token]) {
        for (const method of ["GET", "POST", "DELETE"]) {
          const response = await fetch(`${base}${prefix}/analysis/topic?studentId=kid&topicId=topic`, {
            method,
            headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
            ...(method === "POST" ? { body: JSON.stringify({ studentId: "kid", topicId: "topic" }) } : {}),
          });
          assert.equal(response.status, 410);
          assert.deepEqual(await response.json(), { error: "ai_analysis_disabled" });
        }
      }
    }
    assert.equal(externalCalls, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM analysis_cache").get().n, 1);
    const sessions = await fetch(`${base}/api/sessions`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(sessions.status, 200);
    assert.equal((await sessions.json()).length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
