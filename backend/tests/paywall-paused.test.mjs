// While paid plans are paused (PAYWALL_ENFORCED unset -- the production state
// since 2026-10-14) an account whose trial has ended must still claim and
// download paid decks: the app tells everyone "nothing to pay", so a lock
// here contradicts it. The enforced behaviour is covered by paywall.test.mjs.
//
// config.mjs reads process.env at import time, hence the env setup before the
// dynamic import of server.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-paywall-paused-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-paywall-paused-dist-"));
const decksDir = path.join(frontendDir, "decks");
mkdirSync(decksDir, { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html>spa shell</html>");
writeFileSync(path.join(decksDir, "paid_deck_v1.zip"), "PAID-ZIP-BYTES");
writeFileSync(path.join(decksDir, "catalog.json"), JSON.stringify({
  decks: [{
    id: "paid_deck", version: "1", status: "release", access: "paid",
    url: "./decks/paid_deck_v1.zip", title: { ru: "Платная" },
  }],
}));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.MIROCARD_ADMIN_TOKEN = "test-admin-token";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";
process.env.MIROCARD_DEPLOY_TOKEN = "test-deploy-token";
process.env.APP_BASE_URL = "http://localhost:5174";
delete process.env.PAYWALL_ENFORCED;

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny, activateAccount } = await import("../lib/account-repository.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

async function registerWithExpiredTrial() {
  const email = "paywall-paused@example.test";
  const password = "correct horse battery staple";
  const registerRes = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email, password, firstName: "Test", role: "parent",
      referralSource: "other", consentPersonalData: true,
    }),
  });
  assert.equal(registerRes.status, 201);
  const account = findAccountByEmailAny(db, email);
  activateAccount(db, account.id);
  db.prepare("UPDATE entitlements SET ends_at = ? WHERE account_id = ? AND status = 'active'")
    .run("2000-01-01T00:00:00.000Z", account.id);
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(loginRes.status, 200);
  return (await loginRes.json()).token;
}

test("with the paywall paused, an expired trial still claims and downloads a paid deck", async () => {
  const token = await registerWithExpiredTrial();
  const auth = { Authorization: `Bearer ${token}` };

  const claimRes = await fetch(`${base}/api/decks/paid_deck/claim`, { method: "POST", headers: auth });
  assert.equal(claimRes.status, 200);
  assert.equal((await claimRes.json()).status, "granted");

  const downloadRes = await fetch(`${base}/api/decks/paid_deck/download`, { headers: auth });
  assert.equal(downloadRes.status, 200);
  assert.equal(await downloadRes.text(), "PAID-ZIP-BYTES");

  // A second claim (the path an already-claimed deck takes) stays granted too.
  const reclaimRes = await fetch(`${base}/api/decks/paid_deck/claim`, { method: "POST", headers: auth });
  assert.equal((await reclaimRes.json()).status, "granted");
});
