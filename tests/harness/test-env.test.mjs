import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const APP = "http://127.0.0.1:4320";
const MAIL = "http://127.0.0.1:4321";

async function waitUp(url, ms = 180000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${url} did not come up`);
}

const proc = spawn(process.execPath, ["scripts/test-env/run-prod-like.mjs", "--app-port", "4320", "--mail-port", "4321"], { stdio: "inherit" });
// On Windows killing the parent leaves backend/server.mjs orphaned on the port.
test.after(() => (process.platform === "win32" ? spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"]) : proc.kill()));

test("prod-like env: SPA served, register → verification mail captured → verify → token", async () => {
  await waitUp(`${APP}/api/healthz`);
  const html = await (await fetch(`${APP}/`)).text();
  assert.match(html, /<div id="root"/);

  const email = "harness@example.test";
  const reg = await fetch(`${APP}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery", firstName: "H", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  assert.equal(reg.status, 201);

  let msgs = [];
  for (let i = 0; i < 30 && msgs.length === 0; i++) {
    msgs = await (await fetch(`${MAIL}/messages?to=${encodeURIComponent(email)}`)).json();
    if (!msgs.length) await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(msgs.length, 1);
  const link = new URL(msgs[0].text.match(/https?:\/\/\S+\/verify-email\?token=\S+/)[0]);
  assert.equal(link.origin, APP, "link points at the test app, not production");

  const ver = await fetch(`${APP}/api/auth/verify-email?token=${link.searchParams.get("token")}`);
  assert.equal(ver.status, 200);
  assert.ok((await ver.json()).token);
});
