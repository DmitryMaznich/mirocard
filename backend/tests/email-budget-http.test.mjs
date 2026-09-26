// HTTP behaviour of the daily email budget: email signup pauses at the
// signup cap (before an account is created), the reserve up to the daily cap
// stays open for resend/reset, and after that those answer 503.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function listen(handler) {
  const srv = createServer(handler);
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
const urlOf = (srv, p = "") => `http://127.0.0.1:${srv.address().port}${p}`;

const fakeResend = await listen((req, res) => {
  req.resume();
  req.on("end", () => { res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}"); });
});

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-email-budget-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-email-budget-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.RESEND_API_URL = urlOf(fakeResend, "/emails");
process.env.EMAIL_DAILY_CAP = "3";
process.env.EMAIL_SIGNUP_CAP = "2";
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny } = await import("../lib/account-repository.mjs");
const app = await listen(router);
test.after(() => { app.close(); fakeResend.close(); });

const post = (p, body, ip = "10.0.0.99") => fetch(urlOf(app, p), {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
  body: JSON.stringify(body),
});
const reg = (email, ip) => post("/api/auth/register", {
  email, password: "correct horse battery", firstName: "T", role: "parent", referralSource: "other", consentPersonalData: true,
}, ip);
const settle = () => new Promise((r) => setTimeout(r, 150));

test("signup-status reports open email signup and the Google client id", async () => {
  const s = await (await fetch(urlOf(app, "/api/auth/signup-status"))).json();
  assert.deepEqual(s, { emailSignupOpen: true, google: { clientId: "test-client.apps.googleusercontent.com" } });
});

test("email signup pauses at the signup cap without creating an account", async () => {
  assert.equal((await reg("b1@example.test", "10.0.0.1")).status, 201); await settle();
  assert.equal((await reg("b2@example.test", "10.0.0.2")).status, 201); await settle();
  const r = await reg("b3@example.test", "10.0.0.3");
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "signup_paused_email_budget");
  assert.equal(findAccountByEmailAny(db, "b3@example.test") ?? null, null);
  const s = await (await fetch(urlOf(app, "/api/auth/signup-status"))).json();
  assert.equal(s.emailSignupOpen, false);
});

test("resend still works in the reserve, then forgot-password answers 503", async () => {
  assert.equal((await post("/api/auth/resend-verification", { email: "b1@example.test" })).status, 200);
  await settle();
  const r = await post("/api/auth/forgot-password", { email: "b2@example.test" });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "email_budget_exhausted");
});
