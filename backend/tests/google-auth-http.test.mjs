// Google sign-in over HTTP: callback (CSRF + token check) → one-time code →
// exchange → either a session or the "one more step" signup that creates the
// account only after personal-data consent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CLIENT, startJwks, makeIdToken } from "./helpers/google-token.mjs";

const jwks = await startJwks();
const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-google-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-google-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";
process.env.GOOGLE_CLIENT_ID = CLIENT;
process.env.GOOGLE_JWKS_URL = jwks.url;

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny } = await import("../lib/account-repository.mjs");
const server = createServer(router);
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => { server.close(); jwks.close(); });

async function callback(token, { csrf = "c1", cookieCsrf = "c1" } = {}) {
  const r = await fetch(`${base}/api/auth/google/callback`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: `g_csrf_token=${cookieCsrf}` },
    body: new URLSearchParams({ credential: token, g_csrf_token: csrf }).toString(),
  });
  const setCookie = r.headers.get("set-cookie") || "";
  const nonce = setCookie.match(/mc_google_nonce=([^;]+)/)?.[1] ?? null;
  return { status: r.status, location: r.headers.get("location"), cookie: nonce ? `mc_google_nonce=${nonce}` : "" };
}
const codeOf = (loc) => new URL(loc, base).searchParams.get("google_code");
const postJson = (p, body) => fetch(`${base}/api${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const exchange = (code, cookie) => fetch(`${base}/api/auth/google/exchange`, {
  method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify({ code }),
});
const completeSignup = (body) => postJson("/auth/google/complete-signup", { role: "parent", referralSource: "other", ...body });

test("CSRF mismatch is rejected", async () => {
  const r = await callback(makeIdToken({ sub: "s-csrf" }), { csrf: "a", cookieCsrf: "b" });
  assert.equal(r.status, 303);
  assert.match(r.location, /google_error=csrf/);
});

test("invalid token redirects with an error and no code", async () => {
  const r = await callback(makeIdToken({ aud: "someone-else" }));
  assert.match(r.location, /google_error=bad_audience/);
  assert.equal(codeOf(r.location), null);
});

test("new person: needsProfile, no account until complete-signup with consent", async () => {
  const r = await callback(makeIdToken({ sub: "s-new", email: "new@example.test" }));
  assert.equal(r.status, 303);
  const ex = await (await exchange(codeOf(r.location), r.cookie)).json();
  assert.equal(ex.needsProfile, true);
  assert.equal(ex.email, "new@example.test");
  assert.equal(ex.firstName, "Галя");
  assert.equal(findAccountByEmailAny(db, "new@example.test") ?? null, null);

  const noConsent = await completeSignup({ signupCode: ex.signupCode, consentPersonalData: false });
  assert.equal(noConsent.status, 400);
  assert.equal(findAccountByEmailAny(db, "new@example.test") ?? null, null);

  // A rejected attempt does not spend the signup code.
  const done = await completeSignup({ signupCode: ex.signupCode, consentPersonalData: true, marketingOptIn: true });
  assert.equal(done.status, 201);
  const body = await done.json();
  assert.ok(body.token);
  assert.equal(body.account.email, "new@example.test");
  assert.equal(body.account.marketingOptIn, true);
  const row = findAccountByEmailAny(db, "new@example.test");
  assert.equal(row.status, "active");
  assert.ok(row.consent_personal_data_at);
  const grants = db.prepare("SELECT source FROM marketing_consent_events WHERE account_id = ?").all(row.id).map((e) => e.source);
  assert.deepEqual(grants, ["google_signup"]);
});

test("the signup code cannot be used twice", async () => {
  const r = await callback(makeIdToken({ sub: "s-twice", email: "twice@example.test" }));
  const ex = await (await exchange(codeOf(r.location), r.cookie)).json();
  assert.equal((await completeSignup({ signupCode: ex.signupCode, consentPersonalData: true })).status, 201);
  assert.equal((await completeSignup({ signupCode: ex.signupCode, consentPersonalData: true })).status, 400);
});

test("second login by the same Google subject goes straight in", async () => {
  const r = await callback(makeIdToken({ sub: "s-new", email: "new@example.test" }));
  const ex = await (await exchange(codeOf(r.location), r.cookie)).json();
  assert.ok(ex.token);
  assert.equal(ex.account.email, "new@example.test");
});

test("the exchange code is single-use", async () => {
  const r = await callback(makeIdToken({ sub: "s-new", email: "new@example.test" }));
  const code = codeOf(r.location);
  assert.equal((await exchange(code, r.cookie)).status, 200);
  const again = await exchange(code, r.cookie);
  assert.equal(again.status, 400);
  assert.equal((await again.json()).error, "invalid_or_expired_code");
});

test("a pending account someone else pre-registered is taken over cleanly via Google", async () => {
  // Attacker registers the victim's address with their own password and never verifies it.
  await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.9.9.9" },
    body: JSON.stringify({ email: "pend@example.test", password: "attacker password 1", firstName: "Злоумышленник", role: "specialist", referralSource: "friend", consentPersonalData: true }),
  });
  const before = findAccountByEmailAny(db, "pend@example.test");
  assert.equal(before.status, "pending");

  // The real owner signs in with Google: they must answer the questions and consent themselves.
  const r = await callback(makeIdToken({ sub: "s-pend", email: "pend@example.test", given_name: "Вера", family_name: "В" }));
  const ex = await (await exchange(codeOf(r.location), r.cookie)).json();
  assert.equal(ex.needsProfile, true);
  const done = await completeSignup({ signupCode: ex.signupCode, consentPersonalData: true });
  assert.equal(done.status, 201);
  const body = await done.json();

  assert.equal(body.account.id, before.id, "same account, no duplicate");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM accounts WHERE email = ?").get("pend@example.test").c, 1);
  const row = findAccountByEmailAny(db, "pend@example.test");
  assert.equal(row.status, "active");
  assert.equal(row.first_name, "Вера");
  assert.equal(row.role, "parent");
  assert.ok(row.consent_personal_data_at > before.consent_personal_data_at, "consent re-recorded by the owner");
  const login = await postJson("/auth/login", { email: "pend@example.test", password: "attacker password 1" });
  assert.equal(login.status, 401, "the pre-registered password no longer works");
});

test("the exchange refuses a code without the cookie of the browser that went through Google", async () => {
  const r = await callback(makeIdToken({ sub: "s-new", email: "new@example.test" }));
  assert.ok(r.cookie, "callback sets a nonce cookie");
  const stolen = await exchange(codeOf(r.location));
  assert.equal(stolen.status, 400);
  assert.equal((await exchange(codeOf(r.location), "mc_google_nonce=forged")).status, 400);
});

test("a Google-only account cannot log in with an empty password", async () => {
  const r = await postJson("/auth/login", { email: "new@example.test", password: "" });
  assert.equal(r.status, 401);
});
