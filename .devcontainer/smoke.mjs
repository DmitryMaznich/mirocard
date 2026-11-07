// Integration check: real Vite + backend + SQLite + local mail, including restart.
// Run only in an isolated checkout (CI), not in an active personal Codespace.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const baseUrl = "http://127.0.0.1:8080";
const config = JSON.parse(readFileSync(new URL("devcontainer.json", import.meta.url), "utf8"));
assert.deepEqual(config.forwardPorts, [8080]);
assert.equal(config.portsAttributes[8080].visibility, "private");
const stateDir = path.join(root, "runtime/codespaces");
assert.ok(!existsSync(path.join(stateDir, "data/mirocard.db")), "Use a clean checkout; this check creates test data");
let child;
let logs = "";
function start() {
  logs = "";
  child = spawn(process.execPath, [".devcontainer/start.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      CODESPACE_NAME: "mirocard-smoke",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      // These must be overridden/removed by the isolated dev launcher.
      RAILWAY_ENVIRONMENT: "must-not-reach-backend",
      MIROCARD_DATA_DIR: "/must-not-write-here",
      VITE_API_URL: "https://production-must-not-be-used.invalid/api",
      RESEND_API_URL: "https://production-must-not-be-used.invalid/emails",
      GOOGLE_CLIENT_ID: "must-not-reach-backend",
      LEGAL_DOCS_VERSION: "must-not-enable-checkout",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => { logs += data; });
}
async function request(url, options) {
  return fetch(`${baseUrl}${url}`, { ...options, signal: AbortSignal.timeout(3000) });
}
async function waitFor(probe) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Dev process exited:\n${logs}`);
    try { const value = await probe(); if (value) return value; } catch { /* startup */ }
    await delay(250);
  }
  throw new Error(`Dev startup/check timed out:\n${logs}`);
}
async function ready() {
  await waitFor(async () => {
    const response = await request("/api/healthz");
    return response.ok && (await response.json()).db;
  });
}
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const timeout = setTimeout(() => child.kill("SIGKILL"), 8000);
  try { await exited; } finally { clearTimeout(timeout); }
}
const email = "codespaces-smoke@example.test";
try {
  start();
  await ready();
  assert.equal((await request("/")).status, 200);
  const catalog = await (await request("/api/decks/catalog")).json();
  assert.ok(catalog.decks.length > 0, "Catalog must load from public/decks");
  const status = await (await request("/api/auth/signup-status")).json();
  assert.equal(status.google, null);
  assert.equal(status.checkoutEnabled, false);
  const source = await (await request("/src/core/api.js")).text();
  assert.ok(!source.includes("production-must-not-be-used.invalid"));
  const register = await request("/api/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Codespaces-test-123", firstName: "Test", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  assert.equal(register.status, 201, await register.text());
  const inbox = await waitFor(async () => {
    const response = await request("/__dev/mail");
    const text = await response.text();
    return text.includes(email) && text;
  });
  assert.ok(inbox.includes("https://mirocard-smoke-8080.app.github.dev/"), "Mail must link to the Codespace");
  const secrets = readFileSync(path.join(stateDir, "secrets.json"), "utf8");
  assert.ok(existsSync(path.join(stateDir, "data/mirocard.db")));
  await stop();
  start();
  await ready();
  assert.equal(readFileSync(path.join(stateDir, "secrets.json"), "utf8"), secrets);
  const login = await request("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Codespaces-test-123" }),
  });
  assert.equal(login.status, 403);
  assert.equal((await login.json()).error, "email_not_verified", "Account must survive restart");
  console.log("Codespaces smoke passed: app, API, catalog, mail, credential isolation, persistent database and restart.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await stop();
}
