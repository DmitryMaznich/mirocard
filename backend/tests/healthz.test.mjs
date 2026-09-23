import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-healthz-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-healthz-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.MIROCARD_ADMIN_TOKEN = "test-admin-token";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";
process.env.APP_BASE_URL = "http://localhost:5174";

const { router } = await import("../server.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

test("GET /healthz requires no auth and reports ok with a db check, version and gitSha", async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.db, true);
  assert.equal(typeof body.version, "string");
  assert.equal(typeof body.gitSha, "string");
  // No PII: nothing account/student-shaped in the response.
  assert.deepEqual(Object.keys(body).sort(), ["backupAgeMinutes", "db", "gitSha", "status", "version"]);
});

test("GET /healthz reports backupAgeMinutes null when no backup directory exists yet", async () => {
  const res = await fetch(`${base}/healthz`);
  const body = await res.json();
  assert.equal(body.backupAgeMinutes, null);
});

test("GET /api/version includes both version and gitSha", async () => {
  const res = await fetch(`${base}/api/version`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.version, "string");
  assert.equal(typeof body.gitSha, "string");
});
