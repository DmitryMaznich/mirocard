// Free landing PDFs: catalog, email request -> link in the mail -> download,
// plus the guards that keep this lead form from eating the signup email budget.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function listen(handler) {
  const srv = createServer(handler);
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve(srv)));
}
const urlOf = (srv, p = "") => `http://127.0.0.1:${srv.address().port}${p}`;

const sentMails = [];
const fakeResend = await listen((req, res) => {
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    sentMails.push(JSON.parse(raw));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
  });
});

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-materials-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-materials-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";
process.env.APP_BASE_URL = "http://app.test";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.RESEND_API_URL = urlOf(fakeResend, "/emails");
process.env.EMAIL_DAILY_CAP = "90";
process.env.EMAIL_MATERIALS_CAP = "8";
delete process.env.CORS_ALLOWED_ORIGINS; // exercise the built-in default list

const { router } = await import("../server.mjs");
const app = await listen(router);
test.after(() => { app.close(); fakeResend.close(); });

const MATERIALS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "materials");
const catalogOnDisk = JSON.parse(readFileSync(path.join(MATERIALS_DIR, "catalog.json"), "utf8")).materials;

const request = (email, materialId, ip) => fetch(urlOf(app, "/api/materials/request"), {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
  body: JSON.stringify({ email, materialId }),
});
const settle = () => new Promise((r) => setTimeout(r, 150));

test("every catalog entry points at a PDF that ships with the backend", () => {
  assert.ok(catalogOnDisk.length > 0);
  for (const m of catalogOnDisk) {
    assert.ok(statSync(path.join(MATERIALS_DIR, m.file)).size > 0, m.file);
    assert.match(m.id, /^[a-z0-9-]+$/);
    assert.ok(["speech", "literacy", "math"].includes(m.category), m.id);
  }
});

test("catalog lists every material without exposing file names", async () => {
  const res = await fetch(urlOf(app, "/api/materials/catalog"));
  assert.equal(res.status, 200);
  const { materials } = await res.json();
  assert.equal(materials.length, catalogOnDisk.length);
  for (const m of materials) assert.deepEqual(Object.keys(m).sort(), ["category", "description", "id", "title"]);
});

test("the landing origins are allowed by default CORS, including the preflight", async () => {
  for (const origin of ["https://www.mironium.com", "https://mironium.com"]) {
    const res = await fetch(urlOf(app, "/api/materials/request"), { method: "OPTIONS", headers: { Origin: origin } });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), origin);
  }
});

test("bad email and unknown material are rejected without sending anything", async () => {
  assert.equal((await request("not-an-email", catalogOnDisk[0].id, "10.1.0.1")).status, 400);
  assert.equal((await request("a@example.test", "no-such-pdf", "10.1.0.1")).status, 404);
  await settle();
  assert.equal(sentMails.length, 0);
});

test("a request mails a link that downloads the PDF; a bad token does not", async () => {
  const m = catalogOnDisk[0];
  const res = await request("reader@example.test", m.id, "10.1.0.2");
  assert.equal(res.status, 200);
  await settle();
  assert.equal(sentMails.length, 1);
  const mail = sentMails[0];
  assert.equal(mail.to, "reader@example.test");
  const link = mail.text.match(/http:\/\/app\.test\/api\/materials\/download\?token=\S+/)?.[0];
  assert.ok(link, "download link in the email");

  const pdf = await fetch(urlOf(app, new URL(link).pathname + new URL(link).search));
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal((await pdf.arrayBuffer()).byteLength, statSync(path.join(MATERIALS_DIR, m.file)).size);

  assert.equal((await fetch(urlOf(app, "/api/materials/download?token=forged"))).status, 400);
});

test("one address gets at most 5 requests an hour", async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal((await request("same@example.test", catalogOnDisk[0].id, "10.1.0.3")).status, 200);
    await settle();
  }
  assert.equal((await request("same@example.test", catalogOnDisk[0].id, "10.1.0.3")).status, 429);
});

test("materials stop at their own cap, below the daily budget", async () => {
  // 6 sent so far; the cap is 8.
  assert.equal((await request("c1@example.test", catalogOnDisk[0].id, "10.1.0.4")).status, 200); await settle();
  assert.equal((await request("c2@example.test", catalogOnDisk[0].id, "10.1.0.4")).status, 200); await settle();
  const r = await request("c3@example.test", catalogOnDisk[0].id, "10.1.0.4");
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "email_budget_exhausted");
  assert.equal(sentMails.length, 8);
});

test("one IP cannot fire more than 15 requests an hour", async () => {
  for (let i = 0; i < 15; i++) {
    assert.notEqual((await request(`ip${i}@example.test`, catalogOnDisk[0].id, "10.1.0.5")).status, 429);
  }
  assert.equal((await request("ip-last@example.test", catalogOnDisk[0].id, "10.1.0.5")).status, 429);
});
