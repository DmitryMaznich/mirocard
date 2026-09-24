// End-to-end paywall regression tests, exercised over a real HTTP server
// (createServer(router)) rather than calling repository functions directly
// -- the bug this guards against lived in the static-file layer
// (trySpaFallback) and in the download/claim handlers, not in the
// repository. A repository-level test alone would never have caught it.
//
// Fixture setup (env vars + fixture files) must happen BEFORE server.mjs
// (and the config.mjs it imports) is loaded, since config.mjs reads
// process.env at module-evaluation time. That's why this file uses a
// dynamic `await import("../server.mjs")` instead of a static import.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-paywall-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-paywall-dist-"));
const decksDir = path.join(frontendDir, "decks");
mkdirSync(decksDir, { recursive: true });

writeFileSync(path.join(frontendDir, "index.html"), "<html>spa shell</html>");
writeFileSync(path.join(decksDir, "free_deck_v1.zip"), "FREE-ZIP-BYTES");
writeFileSync(path.join(decksDir, "paid_deck_v1.zip"), "PAID-ZIP-BYTES");

const catalog = {
  decks: [
    {
      id: "free_deck", version: "1", status: "release", access: "free",
      url: "./decks/free_deck_v1.zip", title: { ru: "Бесплатная" },
    },
    {
      id: "paid_deck", version: "1", status: "release", access: "paid",
      url: "./decks/paid_deck_v1.zip", title: { ru: "Платная" },
    },
  ],
};
writeFileSync(path.join(decksDir, "catalog.json"), JSON.stringify(catalog));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.MIROCARD_ADMIN_TOKEN = "test-admin-token";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";
process.env.MIROCARD_DEPLOY_TOKEN = "test-deploy-token";
process.env.APP_BASE_URL = "http://localhost:5174";

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny, activateAccount } = await import("../lib/account-repository.mjs");
const { setAccountFeatureFlags } = await import("../lib/account-repository.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

let registerSeq = 0;
async function registerAndLogin({ allAccess = false } = {}) {
  registerSeq += 1;
  const email = `paywall-test-${registerSeq}@example.test`;
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
  if (allAccess) setAccountFeatureFlags(db, account.id, ["all_access"]);

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(loginRes.status, 200);
  const { token } = await loginRes.json();
  return { accountId: account.id, token };
}

function expireEntitlement(accountId) {
  db.prepare("UPDATE entitlements SET ends_at = ? WHERE account_id = ? AND status = 'active'")
    .run("2000-01-01T00:00:00.000Z", accountId);
}

// ─── 1. Unauthenticated static access to the paid ZIP / raw catalog ────────

test("unauthenticated request for a paid deck ZIP via its static URL is refused", async () => {
  const res = await fetch(`${base}/decks/paid_deck_v1.zip`);
  assert.equal(res.status, 404);
  const text = await res.text();
  assert.notEqual(text, "PAID-ZIP-BYTES");
});

test("the raw catalog.json is never served statically (it lists every paid ZIP's URL)", async () => {
  const res = await fetch(`${base}/decks/catalog.json`);
  assert.equal(res.status, 404);
});

test("a genuinely free deck ZIP is still servable statically (local mode needs this)", async () => {
  const res = await fetch(`${base}/decks/free_deck_v1.zip`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "FREE-ZIP-BYTES");
});

test("GET /api/decks/catalog works unauthenticated but never discloses a paid entry's url", async () => {
  const res = await fetch(`${base}/api/decks/catalog`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const free = body.decks.find((d) => d.id === "free_deck");
  const paid = body.decks.find((d) => d.id === "paid_deck");
  assert.ok(free.url, "free entry keeps its url");
  assert.equal(paid.url, undefined, "paid entry's url must not be disclosed to an anonymous caller");
});

// ─── 2. Authenticated but unentitled / entitled / expired ──────────────────

test("unauthenticated request for /api/decks/:id/download returns 401", async () => {
  const res = await fetch(`${base}/api/decks/paid_deck/download`);
  assert.equal(res.status, 401);
});

test("a freshly registered account (7-day trial) can claim and download a paid deck", async () => {
  const { token } = await registerAndLogin();

  const claimRes = await fetch(`${base}/api/decks/paid_deck/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(claimRes.status, 200);
  assert.equal((await claimRes.json()).status, "granted");

  const downloadRes = await fetch(`${base}/api/decks/paid_deck/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(downloadRes.status, 200);
  assert.equal(await downloadRes.text(), "PAID-ZIP-BYTES");
});

test("an account with no active entitlement gets 'locked' on claim and 403 on download", async () => {
  const { accountId, token } = await registerAndLogin();
  expireEntitlement(accountId); // simulate a lapsed/never-granted trial

  const claimRes = await fetch(`${base}/api/decks/paid_deck/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(claimRes.status, 200);
  assert.equal((await claimRes.json()).status, "locked");

  const downloadRes = await fetch(`${base}/api/decks/paid_deck/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(downloadRes.status, 403);
});

test("entitlement expiring AFTER a successful claim blocks further downloads and re-claims", async () => {
  const { accountId, token } = await registerAndLogin();

  const claimRes = await fetch(`${base}/api/decks/paid_deck/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal((await claimRes.json()).status, "granted");

  const firstDownload = await fetch(`${base}/api/decks/paid_deck/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(firstDownload.status, 200);

  expireEntitlement(accountId);

  const reclaimRes = await fetch(`${base}/api/decks/paid_deck/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal((await reclaimRes.json()).status, "locked",
    "a stale 'paid' claim row must not keep reporting granted forever");

  const secondDownload = await fetch(`${base}/api/decks/paid_deck/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(secondDownload.status, 403,
    "download must re-check entitlement, not just trust the original claim");
});

test("an all_access (grandfathered) account is unaffected -- claim and download keep working", async () => {
  const { accountId, token } = await registerAndLogin({ allAccess: true });
  // Grandfathered accounts have no entitlements row at all (see
  // backend/scripts/grant-all-access-to-existing-accounts.mjs) -- remove
  // the trial entitlement registration granted to prove access comes
  // purely from the all_access feature flag, same as production
  // grandfathering.
  db.prepare("DELETE FROM entitlements WHERE account_id = ?").run(accountId);

  const claimRes = await fetch(`${base}/api/decks/paid_deck/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal((await claimRes.json()).status, "granted");

  const downloadRes = await fetch(`${base}/api/decks/paid_deck/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(downloadRes.status, 200);
  assert.equal(await downloadRes.text(), "PAID-ZIP-BYTES");
});

test("a free deck claim/download never depends on entitlement at all", async () => {
  const { accountId, token } = await registerAndLogin();
  expireEntitlement(accountId);

  const claimRes = await fetch(`${base}/api/decks/free_deck/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal((await claimRes.json()).status, "granted");

  const downloadRes = await fetch(`${base}/api/decks/free_deck/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(downloadRes.status, 200);
});

// ─── Client-supplied topic "source" must never grant access ─────────────────

test("sync topic.acquire with source 'grant' does not unlock a paid deck without entitlement", async () => {
  const { accountId, token } = await registerAndLogin();
  expireEntitlement(accountId);
  const syncRes = await fetch(`${base}/api/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ operations: [{ type: "topic.acquire", data: { id: "forged-1", topicId: "paid_deck", topicVersion: "1", source: "grant" } }] }),
  });
  assert.equal(syncRes.status, 200);
  const downloadRes = await fetch(`${base}/api/decks/paid_deck/download`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(downloadRes.status, 403);
  const claim = await (await fetch(`${base}/api/decks/paid_deck/claim`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })).json();
  assert.equal(claim.status, "locked");
});

test("REST topic acquire cannot self-assign a non-expiring 'grant' while entitled, to keep the deck after expiry", async () => {
  const { accountId, token } = await registerAndLogin();
  const acquireRes = await fetch(`${base}/api/account-topics`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topicId: "paid_deck", topicVersion: "1", source: "grant" }),
  });
  assert.equal(acquireRes.status, 200, "entitled account may record the topic");
  expireEntitlement(accountId);
  const downloadRes = await fetch(`${base}/api/decks/paid_deck/download`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(downloadRes.status, 403);
});
