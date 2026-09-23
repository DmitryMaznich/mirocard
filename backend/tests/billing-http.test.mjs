// HTTP-level tests for billing routes that need a real server (rate
// limiting middleware wired into the router, not just the underlying
// repository functions). See backend/tests/paywall.test.mjs for why this
// needs a dynamic import + real listener instead of the usual
// initDb(":memory:") repository-level pattern.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-billing-http-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-billing-http-dist-"));
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

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny, activateAccount } = await import("../lib/account-repository.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

async function registerAndLogin(email) {
  const password = "correct horse battery staple";
  await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "Test", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  activateAccount(db, findAccountByEmailAny(db, email).id);
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await loginRes.json()).token;
}

test("POST /api/billing/validate-code is rate-limited per account after repeated guesses", async () => {
  const token = await registerAndLogin("rate-limit-promo@example.test");

  let sawRateLimited = false;
  for (let i = 0; i < 25; i += 1) {
    const res = await fetch(`${base}/api/billing/validate-code`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: `GUESS${i}`, plan: "monthly" }),
    });
    if (res.status === 429) { sawRateLimited = true; break; }
    assert.equal(res.status, 200); // a wrong guess is a normal { ok: false } response, not an error
  }
  assert.ok(sawRateLimited, "expected a 429 after enough promo-code guesses from one account");
});

test("POST /api/auth/login is rate-limited per email after repeated failed attempts", async () => {
  const email = "rate-limit-login@example.test";
  let sawRateLimited = false;
  for (let i = 0; i < 15; i += 1) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "wrong-password" }),
    });
    if (res.status === 429) { sawRateLimited = true; break; }
    assert.equal(res.status, 401); // unknown account -- normal rejection, not the rate limit
  }
  assert.ok(sawRateLimited, "expected a 429 after enough failed login attempts for one email");
});
