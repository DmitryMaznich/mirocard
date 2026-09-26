import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, findAccountByEmailAny, serializeAccount } from "../lib/account-repository.mjs";
import { setMarketingConsent, MARKETING_CONSENT_VERSION } from "../lib/marketing-consent.mjs";

function acc(db) {
  return createAccount(db, { email: `m${Math.random()}@example.test`, passwordHash: "x", firstName: "M", consentPersonalDataAt: new Date().toISOString() });
}
const reload = (db, a) => serializeAccount(findAccountByEmailAny(db, a.email));

test("new accounts are not opted in and have not answered the prompt", () => {
  const db = initDb(":memory:");
  const s = serializeAccount(acc(db));
  assert.equal(s.marketingOptIn, false);
  assert.equal(s.marketingPromptAnswered, false);
});

test("grant and withdraw are journaled with version and source", () => {
  const db = initDb(":memory:");
  const a = acc(db);
  setMarketingConsent(db, a.id, { optIn: true, source: "register" });
  setMarketingConsent(db, a.id, { optIn: false, source: "settings" });
  const events = db.prepare("SELECT action, text_version, source FROM marketing_consent_events WHERE account_id = ? ORDER BY id").all(a.id);
  assert.deepEqual(events.map((e) => ({ ...e })), [
    { action: "grant", text_version: MARKETING_CONSENT_VERSION, source: "register" },
    { action: "withdraw", text_version: MARKETING_CONSENT_VERSION, source: "settings" },
  ]);
  const s = reload(db, a);
  assert.equal(s.marketingOptIn, false);
  assert.equal(s.marketingPromptAnswered, true);
});

test("declining the prompt marks it answered without a grant event", () => {
  const db = initDb(":memory:");
  const a = acc(db);
  setMarketingConsent(db, a.id, { optIn: false, source: "prompt" });
  assert.equal(reload(db, a).marketingPromptAnswered, true);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM marketing_consent_events").get().c, 0);
});

test("unknown source is rejected", () => {
  const db = initDb(":memory:");
  const a = acc(db);
  assert.throws(() => setMarketingConsent(db, a.id, { optIn: true, source: "evil" }), (e) => e.status === 400);
});
