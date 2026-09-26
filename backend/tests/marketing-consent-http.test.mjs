// Marketing consent over HTTP: the signup checkbox is journaled, and the
// settings/prompt endpoint toggles it and rejects unknown sources.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-marketing-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-marketing-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny, activateAccount } = await import("../lib/account-repository.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const PASSWORD = "correct horse battery staple";
async function register(email, extra = {}) {
  return fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ email, password: PASSWORD, firstName: "Test", role: "parent", referralSource: "other", consentPersonalData: true, ...extra }),
  });
}
async function registerAndLogin(email, extra) {
  await register(email, extra);
  activateAccount(db, findAccountByEmailAny(db, email).id);
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await r.json()).token;
}
const events = (email) => db.prepare("SELECT action, source FROM marketing_consent_events WHERE account_id = ? ORDER BY id")
  .all(findAccountByEmailAny(db, email).id).map((e) => ({ ...e }));

test("signup with the news checkbox journals a grant and answers the prompt", async () => {
  assert.equal((await register("yes@example.test", { marketingOptIn: true })).status, 201);
  assert.deepEqual(events("yes@example.test"), [{ action: "grant", source: "register" }]);
  const row = findAccountByEmailAny(db, "yes@example.test");
  assert.equal(row.marketing_opt_in, 1);
  assert.ok(row.marketing_prompt_answered_at);
});

test("signup without the checkbox is not opted in and is not asked again later", async () => {
  assert.equal((await register("no@example.test")).status, 201);
  assert.deepEqual(events("no@example.test"), []);
  const row = findAccountByEmailAny(db, "no@example.test");
  assert.equal(row.marketing_opt_in, 0);
  assert.ok(row.marketing_prompt_answered_at);
});

test("PATCH /account/marketing toggles and rejects unknown source", async () => {
  const token = await registerAndLogin("mk@example.test");
  const patch = (body) => fetch(`${base}/api/account/marketing`, {
    method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  const ok = await patch({ optIn: true, source: "settings" });
  assert.equal(ok.status, 200);
  const { account } = await ok.json();
  assert.equal(account.marketingOptIn, true);
  assert.equal(account.marketingPromptAnswered, true);
  assert.equal((await patch({ optIn: true, source: "evil" })).status, 400);
});

test("PATCH /account/marketing requires auth", async () => {
  const r = await fetch(`${base}/api/account/marketing`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optIn: true, source: "settings" }) });
  assert.equal(r.status, 401);
});
