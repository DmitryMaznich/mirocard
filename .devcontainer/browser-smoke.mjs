import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const appUrl = "http://127.0.0.1:8080";
const env = { ...process.env };
delete env.CODESPACE_NAME;
const child = spawn(process.execPath, [".devcontainer/start.mjs"], { env, stdio: "inherit" });
let browser;
let page;
const errors = [];
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
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#splash").waitFor({ state: "hidden", timeout: 60000 });
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
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 8000);
    try { await exited; } finally { clearTimeout(timer); }
  }
}
