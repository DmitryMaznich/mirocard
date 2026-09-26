// Resend отвечает 429 → сервер обязан сообщить об этом в канал ошибок
// (ERROR_REPORTING_WEBHOOK_URL), без email адресата в payload.
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

const resendCalls = [];
const fakeResend = await listen((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c)).on("end", () => {
    resendCalls.push(JSON.parse(body));
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: `rate limited for ${JSON.parse(body).to}` }));
  });
});

const reports = [];
const errorSink = await listen((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c)).on("end", () => {
    reports.push(body);
    res.end("ok");
  });
});

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-email-fail-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-email-fail-dist-"));
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
process.env.ERROR_REPORTING_WEBHOOK_URL = urlOf(errorSink, "/report");

const { router } = await import("../server.mjs");
const app = await listen(router);
test.after(() => { app.close(); fakeResend.close(); errorSink.close(); });

async function waitFor(pred, ms = 3000) {
  const until = Date.now() + ms;
  while (Date.now() < until) { if (pred()) return; await new Promise((r) => setTimeout(r, 25)); }
  throw new Error("condition not met in time");
}

test("verification email failure reaches the error webhook without PII", async () => {
  const email = "email-fail@example.test";
  const res = await fetch(urlOf(app, "/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery", firstName: "T", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  assert.equal(res.status, 201);
  await waitFor(() => resendCalls.length === 1 && reports.length >= 1);

  assert.equal(resendCalls[0].to, email, "request went to RESEND_API_URL");
  const report = JSON.parse(reports[0]);
  assert.equal(report.context.scope, "email");
  assert.equal(report.context.kind, "verification");
  assert.equal(report.context.status, 429);
  assert.ok(!reports[0].includes("@"), "no email address in the error report");
});
