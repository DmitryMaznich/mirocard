// Progress-safety ("chaos") scenarios. A blind run cannot finish a lesson, so
// "progress survived" is judged on server state that a newcomer builds in the
// first minutes — the student, the claimed deck, recorded sessions — plus the
// app coming back to a usable screen without errors. Lost = fewer rows than
// before, duplicated = more.
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  APP, uniqueEmail, createVerifiedAccountViaApi, loginViaUi, registerViaUi, waitForMail,
  collectPageErrors, asDistinctClient, addFirstStudent, openDeck, startMode, PASSWORD,
} from "./helpers.mjs";

// Each scenario builds a newcomer from scratch (register → student → deck → lesson)
// before the chaos even starts; 90 s is not enough on a busy machine.
test.describe.configure({ timeout: 180_000 });

const DECK = "Глаголы"; // passed newcomer.spec and the crawl without findings
const USABLE = ".home-header, .session-topbar";

async function serverState(token) {
  const get = async (p) => {
    const r = await fetch(`${APP}/api${p}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    return Array.isArray(j) ? j : (j.topics ?? j.students ?? j.items ?? []);
  };
  const [students, topics, sessions] = await Promise.all([get("/students"), get("/account-topics"), get("/sessions")]);
  return { students: students.length, topics: topics.length, sessions: sessions.length };
}

async function inLesson(page) {
  await addFirstStudent(page);
  await openDeck(page, DECK);
  await startMode(page, 1);
  await expect(page.getByRole("button", { name: "✕" })).toBeVisible({ timeout: 20_000 });
}

async function blindTaps(page, n = 6) {
  for (let i = 0; i < n; i++) {
    const b = page.locator("button:visible:enabled").filter({ hasNotText: /^(✕|Завершить|План занятия)$/ });
    if (await b.count()) await b.nth(i % (await b.count())).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

async function freshUserInLesson(page) {
  const email = uniqueEmail("chaos");
  const { token } = await createVerifiedAccountViaApi({ email });
  await asDistinctClient(page);
  await loginViaUi(page, { email });
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await inLesson(page);
  return { email, token };
}

function withoutNoise(errors) {
  // Offline scenarios legitimately log failed fetches.
  return errors.filter((e) => !/Failed to fetch|ERR_INTERNET_DISCONNECTED|NetworkError|net::ERR/i.test(e));
}

test("chaos: перезагрузка посреди занятия", async ({ page }) => {
  const sink = collectPageErrors(page);
  const { token } = await freshUserInLesson(page);
  await blindTaps(page);
  const before = await serverState(token);
  await page.reload();
  await expect(page.locator(USABLE).first()).toBeVisible({ timeout: 20_000 });
  expect(await serverState(token)).toEqual(before);
  expect(sink.errors, sink.errors.join("\n")).toEqual([]);
});

test("chaos: офлайн посреди занятия, затем сеть возвращается", async ({ page, context }) => {
  const sink = collectPageErrors(page);
  const { token } = await freshUserInLesson(page);
  const before = await serverState(token);
  await context.setOffline(true);
  await blindTaps(page);
  expect((await page.locator("body").innerText()).trim().length, "white screen while offline").toBeGreaterThan(0);
  await context.setOffline(false);
  await page.waitForTimeout(5000);
  await page.reload();
  await expect(page.locator(USABLE).first()).toBeVisible({ timeout: 20_000 });
  const after = await serverState(token);
  expect(after.students).toBe(before.students);
  expect(after.topics).toBe(before.topics);
  expect(after.sessions).toBeGreaterThanOrEqual(before.sessions);
  const errs = withoutNoise(sink.errors);
  expect(errs, errs.join("\n")).toEqual([]);
});

test("chaos: два устройства одного аккаунта занимаются параллельно", async ({ browser }, info) => {
  const email = uniqueEmail("twodev");
  const { token } = await createVerifiedAccountViaApi({ email });
  const ctxOpts = info.project.use;
  const a = await (await browser.newContext(ctxOpts)).newPage();
  const b = await (await browser.newContext(ctxOpts)).newPage();
  const sinkA = collectPageErrors(a), sinkB = collectPageErrors(b);
  for (const p of [a, b]) { await asDistinctClient(p); await loginViaUi(p, { email }); }
  await expect(a.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await inLesson(a);

  // Device B sees the student created on A (server sync) and can reach the same deck.
  await b.reload();
  await expect(b.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await expect(b.getByText("Миша").first(), "student from device A not visible on B").toBeVisible({ timeout: 15_000 });
  await openDeck(b, DECK);
  await startMode(b, 1);
  await expect(b.getByRole("button", { name: "✕" })).toBeVisible({ timeout: 20_000 });

  await Promise.all([blindTaps(a), blindTaps(b)]);
  await a.reload(); await b.reload();
  await expect(a.locator(USABLE).first()).toBeVisible({ timeout: 20_000 });
  await expect(b.locator(USABLE).first()).toBeVisible({ timeout: 20_000 });
  const st = await serverState(token);
  expect(st.students, "student duplicated by two devices").toBe(1);
  expect(st.topics, "deck duplicated by two devices").toBe(1);
  expect([...sinkA.errors, ...sinkB.errors]).toEqual([]);
});

test("chaos: очищенный браузер при живом аккаунте → вход → всё на месте", async ({ page }) => {
  const sink = collectPageErrors(page);
  const { email, token } = await freshUserInLesson(page);
  const before = await serverState(token);
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    for (const d of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();
  await loginViaUi(page, { email, password: PASSWORD });
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Миша").first(), "student not restored after storage wipe").toBeVisible({ timeout: 15_000 });
  expect(await serverState(token)).toEqual(before);
  expect(sink.errors, sink.errors.join("\n")).toEqual([]);
});

test("chaos: испорченный токен → понятный путь ко входу, не белый экран", async ({ page }) => {
  await freshUserInLesson(page);
  await page.goto("/");
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open("mirocard");
    req.onsuccess = () => {
      const tx = req.result.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put("invalid-token", "token");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }));
  await page.reload();
  await page.waitForTimeout(3000);
  // Either the app notices and shows login, or it stays on home; in the latter
  // case the next server action must not dead-end silently.
  const login = page.getByPlaceholder("Email");
  if (!(await login.isVisible().catch(() => false))) {
    // Home, or the resumed unfinished lesson (offline-first: the app keeps working locally).
    await expect(page.locator(USABLE).first()).toBeVisible({ timeout: 20_000 });
    if (await page.locator(".home-header").isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Тема/ }).first().click().catch(() => {});
    }
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `output/e2e-shots/chaos-bad-token-${test.info().project.name}.png`, fullPage: true });
  }
  expect((await page.locator("body").innerText()).trim().length, "white screen").toBeGreaterThan(0);
});

test("chaos: локальный режим, потом регистрация — фиксируем судьбу прогресса", async ({ page }) => {
  await asDistinctClient(page);
  await page.goto("/?local=1"); // hidden from ordinary visitors (N9)
  await page.getByRole("button", { name: "Без аккаунта (локальный режим)" }).click();
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await addFirstStudent(page, "Локальный");
  await page.screenshot({ path: `output/e2e-shots/local-mode-home-${test.info().project.name}.png`, fullPage: true });

  // How does a local-mode user get to registration at all? Record what the UI offers.
  const email = uniqueEmail("local2reg");
  await page.goto("/");
  const regButton = page.getByRole("button", { name: /зарегистр/i }).first();
  const reachable = await regButton.isVisible({ timeout: 5000 }).catch(() => false);
  test.info().annotations.push({ type: "local-mode", description: `registration reachable from local mode via "/": ${reachable}` });
  if (!reachable) return;
  await registerViaUi(page, { email });
  const link = new URL(await waitForMail(email));
  await page.goto(link.pathname + link.search);
  await page.getByRole("button", { name: /Перейти в приложение/ }).click({ timeout: 15_000 }).catch(() => {});
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  const kept = await page.getByText("Локальный").first().isVisible({ timeout: 5000 }).catch(() => false);
  test.info().annotations.push({ type: "local-mode", description: `local student kept after registering: ${kept}` });
  await page.screenshot({ path: `output/e2e-shots/local-then-register-${test.info().project.name}.png`, fullPage: true });
});

test("chaos: пробный период закончился — что видит пользователь (N2)", async ({ page }) => {
  const sink = collectPageErrors(page);
  const { email, token } = await freshUserInLesson(page);
  const { dataDir } = JSON.parse(readFileSync("output/test-env.json", "utf8"));
  const accountId = (await (await fetch(`${APP}/api/account/bootstrap`, { headers: { Authorization: `Bearer ${token}` } })).json()).account.id;
  const db = new DatabaseSync(path.join(dataDir, "mirocard.db"));
  const past = new Date(Date.now() - 86400000).toISOString();
  const changed = db.prepare("UPDATE entitlements SET ends_at = ? WHERE account_id = ?").run(past, accountId).changes;
  db.close();
  expect(changed, "trial entitlement found").toBeGreaterThan(0);

  const sub = await (await fetch(`${APP}/api/billing/subscription`, { headers: { Authorization: `Bearer ${token}` } })).json();
  test.info().annotations.push({ type: "trial-expired", description: `subscription after expiry: ${JSON.stringify(sub)}` });

  await page.goto("/");
  // A reload resumes the unfinished lesson (expected) — leave it to reach home.
  await expect(page.locator(USABLE).first()).toBeVisible({ timeout: 20_000 });
  const x = page.getByRole("button", { name: "✕" });
  if (await x.isVisible().catch(() => false)) {
    test.info().annotations.push({ type: "trial-expired", description: "after expiry + reload the unfinished lesson of the paid deck is still resumed" });
    await x.click();
    await page.getByRole("button", { name: "Завершить" }).click().catch(() => {});
  }
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Тема/ }).first().click();
  await page.getByRole("button", { name: "Всё", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `output/e2e-shots/trial-expired-catalog-${test.info().project.name}.png`, fullPage: true });
  const card = page.getByRole("article").filter({ hasText: DECK }).first();
  const label = (await card.innerText()).replace(/\s+/g, " ");
  test.info().annotations.push({ type: "trial-expired", description: `deck card after expiry: ${label}` });
  const open = card.getByRole("button", { name: /Открыть|По подписке/ }).first();
  await open.click().catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `output/e2e-shots/trial-expired-open-${test.info().project.name}.png`, fullPage: true });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
  test.info().annotations.push({ type: "trial-expired", description: `screen after tapping the deck: ${text}` });
  expect(text.trim().length, "white screen").toBeGreaterThan(0);

  // Payment is off at launch: what does "Перейти к оплате" do for this person?
  const pay = page.getByRole("button", { name: /Перейти к оплате/ });
  let afterPay = "(no pay button)";
  if (await pay.isVisible().catch(() => false)) {
    const popup = page.context().waitForEvent("page", { timeout: 5000 }).catch(() => null);
    await pay.click();
    await page.waitForTimeout(3000);
    const opened = await popup;
    afterPay = (opened ? `opened ${opened.url()} | ` : "") + (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500);
    await page.screenshot({ path: `output/e2e-shots/trial-expired-pay-${test.info().project.name}.png`, fullPage: true });
  }
  writeFileSync(`output/e2e-shots/trial-expired-${test.info().project.name}.txt`,
    [`subscription: ${JSON.stringify(sub)}`, `card: ${label}`, `after tap: ${text}`, `after pay: ${afterPay}`].join(String.fromCharCode(10)));
  const errs = sink.errors.filter((e) => !/ 40[023] /.test(e));
  expect(errs, errs.join(" | ")).toEqual([]);
});

test("chaos: колода обновилась, в кэше старая версия — тема открывается", async ({ page }) => {
  const sink = collectPageErrors(page);
  await freshUserInLesson(page); // deck ZIP now cached on this device
  await page.getByRole("button", { name: "✕" }).click();
  await page.getByRole("button", { name: "Завершить" }).click().catch(() => {});
  // Next load sees a newer catalog version for the same deck (what a deck release looks like to a client).
  await page.route("**/api/decks/catalog", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    for (const d of body.decks ?? []) if (d.title?.ru === DECK) d.version = d.version.replace(/\d+$/, (n) => String(Number(n) + 1));
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/");
  await expect(page.locator(".home-header")).toBeVisible({ timeout: 20_000 });
  await startMode(page, 1);
  await expect(page.getByRole("button", { name: "✕" })).toBeVisible({ timeout: 20_000 });
  expect(sink.errors, sink.errors.join(" | ")).toEqual([]);
});
