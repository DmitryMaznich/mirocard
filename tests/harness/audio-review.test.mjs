import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "@playwright/test";
import { ALL_AUDIO_KEYS, AUDIO_REVISIONS, audioKeyUrl } from "../../src/topics/renderers/addition_subtraction/audioNumbers.js";

test("approved audio revisions match the installed recordings and their playback URLs", async () => {
  for (const [key, revision] of Object.entries(AUDIO_REVISIONS)) {
    const bytes = await readFile(resolve(`public/audio/addition-subtraction/${key}.mp3`));
    assert.equal(createHash("sha256").update(bytes).digest("hex").slice(0, 16), revision, key);
    assert.equal(audioKeyUrl(key), `/audio/addition-subtraction/${key}.mp3?v=${revision}`);
  }
});

test("audio reviewer: real playback, filtered ratings, persistence, reports, local files and mobile", { timeout: 60_000 }, async () => {
  const publicDir = resolve("public");
  const server = createServer(async (request, response) => {
    try {
      const path = resolve(publicDir, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
      if (!path.startsWith(publicDir + "/") && !path.startsWith(publicDir + "\\")) { response.writeHead(403).end(); return; }
      const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".mp3": "audio/mpeg" };
      response.setHeader("Content-Type", types[extname(path)] ?? "application/octet-stream");
      response.end(await readFile(path));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/audio-review.html`);
    await page.waitForFunction(() => document.querySelectorAll(".track").length === 31);
    const manifest = JSON.parse(await readFile(resolve(publicDir, "audio-review-manifest.json"), "utf8"));
    const numbers = manifest.playlists.find((entry) => entry.id === "audio/addition-subtraction").items.filter((item) => ["Числа", "Знаки"].includes(item.category));
    assert.deepEqual(numbers.map((item) => item.key).sort(), [...ALL_AUDIO_KEYS].sort());
    assert.equal(await page.locator(".track-label").nth(2).textContent(), "2 — два");
    await page.locator("#repeat").click();
    await page.waitForFunction(() => document.getElementById("audio").currentTime > 0.05);
    // Test navigation deterministically without waiting for each real clip.
    await page.evaluate(() => { HTMLMediaElement.prototype.play = async function () {}; });
    await page.locator("#advance").uncheck();
    await page.locator("#note").fill("Неверное ударение");
    await page.locator("#redo").click();
    assert.match(await page.locator("#totals").textContent(), /переделать 1/);
    await page.locator("#search").fill("n100.mp3");
    assert.equal(await page.locator(".track").count(), 1);
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#json-export").click()]);
    const report = JSON.parse(await readFile(await download.path(), "utf8"));
    assert.equal(report.items.length, 47);
    assert.equal(report.items.find((entry) => entry.key === "n0").note, "Неверное ударение");
    assert.equal(report.items.find((entry) => entry.key === "n0").status, "redo");
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll(".track").length === 31);
    assert.equal(await page.locator("#note").inputValue(), "Неверное ударение");
    await page.locator("#filter").selectOption("pending");
    assert.equal(await page.locator(".track").count(), 30);
    await page.locator("#advance").check();
    await page.locator("#ok").click();
    assert.equal(await page.locator("#title").textContent(), "2 — два");
    assert.equal(await page.locator(".track").count(), 29);
    await page.locator("#continuous").check();
    await page.locator("#gap").selectOption("1000");
    await page.evaluate(() => document.getElementById("audio").dispatchEvent(new Event("ended")));
    await page.waitForFunction(() => document.getElementById("title").textContent === "3 — три");
    // Changing the filter cancels a scheduled next track.
    await page.evaluate(() => document.getElementById("audio").dispatchEvent(new Event("ended")));
    await page.locator("#filter").selectOption("redo");
    await page.waitForTimeout(1100);
    assert.equal(await page.locator("#title").textContent(), "0 — ноль");
    // A replacement recording must be reviewed again, even at the same path.
    await page.route("**/audio-review-manifest.json", (route) => {
      const updated = structuredClone(manifest);
      updated.playlists[0].items.find((item) => item.key === "n0").version = "new-recording";
      return route.fulfill({ json: updated });
    });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll(".track").length === 31);
    assert.equal(await page.locator("#note").inputValue(), "");
    assert.equal(await page.locator("#redo").getAttribute("aria-pressed"), "false");
    await page.unroute("**/audio-review-manifest.json");
    for (const [id, expectedKeys] of [
      ["audio/addition-subtraction-review", ["n1", "n3", "n4", "n5", "n6", "plus"]],
      ["audio/addition-subtraction-russian-review", ["n1", "n3", "n4", "n5", "n6"]],
    ]) {
      const replacements = manifest.playlists.find((entry) => entry.id === id);
      if (!replacements) continue;
      assert.deepEqual(replacements.items.map((item) => item.key), expectedKeys);
      await page.locator("#playlist").selectOption(replacements.id);
      assert.equal(await page.locator(".track").count(), expectedKeys.length);
      const durations = await page.evaluate(async (urls) => {
        const context = new AudioContext();
        try {
          const results = [];
          for (const url of urls) {
            const data = await (await fetch(url)).arrayBuffer();
            const buffer = await context.decodeAudioData(data);
            results.push(buffer.duration);
          }
          return results;
        } finally { await context.close(); }
      }, replacements.items.map((item) => item.url));
      assert.ok(durations.every((seconds) => seconds > 0.3 && seconds < 4));
    }
    await page.locator("#playlist").selectOption("audio/daily-orientation");
    assert.ok(await page.locator(".track").count() > 100);
    await page.locator("#files").setInputFiles(resolve(publicDir, "audio/addition-subtraction/n10.mp3"));
    assert.equal(await page.locator(".track").count(), 1);
    assert.equal(await page.locator("#title").textContent(), "n10");
    await page.locator("#redo").click();
    await page.locator("#files").setInputFiles(resolve(publicDir, "audio/addition-subtraction/n10.mp3"));
    assert.equal(await page.locator("#redo").getAttribute("aria-pressed"), "true");
    await page.locator("#playlist").selectOption("audio/addition-subtraction");
    await mkdir("output/audio-review", { recursive: true });
    await page.screenshot({ path: "output/audio-review/desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.evaluate(() => window.scrollTo(0, 0));
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);
    await page.screenshot({ path: "output/audio-review/mobile.png", fullPage: true });
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise((done) => server.close(done));
  }
});
