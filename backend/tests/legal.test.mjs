// LEGAL_DOCS_VERSION is intentionally left unset here (defaults to
// "draft" -- see backend/lib/config.mjs) to exercise the "not yet
// configured for production" gate on checkout. See
// legal-checkout-consent.test.mjs for the opposite (finalized version)
// case, which needs its own process since config.mjs reads the env once
// at import time.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-legal-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-legal-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html><body>spa shell</body></html>");
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

const LEGAL_SLUGS = ["terms", "privacy", "refunds", "cancellation", "contact"];

for (const slug of LEGAL_SLUGS) {
  test(`GET /${slug} serves a real HTML document, not the SPA shell`, async () => {
    const res = await fetch(`${base}/${slug}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    const html = await res.text();
    assert.doesNotMatch(html, /spa shell/, "must not have fallen through to index.html");
    assert.match(html, /Версия документа: draft/);
  });
}

test("GET /terms via /api/terms also resolves (bare and /api-prefixed paths both route the same way)", async () => {
  const res = await fetch(`${base}/api/terms`);
  assert.equal(res.status, 200);
});

test("an unknown legal slug is not silently accepted", async () => {
  const res = await fetch(`${base}/not-a-real-legal-doc`);
  // Falls through to the SPA shell like any other unmatched non-API path --
  // sanity check that the legal-route matcher isn't overly permissive.
  assert.equal(res.status, 200);
  assert.match(await res.text(), /spa shell/);
});

test("POST /api/billing/checkout is refused while LEGAL_DOCS_VERSION is still \"draft\"", async () => {
  const email = "legal-draft-checkout@example.test";
  const password = "correct horse battery staple";
  await fetch(`${base}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "T", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  activateAccount(db, findAccountByEmailAny(db, email).id);
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { token } = await loginRes.json();

  const res = await fetch(`${base}/api/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      plan: "monthly", method: "card",
      consents: { termsAccepted: true, pricePeriodConfirmed: true, digitalContentAck: true },
    }),
  });
  assert.equal(res.status, 503);
});
