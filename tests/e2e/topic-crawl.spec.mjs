// Opens every catalog deck × every mode, takes a few "blind" steps (tap an
// answer button / type "1"), and records console errors, 5xx, white screens,
// error boundaries and a UI that does not react. Does NOT judge pedagogical
// correctness — that is the device checklist's job.
//
// Locators come from the reconnaissance recorded in helpers.mjs (journey block):
// mode list = listitem > button; session exit = "✕" → dialog "Завершить".
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  uniqueEmail, createVerifiedAccountViaApi, loginViaUi, collectPageErrors,
  addFirstStudent, openDeck, enterPinIfAsked,
} from "./helpers.mjs";

const catalog = JSON.parse(readFileSync(new URL("../../public/decks/catalog.json", import.meta.url), "utf8"));
// What a newcomer sees: the server hides non-"release" decks from accounts without that
// feature flag (handleGetDecksCatalog), and "hidden" decks are never listed.
const decks = catalog.decks.filter((d) => !d.hidden && (d.status ?? "release") === "release");
const STEPS_PER_MODE = 5;
// Not under output/e2e-report: the HTML reporter wipes that folder on every run.
const OUT = "output/e2e-crawl";
const NOT_ANSWERS = /^(✕|План занятия|Остаться|Завершить|\?|i)$/;

async function uiFingerprint(page) {
  return page.evaluate(() => document.body.innerText.length + ":" + document.body.innerText.slice(0, 300) + ":" + document.querySelectorAll("*").length);
}

async function blindStep(page, s) {
  const before = await uiFingerprint(page);
  const input = page.locator("input[type=text]:visible, input[type=number]:visible, input:not([type]):visible, textarea:visible").first();
  if (await input.count()) await input.fill("1").catch(() => {});
  const buttons = page.locator("button:visible:enabled");
  const n = await buttons.count();
  const candidates = [];
  for (let i = 0; i < n; i++) {
    const name = ((await buttons.nth(i).getAttribute("aria-label")) || (await buttons.nth(i).innerText().catch(() => ""))).trim();
    if (!NOT_ANSWERS.test(name)) candidates.push(i);
  }
  if (candidates.length) await buttons.nth(candidates[s % candidates.length]).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(900);
  return before !== (await uiFingerprint(page));
}

// Most decks: "2 Режим" → mode list. Reading decks: "2 Текст и режим" → pick a text
// first (plain list of buttons), then the same mode list. The crawl uses the first text.
async function openModeList(page) {
  await page.getByRole("button", { name: /режим/i }).first().click({ timeout: 15_000 });
  await page.waitForTimeout(800);
  if (!(await page.getByRole("listitem").count())) {
    await page.getByRole("list").getByRole("button").first().click();
  }
  await page.getByRole("listitem").first().waitFor({ timeout: 10_000 });
}

async function backToHome(page) {
  for (let i = 0; i < 3 && !(await page.locator(".home-header").isVisible().catch(() => false)); i++) {
    await page.getByRole("button").first().click();
    await page.waitForTimeout(600);
  }
}

// The app resumes an unfinished lesson on reload (by design), so "go to /" alone
// can land back inside it: exit via ✕ → "Завершить" until home is reached.
async function leaveSession(page) {
  for (let i = 0; i < 4; i++) {
    if (await page.locator(".home-header").isVisible().catch(() => false)) return;
    const x = page.getByRole("button", { name: "✕" });
    if (await x.isVisible().catch(() => false)) {
      await x.click({ timeout: 5000 }).catch(() => {});
      const finish = page.getByRole("button", { name: "Завершить" });
      if (await finish.isVisible({ timeout: 2000 }).catch(() => false)) await finish.click().catch(() => {});
      await page.waitForTimeout(1500);
      continue;
    }
    await page.goto("/");
    await page.waitForTimeout(2500);
  }
  await page.locator(".home-header").waitFor({ timeout: 10_000 });
}

test.describe.configure({ mode: "default" });

for (const deck of decks) {
  test(`crawl: ${deck.id}`, async ({ page }, info) => {
    test.setTimeout(10 * 60_000);
    const dir = `${OUT}/${info.project.name}`;
    mkdirSync(dir, { recursive: true });
    const results = [];
    const sink = collectPageErrors(page);

    const email = uniqueEmail(`crawl-${deck.id}`);
    await createVerifiedAccountViaApi({ email });
    await loginViaUi(page, { email });
    await page.locator(".home-header").waitFor({ timeout: 20_000 });
    await addFirstStudent(page);
    await openDeck(page, deck.title.ru);

    await openModeList(page);
    const modeCount = await page.getByRole("listitem").count();
    const modeNames = [];
    for (let m = 0; m < modeCount; m++) {
      modeNames.push(((await page.getByRole("listitem").nth(m).innerText()).split("\n")[0] || `mode ${m}`).trim());
    }
    await backToHome(page);
    expect(modeCount, `${deck.id}: no modes listed`).toBeGreaterThan(0);

    for (let m = 0; m < modeCount; m++) {
      const errorsBefore = sink.errors.length;
      const r = { deck: deck.id, mode: m, name: modeNames[m], status: "ok", notes: [] };
      try {
        await openModeList(page);
        await page.getByRole("listitem").nth(m).getByRole("button").first().click({ timeout: 15_000 });
        const start = page.getByRole("button", { name: "Начать занятие" });
        if (await start.last().isVisible({ timeout: 5000 }).catch(() => false)) await start.last().click();
        await enterPinIfAsked(page);
        if (await start.last().isVisible({ timeout: 1500 }).catch(() => false)) await start.last().click();
        await page.waitForTimeout(2500);

        const text = (await page.locator("body").innerText()).trim();
        if (!text) r.notes.push("white screen");
        if (/что-то пошло не так|something went wrong|ошибка загрузки/i.test(text)) r.notes.push("error screen");

        let stuck = 0, maxStuck = 0;
        for (let s = 0; s < STEPS_PER_MODE; s++) {
          stuck = (await blindStep(page, s)) ? 0 : stuck + 1;
          maxStuck = Math.max(maxStuck, stuck);
        }
        if (maxStuck >= STEPS_PER_MODE) r.notes.push("UI did not react to 5 blind taps (check screenshot: may need a gesture)");
        await page.screenshot({ path: `${dir}/${deck.id}-${m}.png` });
      } catch (e) {
        r.notes.push(`exception: ${e.message.split("\n")[0]}`);
        await page.screenshot({ path: `${dir}/${deck.id}-${m}-exception.png` }).catch(() => {});
      }
      const newErrors = sink.errors.slice(errorsBefore);
      if (newErrors.length) r.notes.push(...newErrors.map((x) => x.slice(0, 300)));
      if (r.notes.some((n) => !n.startsWith("UI did not react"))) r.status = "fail";
      else if (r.notes.length) r.status = "check";
      results.push(r);
      await leaveSession(page).catch(() => page.goto("/"));
    }

    writeFileSync(`${dir}/${deck.id}.json`, JSON.stringify(results, null, 2));
    const failed = results.filter((x) => x.status === "fail");
    expect.soft(failed, JSON.stringify(failed, null, 2)).toEqual([]);
  });
}
