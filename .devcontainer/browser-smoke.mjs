import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const appUrl = "http://localhost:8080";
const env = { ...process.env };
delete env.CODESPACE_NAME;
const child = spawn(process.execPath, [".devcontainer/start.mjs"], { env, stdio: "inherit" });
let browser;
let page;
const errors = [];
let hmrSource;
const hmrPath = "src/features/account/LoginScreen.jsx";
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error("Development server exited");
    try { ready = (await fetch(`${appUrl}/api/healthz`)).ok; } catch { /* startup */ }
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, "Development server must start");
  browser = await chromium.launch();
  const context = await browser.newContext();
  page = await context.newPage();
  page.setDefaultNavigationTimeout(90000);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 80,
    downloadThroughput: 2 * 1024 * 1024, uploadThroughput: 1024 * 1024,
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#splash").waitFor({ state: "hidden", timeout: 60000 });
  console.log("DEV_LOAD_METRICS", JSON.stringify(await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    return {
      elapsedMs: Math.round(performance.now()),
      requests: resources.length,
      scripts: resources.filter((r) => r.initiatorType === "script").length,
      bytes: resources.reduce((sum, r) => sum + r.transferSize, 0),
    };
  })));
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0,
    "Development must not install a service worker");
  hmrSource = readFileSync(hmrPath, "utf8");
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  writeFileSync(hmrPath, `${hmrSource}\nglobalThis.__mirocardHmrProbe = "updated";\n`);
  await page.waitForFunction(() => globalThis.__mirocardHmrProbe === "updated", null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => performance.timeOrigin), timeOrigin, "Code edits must hot-update without a page reload");
  writeFileSync(hmrPath, hmrSource);
  hmrSource = undefined;
  const email = `browser-${Date.now()}@example.test`;
  const response = await context.request.post(`${appUrl}/api/auth/register`, {
    data: { email, password: "Codespaces-browser-123", firstName: "Browser", role: "parent", referralSource: "other", consentPersonalData: true },
  });
  assert.equal(response.status(), 201, await response.text());
  for (let attempt = 0; attempt < 50; attempt++) {
    const messages = await (await fetch("http://127.0.0.1:4311/messages")).json();
    if (messages.some((message) => String(message.to).includes(email))) break;
    await delay(100);
  }
  await page.goto(`${appUrl}/__dev/mail`, { waitUntil: "domcontentloaded" });
  await page.locator('a[href*="/verify-email?token="]').first().click();
  await page.locator("#splash").waitFor({ state: "hidden", timeout: 60000 });
  await page.getByText("Email подтверждён!", { exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Перейти в приложение", exact: true }).click();
  console.log("Browser verification passed: dev inbox link, splash dismissal, email confirmation and entry into the app.");
  assert.deepEqual(errors, [], "Browser must not report runtime errors");
} catch (error) {
  console.error("Browser errors:", errors);
  if (page) {
    console.error("Visible text:", await page.locator("body").innerText().catch(() => "unavailable"));
    mkdirSync("output", { recursive: true });
    await page.screenshot({ path: "output/codespaces-browser.png", fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  if (hmrSource !== undefined) writeFileSync(hmrPath, hmrSource);
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 8000);
    try { await exited; } finally { clearTimeout(timer); }
  }
}
