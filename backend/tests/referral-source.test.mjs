// The launch is an Instagram campaign: "Instagram" must be a valid answer to
// "Как узнали о Mironium?", otherwise the campaign's signups are unmeasurable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-referral-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-referral-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny } = await import("../lib/account-repository.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

function register(email, referralSource) {
  return fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery", firstName: "T", role: "parent", referralSource, consentPersonalData: true }),
  });
}

test("registration accepts referralSource 'instagram' and stores it", async () => {
  const email = "insta@example.test";
  const res = await register(email, "instagram");
  assert.equal(res.status, 201);
  assert.equal(findAccountByEmailAny(db, email).referral_source, "instagram");
});

test("registration still rejects an unknown referralSource", async () => {
  const res = await register("unknown-src@example.test", "tiktok");
  assert.equal(res.status, 400);
});
