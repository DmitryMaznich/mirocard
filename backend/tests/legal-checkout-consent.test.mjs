// Exercises the opposite of legal.test.mjs's default: LEGAL_DOCS_VERSION
// is set to a real value here, as it would be once product/legal have
// signed off (see docs/legal-launch-inputs.md), so checkout can actually
// be attempted and its consent requirements tested.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-legal-consent-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-legal-consent-dist-"));
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
process.env.LEGAL_DOCS_VERSION = "2026-10-01-test";
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny, activateAccount } = await import("../lib/account-repository.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

let _n = 0;
async function registerAndLogin() {
  _n += 1;
  const email = `legal-consent-${_n}@example.test`;
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
  return { email, token };
}

test("checkout is refused with 400 when any consent is missing", async () => {
  const { token } = await registerAndLogin();
  const res = await fetch(`${base}/api/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      plan: "monthly", method: "card",
      consents: { termsAccepted: true, pricePeriodConfirmed: true /* digitalContentAck missing */ },
    }),
  });
  assert.equal(res.status, 400);
});

test("checkout is refused with 400 when consents are entirely absent", async () => {
  const { token } = await registerAndLogin();
  const res = await fetch(`${base}/api/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "monthly", method: "card" }),
  });
  assert.equal(res.status, 400);
});

test("a successful checkout records the consent, linked to the order and the current legal docs version", async () => {
  const { token } = await registerAndLogin();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.stripe.com")) {
      return { ok: true, json: async () => ({ id: "cs_test_1", url: "https://checkout.stripe.com/pay/cs_test_1" }) };
    }
    return originalFetch(url, init);
  };
  let checkoutBody;
  try {
    const res = await fetch(`${base}/api/billing/checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: "monthly", method: "card",
        consents: { termsAccepted: true, pricePeriodConfirmed: true, digitalContentAck: true },
      }),
    });
    assert.equal(res.status, 200);
    checkoutBody = await res.json();
  } finally {
    globalThis.fetch = originalFetch;
  }

  const order = db.prepare("SELECT * FROM orders WHERE external_contract_id = ?").get(checkoutBody.orderId);
  assert.ok(order);

  const consent = db.prepare("SELECT * FROM checkout_consents WHERE order_id = ?").get(order.id);
  assert.ok(consent, "checkout must have recorded a consent row");
  assert.equal(consent.legal_docs_version, "2026-10-01-test");
  assert.equal(consent.terms_accepted, 1);
  assert.equal(consent.price_period_confirmed, 1);
  assert.equal(consent.digital_content_ack, 1);
  assert.equal(consent.locale, "ru", "defaults to Russian when the client sends no locale");
});

test("checkout records a Slovenian consent locale when the client sends locale: \"sl\"; anything else falls back to ru", async () => {
  const { token } = await registerAndLogin();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.stripe.com")) {
      return { ok: true, json: async () => ({ id: "cs_test_sl", url: "https://checkout.stripe.com/pay/cs_test_sl" }) };
    }
    return originalFetch(url, init);
  };
  const locales = {};
  try {
    for (const sent of ["sl", "de"]) {
      const res = await fetch(`${base}/api/billing/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "monthly", method: "card", locale: sent,
          consents: { termsAccepted: true, pricePeriodConfirmed: true, digitalContentAck: true },
        }),
      });
      assert.equal(res.status, 200);
      const { orderId } = await res.json();
      const order = db.prepare("SELECT * FROM orders WHERE external_contract_id = ?").get(orderId);
      locales[sent] = db.prepare("SELECT locale FROM checkout_consents WHERE order_id = ?").get(order.id).locale;
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(locales, { sl: "sl", de: "ru" });
});
