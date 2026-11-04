import { test } from "node:test";
import assert from "node:assert/strict";
process.env.RESEND_API_KEY = "test-only-key";
const { sendDeletionSurveyEmail } = await import("../lib/mailer.mjs");
const { buildDeletionSurveyEmail } = await import("../lib/deletion-survey-email.mjs");

test("survey uses the approved sender/reply destination, idempotency and a real provider receipt", async () => {
  const original = globalThis.fetch;
  const payload = buildDeletionSurveyEmail({ email: "anna@example.test", first_name: "Анна", created_at: "2026-11-03T10:00:00Z" }, "2026-11-03T10:05:00Z");
  let request;
  globalThis.fetch = async (_url, init) => { request = init; return { ok: true, json: async () => ({ id: "provider-receipt" }) }; };
  try {
    assert.equal(await sendDeletionSurveyEmail(payload, "one-stable-key"), "provider-receipt");
    const body = JSON.parse(request.body);
    assert.equal(request.headers["Idempotency-Key"], "one-stable-key");
    assert.equal(body.from, "Дмитрий из Mironium <hello@mironium.com>");
    assert.equal(body.reply_to, "dmaznichenko@gmail.com");
    assert.equal(body.to, "anna@example.test");
    assert.ok(request.signal);
  } finally { globalThis.fetch = original; }
});
