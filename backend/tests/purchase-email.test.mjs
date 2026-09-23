import { test } from "node:test";
import assert from "node:assert/strict";

// RESEND_API_KEY must be set before mailer.mjs is imported so the real
// (stubbed) fetch path runs instead of the dev-mode console.log no-op.
process.env.RESEND_API_KEY = "test_resend_key";
process.env.APP_BASE_URL = "https://app.example.test";

const { sendPurchaseConfirmationEmail } = await import("../lib/mailer.mjs");

async function capture(args) {
  const originalFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ id: "email_1" }) };
  };
  try {
    await sendPurchaseConfirmationEmail("buyer@example.test", args);
  } finally {
    globalThis.fetch = originalFetch;
  }
  return body;
}

const PURCHASE = { plan: "annual", amountMinor: 8990, currency: "EUR", endsAt: "2027-09-24T10:00:00.000Z", legalDocsVersion: "2026-10-01" };

test("purchase email defaults to Russian and confirms the withdrawal-right waiver", async () => {
  const body = await capture(PURCHASE);
  assert.equal(body.subject, "Оплата получена — Mironium");
  assert.match(body.text, /План: Год/);
  assert.match(body.text, /утрачиваете право на отказ/);
  assert.match(body.text, /версия 2026-10-01\): https:\/\/app\.example\.test\/terms/);
  assert.match(body.text, /Smart Washing d\.o\.o\./);
});

test("purchase email in Slovenian uses Slovenian text, dates and /sl legal links", async () => {
  const body = await capture({ ...PURCHASE, locale: "sl" });
  assert.equal(body.subject, "Plačilo prejeto — Mironium");
  assert.match(body.text, /Paket: Leto/);
  assert.match(body.text, /Znesek \(z DDV\): 89\.90 EUR/);
  assert.match(body.text, /izgubite pravico do odstopa/);
  assert.match(body.text, /september 2027/);
  assert.match(body.text, /različica 2026-10-01\): https:\/\/app\.example\.test\/sl\/terms/);
  assert.match(body.html, /href="https:\/\/app\.example\.test\/sl\/refunds"/);
  assert.doesNotMatch(body.text, /[А-Яа-я]/, "no Russian text leaks into the Slovenian email");
});

test("an unknown locale falls back to Russian", async () => {
  const body = await capture({ ...PURCHASE, locale: "xx" });
  assert.equal(body.subject, "Оплата получена — Mironium");
});
